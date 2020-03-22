// --------------------
//  Basic
// --------------------
export type Int32Type = {
  $: "Int32Type";
};
export type Float32Type = {
  $: "Float32Type";
};
export type VoidType = {
  $: "VoidType";
};
export type BoolType = {
  $: "BoolType";
};
export type StringType = {
  $: "StringType";
};
export type ArrayType = {
  $: "ArrayType";
  itemType: ItemType;
  numberOfItems: number;
  byteOffset: number;
};
export type FunctionType = {
  $: "FunctionType";
  params: ParamType[];
  returnType: ReturnType;
};
export type ValueType = Int32Type | Float32Type | BoolType;
export type VariableType = ValueType | StringType | ArrayType;
export type ParamType = ValueType;
export type ItemType = ValueType;
export type ReturnType = ValueType | VoidType;
export type AssignableType = Int32Type | Float32Type | BoolType;
export type GlobalDeclarableType =
  | Int32Type
  | Float32Type
  | VoidType
  | BoolType;
export type LocalDeclarableType = VariableType;
export type DeclaredType = VariableType | FunctionType;
export type ExpressionType =
  | ValueType
  | VoidType
  | StringType
  | ArrayType
  | FunctionType;
export type AnyType =
  | Int32Type
  | Float32Type
  | VoidType
  | BoolType
  | StringType
  | ArrayType
  | FunctionType;
export type ExportableType = FunctionType | NumberConst;
export type NumberConst = Int32Const | Float32Const;
export type Int32Const = {
  $: "Int32Const";
  value: number;
};
export type Float32Const = {
  $: "Float32Const";
  value: number;
};
export type ModuleHeader = {
  types: Map<string, FunctionType | NumberConst>;
};
// --------------------
//  Util
// --------------------
export namespace primitives {
  export const int32Type: Int32Type = { $: "Int32Type" };
  export const float32Type: Float32Type = { $: "Float32Type" };
  export const voidType: VoidType = { $: "VoidType" };
  export const boolType: BoolType = { $: "BoolType" };
  export const stringType: StringType = { $: "StringType" };
}
export function sizeOf(t: Int32Type | Float32Type | BoolType): number {
  if (t.$ === "Int32Type") {
    return 4;
  } else if (t.$ === "Float32Type") {
    return 4;
  } else if (t.$ === "BoolType") {
    return 4;
  }
  throw new Error("unreachable");
}
export function isTypeEqual(a: AnyType, b: AnyType): boolean {
  if (a === b) {
    return true;
  }
  if (a.$ === "Int32Type" && b.$ === "Int32Type") {
    return true;
  }
  if (a.$ === "Float32Type" && b.$ === "Float32Type") {
    return true;
  }
  if (a.$ === "VoidType" && b.$ === "VoidType") {
    return true;
  }
  if (a.$ === "BoolType" && b.$ === "BoolType") {
    return true;
  }
  if (a.$ === "StringType" && b.$ === "StringType") {
    return true;
  }
  if (a.$ === "ArrayType" && b.$ === "ArrayType") {
    return isTypeEqual(a.itemType, b.itemType);
  }
  if (a.$ === "FunctionType" && b.$ === "FunctionType") {
    if (!isTypeEqual(a.returnType, b.returnType)) {
      return false;
    }
    if (a.params.length !== b.params.length) {
      return false;
    }
    for (let i = 0; i < a.params.length; i++) {
      if (!isTypeEqual(a.params[i], b.params[i])) {
        return false;
      }
    }
    return true;
  }
  return false;
}
export function typeToString(a: AnyType): string {
  if (a.$ === "Int32Type") {
    return "int";
  }
  if (a.$ === "Float32Type") {
    return "float";
  }
  if (a.$ === "VoidType") {
    return "void";
  }
  if (a.$ === "BoolType") {
    return "bool";
  }
  if (a.$ === "StringType") {
    return "string";
  }
  if (a.$ === "ArrayType") {
    return `array<${typeToString(a.itemType)}>`;
  }
  if (a.$ === "FunctionType") {
    const params = a.params.map(typeToString).join(", ");
    return `(${params}) => ${typeToString(a.returnType)}`;
  }
  throw new Error("unreachable");
}
// --------------------
//  Expressions
// --------------------
export type AssignableExpression = LocalGet | GlobalGet;
export type FoundExp =
  | LocalGet
  | GlobalGet
  | FunctionGet
  | ArrayGet
  | NumberConst;
