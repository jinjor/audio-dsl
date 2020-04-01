float base_hz = 442.0;
int base_note = 69;
int sample_rate = 48000;
float HALF_PI = PI * 0.5;
float TWO_PI = PI * 2.0;

int frame_samples = 128;
// array<float, frame_samples> param;

bool flag;

// util
float note_to_hz(int note) {
  return base_hz * pow(2.0, float(note - base_note) / 12.0);
}
float angle_per_sample(float hz) {
  return TWO_PI * hz / float(sample_rate);
}

float gain = 0.2;
var float angle = 1.0;

float calc_sin() {
  return sin(angle);
}
float calc_square() {
  return (angle < PI ? -1.0 : 1.0) * 0.7;
}
float calc_saw() {
  return angle / PI - 1.0;
}
float calc_triangle() {
  return angle < PI ? 2.0 * angle / PI - 1.0 : -2.0 * angle / PI + 3.0;
}
void process() {
  loop {
    out_0[i] = calc_saw() * gain;
    angle = angle + angle_per_sample(note_to_hz(60));
    angle = angle > TWO_PI ? angle - TWO_PI : angle;
  }
}
void test() {
  log_s("Hello, World!");
  log_s("Meow!");
  // log_f(angle);
  log_b(1 > 0);
}