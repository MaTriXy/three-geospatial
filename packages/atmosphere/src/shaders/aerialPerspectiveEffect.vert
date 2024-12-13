uniform mat4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;
uniform vec3 cameraPosition;
uniform float cameraHeight;
uniform vec3 ellipsoidCenter;
uniform vec3 ellipsoidRadii;
uniform vec2 geometricErrorAltitudeRange;

varying vec3 vWorldPosition;
varying vec3 vEllipsoidCenter;
varying vec3 vEllipsoidRadiiSquared;

void getCameraRay(out vec3 origin, out vec3 direction) {
  bool isPerspective = inverseProjectionMatrix[2][3] != 0.0; // 4th entry in the 3rd column

  if (isPerspective) {
    // calculate the camera ray for a perspective camera
    vec4 viewPosition = inverseProjectionMatrix * vec4(position, 1.0);
    vec4 worldDirection = inverseViewMatrix * vec4(viewPosition.xyz, 0.0);
    origin = cameraPosition;
    direction = worldDirection.xyz;
  } else {
    // unprojected points to calculate direction
    vec4 nearPoint = inverseProjectionMatrix * vec4(position.xy, -1.0, 1.0);
    vec4 farPoint = inverseProjectionMatrix * vec4(position.xy, -0.9, 1.0);
    nearPoint /= nearPoint.w;
    farPoint /= farPoint.w;

    // calculate world values
    vec4 worldDirection =
      inverseViewMatrix * vec4(farPoint.xyz - nearPoint.xyz, 0.0);
    vec4 worldOrigin = inverseViewMatrix * nearPoint;

    // outputs
    direction = worldDirection.xyz;
    origin = worldOrigin.xyz;
  }
}

void mainSupport() {
  vec3 direction, origin;
  getCameraRay(origin, direction);
  vWorldPosition = origin * METER_TO_UNIT_LENGTH;

  #ifdef CORRECT_GEOMETRIC_ERROR
  float t = smoothstep(geometricErrorAltitudeRange.x, geometricErrorAltitudeRange.y, cameraHeight);
  vEllipsoidCenter = mix(ellipsoidCenter, vec3(0.0), t) * METER_TO_UNIT_LENGTH;
  #else
  vEllipsoidCenter = ellipsoidCenter * METER_TO_UNIT_LENGTH;
  #endif // CORRECT_GEOMETRIC_ERROR

  vec3 radii = ellipsoidRadii * METER_TO_UNIT_LENGTH;
  vEllipsoidRadiiSquared = radii * radii;
}
