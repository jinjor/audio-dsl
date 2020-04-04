import assert from "assert";
import { parse } from "../src/core/parser";
import { validate } from "../src/core/validate";

import { mathModule, utilModule } from "../src/core/lib";
import { builtInModule } from "../src/core//builtin";
import { ModuleHeader } from "../src/core//types";
import * as errors from "../src/core/errors";

const moduleCache = new Map<string, ModuleHeader>();
moduleCache.set("builtin", builtInModule);
moduleCache.set("math", mathModule);
moduleCache.set("util", utilModule);

function assertOk(src: string) {
  const ast = parse(src);
  const result = validate(ast, moduleCache);
  if (result.errors.length > 0) {
    console.log("unexpected errors");
    console.log(src);
    console.log(result.errors);
    assert.fail();
  }
}
function assertErrorExists(src: string, expectedError?: any) {
  const ast = parse(src);
  const result = validate(ast, moduleCache);
  if (result.errors.length === 0) {
    console.log("unexpected no error");
    console.log(src);
    assert.fail();
  }
  if (expectedError != null) {
    for (const e of result.errors) {
      if (e instanceof expectedError) {
        return;
      }
    }
    console.log("expected error not found");
    console.log(src);
    console.log("expected: " + expectedError);
    console.log("errors: " + result.errors.map((e) => e.message).join(", "));
    assert.fail();
  }
}

