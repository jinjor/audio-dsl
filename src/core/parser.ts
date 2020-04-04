import {
  seq,
  end,
  symbol,
  oneOf,
  run,
  Parser,
  lazy,
  stringBefore,
  float,
  constant,
  $2,
  _,
  withContext,
  bracedSep,
  int,
  $null,
  keyword,
  braced,
  many,
  match,
  mapWithRange,
  $3,
  Range,
  sepBy,
  $1,
  stringBeforeEndOr,
  Position,
} from "../util/typed-parser";
import * as util from "util";
import * as log from "./log";
import * as ast from "./ast";

function transformPosition(pos: Position): ast.Position {
  return {
    line: pos.row - 1,
    character: pos.column - 1,
  };
}
function transformRange(range: Range): ast.Range {
  return {
    start: transformPosition(range.start),
    end: transformPosition({
      row: range.end.row,
      column: range.end.column + 1,
    }),
  };
}

const intLiteral = withContext<ast.IntLiteral>(
  "IntLiteral",
  mapWithRange(
    (value, range) => ({
      range: transformRange(range),
      $: "IntLiteral",
      value,
    }),
    int("-?(0|[1-9][0-9]*)")
  )
);
const floatLiteral = withContext<ast.FloatLiteral>(
  "FloatLiteral",
  mapWithRange(
    (value, range) => ({
      range: transformRange(range),
      $: "FloatLiteral",
      value,
    }),
    float("-?(0|[1-9][0-9]*)(\\.[0-9]+)")
  )
);
const escape = seq(
  $2,
  symbol("\\"),
  oneOf(
    keyword('"', '"'),
    keyword("\\", "\\"),
    keyword("/", "/"),
    keyword("b", "\b"),
    keyword("f", "\f"),
    keyword("n", "\n"),
    keyword("r", "\r"),
    keyword("t", "\t")
  )
);
const strInner: Parser<string> = seq(
  (s, tail) => s + tail,
  stringBefore('[\\\\"]'),
  oneOf(
    seq(
      (e, t) => e + t,
      escape,
      lazy(() => strInner)
    ),
    constant("")
  )
);
const stringLiteral = withContext<ast.StringLiteral>(
  "StringLiteral",
  mapWithRange(
    (value: string, range) => ({
      range: transformRange(range),
      $: "StringLiteral",
      value,
    }),
    seq($2, symbol('"'), strInner, symbol('"'), _)
  )
);
const itemSep = seq($null, symbol(","), _);
const arrayLiteral: Parser<ast.ArrayLiteral> = withContext(
  "ArrayLiteral",
  mapWithRange(
    (items, range) => ({
      range: transformRange(range),
      $: "ArrayLiteral",
      items,
    }),
    bracedSep<ast.Expression>(
      "[",
      "]",
      itemSep,
      lazy(() => expression)
    )
  )
);
const paren: Parser<ast.Expression> = mapWithRange(
  (exp, range) => {
    exp.range = transformRange(range);
    return exp;
  },
  braced<ast.Expression>(
    "(",
    ")",
    lazy(() => expression)
  )
);
const identifier: Parser<ast.Identifier> = mapWithRange(
  (name, range) => ({ range: transformRange(range), $: "Identifier", name }),
  match("[a-zA-Z]+[a-zA-Z0-9_-]*")
);
const singleExpression = oneOf<ast.Expression>(
  paren,
  floatLiteral,
  intLiteral,
  stringLiteral,
  // arrayLiteral,
  identifier
);
const arrayIndex: Parser<ast.Expression> = seq(
  $3,
  symbol("["),
  _,
  lazy(() => expression),
  _,
  symbol("]")
);
const functionArgs: Parser<ast.Expression[]> = seq(
  $3,
  symbol("("),
  _,
  lazy(() => sepBy(itemSep, expression)),
  _,
  symbol(")")
);
const accessor = oneOf<ast.ArrayAccessor | ast.FunctionArguments>(
  mapWithRange(
    (values, range) => ({
      range: transformRange(range),
      $: "FunctionArguments",
      values,
    }),
    functionArgs
  ),
  mapWithRange(
    (value, range) => ({
      range: transformRange(range),
      $: "ArrayAccessor",
      value,
    }),
    arrayIndex
  )
);
function joinAccessors(
  acc: ast.Expression,
  tail: (ast.ArrayAccessor | ast.FunctionArguments)[],
  i: number
): ast.Expression {
  if (i >= tail.length) {
    return acc;
  }
  const accessor = tail[i];
  if (accessor.$ === "ArrayAccessor") {
    const range = {
      start: acc.range.start,
      end: accessor.range.end,
    };
    return joinAccessors(
      {
        range,
        $: "ArrayAccess",
        array: acc,
        index: accessor.value,
      },
      tail,
      i + 1
    );
  } else if (accessor.$ === "FunctionArguments") {
    const range = {
      start: acc.range.start,
      end: accessor.range.end,
    };
    return joinAccessors(
      {
        range,
        $: "FunctionCall",
        func: acc,
        args: accessor,
      },
      tail,
      i + 1
    );
  } else {
    throw new Error("unreachable");
  }
}

