import { FunctionType, primitives, NumberConst, ModuleHeader } from "./types";

export const mathModule: ModuleHeader = {
  types: new Map<string, FunctionType | NumberConst>()
};
mathModule.types.set("sin", {
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type
});
mathModule.types.set("pow", {
  $: "FunctionType",
  params: [primitives.float32Type, primitives.float32Type],
  returnType: primitives.float32Type
});
mathModule.types.set("PI", { $: "Float32Const", value: Math.PI });

export const utilModule = {
  types: new Map<string, FunctionType>()
};
utilModule.types.set("log_i", {
  $: "FunctionType",
  params: [primitives.int32Type],
  returnType: primitives.voidType
});
utilModule.types.set("log_f", {
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.voidType
});
utilModule.types.set("log_b", {
  $: "FunctionType",
  params: [primitives.boolType],
  returnType: primitives.voidType
});
utilModule.types.set("log_s", {
  $: "FunctionType",
  params: [primitives.int32Type], // TODO: this should be string type for type checking
  returnType: primitives.voidType
});
