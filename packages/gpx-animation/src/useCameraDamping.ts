/**
 * Camera damping/smoothing composable
 * Provides smooth, momentum-based camera movement
 */

import type { CameraPosition, DampedCamera, AnimationConfig, Coordinate } from './types';

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_DAMPING_CONFIG: Pick<AnimationConfig, 'positionDamping' | 'bearingDamping' | 'velocityDecay'> = {
  positionDamping: 0.04,
  bearingDamping: 0.02,
  velocityDecay: 0.92,
};

// ============================================
// Utility Functions
// ============================================

/**
 * Normalize bearing to -180 to 180 range
 */
function normalizeBearing(bearing: number): number {
  while (bearing > 180) bearing -= 360;
  while (bearing < -180) bearing += 360;
  return bearing;
}

/**
 * Calculate shortest bearing difference (handles wrap-around)
 */
function getBearingDifference(target: number, current: number): number {
  let diff = target - current;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// ============================================
// Camera Damping Class
// ============================================

export interface DampingConfig {
  positionDamping?: number;
  bearingDamping?: number;
  velocityDecay?: number;
}

/**
 * Camera damping controller for smooth camera movement
 */
export class CameraDamping {
  private state: DampedCamera;
  private config: Required<DampingConfig>;

  constructor(config: DampingConfig = {}) {
    this.config = {
      positionDamping: config.positionDamping ?? DEFAULT_DAMPING_CONFIG.positionDamping,
      bearingDamping: config.bearingDamping ?? DEFAULT_DAMPING_CONFIG.bearingDamping,
      velocityDecay: config.velocityDecay ?? DEFAULT_DAMPING_CONFIG.velocityDecay,
    };

    this.state = this.createInitialState();
  }

  /**
   * Create initial damped camera state
   */
  private createInitialState(): DampedCamera {
    return {
      lng: 0,
      lat: 0,
      bearing: 0,
      velocity: { lng: 0, lat: 0, bearing: 0 },
    };
  }

  /**
   * Reset camera to specified position
   */
  reset(position?: Coordinate): void {
    this.state = this.createInitialState();

    if (position) {
      this.state.lng = position[0];
      this.state.lat = position[1];
    }
  }

  /**
   * Apply damping to target camera position
   * Returns smoothed camera position with momentum
   */
  apply(target: CameraPosition): CameraPosition {
    const { positionDamping, bearingDamping, velocityDecay } = this.config;

    // Calculate target velocity for position
    const targetVelLng = (target.center[0] - this.state.lng) * positionDamping;
    const targetVelLat = (target.center[1] - this.state.lat) * positionDamping;

    // Apply momentum to velocity (exponential smoothing)
    this.state.velocity.lng = this.state.velocity.lng * velocityDecay + targetVelLng * (1 - velocityDecay);
    this.state.velocity.lat = this.state.velocity.lat * velocityDecay + targetVelLat * (1 - velocityDecay);

    // Update position with velocity
    this.state.lng += this.state.velocity.lng;
    this.state.lat += this.state.velocity.lat;

    // Handle bearing with wrap-around
    const bearingDiff = getBearingDifference(target.bearing, this.state.bearing);
    const targetBearingVel = bearingDiff * bearingDamping;

    // Apply momentum to bearing velocity
    this.state.velocity.bearing =
      this.state.velocity.bearing * velocityDecay + targetBearingVel * (1 - velocityDecay);

    // Update bearing and normalize
    this.state.bearing = normalizeBearing(this.state.bearing + this.state.velocity.bearing);

    return {
      center: [this.state.lng, this.state.lat],
      bearing: this.state.bearing,
    };
  }

  /**
   * Get current damped camera state (for debugging)
   */
  getState(): Readonly<DampedCamera> {
    return { ...this.state };
  }

  /**
   * Update damping configuration
   */
  updateConfig(config: Partial<DampingConfig>): void {
    Object.assign(this.config, config);
  }
}

// ============================================
// Composable Function
// ============================================

export interface UseCameraDampingReturn {
  /** Apply damping to a target camera position */
  apply: (target: CameraPosition) => CameraPosition;
  /** Reset camera to initial or specified position */
  reset: (position?: Coordinate) => void;
  /** Update damping configuration */
  updateConfig: (config: Partial<DampingConfig>) => void;
}

/**
 * Composable for camera damping/smoothing
 */
export function useCameraDamping(config: DampingConfig = {}): UseCameraDampingReturn {
  const damping = new CameraDamping(config);

  return {
    apply: (target) => damping.apply(target),
    reset: (position) => damping.reset(position),
    updateConfig: (config) => damping.updateConfig(config),
  };
}
