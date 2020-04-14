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
  context.audioWorklet.addModule("noise.js").then(() => {
    document.getElementById("start").onclick = (e) => {
      const context = new AudioContext();
      const node = new AudioWorkletNode(context, "noise");
      node.connect(context.destination);
    };
  });
</script>
```

```shell
dsl noise.dsl # generats `noise.js` and `_runtime.js`
# then, open index.html
```