const factor: Parser<ast.Expression> = seq(
  (f, _, tail) => joinAccessors(f, tail, 0),
  singleExpression,
  _,
  many(seq($1, accessor, _))
);
function joinBinOp<Op extends ast.BinOpKind>(
  acc: ast.Expression,
  tail: { op: Op; value: ast.Expression }[],
  i: number
): ast.Expression {
  if (i >= tail.length) {
    return acc;
  }
  const range = {
    start: acc.range.start,
    end: tail[i].value.range.end,
  };
  return joinBinOp(
    {
      range,
      $: "BinOp",
      operator: tail[i].op,
      left: acc,
      right: tail[i].value,
    },
    tail,
    i + 1
  );
}
const mulOpKind: Parser<ast.MulOpKind> = oneOf<ast.MulOpKind>(
  keyword("*", "*"),
  keyword("/", "/"),
  keyword("%", "%")
);
const termTail: Parser<{ op: ast.MulOpKind; value: ast.Expression }[]> = many(
  seq((op, _, value) => ({ op, value }), mulOpKind, _, factor, _)
);
const term: Parser<ast.Expression> = seq(
  (f, _, tail) => joinBinOp(f, tail, 0),
  factor,
  _,
  termTail
);
const addOpKind: Parser<ast.AddOpKind> = oneOf<ast.AddOpKind>(
  keyword("+", "+"),
  keyword("-", "-")
);
const comparisonTail: Parser<
  {
    op: ast.AddOpKind;
    value: ast.Expression;
  }[]
> = many(seq((op, _, value) => ({ op, value }), addOpKind, _, term, _));
const comparison = seq(
  (f, _, tail) => joinBinOp(f, tail, 0),
  term,
  _,
  comparisonTail
);
const compOpKind: Parser<ast.CompOpKind> = oneOf<ast.CompOpKind>(
  keyword(">=", ">="),
  keyword(">", ">"),
  keyword("<=", "<="),
  keyword("<", "<")
);

const conditionTail: Parser<
  {
    op: ast.CompOpKind;
    value: ast.Expression;
  }[]
