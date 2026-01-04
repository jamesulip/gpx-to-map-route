/**
 * GPX Animation Composable
 * Orchestrates route animation with camera tracking
 *
 * This is the main composable that combines:
 * - GPX loading (useGpxLoader)
 * - Camera strategies (cameraStrategies)
 * - Camera smoothing (useCameraDamping)
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue';
import type {
  AnimationFrameCallback,
  CameraPosition,
  Coordinate,
  GpsPoint,
  PathAnalysis,
  TrackingMode,
} from './types';
import { TrackingMode as TrackingModeValues } from './types';
import { useGpxLoader, interpolatePoint } from './useGpxLoader';
import { useCameraDamping, type DampingConfig } from './useCameraDamping';
import { createCameraStrategies, getCameraPosition, resetStrategies } from './cameraStrategies';

// Re-export TrackingMode for convenience
export { TrackingMode } from './types';

// ============================================
// Configuration
// ============================================

export interface UseGpxAnimationOptions {
  /** Animation duration in milliseconds (default: 50000) */
  animationDuration?: number;
  /** Position smoothing factor (default: 0.04) */
  positionDamping?: number;
  /** Bearing smoothing factor (default: 0.02) */
  bearingDamping?: number;
  /** Velocity decay factor (default: 0.92) */
  velocityDecay?: number;
}

const DEFAULT_ANIMATION_DURATION = 50000;

// ============================================
// Return Type
// ============================================

export interface UseGpxAnimationReturn {
  // State
  /** Whether animation is currently running */
  isAnimating: Ref<boolean>;
  /** Animation progress from 0 to 1 */
  animationProgress: Ref<number>;
  /** Loaded GPS points with elevation */
  gpsPoints: Ref<GpsPoint[]>;
  /** Route coordinates for map display */
  routeCoordinates: Ref<Coordinate[]>;
  /** Current interpolated point during animation */
  currentPoint: ComputedRef<GpsPoint | null>;
  /** Route bounds for map fitting */
  bounds: Ref<[[number, number], [number, number]] | null>;
  /** Whether route data is loaded */
  hasData: ComputedRef<boolean>;

  // Methods
  /** Load GPX file from URL */
  loadGpxFile: (url: string) => Promise<PathAnalysis>;
  /** Create GeoJSON for map display */
  createRouteGeoJson: () => GeoJSON.FeatureCollection;
  /** Start animation with specified tracking mode */
  startAnimation: (trackingMode: TrackingMode, onFrame: AnimationFrameCallback) => void;
  /** Pause current animation */
  pauseAnimation: () => void;
  /** Reset animation to beginning */
  resetAnimation: () => void;
  /** Cleanup resources */
  cleanup: () => void;
}

// ============================================
// Composable
// ============================================

/**
 * Main composable for GPX route animation
 *
 * @example
 * ```ts
 * const {
 *   loadGpxFile,
 *   startAnimation,
 *   isAnimating,
 *   currentPoint,
 * } = useGpxAnimation({ animationDuration: 30000 });
 *
 * await loadGpxFile('/route.gpx');
 * startAnimation(TrackingMode.ACTIVE_TRACK_TRACE, (camera) => {
 *   map.setCamera(camera.center, camera.bearing);
 * });
 * ```
 */
