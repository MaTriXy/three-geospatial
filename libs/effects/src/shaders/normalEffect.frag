uniform highp sampler2D normalBuffer;

uniform mat4 projectionMatrix;
uniform mat4 inverseProjectionMatrix;

vec3 reconstructNormal(const vec2 uv) {
  float depth = readDepth(uv);
  depth = reverseLogDepth(depth, cameraNear, cameraFar);
  vec3 position = screenToView(
    uv,
    depth,
    getViewZ(depth),
    projectionMatrix,
    inverseProjectionMatrix
  );
  vec3 dx = dFdx(position);
  vec3 dy = dFdy(position);
  return normalize(cross(dx, dy));
}

vec3 readNormal(const vec2 uv) {
  #ifdef OCT_ENCODED
  return unpackVec2ToNormal(texture2D(normalBuffer, uv).xy);
  #else
  return 2.0 * texture2D(normalBuffer, uv).xyz - 1.0;
  #endif // OCT_ENCODED
}

void mainImage(const vec4 inputColor, const vec2 uv, out vec4 outputColor) {
  #ifdef RECONSTRUCT_FROM_DEPTH
  vec3 normal = reconstructNormal(uv);
  #else
  vec3 normal = readNormal(uv);
  #endif // RECONSTRUCT_FROM_DEPTH

  outputColor = vec4(normal * 0.5 + 0.5, inputColor.a);
}
