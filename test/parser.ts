import assert from "assert";
import * as ast from "../src/core/ast";
import { parseExpression, parseStatement } from "../src/core/parser";

function deleteRange(a: any): void {
  if (a == null) {
    return;
  }
  if (typeof a !== "object") {
    return;
  }
  if (Array.isArray(a)) {
    for (let item of a) {
      deleteRange(item);
    }
    return;
  }
  delete a["range"];
  for (let key in a) {
    deleteRange(a[key]);
  }
}

function deepEq<T, T2 = Exclude<T, "range">>(a: T, b: T2) {
  deleteRange(a);
  assert.deepStrictEqual(a, b);
}

describe("Parser", function () {
  it("literal", () => {
    deepEq(parseExpression("0"), { $: "IntLiteral", value: 0 });
    deepEq(parseExpression("10"), { $: "IntLiteral", value: 10 });
    deepEq(parseExpression("-1"), { $: "IntLiteral", value: -1 });
    deepEq(parseExpression("1.1"), { $: "FloatLiteral", value: 1.1 });
    deepEq(parseExpression("10.9"), { $: "FloatLiteral", value: 10.9 });
    deepEq(parseExpression("-5.5"), { $: "FloatLiteral", value: -5.5 });
    deepEq(parseExpression(`""`), { $: "StringLiteral", value: "" });
    deepEq(parseExpression(`"\t"`), { $: "StringLiteral", value: "\t" });
  });
  it("array access, function call", () => {
    deepEq(parseExpression("a [1]"), {
      $: "ArrayAccess",
      array: { $: "Identifier", name: "a" },
      index: { $: "IntLiteral", value: 1 },
    });
    deepEq(parseExpression("a()"), {
      $: "FunctionCall",
      func: { $: "Identifier", name: "a" },
      args: {
        $: "FunctionArguments",
        values: [],
      },
    });
    deepEq(parseExpression("a ( 1 )"), {
      $: "FunctionCall",
      func: { $: "Identifier", name: "a" },
      args: {
        $: "FunctionArguments",
        values: [{ $: "IntLiteral", value: 1 }],
      },
    });
    deepEq(parseExpression("a () [ 1 ] "), {
      $: "ArrayAccess",
      array: {
        $: "FunctionCall",
        func: { $: "Identifier", name: "a" },
        args: {
          $: "FunctionArguments",
          values: [],
        },
      },
      index: { $: "IntLiteral", value: 1 },
    });
    deepEq(parseExpression("(a + b)()[1]"), {
      $: "ArrayAccess",
      array: {
        $: "FunctionCall",
        func: {
          $: "BinOp",
          operator: "+",
          left: { $: "Identifier", name: "a" },
          right: { $: "Identifier", name: "b" },
        },
        args: {
          $: "FunctionArguments",
          values: [],
        },
      },
      index: { $: "IntLiteral", value: 1 },
    });
  });
  it("op", () => {
    deepEq(parseExpression(`( 1 )`), { $: "IntLiteral", value: 1 });
    deepEq(parseExpression(`1 * 2 / 3`), {
      $: "BinOp",
      operator: "/",
      left: {
        $: "BinOp",
        operator: "*",
        left: { $: "IntLiteral", value: 1 },
        right: { $: "IntLiteral", value: 2 },
      },
      right: { $: "IntLiteral", value: 3 },
    });
    deepEq(parseExpression(`1 + 2 * 3`), {
      $: "BinOp",
      operator: "+",
      left: { $: "IntLiteral", value: 1 },
      right: {
        $: "BinOp",
        operator: "*",
        left: { $: "IntLiteral", value: 2 },
        right: { $: "IntLiteral", value: 3 },
      },
    });
    deepEq(parseExpression(`1 * ( 2 + 3 )`), {
      $: "BinOp",
      operator: "*",
      left: { $: "IntLiteral", value: 1 },
      right: {
        $: "BinOp",
        operator: "+",
        left: { $: "IntLiteral", value: 2 },
        right: { $: "IntLiteral", value: 3 },
      },
    });
    deepEq(parseExpression(`1 + 2 > 3`), {
      $: "BinOp",
      operator: ">",
      left: {
        $: "BinOp",
        operator: "+",
        left: { $: "IntLiteral", value: 1 },
        right: { $: "IntLiteral", value: 2 },
      },
      right: { $: "IntLiteral", value: 3 },
    });
    deepEq(parseExpression(`1 >= 2 + 3`), {
      $: "BinOp",
      operator: ">=",
      left: { $: "IntLiteral", value: 1 },
      right: {
        $: "BinOp",
        operator: "+",
        left: { $: "IntLiteral", value: 2 },
        right: { $: "IntLiteral", value: 3 },
      },
    });
    deepEq(parseExpression(`( 1 < 2 ) + 3`), {
      $: "BinOp",
      operator: "+",
      left: {
        $: "BinOp",
        operator: "<",
        left: { $: "IntLiteral", value: 1 },
        right: { $: "IntLiteral", value: 2 },
      },
      right: { $: "IntLiteral", value: 3 },
    });
    deepEq(parseExpression(`1 <= 2 ? 3 : 4`), {
      $: "CondOp",
      condition: {
        $: "BinOp",
        operator: "<=",
        left: { $: "IntLiteral", value: 1 },
        right: { $: "IntLiteral", value: 2 },
      },
      ifTrue: { $: "IntLiteral", value: 3 },
      ifFalse: { $: "IntLiteral", value: 4 },
    });
    deepEq(parseExpression(`1 ? 2 : 3 ? 4 ? 5 : 6 : 7 ? 8 : 9`), {
      $: "CondOp",
      condition: { $: "IntLiteral", value: 1 },
      ifTrue: { $: "IntLiteral", value: 2 },
      ifFalse: {
        $: "CondOp",
        condition: { $: "IntLiteral", value: 3 },
        ifTrue: {
          $: "CondOp",
          condition: { $: "IntLiteral", value: 4 },
          ifTrue: { $: "IntLiteral", value: 5 },
          ifFalse: { $: "IntLiteral", value: 6 },
        },
        ifFalse: {
          $: "CondOp",
          condition: { $: "IntLiteral", value: 7 },
          ifTrue: { $: "IntLiteral", value: 8 },
          ifFalse: { $: "IntLiteral", value: 9 },
        },
      },
    });
  });
  it("variable declaration", () => {
    deepEq(parseStatement(`int a = 1;`), {
      $: "VariableDeclaration",
      type: {
        $: "PrimitiveType",
        name: { $: "PrimitiveTypeName", kind: "int" },
      },
      left: { $: "Identifier", name: "a" },
      right: { $: "IntLiteral", value: 1 },
      hasMutableFlag: false,
    });
    deepEq(parseStatement(`int [ ] a = 1;`), {
      $: "VariableDeclaration",
      type: {
        $: "ArrayType",
        type: {
          $: "PrimitiveType",
          name: { $: "PrimitiveTypeName", kind: "int" },
        },
      },
      left: { $: "Identifier", name: "a" },
      right: { $: "IntLiteral", value: 1 },
      hasMutableFlag: false,
    });
    deepEq(parseStatement(`var int a = 1;`), {
      $: "VariableDeclaration",
      type: {
        $: "PrimitiveType",
        name: { $: "PrimitiveTypeName", kind: "int" },
      },
      left: { $: "Identifier", name: "a" },
      right: { $: "IntLiteral", value: 1 },
      hasMutableFlag: true,
    });
  });
  it("loop", () => {
    deepEq(parseStatement(`loop { }`), {
      $: "Loop",
      statements: [],
    });
    deepEq(parseStatement(`loop { return; }`), {
      $: "Loop",
      statements: [
        {
          $: "Return",
          value: null,
        },
      ],
    });
  });
  it("return", () => {
    deepEq(parseStatement(`return;`), {
      $: "Return",
      value: null,
    });
    deepEq(parseStatement(`return 1;`), {
      $: "Return",
      value: { $: "IntLiteral", value: 1 },
    });
  });
  it("function declaration", () => {
    deepEq(parseStatement(`int a ( ) { }`), {
      $: "FunctionDeclaration",
      name: { $: "Identifier", name: "a" },
      params: {
        $: "ParamList",
        items: [],
      },
      returnType: {
        $: "PrimitiveType",
        name: { $: "PrimitiveTypeName", kind: "int" },
      },
      statements: [],
    });
    deepEq(parseStatement(`void ab ( int a, float b ) { return; }`), {
      $: "FunctionDeclaration",
      name: { $: "Identifier", name: "ab" },
      params: {
        $: "ParamList",
        items: [
          {
            $: "Param",
            type: {
              $: "PrimitiveType",
              name: { $: "PrimitiveTypeName", kind: "int" },
            },
            name: "a",
          },
          {
            $: "Param",
            type: {
              $: "PrimitiveType",
              name: { $: "PrimitiveTypeName", kind: "float" },
            },
            name: "b",
          },
        ],
      },
      returnType: {
        $: "PrimitiveType",
        name: { $: "PrimitiveTypeName", kind: "void" },
      },
      statements: [
        {
          $: "Return",
          value: null,
        },
      ],
    });
  });
});
