import {
  FunctionType,
  primitives,
  ConstantType,
  ModuleHeader,
  BuiltinFunctionKind,
  ParamType,
  makeConstant,
  Float32Type,
  Int32Type,
} from "./types";

export const builtInModule: ModuleHeader = {
  types: new Map<string, FunctionType | ConstantType>(),
};
const kindToEval = new Map<string, (args: ConstantType[]) => ConstantType>();

export function isBuiltinFunctionKind(
  $: BuiltinFunctionKind
): $ is BuiltinFunctionKind {
  return kindToEval.has($);
}
export function evaluate(
  kind: BuiltinFunctionKind,
  args: ConstantType[]
): ConstantType {
  return kindToEval.get(kind)!(args);
}
function set(
  name: string,
  builtinFunctionKind: BuiltinFunctionKind,
  params: ParamType[],
  returnType: Int32Type | Float32Type,
  evaluate: (args: ConstantType[]) => number
): void {
  builtInModule.types.set(name, {
    range: null,
    $: "FunctionType",
    params,
    returnType,
    builtinFunctionKind,
  });
  kindToEval.set(builtinFunctionKind, (args: ConstantType[]) =>
    makeConstant(returnType, evaluate(args))
  );
}
set(
  "to_float",
  "IntToFloat",
  [primitives.int32Type],
  primitives.float32Type,
  ([a]) => a.value
);
set(
  "to_int",
  "FloatToInt",
  [primitives.float32Type],
  primitives.int32Type,
  ([a]) => a.value
);
set("abs", "F32Abs", [primitives.float32Type], primitives.float32Type, ([a]) =>
  Math.abs(a.value)
);
set(
  "neg",
  "F32Neg",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => -a.value
);
set(
  "ceil",
  "F32Ceil",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => Math.ceil(a.value)
);
set(
  "floor",
  "F32Floor",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => Math.floor(a.value)
);
set(
  "trunc",
  "F32Trunc",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => Math.trunc(a.value)
);
set(
  "nearest",
  "F32Nearest",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => Math.round(a.value)
);
set(
  "sqrt",
  "F32Sqrt",
  [primitives.float32Type],
  primitives.float32Type,
  ([a]) => Math.sqrt(a.value)
);
set(
  "min",
  "F32Min",
  [primitives.float32Type, primitives.float32Type],
  primitives.float32Type,
  ([a, b]) => Math.min(a.value, b.value)
);
set(
  "max",
  "F32Max",
  [primitives.float32Type, primitives.float32Type],
  primitives.float32Type,
  ([a, b]) => Math.max(a.value, b.value)
);
