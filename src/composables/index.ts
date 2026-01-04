// Main composables
export { useGpxAnimation, TrackingMode } from './useGpxAnimation';
export { useMapbox } from './useMapbox';
export { useGpxLoader } from './useGpxLoader';
export { useCameraDamping, CameraDamping } from './useCameraDamping';

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

export type { UseGpxAnimationOptions, UseGpxAnimationReturn } from './useGpxAnimation';
export type { UseGpxLoaderReturn } from './useGpxLoader';
export type { DampingConfig, UseCameraDampingReturn } from './useCameraDamping';
