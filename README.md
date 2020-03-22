# Audio DSL

An experimental DSL for AudioWorklet.

1. [ text ]
2. -- parse --> [ ast ]
3. -- validate --> [ types ]
4. -- generate --> [ binaryen expressions ]
5. -- binaryen validate --> binaryen optimize --> [ wasm module (base64) ]
6. -- link runtime --> [ output ]

Note: This is just a toy language. I don't think this will be published as a product.