export type Expression =
  | NumberConst
  | LocalGet
  | GlobalGet
  | FunctionGet
  | ArrayGet
  | ArrayAccess
  | Call
  | BinOp
  | CompOp
  | CondOp;
// Other Expressions
export type LocalGet = {
  $: "LocalGet";
  index: number;
  type: Int32Type | Float32Type;
};
export type GlobalGet = {
  $: "GlobalGet";
  name: string;
  type: Int32Type | Float32Type;
};
export type FunctionGet = {
  $: "FunctionGet";
  name: string;
};
export type ArrayGet = {
  $: "ArrayGet";
  name: string;
  byteOffset: number;
  itemType: ItemType;
};
export type ArrayAccess = {
  $: "ArrayAccess";
  byteOffset: number;
  itemType: ItemType;
  name: string;
  index: Expression;
};
export type FunctionCall = {
  $: "FunctionCall";
  target: FunctionGet;
  args: Expression[];
  // params: ParamType[];
  returnType: ReturnType;
};
export type BuiltInCall = IntToFloatCast | FloatToIntCast;
export type Call = FunctionCall | BuiltInCall;
export type IntToFloatCast = {
  $: "IntToFloatCast";
  arg: Expression;
};
export type FloatToIntCast = {
  $: "FloatToIntCast";
  arg: Expression;
};
export type Int32CompOpKind = "Int32LT" | "Int32LE" | "Int32GT" | "Int32GE";
export type Float32CompOpKind =
  | "Float32LT"
  | "Float32LE"
  | "Float32GT"
  | "Float32GE";
export type Int32BinOpKind =
  | "Int32AddOp"
  | "Int32SubOp"
  | "Int32MulOp"
  | "Int32RemOp"
  | Int32CompOpKind;
export type Float32BinOpKind =
  | "Float32AddOp"
  | "Float32SubOp"
  | "Float32MulOp"
  | "Float32DivOp"
  | Float32CompOpKind;
export type BinOpKind = Int32BinOpKind | Float32BinOpKind;
export type BinOp = {
  $: BinOpKind;
  left: Expression;
  right: Expression;
};
export type CompOpKind = Int32CompOpKind | Float32CompOpKind;
export type CompOp = {
  $: CompOpKind;
  left: Expression;
  right: Expression;
};
export type CondOp = {
  $: "CondOp";
  condition: Expression;
  ifTrue: Expression;
  ifFalse: Expression;
};
// --------------------
//  Import
// --------------------
export type Import = FunctionImport;
export type FunctionImport = {
  $: "FunctionImport";
  moduleName: string;
  functionName: string;
  type: FunctionType;
};
// --------------------
//  Statements
// --------------------
export type GlobalStatement = GlobalSet;
export type LocalStatement = Assign | Call | Loop | Return;
export type GlobalVariableDeclaration = {
  $: "GlobalVariableDeclaration";
  type: VariableType;
  name: string;
  mutable: boolean;
  init: NumberConst;
  export: boolean;
};
// TODO: should declare even if right expression is broken
export type FunctionDeclaration = {
  $: "FunctionDeclaration";
  name: string;
  // params: ParamType[];
  params: (Int32Type | Float32Type)[];
  returnType: ReturnType;
  // localTypes: DeclaredType[];
  localTypes: (Int32Type | Float32Type | VoidType)[];
  statements: LocalStatement[];
  export: boolean;
};
export type ArrayDeclaration = {
  $: "ArrayDeclaration";
  name: string;
  // itemType: Int32Type | Float32Type;
  // numberOfItems: number;
  offset: number;
  export: boolean;
};
export type Assign = LocalSet | GlobalSet | ArraySet;
export type GetForAssign = LocalGet | GlobalGet;
export type LocalSet = {
  $: "LocalSet";
  index: number;
  value: Expression;
};
export type GlobalSet = {
  $: "GlobalSet";
  name: string;
  value: Expression;
};
export type ArrayItemPointer = {
  byteOffset: number;
  itemType: ItemType;
  name: string;
  index: Expression;
};
export type ArraySet = {
  $: "ArraySet";
  pointer: ArrayItemPointer;
  value: Expression;
};
export type Loop = {
  $: "Loop";
  init: LocalStatement[];
  body: LocalStatement[];
  continueIf: CompOp;
};
export type Return = {
  $: "Return";
  value: Expression | null;
};
