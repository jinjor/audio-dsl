import { LanguageSpecificExports } from "./definition.js";

declare const AudioWorkletProcessor: any;

export function createProcessorClass(exports: LanguageSpecificExports) {
  const memory = exports.memory;
  // const numInputs = exports.number_of_in_channels.value;
  // const numOutputs = exports.number_of_out_channels.value;
  const numInputs = 1;
  const numOutputs = 1;
  const numSamples = 128;
  const inPtrs = [exports.in_0.value, exports.in_1.value];
  const outPtrs = [exports.out_0.value, exports.out_1.value];
  return class extends AudioWorkletProcessor {
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: any
    ) {
      const input = inputs[0];
      const output = outputs[0];
      const inLength = Math.min(input.length, numInputs);
      const outLength = Math.min(output.length, numOutputs);

      for (let ch = 0; ch < inLength; ch++) {
        const view = new Float32Array(memory.buffer, inPtrs[ch], numSamples);
        view.set(input[ch]);
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
