precision highp sampler2DArray;

#include "core/depth"
#include "core/packing"
#include "core/transform"
#include "core/raySphereIntersection"
#include "parameters"
#include "functions"

uniform sampler2D normalBuffer;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 inverseProjectionMatrix;
uniform mat4 inverseViewMatrix;
uniform vec3 ellipsoidCenter;
uniform vec3 sunDirection;
uniform vec3 moonDirection;
uniform float moonAngularRadius;
uniform float lunarRadianceScale;
uniform float irradianceScale;
uniform float idealSphereAlpha;

#ifdef HAS_COMPOSITE
uniform sampler2D compositeBuffer;
#endif // HAS_COMPOSITE

#ifdef HAS_SHADOW
uniform sampler2DArray shadowBuffer;
uniform vec2 shadowIntervals[SHADOW_CASCADE_COUNT];
uniform mat4 shadowMatrices[SHADOW_CASCADE_COUNT];
uniform float shadowFar;
#endif // HAS_SHADOW

varying vec3 vWorldPosition;
varying vec3 vWorldDirection;
varying vec3 vEllipsoidCenter;
varying vec3 vSkyEllipsoidCenter;
varying vec3 vEllipsoidRadiiSquared;

vec3 readNormal(const vec2 uv) {
  #ifdef OCT_ENCODED_NORMAL
  return unpackVec2ToNormal(texture(normalBuffer, uv).xy);
  #else
  return 2.0 * texture(normalBuffer, uv).xyz - 1.0;
  #endif // OCT_ENCODED_NORMAL
}

void correctGeometricError(inout vec3 worldPosition, inout vec3 worldNormal) {
  // Correct way is slerp, but this will be small-angle interpolation anyways.
  vec3 normal = normalize(1.0 / vEllipsoidRadiiSquared * worldPosition);
  vec3 position = u_bottom_radius * normal;
  worldNormal = mix(worldNormal, normal, idealSphereAlpha);
  worldPosition = mix(worldPosition, position, idealSphereAlpha);
}

#if defined(SUN_IRRADIANCE) || defined(SKY_IRRADIANCE)
vec3 getSunSkyIrradiance(
  const vec3 worldPosition,
  const vec3 worldNormal,
  const vec3 inputColor,
  const float shadowTransmittance
) {
  // Assume lambertian BRDF. If both SUN_IRRADIANCE and SKY_IRRADIANCE are not
  // defined, regard the inputColor as radiance at the texel.
  vec3 albedo = inputColor * irradianceScale * RECIPROCAL_PI;
  vec3 skyIrradiance;
  vec3 sunIrradiance = GetSunAndSkyIrradiance(
    worldPosition - vEllipsoidCenter,
    worldNormal,
    sunDirection,
    skyIrradiance
  );

  #ifdef HAS_SHADOW
  sunIrradiance *= shadowTransmittance;
  #endif // HAS_SHADOW

  #if defined(SUN_IRRADIANCE) && defined(SKY_IRRADIANCE)
  return albedo * (sunIrradiance + skyIrradiance);
  #elif defined(SUN_IRRADIANCE)
  return albedo * sunIrradiance;
  #elif defined(SKY_IRRADIANCE)
  return albedo * skyIrradiance;
  #endif
}
#endif // defined(SUN_IRRADIANCE) || defined(SKY_IRRADIANCE)

#if defined(TRANSMITTANCE) || defined(INSCATTER)
void getTransmittanceInscatter(
  const vec3 worldPosition,
  const vec3 worldNormal,
  inout vec3 radiance
) {
  vec3 transmittance;
  vec3 inscatter = GetSkyRadianceToPoint(
    vWorldPosition - vEllipsoidCenter,
    worldPosition - vEllipsoidCenter,
    0.0, // Shadow length
    sunDirection,
    transmittance
  );
  #if defined(TRANSMITTANCE)
  radiance = radiance * transmittance;
  #endif
  #if defined(INSCATTER)
  radiance = radiance + inscatter;
  #endif
}
#endif // defined(TRANSMITTANCE) || defined(INSCATTER)

#ifdef HAS_SHADOW

int getCascadeIndex(vec3 position) {
  vec4 viewPosition = viewMatrix * vec4(position, 1.0);
  float depth = viewZToOrthographicDepth(viewPosition.z, cameraNear, shadowFar);
  for (int i = 0; i < SHADOW_CASCADE_COUNT; ++i) {
    vec2 interval = shadowIntervals[i];
    if (depth >= interval.x && depth < interval.y) {
      return i;
    }
  }
  return SHADOW_CASCADE_COUNT - 1;
}

