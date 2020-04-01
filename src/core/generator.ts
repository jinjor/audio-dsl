import $ from "binaryen";
import * as types from "./types";

// Types
type N = number & { N: never };
type X = $.ExpressionRef & { X: never };
type T = $.Type & { T: never };
const $i32 = $.i32 as T;
const $f32 = $.f32 as T;
const $bool = $.i32 as T;
const $none = $.none as T;

// Util
let private_id_number = 0;
export function genId(): string {
  return "__" + private_id_number++;
}

// Module
export class Module {
  raw = new $.Module();
  constructor() {}
  // -------------
  // thin wrappers
  // -------------
  // i32
  i32Const(n: N): X {
    return this.raw.i32.const(n) as X;
  }
  i32Add(left: X, right: X): X {
    return this.raw.i32.add(left, right) as X;
  }
  i32Sub(left: X, right: X): X {
    return this.raw.i32.sub(left, right) as X;
  }
  i32Mul(left: X, right: X): X {
    return this.raw.i32.mul(left, right) as X;
  }
  i32Rem(left: X, right: X): X {
    return this.raw.i32.rem_s(left, right) as X;
  }
  i32Lt(left: X, right: X): X {
    return this.raw.i32.lt_s(left, right) as X;
  }
  i32Le(left: X, right: X): X {
    return this.raw.i32.le_s(left, right) as X;
  }
  i32Gt(left: X, right: X): X {
    return this.raw.i32.gt_s(left, right) as X;
  }
  i32Ge(left: X, right: X): X {
    return this.raw.i32.ge_s(left, right) as X;
  }
  i32Store(ptr: X, value: X): X {
    return this.raw.i32.store(0, 0, ptr, value) as X;
  }
  i32Load(ptr: X): X {
    return this.raw.i32.load(0, 0, ptr) as X;
  }
  // f32
  f32Const(n: N): X {
    return this.raw.f32.const(n) as X;
  }
  f32Add(left: X, right: X): X {
    return this.raw.f32.add(left, right) as X;
  }
  f32Sub(left: X, right: X): X {
    return this.raw.f32.sub(left, right) as X;
  }
  f32Mul(left: X, right: X): X {
    return this.raw.f32.mul(left, right) as X;
  }
  f32Div(left: X, right: X): X {
    return this.raw.f32.div(left, right) as X;
  }
  f32Lt(left: X, right: X): X {
    return this.raw.f32.lt(left, right) as X;
  }
  f32Le(left: X, right: X): X {
    return this.raw.f32.le(left, right) as X;
  }
  f32Gt(left: X, right: X): X {
    return this.raw.f32.gt(left, right) as X;
  }
  f32Ge(left: X, right: X): X {
    return this.raw.f32.ge(left, right) as X;
  }
  f32Store(ptr: X, value: X): X {
    return this.raw.f32.store(0, 0, ptr, value) as X;
  }
  f32Load(ptr: X): X {
    return this.raw.f32.load(0, 0, ptr) as X;
  }
  // local
  localGet(index: N, type: T): X {
    return this.raw.local.get(index, type) as X;
  }
  localSet(index: N, value: X): X {
    return this.raw.local.set(index, value) as X;
  }
  // global
  globalGet(name: string, type: T): X {
    return this.raw.global.get(name, type) as X;
  }
  globalSet(name: string, value: X): X {
    return this.raw.global.set(name, value) as X;
  }
  // call
  call(name: string, operands: X[], results: T): X {
    // should be a bug?
    return this.raw.call(name, operands, results, undefined as any) as X;
  }
  // -----
  // types
  // -----
  type(
    t: types.Int32Type | types.Float32Type | types.VoidType | types.BoolType
  ): T {
    if (t.$ === "Int32Type") {
      return $i32;
    }
    if (t.$ === "Float32Type") {
      return $f32;
    }
    if (t.$ === "VoidType") {
      return $none;
    }
    if (t.$ === "BoolType") {
      return $bool;
    }
    // maybe not possible?
    // if (t.$ === "StructType") {
    //   return $.createType(t.types.map(this.type.bind(this))) as T;
    // }
    throw new Error("Unreachable");
  }
  types(
    t: (types.Int32Type | types.Float32Type | types.VoidType | types.BoolType)[]
  ): T {
    return $.createType(t.map(this.type.bind(this))) as T;
  }
  // -----------
  // expressions
  // -----------
  expression(exp: types.Expression): X {
    if (exp.$ === "Int32Const") {
      return this.i32Const(exp.value as N);
    }
    if (exp.$ === "Float32Const") {
      return this.f32Const(exp.value as N);
    }
    if (exp.$ === "BoolConst") {
      return this.i32Const(exp.value as N);
    }
    if (exp.$ === "LocalGet") {
      return this.localGet(exp.index as N, this.type(exp.type));
    }
    if (exp.$ === "GlobalGet") {
      return this.globalGet(exp.name, this.type(exp.type));
    }
    if (exp.$ === "FunctionGet") {
      throw new Error("FunctionGet is not supported in generator");
    }
    if (exp.$ === "StringGet") {
      const info = this.raw.getMemorySegmentInfoByIndex(0); // string segment
      const offset = info.offset + exp.relativeByteOffset;
      return this.i32Const(offset as N);
    }
    if (exp.$ === "ItemGet") {
      return this.itemGet(exp);
    }
    if (exp.$ === "FunctionCall") {
      return this.functionCall(exp);
    }
    if (exp.$ === "IntToFloatCast") {
      return this.intToFloatCast(exp);
    }
    if (exp.$ === "FloatToIntCast") {
      return this.floatToIntCast(exp);
    }
    if (exp.$ === "Int32AddOp") {
      return this.i32Add(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32SubOp") {
      return this.i32Sub(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32MulOp") {
      return this.i32Mul(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32RemOp") {
      return this.i32Rem(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32AddOp") {
      return this.f32Add(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32SubOp") {
      return this.f32Sub(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32MulOp") {
      return this.f32Mul(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32DivOp") {
      return this.f32Div(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32LT") {
      return this.i32Lt(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32LE") {
      return this.i32Le(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32GT") {
      return this.i32Gt(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Int32GE") {
      return this.i32Ge(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32LT") {
      return this.f32Lt(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32LE") {
      return this.f32Le(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32GT") {
      return this.f32Gt(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "Float32GE") {
      return this.f32Ge(this.expression(exp.left), this.expression(exp.right));
    }
    if (exp.$ === "CondOp") {
      return this.raw.select(
        this.expression(exp.condition),
        this.expression(exp.ifTrue),
        this.expression(exp.ifFalse)
      ) as X;
    }
    throw new Error("not implemented yet or unreachable: " + exp.$);
  }
  functionCall(exp: types.FunctionCall): X {
    const name = exp.target.name;
    const args = exp.args.map(this.expression.bind(this));
    const returnType = this.type(exp.returnType);
    return this.call(name, args, returnType);
  }
  intToFloatCast(exp: types.IntToFloatCast): X {
    return this.raw.f32.convert_s.i32(this.expression(exp.arg)) as X;
  }
  floatToIntCast(exp: types.FloatToIntCast): X {
    return this.raw.i32.trunc_s.f32(this.expression(exp.arg)) as X;
  }
  // ----------
  // statements
  // ----------
  localStatement(statement: types.LocalStatement): X {
    if (statement.$ === "LocalSet") {
      return this.localSet(
        statement.index as N,
        this.expression(statement.value)
      );
    }
    if (statement.$ === "GlobalSet") {
      return this.globalSet(statement.name, this.expression(statement.value));
    }
    if (statement.$ === "ItemSet") {
      return this.itemSet(statement);
    }
    if (statement.$ === "FunctionCall") {
      return this.functionCall(statement);
    }
    if (statement.$ === "IntToFloatCast") {
      return this.intToFloatCast(statement);
    }
    if (statement.$ === "FloatToIntCast") {
      return this.floatToIntCast(statement);
    }
    if (statement.$ === "Loop") {
      return this.loop(statement);
    }
    if (statement.$ === "Return") {
      return this.return(statement);
    }
    throw new Error("not implemented yet: " + statement);
  }
  itemGet(statement: types.ItemGet): X {
    const pointer = this.arrayItemPointer(statement.pointer);
    if (statement.pointer.itemType.$ === "Int32Type") {
      return this.i32Load(pointer);
    }
    if (statement.pointer.itemType.$ === "Float32Type") {
      return this.f32Load(pointer);
    }
    throw new Error("unreachable");
  }
  fieldSet(statement: types.FieldSet): X {
    const pointer = this.structFieldPointer(statement.pointer);
    const value = this.expression(statement.value);
    if (statement.pointer.fieldType.$ === "Int32Type") {
      return this.i32Store(pointer, value);
    }
    if (statement.pointer.fieldType.$ === "Float32Type") {
      return this.f32Store(pointer, value);
    }
    throw new Error("unreachable");
  }
  structFieldPointer(pointer: types.StructFieldPointer): X {
    return this.i32Add(
      this.i32Const(pointer.byteOffset as N),
      this.i32Const(pointer.fieldOffset as N)
    );
  }
  itemSet(statement: types.ItemSet): X {
    const pointer = this.arrayItemPointer(statement.pointer);
    const value = this.expression(statement.value);
    if (statement.pointer.itemType.$ === "Int32Type") {
      return this.i32Store(pointer, value);
    }
    if (statement.pointer.itemType.$ === "Float32Type") {
      return this.f32Store(pointer, value);
    }
    throw new Error("unreachable");
  }
  arrayItemPointer(pointer: types.ArrayItemPointer): X {
    return this.i32Add(
      this.i32Const(pointer.byteOffset as N),
      this.i32Mul(
        this.i32Const(types.sizeOf(pointer.itemType) as N),
        this.expression(pointer.index)
      )
    );
  }
  block(statements: types.LocalStatement[], resultType: T): X {
    return this.raw.block(
      genId(),
      statements.map(this.localStatement.bind(this)),
      resultType === $none ? undefined : resultType
    ) as X;
  }
  globalStatement(statement: types.GlobalStatement): X {
    if (statement.$ === "GlobalSet") {
      return this.globalSet(statement.name, this.expression(statement.value));
    }
    if (statement.$ === "FieldSet") {
      return this.fieldSet(statement);
    }
    throw new Error("not implemented yet");
  }
  loop(loop: types.Loop): X {
    const loopId = genId();
    return this.raw.block(genId(), [
      ...loop.init.map(this.localStatement.bind(this)),
      this.raw.loop(
        loopId,
        this.raw.block(genId(), [
          ...loop.body.map(this.localStatement.bind(this)),
          this.raw.br_if(loopId, this.expression(loop.continueIf))
        ])
      )
    ]) as X;
  }
  return(ret: types.Return): X {
    return this.raw.return(
      ret.value ? this.expression(ret.value) : undefined
    ) as X;
  }
  // ------------
  // declarations
  // ------------
  globalDeclaration(declaration: types.GlobalVariableDeclaration): void {
    if (declaration.type.$ === "Int32Type") {
      this.raw.addGlobal(
        declaration.name,
        $i32,
        declaration.mutable,
        this.expression(declaration.init)
      );
    } else if (declaration.type.$ === "Float32Type") {
      this.raw.addGlobal(
        declaration.name,
        $f32,
        declaration.mutable,
        this.expression(declaration.init)
      );
    } else if (declaration.type.$ === "BoolType") {
      this.raw.addGlobal(
        declaration.name,
        $i32,
        declaration.mutable,
        this.expression(declaration.init)
      );
    } else {
      throw new Error("unreachable");
    }
    if (declaration.export) {
      this.raw.addGlobalExport(declaration.name, declaration.name);
    }
  }
  functionDeclaration(func: types.FunctionDeclaration): void {
    this.raw.addFunction(
      func.name,
      $.createType(func.params.map(this.type.bind(this))),
      this.type(func.returnType),
      func.localTypes.map(this.type.bind(this)),
      this.block(func.statements, this.type(func.returnType))
    );
    if (func.export) {
      this.raw.addFunctionExport(func.name, func.name);
    }
  }
  // ------
  // memory
  // ------
  setMemory(
    init: number,
    max: number,
    exportName: string,
    segment: {
      offset: number;
      data: Uint8Array;
    }
  ): void {
    // 1 page = 64KB
    this.raw.setMemory(
      init,
      max,
      exportName,
      [
        {
          offset: this.i32Const(segment.offset as N),
          data: segment.data
        }
      ],
      null, // flags
      true // shared
    );
  }
  addImport(functionImport: types.Import): void {
    this.raw.addFunctionImport(
      functionImport.functionName, // internalName
      functionImport.moduleName, // externalModuleName
      functionImport.functionName, // externalBasename
      this.types(functionImport.type.params),
      this.type(functionImport.type.returnType)
    );
  }
}
