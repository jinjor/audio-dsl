param float note {
  defaultValue = 69.0;
  minValue = 0.0;
  maxValue = 127.0;
}
param float[] a {
  defaultValue = 0.0;
  minValue = -1.0;
  maxValue = 1.0; 
}
// expanded
struct param { string name; float defaultValue; float minValue; float maxValue; string automationRate; }
array<param, 2> params = [
  { name = "note"; defaultValue = 69.0; minValue = 0.0; maxValue = 127.0; automationRate: "k-rate"; },
  { name = "a"; defaultValue = 0.0; minValue = -1.0; maxValue = 1.0; automationRate: "a-rate"; }
];
float note;
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