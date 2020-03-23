import * as ast from "./ast";
import * as log from "./log";
import * as util from "util";
import {
  ParamType,
  ReturnType,
  DeclaredType,
  VoidType,
  GlobalDeclarableType,
  Int32Type,
  Float32Type,
  ExpressionType,
  NumberConst,
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
  ArrayAccess,
  FoundExp,
  LocalGet,
  GlobalGet,
  GetForAssign,
  Assign,
  LocalStatement,
  GlobalStatement,
  ArrayDeclaration,
  FunctionDeclaration,
  GlobalVariableDeclaration,
  Import,
  sizeOf
} from "./types";
import { ModuleCache } from "./loader";
import { StringRefsBuilder } from "./string";
import {
  ValidationErrorType,
  ImportModuleNotFound,
  AlreadyDeclared,
  VoidShouldNotBeDeclaredAsAVariable,
  Unsupported,
  FunctionShouldNotBeCalledAtGlobalScope,
  LoopShouldNotBePlacedAtGlobalScope,
  ReturnShouldNotBePlacedAtGlobalScope,
  FunctionShouldBeDeclaredInGlobal,
  DeclareTypeMismatch,
  ReturnTypeMismatch,
  AssignTypeMismatch,
  NotFound,
  IndexShouldBeAnInteger,
  IndexAccessToNonArray,
  VoidShouldNotBeUsedAsAVariable,
  InvalidTypeCombinationForBinOp,
  ShouldNotCallNonFunctionType,
  ArgTypeMismatch,
  ExtraArgument,
  TooFewArguments,
  formatType,
  BranchesShouldReturnTheSameType,
  ConditionShouldBeBool,
  Unlabeled,
  AssigningToConstantValueIsNotAllowed
} from "./errors";

// Scopes
interface Scope {
  declareType(name: string, type: DeclaredType): void;
  isDeclaredInThisScope(name: string): boolean;
  lookupType(name: string): [FoundExp, ExpressionType] | null;
}
interface LocalScope extends Scope {
  createBlockScope(): BlockScope;
  declareType(name: string, type: Int32Type | Float32Type | BoolType): void;
  isDeclaredInThisScope(name: string): boolean;
  addLocalType(type: Int32Type | Float32Type | BoolType): number;
  lookupType(name: string): [FoundExp, ExpressionType] | null;
  lookupLocalTypeByIndex(
    index: number
  ): Int32Type | Float32Type | BoolType | null;
  lookupReturnType(): ReturnType | null;
}

class GlobalScope implements Scope {
  byteOffset = 0;
  private declaredTypesOrStaticValue = new Map<
    string,
    Int32Type | Float32Type | BoolType | ArrayType | FunctionType | NumberConst
  >();
  constructor() {}
  createFunctionScope(returnType: ReturnType) {
    return new FunctionScope(this, returnType);
  }
  isDeclaredInThisScope(name: string): boolean {
    return this.declaredTypesOrStaticValue.has(name);
  }
  declareConst(name: string, value: NumberConst): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already declared in this scope");
    }
    this.declaredTypesOrStaticValue.set(name, value);
  }
  declareType(
    name: string,
    type: Int32Type | Float32Type | BoolType | ArrayType | FunctionType
  ): void {
    if (this.isDeclaredInThisScope(name)) {
      throw new Error(name + " is already declared in this scope");
    }
    this.declaredTypesOrStaticValue.set(name, type);
  }
  declareArray(name: string, itemType: ItemType, numberOfItems: number): void {
    this.declareType(name, {
      $: "ArrayType",
      itemType,
      numberOfItems,
      byteOffset: this.byteOffset
    });
    this.byteOffset += sizeOf(itemType) * numberOfItems;
  }
  lookupType(name: string): [FoundExp, ExpressionType] | null {
    const typeOrStaticValue = this.declaredTypesOrStaticValue.get(name);
    if (!typeOrStaticValue) {
      return null;
    }
    if (typeOrStaticValue.$ === "Int32Const") {
      return [typeOrStaticValue, primitives.int32Type];
    }
    if (typeOrStaticValue.$ === "Float32Const") {
      return [typeOrStaticValue, primitives.float32Type];
    }
    if (
      typeOrStaticValue.$ === "Int32Type" ||
      typeOrStaticValue.$ === "Float32Type"
    ) {
      return [
        { $: "GlobalGet", name, type: typeOrStaticValue },
        typeOrStaticValue
      ];
    }
    if (typeOrStaticValue.$ === "FunctionType") {
      return [{ $: "FunctionGet", name }, typeOrStaticValue];
    }
    if (typeOrStaticValue.$ === "ArrayType") {
      return [
        {
          $: "ArrayGet",
          name,
          byteOffset: typeOrStaticValue.byteOffset,
          itemType: typeOrStaticValue.itemType
        },
        typeOrStaticValue
      ];
    }
    throw new Error("unreachable");
  }
}

