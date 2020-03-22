import * as compiler from "../core/compiler";
import * as fs from "fs-extra";
import * as path from "path";
import * as log from "../core/log";

const targets: string[] = [];
const options: any = {
  outDir: null
};
for (let i = 2; i < process.argv.length; i++) {
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

const processorTemplateFile = path.resolve(
  __dirname,
  "../template/processor.js"
);
const processorTemplate = fs.readFileSync(processorTemplateFile, "utf8");

for (const srcFile of targets) {
  const srcFileBasename = path.basename(srcFile, ".dsl");
  const outFileBasename = srcFileBasename + ".js";
  const outDir = options.outDir ?? path.dirname(srcFile);
  const outFile = path.join(outDir, outFileBasename);
  if (!fs.existsSync(srcFile)) {
    console.log(`source file "${srcFile}" not found`);
    process.exit(1);
  }

  const srcString = fs.readFileSync(srcFile, "utf8");
  log.debug("source", srcString);
  const binary = compiler.textToBinary(srcString);
  const base64 = Buffer.from(binary.buffer).toString("base64");

  const moduleName = srcFileBasename;
  // const processorSourceText = processorTemplate
  //   .replace("{{RUNTIME_PATH}}", "./runtime/runtime.js")
  //   .replace("{{MODULE_NAME}}", moduleName)
  //   .replace("{{WASM_BASE64}}", base64);
  const RUNTIME_PATH = "./runtime/runtime.js";
  const MODULE_NAME = moduleName;
  const WASM_BASE64 = base64;
  const processorSourceText = `
import { register } from "${RUNTIME_PATH}";
const moduleName = "${MODULE_NAME}";
const base64 = "${WASM_BASE64}";
register(moduleName, base64);
`;
  fs.ensureDirSync(path.dirname(outFile));
  fs.writeFileSync(outFile, processorSourceText);

  console.log("compiled:", srcFile, "->", path.dirname(outFile));
}
