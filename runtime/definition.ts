export type LanguageSpecificExports = WebAssembly.Exports & {
  number_of_in_channels: WebAssembly.Global;
  number_of_out_channels: WebAssembly.Global;
  in_0: WebAssembly.Global;
  in_1: WebAssembly.Global;
  out_0: WebAssembly.Global;
  out_1: WebAssembly.Global;
  params: WebAssembly.Global;
  number_of_params: WebAssembly.Global;
  string: WebAssembly.Global;
  memory: WebAssembly.Memory;
  test: Function | null;
  process: Function;
};
export type LanguageSpecificInstance = WebAssembly.Instance & {
  exports: LanguageSpecificExports;
};
