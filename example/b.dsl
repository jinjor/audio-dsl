// static get parameterDescriptors() {
//   return [
//     {
//       name: "note",
//       defaultValue: 69,
//       minValue: 0,
//       maxValue: 127,
//       automationRate: "k-rate"
//     }, {
//       name: "a",
//       automationRate: "a-rate"
//     }
//   ];
// }
//
// Note: grammar
//   <struct-initializer> ::= "{" <assign>* "}"
//   <param-declaration> ::= "param" <type-name> <identifier> <struct-initializer>
// Note: struct param { int defaultValue = 0; int minValue = -Infinity; int maxValue = Infinity; }
// Note: type should be one of [int, float, array<int>, array<float>]
param int note {
  defaultValue = 69;
  minValue = 0;
  maxValue = 127;
}
param float[] a {
  defaultValue = 0;
  minValue = -1;
  maxValue = 1; 
}
// expanded (1)
// int<@isParam = true, @minValue = 0, @maxValue = 127, @defaultValue = 69> note;
// array<float<@minValue = -1, @maxValue = 1, @defaultValue = 0>, @isParam = true>;

// expanded (2)
// int { isParam = true, minValue = 0, maxValue = 127, defaultValue = 69 } note;
// array<float { minValue = -1, maxValue = 1, defaultValue = 0 }> { isParam = true };

// expanded (3)
struct string { int offset; int length; }
struct param { string name; int defaultValue; int minValue; int maxValue; string automationRate; }
array<param, 2> params = [
  { name = "note"; defaultValue = 69; minValue = 0; maxValue = 127; automationRate: "k-rate"; },
  { name = "a"; defaultValue = 0; minValue = -1; maxValue = 1; automationRate: "a-rate"; }
];
int note;
array<float, 128> a;

void test() {
}
float angle = 0.0;
void process() {
  loop {
    float target = sin(angle);
    angle = angle + 0.0;
  }
}
int hoge = foo() / 10 - bar[i] * 123.4;
int fuga = hoge + "baz" + cos(1.0);
int a(int v) {
  float a = 1;
  float v = 2.0;
  loop {
    int piyo = a;
    return 42;
  }
}