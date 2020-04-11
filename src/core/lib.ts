import { FunctionType, primitives, ConstantType, ModuleHeader } from "./types";

export const mathModule: ModuleHeader = {
  types: new Map<string, FunctionType | ConstantType>(),
};
mathModule.types.set("sin", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: null,
});
mathModule.types.set("pow", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type, primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: null,
});
mathModule.types.set("PI", { $: "Float32Const", value: Math.PI });

export const utilModule = {
  types: new Map<string, FunctionType>(),
};
utilModule.types.set("log_i", {
  range: null,
  $: "FunctionType",
  params: [primitives.int32Type],
  returnType: primitives.voidType,
  builtinFunctionKind: null,
});
utilModule.types.set("log_f", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.voidType,
  builtinFunctionKind: null,
});
utilModule.types.set("log_b", {
  range: null,
  $: "FunctionType",
  params: [primitives.boolType],
  returnType: primitives.voidType,
  builtinFunctionKind: null,
});
utilModule.types.set("log_s", {
  range: null,
  $: "FunctionType",
  params: [primitives.stringType],
  returnType: primitives.voidType,
  builtinFunctionKind: null,
});
