const textEncoder = new TextEncoder();
const encode = textEncoder.encode.bind(textEncoder);
export type StringRefs = {
  size: number;
  info: Map<string, { offset: number; length: number }>;
  data: Uint8Array;
};
export class StringRefsBuilder {
  private size = 0;
  private map = new Map<string, { offset: number; data: Uint8Array }>();
  constructor() {}
  has(value: string): boolean {
    return this.map.has(value);
  }
  add(value: string): void {
    if (this.has(value)) {
      throw new Error("Already have " + value);
    }
    const data = encode(value);
    const offset = this.size;
    this.size += 1 + data.byteLength; // first byte is length
    const pos = { offset, data };
    this.map.set(value, pos);
  }
  getByteOffset(value: string): number {
    if (!this.has(value)) {
      throw new Error("Not found: " + value);
    }
    return this.map.get(value)!.offset;
  }
  createRefs(): StringRefs {
    const info = new Map();
    const data = new Uint8Array(this.size);
    for (const [name, value] of this.map.entries()) {
      data.set([value.data.byteLength], value.offset);
      data.set(value.data, value.offset + 1);
      info.set(name, { offset: value.offset, length: data.byteLength });
    }
    return { size: this.size, info, data };
  }
}
