import { Instance } from "./common/module";

declare const AudioWorkletProcessor: any;

export function createProcessorClass(instance: Instance) {
  // const numInputs = exports.number_of_in_channels.value;
  // const numOutputs = exports.number_of_out_channels.value;
  const numInputs = 1;
  const numOutputs = 1;
  const params = instance.getParamInfoList();
  console.log(params[0]);

  return class extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return params.map((p) => p.descriptor);
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
        instance.setFloat32ArrayToNthInput(ch, input[ch]);
      }
      for (const paramInfo of params) {
        const { name, automationRate } = paramInfo.descriptor;
        const param = parameters[name];
        instance.setParam(automationRate, paramInfo.ptr, param);
      }
      instance.process();
      for (let ch = 0; ch < outLength; ch++) {
        instance.getFloat32ArrayFromNthOutput(ch, output[ch]);
      }
      return true;
    }
  };
}
