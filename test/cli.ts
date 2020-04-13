import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const tmpDir = path.join(__dirname, "../../tmp");
const binDir = path.join(__dirname, "../../bin/dsl");
const command = path.relative(tmpDir, binDir);

describe("CLI", function () {
  beforeEach(() => {
    fs.rmdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  });
  it("compiles dsl files", () => {
    const src = `void process() {}`;
    const filePath = path.join(tmpDir, "a.dsl");
    const outputPath = path.join(tmpDir, "a.js");
    const runtimePath = path.join(tmpDir, "_runtime.js");
    fs.writeFileSync(filePath, src);
    execSync(`${command} compile a.dsl`, { cwd: tmpDir });
    assert(fs.existsSync(outputPath));
    assert(fs.existsSync(runtimePath));
  });
  it("compiles multiple dsl files", () => {
    const src = `void process() {}`;
    const filePath1 = path.join(tmpDir, "a.dsl");
    const filePath2 = path.join(tmpDir, "b.dsl");
    const outputPath1 = path.join(tmpDir, "a.js");
    const outputPath2 = path.join(tmpDir, "a.js");
    const runtimePath = path.join(tmpDir, "_runtime.js");
    fs.writeFileSync(filePath1, src);
    fs.writeFileSync(filePath2, src);
    execSync(`${command} compile *.dsl`, { cwd: tmpDir });
    assert(fs.existsSync(outputPath1));
    assert(fs.existsSync(outputPath2));
    assert(fs.existsSync(runtimePath));
  });
  it("compiles with --outDir option", () => {
    const src = `void process() {}`;
    const filePath = path.join(tmpDir, "a.dsl");
    const outputPath = path.join(tmpDir, "js/a.js");
    const runtimePath = path.join(tmpDir, "js/_runtime.js");
    fs.writeFileSync(filePath, src);
    execSync(`${command} compile a.dsl --outDir js`, { cwd: tmpDir });
    assert(fs.existsSync(outputPath));
    assert(fs.existsSync(runtimePath));
  });
});
