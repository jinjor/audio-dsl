import { ModuleHeader } from "./types";

export type ModuleCache = {
  has(name: string): boolean;
  get(name: string): ModuleHeader | null | undefined;
};
