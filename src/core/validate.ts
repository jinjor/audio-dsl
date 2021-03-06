import * as ast from "./ast";
import {
  ParamType,
  ReturnType,
  DeclaredType,
  VoidType,
  Int32Type,
  Float32Type,
  ExpressionType,
  ConstantType,
  primitives,
  isTypeEqual,
  AssignableType,
  ItemType,
  FunctionType,
  ArrayType,
  BoolType,
  BinOpKind,
  CondOp,
  Expression,
  Call,
  BinOp,
  ItemGet,
  LocalGet,
  GlobalGet,
  Assign,
  LocalStatement,
  FunctionDeclaration,
  GlobalVariableDeclaration,
  Import,
  sizeOf,
  FunctionGet,
  ArrayGet,
  AnyType,
  defaultValueOf,
  StringGet,
  LocalType,
  StructTypeWithOffset,
  paramOptionsType,
  paramInfoType,
  StructType,
  FieldType,
  StringType,
  isConstantType,
  typeOfConstant,
  makeConstant,
  makeAssign,
  assertNever,
} from "./types";
import { ModuleCache } from "./loader";
import {
  ValidationErrorType,
  ImportModuleNotFound,
  AlreadyDeclared,
  VoidShouldNotBeDeclaredAsAVariable,
  FunctionShouldNotBeCalledAtGlobalScope,
  LoopShouldNotBePlacedAtGlobalScope,
  ReturnShouldNotBePlacedAtGlobalScope,
  FunctionShouldBeDeclaredInGlobal,
  DeclareTypeMismatch,
  ReturnTypeMismatch,
  AssignTypeMismatch,
  FunctionShouldReturnValue,
  NotFound,
  IndexShouldBeAnInteger,
  IndexAccessToNonArray,
  VoidShouldNotBeUsedAsAVariable,
  InvalidTypeCombinationForBinOp,
  ShouldNotCallNonFunctionType,
  ArgTypeMismatch,
  ExtraArgument,
  TooFewArguments,
  BranchesShouldReturnTheSameType,
  ConditionShouldBeBool,
  AssigningToConstantValueIsNotAllowed,
  NonAssignableType,
  AssigningInGlobalIsNotAllowed,
  ReturningNonPrimitiveTypesIsNotSupported,
  ReceivingNonPrimitiveTypesIsNotSupported,
  DeclaringArrayInLocalIsNotSupported,
  AssigningFunctionIsNotSupported,
  AssigningArrayIsNotSupported,
  CallingArbitraryExpressionIsNotSupported,
  TheLeftHandExpressionMustBeAnIdentifier,
  ArrayLiteralIsNotSupported,
  GettingArrayInGlobalIsNotSupported,
  ReferringMutableValueInGlobalIsNotAllowed,
  CallingNonBuiltInFunctionInGlobalIsNotSupported,
  VoidCannotBeAnArrayItem,
  DeclaringArrayWithInitialValueNotSupported,
  DeclaringMutableArraysIsNotAllowed,
  ParametersShouldBeDeclaredInGlobal,
  ParametersShouldBeFloatOrArrayOfFloat,
  UnknownField,
  MissingFields,
  AssigningStructIsNotSupported,
  InvlaidAssignTarget,
  AmbiguousName,
} from "./errors";
import { DataBuilder, StringBuilder } from "./data-builder";
import * as builtin from "./builtin";
import * as binop from "./binop";

// Scopes
type FoundExp =
  | LocalGet
  | GlobalGet
  | FunctionGet
  | ArrayGet
  | StructTypeWithOffset
  | ConstantType
  | ItemGet;
type LookupResult =
  | [FoundExp, ExpressionType]
  | { $: "Ambiguous"; modules: string[] }
  | null;
interface Scope {
  declareType(name: string, type: DeclaredType): void;
  isDeclaredInThisScope(name: string): boolean;
  lookupType(name: string): LookupResult;
}
interface LocalScope extends Scope {
  createBlockScope(): BlockScope;
  declareType(name: string, type: Int32Type | Float32Type | BoolType): void;
  isDeclaredInThisScope(name: string): boolean;
  addLocalType(type: Int32Type | Float32Type | BoolType): number;
  coverReturn(): void;
  lookupType(name: string): LookupResult;
  lookupLocalTypeByIndex(
    index: number
  ): Int32Type | Float32Type | BoolType | null;
  lookupReturnType(): ReturnType | null;
}
class GlobalScope implements Scope {
  byteOffset = 0;
  private declaredTypesOrStaticValue = new Map<
    string,
    | Int32Type
    | Float32Type
    | BoolType
    | StringType
    | StructTypeWithOffset
    | ArrayType
    | FunctionType
    | ConstantType
    | ItemGet
  >();
  private importNameMap = new Map<string, string[]>();
  constructor() {}
  createFunctionScope() {
    return new FunctionScope(this);
  }
  addImportName(name: string, moduleName: string): string {
    const internalName = `${moduleName}.${name}`;
    if (!this.importNameMap.has(name)) {
      this.importNameMap.set(name, []);
    }
    this.importNameMap.get(name)!.push(moduleName);
    return internalName;
  }
  isDeclaredInThisScope(name: string): boolean {
    return this.declaredTypesOrStaticValue.has(name);
  }
  declareConst(name: string, value: ConstantType): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already declared in this scope");
    }
    this.declaredTypesOrStaticValue.set(name, value);
  }
  declareType(
    name: string,
    type:
      | Int32Type
      | Float32Type
      | BoolType
      | StringType
      | StructTypeWithOffset
      | ArrayType
      | FunctionType
  ): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already declared in this scope");
    }
    this.declaredTypesOrStaticValue.set(name, type);
  }
  declareItemGet(name: string, type: ItemGet): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already declared in this scope");
    }
    this.declaredTypesOrStaticValue.set(name, type);
  }
  getAllStructs(): [string, StructTypeWithOffset][] {
    const arrays: [string, StructTypeWithOffset][] = [];
    for (const [name, type] of this.declaredTypesOrStaticValue) {
      if (type.$ === "StructTypeWithOffset") {
        arrays.push([name, type]);
      }
    }
    return arrays;
  }
  declareArray(
    name: string,
    itemType: ItemType,
    numberOfItems: number
  ): number {
    const byteOffset = this.byteOffset;
    this.declareType(name, {
      $: "ArrayType",
      itemType,
      numberOfItems,
      byteOffset,
    });
    this.byteOffset += sizeOf(itemType) * numberOfItems;
    return byteOffset;
  }
  getAllArrays(): [string, ArrayType][] {
    const arrays: [string, ArrayType][] = [];
    for (const [name, type] of this.declaredTypesOrStaticValue) {
      if (type.$ === "ArrayType") {
        arrays.push([name, type]);
      }
    }
    return arrays;
  }
  lookupType(name: string): LookupResult {
    const typeOrStaticValue = this.declaredTypesOrStaticValue.get(name);
    if (typeOrStaticValue == null) {
      const modules = this.importNameMap.get(name);
      if (modules == null) {
        return null;
      }
      if (modules.length === 1) {
        const moduleName = modules[0];
        const internalName = `${moduleName}.${name}`;
        return this.lookupType(internalName);
      }
      return {
        $: "Ambiguous",
        modules,
      };
    }
    if (isConstantType(typeOrStaticValue)) {
      return [typeOrStaticValue, typeOfConstant(typeOrStaticValue)];
    }
    if (
      typeOrStaticValue.$ === "Int32Type" ||
      typeOrStaticValue.$ === "Float32Type" ||
      typeOrStaticValue.$ === "BoolType"
    ) {
      return [
        { $: "GlobalGet", name, type: typeOrStaticValue },
        typeOrStaticValue,
      ];
    }
    if (typeOrStaticValue.$ === "FunctionType") {
      return [
        { range: typeOrStaticValue.range, $: "FunctionGet", name },
        typeOrStaticValue,
      ];
    }
    if (typeOrStaticValue.$ === "StructTypeWithOffset") {
      return [
        typeOrStaticValue,
        {
          $: "StructType",
          types: typeOrStaticValue.types,
        },
      ];
    }
    if (typeOrStaticValue.$ === "ArrayType") {
      return [
        {
          $: "ArrayGet",
          name,
          byteOffset: typeOrStaticValue.byteOffset,
          itemType: typeOrStaticValue.itemType,
        },
        typeOrStaticValue,
      ];
    }
    if (typeOrStaticValue.$ === "ItemGet") {
      return [typeOrStaticValue, typeOrStaticValue.pointer.itemType];
    }
    throw new Error("unreachable");
  }
}