class FunctionScope implements LocalScope {
  private declaredTypes = new Map<string, number>();
  private localTypes: (Int32Type | Float32Type | BoolType)[] = [];
  constructor(private parent: GlobalScope, private returnType: ReturnType) {}
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
  lookupType(name: string): [FoundExp, ExpressionType] | null {
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
  lookupReturnType(): ReturnType {
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
  isDeclaredInThisScope(name: string): boolean {
    return this.declaredTypes.has(name);
  }
  lookupType(name: string): [FoundExp, ExpressionType] | null {
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
  moduleCache: ModuleCache;
  imports: Import[];
  globalVariableDeclarations: GlobalVariableDeclaration[];
  functionDeclarations: FunctionDeclaration[];
  arrayDeclarations: ArrayDeclaration[];
  globalStatements: GlobalStatement[];
  strings: StringRefsBuilder;
  errors: ValidationErrorType[];
};
type State = Pick<GlobalState, "strings" | "errors">;
export type ValidationResult = {
  imports: Import[];
  globalVariableDeclarations: GlobalVariableDeclaration[];
  functionDeclarations: FunctionDeclaration[];
  arrayDeclarations: ArrayDeclaration[];
  globalStatements: GlobalStatement[];
  data: Uint8Array;
  errors: ValidationErrorType[];
};
export function validate(
  ast: ast.Module,
  moduleCache: ModuleCache
): ValidationResult {
  const state: GlobalState = {
    moduleCache,
    imports: [],
    globalVariableDeclarations: [],
    functionDeclarations: [],
    arrayDeclarations: [],
    globalStatements: [],
    strings: new StringRefsBuilder(),
    errors: []
  };
  const scope = new GlobalScope();

  // imports
  ast.imports = [
    { $: "NameImport", name: "builtin" },
    { $: "NameImport", name: "math" },
    { $: "NameImport", name: "util" }
  ];
  for (const importAst of ast.imports) {
    validateImport(state, scope, importAst);
  }

  // predefined
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    name: "number_of_in_channels",
    type: primitives.int32Type,
    mutable: false,
    init: {
      $: "Int32Const",
      value: 2
    },
    export: true
  });
  state.globalVariableDeclarations.push({
    $: "GlobalVariableDeclaration",
    name: "number_of_out_channels",
    type: primitives.int32Type,
    mutable: false,
    init: {
      $: "Int32Const",
      value: 2
    },
    export: true
  });
  const numSamples = 128;
  validateArrayDeclaration(
    state,
    scope,
    "in_0",
    primitives.float32Type,
    numSamples,
    true
  );
  validateArrayDeclaration(
    state,
    scope,
    "in_1",
    primitives.float32Type,
    numSamples,
    true
  );
  validateArrayDeclaration(
    state,
    scope,
    "out_0",
    primitives.float32Type,
    numSamples,
    true
  );
  validateArrayDeclaration(
    state,
    scope,
    "out_1",
    primitives.float32Type,
    numSamples,
    true
  );
  // user definitions
  for (let statement of ast.statements) {
    validateGlobalStatement(state, scope, statement);
  }
  state.strings.add("Hello, World!"); // for example

  // string
  const stringRefs = state.strings.createRefs();
  state.arrayDeclarations.push({
    $: "ArrayDeclaration",
    name: "string",
    offset: scope.byteOffset, // ok?
    export: true
  });

  log.debug(util.inspect(state, { colors: true, depth: 10 }));
  return {
    imports: state.imports,
    globalVariableDeclarations: state.globalVariableDeclarations,
    functionDeclarations: state.functionDeclarations,
    arrayDeclarations: state.arrayDeclarations,
    globalStatements: state.globalStatements,
    data: stringRefs.data,
    errors: state.errors
  };
}
function validateArrayDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  name: string,
  itemType: ItemType,
  numberOfItems: number,
  export_: boolean
): void {
  if (scope.isDeclaredInThisScope(name)) {
    throw new Error("already declared: " + name);
  }
  state.arrayDeclarations.push({
    $: "ArrayDeclaration",
    name,
    offset: scope.byteOffset,
    export: export_
  });
  scope.declareArray(name, itemType, numberOfItems);
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
      state.errors.push(new ImportModuleNotFound(null, name));
      return;
    }
    for (const [name, type] of header.types.entries()) {
      if (type.$ === "FunctionType") {
        scope.declareType(name, type);
        state.imports.push({
          $: "FunctionImport",
          moduleName,
          functionName: name,
          type
        });
        continue;
      }
      if (type.$ === "Int32Const") {
        scope.declareConst(name, type);
        // TODO: push to state?
        continue;
      }
      if (type.$ === "Float32Const") {
        scope.declareConst(name, type);
        // TODO: push to state?
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
    state.errors.push(
      new Unsupported(ast.range, "passing non-primitive types")
    );
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
    state.errors.push(
      new Unsupported(ast.range, "returning non-primitive types")
    );
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
    validateGlobalAssign(state, scope, ast);
  } else if (ast.$ === "FunctionDeclaration") {
    validateFunctionDeclaration(state, scope, ast);
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
  if (returnType == null) {
    return; // TODO: should be later
  }
  const childScope = scope.createFunctionScope(returnType);
  for (let i = 0; i < ast.params.items.length; i++) {
    const paramAst = ast.params.items[i];
    const paramType = validateParamType(state, scope, paramAst);
    if (paramType == null) {
      continue;
    }
    if (childScope.isDeclaredInThisScope(paramAst.name)) {
      state.errors.push(new AlreadyDeclared(paramAst.range, "param", name));
      continue;
    }
    if (
      paramType.$ !== "Int32Type" &&
      paramType.$ !== "Float32Type" &&
      paramType.$ !== "BoolType"
    ) {
      state.errors.push(
        new Unsupported(paramAst.range, "receiving non-primitive types")
      );
      continue;
    }
    paramTypes[i] = paramType;
    childScope.declareType(paramAst.name, paramType);
  }
  for (const statement of ast.statements) {
    validateLocalStatement(state, childScope, statements, statement);
  }
  if (paramTypes.some(p => p == null)) {
    return;
  }
  const localTypes = childScope.getLocalTypes();

  // TODO:
  // - should return XXX
  // - block

  if (scope.isDeclaredInThisScope(ast.name.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.name.range, "function", ast.name.name)
    );
  } else {
    scope.declareType(ast.name.name, {
      $: "FunctionType",
      params: paramTypes,
      returnType
    });
  }
  state.functionDeclarations.push({
    $: "FunctionDeclaration",
    name: ast.name.name,
    params: paramTypes,
    returnType,
    localTypes,
    statements,
    export: true // ?
  });
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
  const func = validateFunctionCall(state, scope, ast);
  if (func == null) {
    return;
  }
  const [funcExp] = func; // ignore type
  localStatements.push(funcExp);
}

