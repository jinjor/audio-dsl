import assert from "assert";
import { parse } from "../src/core/parser";
import { validate } from "../src/core/validate";

import { mathModule, utilModule } from "../src/core/lib";
import { builtInModule } from "../src/core//builtin";
import { ModuleHeader } from "../src/core//types";

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
function assertErrorExists(src: string) {
  const ast = parse(src);
  const result = validate(ast, moduleCache);
  if (result.errors.length === 0) {
    console.log("unexpected no error");
    console.log(src);
    assert.fail();
  }
}

describe("Validate", function() {
  it("global variable declaration", () => {
    assertOk(`int a = 0;`);
    assertOk(`float a = 0.0;`);
    assertOk(`var int a = 0;`);
    assertErrorExists(`int a = 0.0;`);
    assertErrorExists(`float a = 0;`);
    assertErrorExists(`void a = 0;`);
    assertErrorExists(`bool a = 0;`);
    assertErrorExists(`int a = 0; int a = 1;`);
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
    assertErrorExists(`void f(void a) {}`);
    assertErrorExists(`void f() {} void f() {}`);
    assertErrorExists(`void f() { return f; }`);
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
    assertErrorExists(`int a = 0; float b = float(a);`); // maybe need a static function
    assertErrorExists(`var int a = 0; int b = a;`);
    assertErrorExists(`var int a = 0; var int b = a;`);
    assertErrorExists(`int a = 0; int b = float(a);`);
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
  it.skip("op (>)", () => {
    assertOk(`bool a = 0 > 0;`);
    assertOk(`bool a = 0.0 > 0.0;`);
    // wrong return type
    assertErrorExists(`int a = 0.0 > 0.0;`);
    // wrong combination
    assertErrorExists(`bool a = 0 > 0.0;`);
    assertErrorExists(`bool a = 0.0 > 0;`);
  });
  it.skip("op (>=)", () => {});
  it.skip("op (<)", () => {});
  it.skip("op (<=)", () => {});
});