class FunctionScope implements LocalScope {
  private declaredTypes = new Map<string, number>();
  private localTypes: LocalType[] = [];
  private returnType: ReturnType | null = null;
  private returned: boolean = false;
  constructor(private parent: GlobalScope) {}
  setReturnType(returnType: ReturnType) {
    if (this.returnType != null) {
      throw new Error("return type is already declared");
    }
    this.returnType = returnType;
  }
  resolveReturn() {
    this.returned = true;
  }
  coverReturn() {
    this.resolveReturn();
  }
  isReturnCovered(): boolean {
    return this.returned;
  }
  createBlockScope(): BlockScope {
    return new BlockScope(this);
  }
  declareType(name: string, type: Int32Type | Float32Type | BoolType): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already defined in this scope");
    }
    const index = this.addLocalType(type);
    this.declaredTypes.set(name, index);
  }
  addLocalType(type: Int32Type | Float32Type | BoolType): number {
    const index = this.localTypes.length;
    this.localTypes[index] = type;
    return index;
  }
  isDeclaredInThisScope(name: string): boolean {
    return this.declaredTypes.has(name);
  }
  getLocalTypes(): (Int32Type | Float32Type | BoolType)[] {
    return this.localTypes;
  }
  lookupType(name: string): LookupResult {
    if (this.declaredTypes.has(name)) {
      const index = this.declaredTypes.get(name)!;
      const type = this.localTypes[index];
      return [{ $: "LocalGet", index, type }, type];
    }
    return this.parent.lookupType(name);
  }
  lookupLocalTypeByIndex(
    index: number
  ): Int32Type | Float32Type | BoolType | null {
    return this.localTypes[index];
  }
  lookupReturnType(): ReturnType | null {
    return this.returnType;
  }
}

class BlockScope implements LocalScope {
  private declaredTypes = new Map<string, number>();
  constructor(private parent: LocalScope) {}
  createBlockScope(): BlockScope {
    return new BlockScope(this);
  }
  declareType(name: string, type: Int32Type | Float32Type): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already defined in this scope");
    }
    const index = this.parent.addLocalType(type);
    this.declaredTypes.set(name, index);
    this.lookupLocalTypeByIndex(index);
  }
  coverReturn() {
    // currently, returning in block scope does not affect return coverage
  }
  isDeclaredInThisScope(name: string): boolean {
    return this.declaredTypes.has(name);
  }
  lookupType(name: string): LookupResult {
    if (this.declaredTypes.has(name)) {
      const index = this.declaredTypes.get(name)!;
      const type = this.lookupLocalTypeByIndex(index);
      if (type == null) {
        return null;
      }
      return [{ $: "LocalGet", index, type }, type];
    }
    return this.parent.lookupType(name);
  }
  addLocalType(type: Int32Type | Float32Type): number {
    return this.parent.addLocalType(type);
  }
  lookupLocalTypeByIndex(
    index: number
  ): Int32Type | Float32Type | BoolType | null {
    return this.parent.lookupLocalTypeByIndex(index);
  }
  lookupReturnType(): ReturnType | null {
    return this.parent.lookupReturnType();
  }
}

type GlobalState = {
  numSamples: number;
  moduleCache: ModuleCache;
  imports: Import[];
  globalVariableDeclarations: GlobalVariableDeclaration[];
  functionDeclarations: FunctionDeclaration[];
  paramInfo: { structType: StructType; fieldValues: number[] }[];
  dataBuilder: DataBuilder;
  strings: StringBuilder;
  errors: ValidationErrorType[];
};
type State = Pick<
  GlobalState,
  "numSamples" | "dataBuilder" | "strings" | "errors"
