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

  // TODO: get from module
  const params = [
    {
      descriptor: {
        name: "note",
        defaultValue: 69,
        minValue: 0,
        maxValue: 127,
        automationRate: "a-rate"
      },
      ptr: 2048
    }
  ];
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
        const param = parameters[paramInfo.descriptor.name];
        const view = new Float32Array(memory.buffer, paramInfo.ptr, numSamples);
        if (param.length === 1) {
          view.fill(param[0]); // TODO: k-rate param should be non-array
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
