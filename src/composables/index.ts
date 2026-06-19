// Main composables
export { useGpxAnimation, TrackingMode } from './useGpxAnimation';
export { useMapbox } from './useMapbox';
export { useGpxLoader } from './useGpxLoader';
export { useCameraDamping, CameraDamping } from './useCameraDamping';
export { useKeyframeAnimation } from './useKeyframeAnimation';
export { useMapRecording } from './useMapRecording';

// Camera strategies
export {
  createCameraStrategies,
  createTraceStrategy,
  createParallelStrategy,
  createSpotlightStrategy,
  createOrbitStrategy,
  createOverviewStrategy,
  getCameraPosition,
  resetStrategies,
} from './cameraStrategies';

// Types
export type {
  GpsPoint,
  Coordinate,
  Bounds,
  PathAnalysis,
  CameraPosition,
  CameraVelocity,
  DampedCamera,
  AnimationConfig,
  CameraStrategyConfig,
  AnimationFrameCallback,
  CameraStrategy,
  CameraStrategyContext,
} from './types';

export type {
  Keyframe,
  InterpolatedCameraState,
  EasingType,
  KeyframeAnimationConfig,
  UseKeyframeAnimationReturn,
} from './keyframeTypes';

export type { UseGpxAnimationOptions, UseGpxAnimationReturn } from './useGpxAnimation';
export type { UseGpxLoaderReturn } from './useGpxLoader';
export type { DampingConfig, UseCameraDampingReturn } from './useCameraDamping';