>;
export type ValidationResult = {
  imports: Import[];
  globalVariableDeclarations: GlobalVariableDeclaration[];
  functionDeclarations: FunctionDeclaration[];
  segment: {
    offset: number;
    data: Uint8Array;
  };
  errors: ValidationErrorType[];
};
export function validate(
  ast: ast.Module,
  moduleCache: ModuleCache
): ValidationResult {
  const dataBuilder = new DataBuilder();
  const state: GlobalState = {
    numSamples: 128,
    moduleCache,
    imports: [],
    globalVariableDeclarations: [],
    functionDeclarations: [],
    paramInfo: [],
    dataBuilder,
    strings: new StringBuilder(dataBuilder),
    errors: [],
  };
  const scope = new GlobalScope();

  // imports
  ast.imports = [
    { $: "NameImport", name: "builtin" },
    { $: "NameImport", name: "math" },
    { $: "NameImport", name: "util" },
  ];
  for (const importAst of ast.imports) {
    validateImport(state, scope, importAst);
  }

  // predefined
  const numberOfInChannels = 2;
  const numberOfOutChannels = 2;
  // inputs
  if (numberOfInChannels > 0) {
    state.globalVariableDeclarations.push({
      $: "GlobalVariableDeclaration",
      name: "number_of_in_channels",
      type: primitives.int32Type,
      mutable: false,
      init: makeConstant(primitives.int32Type, numberOfInChannels),
      export: true,
    });
  }
  for (let i = 0; i < numberOfInChannels; i++) {
    const internalVarName = `in_${i}`;
    const offset = validateArrayDeclaration(
      state,
      scope,
      internalVarName,
      primitives.float32Type,
      state.numSamples,
      null
    );
    if (offset == null) {
      throw new Error("unreachable");
    }
    if (i === 0) {
      state.globalVariableDeclarations.push({
        $: "GlobalVariableDeclaration",
        name: "pointer_of_in_channels",
        type: primitives.int32Type,
        mutable: false,
        init: makeConstant(primitives.int32Type, offset),
        export: true,
      });
    }
  }
  // outputs
  if (numberOfOutChannels > 0) {
    state.globalVariableDeclarations.push({
      $: "GlobalVariableDeclaration",
      name: "number_of_out_channels",
      type: primitives.int32Type,
      mutable: false,
      init: makeConstant(primitives.int32Type, numberOfOutChannels),
      export: true,
    });
  }
  for (let i = 0; i < numberOfInChannels; i++) {
    const internalVarName = `out_${i}`;
    const offset = validateArrayDeclaration(
      state,
      scope,
      internalVarName,
      primitives.float32Type,
      state.numSamples,
      null
    );
    if (offset == null) {
      throw new Error("unreachable");
    }
    if (i === 0) {
      state.globalVariableDeclarations.push({
        $: "GlobalVariableDeclaration",
        name: "pointer_of_out_channels",
        type: primitives.int32Type,
        mutable: false,
        init: makeConstant(primitives.int32Type, offset),
        export: true,
      });
    }
  }

  // user definitions
  for (let statement of ast.statements) {
    validateGlobalStatement(state, scope, statement);
  }

  // array pointers
  for (const [name, array] of scope.getAllArrays()) {
    state.globalVariableDeclarations.push({
      $: "GlobalVariableDeclaration",
      type: primitives.int32Type,
      name,
      mutable: false,
      init: makeConstant(primitives.int32Type, array.byteOffset),
      export: true,
    });
  }

  // start static
  const staticSegmentOffset = scope.byteOffset;
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    type: primitives.int32Type,
    name: "pointer_of_static_data",
    mutable: false,
    init: makeConstant(primitives.int32Type, staticSegmentOffset),
    export: true,
  });

  // param info
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    type: primitives.int32Type,
    name: "number_of_params",
    mutable: false,
    init: makeConstant(primitives.int32Type, state.paramInfo.length),
    export: true,
  });
  for (let i = 0; i < state.paramInfo.length; i++) {
    const { structType, fieldValues } = state.paramInfo[i];
    const infoStructOffset = pushStructToDataBuilder(
      state.dataBuilder,
      structType,
      fieldValues
    );
    if (infoStructOffset == null) {
      throw new Error("unreachable");
    }
    if (i === 0) {
      state.globalVariableDeclarations.push({
        $: "GlobalVariableDeclaration",
        type: primitives.int32Type,
        name: "offset_of_param_info",
        mutable: false,
        init: makeConstant(primitives.int32Type, infoStructOffset),
        export: true,
      });
    }
  }
  // end static
  const sizeOfStaticData = dataBuilder.size;
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    type: primitives.int32Type,
    name: "size_of_static_data",
    mutable: false,
    init: makeConstant(primitives.int32Type, sizeOfStaticData),
    export: true,
  });
  return {
    imports: state.imports,
    globalVariableDeclarations: state.globalVariableDeclarations,
    functionDeclarations: state.functionDeclarations,
    segment: { offset: staticSegmentOffset, data: dataBuilder.createData() },
    errors: state.errors,
  };
}
function validateArrayDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  name: string,
  itemType: ItemType,
  numberOfItems: number,
  ast: ast.VariableDeclaration | null
): number | null {
  if (scope.isDeclaredInThisScope(name)) {
    if (ast == null) {
      throw new Error("already declared: " + name);
    }
    state.errors.push(new AlreadyDeclared(ast.range, "variable", name));
    return null;
  }
  return scope.declareArray(name, itemType, numberOfItems);
}
function validateImport(
  state: GlobalState,
  scope: GlobalScope,
  importAst: ast.Import
): void {
  if (importAst.$ === "NameImport") {
    const moduleName = importAst.name;
    const header = state.moduleCache.get(moduleName);
    if (header == null) {
      state.errors.push(new ImportModuleNotFound(null, moduleName));
      return;
    }
    for (const [name, type] of header.types.entries()) {
      if (type.$ === "FunctionType") {
        const internalName = scope.addImportName(name, moduleName);
        scope.declareType(internalName, type);
        state.imports.push({
          $: "FunctionImport",
          internalName,
          externalModuleName: moduleName,
          externalBasename: name,
          type,
        });
        continue;
      }
      if (isConstantType(type)) {
        const internalName = scope.addImportName(name, moduleName);
        scope.declareConst(internalName, type);
        continue;
      }
      throw new Error("unreachable");
    }
    return;
  }
  throw new Error("not implemented yet");
}
function validateParamType(
  state: State,
  scope: Scope,
  ast: ast.Param
): ParamType | null {
  if (ast.type.$ === "PrimitiveType") {
    if (scope.isDeclaredInThisScope(ast.name)) {
      state.errors.push(new AlreadyDeclared(ast.range, "variable", ast.name));
      return null;
    }
    const type = validatePrimitiveType(state, ast.type);
    if (type == null) {
      return null;
    }
    if (type.$ == "VoidType") {
      state.errors.push(new VoidShouldNotBeDeclaredAsAVariable(ast.type.range));
      return null;
    }
    scope.declareType(ast.name, type);
    return type;
  } else {
    state.errors.push(new ReceivingNonPrimitiveTypesIsNotSupported(ast.range));
    return null;
  }
}
function validateReturnType(
  state: State,
  scope: Scope,
  ast: ast.Type
): ReturnType | null {
  if (ast.$ === "PrimitiveType") {
    return validatePrimitiveType(state, ast);
  } else {
    state.errors.push(new ReturningNonPrimitiveTypesIsNotSupported(ast.range));
    return null;
  }
}
function validateGlobalStatement(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.Statement
): void {
  if (ast.$ === "VariableDeclaration") {
    validateGlobalDeclaration(state, scope, ast);
  } else if (ast.$ === "Assign") {
    state.errors.push(new AssigningInGlobalIsNotAllowed(ast.range));
  } else if (ast.$ === "FunctionDeclaration") {
    validateFunctionDeclaration(state, scope, ast);
  } else if (ast.$ === "ParamDeclaration") {
    validateParamDeclaration(state, scope, ast);
  } else if (ast.$ === "FunctionCall") {
    state.errors.push(new FunctionShouldNotBeCalledAtGlobalScope(ast.range));
  } else if (ast.$ === "Loop") {
    state.errors.push(new LoopShouldNotBePlacedAtGlobalScope(ast.range));
  } else if (ast.$ === "Return") {
    state.errors.push(new ReturnShouldNotBePlacedAtGlobalScope(ast.range));
  } else if (ast.$ === "Comment") {
    // noop
  } else {
    throw new Error("unreachable");
  }
}
function validateFunctionDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.FunctionDeclaration
): void {
  const statements: LocalStatement[] = [];
  const paramTypes = new Array<ParamType>(ast.params.items.length);

  const returnType = validateReturnType(state, scope, ast.returnType);
  const functionScope = scope.createFunctionScope();
  if (returnType != null) {
    functionScope.setReturnType(returnType);
  }
  for (let i = 0; i < ast.params.items.length; i++) {
    const paramAst = ast.params.items[i];
    const paramType = validateParamType(state, functionScope, paramAst);
    if (paramType == null) {
      continue;
    }
    paramTypes[i] = paramType;
  }
  for (const statement of ast.statements) {
    validateLocalStatement(state, functionScope, statements, statement);
  }
  for (const p of paramTypes) {
    if (p == null) {
      return;
    }
  }
  const localTypes = functionScope.getLocalTypes().slice(paramTypes.length);
  if (returnType == null) {
    return;
  }
  if (returnType.$ !== "VoidType" && !functionScope.isReturnCovered()) {
    state.errors.push(new FunctionShouldReturnValue(ast.returnType.range));
  }
  if (scope.isDeclaredInThisScope(ast.name.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.name.range, "function", ast.name.name)
    );
  } else {
    scope.declareType(ast.name.name, {
      range: ast.name.range,
      $: "FunctionType",
      params: paramTypes,
      returnType,
      builtinFunctionKind: null,
    });
  }
  state.functionDeclarations.push({
    $: "FunctionDeclaration",
    name: ast.name.name,
    params: paramTypes,
    returnType,
    localTypes,
    statements,
    export: true, // ?
  });
}

function validateParamDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.ParamDeclaration
) {
  const valueType = primitives.float32Type;
  let isArray = false;
  if (ast.type.$ === "PrimitiveType") {
    const type = validatePrimitiveType(state, ast.type);
    if (type.$ !== "Float32Type") {
      state.errors.push(
        new ParametersShouldBeFloatOrArrayOfFloat(ast.type.range)
      );
    }
  } else if (ast.type.$ === "ArrayType") {
    isArray = true;
    const type = validatePrimitiveType(state, ast.type.type);
    if (type.$ !== "Float32Type") {
      state.errors.push(
        new ParametersShouldBeFloatOrArrayOfFloat(ast.type.range)
      );
    }
  }
  const optionValue = evaluateStructLiteralInGlobal(
    state,
    scope,
    paramOptionsType,
    ast.struct
  );
  if (scope.isDeclaredInThisScope(ast.name.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.name.range, "variable", ast.name.name)
    );
    return;
  }
  if (isArray) {
    const offset = validateArrayDeclaration(
      state,
      scope,
      ast.name.name,
      valueType,
      state.numSamples,
      null
    );
    if (offset == null) {
      throw new Error("unreachable");
    }
    if (state.paramInfo.length === 0) {
      state.globalVariableDeclarations.push({
        $: "GlobalVariableDeclaration",
        name: "pointer_of_params",
        type: primitives.int32Type,
        mutable: false,
        init: makeConstant(primitives.int32Type, offset),
        export: true,
      });
    }
  } else {
    const sealedArrayName = "_" + ast.name.name;
    const byteOffset = validateArrayDeclaration(
      state,
      scope,
      "_" + ast.name.name,
      valueType,
      1,
      null
    );
    if (byteOffset == null) {
      throw new Error("unreachable");
    }
    if (state.paramInfo.length === 0) {
      state.globalVariableDeclarations.push({
        $: "GlobalVariableDeclaration",
        name: "pointer_of_params",
        type: primitives.int32Type,
        mutable: false,
        init: makeConstant(primitives.int32Type, byteOffset),
        export: true,
      });
    }
    scope.declareItemGet(ast.name.name, {
      $: "ItemGet",
      pointer: {
        byteOffset: byteOffset,
        itemType: valueType,
        name: sealedArrayName,
        index: makeConstant(primitives.int32Type, 0),
      },
    });
  }
  if (optionValue == null) {
    return;
  }
  state.paramInfo.push({
    structType: paramInfoType,
    fieldValues: [
      state.strings.set(ast.name.name),
      optionValue[0].value,
      optionValue[1].value,
      optionValue[2].value,
      state.strings.set(isArray ? "a-rate" : "k-rate"),
    ],
  });
}

function pushStructToDataBuilder(
  builder: DataBuilder,
  structType: StructType,
  fieldValues: number[]
): number | null {
  let structOffset = null;
  for (let i = 0; i < structType.types.length; i++) {
    const fieldType = structType.types[i];
    let offset = null;
    if (fieldType.type.$ === "Int32Type") {
      offset = builder.pushInt32(fieldValues[i]);
    } else if (fieldType.type.$ === "Float32Type") {
      offset = builder.pushFloat32(fieldValues[i]);
    } else if (fieldType.type.$ === "BoolType") {
      offset = builder.pushInt32(fieldValues[i]);
    } else {
      throw new Error("unreachable");
    }
    if (structOffset == null) {
      structOffset = offset;
    }
  }
  return structOffset;
}

