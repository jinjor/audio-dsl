import * as log from "./log";
import { Module } from "./generator";
import { parse } from "./parser";
import { validate } from "./validate";
import * as util from "util";
import { Reporter } from "./reporter";
import { mathModule, utilModule } from "./lib";
import { builtInModule } from "./builtin";
import { ModuleHeader } from "./types";

const moduleCache = new Map<string, ModuleHeader>();
moduleCache.set("builtin", builtInModule);
moduleCache.set("math", mathModule);
moduleCache.set("util", utilModule);

export function textToBinary(src: string): Uint8Array {
  const reporter = new Reporter(src);
  let ast;
  try {
    ast = parse(src);
  } catch (e) {
    console.log(e.explain());
    throw e;
  }
  const start = Date.now();
  const validationResult = validate(ast, moduleCache);
  const time = Date.now() - start;
  log.debug(`validated in ${time}ms`);

  if (validationResult.errors.length) {
    log.debug(util.inspect(validationResult, { colors: true, depth: 10 }));
    for (const error of validationResult.errors) {
      if (error.range) {
        log.debug(reporter.reportValidationError(error.message, error.range));
      } else {
        log.debug(error.message);
      }
    }
    throw new Error("validation error");
  }

  const m = new Module();
  m.setMemory(1, 1, "memory", {
    offset: 2048, // TODO
    data: validationResult.data
  });
  for (const imp of validationResult.imports) {
    m.addImport(imp);
  }
  for (const declaration of validationResult.globalVariableDeclarations) {
    m.globalDeclaration(declaration);
  }
  for (const arrayDeclaration of validationResult.arrayDeclarations) {
    m.arrayDeclaration(arrayDeclaration);
  }
  for (const declaration of validationResult.functionDeclarations) {
    m.functionDeclaration(declaration);
  }
  for (const statement of validationResult.globalStatements) {
    m.globalStatement(statement);
  }

  if (!m.raw.validate()) {
    throw new Error("binaryen validation error");
  }

  log.debug(m.raw.emitText());

  m.raw.optimize();

  // about Source maps
  // https://github.com/AssemblyScript/binaryen.js/#source-maps

  return m.raw.emitBinary();
}

// TODO: export this
// static get parameterDescriptors() {
//   return [
//     {
//       name: "note",
//       defaultValue: 69,
//       minValue: 0,
//       maxValue: 127,
//       automationRate: "k-rate"
//     }
//   ];
// }
