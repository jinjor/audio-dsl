function decodeBase64(input) {
    if (typeof atob === "function") {
        return atob(input);
    }
    const keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + String.fromCharCode(chr1);
        if (enc3 !== 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 !== 64) {
            output = output + String.fromCharCode(chr3);
        }
    } while (i < input.length);
    return output;
}
function base64ToBytes(base64) {
    const decoded = decodeBase64(base64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; ++i) {
        bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
}

function createProcessorClass(instance) {
    const numInputs = instance.numberOfParams;
    const numOutputs = instance.numberOfOutChannels;
    const params = instance.getParamInfoList();
    for (const p of params) {
        console.log(p.ptr, p.descriptor);
    }
    return class extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return params.map((p) => p.descriptor);
        }
        process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];
            const inLength = Math.min(input.length, numInputs);
            const outLength = Math.min(output.length, numOutputs);
            for (let ch = 0; ch < inLength; ch++) {
                instance.setFloat32ArrayToInput(ch, input[ch]);
            }
            for (const paramInfo of params) {
                const { name, automationRate } = paramInfo.descriptor;
                const param = parameters[name];
                instance.setFloat32ArrayToParam(automationRate, paramInfo.ptr, param);
            }
            instance.process();
            for (let ch = 0; ch < outLength; ch++) {
                instance.getFloat32ArrayFromOutput(ch, output[ch]);
            }
            return true;
        }
    };
}

const numSamples = 128;
const sizeOfInt = 4;
const sizeOfFloat = 4;
function sizeOfStruct(fieldTypes) {
    let sum = 0;
    for (const t of fieldTypes) {
        if (t === "int") {
            sum += sizeOfInt;
        }
        else if (t === "float") {
            sum += sizeOfFloat;
        }
        else {
            throw new Error("unreachable");
        }
    }
    return sum;
}
const paramInfoFieldTypes = [
    "int",
    "float",
    "float",
    "float",
    "int",
];
const sizeOfParamInfo = sizeOfStruct(paramInfoFieldTypes);

function pointerToInt(memory, pointer) {
    const buf = memory.buffer.slice(pointer, pointer + 4);
    const view = new DataView(buf);
    return view.getInt32(0);
}
function pointerToFloat(memory, pointer) {
    const buf = memory.buffer.slice(pointer, pointer + 4);
    const view = new DataView(buf);
    return view.getFloat32(0);
}
function pointerToString(memory, pointer) {
    const pointerToData = pointer + 1;
    const lenBuf = memory.buffer.slice(pointer, pointerToData);
    const length = Array.from(new Uint8Array(lenBuf))[0];
    const sliced = memory.buffer.slice(pointerToData, pointerToData + length);
    return String.fromCharCode(...new Uint8Array(sliced));
}
const util = {
    name: "util",
    create(memory) {
        return {
            log_i: function (arg) {
                console.log("log_i:", arg);
            },
            log_f: function (arg) {
                console.log("log_f:", arg);
            },
            log_b: function (arg) {
                console.log("log_b:", arg);
            },
            log_s: function (pointer) {
                console.log("log_s:", pointerToString(memory, pointer));
            },
        };
    },
};
const math = {
    name: "math",
    create(memory) {
        return {
            acos: Math.acos,
            asin: Math.asin,
            atan: Math.atan,
            atan2: Math.atan2,
            cos: Math.cos,
            exp: Math.exp,
            log: Math.log,
            log10: Math.log10,
            pow: Math.pow,
            sin: Math.sin,
            tan: Math.tan,
            acosh: Math.acosh,
            asinh: Math.asinh,
            atanh: Math.atanh,
            cosh: Math.cosh,
            sinh: Math.sinh,
            tanh: Math.tanh,
            random: Math.random,
        };
    },
};

