/**
 * Shared types and interfaces for GPX animation composables
 */

// ============================================
// Tracking Modes (using const object instead of enum)
// ============================================

/**
 * Camera tracking modes for route animation
 */
export const TrackingMode = {
  /** Camera follows behind the subject along the route */
  ACTIVE_TRACK_TRACE: 'activeTrackTrace',
  /** Camera tracks side-by-side with the subject */
  ACTIVE_TRACK_PARALLEL: 'activeTrackParallel',
  /** Camera follows at a distance, always pointing at subject */
  SPOTLIGHT: 'spotlight',
  /** Camera orbits around the moving subject */
  POINT_OF_INTEREST: 'pointOfInterest',
  /** Camera stays fixed at route center, tracks subject */
  FIXED_OVERVIEW: 'fixedOverview',
} as const;

export type TrackingMode = typeof TrackingMode[keyof typeof TrackingMode];

// ============================================
// GPS & Route Types
// ============================================

export interface GpsPoint {
  longitude: number;
  latitude: number;
  elevation?: number;
}

export type Coordinate = [number, number];
export type Bounds = [Coordinate, Coordinate];

export interface PathAnalysis {
  coordinates: Coordinate[];
  points: GpsPoint[];
  totalDistance: number;
  bounds: Bounds;
}

// ============================================
// Camera Types
// ============================================

export interface CameraPosition {
  center: Coordinate;
  bearing: number;
}

export interface CameraVelocity {
  lng: number;
  lat: number;
  bearing: number;
}

export interface DampedCamera {
  lng: number;
  lat: number;
  bearing: number;
  velocity: CameraVelocity;
}

// ============================================
// Configuration Types
// ============================================

export interface AnimationConfig {
  /** Duration of the full animation in milliseconds */
  animationDuration: number;
  /** Position smoothing factor (0-1, lower = smoother) */
  positionDamping: number;
  /** Bearing smoothing factor (0-1, lower = smoother) */
  bearingDamping: number;
  /** Velocity decay factor (0-1, higher = more momentum) */
  velocityDecay: number;
}

export interface CameraStrategyConfig {
  /** Fraction of route length for look-ahead calculation */
  lookAheadFactor: number;
  /** Minimum points for look-ahead */
  minLookAhead: number;
  /** Camera distance from target in kilometers */
  cameraDistance: number;
}

// ============================================
// Callback Types
// ============================================

export type AnimationFrameCallback = (camera: CameraPosition) => void;

// ============================================
// Strategy Interface
// ============================================

export interface CameraStrategy {
  name: TrackingMode;
  getPosition(context: CameraStrategyContext): CameraPosition;
  reset?(): void;
}

export interface CameraStrategyContext {
  /** Current target position */
  center: Coordinate;
  /** Current index in route coordinates */
  currentIndex: number;
  /** Animation progress (0-1) */
  progress: number;
  /** All route coordinates */
  routeCoordinates: Coordinate[];
}
