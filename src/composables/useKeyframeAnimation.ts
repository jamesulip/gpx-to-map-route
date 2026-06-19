/**
 * Keyframe Animation Composable
 * Manages keyframes for custom camera animations along the route
 */

import { ref, computed } from 'vue';
import type {
  Keyframe,
  InterpolatedCameraState,
  KeyframeAnimationConfig,
  UseKeyframeAnimationReturn,
  EasingType,
} from './keyframeTypes';
import type { Coordinate } from './types';

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: KeyframeAnimationConfig = {
  defaultAltitude: 500,
  defaultPitch: 60,
  defaultZoom: 15,
  defaultBearingOffset: 0,
  defaultCameraDistance: 0.001,
  defaultEasing: 'easeInOut',
};

// ============================================
// Easing Functions
// ============================================

const easingFunctions: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique ID for keyframes
 */
function generateId(): string {
  return `kf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Interpolate between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two optional values with a default
 */
function lerpOptional(
  a: number | undefined,
  b: number | undefined,
  t: number,
  defaultValue: number
): number {
  const valueA = a ?? defaultValue;
  const valueB = b ?? defaultValue;
  return lerp(valueA, valueB, t);
}

// ============================================
// Composable
// ============================================

/**
 * Create a keyframe animation controller
 *
 * @example
 * ```ts
 * const {
 *   keyframes,
 *   addKeyframe,
 *   getInterpolatedState,
 * } = useKeyframeAnimation();
 *
 * // Add keyframes
 * addKeyframe({ progress: 0, pitch: 30, altitude: 200 });
 * addKeyframe({ progress: 0.5, pitch: 75, altitude: 1000 });
 * addKeyframe({ progress: 1, pitch: 45, altitude: 500 });
 *
 * // Get interpolated state at any progress
 * const state = getInterpolatedState(0.25);
 * ```
 */
export function useKeyframeAnimation(
  config: Partial<KeyframeAnimationConfig> = {}
): UseKeyframeAnimationReturn {
  const mergedConfig: KeyframeAnimationConfig = { ...DEFAULT_CONFIG, ...config };

  // ============================================
  // State
  // ============================================

  const keyframes = ref<Keyframe[]>([]);

  // ============================================
  // Computed
  // ============================================

  const sortedKeyframes = computed(() =>
    [...keyframes.value].sort((a, b) => a.progress - b.progress)
  );

  // ============================================
  // Methods
  // ============================================

  /**
   * Add a new keyframe to the timeline
   */
  function addKeyframe(keyframeData: Omit<Keyframe, 'id'>): Keyframe {
    // Check if a keyframe with the same progress exists
    const existingIndex = keyframes.value.findIndex(
      (kf) => kf.progress === keyframeData.progress
    );

    if (existingIndex !== -1) {
      // Update the existing keyframe
      const existingKeyframe = keyframes.value[existingIndex];
      if (existingKeyframe) {
        keyframes.value[existingIndex] = {
          ...existingKeyframe,
          ...keyframeData,
          id: existingKeyframe.id, // Ensure id is always present and a string
        };
        sortKeyframes();
        return keyframes.value[existingIndex]!;
      }
    }

    // Otherwise, add a new keyframe
    const keyframe: Keyframe = {
      ...keyframeData,
      id: generateId(),
    };

    keyframes.value.push(keyframe);
    sortKeyframes();

    return keyframe;
  }

  /**
   * Update an existing keyframe
   */
  function updateKeyframe(id: string, updates: Partial<Keyframe>): void {
    const index = keyframes.value.findIndex((kf) => kf.id === id);
    if (index !== -1) {
      const existing = keyframes.value[index];
      if (existing) {
        keyframes.value[index] = { ...existing, ...updates };
        sortKeyframes();
      }
    }
  }

  /**
   * Remove a keyframe by ID
   */
  function removeKeyframe(id: string): void {
    const index = keyframes.value.findIndex((kf) => kf.id === id);
    if (index !== -1) {
      keyframes.value.splice(index, 1);
    }
  }

  /**
   * Clear all keyframes
   */
  function clearKeyframes(): void {
    keyframes.value = [];
  }

  /**
   * Sort keyframes by progress
   */
  function sortKeyframes(): void {
    keyframes.value.sort((a, b) => a.progress - b.progress);
  }

  /**
   * Find the surrounding keyframes for a given progress
   */
  function findSurroundingKeyframes(
    progress: number
  ): { before: Keyframe | null; after: Keyframe | null } {
    const sorted = sortedKeyframes.value;

    if (sorted.length === 0) {
      return { before: null, after: null };
    }

    // Find the last keyframe before or at the progress
    let before: Keyframe | null = null;
    let after: Keyframe | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const kf = sorted[i];
      if (!kf) continue;
      if (kf.progress <= progress) {
        before = kf;
      } else {
        after = kf;
        break;
      }
    }

    // If no before found, use the first keyframe as reference
    if (!before && sorted.length > 0) {
      after = sorted[0] ?? null;
    }

    // If no after found, use the last keyframe
    if (!after && sorted.length > 0) {
      before = sorted[sorted.length - 1] ?? null;
    }

    return { before, after };
  }

  /**
   * Get interpolated camera state at a given progress
   */
  function getInterpolatedState(progress: number): InterpolatedCameraState {
    const sorted = sortedKeyframes.value;

    // Default state when no keyframes exist
    if (sorted.length === 0) {
      return {
        altitude: mergedConfig.defaultAltitude,
        pitch: mergedConfig.defaultPitch,
        zoom: mergedConfig.defaultZoom,
        bearingOffset: mergedConfig.defaultBearingOffset,
        cameraDistance: mergedConfig.defaultCameraDistance,
      };
    }

    // If only one keyframe, return its values
    if (sorted.length === 1) {
      const kf = sorted[0];
      if (!kf) {
        return {
          altitude: mergedConfig.defaultAltitude,
          pitch: mergedConfig.defaultPitch,
          zoom: mergedConfig.defaultZoom,
          bearingOffset: mergedConfig.defaultBearingOffset,
          cameraDistance: mergedConfig.defaultCameraDistance,
        };
      }
      return {
        altitude: kf.altitude ?? mergedConfig.defaultAltitude,
        pitch: kf.pitch ?? mergedConfig.defaultPitch,
        zoom: kf.zoom ?? mergedConfig.defaultZoom,
        bearingOffset: kf.bearingOffset ?? mergedConfig.defaultBearingOffset,
        cameraDistance: kf.cameraDistance ?? mergedConfig.defaultCameraDistance,
        cameraPosition: kf.cameraPosition,
      };
    }

    const { before, after } = findSurroundingKeyframes(progress);

    // At or before first keyframe
    if (!before && after) {
      return {
        altitude: after.altitude ?? mergedConfig.defaultAltitude,
        pitch: after.pitch ?? mergedConfig.defaultPitch,
        zoom: after.zoom ?? mergedConfig.defaultZoom,
        bearingOffset: after.bearingOffset ?? mergedConfig.defaultBearingOffset,
        cameraDistance: after.cameraDistance ?? mergedConfig.defaultCameraDistance,
        cameraPosition: after.cameraPosition,
      };
    }

    // At or after last keyframe
    if (before && !after) {
      return {
        altitude: before.altitude ?? mergedConfig.defaultAltitude,
        pitch: before.pitch ?? mergedConfig.defaultPitch,
        zoom: before.zoom ?? mergedConfig.defaultZoom,
        bearingOffset: before.bearingOffset ?? mergedConfig.defaultBearingOffset,
        cameraDistance: before.cameraDistance ?? mergedConfig.defaultCameraDistance,
        cameraPosition: before.cameraPosition,
      };
    }

    // Interpolate between two keyframes
    if (before && after) {
      const range = after.progress - before.progress;
      const localProgress = range > 0 ? (progress - before.progress) / range : 0;

      // Apply easing
      const easing = after.easing ?? mergedConfig.defaultEasing;
      const easedProgress = easingFunctions[easing](localProgress);

      // Interpolate camera position if both keyframes have it
      let interpolatedCameraPosition: Coordinate | undefined;
      if (before.cameraPosition && after.cameraPosition) {
        interpolatedCameraPosition = [
          lerp(before.cameraPosition[0], after.cameraPosition[0], easedProgress),
          lerp(before.cameraPosition[1], after.cameraPosition[1], easedProgress),
        ];
      } else if (before.cameraPosition) {
        interpolatedCameraPosition = before.cameraPosition;
      } else if (after.cameraPosition) {
        interpolatedCameraPosition = after.cameraPosition;
      }

      return {
        altitude: lerpOptional(
          before.altitude,
          after.altitude,
          easedProgress,
          mergedConfig.defaultAltitude
        ),
        pitch: lerpOptional(
          before.pitch,
          after.pitch,
          easedProgress,
          mergedConfig.defaultPitch
        ),
        zoom: lerpOptional(
          before.zoom,
          after.zoom,
          easedProgress,
          mergedConfig.defaultZoom
        ),
        bearingOffset: lerpOptional(
          before.bearingOffset,
          after.bearingOffset,
          easedProgress,
          mergedConfig.defaultBearingOffset
        ),
        cameraDistance: lerpOptional(
          before.cameraDistance,
          after.cameraDistance,
          easedProgress,
          mergedConfig.defaultCameraDistance
        ),
        cameraPosition: interpolatedCameraPosition,
      };
    }

    // Fallback to defaults
    return {
      altitude: mergedConfig.defaultAltitude,
      pitch: mergedConfig.defaultPitch,
      zoom: mergedConfig.defaultZoom,
      bearingOffset: mergedConfig.defaultBearingOffset,
      cameraDistance: mergedConfig.defaultCameraDistance,
    };
  }

  /**
   * Import keyframes from JSON array
   */
  function importKeyframes(data: Keyframe[]): void {
    keyframes.value = data.map((kf) => ({
      ...kf,
      id: kf.id || generateId(),
    }));
    sortKeyframes();
  }

  /**
   * Export keyframes to JSON array
   */
  function exportKeyframes(): Keyframe[] {
    return [...sortedKeyframes.value];
  }

  // ============================================
  // Return
  // ============================================

  return {
    keyframes,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    getInterpolatedState,
    clearKeyframes,
    importKeyframes,
    exportKeyframes,
    sortKeyframes,
  };
}
