import * as compiler from "../core/compiler";
import * as fs from "fs";
import * as path from "path";
import * as log from "../core/log";

const targets: string[] = [];
const options: Record<string, string | null> = {
  outDir: null,
};
for (let i = 3; i < process.argv.length; i++) {
  const s = process.argv[i];
  if (s.startsWith("--")) {
    if (++i === process.argv.length) {
      console.log(`value of ${s} not found`);
      process.exit(1);
    }
    if (s === "--outDir") {
      options.outDir = process.argv[i];
    } else {
      console.log("unknown option:", s);
      process.exit(1);
    }
  } else {
    targets.push(s);
  }
}

log.debug("targets:", targets);
log.debug("options:", options);

function getCommonDir(targets: string[]): string {
  const pathPartsList = targets.map((p) => path.resolve(p).split(path.sep));
  const commonPathParts = [];
  loop: for (let i = 0; ; i++) {
    let part = null;
    for (const pathParts of pathPartsList) {
      part = part ?? pathParts[i];
      if (pathParts[i] == null || pathParts[i] !== part) {
        break loop;
      }
    }
    commonPathParts.push(part);
  }
  const commonPath = commonPathParts.join(path.sep);
  if (fs.statSync(commonPath).isDirectory()) {
    return commonPath;
  }
  return path.dirname(commonPath);
}

const commonDir = getCommonDir(targets);
const outDir = options.outDir ?? commonDir;

for (const srcFile of targets) {
  const srcFileBasename = path.basename(srcFile, ".dsl");
  const srcFileDirname = path.dirname(srcFile);
  const outFileBasename = srcFileBasename + ".mjs";
  const srcDirRelPath = path.relative(commonDir, srcFileDirname);
  const commonDirFromSrc = path.relative(srcFileDirname, commonDir);

  const outFile = path.join(outDir, srcDirRelPath, outFileBasename);
  if (!fs.existsSync(srcFile)) {
    console.log(`source file "${srcFile}" not found`);
    process.exit(1);
  }

  const srcString = fs.readFileSync(srcFile, "utf8");
  log.debug("source", srcString);
  const binary = compiler.textToBinary(srcString);
  const base64 = Buffer.from(binary.buffer).toString("base64");

  const moduleName = srcFileBasename;
  const RUNTIME_PATH = path.join(commonDirFromSrc, "_runtime.mjs");
  const MODULE_NAME = moduleName;
  const WASM_BASE64 = base64;
  const processorSourceText = `
import { register } from "./${RUNTIME_PATH}";
const moduleName = "${MODULE_NAME}";
const base64 = "${WASM_BASE64}";
register(moduleName, base64);
`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, processorSourceText);

  const runtimeOutputFile = path.join(outDir, RUNTIME_PATH);
  const runtimeSourceFile = path.join(__dirname, "../../runtime.mjs");
  fs.copyFileSync(runtimeSourceFile, runtimeOutputFile);

  console.log("compiled:", srcFile, "->", outFile);
}
