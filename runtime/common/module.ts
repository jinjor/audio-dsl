import {
  LanguageSpecificInstance,
  LanguageSpecificExports,
} from "./definition.js";
import { pointerToInt, pointerToFloat, pointerToString, Lib } from "./lib";

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

const numSamples = 128;
const sizeOfInt = 4;
const sizeOfFloat = 4;
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
      this.inPtrs[i] = this.exports.in_0.value + numSamples * sizeOfFloat * i;
    }
    for (let i = 0; i < this.exports.number_of_out_channels.value; i++) {
      this.outPtrs[i] = this.exports.out_0.value + numSamples * sizeOfFloat * i;
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
    const ptr = this.exports.static.value;
    return this.memory.buffer.slice(ptr, ptr + 100); // TODO: ?
  }
  getParamInfoBuffer(): ArrayBuffer {
    const ptr = this.exports.static.value + this.exports.params?.value; // TODO
    return this.memory.buffer.slice(ptr, ptr + 4 + 4 + 4 + 4 + 4); // TODO
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
      automationRate,
    };
  }
  getParamInfoList(): { descriptor: Descriptor; ptr: number }[] {
    const info: { descriptor: Descriptor; ptr: number }[] = [];
    const offset =
      this.outPtrs[this.outPtrs.length - 1] + numSamples * sizeOfFloat; // TODO
    for (let i = 0; i < this.exports.number_of_params.value; i++) {
      const descriptor = this.getNthDescriptor(i);
      info.push({ descriptor, ptr: offset + numSamples * sizeOfFloat * i });
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
  process(): void {
    this.exports.process();
  }
  test(): void {
    if (this.exports.test) {
      console.log("testing module...");
      this.exports.test();
    }
  }
  static create(bytes: Uint8Array, libs: Lib[]): Instance {
    const instance = new Instance(bytes, libs);
    const exp = instance.exports;
    instance.test();
    console.log("number_of_in_channels:", exp.number_of_in_channels.value);
    console.log("number_of_out_channels:", exp.number_of_out_channels.value);
    console.log("params:", exp.params?.value); // TODO
    console.log("number_of_params:", exp.number_of_params.value);
    console.log("static:", exp.static.value);
    console.log("inputs:", exp.in_0.value);
    console.log("outputs:", exp.out_0.value);
    console.log("in_0", instance.getNthInputBuffer(0));
    console.log("in_1", instance.getNthInputBuffer(1));
    console.log("out_0", instance.getNthOutputBuffer(0));
    console.log("out_1", instance.getNthOutputBuffer(1));
    console.log("static", instance.getStaticBuffer());
    console.log("params", instance.getParamInfoBuffer());
    return instance;
  }
}