function evaluateStructLiteralInGlobal(
  state: GlobalState,
  scope: GlobalScope,
  type: StructType,
  ast: ast.StructLiteral
): ConstantType[] | null {
  const fields: {
    name: string;
    type: FieldType;
    found: boolean;
    right: ConstantType | null;
  }[] = type.types.map((t) => ({
    name: t.name,
    type: t.type,
    found: false,
    right: null,
  }));
  for (let i = 0; i < ast.fields.length; i++) {
    const fieldAst = ast.fields[i];
    if (fieldAst.left.$ !== "Identifier") {
      state.errors.push();
      continue;
    }
    let foundIndex = -1;
    let fieldType: FieldType | null = null;
    for (let f of fields) {
      foundIndex++;
      if (f.name === fieldAst.left.name) {
        f.found = true;
        fieldType = f.type;
        break;
      }
    }
    const exp = validateExpression(state, scope, fieldAst.right, true);
    if (exp == null) {
      continue;
    }
    const right = evaluateGlobalExpression(exp[0]);
    if (right == null) {
      continue;
    }
    const [rightExp, rightType] = right;
    if (fieldType == null) {
      state.errors.push(
        new UnknownField(fieldAst.left.range, fieldAst.left.name, type.types)
      );
      continue;
    }
    if (!isTypeEqual(fieldType, rightType)) {
      state.errors.push(
        new AssignTypeMismatch(fieldAst.range, fieldType, rightType)
      );
      continue;
    }
    if (rightExp.$ === "StringGet") {
      throw new Error("there should not be a string field");
    }
    fields[foundIndex].right = rightExp;
  }
  let missingFields: string[] = [];
  for (const field of fields) {
    if (!field.found) {
      missingFields.push(field.name);
    }
  }
  if (missingFields.length > 0) {
    state.errors.push(
      new MissingFields(
        ast.range, // too wide?
        missingFields,
        type.types
      )
    );
    return null;
  }
  for (const field of fields) {
    if (field.right == null) {
      return null;
    }
  }
  return fields.map((f) => f.right) as ConstantType[];
}

function validateLocalStatement(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  ast: ast.Statement
): void {
  if (ast.$ === "VariableDeclaration") {
    validateLocalVariableDeclaration(state, scope, localStatements, ast);
  } else if (ast.$ === "FunctionDeclaration") {
    state.errors.push(new FunctionShouldBeDeclaredInGlobal(ast.range));
  } else if (ast.$ === "ParamDeclaration") {
    state.errors.push(new ParametersShouldBeDeclaredInGlobal(ast.range));
  } else if (ast.$ === "Assign") {
    validateLocalAssign(state, scope, localStatements, ast);
  } else if (ast.$ === "FunctionCall") {
    validateFunctionCallStatement(state, scope, localStatements, ast);
  } else if (ast.$ === "Loop") {
    validateLoop(state, scope, localStatements, ast);
  } else if (ast.$ === "Return") {
    validateReturn(state, scope, localStatements, ast);
  } else if (ast.$ === "Comment") {
    // noop
  } else {
    throw new Error("unreachable");
  }
}

function validateFunctionCallStatement(
  state: State,
  scope: Scope,
  localStatements: LocalStatement[],
  ast: ast.FunctionCall
): void {
  const func = validateFunctionCall(state, scope, ast, false);
  if (func == null) {
    return;
  }
  const [funcExp] = func; // ignore type
  localStatements.push({ $: "CallStatement", exp: funcExp });
}

function validateLocalVariableDeclaration(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  ast: ast.VariableDeclaration
): void {
  if (scope.isDeclaredInThisScope(ast.left.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.left.range, "variable", ast.left.name)
    );
    return;
  }
  if (ast.type.$ === "ArrayType") {
    state.errors.push(new DeclaringArrayInLocalIsNotSupported(ast.type.range));
    return;
  }
  const leftType = validatePrimitiveType(state, ast.type);
  if (leftType.$ === "VoidType") {
    state.errors.push(new VoidShouldNotBeDeclaredAsAVariable(ast.left.range));
    return;
  }
  scope.declareType(ast.left.name, leftType);

  // assign
  const [localGet] = lookupSelfDeclaredLocal(scope, ast.left.name);
  let rightExp: Expression | null = null;
  let rightType = null;
  if (ast.right == null) {
    [rightExp, rightType] = [defaultValueOf(leftType), leftType];
  } else {
    const right = validateExpression(state, scope, ast.right, false);
    if (right == null) {
      return;
    }
    [rightExp, rightType] = right;
  }
  if (leftType == null) {
    return;
  }
  if (!isTypeEqual(leftType, rightType)) {
    state.errors.push(
      new DeclareTypeMismatch(ast.type.range, leftType, rightType)
    );
    return;
  }
  localStatements.push(makeAssign(localGet, rightExp));
}

function validateLocalVariableDeclarationInternal(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  type: Int32Type | Float32Type,
  name: string,
  value: Expression
): number {
  scope.declareType(name, type);
  const [localGet] = lookupSelfDeclaredLocal(scope, name);
  localStatements.push(makeAssign(localGet, value));
  return localGet.index;
}
function lookupSelfDeclaredLocal(
  scope: LocalScope,
  name: string
): [LocalGet, ExpressionType] {
  const found = scope.lookupType(name);
  if (found == null) {
    throw new Error("Unexpected lookup not found: " + name);
  }
  if (!Array.isArray(found)) {
    throw new Error("Unexpected lookup multiple found: " + name);
  }
  const [exp, type] = found;
  assertLocalGet(exp);
  return [exp, type];
}
function assertLocalGet(exp: FoundExp): asserts exp is LocalGet {
  if (exp.$ !== "LocalGet") {
    throw new Error("unexpected " + exp.$);
  }
}

