import * as assert from "assert";

export class DataBuilder {
  public size = 0;
  private data: (Uint8Array | Int32Array | Float32Array)[] = [];
  constructor() {}
  push(data: Uint8Array | Int32Array | Float32Array): number {
    this.data.push(data);
    const offset = this.size;
    this.size += data.byteLength;
    return offset;
  }
  pushUint8(n: number): number {
    return this.push(new Uint8Array([n]));
  }
  pushInt32(n: number): number {
    return this.push(new Int32Array([n]));
  }
  pushFloat32(n: number): number {
    return this.push(new Float32Array([n]));
  }
  createData(): Uint8Array {
    const buffer = new ArrayBuffer(this.size);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < this.data.length; i++) {
      let offsetBranch = offset;
      const d = this.data[i];
      if (d instanceof Uint8Array) {
        for (const v of d.values()) {
          view.setUint8(offsetBranch, v);
          offsetBranch++;
        }
      } else if (d instanceof Int32Array) {
        for (const v of d.values()) {
          view.setInt32(offsetBranch, v);
          offsetBranch += 4;
        }
      } else if (d instanceof Float32Array) {
        for (const v of d.values()) {
          view.setFloat32(offsetBranch, v);
          offsetBranch += 4;
        }
      }
      offset += this.data[i].byteLength;
      assert.equal(offset, offsetBranch);
    }
    return new Uint8Array(buffer);
  }
}

const textEncoder = new TextEncoder();
const encode = textEncoder.encode.bind(textEncoder);
export class StringBuilder {
  private offsetMap = new Map<string, number>();
  constructor(private dataBuilder: DataBuilder) {}
  set(value: string): number {
    if (this.offsetMap.has(value)) {
      return this.offsetMap.get(value)!;
    }
    const stringData = encode(value);
    // first byte is length
    const offset = this.dataBuilder.pushUint8(stringData.byteLength);
    this.dataBuilder.push(stringData);
    this.offsetMap.set(value, offset);
    return offset;
  }
  getByteOffset(value: string): number {
    return this.offsetMap.get(value)!;
  }
}
