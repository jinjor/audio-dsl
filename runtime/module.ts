import {
  LanguageSpecificInstance,
  LanguageSpecificExports
} from "./definition.js";

function pointerToInt(memory: WebAssembly.Memory, pointer: number): number {
  const buf = memory.buffer.slice(pointer, pointer + 4);
  const view = new DataView(buf);
  return view.getInt32(0);
}
function pointerToFloat(memory: WebAssembly.Memory, pointer: number): number {
  const buf = memory.buffer.slice(pointer, pointer + 4);
  const view = new DataView(buf);
  return view.getFloat32(0);
}
function pointerToString(memory: WebAssembly.Memory, pointer: number): string {
  const pointerToData = pointer + 1;
  const lenBuf = memory.buffer.slice(pointer, pointerToData);
  const length = Array.from(new Uint8Array(lenBuf))[0];
  const sliced = memory.buffer.slice(pointerToData, pointerToData + length);
  // utf-8 is not supported (because TextDecoder is not here...)
  return String.fromCharCode(...new Uint8Array(sliced));
}

function createUtilModule(memory: WebAssembly.Memory): any {
  return {
    log_i: function(arg: number) {
      console.log("log_i:", arg);
    },
    log_f: function(arg: number) {
      console.log("log_f:", arg);
    },
    log_b: function(arg: number) {
      console.log("log_b:", arg);
    },
    log_s: function(pointer: number) {
      console.log("log_s:", pointerToString(memory, pointer));
    }
  };
}

function createMathModule(memory: WebAssembly.Memory): any {
  return {
    abs: Math.abs,
    acos: Math.acos,
    asin: Math.asin,
    atan: Math.atan,
    atan2: Math.atan2,
    ceil: Math.ceil,
    cos: Math.cos,
    exp: Math.exp,
    floor: Math.floor,
    log: Math.log,
    log10: Math.log10,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    round: Math.fround,
    sin: Math.sin,
    sqrt: Math.sqrt,
    tan: Math.tan,
    acosh: Math.acosh,
    asinh: Math.asinh,
    atanh: Math.atanh,
    cosh: Math.cosh,
    sinh: Math.sinh,
    tanh: Math.tanh
  };
}

function createImportObject(memory: WebAssembly.Memory): any {
  return {
    env: {
      memory
    },
    util: createUtilModule(memory),
    math: createMathModule(memory)
  };
}

export type Descriptor = {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: string; // "a-rate" | "k-rate"
};

const numSamples = 128;
export class Instance {
  private memory: WebAssembly.Memory;
  exports: LanguageSpecificExports;
  private inPtrs: number[];
  private outPtrs: number[];
  constructor(bytes: Uint8Array) {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const mod = new WebAssembly.Module(bytes);
    const lib = createImportObject(memory);
    const instance = new WebAssembly.Instance(
      mod,
      lib
    ) as LanguageSpecificInstance;
    this.memory = memory;
    this.exports = instance.exports;
    this.inPtrs = [this.exports.in_0.value, this.exports.in_1.value];
    this.outPtrs = [this.exports.out_0.value, this.exports.out_1.value];
  }
  getAudioArrayAt(ptr: number): ArrayBuffer {
    return this.memory.buffer.slice(ptr, ptr + 128 * 4);
  }
  getNthInputBuffer(n: number): ArrayBuffer {
    return this.getAudioArrayAt(this.inPtrs[n]);
  }
  getNthOutputBuffer(n: number): ArrayBuffer {
    return this.getAudioArrayAt(this.outPtrs[n]);
  }
  getStaticBuffer(): ArrayBuffer {
    const ptr = this.exports.static.value;
    return this.memory.buffer.slice(ptr, ptr + 100);
  }
  getParamInfoBuffer(): ArrayBuffer {
    const ptr = this.exports.static.value + this.exports.params.value;
    return this.memory.buffer.slice(ptr, ptr + 4 + 4 + 4 + 4 + 4);
  }
  getNthDescriptor(n: number): Descriptor {
    const memory = this.memory;
    const staticPtr = this.exports.static.value;
    const paramInfoRelativeOffset = this.exports.params.value;

    const paramInfoOffset = staticPtr + paramInfoRelativeOffset;
    // get struct
    const namePtr = pointerToInt(memory, paramInfoOffset);
    const defaultValue = pointerToFloat(memory, paramInfoOffset + 4);
    const minValue = pointerToFloat(memory, paramInfoOffset + 8);
    const maxValue = pointerToFloat(memory, paramInfoOffset + 12);
    const automationRatePtr = pointerToInt(memory, paramInfoOffset + 16);
    // get string
    const name = pointerToString(memory, staticPtr + namePtr);
    const automationRate = pointerToString(
      memory,
      staticPtr + automationRatePtr
    );
    return {
      name,
      defaultValue,
      minValue,
      maxValue,
      automationRate
    };
  }
  getParamInfoList(): { descriptor: Descriptor; ptr: number }[] {
    const info: { descriptor: Descriptor; ptr: number }[] = [];
    for (let i = 0; i < this.exports.number_of_params.value; i++) {
      const descriptor = this.getNthDescriptor(i);
      info.push({ descriptor, ptr: 2048 }); // TODO
    }
    return info;
  }
  setFloat32ArrayToNthInput(n: number, incommingInput: Float32Array) {
    const view = new Float32Array(
      this.memory.buffer,
      this.inPtrs[n],
      numSamples
    );
    view.set(incommingInput);
  }
  setParam(automationRate: string, ptr: number, param: Float32Array) {
    const arrayLength = automationRate === "a-rate" ? numSamples : 1;
    const view = new Float32Array(this.memory.buffer, ptr, arrayLength);
    if (param.length === 1) {
      view.fill(param[0]);
    } else {
      view.set(param);
    }
  }
  getFloat32ArrayFromNthOutput(n: number, outgoingOutput: Float32Array) {
    const view = new Float32Array(
      this.memory.buffer,
      this.outPtrs[n],
      numSamples
    );
    outgoingOutput.set(view);
  }
}

export function createInstance(bytes: Uint8Array): Instance {
  const instance = new Instance(bytes);
  const exp = instance.exports;

  if (exp.test) {
    console.log("testing module...");
    exp.test();
  }
  console.log("number_of_in_channels:", exp.number_of_in_channels.value);
  console.log("number_of_out_channels:", exp.number_of_out_channels.value);
  console.log("params:", exp.params.value);
  console.log("number_of_params:", exp.number_of_params.value);
  console.log("static:", exp.static.value);
  console.log("in_0:", exp.in_0.value);
  console.log("in_1:", exp.in_1.value);
  console.log("out_0:", exp.out_0.value);
  console.log("out_1:", exp.out_1.value);
  // console.log("buffer:", memory.buffer);
  console.log("in_0", instance.getNthInputBuffer(0));
  console.log("in_1", instance.getNthInputBuffer(1));
  console.log("out_0", instance.getNthOutputBuffer(0));
  console.log("out_1", instance.getNthOutputBuffer(1));
  console.log("static", instance.getStaticBuffer());
  console.log("params", instance.getParamInfoBuffer());
  return instance;
}
