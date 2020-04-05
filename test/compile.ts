import { textToBinary } from "../src/core/compiler";
import { base64ToBytes } from "../runtime/common/util";
import { Instance } from "../runtime/common/module";
import { util, math } from "../runtime/common/lib";
import assert from "assert";

function compile(src: string) {
  const binary = textToBinary(src);
  const base64 = Buffer.from(binary.buffer).toString("base64");
  const bytes = base64ToBytes(base64);
  const libs = [util, math];
  return Instance.create(bytes, libs);
}

describe("Compile", function () {
  it("compiles", () => {
    const src = `
void process() {}
void test() {
  log_s("Hello, World!");
  log_i(1);
  log_f(1.0);
  log_b(1 > 0);
}
    `;
    compile(src);
  });
});
