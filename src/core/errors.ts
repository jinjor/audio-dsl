import * as ast from "./ast";
import { AnyType, typeToString, FieldType } from "./types";
import chalk from "chalk";

export function formatType(t: AnyType): string {
  return chalk.cyan(typeToString(t));
}
function formatIdentifier(name: string): string {
  return `\`${name}\``;
}
function formatOperator(op: ast.BinOpKind): string {
  return `\`${op}\``;
}

// Errors
export type ValidationErrorType = {
  range: ast.Range | null;
  message: string;
};
export class Unlabeled implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, message: string) {
    this.message = `UNLABELED ERROR(todo): ${message}`;
  }
}
export class AlreadyDeclared implements ValidationErrorType {
  message: string;
  constructor(
    public range: ast.Range,
    kind: "variable" | "function" | "param",
    name: string
  ) {
    const n = formatIdentifier(name);
    this.message = `${kind} ${n} is already declared in this scope`;
  }
}
export class NotFound implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, name: string) {
    const n = formatIdentifier(name);
    this.message = `${n} not found`;
  }
}
export class AmbiguousName implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, name: string, modules: string[]) {
    const n = formatIdentifier(name);
    const moduleNames = modules.map(formatIdentifier).join(", ");
    this.message = `${n} is ambiguous name which is defined in multiple modules: ${moduleNames}`;
  }
}
export class InvalidTypeCombinationForBinOp implements ValidationErrorType {
  message: string;
  constructor(
    public range: ast.Range,
    kind: ast.BinOpKind,
    leftType: AnyType,
    rightType: AnyType
  ) {
    const l = formatType(leftType);
    const r = formatType(rightType);
    const op = formatOperator(kind);
    this.message = `operator ${op} cannot be applied to ${l} and ${r}`;
  }
}
export class FunctionShouldBeDeclaredInGlobal implements ValidationErrorType {
  message = "function should be declared in global scope";
  constructor(public range: ast.Range) {}
}
export class FunctionShouldNotBeCalledAtGlobalScope
  implements ValidationErrorType {
  message = "functions should not be called at global scope";
  constructor(public range: ast.Range) {}
}
export class FunctionShouldReturnValue implements ValidationErrorType {
  message = "function should return value";
  constructor(public range: ast.Range) {}
}
export class LoopShouldNotBePlacedAtGlobalScope implements ValidationErrorType {
  message = "loop should not be placed at global scope";
  constructor(public range: ast.Range) {}
}
export class ReturnShouldNotBePlacedAtGlobalScope
  implements ValidationErrorType {
  message = "return should not be placed at global scope";
  constructor(public range: ast.Range) {}
}
export class VoidShouldNotBeDeclaredAsAVariable implements ValidationErrorType {
  message = "void should not be declared as a variable";
  constructor(public range: ast.Range) {}
}
export class DeclareTypeMismatch implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, leftType: AnyType, rightType: AnyType) {
    const l = formatType(leftType);
    const r = formatType(rightType);
    this.message = r + " cannot be declared as " + l;
  }
}
export class NonAssignableType implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, leftType: AnyType) {
    const l = formatType(leftType);
    this.message = "assignable to " + l + " is not allowed";
  }
}
export class AssignTypeMismatch implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, leftType: AnyType, rightType: AnyType) {
    const l = formatType(leftType);
    const r = formatType(rightType);
    this.message = r + " is not assignable to " + l;
  }
}
export class ArgTypeMismatch implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, paramType: AnyType, argType: AnyType) {
    const p = formatType(paramType);
    const a = formatType(argType);
    this.message = "argument " + a + " is not comparible with param " + p;
  }
}
export class ReturnTypeMismatch implements ValidationErrorType {
  message: string;
  constructor(
    public range: ast.Range,
    expectedTypeName: string,
    actualTypeName: string
  ) {
    this.message =
      actualTypeName + " cannot be returned as " + expectedTypeName;
  }
}
export class ExtraArgument implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, paramLength: number, argLength: number) {
    this.message =
      "too many arguments (expected: " +
      paramLength +
      ", got: " +
      argLength +
      ")";
  }
}
export class TooFewArguments implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, paramLength: number, argLength: number) {
    this.message =
      "too few arguments (expected: " +
      paramLength +
      ", got: " +
      argLength +
      ")";
  }
}
export class InvlaidAssignTarget implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = "invalid assign target";
  }
}
export class UnknownField implements ValidationErrorType {
  message: string;
  constructor(
    public range: ast.Range,
    fieldName: string,
    expectedTypes: { name: string; type: FieldType }[]
  ) {
    this.message = "unknown field `" + fieldName + "`";
  }
}
export class MissingFields implements ValidationErrorType {
  message: string;
  constructor(
    public range: ast.Range | null,
    missingFieldNames: string[],
    expectedTypes: { name: string; type: FieldType }[]
  ) {
    this.message = "field " + missingFieldNames.join(", ") + " is missing";
  }
}
export class IndexAccessToNonArray implements ValidationErrorType {
  message = "index access is only allowed to arrays";
  constructor(public range: ast.Range | null) {}
}
export class IndexShouldBeAnInteger implements ValidationErrorType {
  message = "index should be an integer";
  constructor(public range: ast.Range | null) {}
}
export class ShouldNotCallNonFunctionType implements ValidationErrorType {
  message = "should not call non-function type";
  constructor(public range: ast.Range | null) {}
}
export class VoidShouldNotBeUsedAsAVariable implements ValidationErrorType {
  message = "void should not be used as a variable";
  constructor(public range: ast.Range | null) {}
}
export class ImportModuleNotFound implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range | null, name: string) {
    const n = formatIdentifier(name);
    this.message = `module ${n} not found`;
  }
}
export class ConditionShouldBeBool implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, conditionType: AnyType) {
    const t = formatType(conditionType);
    this.message = `expected condition to be bool, but got ${t}`;
  }
}
export class BranchesShouldReturnTheSameType implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, leftType: AnyType, rightType: AnyType) {
    const l = formatType(leftType);
    const r = formatType(rightType);
    this.message = `branches should return the same type: left = ${l}, right: ${r}`;
  }
}
export class AssigningInGlobalIsNotAllowed implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `assigning in global is not allowed`;
  }
}
export class AssigningToConstantValueIsNotAllowed
  implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `assigning to constant value is not allowed`;
  }
}
export class TheLeftHandExpressionMustBeAnIdentifier
  implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `the left-hand expression must be an identifier`;
  }
}
export class ReferringMutableValueInGlobalIsNotAllowed
  implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `referring mutable value in global is not allowed`;
  }
}
export class VoidCannotBeAnArrayItem implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `void cannot not be an array item`;
  }
}
export class DeclaringMutableArraysIsNotAllowed implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `declaring mutable arrays`;
  }
}
export class ParametersShouldBeDeclaredInGlobal implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `parameters should be declared at top level`;
  }
}
export class ParametersShouldBeFloatOrArrayOfFloat
  implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range) {
    this.message = `parameters should be either float or float[]`;
  }
}