// TODO: share logic with assign
function validateLocalVariableDeclaration(
  state: State,
  scope: Scope,
  localStatements: LocalStatement[],
  ast: ast.VariableDeclaration
): void {
  if (scope.isDeclaredInThisScope(ast.left.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.left.range, "variable", ast.left.name)
    );
    return;
  }
  let leftType = null;
  if (ast.type.$ === "PrimitiveType") {
    if (ast.type.name === "int") {
      leftType = primitives.int32Type;
    } else if (ast.type.name === "float") {
      leftType = primitives.float32Type;
    } else if (ast.type.name === "bool") {
      leftType = primitives.boolType;
    }
  }
  if (leftType == null) {
    state.errors.push(
      new Unsupported(ast.type.range, "declaring non-primitive or void type")
    );
    return;
  }
  scope.declareType(ast.left.name, leftType);

  // assign
  const lookupResult = scope.lookupType(ast.left.name)!;
  if (lookupResult == null) {
    throw new Error("Unexpected lookup not found: " + ast.left.name);
  }
  const [localGet, type] = lookupResult;
  if (
    localGet.$ === "GlobalGet" ||
    localGet.$ === "FunctionGet" ||
    localGet.$ === "ArrayGet" ||
    localGet.$ === "Int32Const" ||
    localGet.$ === "Float32Const"
  ) {
    throw new Error("unexpected " + localGet.$);
  }
  const right = validateExpression(state, scope, ast.right);
  if (leftType == null || right == null) {
    return;
  }
  const [rightExp, rightType] = right;
  if (!isTypeEqual(leftType, rightType)) {
    state.errors.push(
      new DeclareTypeMismatch(ast.type.range, leftType, rightType)
    );
    return;
  }
  if (rightType.$ === "VoidType" || rightType.$ === "FunctionType") {
    state.errors.push(
      new Unsupported(ast.right.range, "declaring " + formatType(rightType))
    );
    return;
  }
  localStatements.push(makeAssign(localGet, rightExp));
}
function validateLocalVariableDeclarationInternal(
  state: State,
  scope: Scope,
  localStatements: LocalStatement[],
  type: Int32Type | Float32Type,
  name: string,
  value: Expression
): void {
  // declare
  if (scope.isDeclaredInThisScope(name)) {
    throw new Error("already declared: " + name);
  }
  scope.declareType(name, type);
  // ...and assign
  const lookupResult = scope.lookupType(name);
  if (lookupResult == null) {
    throw new Error("Unexpected lookup not found: " + name);
  }
  const [localGet, _type] = lookupResult;
  if (
    localGet.$ === "GlobalGet" ||
    localGet.$ === "FunctionGet" ||
    localGet.$ === "ArrayGet" ||
    localGet.$ === "Int32Const" ||
    localGet.$ === "Float32Const"
  ) {
    throw new Error("unexpected " + localGet.$);
  }
  localStatements.push(makeAssign(localGet, value));
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
  // TODO
  validateLocalVariableDeclarationInternal(
    state,
    childScope,
    init,
    { $: "Int32Type" },
    "i",
    { $: "Int32Const", value: 0 }
  );
  // TODO
  validateLocalVariableDeclarationInternal(
    state,
    childScope,
    init,
    { $: "Int32Type" },
    "length",
    { $: "Int32Const", value: 128 }
  );
  for (const statement of ast.statements) {
    validateLocalStatement(state, childScope, body, statement);
  }
  const iIndex = 0; // TODO
  const lenIndex = 1; // TODO
  // increment
  body.push({
    $: "LocalSet",
    index: iIndex,
    value: {
      $: "Int32AddOp",
      left: {
        $: "LocalGet",
        index: iIndex,
        type: primitives.int32Type
      },
      right: {
        $: "Int32Const",
        value: 1
      }
    }
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
        type: primitives.int32Type
      },
      right: {
        $: "LocalGet",
        index: lenIndex,
        type: primitives.int32Type
      }
    }
  });
}

