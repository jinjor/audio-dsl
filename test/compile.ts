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

function createUtilForTest(callback: (value: any) => void) {
  return {
    name: "util",
    create(memory: WebAssembly.Memory): any {
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
param float[] a { defaultValue = 0.0; minValue = 0.0; maxValue = 0.0; }
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
  it("exports param info", () => {
    const src = `
param float[] note {
  defaultValue = 0.0;
  minValue = 0.0;
  maxValue = 127.0;
}
param float[] wave_type {
  defaultValue = 0.0;
  minValue = 0.0;
  maxValue = 4.0;
}
void process() {}
void test() {}
    `;
    // TODO: case of single value
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
      automationRate: "a-rate",
    });
  });
});
