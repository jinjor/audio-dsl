# Audio DSL

An experimental DSL for AudioWorklet.

Note: This is just a toy language. I don't think this will be published as a product.

## Install

```shell
git clone git@github.com:jinjor/audio-dsl.git
cd audio-dsl
npm install
npm run build
npm install -g .
```

### Install VSCode Extension

```shell
./sync-and-install-vscode.sh
# then, restart VSCode
```

## Example

noise.dsl

```c
void process() {
  loop {
    out_0[i] = (random() * 2.0 - 1.0) * 0.1;
  }
}
```

index.html

```html
<button id="start">Start</button>
<script type="module">
  const context = new AudioContext();
  context.audioWorklet.addModule("noise.mjs").then(() => {
    document.getElementById("start").onclick = (e) => {
      context.resume();
      const node = new AudioWorkletNode(context, "noise");
      node.connect(context.destination);
    };
  });
</script>
```

```shell
dsl compile noise.dsl # generats `noise.mjs` and `_runtime.mjs`
python3 -m http.server # or something else
# then, go to http://localhost:8000
```