function validateReturn(
  state: State,
  scope: LocalScope,
  localStatements: LocalStatement[],
  ast: ast.Return
): void {
  const declaredReturnType = scope.lookupReturnType();
  if (declaredReturnType == null) {
    throw new Error("return type not found");
  }
  let returnExp = null;
  let returnType: ReturnType = primitives.voidType;
  if (ast.value != null) {
    const _return = validateExpression(state, scope, ast.value);
    if (_return == null) {
      return;
    }
    const [_returnExp, _returnType] = _return;
    if (
      _returnType.$ === "StringType" ||
      _returnType.$ === "FunctionType" ||
      _returnType.$ === "ArrayType"
    ) {
      state.errors.push(
        new Unsupported(ast.range, "returning non-primitive type")
      );
      return;
    }
    [returnExp, returnType] = [_returnExp, _returnType];
  }
  if (!isTypeEqual(returnType, declaredReturnType)) {
    state.errors.push(
      new ReturnTypeMismatch(ast.range, declaredReturnType.$, returnType.$)
    );
    return;
  }
  localStatements.push({
    $: "Return",
    value: returnExp
  });
}

function validateGlobalDeclarableType(
  state: State,
  ast: ast.Type
): GlobalDeclarableType | null {
  // TODO: validate ast first
  if (ast.$ !== "PrimitiveType") {
    state.errors.push(
      new Unsupported(ast.range, "declaring non-primitive type in global")
    );
    return null;
  }
  if (ast.name === "void") {
    state.errors.push(new VoidShouldNotBeDeclaredAsAVariable(ast.range));
    return null;
  }
  return validatePrimitiveType(state, ast);
}

