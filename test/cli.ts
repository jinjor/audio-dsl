import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

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
    const outputPath = path.join(tmpDir, "a.mjs");
    const runtimePath = path.join(tmpDir, "_runtime.mjs");
    fs.writeFileSync(filePath, src);
    spawnSync(command, ["compile", "a.dsl"], { cwd: tmpDir, stdio: "inherit" });
    assert(fs.existsSync(outputPath));
    assert(fs.existsSync(runtimePath));
  });
  it("compiles multiple dsl files", () => {
    const src = `void process() {}`;
    const filePath1 = path.join(tmpDir, "a.dsl");
    const filePath2 = path.join(tmpDir, "b.dsl");
    const outputPath1 = path.join(tmpDir, "a.mjs");
    const outputPath2 = path.join(tmpDir, "b.mjs");
    const runtimePath = path.join(tmpDir, "_runtime.mjs");
    fs.writeFileSync(filePath1, src);
    fs.writeFileSync(filePath2, src);
    spawnSync(command, ["compile", "*.dsl"], {
      cwd: tmpDir,
      shell: true,
      stdio: "inherit",
    });
    assert(fs.existsSync(outputPath1));
    assert(fs.existsSync(outputPath2));
    assert(fs.existsSync(runtimePath));
  });
  it("compiles with --outDir option", () => {
    const src = `void process() {}`;
    const filePath = path.join(tmpDir, "a.dsl");
    const outputPath = path.join(tmpDir, "js/a.mjs");
    const runtimePath = path.join(tmpDir, "js/_runtime.mjs");
    fs.writeFileSync(filePath, src);
    spawnSync(command, ["compile", "a.dsl", "--outDir", "js"], {
      cwd: tmpDir,
      stdio: "inherit",
    });
    assert(fs.existsSync(outputPath));
    assert(fs.existsSync(runtimePath));
  });
  it("compiles files in complex paths", () => {
    const src = `void process() {}`;
    const filePath1 = path.join(tmpDir, "a.dsl");
    const filePath2 = path.join(tmpDir, "lib/a.dsl");
    const outputPath1 = path.join(tmpDir, "js/a.mjs");
    const outputPath2 = path.join(tmpDir, "js/lib/a.mjs");
    const runtimePath = path.join(tmpDir, "js/_runtime.mjs");
    const wrongRuntimePath = path.join(tmpDir, "js/lib/_runtime.mjs");
    fs.mkdirSync(path.join(tmpDir, "lib"), { recursive: true });
    fs.writeFileSync(filePath1, src);
    fs.writeFileSync(filePath2, src);
    spawnSync(command, ["compile", "a.dsl", "lib/a.dsl", "--outDir", "js"], {
      cwd: tmpDir,
      stdio: "inherit",
    });
    assert(fs.existsSync(outputPath1));
    assert(fs.existsSync(outputPath2));
    assert(fs.existsSync(runtimePath));
    assert(!fs.existsSync(wrongRuntimePath));
  });
});
