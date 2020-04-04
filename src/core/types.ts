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
export type StructType = {
  $: "StructType";
  types: { name: string; type: FieldType }[];
};
export type StructTypeWithOffset = {
  $: "StructTypeWithOffset";
  types: { name: string; type: FieldType; init: Expression | null }[];
  byteOffset: number;
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
export type VariableType =
  | Int32Type
  | Float32Type
  | BoolType
  | StringType
  | StructType
  | StructTypeWithOffset
  | ArrayType;
export type ParamType = Int32Type | Float32Type | BoolType | StringType;
export type FieldType = Int32Type | Float32Type | BoolType;
export type ItemType = Int32Type | Float32Type | BoolType;
export type LocalType = Int32Type | Float32Type | BoolType;
export type ReturnType =
  | Int32Type
  | Float32Type
  | BoolType
  | StringType
  | VoidType;
export type AssignableType = Int32Type | Float32Type | BoolType | StringType;
export type GlobalDeclarableType =
  | Int32Type
  | Float32Type
  | VoidType
  | BoolType;
export type LocalDeclarableType = VariableType;
export type DeclaredType = VariableType | FunctionType;
export type ExpressionType =
  | Int32Type
  | Float32Type
  | BoolType
  | StringType
  | VoidType
  | StructType
  | ArrayType
  | FunctionType;
export type AnyType =
  | Int32Type
  | Float32Type
  | VoidType
  | BoolType
  | StringType
  | StructType
  | ArrayType
  | FunctionType;
export type ExportableType = FunctionType | NumberConst;
export type NumberConst = Int32Const | Float32Const | BoolConst;
export type Int32Const = {
  $: "Int32Const";
  value: number;
};
export type Float32Const = {
  $: "Float32Const";
  value: number;
};
export type BoolConst = {
  $: "BoolConst";
  value: number; // 0 | 1
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
export function sizeOf(
  t: Int32Type | Float32Type | BoolType | StructType
): number {
  if (t.$ === "Int32Type") {
    return 4;
  } else if (t.$ === "Float32Type") {
    return 4;
  } else if (t.$ === "BoolType") {
    return 4;
  } else if (t.$ === "StructType") {
    let size = 0;
    for (const type of t.types) {
      size += sizeOf(type.type);
    }
    return size;
  }
  throw new Error("unreachable");
}
export function defaultValueOf(
  t: Int32Type | Float32Type | BoolType
): NumberConst {
  if (t.$ === "Int32Type") {
    return { $: "Int32Const", value: 0 };
  } else if (t.$ === "Float32Type") {
    return { $: "Float32Const", value: 0 };
  } else if (t.$ === "BoolType") {
    return { $: "BoolConst", value: 0 };
  }
  throw new Error("unreachable");
}
export function isTypeEqual<T extends AnyType>(a: AnyType, b: AnyType): b is T {
  if (a === b) {
    return true;
  }
  if (a.$ === "Int32Type" && b.$ === "Int32Type") {
    return true;
  }
  if (a.$ === "Float32Type" && b.$ === "Float32Type") {
    return true;
  }
  if (a.$ === "StringType" && b.$ === "StringType") {
    return true;
  }
  if (a.$ === "VoidType" && b.$ === "VoidType") {
    return true;
  }
  if (a.$ === "BoolType" && b.$ === "BoolType") {
    return true;
  }
  if (a.$ === "StructType" && b.$ === "StructType") {
    if (a.types.length !== b.types.length) {
      return false;
    }
    for (let i = 0; i < a.types.length; i++) {
      if (!isTypeEqual(a.types[i].type, b.types[i].type)) {
        return false;
      }
    }
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
  if (a.$ === "StructType") {
    return `{ ${a.types.map(({ type }) => typeToString(type)).join(", ")} }`;
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
export function paramOptionsType(
  type: "Int32Type" | "Float32Type"
): StructType {
  return {
    $: "StructType",
    types: [
      { name: "defaultValue", type: { $: type } },
      { name: "minValue", type: { $: type } },
      { name: "maxValue", type: { $: type } },
    ],
  };
}
export function paramType(type: "Int32Type" | "Float32Type"): StructType {
  return {
    $: "StructType",
    types: [
      { name: "name", type: { $: "Int32Type" } }, // pointer to string
      { name: "defaultValue", type: { $: type } },
      { name: "minValue", type: { $: type } },
      { name: "maxValue", type: { $: type } },
      { name: "automationRate", type: { $: "Int32Type" } }, // pointer to "a-rate" | "k-rate"
    ],
  };
}

// --------------------
//  Expressions
// --------------------
export type AssignableExpression = LocalGet | GlobalGet;
export type Expression =
  | NumberConst
  | BoolConst
  | LocalGet
  | GlobalGet
  | FunctionGet
  | StructTypeWithOffset
  | ArrayGet
  | ItemGet
  | StringGet
  | Call
  | BinOp
  | CompOp
  | CondOp;
// Other Expressions
export type LocalGet = {
  $: "LocalGet";
  index: number;
  type: Int32Type | Float32Type | BoolType;
};
export type GlobalGet = {
  $: "GlobalGet";
  name: string;
  type: Int32Type | Float32Type | BoolType;
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
export type ItemGet = {
  $: "ItemGet";
  pointer: ArrayItemPointer;
};
export type StringGet = {
  $: "StringGet";
  relativeByteOffset: number;
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
export type LocalStatement = Assign | Call | Loop | Return;
export type GlobalVariableDeclaration = {
  $: "GlobalVariableDeclaration";
  type: VariableType;
  name: string;
  mutable: boolean;
  init: NumberConst;
  export: boolean;
};
export type FunctionDeclaration = {
  $: "FunctionDeclaration";
  name: string;
  params: ParamType[];
  returnType: ReturnType;
  localTypes: LocalType[];
  statements: LocalStatement[];
  export: boolean;
};
export type Assign = LocalSet | GlobalSet | ItemSet;
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
export type StructFieldPointer = {
  byteOffset: number;
  fieldOffset: number;
  fieldType: FieldType;
};
export type FieldSet = {
  $: "FieldSet";
  pointer: StructFieldPointer;
  value: Expression;
};
export type ArrayItemPointer = {
  byteOffset: number;
  itemType: ItemType;
  name: string;
  index: Expression;
};
export type ItemSet = {
  $: "ItemSet";
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