function validatePrimitiveType(
  state: State,
  ast: ast.PrimitiveType
): Int32Type | Float32Type | VoidType | BoolType {
  if (ast.name === "int") {
    return primitives.int32Type;
  }
  if (ast.name === "float") {
    return primitives.float32Type;
  }
  if (ast.name === "void") {
    return primitives.voidType;
  }
  if (ast.name === "bool") {
    return primitives.boolType;
  }
  throw new Error("not implemented yet: " + ast.name);
}

function validateGlobalDeclaration(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.VariableDeclaration
): void {
  const type = validateGlobalDeclarableType(state, ast.type);
  if (ast.left.$ !== "Identifier") {
    state.errors.push(
      new Unsupported(ast.left.range, "declaring " + ast.left.$)
    );
    return;
  }
  if (scope.isDeclaredInThisScope(ast.left.name)) {
    state.errors.push(
      new AlreadyDeclared(ast.left.range, "variable", ast.left.name)
    );
    return;
  }
  const right = evaluateGlobalExpression(state, scope, ast.right);
  if (type == null) {
    return;
  }
  if (type.$ === "VoidType") {
    state.errors.push(new VoidShouldNotBeDeclaredAsAVariable(ast.type.range));
    return;
  }
  if (right == null) {
    return;
  }
  const [rightExp, rightType] = right;
  if (!isTypeEqual(type, rightType)) {
    state.errors.push(new DeclareTypeMismatch(ast.type.range, type, rightType));
    return;
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
    export: !ast.hasMutableFlag // by design
  });
}
function validateGlobalAssign(
  state: GlobalState,
  scope: Scope,
  ast: ast.Assign
): void {
  const assign = validateAssign(state, scope, ast);
  if (assign == null) {
    return;
  }
  if (assign.$ === "LocalSet") {
    throw new Error("unexpected LocalSet at global scope");
  }
  if (assign.$ === "GlobalSet") {
    state.globalStatements.push(assign);
    return;
  }
  throw new Error("Unreachable");
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
  if (assign.$ === "ArraySet") {
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
    const right = validateExpression(state, scope, ast.right);
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
    const right = validateExpression(state, scope, ast.right);
    if (leftType == null || right == null) {
      return null;
    }
    const [rightExp, rightType] = right;
    if (!isTypeEqual(leftType, rightType)) {
      state.errors.push(new AssignTypeMismatch(ast.range, leftType, rightType));
      return null;
    }
    return makeAssign(leftExp, rightExp);
  }

  return null;
}

function makeAssign(
  left: GetForAssign | ArrayAccess,
  right: Expression
): Assign {
  if (left.$ === "LocalGet") {
    return {
      $: "LocalSet",
      index: left.index,
      value: right
    };
  } else if (left.$ === "GlobalGet") {
    return {
      $: "GlobalSet",
      name: left.name,
      value: right
    };
  } else if (left.$ === "ArrayAccess") {
    return {
      $: "ArraySet",
      pointer: {
        byteOffset: left.byteOffset,
        itemType: left.itemType,
        name: left.name,
        index: left.index
      },
      value: right
    };
  }
  throw new Error("Unreachable");
}

