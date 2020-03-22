export interface Position {
  row: number;
  column: number;
}
export interface Range {
  start: Position;
  end: Position;
}
export interface SourceInfo {
  range: Range;
}

// --------------------
//  Module
// --------------------
export type Module = {
  $: "Module";
  imports: Import[];
  statements: Statement[];
};

// --------------------
//  Import
// --------------------
export type Import = NameImport | FileImport;
export type NameImport = {
  $: "NameImport";
  name: string;
};
export type FileImport = {
  $: "FileImport";
  path: string;
};

// --------------------
//  Statements
// --------------------
export type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | Assign
  | Expression
  | Loop
  | Increment
  | Return
  | Comment;
export type VariableDeclaration = SourceInfo & {
  $: "VariableDeclaration";
  type: Type;
  left: Identifier;
  right: Expression;
  hasMutableFlag: boolean;
};
export type Param = SourceInfo & {
  $: "Param";
  type: Type;
  name: string;
};
export type ParamList = SourceInfo & {
  $: "ParamList";
  items: Param[];
};
export type FunctionDeclaration = SourceInfo & {
  $: "FunctionDeclaration";
  name: Identifier;
  params: ParamList;
  returnType: Type;
  statements: Statement[];
};
export type Assign = SourceInfo & {
  $: "Assign";
  left: Expression;
  right: Expression;
};
export type Increment = SourceInfo & {
  $: "Increment";
  left: Expression;
};
export type Loop = SourceInfo & {
  $: "Loop";
  statements: Statement[];
};
export type Return = SourceInfo & {
  $: "Return";
  value: Expression | null;
};
export type Comment = SourceInfo & {
  $: "Comment";
  value: string;
};

// --------------------
//  Expressions
// --------------------
export type Expression =
  | IntLiteral
  | FloatLiteral
  | StringLiteral
  | ArrayLiteral
  | Identifier
  | ArrayAccess
  | FunctionCall
  | BinOp
  | CondOp;
// Literals
export type IntLiteral = SourceInfo & {
  $: "IntLiteral";
  value: number;
};
export type FloatLiteral = SourceInfo & {
  $: "FloatLiteral";
  value: number;
};
export type StringLiteral = SourceInfo & {
  $: "StringLiteral";
  value: string;
};
export type ArrayLiteral = SourceInfo & {
  $: "ArrayLiteral";
  items: Expression[];
};
// Other Expressions
export type Identifier = SourceInfo & {
  $: "Identifier";
  name: string;
};
export type ArrayAccess = SourceInfo & {
  $: "ArrayAccess";
  array: Expression;
  index: Expression;
};
export type FunctionCall = SourceInfo & {
  $: "FunctionCall";
  func: Expression;
  args: Expression[];
};
export type BinOp = SourceInfo & {
  $: "BinOp";
  operator: BinOpKind;
  left: Expression;
  right: Expression;
};
export type CondOp = SourceInfo & {
  $: "CondOp";
  condition: Expression;
  ifTrue: Expression;
  ifFalse: Expression;
};

// --------------------
//  Types
// --------------------
export type AddOpKind = "+" | "-";
export type MulOpKind = "*" | "/" | "%";
export type CompOpKind = "<" | "<=" | ">" | ">=";
export type BinOpKind = AddOpKind | MulOpKind | CompOpKind;
export type Type = PrimitiveType | ArrayType;
export type PrimitiveTypeName = "int" | "float" | "void" | "bool";
export type PrimitiveType = SourceInfo & {
  $: "PrimitiveType";
  name: PrimitiveTypeName;
};
export type ArrayType = SourceInfo & {
  $: "ArrayType";
  type: PrimitiveType;
};
