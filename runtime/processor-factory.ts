import { LanguageSpecificExports } from "./definition.js";

declare const AudioWorkletProcessor: any;

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
function pointerToString(
  memory: WebAssembly.Memory,
  pointerToLength: number
): string {
  const pointerToData = pointerToLength + 1;
  const lenBuf = memory.buffer.slice(pointerToLength, pointerToData);
  const length = Array.from(new Uint8Array(lenBuf))[0];
  const sliced = memory.buffer.slice(pointerToData, pointerToData + length);
  // utf-8 is not supported (because TextDecoder is not here...)
  return String.fromCharCode(...new Uint8Array(sliced));
}

type Descriptor = {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: string; // "a-rate" | "k-rate"
};
function getDescriptor(
  memory: WebAssembly.Memory,
  staticPtr: number,
  paramInfoRelativeOffset: number
): Descriptor {
  const paramInfoOffset = staticPtr + paramInfoRelativeOffset;
  // get struct
  const namePtr = pointerToInt(memory, paramInfoOffset);
  const defaultValue = pointerToFloat(memory, paramInfoOffset + 4);
  const minValue = pointerToFloat(memory, paramInfoOffset + 8);
  const maxValue = pointerToFloat(memory, paramInfoOffset + 12);
  const automationRatePtr = pointerToInt(memory, paramInfoOffset + 16);
  // get string
  const name = pointerToString(memory, staticPtr + namePtr);
  const automationRate = pointerToString(memory, staticPtr + automationRatePtr);
  return {
    name,
    defaultValue,
    minValue,
    maxValue,
    automationRate
  };
}

export function createProcessorClass(exports: LanguageSpecificExports) {
  const memory = exports.memory;
  // const numInputs = exports.number_of_in_channels.value;
  // const numOutputs = exports.number_of_out_channels.value;
  const numInputs = 1;
  const numOutputs = 1;
  const numSamples = 128;
  const inPtrs = [exports.in_0.value, exports.in_1.value];
  const outPtrs = [exports.out_0.value, exports.out_1.value];

  const staticPtr = exports.static.value;
  const paramInfoRelativeOffset = exports.params.value;
  const descriptor = getDescriptor(memory, staticPtr, paramInfoRelativeOffset);
  const params = [
    {
      descriptor,
      ptr: 2048 // TODO
    }
  ];
  console.log(params);

  return class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return params.map(p => p.descriptor);
    }
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: { [key: string]: Float32Array }
    ) {
      const input = inputs[0];
      const output = outputs[0];
      const inLength = Math.min(input.length, numInputs);
      const outLength = Math.min(output.length, numOutputs);

      for (let ch = 0; ch < inLength; ch++) {
        const view = new Float32Array(memory.buffer, inPtrs[ch], numSamples);
        view.set(input[ch]);
      }
      for (const paramInfo of params) {
        const { name, automationRate } = paramInfo.descriptor;
        const arrayLength = automationRate === "a-rate" ? numSamples : 1;
        const param = parameters[name];
        const view = new Float32Array(
          memory.buffer,
          paramInfo.ptr,
          arrayLength
        );
        if (param.length === 1) {
          view.fill(param[0]);
        } else {
          view.set(param);
        }
      }
      exports.process();
      for (let ch = 0; ch < outLength; ch++) {
        const view = new Float32Array(memory.buffer, outPtrs[ch], numSamples);
        output[ch].set(view);
      }
      return true;
    }
  };
}