// Unsupported (might be supported in the future)
class Unsupported implements ValidationErrorType {
  message: string;
  constructor(public range: ast.Range, what: string) {
    this.message = `${what} is not supported`;
  }
}
export class DeclaringArrayInLocalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "declaring array in local");
  }
}
export class DeclaringArrayWithInitialValueNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "declaring array with initial value");
  }
}
export class AssigningFunctionIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "assigning function");
  }
}
export class AssigningStructIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "assigning struct");
  }
}
export class AssigningArrayIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "assigning array");
  }
}
export class CallingArbitraryExpressionIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "calling arbitrary expression");
  }
}
export class ReceivingNonPrimitiveTypesIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "receiving non-primitive types");
  }
}
export class ReturningNonPrimitiveTypesIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "returning non-primitive types");
  }
}
export class CallingInGlobalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "calling in global");
  }
}
export class UsingConditionalOperatorInGlobalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "using conditional operator in global");
  }
}
export class GettingArrayItemInGlobalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "getting array item in global");
  }
}
export class ArrayLiteralIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "array literal");
  }
}
export class GettingArrayInGlobalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "getting array in global");
  }
}
export class GettingFunctionInGlobalIsNotSupported extends Unsupported {
  constructor(public range: ast.Range) {
    super(range, "getting function in global");
  }
}
