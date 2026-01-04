/**
 * Camera tracking strategies for route animation
 * Uses the Strategy pattern for clean, extensible camera modes
 */

import * as turf from '@turf/turf';
import {
  TrackingMode,
  type CameraPosition,
  type CameraStrategy,
  type CameraStrategyContext,
  type CameraStrategyConfig,
  type Coordinate,
} from './types';

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: CameraStrategyConfig = {
  lookAheadFactor: 0.05,
  minLookAhead: 20,
  cameraDistance: 0.001, // ~100m at equator
};

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate the look-ahead index for camera positioning
 */
function getLookAheadIndex(
  currentIndex: number,
  routeLength: number,
  factor: number = DEFAULT_CONFIG.lookAheadFactor,
  minLookAhead: number = DEFAULT_CONFIG.minLookAhead
): number {
  const lookAheadDistance = Math.max(minLookAhead, Math.floor(routeLength * factor));
  return Math.min(currentIndex + lookAheadDistance, routeLength - 1);
}

/**
 * Calculate bearing between two coordinates
 */
function getBearing(from: Coordinate, to: Coordinate): number {
  return turf.bearing(turf.point(from), turf.point(to));
}

/**
 * Get a point at a distance and bearing from origin
 */
function getDestination(origin: Coordinate, distance: number, bearing: number): Coordinate {
  const point = turf.destination(turf.point(origin), distance, bearing);
  return point.geometry.coordinates as Coordinate;
}

// ============================================
// Strategy Implementations
// ============================================

/**
 * ActiveTrack Trace: Camera follows behind the subject along the route
 */
export function createTraceStrategy(config: Partial<CameraStrategyConfig> = {}): CameraStrategy {
  const { cameraDistance = 0.001 } = config;

  return {
    name: TrackingMode.ACTIVE_TRACK_TRACE,

    getPosition({ center, currentIndex, routeCoordinates }: CameraStrategyContext): CameraPosition {
      const lookAheadIndex = getLookAheadIndex(currentIndex, routeCoordinates.length);
      const lookAhead = routeCoordinates[lookAheadIndex];

      if (!lookAhead) {
        return { center, bearing: 0 };
      }

      // Calculate direction of travel
      const directionBearing = getBearing(center, lookAhead);

      // Position camera behind the target
      const behindBearing = directionBearing + 180;
      const cameraPos = getDestination(center, cameraDistance, behindBearing);

      return {
        center: cameraPos,
        bearing: directionBearing,
      };
    },
  };
}

/**
 * ActiveTrack Parallel: Camera tracks side-by-side with the subject
 */
export function createParallelStrategy(config: Partial<CameraStrategyConfig> = {}): CameraStrategy {
  const { cameraDistance = 0.0008 } = config;

  return {
    name: TrackingMode.ACTIVE_TRACK_PARALLEL,

    getPosition({ center, currentIndex, routeCoordinates }: CameraStrategyContext): CameraPosition {
      const lookAheadIndex = getLookAheadIndex(currentIndex, routeCoordinates.length);
      const lookAhead = routeCoordinates[lookAheadIndex];

      if (!lookAhead) {
        return { center, bearing: 0 };
      }

      // Calculate direction of travel
      const directionBearing = getBearing(center, lookAhead);

      // Position camera to the side (90° offset)
      const sideBearing = directionBearing + 90;
      const cameraPos = getDestination(center, cameraDistance, sideBearing);

      // Camera bearing points at the target
      const bearing = getBearing(cameraPos, center);

      return { center: cameraPos, bearing };
    },
  };
}

/**
 * Spotlight: Camera follows at a distance, always pointing at subject
 */