function validateLoop(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  ast: ast.Loop
): void {
  const childScope = scope.createBlockScope();
  const init: LocalStatement[] = [];
  const body: LocalStatement[] = [];
  const iIndex = validateLocalVariableDeclarationInternal(
    state,
    childScope,
    init,
    { $: "Int32Type" },
    "i",
    makeConstant(primitives.int32Type, 0)
  );
  const lenIndex = validateLocalVariableDeclarationInternal(
    state,
    childScope,
    init,
    { $: "Int32Type" },
    "length",
    makeConstant(primitives.int32Type, state.numSamples)
  );
  for (const statement of ast.statements) {
    validateLocalStatement(state, childScope, body, statement);
  }
  // increment
  body.push({
    $: "LocalSet",
    index: iIndex,
    value: {
      $: "Int32AddOp",
      left: {
        $: "LocalGet",
        index: iIndex,
        type: primitives.int32Type,
      },
      right: makeConstant(primitives.int32Type, 1),
    },
  });
  localStatements.push({
    $: "Loop",
    init,
    body,
    continueIf: {
      $: "Int32LT",
      left: {
        $: "LocalGet",
        index: iIndex,
        type: primitives.int32Type,
      },
      right: {
        $: "LocalGet",
        index: lenIndex,
        type: primitives.int32Type,
      },
    },
  });
}

function validateReturn(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  ast: ast.Return
): void {
  scope.coverReturn();
  const declaredReturnType = scope.lookupReturnType();
  let returnExp = null;
  let returnType: AnyType = primitives.voidType;
  if (ast.value != null) {
    const _return = validateExpression(state, scope, ast.value, false);
    if (_return == null) {
      return;
    }
    [returnExp, returnType] = _return;
  }
  if (declaredReturnType == null) {
    return;
  }
  if (!isTypeEqual<ReturnType>(declaredReturnType, returnType)) {
    state.errors.push(
      new ReturnTypeMismatch(ast.range, declaredReturnType.$, returnType.$)
    );
    return;
  }
  localStatements.push({
    $: "Return",
    value: returnExp,
  });
}

function validatePrimitiveType(
  state: State,
  ast: ast.PrimitiveType
): Int32Type | Float32Type | VoidType | BoolType {
  if (ast.name.kind === "int") {
    return primitives.int32Type;
  }
  if (ast.name.kind === "float") {
    return primitives.float32Type;
  }
  if (ast.name.kind === "void") {
    return primitives.voidType;
  }
  if (ast.name.kind === "bool") {
    return primitives.boolType;
  }
  throw new Error("not implemented yet: " + ast.name);
}

function validateGlobalDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.VariableDeclaration
): void {
  if (ast.type.$ === "ArrayType") {
    const itemType = validatePrimitiveType(state, ast.type.type);
    if (itemType.$ === "VoidType") {
      state.errors.push(new VoidCannotBeAnArrayItem(ast.type.range));
    } else {
      scope.declareArray(ast.left.name, itemType, state.numSamples);
    }
    if (ast.right != null) {
      state.errors.push(
        new DeclaringArrayWithInitialValueNotSupported(ast.right.range)
      );
    }
    if (ast.hasMutableFlag) {
      state.errors.push(new DeclaringMutableArraysIsNotAllowed(ast.type.range));
    }
    return;
  }
  const type = validatePrimitiveType(state, ast.type);
  if (ast.left.$ !== "Identifier") {
    state.errors.push(
      new TheLeftHandExpressionMustBeAnIdentifier(ast.left.range)
    );
    return;
  }
  if (scope.isDeclaredInThisScope(ast.left.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.left.range, "variable", ast.left.name)
    );
    return;
  }
  if (type == null) {
    return;
  }
  if (type.$ === "VoidType") {
    state.errors.push(new VoidShouldNotBeDeclaredAsAVariable(ast.type.range));
    return;
  }
  let rightExp: ConstantType | StringGet | null = null;
  let rightType: Int32Type | Float32Type | BoolType | StringType | null = null;
  if (ast.right == null) {
    const _rightExp = defaultValueOf(type);
    [rightExp, rightType] = [_rightExp, type];
  } else {
    const exp = validateExpression(state, scope, ast.right, true);
    if (exp == null) {
      return;
    }
    const right = evaluateGlobalExpression(exp[0]);
    if (right == null) {
      return;
    }
    [rightExp, rightType] = right;
  }
  if (!isTypeEqual(type, rightType)) {
    state.errors.push(new DeclareTypeMismatch(ast.type.range, type, rightType));
    return;
  }
  if (rightExp.$ === "StringGet") {
    throw new Error("there should not be a way to declare string");
  }
  if (ast.hasMutableFlag) {
    scope.declareType(ast.left.name, rightType);
  } else {
    scope.declareConst(ast.left.name, rightExp);
  }
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    name: ast.left.name,
    type,
    mutable: ast.hasMutableFlag,
    init: rightExp,
    export: !ast.hasMutableFlag, // by design
  });
}
function validateLocalAssign(
  state: State,
  scope: Scope,
  statements: LocalStatement[],
  ast: ast.Assign
): void {
  const assign = validateAssign(state, scope, ast);
  if (assign == null) {
    return;
  }
  if (assign.$ === "LocalSet") {
    statements.push(assign);
    return;
  }
  if (assign.$ === "GlobalSet") {
    statements.push(assign);
    return;
  }
  if (assign.$ === "ItemSet") {
    statements.push(assign);
    return;
  }
  throw new Error("Unreachable");
}
function validateAssign(
  state: State,
  scope: Scope,
  ast: ast.Assign
): Assign | null {
  if (ast.left.$ === "ArrayAccess") {
    const left = validateArrayAccess(state, scope, ast.left);
    if (left == null) {
      return null;
    }
    const [leftExp, _leftType] = left;
    const leftType = validateAssignableType(state, scope, ast.left, _leftType);
    const right = validateExpression(state, scope, ast.right, false);
    if (leftType == null || right == null) {
      return null;
    }
    const [rightExp, rightType] = right;
    if (!isTypeEqual(leftType, rightType)) {
      state.errors.push(new AssignTypeMismatch(ast.range, leftType, rightType));
      return null;
    }
    return makeAssign(leftExp, rightExp);
  } else if (ast.left.$ === "Identifier") {
    const left = validateAssignableIdentifier(state, scope, ast.left);
    if (left == null) {
      return null;
    }
    const [leftExp, _leftType] = left;
    const leftType = validateAssignableType(state, scope, ast.left, _leftType);
    const right = validateExpression(state, scope, ast.right, false);
    if (leftType == null || right == null) {
      return null;
    }
    const [rightExp, rightType] = right;
    if (!isTypeEqual(leftType, rightType)) {
      state.errors.push(new AssignTypeMismatch(ast.range, leftType, rightType));
      return null;
    }
    return makeAssign(leftExp, rightExp);
  } else {
    state.errors.push(new InvlaidAssignTarget(ast.left.range));
    return null;
  }
}