describe("Validate", function () {
  it("global variable declaration", () => {
    assertOk(`int a = 0;`);
    assertOk(`float a = 0.0;`);
    assertOk(`bool a = 1 > 0;`);
    assertOk(`var int a = 0;`);
    assertOk(`int a;`);
    assertOk(`var int a;`);
    assertErrorExists(`int a = 0.0;`);
    assertErrorExists(`float a = 0;`);
    assertErrorExists(`void a = 0;`);
    assertErrorExists(`bool a = 0;`);
    assertErrorExists(`int a = 0; int a = 1;`);
    assertErrorExists(`var int[] a;`);
    assertErrorExists(`void[] a;`);
    assertErrorExists(`var void[] a;`);
    // assertErrorExists(`string[] a;`);
    // assertErrorExists(`var string[] a;`);
  });
  it("function declaration", () => {
    assertOk(`void f() {}`);
    assertOk(`void f() { return; }`);
    assertOk(`int f() { return 1; }`);
    assertOk(`int f(int a) { return a; }`);
    assertOk(`bool f(bool a) { return a; }`);
    assertOk(`void f() {} void g() {}`);
    assertErrorExists(`int f() { }`);
    assertErrorExists(`int f() { return; }`);
    assertErrorExists(`int f() { return 0.0; }`);
    assertErrorExists(`void f() { return 1; }`);
    assertErrorExists(`void f(int a) { return a; }`);
    assertErrorExists(`float f(int a) { return a; }`);
    assertErrorExists(`bool f(int a) { return a; }`);
    assertErrorExists(`int f(bool a) { return a; }`);
    assertErrorExists(`void f(void a) {}`);
    assertErrorExists(`void f() {} void f() {}`);
    assertErrorExists(`void f() { return f; }`);
    assertErrorExists(`int[] f() { return f; }`);
    assertErrorExists(`int f() { return 1 > 0; }`);
    assertErrorExists(`int f() { return ""; }`);
    // assertErrorExists(`string f() { return f; }`);
  });
  it("global assign", () => {
    assertErrorExists(`int a = 0; a = 1;`);
    assertErrorExists(`var int a = 0; a = 1;`);
    assertErrorExists(`void f() {} f = 1;`);
  });
  it("static evaluation", () => {
    assertOk(`int a = 0; int b = a;`);
    assertOk(`int a = 0; var int b = a;`);
    assertOk(`int a = 0; int b = a + a;`);
    assertOk(`int a = 0; bool b = 1 > a;`);
    assertErrorExists(`int a = 0; float b = float(a);`); // maybe need a static function
    assertErrorExists(`var int a = 0; int b = a;`);
    assertErrorExists(`var int a = 0; var int b = a;`);
    assertErrorExists(`int a = 0; int b = float(a);`);
    assertErrorExists(`var int a = 0; bool b = 1 > a;`);
  });
  it("op (+)", () => {
    assertOk(`int a = 0 + 0;`);
    assertOk(`float a = 0.0 + 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 + 0.0;`);
    assertErrorExists(`float a = 0 + 0;`);
    // wrong combination
    assertErrorExists(`float a = 0 + 0.0;`);
    assertErrorExists(`float a = 0.0 + 0;`);
  });
  it("op (-)", () => {
    assertOk(`int a = 0 - 0;`);
    assertOk(`float a = 0.0 - 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 - 0.0;`);
    assertErrorExists(`float a = 0 - 0;`);
    // wrong combination
    assertErrorExists(`float a = 0 - 0.0;`);
    assertErrorExists(`float a = 0.0 - 0;`);
  });
  it("op (*)", () => {
    assertOk(`int a = 0 * 0;`);
    assertOk(`float a = 0.0 * 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 * 0.0;`);
    assertErrorExists(`float a = 0 * 0;`);
    // wrong combination
    assertErrorExists(`float a = 0 * 0.0;`);
    assertErrorExists(`float a = 0.0 * 0;`);
  });
  it("op (/)", () => {
    assertOk(`float a = 0.0 / 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 / 0.0;`);
    // wrong combination
    assertErrorExists(`float a = 0 / 0;`);
    assertErrorExists(`float a = 0 / 0.0;`);
    assertErrorExists(`float a = 0.0 / 0;`);
  });
  it("op (%)", () => {
    assertOk(`int a = 0 % 0;`);
    // wrong return type
    assertErrorExists(`float a = 0 % 0;`);
    // wrong combination
    assertErrorExists(`float a = 0 % 0.0;`);
    assertErrorExists(`float a = 0.0 % 0;`);
    assertErrorExists(`float a = 0.0 % 0.0;`);
  });
  it("op (>)", () => {
    assertOk(`bool a = 0 > 0;`);
    assertOk(`bool a = 0.0 > 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 > 0.0;`);
    // wrong combination
    assertErrorExists(`bool a = 0 > 0.0;`);
    assertErrorExists(`bool a = 0.0 > 0;`);
  });
  it("op (>=)", () => {
    assertOk(`bool a = 0 >= 0;`);
    assertOk(`bool a = 0.0 >= 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 >= 0.0;`);
    // wrong combination
    assertErrorExists(`bool a = 0 >= 0.0;`);
    assertErrorExists(`bool a = 0.0 >= 0;`);
  });
  it("op (<)", () => {
    assertOk(`bool a = 0 < 0;`);
    assertOk(`bool a = 0.0 < 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 < 0.0;`);
    // wrong combination
    assertErrorExists(`bool a = 0 < 0.0;`);
    assertErrorExists(`bool a = 0.0 < 0;`);
  });
  it("op (<=)", () => {
    assertOk(`bool a = 0 <= 0;`);
    assertOk(`bool a = 0.0 <= 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 <= 0.0;`);
    // wrong combination
    assertErrorExists(`bool a = 0 <= 0.0;`);
    assertErrorExists(`bool a = 0.0 <= 0;`);
  });
  it.skip("op (?)", () => {
    assertOk(`int a = 1 > 0 ? 1 : 0;`);
    assertOk(`float a = 1 > 0 ? 1.0 : 0.0;`);
    assertOk(`int a = 1.0 > 0.0 ? 1 : 0;`);
    assertOk(`float a = 1.0 > 0.0 ? 1.0 : 0.0;`);
    assertErrorExists(`int a = 1 > 0 ? 1 : 0.0;`);
    assertErrorExists(`int a = 1 > 0 ? 1.0 : 0;`);
    assertErrorExists(`int a = 1 > 0 ? 1.0 : 0.0;`);
    assertErrorExists(`float a = 1 > 0 ? 1 : 0.0;`);
    assertErrorExists(`float a = 1 > 0 ? 1.0 : 0;`);
    assertErrorExists(`float a = 1 > 0 ? 1 : 0;`);
  });
  it("string", () => {
    assertErrorExists(`int a = "";`);
    assertErrorExists(`float a = "";`);
    assertErrorExists(`int a = 1 + "";`);
    assertErrorExists(`int a = "" + 1;`);
    assertErrorExists(`int a = "" + "";`);
    assertErrorExists(`bool a = "" > "";`);
  });
  it("loop", () => {
    assertOk(`void f() { loop { } }`);
    assertOk(`void f(int i, int length) { loop { } }`);
    assertOk(`void f(float i, float length) { loop { } }`);
    assertOk(`void f() { int i; int length; loop { } }`);
    assertOk(`void f() { float i; float length; loop { } }`);
    assertOk(`void f() { int a = 0; loop { a = i; a = length; } }`);
    assertOk(`void f() { loop { i = 0; } }`);
    assertErrorExists(`loop {}`);
    assertErrorExists(`void f() { loop { int i = 0; } }`);
    assertErrorExists(`void f() { loop { int length = 0; } }`);
    assertErrorExists(`void f() { loop { float i = 0.0; } }`);
    assertErrorExists(`void f() { loop { float length = 0.0; } }`);
    assertErrorExists(`void f() { loop { i = 0.0; } }`);
    assertErrorExists(`void f() { loop { i = ""; } }`);
    // TODO
    // assertErrorExists(`void f() { loop { return; } }`);
    // TODO
    // assertErrorExists(`void f() { loop { loop { } } }`);
  });
  it("param", () => {
    assertOk(`param int a { defaultValue = 0; minValue = 0; maxValue = 0; }`);
    assertOk(`param int a { defaultValue = 1; minValue = 0; maxValue = -1; }`); // this is allowed for now
    assertOk(
      `param float a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }`
    );
    assertOk(`param int[] a { defaultValue = 0; minValue = 0; maxValue = 0; }`);
    assertOk(
      `param float[] a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }`
    );
    assertOk(
      `int foo = 1; param int a { defaultValue = 0 + 0; minValue = foo; maxValue = foo * 2; }`
    );
    assertOk(
      `int defaultValue = 1; param int a { defaultValue = 0; minValue = 0; maxValue = 0; }`
    );
    assertOk(
      `var int defaultValue = 1; param int a { defaultValue = 0; minValue = 0; maxValue = 0; }`
    );
    // TODO
    // assertOk(
    //   `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } void f() { a = 1; }`
    // );
    // TODO
    // assertOk(
    //   `param float a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; } void f() { a = 1.0; }`
    // );
    assertOk(
      `param int[] a { defaultValue = 0; minValue = 0; maxValue = 0; } void f() { a[0] = 1; }`
    );
    assertOk(
      `param float[] a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; } void f() { a[0] = 1.0; }`
    );
    assertErrorExists(`param int a { defaultValue = 0; minValue = 0; }`);
    assertErrorExists(
      `param int a { defaultValue = 0; minValue = 0; maxValue = 0; unknown = 0; }`
    );
    assertErrorExists(
      `param int a { defaultValue = 0.0; minValue = 0; maxValue = 0; }`
    );
    assertErrorExists(
      `param int a { defaultValue = 0; minValue = 0.0; maxValue = 0; }`
    );
    assertErrorExists(
      `param int a { defaultValue = 0; minValue = 0; maxValue = 0.0; }`
    );
    assertErrorExists(
      `param int[] a { defaultValue = 0.0; minValue = 0; maxValue = 0; }`
    );
    assertErrorExists(
      `param int[] a { defaultValue = 0; minValue = 0.0; maxValue = 0; }`
    );
    assertErrorExists(
      `param int[] a { defaultValue = 0; minValue = 0; maxValue = 0.0; }`
    );
    assertErrorExists(
      `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } void f () { a = 1.0; }`
    );
    assertErrorExists(
      `param int[] a { defaultValue = 0; minValue = 0; maxValue = 0; } void f () { a = 1; }`
    );
    assertErrorExists(
      `int a = 1; param int a { defaultValue = 0; minValue = 0; maxValue = 0; }`
    );
    assertErrorExists(
      `var int foo = 1; param int a { defaultValue = foo; minValue = 0; maxValue = 0; }`
    );
    // TODO
    // assertErrorExists(
    //   `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } a = 1`
    // );
    // TODO
    // assertErrorExists(
    //   `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } int a = 1;`
    // );
    // TODO
    // assertErrorExists(
    //   `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } var int a = 1;`
    // );
    // TODO
    // assertErrorExists(
    //   `param int a { defaultValue = 0; minValue = 0; maxValue = 0; } void a () {}`
    // );
  });
});