function createImportObject(memory, libs) {
    const importObject = {
        env: {
            memory,
        },
    };
    for (const lib of libs) {
        importObject[lib.name] = lib.create(memory);
    }
    return importObject;
}
function readStruct(memory, fieldTypes, offset) {
    const result = [];
    for (const t of fieldTypes) {
        if (t === "int") {
            result.push(pointerToInt(memory, offset));
            offset += sizeOfInt;
        }
        else if (t === "float") {
            result.push(pointerToFloat(memory, offset));
            offset += sizeOfFloat;
        }
        else {
            throw new Error("unreachable");
        }
    }
    return result;
}
class Instance {
    constructor(bytes, libs) {
        var _a, _b;
        this.inPtrs = [];
        this.outPtrs = [];
        this.paramInfo = [];
        const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
        const mod = new WebAssembly.Module(bytes);
        const importObject = createImportObject(memory, libs);
        const instance = new WebAssembly.Instance(mod, importObject);
        this.memory = memory;
        this.exports = instance.exports;
        for (let i = 0; i < this.exports.number_of_in_channels.value; i++) {
            this.inPtrs[i] =
                this.exports.pointer_of_in_channels.value +
                    numSamples * sizeOfFloat * i;
        }
        for (let i = 0; i < this.exports.number_of_out_channels.value; i++) {
            this.outPtrs[i] =
                this.exports.pointer_of_out_channels.value +
                    numSamples * sizeOfFloat * i;
        }
        if ((_b = (_a = this.exports.number_of_params) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 0 > 1) {
            const staticPtr = this.exports.pointer_of_static_data.value;
            let infoPtr = staticPtr + this.exports.offset_of_param_info.value;
            let paramPtr = this.exports.pointer_of_params.value;
            for (let i = 0; i < this.exports.number_of_params.value; i++) {
                const [namePtr, defaultValue, minValue, maxValue, automationRatePtr,] = readStruct(memory, paramInfoFieldTypes, infoPtr);
                const name = pointerToString(memory, staticPtr + namePtr);
                const automationRate = pointerToString(memory, staticPtr + automationRatePtr);
                this.paramInfo[i] = {
                    descriptor: {
                        name,
                        defaultValue,
                        minValue,
                        maxValue,
                        automationRate,
                    },
                    ptr: paramPtr,
                };
                const length = sizeOfFloat * (automationRate === "a-rate" ? numSamples : 1);
                infoPtr += sizeOfParamInfo;
                paramPtr += length;
            }
        }
    }
    getAudioArrayAt(ptr) {
        return this.memory.buffer.slice(ptr, ptr + numSamples * sizeOfFloat);
    }
    getInputBuffer(n) {
        return this.getAudioArrayAt(this.inPtrs[n]);
    }
    getOutputBuffer(n) {
        return this.getAudioArrayAt(this.outPtrs[n]);
    }
    getStaticBuffer() {
        const ptr = this.exports.pointer_of_static_data.value;
        return this.memory.buffer.slice(ptr, ptr + this.exports.size_of_static_data);
    }
    getParamInfoBuffer() {
        if (this.exports.offset_of_param_info == null) {
            return null;
        }
        const ptr = this.exports.pointer_of_static_data.value +
            this.exports.offset_of_param_info.value;
        return this.memory.buffer.slice(ptr, ptr + sizeOfParamInfo);
    }
    getParamInfo(n) {
        return this.paramInfo[n];
    }
    getParamInfoList() {
        const info = [];
        for (let i = 0; i < this.numberOfParams; i++) {
            info.push(this.getParamInfo(i));
        }
        return info;
    }
    setFloat32ArrayToInput(n, incomingInput) {
        const view = new Float32Array(this.memory.buffer, this.inPtrs[n], numSamples);
        view.set(incomingInput);
    }
    setFloat32ArrayToParam(automationRate, ptr, param) {
        const arrayLength = automationRate === "a-rate" ? numSamples : 1;
        const view = new Float32Array(this.memory.buffer, ptr, arrayLength);
        if (param.length === 1 || arrayLength === 1) {
            view.fill(param[0]);
        }
        else {
            view.set(param);
        }
    }
    getFloat32ArrayFromOutput(n, outgoingOutput) {
        const view = new Float32Array(this.memory.buffer, this.outPtrs[n], numSamples);
        outgoingOutput.set(view);
    }
    process() {
        this.exports.process();
    }
    test() {
        var _a, _b, _c, _d, _e;
        if (this.exports.test) {
            console.log("testing module...");
            this.exports.test();
        }
        const exp = this.exports;
        console.log("number_of_in_channels:", exp.number_of_in_channels.value);
        console.log("number_of_out_channels:", exp.number_of_out_channels.value);
        console.log("number_of_params:", exp.number_of_params.value);
        console.log("pointer_of_in_channels:", (_a = exp.pointer_of_in_channels) === null || _a === void 0 ? void 0 : _a.value);
        console.log("pointer_of_out_channels:", (_b = exp.pointer_of_out_channels) === null || _b === void 0 ? void 0 : _b.value);
        console.log("pointer_of_params:", (_c = exp.pointer_of_params) === null || _c === void 0 ? void 0 : _c.value);
        console.log("pointer_of_static_data:", (_d = exp.pointer_of_static_data) === null || _d === void 0 ? void 0 : _d.value);
        console.log("size_of_static_data:", exp.size_of_static_data.value);
        console.log("offset_of_param_info:", (_e = exp.offset_of_param_info) === null || _e === void 0 ? void 0 : _e.value);
        console.log("in_0", this.getInputBuffer(0));
        console.log("in_1", this.getInputBuffer(1));
        console.log("out_0", this.getOutputBuffer(0));
        console.log("out_1", this.getOutputBuffer(1));
        console.log("static", this.getStaticBuffer());
        console.log("params", this.getParamInfoBuffer());
    }
    get numberOfInChannels() {
        return this.exports.number_of_in_channels.value;
    }
    get numberOfOutChannels() {
        return this.exports.number_of_out_channels.value;
    }
    get numberOfParams() {
        return this.exports.number_of_params.value;
    }
}

function register(moduleName, base64) {
    const bytes = base64ToBytes(base64);
    const libs = [util, math];
    const instance = new Instance(bytes, libs);
    instance.test();
    registerProcessor(moduleName, createProcessorClass(instance));
}

export { register };
