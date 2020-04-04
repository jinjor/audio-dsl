import { FunctionType, primitives, ConstantType, ModuleHeader } from "./types";

export const builtInModule: ModuleHeader = {
  types: new Map<string, FunctionType | ConstantType>(),
};
builtInModule.types.set("float", {
  $: "FunctionType",
  params: [primitives.int32Type],
  returnType: primitives.float32Type,
});
builtInModule.types.set("int", {
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.int32Type,
});