export function useGpxAnimation(options: UseGpxAnimationOptions = {}): UseGpxAnimationReturn {
  // Extract configuration
  const animationDuration = options.animationDuration ?? DEFAULT_ANIMATION_DURATION;
  const dampingConfig: DampingConfig = {
    positionDamping: options.positionDamping,
    bearingDamping: options.bearingDamping,
    velocityDecay: options.velocityDecay,
  };

  // Initialize sub-composables
  const gpxLoader = useGpxLoader();
  const cameraDamping = useCameraDamping(dampingConfig);

  // Initialize camera strategies
  const cameraStrategies = createCameraStrategies();

  // Animation state
  const isAnimating = ref(false);
  const animationProgress = ref(0);

  // Internal animation state
  let animationFrameId: number | null = null;
  let startTime: number | null = null;
  let currentTrackingMode: TrackingMode = TrackingModeValues.ACTIVE_TRACK_TRACE;

  // ============================================
  // Computed Properties
  // ============================================

  /**
   * Current interpolated point based on animation progress
   */
  const currentPoint = computed<GpsPoint | null>(() => {
    const points = gpxLoader.gpsPoints.value;

    if (points.length < 2) return null;

    const totalSegments = points.length - 1;
    const segmentIndex = Math.floor(animationProgress.value * totalSegments);
    const segmentProgress = (animationProgress.value * totalSegments) % 1;

    // Return last point if at end
    if (segmentIndex >= points.length - 1) {
      return points[points.length - 1] ?? null;
    }

    const point1 = points[segmentIndex];
    const point2 = points[segmentIndex + 1];

    if (!point1 || !point2) return null;

    return interpolatePoint(point1, point2, segmentProgress);
  });

  // ============================================
  // Animation Methods
  // ============================================

  /**
   * Calculate camera position for current animation state
   */
  function calculateCameraPosition(): CameraPosition | null {
    const coords = gpxLoader.routeCoordinates.value;
    const point = currentPoint.value;

    if (coords.length < 2 || !point) return null;

    const center: Coordinate = [point.longitude, point.latitude];
    const totalSegments = coords.length - 1;
    const currentIndex = Math.floor(animationProgress.value * totalSegments);

    return getCameraPosition(currentTrackingMode, {
      center,
      currentIndex,
      progress: animationProgress.value,
      routeCoordinates: coords,
    }, cameraStrategies);
  }

  /**
   * Start the animation loop
   */
  function startAnimation(
    trackingMode: TrackingMode = TrackingModeValues.ACTIVE_TRACK_TRACE,
    onFrame: AnimationFrameCallback
  ): void {
    // Don't start if already animating or no data
    if (isAnimating.value || !gpxLoader.hasData.value) return;

    // Setup animation state
    currentTrackingMode = trackingMode;
    isAnimating.value = true;
    startTime = performance.now();

    // Reset camera strategies and damping
    resetStrategies(cameraStrategies);
    cameraDamping.reset(gpxLoader.startingCoordinate.value ?? undefined);

    /**
     * Animation frame handler
     */
    function animate(currentTime: number): void {
      if (!startTime || !isAnimating.value) return;

      // Calculate progress
      const elapsed = currentTime - startTime;
      animationProgress.value = Math.min(elapsed / animationDuration, 1);

      // Calculate and apply camera position
      const targetCamera = calculateCameraPosition();

      if (targetCamera) {
        const smoothCamera = cameraDamping.apply(targetCamera);
        onFrame(smoothCamera);
      }

      // Continue or finish animation
      if (animationProgress.value < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isAnimating.value = false;
        startTime = null;
      }
    }

    // Start animation loop
    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Pause the current animation
   */
  function pauseAnimation(): void {
    isAnimating.value = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * Reset animation to beginning
   */
  function resetAnimation(): void {
    pauseAnimation();
    animationProgress.value = 0;
    startTime = null;
    resetStrategies(cameraStrategies);
    cameraDamping.reset(gpxLoader.startingCoordinate.value ?? undefined);
  }

  /**
   * Cleanup all resources
   */
  function cleanup(): void {
    pauseAnimation();
  }

  // ============================================
  // Return
  // ============================================

  return {
    // State
    isAnimating,
    animationProgress,
    gpsPoints: gpxLoader.gpsPoints,
    routeCoordinates: gpxLoader.routeCoordinates,
    currentPoint,
    bounds: gpxLoader.bounds as Ref<[[number, number], [number, number]] | null>,
    hasData: gpxLoader.hasData,

    // Methods
    loadGpxFile: gpxLoader.loadGpxFile,
    createRouteGeoJson: gpxLoader.createRouteGeoJson,
    startAnimation,
    pauseAnimation,
    resetAnimation,
    cleanup,
  };
}
