import { textToBinary } from "../src/core/compiler";
import { Instance, createImportObject } from "../runtime/common/module";
import { Lib, pointerToString } from "../runtime/common/lib";
import assert from "assert";
import { LanguageSpecificInstance } from "../runtime/common/definition";
import { base64ToBytes } from "../runtime/common/util";

function compile(src: string, libs: Lib[]) {
  const binary = textToBinary(src);
  const base64 = Buffer.from(binary.buffer).toString("base64");
  const bytes = base64ToBytes(base64);
  return Instance.create(bytes, libs);
}

function createUtilForTest(callback: (value: any) => void): Lib {
  return {
    name: "util",
    create(memory: WebAssembly.Memory): Record<string, Function> {
      return {
        log_i: callback,
        log_f: callback,
        log_b: function (bool: number) {
          callback(bool > 0);
        },
        log_s: function (pointer: number) {
          callback(pointerToString(memory, pointer));
        },
      };
    },
  };
}

describe("Compile", function () {
  it("exports memory layout", () => {
    const src = `
param float a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }
param float[] b { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }
void process() {}
void test() {}
    `;
    const binary = textToBinary(src);
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    const mod = new WebAssembly.Module(binary);
    const importObject = createImportObject(memory, []);
    const instance = new WebAssembly.Instance(
      mod,
      importObject
    ) as LanguageSpecificInstance;
    const exports = instance.exports;
    assert.equal(
      exports.pointer_of_in_channels!.value +
        4 * 128 * exports.number_of_in_channels.value,
      exports.pointer_of_out_channels
    );
    assert.equal(
      exports.pointer_of_out_channels!.value +
        4 * 128 * exports.number_of_out_channels.value,
      exports.pointer_of_params
    );
    assert.notEqual(exports.size_of_static_data, undefined);
  });
  it("compiles", () => {
    const src = `
void process() {}
void test() {}
    `;
    const instance = compile(src, []);
    assert.equal(instance.numberOfInChannels, 2);
    assert.equal(instance.numberOfOutChannels, 2);
    assert.equal(instance.numberOfParams, 0);
  });
  it("logs values", () => {
    const src = `
void process() {}
void test() {
  log_i(1);
  log_i(-1);
  log_f(2.0);
  log_f(-2.0);
  log_b(2 > 1);
  log_b(2 < 1);
  log_s("Hello");
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [1, -1, 2.0, -2.0, true, false, "Hello"]);
  });
  it("handles global variables", () => {
    const src = `
var int i = 1;
var float f = 2.0;
var bool b = 1 > 0;
param float p1 { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }
param float[] p2 { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }
void process() {}
void test() {
  p1 = 3.0;
  p2[0] = 4.0;
  log_i(i);
  log_f(f);
  log_b(b);
  log_f(p1);
  log_f(p2[0]);
  i = 5;
  f = 6.0;
  b = 1 < 0;
  log_i(i);
  log_f(f);
  log_b(b);
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [1, 2, true, 3, 4, 5, 6, false]);
  });
  it("handles local variables", () => {
    const src = `
void process() {}
void test() {
  int i = 1;
  float f = 2.0;
  bool b = 1 > 0;
  log_i(i);
  log_f(f);
  log_b(b);
  i = 5;
  f = 6.0;
  b = 1 < 0;
  log_i(i);
  log_f(f);
  log_b(b);
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [1, 2, true, 5, 6, false]);
  });
  it("calculates with bin ops", () => {
    const src = `
void process() {}
void test() {
  log_i(1 + 2);
  log_i(1 - 2);
  log_i(1 * 2);
  log_i(1 % 2);
  log_f(1.0 + 2.0);
  log_f(1.0 - 2.0);
  log_f(1.0 * 2.0);
  log_f(1.0 / 2.0);
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [3, -1, 2, 1, 3, -1, 2, 0.5]);
  });
  it("compare with bin ops", () => {
    const src = `
void process() {}
void test() {
  log_b(2 > 1);
  log_b(1 > 1);
  log_b(2 >= 1);
  log_b(1 >= 1);
  log_b(1 < 2);
  log_b(1 < 1);
  log_b(1 <= 2);
  log_b(1 <= 1);
  log_b(2 == 1);
  log_b(1 == 1);
  log_b(2 != 1);
  log_b(1 != 1);
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [
      true,
      false,
      true,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      false,
    ]);
  });
  it("calculates with built-in functions", () => {
    const src = `
void process() {}
void test() {
  log_f(to_float(1));
  log_i(to_int(1.0));
  log_f(ceil(1.5));
  log_f(ceil(-1.5));
  log_f(floor(1.5));
  log_f(floor(-1.5));
  log_f(trunc(1.5));
  log_f(trunc(-1.5));
  log_f(nearest(1.5));
  log_f(nearest(-1.5));
  log_f(sqrt(9.0));
  log_f(max(1.0, 2.0));
  log_f(min(1.0, 2.0));
}
    `;
    const output: any[] = [];
    const util = createUtilForTest((value: any) => {
      output.push(value);
    });
    compile(src, [util]);
    assert.deepStrictEqual(output, [1, 1, 2, -1, 1, -2, 1, -1, 2, -2, 3, 2, 1]);
  });
  it("exports param info", () => {
    const src = `
param float[] note {
  defaultValue = 0.0;
  minValue = 0.0;
  maxValue = 127.0;
}
param float wave_type {
  defaultValue = 0.0;
  minValue = 0.0;
  maxValue = 4.0;
}
void process() {}
void test() {}
    `;
    const instance = compile(src, []);
    assert.equal(instance.numberOfParams, 2);
    assert.deepStrictEqual(instance.getNthParamInfo(0)?.descriptor, {
      name: "note",
      defaultValue: 0,
      minValue: 0,
      maxValue: 127,
      automationRate: "a-rate",
    });
    assert.deepStrictEqual(instance.getNthParamInfo(1)?.descriptor, {
      name: "wave_type",
      defaultValue: 0,
      minValue: 0,
      maxValue: 4,
      automationRate: "k-rate",
    });
  });
});
