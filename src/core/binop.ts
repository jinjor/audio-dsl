import {
  Int32Type,
  Float32Type,
  BoolType,
  ConstantType,
  Expression,
  BinOp,
  AnyType,
  primitives,
  makeConstant,
  BinOpKind,
} from "./types";
import * as ast from "./ast";

type BinOpLeftType = Int32Type | Float32Type | BoolType;
type BinOpRightType = Int32Type | Float32Type | BoolType;
type BinOpReturnType = Int32Type | Float32Type | BoolType;
type FoundBinOp = {
  kind: BinOpKind;
  returnType: BinOpReturnType;
};
const map = new Map<string, FoundBinOp>();
const kindToEval = new Map<
  string,
  (left: ConstantType, right: ConstantType) => ConstantType
>();
export function isBinOp(exp: Expression): exp is BinOp {
  return kindToEval.has(exp.$);
}
export function evaluate(
  kind: BinOpKind,
  left: ConstantType,
  right: ConstantType
): ConstantType {
  return kindToEval.get(kind)!(left, right);
}
function makeKey(
  astKind: ast.BinOpKind,
  leftTypeKind: string,
  rightTypeKind: string
) {
  return `${leftTypeKind}${astKind}${rightTypeKind}`;
}
function set(
  astKind: ast.BinOpKind,
  kind: BinOpKind,
  leftType: BinOpLeftType,
  rightType: BinOpRightType,
  returnType: BinOpReturnType,
  evaluate: (left: ConstantType, right: ConstantType) => number
): void {
  map.set(makeKey(astKind, leftType.$, rightType.$), {
    kind,
    returnType,
  });
  kindToEval.set(kind, (left: ConstantType, right: ConstantType) =>
    makeConstant(returnType, evaluate(left, right))
  );
}
export function get(
  kind: ast.BinOpKind,
  leftType: AnyType,
  rightType: AnyType
): FoundBinOp | null {
  return map.get(makeKey(kind, leftType.$, rightType.$)) ?? null;
}
set(
  "+",
  "Int32AddOp",
  primitives.int32Type,
  primitives.int32Type,
  primitives.int32Type,
  (l: ConstantType, r: ConstantType) => l.value + r.value
);
set(
  "+",
  "Float32AddOp",
  primitives.float32Type,
  primitives.float32Type,
  primitives.float32Type,
  (l: ConstantType, r: ConstantType) => l.value + r.value
);
set(
  "-",
  "Int32SubOp",
  primitives.int32Type,
  primitives.int32Type,
  primitives.int32Type,
  (l: ConstantType, r: ConstantType) => l.value - r.value
);
set(
  "-",
  "Float32SubOp",
  primitives.float32Type,
  primitives.float32Type,
  primitives.float32Type,
  (l: ConstantType, r: ConstantType) => l.value - r.value
);
set(
  "*",
  "Int32MulOp",
  primitives.int32Type,
  primitives.int32Type,
  primitives.int32Type,
  (l: ConstantType, r: ConstantType) => l.value * r.value
);
set(
  "*",
  "Float32MulOp",
  primitives.float32Type,
  primitives.float32Type,
  primitives.float32Type,
  (l: ConstantType, r: ConstantType) => l.value * r.value
);
set(
  "/",
  "Float32DivOp",
  primitives.float32Type,
  primitives.float32Type,
  primitives.float32Type,
  (l: ConstantType, r: ConstantType) => l.value / r.value
);
set(
  "%",
  "Int32RemOp",
  primitives.int32Type,
  primitives.int32Type,
  primitives.int32Type,
  (l: ConstantType, r: ConstantType) => l.value % r.value
);
set(
  "<",
  "Int32LT",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value < r.value ? 1 : 0)
);
set(
  "<",
  "Float32LT",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value < r.value ? 1 : 0)
);
set(
  "<=",
  "Int32LE",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value <= r.value ? 1 : 0)
);
set(
  "<=",
  "Float32LE",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value <= r.value ? 1 : 0)
);
set(
  ">",
  "Int32GT",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value > r.value ? 1 : 0)
);
set(
  ">",
  "Float32GT",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value > r.value ? 1 : 0)
);
set(
  ">=",
  "Int32GE",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value >= r.value ? 1 : 0)
);
set(
  ">=",
  "Float32GE",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value >= r.value ? 1 : 0)
);
set(
  "==",
  "Int32EQ",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value === r.value ? 1 : 0)
);
set(
  "==",
  "Float32EQ",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value === r.value ? 1 : 0)
);
set(
  "!=",
  "Int32NE",
  primitives.int32Type,
  primitives.int32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value !== r.value ? 1 : 0)
);
set(
  "!=",
  "Float32NE",
  primitives.float32Type,
  primitives.float32Type,
  primitives.boolType,
  (l: ConstantType, r: ConstantType) => (l.value !== r.value ? 1 : 0)
);
