export type LanguageSpecificExports = WebAssembly.Exports & {
  number_of_in_channels: WebAssembly.Global;
  number_of_out_channels: WebAssembly.Global;
  number_of_params: WebAssembly.Global;
  pointer_of_in_channels: WebAssembly.Global | undefined;
  pointer_of_out_channels: WebAssembly.Global | undefined;
  pointer_of_params: WebAssembly.Global | undefined;
  pointer_of_static_data: WebAssembly.Global | undefined;
  size_of_static_data: WebAssembly.Global;
  offset_of_param_info: WebAssembly.Global | undefined;
  memory: WebAssembly.Memory;
  test: Function | null;
  process: Function;
};

export type LanguageSpecificInstance = WebAssembly.Instance & {
  exports: LanguageSpecificExports;
};

export type Descriptor = {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: string; // "a-rate" | "k-rate"
};

export type ParamInfo = {
  descriptor: Descriptor;
  ptr: number;
};

export type StructFieldType = "int" | "float";
export type StructFieldTypes = StructFieldType[];
export const numSamples = 128;
export const sizeOfInt = 4;
export const sizeOfFloat = 4;
function sizeOfStruct(fieldTypes: StructFieldTypes): number {
  let sum = 0;
  for (const t of fieldTypes) {
    if (t === "int") {
      sum += sizeOfInt;
    } else if (t === "float") {
      sum += sizeOfFloat;
    } else {
      throw new Error("unreachable");
    }
  }
  return sum;
}
export const paramInfoFieldTypes: StructFieldTypes = [
  "int", // string ptr
  "float",
  "float",
  "float",
  "int", // string ptr
];
export const sizeOfParamInfo = sizeOfStruct(paramInfoFieldTypes);