function validateAssignableIdentifier(
  state: State,
  scope: Scope,
  leftAst: ast.Identifier
): [LocalGet | GlobalGet, ExpressionType] | null {
  const left = validateIdentifier(state, scope, leftAst);
  if (left == null) {
    return null;
  }
  const [leftExp, leftType] = left;
  if (leftExp.$ === "FunctionGet") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to function"));
    return null;
  }
  if (leftExp.$ === "ArrayGet") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to array"));
    return null;
  }
  if (leftExp.$ === "Int32Const" || leftExp.$ === "Float32Const") {
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
  const lookupResult = scope.lookupType(ast.name);
  if (lookupResult == null) {
    state.errors.push(new NotFound(ast.range, ast.name));
    return null;
  }
  return lookupResult;
}
function validateArrayAccess(
  state: State,
  scope: Scope,
  ast: ast.ArrayAccess
): [ArrayAccess, ItemType] | null {
  const array = validateExpression(state, scope, ast.array);
  const index = validateExpression(state, scope, ast.index);
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
    // state.errors.push(
    //   new Unsupported(ast.array.range, "accessing to non-global array")
    // );
    return null;
  }
  if (indexType.$ !== "Int32Type") {
    state.errors.push(new IndexShouldBeAnInteger(ast.index.range));
    return null;
  }
  return [
    {
      $: "ArrayAccess",
      byteOffset: arrayExp.byteOffset,
      itemType: arrayType.itemType,
      name: arrayExp.name,
      index: indexExp
    },
    arrayType.itemType
  ];
}

function validateAssignableType(
  state: State,
  scope: Scope,
  leftAst: ast.Expression,
  leftType: ExpressionType
): AssignableType | null {
  if (leftType.$ === "VoidType") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to void")); // TODO: normal error
    return null;
  }
  if (leftType.$ === "StringType") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to string"));
    return null;
  }
  if (leftType.$ === "ArrayType") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to arrray"));
    return null;
  }
  if (leftType.$ === "FunctionType") {
    state.errors.push(new Unsupported(leftAst.range, "assigning to function"));
    return null;
  }
  return leftType;
}

function validateExpression(
  state: State,
  scope: Scope,
  ast: ast.Expression
): [Expression, ExpressionType] | null {
  if (ast.$ === "IntLiteral") {
    return [
      {
        $: "Int32Const",
        value: ast.value
      },
      primitives.int32Type
    ];
  } else if (ast.$ === "FloatLiteral") {
    return [
      {
        $: "Float32Const",
        value: ast.value
      },
      primitives.float32Type
    ];
  } else if (ast.$ === "StringLiteral") {
    throw new Error("StringLiteral not implemented yet");
  } else if (ast.$ === "ArrayLiteral") {
    state.errors.push(new Unsupported(ast.range, "array literal"));
    return null;
  } else if (ast.$ === "Identifier") {
    return validateIdentifier(state, scope, ast);
  } else if (ast.$ === "ArrayAccess") {
    return validateArrayAccess(state, scope, ast);
  } else if (ast.$ === "FunctionCall") {
    const funcCall = validateFunctionCall(state, scope, ast);
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
    return validateBinOp(state, scope, ast);
  } else if (ast.$ === "CondOp") {
    return validateCondOp(state, scope, ast);
  } else {
    throw new Error("unreachable");
  }
}

