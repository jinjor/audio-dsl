import { FunctionType, primitives, ConstantType, ModuleHeader } from "./types";

export const builtInModule: ModuleHeader = {
  types: new Map<string, FunctionType | ConstantType>(),
};
builtInModule.types.set("to_float", {
  range: null,
  $: "FunctionType",
  params: [primitives.int32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "IntToFloat",
});
builtInModule.types.set("to_int", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.int32Type,
  builtinFunctionKind: "FloatToInt",
});
builtInModule.types.set("abs", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Abs",
});
builtInModule.types.set("neg", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Neg",
});
builtInModule.types.set("ceil", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Ceil",
});
builtInModule.types.set("floor", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Floor",
});
builtInModule.types.set("trunc", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Trunc",
});
builtInModule.types.set("nearest", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Nearest",
});
builtInModule.types.set("sqrt", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Sqrt",
});
builtInModule.types.set("min", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type, primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Min",
});
builtInModule.types.set("max", {
  range: null,
  $: "FunctionType",
  params: [primitives.float32Type, primitives.float32Type],
  returnType: primitives.float32Type,
  builtinFunctionKind: "F32Max",
});