float sampleOpticalDepth(vec3 worldPosition) {
  int index = getCascadeIndex(worldPosition);
  vec4 point = shadowMatrices[index] * vec4(worldPosition, 1.0);
  point /= point.w;
  vec2 uv = point.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return 0.0;
  }
  // x: frontDepth, y: meanExtinction, z: maxOpticalDepth, w: distanceToEllipsoid
  return texture(shadowBuffer, vec3(uv, float(index))).z;
}

#endif // HAS_SHADOW

void mainImage(const vec4 inputColor, const vec2 uv, out vec4 outputColor) {
  vec4 composite = vec4(0.0);
  #ifdef HAS_COMPOSITE
  composite = texture(compositeBuffer, uv);
  #endif // HAS_COMPOSITE

  float depth = readDepth(uv);
  if (depth >= 1.0 - 1e-7) {
    #ifdef SKY
    vec3 viewPosition = vWorldPosition - vSkyEllipsoidCenter;
    vec3 rayDirection = normalize(vWorldDirection);
    outputColor.rgb = getSkyRadiance(
      viewPosition,
      rayDirection,
      sunDirection,
      moonDirection,
      moonAngularRadius,
      lunarRadianceScale
    );
    outputColor.a = 1.0;
    #else
    outputColor = inputColor;
    #endif // SKY

    #ifdef HAS_COMPOSITE
    outputColor.rgb = composite.rgb + outputColor.rgb * (1.0 - composite.a);
    #endif // HAS_COMPOSITE
    return;
  }
  depth = reverseLogDepth(depth, cameraNear, cameraFar);

  // Reconstruct position and normal in world space.
  vec3 viewPosition = screenToView(
    uv,
    depth,
    getViewZ(depth),
    projectionMatrix,
    inverseProjectionMatrix
  );
  vec3 viewNormal;
  #ifdef RECONSTRUCT_NORMAL
  vec3 dx = dFdx(viewPosition);
  vec3 dy = dFdy(viewPosition);
  viewNormal = normalize(cross(dx, dy));
  #else
  viewNormal = readNormal(uv);
  #endif // RECONSTRUCT_NORMAL

  vec3 worldPositionMeters = (inverseViewMatrix * vec4(viewPosition, 1.0)).xyz;
  vec3 worldPosition = worldPositionMeters * METER_TO_UNIT_LENGTH;
  vec3 worldNormal = normalize(mat3(inverseViewMatrix) * viewNormal);

  #ifdef CORRECT_GEOMETRIC_ERROR
  correctGeometricError(worldPosition, worldNormal);
  #endif // CORRECT_GEOMETRIC_ERROR

  #ifdef HAS_SHADOW
  float opticalDepth = sampleOpticalDepth(worldPositionMeters);
  // TODO: This is basically no longer needed because clouds are clamped in the
  // shadow pass, but shadows of clouds outside the main camera are still
  // visible on certain occasions.
  // float distanceToCloud = shadow.w;
  // float distanceToGround = raySphereFirstIntersection(
  //   worldPositionMeters,
  //   -sunDirection,
  //   ellipsoidCenter,
  //   u_bottom_radius / METER_TO_UNIT_LENGTH
  // );
  // if (distanceToCloud < distanceToGround) {
  //   opticalDepth = 0.0;
  // }
  float shadowTransmittance = exp(-opticalDepth);
  #else
  float shadowTransmittance = 1.0;
  #endif // HAS_SHADOW

  vec3 radiance;
  #if defined(SUN_IRRADIANCE) || defined(SKY_IRRADIANCE)
  radiance = getSunSkyIrradiance(worldPosition, worldNormal, inputColor.rgb, shadowTransmittance);
  #else
  radiance = inputColor.rgb;
  #endif // defined(SUN_IRRADIANCE) || defined(SKY_IRRADIANCE)

  #if defined(TRANSMITTANCE) || defined(INSCATTER)
  getTransmittanceInscatter(worldPosition, worldNormal, radiance);
  #endif // defined(TRANSMITTANCE) || defined(INSCATTER)

  outputColor = vec4(radiance, inputColor.a);

  #ifdef HAS_COMPOSITE
  outputColor.rgb = composite.rgb + outputColor.rgb * (1.0 - composite.a);
  #endif // HAS_COMPOSITE
}