function validateAssignableIdentifier(
  state: State,
  scope: Scope,
  leftAst: ast.Identifier
): [LocalGet | GlobalGet | ItemGet, ExpressionType] | null {
  const left = validateIdentifier(state, scope, leftAst);
  if (left == null) {
    return null;
  }
  const [leftExp, leftType] = left;
  if (leftExp.$ === "FunctionGet") {
    state.errors.push(new AssigningFunctionIsNotSupported(leftAst.range));
    return null;
  }
  if (leftExp.$ === "StructTypeWithOffset") {
    state.errors.push(new AssigningStructIsNotSupported(leftAst.range));
    return null;
  }
  if (leftExp.$ === "ArrayGet") {
    state.errors.push(new AssigningArrayIsNotSupported(leftAst.range));
    return null;
  }
  if (isConstantType(leftExp)) {
    state.errors.push(new AssigningToConstantValueIsNotAllowed(leftAst.range));
    return null;
  }
  return [leftExp, leftType];
}
function validateIdentifier(
  state: State,
  scope: Scope,
  ast: ast.Identifier
): [FoundExp, ExpressionType] | null {
  const found = scope.lookupType(ast.name);
  if (found == null) {
    state.errors.push(new NotFound(ast.range, ast.name));
    return null;
  }
  if (!Array.isArray(found)) {
    state.errors.push(new AmbiguousName(ast.range, ast.name, found.modules));
    return null;
  }
  return found;
}
function validateArrayAccess(
  state: State,
  scope: Scope,
  ast: ast.ArrayAccess
): [ItemGet, ItemType] | null {
  const array = validateExpression(state, scope, ast.array, false);
  const index = validateExpression(state, scope, ast.index, false);
  if (array == null || index == null) {
    return null;
  }
  const [arrayExp, arrayType] = array;
  const [indexExp, indexType] = index;
  if (arrayType.$ !== "ArrayType") {
    state.errors.push(new IndexAccessToNonArray(ast.range));
    return null;
  }
  if (arrayExp.$ !== "ArrayGet") {
    state.errors.push(new IndexAccessToNonArray(ast.range));
    return null;
  }
  if (indexType.$ !== "Int32Type") {
    state.errors.push(new IndexShouldBeAnInteger(ast.index.range));
    return null;
  }
  return [
    {
      $: "ItemGet",
      pointer: {
        byteOffset: arrayExp.byteOffset,
        itemType: arrayType.itemType,
        name: arrayExp.name,
        index: indexExp,
      },
    },
    arrayType.itemType,
  ];
}

function validateAssignableType(
  state: State,
  scope: Scope,
  leftAst: ast.Expression,
  leftType: ExpressionType
): AssignableType | null {
  if (
    leftType.$ === "VoidType" ||
    leftType.$ === "StructType" ||
    leftType.$ === "ArrayType" ||
    leftType.$ === "FunctionType"
  ) {
    state.errors.push(new NonAssignableType(leftAst.range, leftType));
    return null;
  }
  return leftType;
}

function validateExpression(
  state: State,
  scope: Scope,
  ast: ast.Expression,
  forEvaluation: boolean
): [Expression, ExpressionType] | null {
  if (ast.$ === "IntLiteral") {
    return [
      makeConstant(primitives.int32Type, ast.value),
      primitives.int32Type,
    ];
  } else if (ast.$ === "FloatLiteral") {
    return [
      makeConstant(primitives.float32Type, ast.value),
      primitives.float32Type,
    ];
  } else if (ast.$ === "StringLiteral") {
    return validateStringLiteral(state, scope, ast.value);
  } else if (ast.$ === "ArrayLiteral") {
    state.errors.push(new ArrayLiteralIsNotSupported(ast.range));
    return null;
  } else if (ast.$ === "Identifier") {
    const id = validateIdentifier(state, scope, ast);
    if (forEvaluation) {
      if (id == null) {
        return null;
      }
      const [idExp] = id;
      if (idExp.$ === "LocalGet") {
        throw new Error("unexpected LocalGet");
      }
      if (idExp.$ === "ArrayGet") {
        state.errors.push(new GettingArrayInGlobalIsNotSupported(ast.range));
        return null;
      }
      if (idExp.$ === "GlobalGet") {
        state.errors.push(
          new ReferringMutableValueInGlobalIsNotAllowed(ast.range)
        );
        return null;
      }
    }
    return id;
  } else if (ast.$ === "ArrayAccess") {
    if (forEvaluation) {
      state.errors.push(new GettingArrayInGlobalIsNotSupported(ast.range));
      return null;
    }
    return validateArrayAccess(state, scope, ast);
  } else if (ast.$ === "FunctionCall") {
    const funcCall = validateFunctionCall(state, scope, ast, forEvaluation);
    if (funcCall == null) {
      return funcCall;
    }
    const [funcCallExp, funcCallType] = funcCall;
    if (funcCallType.$ === "VoidType") {
      state.errors.push(new VoidShouldNotBeUsedAsAVariable(ast.func.range));
      return null;
    }
    return [funcCallExp, funcCallType];
  } else if (ast.$ === "BinOp") {
    return validateBinOp(state, scope, ast, forEvaluation);
  } else if (ast.$ === "CondOp") {
    return validateCondOp(state, scope, ast, forEvaluation);
  } else {
    throw new Error("unreachable");
  }
}

function validateStringLiteral(
  state: State,
  scope: Scope,
  value: string
): [StringGet, StringType] {
  const offset = state.strings.set(value);
  return [
    {
      $: "StringGet",
      relativeByteOffset: offset,
    },
    primitives.stringType,
  ];
}

function validateBinOp(
  state: State,
  scope: Scope,
  ast: ast.BinOp,
  forEvaluation: boolean
): [BinOp, Int32Type | Float32Type | BoolType] | null {
  const left = validateExpression(state, scope, ast.left, forEvaluation);
  const right = validateExpression(state, scope, ast.right, forEvaluation);
  if (left == null || right == null) {
    return null;
  }
  const [leftExp, leftType] = left;
  const [rightExp, rightType] = right;
  const found = binop.get(ast.operator, leftType, rightType);
  if (found == null) {
    state.errors.push(
      new InvalidTypeCombinationForBinOp(
        ast.range,
        ast.operator,
        leftType,
        rightType
      )
    );
    return null;
  }
  return [
    {
      $: found.kind,
      left: leftExp,
      right: rightExp,
    },
    found.returnType,
  ];
}

