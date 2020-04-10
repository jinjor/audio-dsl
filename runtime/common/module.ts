import {
  LanguageSpecificInstance,
  LanguageSpecificExports,
  numSamples,
  sizeOfInt,
  sizeOfFloat,
  sizeOfParamInfo,
  ParamInfo,
  StructFieldTypes,
  paramInfoFieldTypes,
} from "./definition.js";
import { pointerToInt, pointerToFloat, pointerToString, Lib } from "./lib";

export type ImportObject = Record<string, Record<string, any>>;

export function createImportObject(
  memory: WebAssembly.Memory,
  libs: Lib[]
): ImportObject {
  const importObject: ImportObject = {
    env: {
      memory,
    },
  };
  for (const lib of libs) {
    importObject[lib.name] = lib.create(memory);
  }
  return importObject;
}

function readStruct(
  memory: WebAssembly.Memory,
  fieldTypes: StructFieldTypes,
  offset: number
): number[] {
  const result = [];
  for (const t of fieldTypes) {
    if (t === "int") {
      result.push(pointerToInt(memory, offset));
      offset += sizeOfInt;
    } else if (t === "float") {
      result.push(pointerToFloat(memory, offset));
      offset += sizeOfFloat;
    } else {
      throw new Error("unreachable");
    }
  }
  return result;
}

export class Instance {
  private memory: WebAssembly.Memory;
  private exports: LanguageSpecificExports;
  private inPtrs: number[] = [];
  private outPtrs: number[] = [];
  private paramInfo: ParamInfo[] = [];
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
        this.exports.pointer_of_in_channels!.value +
        numSamples * sizeOfFloat * i;
    }
    for (let i = 0; i < this.exports.number_of_out_channels.value; i++) {
      this.outPtrs[i] =
        this.exports.pointer_of_out_channels!.value +
        numSamples * sizeOfFloat * i;
    }
    if (this.exports.number_of_params?.value ?? 0 > 1) {
      const staticPtr = this.exports.pointer_of_static_data!.value;
      let infoPtr = staticPtr + this.exports.offset_of_param_info!.value;
      let paramPtr = this.exports.pointer_of_params!.value;
      for (let i = 0; i < this.exports.number_of_params!.value; i++) {
        const [
          namePtr,
          defaultValue,
          minValue,
          maxValue,
          automationRatePtr,
        ] = readStruct(memory, paramInfoFieldTypes, infoPtr);
        const name = pointerToString(memory, staticPtr + namePtr);
        const automationRate = pointerToString(
          memory,
          staticPtr + automationRatePtr
        );
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
        const length = automationRate === "a-rate" ? numSamples : 1;
        infoPtr += sizeOfParamInfo;
        paramPtr += length;
      }
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
    const ptr = this.exports.pointer_of_static_data!.value;
    return this.memory.buffer.slice(
      ptr,
      ptr + this.exports.size_of_static_data
    );
  }
  getParamInfoBuffer(): ArrayBuffer | null {
    if (this.exports.offset_of_param_info == null) {
      return null;
    }
    const ptr =
      this.exports.pointer_of_static_data!.value +
      this.exports.offset_of_param_info.value;
    return this.memory.buffer.slice(ptr, ptr + sizeOfParamInfo);
  }
  getNthParamInfo(n: number): ParamInfo | null {
    return this.paramInfo[n];
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
  setFloat32ArrayToParam(
    automationRate: string,
    ptr: number,
    param: Float32Array
  ) {
    const arrayLength = automationRate === "a-rate" ? numSamples : 1;
    const view = new Float32Array(this.memory.buffer, ptr, arrayLength);
    if (param.length === 1 || arrayLength === 1) {
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
    console.log("pointer_of_in_channels:", exp.pointer_of_in_channels?.value);
    console.log("pointer_of_out_channels:", exp.pointer_of_out_channels?.value);
    console.log("pointer_of_params:", exp.pointer_of_params?.value);
    console.log("pointer_of_static_data:", exp.pointer_of_static_data?.value);
    console.log("size_of_static_data:", exp.size_of_static_data.value);
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
