import { LanguageSpecificInstance } from "./definition.js";

// debug
let callCount = 0;
function checkInfiniteLoop() {
  if (callCount++ > 10000) {
    throw new Error("maybe an infinite loop!");
  }
}
export function createInstance(bytes: Uint8Array): LanguageSpecificInstance {
  const mod = new WebAssembly.Module(bytes);
  const lib = {
    util: {
      log_i: function(arg: number) {
        console.log("log_i:", arg);
        checkInfiniteLoop();
      },
      log_f: function(arg: number) {
        console.log("log_f:", arg);
        checkInfiniteLoop();
      },
      log_b: function(arg: number) {
        console.log("log_b:", arg);
        checkInfiniteLoop();
      },
      log_s: function(start: number, length: number) {
        console.log(start, length);
        const sliced = memory.buffer.slice(start, start + length);
        // utf-8 is not supported
        const s = String.fromCharCode(...new Uint8Array(sliced));
        console.log("logString:", s);
        checkInfiniteLoop();
      }
    },
    math: {
      abs: Math.abs,
      acos: Math.acos,
      asin: Math.asin,
      atan: Math.atan,
      atan2: Math.atan2,
      ceil: Math.ceil,
      cos: Math.cos,
      exp: Math.exp,
      floor: Math.floor,
      log: Math.log,
      log10: Math.log10,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      round: Math.fround,
      sin: Math.sin,
      sqrt: Math.sqrt,
      tan: Math.tan,
      acosh: Math.acosh,
      asinh: Math.asinh,
      atanh: Math.atanh,
      cosh: Math.cosh,
      sinh: Math.sinh,
      tanh: Math.tanh
    }
  };
  const instance = new WebAssembly.Instance(
    mod,
    lib
  ) as LanguageSpecificInstance;
  const exp = instance.exports;
  const memory = exp.memory;
  if (exp.test) {
    console.log("testing module...");
    exp.test();
  }
  console.log("number_of_in_channels:", exp.number_of_in_channels.value);
  console.log("number_of_out_channels:", exp.number_of_out_channels.value);
  console.log("string:", exp.string.value);
  console.log("in_0:", exp.in_0.value);
  console.log("in_1:", exp.in_1.value);
  console.log("out_0:", exp.out_0.value);
  console.log("out_1:", exp.out_1.value);
  console.log("buffer:", memory.buffer);
  console.log(
    "in_0",
    memory.buffer.slice(exp.in_0.value, exp.in_0.value + 128 * 4)
  );
  console.log(
    "in_1",
    memory.buffer.slice(exp.in_0.value, exp.in_1.value + 128 * 4)
  );
  console.log(
    "out_0",
    memory.buffer.slice(exp.out_0.value, exp.out_0.value + 128 * 4)
  );
  console.log(
    "out_1",
    memory.buffer.slice(exp.out_1.value, exp.out_1.value + 128 * 4)
  );
  console.log(
    "string",
    memory.buffer.slice(exp.string.value, exp.string.value + 100) // TODO: ?
  );
  return instance;
}
