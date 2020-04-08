import {
  LanguageSpecificInstance,
  LanguageSpecificExports,
} from "./definition.js";
import {
  pointerToInt,
  pointerToFloat,
  pointerToString,
  Lib,
  pointerToBool,
} from "./lib";

function createImportObject(memory: WebAssembly.Memory, libs: Lib[]): any {
  const importObject: any = {
    env: {
      memory,
    },
  };
  for (const lib of libs) {
    importObject[lib.name] = lib.create(memory);
  }
  return importObject;
}

export type Descriptor = {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: string; // "a-rate" | "k-rate"
};
export type ParamInfo = {
  descriptor: Descriptor;
  ptr: number;
  isInt: boolean;
};

const numSamples = 128;
const sizeOfInt = 4;
const sizeOfFloat = 4;
const sizeOfParamInfo = 24; // TODO
export class Instance {
  private memory: WebAssembly.Memory;
  private exports: LanguageSpecificExports;
  private inPtrs: number[] = [];
  private outPtrs: number[] = [];
  constructor(bytes: Uint8Array, libs: Lib[]) {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const mod = new WebAssembly.Module(bytes);
    const importObject = createImportObject(memory, libs);
    const instance = new WebAssembly.Instance(
      mod,
      importObject
    ) as LanguageSpecificInstance;
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
  }
  private getAudioArrayAt(ptr: number): ArrayBuffer {
    return this.memory.buffer.slice(ptr, ptr + numSamples * sizeOfFloat);
  }
  private getNthInputBuffer(n: number): ArrayBuffer {
    return this.getAudioArrayAt(this.inPtrs[n]);
  }
  private getNthOutputBuffer(n: number): ArrayBuffer {
    return this.getAudioArrayAt(this.outPtrs[n]);
  }
  private getStaticBuffer(): ArrayBuffer {
    const ptr = this.exports.pointer_of_static_data.value;
    return this.memory.buffer.slice(ptr, ptr + 100); // TODO: ?
  }
  getParamInfoBuffer(): ArrayBuffer | null {
    if (this.exports.offset_of_param_info == null) {
      return null;
    }
    const ptr =
      this.exports.pointer_of_static_data.value +
      this.exports.offset_of_param_info.value;
    return this.memory.buffer.slice(ptr, ptr + sizeOfParamInfo);
  }
  getNthParamInfo(n: number): ParamInfo | null {
    const memory = this.memory;
    const staticPtr = this.exports.pointer_of_static_data.value;
    if (n >= this.numberOfParams) {
      return null;
    }
    const paramInfoRelativeOffset = this.exports.offset_of_param_info!.value;

    const paramInfoOffset =
      staticPtr + paramInfoRelativeOffset + n * sizeOfParamInfo;
    // get struct
    const isInt = pointerToBool(memory, paramInfoOffset);
    const pointerToValue = isInt ? pointerToInt : pointerToFloat;
    const namePtr = pointerToInt(memory, paramInfoOffset + 4);
    const defaultValue = pointerToValue(memory, paramInfoOffset + 8);
    const minValue = pointerToValue(memory, paramInfoOffset + 12);
    const maxValue = pointerToValue(memory, paramInfoOffset + 16);
    const automationRatePtr = pointerToInt(memory, paramInfoOffset + 20);
    // get string
    const name = pointerToString(memory, staticPtr + namePtr);
    const automationRate = pointerToString(
      memory,
      staticPtr + automationRatePtr
    );
    const ptr =
      this.outPtrs[this.outPtrs.length - 1] +
      sizeOfFloat * numSamples + // TODO
      (isInt ? sizeOfInt : sizeOfFloat) * numSamples * n; // TODO
    return {
      descriptor: {
        name,
        defaultValue,
        minValue,
        maxValue,
        automationRate,
      },
      isInt,
      ptr,
    };
  }
  getParamInfoList(): ParamInfo[] {
    const info: ParamInfo[] = [];
    for (let i = 0; i < this.numberOfParams; i++) {
      info.push(this.getNthParamInfo(i)!);
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
  setParam(
    isInt: boolean,
    automationRate: string,
    ptr: number,
    param: Float32Array
  ) {
    const arrayLength = automationRate === "a-rate" ? numSamples : 1;
    const view = isInt
      ? new Int32Array(this.memory.buffer, ptr, arrayLength)
      : new Float32Array(this.memory.buffer, ptr, arrayLength);
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
  process(): void {
    this.exports.process();
  }
  test(): void {
    if (this.exports.test) {
      console.log("testing module...");
      this.exports.test();
    }
  }
  get numberOfInChannels(): number {
    return this.exports.number_of_in_channels.value;
  }
  get numberOfOutChannels(): number {
    return this.exports.number_of_out_channels.value;
  }
  get numberOfParams(): number {
    return this.exports.number_of_params.value;
  }
  static create(bytes: Uint8Array, libs: Lib[]): Instance {
    const instance = new Instance(bytes, libs);
    const exp = instance.exports;
    instance.test();
    console.log("number_of_in_channels:", exp.number_of_in_channels.value);
    console.log("number_of_out_channels:", exp.number_of_out_channels.value);
    console.log("number_of_params:", exp.number_of_params.value);

    console.log("pointer_of_in_channels:", exp.pointer_of_in_channels.value);
    console.log("pointer_of_out_channels:", exp.pointer_of_out_channels.value);
    // console.log("pointer_of_params:", exp.pointer_of_params.value);// TODO
    console.log("pointer_of_static_data:", exp.pointer_of_static_data?.value);
    console.log("offset_of_param_info:", exp.offset_of_param_info?.value);
    console.log("in_0", instance.getNthInputBuffer(0));
    console.log("in_1", instance.getNthInputBuffer(1));
    console.log("out_0", instance.getNthOutputBuffer(0));
    console.log("out_1", instance.getNthOutputBuffer(1));
    console.log("static", instance.getStaticBuffer());
    console.log("params", instance.getParamInfoBuffer());
    return instance;
  }
}
