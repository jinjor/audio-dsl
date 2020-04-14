export function pointerToInt(
  memory: WebAssembly.Memory,
  pointer: number
): number {
  const buf = memory.buffer.slice(pointer, pointer + 4);
  const view = new DataView(buf);
  return view.getInt32(0);
}
export function pointerToFloat(
  memory: WebAssembly.Memory,
  pointer: number
): number {
  const buf = memory.buffer.slice(pointer, pointer + 4);
  const view = new DataView(buf);
  return view.getFloat32(0);
}
export function pointerToBool(
  memory: WebAssembly.Memory,
  pointer: number
): boolean {
  const buf = memory.buffer.slice(pointer, pointer + 4);
  const view = new DataView(buf);
  const intValue = view.getInt32(0);
  return intValue > 0;
}
export function pointerToString(
  memory: WebAssembly.Memory,
  pointer: number
): string {
  const pointerToData = pointer + 1;
  const lenBuf = memory.buffer.slice(pointer, pointerToData);
  const length = Array.from(new Uint8Array(lenBuf))[0];
  const sliced = memory.buffer.slice(pointerToData, pointerToData + length);
  // utf-8 is not supported (because TextDecoder is not here...)
  return String.fromCharCode(...new Uint8Array(sliced));
}

export type Lib = {
  name: string;
  create(memory: WebAssembly.Memory): Record<string, Function>;
};
export const util: Lib = {
  name: "util",
  create(memory: WebAssembly.Memory): Record<string, Function> {
    return {
      log_i: function (arg: number) {
        console.log("log_i:", arg);
      },
      log_f: function (arg: number) {
        console.log("log_f:", arg);
      },
      log_b: function (arg: number) {
        console.log("log_b:", arg);
      },
      log_s: function (pointer: number) {
        console.log("log_s:", pointerToString(memory, pointer));
      },
    };
  },
};
export const math: Lib = {
  name: "math",
  create(memory: WebAssembly.Memory): Record<string, Function> {
    return {
      acos: Math.acos,
      asin: Math.asin,
      atan: Math.atan,
      atan2: Math.atan2,
      cos: Math.cos,
      exp: Math.exp,
      log: Math.log,
      log10: Math.log10,
      pow: Math.pow,
      sin: Math.sin,
      tan: Math.tan,
      acosh: Math.acosh,
      asinh: Math.asinh,
      atanh: Math.atanh,
      cosh: Math.cosh,
      sinh: Math.sinh,
      tanh: Math.tanh,
      random: Math.random,
    };
  },
};
