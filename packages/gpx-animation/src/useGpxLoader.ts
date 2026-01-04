/**
 * GPX file loader and parser composable
 * Handles loading, parsing, and analyzing GPX route data
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { gpx } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import type { Coordinate, Bounds, GpsPoint, PathAnalysis } from './types';

// ============================================
// Utility Functions
// ============================================

/**
 * Linear interpolation between two GPS points
 */
export function interpolatePoint(point1: GpsPoint, point2: GpsPoint, t: number): GpsPoint {
  return {
    longitude: point1.longitude + (point2.longitude - point1.longitude) * t,
    latitude: point1.latitude + (point2.latitude - point1.latitude) * t,
    elevation:
      point1.elevation !== undefined && point2.elevation !== undefined
        ? point1.elevation + (point2.elevation - point1.elevation) * t
        : undefined,
  };
}

/**
 * Parse GeoJSON and extract route analysis data
 */
function analyzeGeoJson(geojson: any): PathAnalysis {
  const emptyResult: PathAnalysis = {
    coordinates: [],
    points: [],
    totalDistance: 0,
    bounds: [[0, 0], [0, 0]],
  };

  if (!geojson.features || geojson.features.length === 0) {
    return emptyResult;
  }

  const feature = geojson.features[0];
  const rawCoordinates = feature.geometry.coordinates as [number, number, number][];

  // Extract GPS points with elevation
  const points: GpsPoint[] = rawCoordinates.map((coord) => ({
    longitude: coord[0],
    latitude: coord[1],
    elevation: coord[2],
  }));

  // Extract 2D coordinates for mapping
  const coordinates: Coordinate[] = rawCoordinates.map((c) => [c[0], c[1]]);

  // Create line for calculations
  const line = turf.lineString(coordinates);

  // Calculate total distance in kilometers
  const totalDistance = turf.length(line, { units: 'kilometers' });

  // Calculate bounding box
  const bbox = turf.bbox(line);
  const bounds: Bounds = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];

  return { coordinates, points, totalDistance, bounds };
}

// ============================================
// Composable
// ============================================

export interface UseGpxLoaderReturn {
  /** Whether a GPX file is currently loading */
  isLoading: Ref<boolean>;
  /** Loading error message, if any */
  error: Ref<string | null>;
  /** Parsed GPS points with elevation data */
  gpsPoints: Ref<GpsPoint[]>;
  /** 2D coordinates for map display */
  routeCoordinates: Ref<Coordinate[]>;
  /** Route bounds for map fitting */
  bounds: Ref<Bounds | null>;
  /** Total route distance in kilometers */
  totalDistance: Ref<number>;
  /** First coordinate of the route */
  startingCoordinate: ComputedRef<Coordinate | null>;
  /** Whether route data has been loaded */
  hasData: ComputedRef<boolean>;
  /** Load a GPX file from URL */
  loadGpxFile: (url: string) => Promise<PathAnalysis>;
  /** Create GeoJSON for map display */
  createRouteGeoJson: () => GeoJSON.FeatureCollection;
  /** Clear loaded data */
  clearData: () => void;
}

/**
 * Composable for loading and parsing GPX files
 */
export function useGpxLoader(): UseGpxLoaderReturn {
  // Reactive state
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const gpsPoints = ref<GpsPoint[]>([]);
  const routeCoordinates = ref<Coordinate[]>([]);
  const bounds = ref<Bounds | null>(null);
  const totalDistance = ref(0);

  // Computed properties
  const startingCoordinate = computed<Coordinate | null>(() => {
    return routeCoordinates.value[0] ?? null;
  });

  const hasData = computed(() => routeCoordinates.value.length > 0);

  /**
   * Load and parse a GPX file from URL
   */
  async function loadGpxFile(url: string): Promise<PathAnalysis> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch GPX file: ${response.statusText}`);
      }

      const gpxData = await response.text();
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxData, 'application/xml');

      // Check for XML parsing errors
      const parseError = gpxDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Invalid GPX file format');
      }

      // Convert GPX to GeoJSON
      const geojson = gpx(gpxDoc);
      const analysis = analyzeGeoJson(geojson);

      // Update state
      gpsPoints.value = analysis.points;
      routeCoordinates.value = analysis.coordinates;
      bounds.value = analysis.bounds;
      totalDistance.value = analysis.totalDistance;

      return analysis;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading GPX file';
      error.value = message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create GeoJSON FeatureCollection for map display
   */
  function createRouteGeoJson(): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates.value,
          },
          properties: {},
        },
      ],
    };
  }

  /**
   * Clear all loaded data
   */
  function clearData(): void {
    gpsPoints.value = [];
    routeCoordinates.value = [];
    bounds.value = null;
    totalDistance.value = 0;
    error.value = null;
  }

  return {
    // State
    isLoading,
    error,
    gpsPoints,
    routeCoordinates,
    bounds,
    totalDistance,

    // Computed
    startingCoordinate,
    hasData,

    // Methods
    loadGpxFile,
    createRouteGeoJson,
    clearData,
  };
}
