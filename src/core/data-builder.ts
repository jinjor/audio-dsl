export class DataBuilder {
  public size = 0;
  private data: Uint8Array[] = [];
  constructor() {}
  push(data: Uint8Array): number {
    this.data.push(data);
    const offset = this.size;
    this.size += data.byteLength;
    return offset;
  }
  pushByte(byte: number): number {
    return this.push(new Uint8Array([byte]));
  }
  createData(): Uint8Array {
    let offset = 0;
    const data = new Uint8Array(this.size);
    for (let i = 0; i < this.data.length; i++) {
      data.set(this.data[i], offset);
      offset += this.data[i].byteLength;
    }
    return data;
  }
}

const textEncoder = new TextEncoder();
const encode = textEncoder.encode.bind(textEncoder);
export class StringBuilder {
  private offsetMap = new Map<string, number>();
  constructor(private dataBuilder: DataBuilder) {}
  has(value: string): boolean {
    return this.offsetMap.has(value);
  }
  add(value: string): void {
    if (this.has(value)) {
      throw new Error("Already have " + value);
    }
    const stringData = encode(value);
    // first byte is length
    const offset = this.dataBuilder.pushByte(stringData.byteLength);
    this.dataBuilder.push(stringData);
    this.offsetMap.set(value, offset);
  }
  getByteOffset(value: string): number {
    if (!this.has(value)) {
      throw new Error("Not found: " + value);
    }
    return this.offsetMap.get(value)!;
  }
}
