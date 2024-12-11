// Based on: https://github.com/sebh/TileableVolumeNoise

uniform float layer;

in vec2 vUv;

layout(location = 0) out float outputColor;

void main() {
  vec3 point = vec3(vUv.x, vUv.y, layer);
  float cellCount = 2.0;
  vec4 noise = vec4(
    1.0 - createWorleyNoise(point, cellCount * 1.0),
    1.0 - createWorleyNoise(point, cellCount * 2.0),
    1.0 - createWorleyNoise(point, cellCount * 4.0),
    1.0 - createWorleyNoise(point, cellCount * 8.0)
  );
  vec3 fbm = vec3(
    dot(noise.xyz, vec3(0.625, 0.25, 0.125)),
    dot(noise.yzw, vec3(0.625, 0.25, 0.125)),
    dot(noise.zw, vec2(0.75, 0.25))
  );
  outputColor = dot(fbm, vec3(0.625, 0.25, 0.125));
}
