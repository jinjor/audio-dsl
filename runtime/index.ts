import { base64ToBytes } from "./common/util.js";
import { createProcessorClass } from "./processor-factory.js";
import { Instance } from "./common/module.js";

declare function registerProcessor(name: string, processorClasss: any): void;

export function createModuleInstance(base64: string): Instance {
  const bytes = base64ToBytes(base64);
  return Instance.create(bytes);
}

export function register(moduleName: string, base64: string): void {
  const instance = createModuleInstance(base64);
  registerProcessor(moduleName, createProcessorClass(instance));
}