export function createSpotlightStrategy(config: Partial<CameraStrategyConfig> = {}): CameraStrategy {
  const { cameraDistance = 0.0015, lookAheadFactor = 0.08 } = config;

  return {
    name: TrackingMode.SPOTLIGHT,

    getPosition({ center, currentIndex, routeCoordinates }: CameraStrategyContext): CameraPosition {
      const lookAheadIndex = getLookAheadIndex(currentIndex, routeCoordinates.length, lookAheadFactor);
      const currentCoord = routeCoordinates[currentIndex] || center;
      const lookAheadCoord = routeCoordinates[lookAheadIndex];

      if (!lookAheadCoord) {
        return { center, bearing: 0 };
      }

      // Calculate direction of travel
      const directionBearing = getBearing(currentCoord, lookAheadCoord);

      // Position camera behind the target
      const behindBearing = directionBearing + 180;
      const cameraPos = getDestination(center, cameraDistance, behindBearing);

      // Camera bearing points at the target
      const bearing = getBearing(cameraPos, center);

      return { center: cameraPos, bearing };
    },
  };
}

/**
 * Point of Interest: Camera orbits around the moving subject
 */
export function createOrbitStrategy(config: Partial<CameraStrategyConfig> = {}): CameraStrategy {
  const { cameraDistance = 0.0012 } = config;

  return {
    name: TrackingMode.POINT_OF_INTEREST,

    getPosition({ center, progress }: CameraStrategyContext): CameraPosition {
      // Full 360° orbit during animation
      const orbitAngle = progress * 360;
      const orbitBearing = orbitAngle + 180;

      const orbitPos = getDestination(center, cameraDistance, orbitBearing);
      const bearing = getBearing(orbitPos, center);

      return { center: orbitPos, bearing };
    },
  };
}

/**
 * Fixed Overview: Camera stays at route center, tracks moving subject
 */
export function createOverviewStrategy(): CameraStrategy {
  let overviewCenter: Coordinate | null = null;

  return {
    name: TrackingMode.FIXED_OVERVIEW,

    getPosition({ center, routeCoordinates }: CameraStrategyContext): CameraPosition {
      // Initialize center on first call
      if (!overviewCenter) {
        const bbox = turf.bbox(turf.lineString(routeCoordinates));
        overviewCenter = [
          (bbox[0] + bbox[2]) / 2,
          (bbox[1] + bbox[3]) / 2,
        ];
      }

      // Camera stays fixed, bearing tracks the subject
      const bearing = getBearing(overviewCenter, center);

      return { center: overviewCenter, bearing };
    },

    reset() {
      overviewCenter = null;
    },
  };
}

// ============================================
// Strategy Factory
// ============================================

/**
 * Create all camera strategies with optional custom configuration
 */
export function createCameraStrategies(config: Partial<CameraStrategyConfig> = {}): Map<TrackingMode, CameraStrategy> {
  const strategies = new Map<TrackingMode, CameraStrategy>();

  strategies.set(TrackingMode.ACTIVE_TRACK_TRACE, createTraceStrategy(config));
  strategies.set(TrackingMode.ACTIVE_TRACK_PARALLEL, createParallelStrategy(config));
  strategies.set(TrackingMode.SPOTLIGHT, createSpotlightStrategy(config));
  strategies.set(TrackingMode.POINT_OF_INTEREST, createOrbitStrategy(config));
  strategies.set(TrackingMode.FIXED_OVERVIEW, createOverviewStrategy());

  return strategies;
}

/**
 * Get camera position using the specified tracking mode
 */
export function getCameraPosition(
  mode: TrackingMode,
  context: CameraStrategyContext,
  strategies: Map<TrackingMode, CameraStrategy>
): CameraPosition {
  const strategy = strategies.get(mode);

  if (!strategy) {
    console.warn(`Unknown tracking mode: ${mode}, falling back to trace`);
    return strategies.get(TrackingMode.ACTIVE_TRACK_TRACE)!.getPosition(context);
  }

  return strategy.getPosition(context);
}

/**
 * Reset all strategies that have state
 */
export function resetStrategies(strategies: Map<TrackingMode, CameraStrategy>): void {
  strategies.forEach((strategy) => strategy.reset?.());
}
