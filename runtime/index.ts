import { base64ToBytes } from "./util.js";
import { createProcessorClass } from "./processor-factory.js";
import { createInstance } from "./module-initializer.js";

declare function registerProcessor(name: string, processorClasss: any): void;

export function register(moduleName: string, base64: string) {
  const bytes = base64ToBytes(base64);
  const instance = createInstance(bytes);
  registerProcessor(moduleName, createProcessorClass(instance.exports));
}