function validateBinOp(
  state: State,
  scope: Scope,
  ast: ast.BinOp
): [BinOp, Int32Type | Float32Type | BoolType] | null {
  const left = validateExpression(state, scope, ast.left);
  const right = validateExpression(state, scope, ast.right);
  if (left == null || right == null) {
    return null;
  }
  const [leftExp, leftType] = left;
  const [rightExp, rightType] = right;
  const expectedCombinations = getBinOpCombination(ast.operator);
  for (const combination of expectedCombinations) {
    if (
      isTypeEqual(leftType, combination.leftType) &&
      isTypeEqual(rightType, combination.rightType)
    ) {
      return [
        {
          $: combination.kind,
          left: leftExp,
          right: rightExp
        },
        combination.returnType
      ];
    }
  }
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
function getBinOpCombination(
  kind: ast.BinOpKind
): {
  leftType: Int32Type | Float32Type;
  rightType: Int32Type | Float32Type;
  returnType: Int32Type | Float32Type | BoolType;
  kind: BinOpKind;
}[] {
  if (kind === "+") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.int32Type,
        kind: "Int32AddOp"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.float32Type,
        kind: "Float32AddOp"
      }
    ];
  }
  if (kind === "-") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.int32Type,
        kind: "Int32SubOp"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.float32Type,
        kind: "Float32SubOp"
      }
    ];
  }

  if (kind === "*") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.int32Type,
        kind: "Int32MulOp"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.float32Type,
        kind: "Float32MulOp"
      }
    ];
  }
  if (kind === "/") {
    return [
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.float32Type,
        kind: "Float32DivOp"
      }
    ];
  }
  if (kind === "%") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.int32Type,
        kind: "Int32RemOp"
      }
    ];
  }

  if (kind === "<") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.boolType,
        kind: "Int32LT"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.boolType,
        kind: "Float32LT"
      }
    ];
  }
  if (kind === "<=") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.boolType,
        kind: "Int32LE"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.boolType,
        kind: "Float32LE"
      }
    ];
  }
  if (kind === ">") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.boolType,
        kind: "Int32GT"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.boolType,
        kind: "Float32GT"
      }
    ];
  }
  if (kind === ">=") {
    return [
      {
        leftType: primitives.int32Type,
        rightType: primitives.int32Type,
        returnType: primitives.boolType,
        kind: "Int32GE"
      },
      {
        leftType: primitives.float32Type,
        rightType: primitives.float32Type,
        returnType: primitives.boolType,
        kind: "Float32GE"
      }
    ];
  }
  throw new Error("unreachable");
}

function validateCondOp(
  state: State,
  scope: Scope,
  ast: ast.CondOp
): [CondOp, ExpressionType] | null {
  const condition = validateExpression(state, scope, ast.condition);
  const ifTrue = validateExpression(state, scope, ast.ifTrue);
  const ifFalse = validateExpression(state, scope, ast.ifFalse);
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
      ifFalse: ifFalseExp
    },
    ifTrueType
  ];
}

function validateFunctionCall(
  state: State,
  scope: Scope,
  ast: ast.FunctionCall
): [Call, ReturnType] | null {
  const func = validateExpression(state, scope, ast.func);
  if (func == null) {
    return null;
  }
  const [funcExp, funcType] = func;
  if (funcExp.$ !== "FunctionGet") {
    state.errors.push(
      new Unsupported(ast.func.range, "calling arbitrary expression")
    );
    return null;
  }
  if (funcType.$ !== "FunctionType") {
    state.errors.push(new ShouldNotCallNonFunctionType(ast.range));
    return null;
  }
  const args = new Array<[Expression, ExpressionType] | null>(ast.args.length);
  const argLength = args.length;
  const paramLength = funcType.params.length;
  for (let i = 0; i < ast.args.length; i++) {
    const argAst = ast.args[i];
    const arg = validateExpression(state, scope, argAst);
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
    // TODO: ArgumentList's range
    state.errors.push(new TooFewArguments(ast.range, paramLength, argLength));
    return null;
  }
  if (args.some(a => a == null)) {
    return null;
  }

  if (funcExp.name === "float") {
    return [
      {
        $: "IntToFloatCast",
        arg: args.map(item => item![0])[0]
      },
      funcType.returnType
    ];
  }
  if (funcExp.name === "int") {
    return [
      {
        $: "FloatToIntCast",
        arg: args.map(item => item![0])[0]
      },
      funcType.returnType
    ];
  }

  return [
    {
      $: "FunctionCall",
      target: funcExp,
      args: args.map(item => item![0]),
      // params,
      returnType: funcType.returnType
    },
    funcType.returnType
  ];
}

