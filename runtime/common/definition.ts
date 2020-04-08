export type LanguageSpecificExports = WebAssembly.Exports & {
  number_of_in_channels: WebAssembly.Global;
  number_of_out_channels: WebAssembly.Global;
  number_of_params: WebAssembly.Global;
  pointer_of_in_channels: WebAssembly.Global;
  pointer_of_out_channels: WebAssembly.Global;
  pointer_of_static_data: WebAssembly.Global;
  offset_of_param_info: WebAssembly.Global | undefined;
  memory: WebAssembly.Memory;
  test: Function | null;
  process: Function;
};

export type LanguageSpecificInstance = WebAssembly.Instance & {
  exports: LanguageSpecificExports;
};