> = many(seq((op, _, value) => ({ op, value }), compOpKind, _, comparison, _));
const condition = seq(
  (f, _, tail) => joinBinOp(f, tail, 0),
  comparison,
  _,
  conditionTail
);
const expression: Parser<ast.Expression> = mapWithRange(
  (
    {
      head,
      tail,
    }: {
      head: ast.Expression;
      tail: { ifTrue: ast.Expression; ifFalse: ast.Expression } | null;
    },
    range
  ) => {
    if (tail == null) {
      return head;
    }
    return {
      range: transformRange(range),
      $: "CondOp",
      condition: head,
      ifTrue: tail.ifTrue,
      ifFalse: tail.ifFalse,
    };
  },
  seq(
    (head, _, tail) => ({ head, tail }),
    condition,
    _,
    oneOf<{ ifTrue: ast.Expression; ifFalse: ast.Expression } | null>(
      seq(
        (
          _1,
          _2,
          ifTrue: ast.Expression,
          _3,
          _4,
          _5,
          ifFalse: ast.Expression
        ) => ({ ifTrue, ifFalse }),
        symbol("?"),
        _,
        lazy(() => expression),
        _,
        symbol(":"),
        _,
        lazy(() => expression)
      ),
      constant(null)
    )
  )
);
const primitiveTypeName: Parser<ast.PrimitiveTypeName> = mapWithRange(
  (kind: ast.PrimitiveTypeNameKind, range) => ({
    range: transformRange(range),
    $: "PrimitiveTypeName",
    kind,
  }),
  oneOf<ast.PrimitiveTypeNameKind>(
    keyword("int", "int"),
    keyword("float", "float"),
    keyword("void", "void"),
    keyword("bool", "bool")
  )
);
type TypeParts = {
  primitiveTypeName: ast.PrimitiveTypeName;
  isArray: boolean;
};
const type: Parser<ast.Type> = mapWithRange(
  ({ primitiveTypeName, isArray }: TypeParts, range) => {
    const primitive: ast.PrimitiveType = {
      range: primitiveTypeName.range,
      $: "PrimitiveType",
      name: primitiveTypeName,
    };
    return isArray
      ? { range: transformRange(range), $: "ArrayType", type: primitive }
      : primitive;
  },
  seq(
    (primitiveTypeName, _, isArray) => ({ primitiveTypeName, isArray }),
    primitiveTypeName,
    _,
    oneOf(
      seq((_) => true, _, symbol("["), _, symbol("]")),
      constant(false)
    )
  )
);
const variableDeclarationInner: Parser<[
  ast.Type,
  ast.Identifier,
  ast.Expression | null
]> = seq(
  (type, _1, left, _2, right) => [type, left, right],
  type,
  _,
  identifier,
  _,
  oneOf(symbol(";"), seq($3, symbol("="), _, expression, _, symbol(";")))
);
const variableDeclarationWithMutableFlag: Parser<ast.VariableDeclaration> = mapWithRange(
  (
    [type, left, right]: [ast.Type, ast.Identifier, ast.Expression | null],
    range
  ) => ({
    range: transformRange(range),
    $: "VariableDeclaration",
    type,
    left,
    right,
    hasMutableFlag: true,
  }),
  seq($3, keyword("var"), _, variableDeclarationInner)
);
const variableDeclarationTail: Parser<ast.Expression> = seq(
  $3,
  symbol("="),
  _,
  expression,
  _,
  symbol(";")
);
const param: Parser<ast.Param> = mapWithRange(
  (
    { type, identifier }: { type: ast.Type; identifier: ast.Identifier },
    range: Range
  ) => ({
    range: transformRange(range),
    $: "Param",
    type,
    name: identifier.name,
  }),
  seq(
    (type: ast.Type, _: null, identifier: ast.Identifier) => ({
      type,
      identifier,
    }),
    type,
    _,
    identifier
  )
);
const paramList: Parser<ast.ParamList> = mapWithRange(
  (items: ast.Param[], range: Range) => ({
    range: transformRange(range),
    $: "ParamList",
    items,
  }),
  seq($3, symbol("("), _, sepBy(itemSep, param), _, symbol(")"))
);
const block: Parser<ast.Statement[]> = seq(
  $3,
  symbol("{"),
  _,
  lazy(() => statements),
  symbol("}")
);
type FucntionDeclarationTail = {
  $: "FucntionDeclarationTail";
  params: ast.ParamList;
  statements: ast.Statement[];
};
const fucntionDeclarationTail: Parser<FucntionDeclarationTail> = seq(
  (params: ast.ParamList, _, statements: ast.Statement[]) => ({
    $: "FucntionDeclarationTail",
    params,
    statements,
  }),
  paramList,
  _,
  block
);

const structLiteral: Parser<ast.StructLiteral> = mapWithRange(
  (fields: ast.Assign[], range) => ({
    range: transformRange(range),
    $: "StructLiteral",
    fields,
  }),
  seq(
    $3,
    symbol("{"),
    _,
    many(
      seq(
        $1,
        lazy(() => assign),
        _
      )
    ),
    symbol("}")
  )
);

const paramDeclaration: Parser<ast.ParamDeclaration> = mapWithRange(
  (
    {
      type,
      name,
      struct,
    }: { type: ast.Type; name: ast.Identifier; struct: ast.StructLiteral },
    range
  ) => ({
    range: transformRange(range),
    $: "ParamDeclaration",
    type,
    name,
    struct,
  }),
  seq(
    (
      _1,
      _2,
      _3: ast.Type,
      _4,
      _5: ast.Identifier,
      _6,
      _7: ast.StructLiteral
    ) => {
      return {
        type: _3,
        name: _5,
        struct: _7,
      };
    },
    keyword("param"),
    _,
    type,
    _,
    identifier,
    _,
    structLiteral
  )
);