function evaluateGlobalExpression(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.Expression
): [NumberConst, Int32Type | Float32Type] | null {
  if (ast.$ === "IntLiteral") {
    return [
      {
        $: "Int32Const",
        value: ast.value
      },
      primitives.int32Type
    ];
  } else if (ast.$ === "FloatLiteral") {
    return [
      {
        $: "Float32Const",
        value: ast.value
      },
      primitives.float32Type
    ];
  } else if (ast.$ === "StringLiteral") {
    throw new Error("StringLiteral not implemented yet");
  } else if (ast.$ === "ArrayLiteral") {
    state.errors.push(new Unsupported(ast.range, "array literal"));
    return null;
  } else if (ast.$ === "Identifier") {
    const id = validateIdentifier(state, scope, ast);
    if (id == null) {
      return null;
    }
    const [idExp, idType] = id; // TODO: compare types
    if (idExp.$ === "LocalGet") {
      throw new Error("unexpected LocalGet");
    }
    if (idExp.$ === "ArrayGet") {
      state.errors.push(new Unsupported(ast.range, "getting array in global"));
      return null;
    }
    if (idExp.$ === "FunctionGet") {
      state.errors.push(
        new Unsupported(ast.range, "getting function in global")
      );
      return null;
    }
    if (idExp.$ === "GlobalGet") {
      // TODO: this should be only happen when identifier is from imports
      state.errors.push(
        new Unsupported(ast.range, "referring undefined value in global")
      );
      return null;
    }
    if (idExp.$ === "Int32Const") {
      return [idExp, primitives.int32Type];
    }
    if (idExp.$ === "Float32Const") {
      return [idExp, primitives.float32Type];
    }
    throw new Error("maybe undeachable");
  }
  if (ast.$ === "ArrayAccess") {
    state.errors.push(
      new Unsupported(ast.range, "getting array item in global")
    );
    return null;
  }
  if (ast.$ === "FunctionCall") {
    state.errors.push(new Unsupported(ast.range, "calling in global"));
    return null;
  }
  if (ast.$ === "BinOp") {
    return evaluateGlobalBinOp(state, scope, ast);
  }
  if (ast.$ === "CondOp") {
    state.errors.push(new Unsupported(ast.range, "comparing in global"));
    return null;
  }
  throw new Error("unreachable");
}

function evaluateGlobalBinOp(
  state: GlobalState,
  scope: GlobalScope,
  ast: ast.BinOp
): [NumberConst, Int32Type | Float32Type] | null {
  const bin = validateBinOp(state, scope, ast);
  if (bin == null) {
    return null;
  }
  const left = evaluateGlobalExpression(state, scope, ast.left);
  const right = evaluateGlobalExpression(state, scope, ast.right);
  if (left == null || right == null) {
    return null;
  }
  const [leftExp, leftType] = left;
  const [rightExp, rightType] = right;
  const expectedCombinations = getBinOpCombination(ast.operator);
  for (const combination of expectedCombinations) {
    if (
      isTypeEqual(leftType, combination.leftType) &&
      isTypeEqual(rightType, combination.rightType)
    ) {
      if (combination.kind === "Int32AddOp") {
        return [
          {
            $: "Int32Const",
            value: leftExp.value + rightExp.value
          },
          primitives.int32Type
        ];
      }
      if (combination.kind === "Int32SubOp") {
        return [
          {
            $: "Int32Const",
            value: leftExp.value - rightExp.value
          },
          primitives.int32Type
        ];
      }
      if (combination.kind === "Int32MulOp") {
        return [
          {
            $: "Int32Const",
            value: leftExp.value * rightExp.value
          },
          primitives.int32Type
        ];
      }
      if (combination.kind === "Int32RemOp") {
        return [
          {
            $: "Int32Const",
            value: leftExp.value % rightExp.value
          },
          primitives.int32Type
        ];
      }
      if (combination.kind === "Float32AddOp") {
        return [
          {
            $: "Float32Const",
            value: leftExp.value + rightExp.value
          },
          primitives.float32Type
        ];
      }
      if (combination.kind === "Float32SubOp") {
        return [
          {
            $: "Float32Const",
            value: leftExp.value - rightExp.value
          },
          primitives.float32Type
        ];
      }
      if (combination.kind === "Float32MulOp") {
        return [
          {
            $: "Float32Const",
            value: leftExp.value * rightExp.value
          },
          primitives.float32Type
        ];
      }
      if (combination.kind === "Float32DivOp") {
        return [
          {
            $: "Float32Const",
            value: leftExp.value / rightExp.value
          },
          primitives.float32Type
        ];
      }
      throw new Error("unreachable");
    }
  }
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
