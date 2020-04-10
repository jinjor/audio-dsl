import { base64ToBytes } from "./common/util.js";
import { createProcessorClass } from "./processor-factory.js";
import { Instance } from "./common/module.js";
import { util, math } from "./common/lib";

declare function registerProcessor(name: string, processorClasss: any): void;

export function register(moduleName: string, base64: string): void {
  const bytes = base64ToBytes(base64);
  const libs = [util, math];
  const instance = new Instance(bytes, libs);
  instance.test();
  registerProcessor(moduleName, createProcessorClass(instance));
}