function validateCondOp(
  state: State,
  scope: Scope,
  ast: ast.CondOp,
  forEvaluation: boolean
): [CondOp, ExpressionType] | null {
  const condition = validateExpression(
    state,
    scope,
    ast.condition,
    forEvaluation
  );
  const ifTrue = validateExpression(state, scope, ast.ifTrue, forEvaluation);
  const ifFalse = validateExpression(state, scope, ast.ifFalse, forEvaluation);
  if (condition == null || ifTrue == null || ifFalse == null) {
    return null;
  }
  const [conditionExp, conditionType] = condition;
  const [ifTrueExp, ifTrueType] = ifTrue;
  const [ifFalseExp, ifFalseType] = ifFalse;
  if (conditionType.$ !== "BoolType") {
    state.errors.push(
      new ConditionShouldBeBool(ast.condition.range, conditionType)
    );
    return null;
  }
  if (!isTypeEqual(ifTrueType, ifFalseType)) {
    state.errors.push(
      new BranchesShouldReturnTheSameType(
        { start: ast.ifTrue.range.start, end: ast.ifFalse.range.end },
        ifTrueType,
        ifFalseType
      )
    );
    return null;
  }
  return [
    {
      $: "CondOp",
      condition: conditionExp,
      ifTrue: ifTrueExp,
      ifFalse: ifFalseExp,
    },
    ifTrueType,
  ];
}

function validateFunctionCall(
  state: State,
  scope: Scope,
  ast: ast.FunctionCall,
  forEvaluation: boolean
): [Call, ReturnType] | null {
  const func = validateCallee(state, scope, ast.func, forEvaluation);
  if (func == null) {
    return null;
  }
  const [funcExp, funcType] = func;
  const args = validateArguments(
    state,
    scope,
    funcType,
    ast.args,
    forEvaluation
  );
  if (args == null) {
    return null;
  }
  if (forEvaluation && funcType.builtinFunctionKind == null) {
    state.errors.push(
      new CallingNonBuiltInFunctionInGlobalIsNotSupported(ast.func.range)
    );
    return null;
  }
  if (funcType.builtinFunctionKind != null) {
    return [
      {
        $: funcType.builtinFunctionKind,
        args: args.map((item) => item![0]),
      },
      funcType.returnType,
    ];
  }
  return [
    {
      $: "FunctionCall",
      target: funcExp,
      args: args.map((item) => item![0]),
      // params,
      returnType: funcType.returnType,
    },
    funcType.returnType,
  ];
}

function validateCallee(
  state: State,
  scope: Scope,
  ast: ast.Expression,
  forEvaluation: boolean
): [FunctionGet, FunctionType] | null {
  const func = validateExpression(state, scope, ast, forEvaluation);
  if (func == null) {
    return null;
  }
  const [funcExp, funcType] = func;
  if (funcExp.$ !== "FunctionGet") {
    state.errors.push(new CallingArbitraryExpressionIsNotSupported(ast.range));
    return null;
  }
  if (funcType.$ !== "FunctionType") {
    state.errors.push(new ShouldNotCallNonFunctionType(ast.range));
    return null;
  }
  return [funcExp, funcType];
}

function validateArguments(
  state: State,
  scope: Scope,
  funcType: FunctionType,
  astArgs: ast.FunctionArguments,
  forEvaluation: boolean
): [Expression, ExpressionType][] | null {
  const args = new Array<[Expression, ExpressionType] | null>(
    astArgs.values.length
  );
  const argLength = args.length;
  const paramLength = funcType.params.length;
  for (let i = 0; i < astArgs.values.length; i++) {
    const argAst = astArgs.values[i];
    const arg = validateExpression(state, scope, argAst, forEvaluation);
    if (arg == null) {
      args[i] = null;
      continue;
    }
    const [argExp, argType] = arg;
    if (i >= paramLength) {
      state.errors.push(
        new ExtraArgument(argAst.range, paramLength, argLength)
      );
      continue;
    }
    const paramType = funcType.params[i];

    if (!isTypeEqual(argType, paramType)) {
      state.errors.push(new ArgTypeMismatch(argAst.range, paramType, argType));
      continue;
    }
    args[i] = arg;
  }
  if (args.length < paramLength) {
    state.errors.push(
      new TooFewArguments(astArgs.range, paramLength, argLength)
    );
    return null;
  }
  for (let a of args) {
    if (a == null) {
      return null;
    }
  }
  return args.map((item) => item!);
}

function evaluateGlobalExpression(
  exp: Expression
):
  | [ConstantType | StringGet, Int32Type | Float32Type | BoolType | StringType]
  | null {
  if (
    exp.$ === "LocalGet" ||
    exp.$ === "GlobalGet" ||
    exp.$ === "FunctionGet" ||
    exp.$ === "StructTypeWithOffset" ||
    exp.$ === "ArrayGet" ||
    exp.$ === "ItemGet" ||
    exp.$ === "FunctionCall"
  ) {
    throw new Error("unexpected " + exp.$);
  }
  if (isConstantType(exp)) {
    return [exp, typeOfConstant(exp)];
  }
  if (exp.$ === "StringGet") {
    return [exp, primitives.stringType];
  }
  if (binop.isBinOp(exp)) {
    const args: Expression[] = [exp.left, exp.right];
    assertArgumentsIsConstants(args);
    const result = binop.evaluate(exp.$, args[0], args[1]);
    return [result, typeOfConstant(result)];
  }
  if (exp.$ === "CondOp") {
    const condition = evaluateGlobalExpression(exp.condition);
    if (condition == null) {
      throw new Error("unexpected condition");
    }
    const [condExp] = condition;
    if (condExp.$ !== "BoolConst") {
      throw new Error("unexpected " + condExp.$);
    }
    if (condExp.value > 0) {
      return evaluateGlobalExpression(exp.ifTrue);
    } else {
      return evaluateGlobalExpression(exp.ifFalse);
    }
  }
  if (builtin.isBuiltinFunctionKind(exp.$)) {
    assertArgumentsIsConstants(exp.args);
    const result = builtin.evaluate(exp.$, exp.args);
    return [result, typeOfConstant(result)];
  }
  assertNever(exp.$);
}

function assertArgumentsIsConstants(
  args: Expression[]
): asserts args is ConstantType[] {
  for (const arg of args) {
    if (!isConstantType(arg)) {
      throw new Error("unexpected non-constant argument: " + arg.$);
    }
  }
}
