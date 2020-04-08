import { textToBinary } from "../src/core/compiler";
import { base64ToBytes } from "../runtime/common/util";
import { Instance } from "../runtime/common/module";
import { Lib, pointerToString } from "../runtime/common/lib";
import assert from "assert";

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
  it("compiles", () => {
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
param int[] wave_type {
  defaultValue = 0;
  minValue = 0;
  maxValue = 4;
}
void process() {}
void test() {}
    `;
    // TODO: case of single value
    const instance = compile(src, []);
    assert.equal(instance.numberOfParams, 2);
    assert.deepStrictEqual(instance.getNthDescriptor(0), {
      name: "note",
      defaultValue: 0,
      minValue: 0,
      maxValue: 127,
      automationRate: "a-rate",
    });
    assert.deepStrictEqual(instance.getNthDescriptor(1), {
      name: "wave_type",
      defaultValue: 0,
      minValue: 0,
      maxValue: 4,
      automationRate: "a-rate",
    });
  });
});
