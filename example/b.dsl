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
// Note: grammer
//   <struct-initializer> ::= "{" <assign>* "}"
//   <param-declaration> ::= "param" <type-name> <identifier> <struct-initializer>
// Note: struct param { int defaultValue = 0; int minValue = -Infinity; int maxValue = Infinity; }
// Note: type should be one of [int, float, array<int>, array<float>]
param int note {
  defaultValue = 69;
  minValue = 0;
  maxValue = 127;
}
param array<float> note {
  defaultValue = 69;
  minValue = 0;
  maxValue = 127;
}

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