const declaration: Parser<
  ast.VariableDeclaration | ast.FunctionDeclaration
> = mapWithRange(
  (
    {
      type,
      identifier,
      tail,
    }: {
      type: ast.Type;
      identifier: ast.Identifier;
      tail: ast.Expression | FucntionDeclarationTail | null;
    },
    range
  ) => {
    if (tail == null) {
      return {
        range: transformRange(range),
        $: "VariableDeclaration",
        type,
        left: identifier,
        right: null,
        hasMutableFlag: false,
      };
    }
    if (tail.$ === "FucntionDeclarationTail") {
      return {
        range: transformRange(range),
        $: "FunctionDeclaration",
        name: identifier,
        params: tail.params,
        returnType: type,
        statements: tail.statements,
      };
    }
    return {
      range: transformRange(range),
      $: "VariableDeclaration",
      type,
      left: identifier,
      right: tail,
      hasMutableFlag: false,
    };
  },
  seq(
    (type, _1, identifier, _2, tail) => ({ type, identifier, tail }),
    type,
    _,
    identifier,
    _,
    oneOf<ast.Expression | FucntionDeclarationTail | null>(
      symbol(";"),
      fucntionDeclarationTail,
      variableDeclarationTail
    )
  )
);
const loop: Parser<ast.Loop> = mapWithRange(
  (statements: ast.Statement[], range) => ({
    range: transformRange(range),
    $: "Loop",
    statements,
  }),
  seq(
    $3,
    keyword("loop"),
    _,
    lazy(() => block)
  )
);
const returnInner: Parser<ast.Expression | null> = seq(
  (_, __, optionalValue) => optionalValue,
  keyword("return"),
  _,
  oneOf(expression, constant(null)),
  _,
  symbol(";")
);
const return_: Parser<ast.Return> = mapWithRange(
  (optionalExp, range) => ({
    range: transformRange(range),
    $: "Return",
    value: optionalExp,
  }),
  returnInner
);

const assignTail: Parser<ast.Expression> = seq(
  $3,
  symbol("="),
  _,
  expression,
  _,
  symbol(";")
);
const assign: Parser<ast.Assign> = mapWithRange(
  ({ left, right }: { left: ast.Expression; right: ast.Expression }, range) => {
    return {
      range: transformRange(range),
      $: "Assign",
      left,
      right,
    };
  },
  seq((left, _, right) => ({ left, right }), expression, _, assignTail)
);
const assignOrExpression: Parser<ast.Assign | ast.Expression> = mapWithRange(
  (
    { left, right }: { left: ast.Expression; right: ast.Expression | null },
    range
  ) => {
    if (right == null) {
      return left;
    }
    return {
      range: transformRange(range),
      $: "Assign",
      left,
      right,
    };
  },
  seq(
    (left, _, right) => ({ left, right }),
    expression,
    _,
    oneOf(symbol(";"), assignTail)
  )
);
const comment: Parser<ast.Comment> = mapWithRange(
  (value: string, range) => ({
    range: transformRange(range),
    $: "Comment",
    value,
  }),
  seq($2, symbol("//"), stringBeforeEndOr("\n"), symbol("\n"))
);
const statement: Parser<ast.Statement> = oneOf<ast.Statement>(
  comment,
  variableDeclarationWithMutableFlag,
  paramDeclaration,
  declaration,
  loop,
  return_,
  assignOrExpression
);
const statements: Parser<ast.Statement[]> = many(seq($1, statement, _));
const module_: Parser<ast.Module> = seq(
  (_, statements) => {
    return { $: "Module", imports: [], statements };
  },
  _,
  statements,
  end
);

export function parse(src: string): ast.Module {
  return parseDebug(module_, src);
}
export function parseStatement(src: string): ast.Statement {
  return parseDebug(statement, src);
}
export function parseExpression(src: string): ast.Expression {
  return parseDebug(expression, src);
}
function parseDebug<T>(parser: Parser<T>, src: string): T {
  try {
    const start = Date.now();
    const ast = run(parser, src);
    const time = Date.now() - start;
    log.debug(`parsed in ${time}ms`);
    log.debug(util.inspect(ast, { colors: true, depth: 10 }));
    return ast;
  } catch (e) {
    log.debug(util.inspect(e, { colors: true, depth: 10 }));
    throw e;
  }
}
