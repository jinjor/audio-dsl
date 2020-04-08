import { Instance } from "./common/module";

declare const AudioWorkletProcessor: any;

export function createProcessorClass(instance: Instance) {
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
        instance.setFloat32ArrayToParam(automationRate, paramInfo.ptr, param);
      }
      instance.process();
      for (let ch = 0; ch < outLength; ch++) {
        instance.getFloat32ArrayFromNthOutput(ch, output[ch]);
      }
      return true;
    }
  };
}
