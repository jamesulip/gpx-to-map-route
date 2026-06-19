/**
 * Types for Keyframe Animation System
 * Allows adding custom camera keyframes along the animation timeline
 */

import type { Coordinate } from './types';

// ============================================
// Keyframe Types
// ============================================

/**
 * A single keyframe defining camera properties at a specific point in the animation
 */
export interface Keyframe {
  /** Unique identifier for the keyframe */
  id: string;
  /** Animation progress (0-1) when this keyframe applies */
  progress: number;
  /** Camera altitude/zoom level (optional, uses default if not set) */
  altitude?: number;
  /** Camera pitch angle in degrees (0-85, optional) */
  pitch?: number;
  /** Camera zoom level (optional) */
  zoom?: number;
  /** Bearing offset from calculated direction (optional) */
  bearingOffset?: number;
  /** Camera distance from target in km (optional) */
  cameraDistance?: number;
  /** Custom camera position override (optional) */
  cameraPosition?: Coordinate;
  /** Duration of transition to this keyframe in ms (optional) */
  transitionDuration?: number;
  /** Easing function name (optional) */
  easing?: EasingType;
  /** Optional label for the keyframe */
  label?: string;
}

/**
 * Interpolated camera state at any point in the animation
 */
export interface InterpolatedCameraState {
  /** Camera altitude */
  altitude: number;
  /** Camera pitch angle */
  pitch: number;
  /** Camera zoom level */
  zoom: number;
  /** Bearing offset from calculated direction */
  bearingOffset: number;
  /** Camera distance from target */
  cameraDistance: number;
  /** Custom camera position if any */
  cameraPosition?: Coordinate;
}

/**
 * Available easing functions
 */
export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic';

/**
 * Keyframe animation configuration
 */
export interface KeyframeAnimationConfig {
  /** Default altitude when no keyframe specifies it */
  defaultAltitude: number;
  /** Default pitch when no keyframe specifies it */
  defaultPitch: number;
  /** Default zoom when no keyframe specifies it */
  defaultZoom: number;
  /** Default bearing offset */
  defaultBearingOffset: number;
  /** Default camera distance in km */
  defaultCameraDistance: number;
  /** Default easing for transitions */
  defaultEasing: EasingType;
}

/**
 * Return type for useKeyframeAnimation composable
 */
export interface UseKeyframeAnimationReturn {
  /** All keyframes in the timeline */
  keyframes: import('vue').Ref<Keyframe[]>;
  /** Add a new keyframe */
  addKeyframe: (keyframe: Omit<Keyframe, 'id'>) => Keyframe;
  /** Update an existing keyframe */
  updateKeyframe: (id: string, updates: Partial<Keyframe>) => void;
  /** Remove a keyframe */
  removeKeyframe: (id: string) => void;
  /** Get interpolated camera state at a given progress */
  getInterpolatedState: (progress: number) => InterpolatedCameraState;
  /** Clear all keyframes */
  clearKeyframes: () => void;
  /** Import keyframes from JSON */
  importKeyframes: (data: Keyframe[]) => void;
  /** Export keyframes to JSON */
  exportKeyframes: () => Keyframe[];
  /** Sort keyframes by progress */
  sortKeyframes: () => void;
}
