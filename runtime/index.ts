import { base64ToBytes } from "./util.js";
import { createProcessorClass } from "./processor-factory.js";
import { Instance } from "./module.js";

declare function registerProcessor(name: string, processorClasss: any): void;

export function register(moduleName: string, base64: string) {
  const bytes = base64ToBytes(base64);
  const instance = Instance.create(bytes);
  registerProcessor(moduleName, createProcessorClass(instance));
}
