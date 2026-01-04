import { ref, computed } from 'vue';
import { gpx } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import { interpolatePoint, type GpsPoint } from '../utils/gpxParser';

interface DampedCamera {
  lng: number;
  lat: number;
  bearing: number;
  velocity: {
    lng: number;
    lat: number;
    bearing: number;
  };
}

interface PathAnalysis {
  coordinates: [number, number][];
  points: GpsPoint[];
  totalDistance: number;
  bounds: [[number, number], [number, number]];
}

interface CameraPosition {
  center: [number, number];
  bearing: number;
}

export enum TrackingMode {
  ACTIVE_TRACK_TRACE = 'activeTrackTrace',
  ACTIVE_TRACK_PARALLEL = 'activeTrackParallel',
  SPOTLIGHT = 'spotlight',
  POINT_OF_INTEREST = 'pointOfInterest',
  FIXED_OVERVIEW = 'fixedOverview',
}

interface UseGpxAnimationOptions {
  animationDuration?: number;
  positionDamping?: number;
  bearingDamping?: number;
  velocityDecay?: number;
}

const DEFAULT_OPTIONS: Required<UseGpxAnimationOptions> = {
  animationDuration: 50000,
  positionDamping: 0.04,
  bearingDamping: 0.02,
  velocityDecay: 0.92,
};

export function useGpxAnimation(options: UseGpxAnimationOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Reactive state
  const isAnimating = ref(false);
  const animationProgress = ref(0);
  const gpsPoints = ref<GpsPoint[]>([]);
  const routeCoordinates = ref<[number, number][]>([]);

  // Internal state
  let dampedCamera: DampedCamera = {
    lng: 0,
    lat: 0,
    bearing: 0,
    velocity: { lng: 0, lat: 0, bearing: 0 },
  };
  let animationFrameId: number | null = null;
  let startTime: number | null = null;
  let currentTrackingMode: TrackingMode = TrackingMode.ACTIVE_TRACK_TRACE;
  let poiCenter: [number, number] | null = null;
  let overviewCenter: [number, number] | null = null;

  // Computed current point based on animation progress
  const currentPoint = computed(() => {
    if (gpsPoints.value.length < 2) return null;

    const totalSegments = gpsPoints.value.length - 1;
    const segmentIndex = Math.floor(animationProgress.value * totalSegments);
    const segmentProgress = (animationProgress.value * totalSegments) % 1;

    if (segmentIndex >= gpsPoints.value.length - 1) {
      return gpsPoints.value[gpsPoints.value.length - 1] || null;
    }

    const point1 = gpsPoints.value[segmentIndex];
    const point2 = gpsPoints.value[segmentIndex + 1];

    if (!point1 || !point2) return null;

    return interpolatePoint(point1, point2, segmentProgress);
  });

  // Analyze GeoJSON and extract original coordinates
  function analyzeGpxData(geojson: any): PathAnalysis {
    if (!geojson.features || geojson.features.length === 0) {
      return { coordinates: [], points: [], totalDistance: 0, bounds: [[0, 0], [0, 0]] };
    }

    const feature = geojson.features[0];
    const rawCoordinates = feature.geometry.coordinates as [number, number, number][];

    // Extract GPS points
    const points: GpsPoint[] = rawCoordinates.map((coord) => ({
      longitude: coord[0],
      latitude: coord[1],
      elevation: coord[2],
    }));

    // Extract 2D coordinates
    const coordinates: [number, number][] = rawCoordinates.map((c) => [c[0], c[1]]);

    // Create line from coordinates
    const line = turf.lineString(coordinates);

    // Calculate total distance
    const totalDistance = turf.length(line, { units: 'kilometers' });

    // Calculate bounds
    const bbox = turf.bbox(line);
    const bounds: [[number, number], [number, number]] = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];

    return { coordinates, points, totalDistance, bounds };
  }

  // Get camera position based on tracking mode
  function getCameraPosition(progress: number): CameraPosition | null {
    if (routeCoordinates.value.length < 2 || !currentPoint.value) return null;

    const center: [number, number] = [currentPoint.value.longitude, currentPoint.value.latitude];

    const totalSegments = routeCoordinates.value.length - 1;
    const currentIndex = Math.floor(progress * totalSegments);

    switch (currentTrackingMode) {
      case TrackingMode.ACTIVE_TRACK_TRACE:
        return getActiveTrackTrace(center, currentIndex);

      case TrackingMode.ACTIVE_TRACK_PARALLEL:
        return getActiveTrackParallel(center, currentIndex);

      case TrackingMode.SPOTLIGHT:
        return getSpotlight(center);

      case TrackingMode.POINT_OF_INTEREST:
        return getPointOfInterest(center, progress);

      case TrackingMode.FIXED_OVERVIEW:
        return getFixedOverview(center);

      default:
        return getActiveTrackTrace(center, currentIndex);
    }
  }

  // ActiveTrack Trace: Follow behind the subject
  function getActiveTrackTrace(center: [number, number], currentIndex: number): CameraPosition {
    const lookAheadDistance = Math.max(20, Math.floor(routeCoordinates.value.length * 0.05));
    const lookAheadIndex = Math.min(currentIndex + lookAheadDistance, routeCoordinates.value.length - 1);
    const lookAhead = routeCoordinates.value[lookAheadIndex];

    if (!lookAhead) return { center, bearing: 0 };

    // Direction of travel
    const directionBearing = turf.bearing(turf.point(center), turf.point(lookAhead));

    // Position camera behind the target
    const cameraDistance = 0.001; // ~100 meters at equator
    const behindBearing = directionBearing + 180; // Behind direction of travel
    const cameraPoint = turf.destination(turf.point(center), cameraDistance, behindBearing);
    const cameraPos = cameraPoint.geometry.coordinates as [number, number];

    // Camera bearing follows direction of travel (points forward)
    const bearing = directionBearing;

    return { center: cameraPos, bearing };
  }

  // ActiveTrack Parallel: Track side-by-side with subject
  function getActiveTrackParallel(center: [number, number], currentIndex: number): CameraPosition {
    const lookAheadDistance = Math.max(20, Math.floor(routeCoordinates.value.length * 0.05));
    const lookAheadIndex = Math.min(currentIndex + lookAheadDistance, routeCoordinates.value.length - 1);
    const lookAhead = routeCoordinates.value[lookAheadIndex];

    if (!lookAhead) return { center, bearing: 0 };

    // Direction of travel
    const directionBearing = turf.bearing(turf.point(center), turf.point(lookAhead));

    // Position camera to the side of the target
    const cameraDistance = 0.0008; // ~80 meters at equator
    const sideBearing = directionBearing + 90; // 90° to the right
    const cameraPoint = turf.destination(turf.point(center), cameraDistance, sideBearing);
    const cameraPos = cameraPoint.geometry.coordinates as [number, number];

    // Camera bearing points back at the target (parallel to direction)
    const bearing = turf.bearing(turf.point(cameraPos), turf.point(center));

    return { center: cameraPos, bearing };
  }

  // Spotlight: Camera follows target at a distance, always pointing at it
  function getSpotlight(center: [number, number]): CameraPosition {
    // Camera follows behind the target at a fixed distance
    const lookAheadDistance = Math.max(20, Math.floor(routeCoordinates.value.length * 0.08));
    const currentIndex = Math.floor(animationProgress.value * (routeCoordinates.value.length - 1));
    const lookAheadIndex = Math.min(currentIndex + lookAheadDistance, routeCoordinates.value.length - 1);

    // Get direction of travel
    const currentCoord = routeCoordinates.value[currentIndex] || center;
    const lookAheadCoord = routeCoordinates.value[lookAheadIndex] || center;

    if (!lookAheadCoord) return { center, bearing: 0 };

    const directionBearing = turf.bearing(turf.point(currentCoord), turf.point(lookAheadCoord));

    // Position camera behind and above the target
    const cameraDistance = 0.0015; // ~150 meters at equator
    const behindBearing = directionBearing + 180; // Behind direction of travel
    const cameraPoint = turf.destination(turf.point(center), cameraDistance, behindBearing);
    const cameraPos = cameraPoint.geometry.coordinates as [number, number];

    // Camera bearing points at the target
    const bearing = turf.bearing(turf.point(cameraPos), turf.point(center));

    return { center: cameraPos, bearing };
  }

  // Point of Interest: Orbit around a moving target
  function getPointOfInterest(center: [number, number], progress: number): CameraPosition {
    // Update POI center to follow the current target position
    poiCenter = center;

    // Orbit around the moving POI center
    const orbitDistance = 0.0012; // ~120 meters at equator
    const orbitAngle = progress * 360; // Full orbit
    
    const orbitBearing = orbitAngle + 180;

    const orbitPoint = turf.destination(turf.point(poiCenter), orbitDistance, orbitBearing);
    const orbitCoords = orbitPoint.geometry.coordinates as [number, number];
    const bearing = turf.bearing(turf.point(orbitCoords), turf.point(poiCenter));

    return { center: orbitCoords, bearing };
  }

  // Fixed Overview: Camera stays at route center, looks at moving target
  function getFixedOverview(center: [number, number]): CameraPosition {
    // Initialize overview center on first call
    if (!overviewCenter) {
      const bbox = turf.bbox(turf.lineString(routeCoordinates.value));
      overviewCenter = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
      ];
    }

    // Camera stays fixed at the center, bearing points at the target
    const bearing = turf.bearing(turf.point(overviewCenter), turf.point(center));

    return { center: overviewCenter, bearing };
  }

  // Apply smooth damping with momentum to camera movement
  function applyDamping(target: CameraPosition): CameraPosition {
    // Calculate target velocity
    const targetVelLng = (target.center[0] - dampedCamera.lng) * config.positionDamping;
    const targetVelLat = (target.center[1] - dampedCamera.lat) * config.positionDamping;

    // Apply momentum/smoothing to velocity
    dampedCamera.velocity.lng =
      dampedCamera.velocity.lng * config.velocityDecay + targetVelLng * (1 - config.velocityDecay);
    dampedCamera.velocity.lat =
      dampedCamera.velocity.lat * config.velocityDecay + targetVelLat * (1 - config.velocityDecay);

    // Apply velocity to position
    dampedCamera.lng += dampedCamera.velocity.lng;
    dampedCamera.lat += dampedCamera.velocity.lat;

    // Smooth bearing with wrap-around handling and momentum
    let bearingDiff = target.bearing - dampedCamera.bearing;
    if (bearingDiff > 180) bearingDiff -= 360;
    if (bearingDiff < -180) bearingDiff += 360;

    const targetBearingVel = bearingDiff * config.bearingDamping;
    dampedCamera.velocity.bearing =
      dampedCamera.velocity.bearing * config.velocityDecay + targetBearingVel * (1 - config.velocityDecay);
    dampedCamera.bearing += dampedCamera.velocity.bearing;

    // Normalize bearing to -180 to 180
    while (dampedCamera.bearing > 180) dampedCamera.bearing -= 360;
    while (dampedCamera.bearing < -180) dampedCamera.bearing += 360;

    return {
      center: [dampedCamera.lng, dampedCamera.lat],
      bearing: dampedCamera.bearing,
    };
  }

  // Reset damped camera to initial position
  function resetDampedCamera() {
    const firstPoint = routeCoordinates.value[0];
    if (routeCoordinates.value.length > 0 && firstPoint) {
      dampedCamera.lng = firstPoint[0];
      dampedCamera.lat = firstPoint[1];
      dampedCamera.bearing = 0;
      dampedCamera.velocity = { lng: 0, lat: 0, bearing: 0 };
    }
  }

  // Parse GPX file and initialize paths
  async function loadGpxFile(gpxUrl: string): Promise<PathAnalysis> {
    const response = await fetch(gpxUrl);
    const gpxData = await response.text();
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxData, 'application/xml');
    const geojson = gpx(gpxDoc);

    const analysis = analyzeGpxData(geojson);
    gpsPoints.value = analysis.points;
    routeCoordinates.value = analysis.coordinates;

    // Initialize damped camera to first point
    resetDampedCamera();

    return analysis;
  }

  // Create GeoJSON for map display using original coordinates
  function createRouteGeoJson() {
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: routeCoordinates.value,
          },
          properties: {},
        },
      ],
    };
  }

  // Animation control functions
  function startAnimation(trackingMode: TrackingMode = TrackingMode.ACTIVE_TRACK_TRACE, onFrame: (camera: CameraPosition) => void) {
    if (isAnimating.value || gpsPoints.value.length === 0) return;

    currentTrackingMode = trackingMode;
    poiCenter = null; // Reset POI center for new animation
    overviewCenter = null; // Reset overview center for new animation
    isAnimating.value = true;
    startTime = performance.now();
    resetDampedCamera();

    function animate(currentTime: number) {
      if (!startTime) return;

      const elapsed = currentTime - startTime;
      animationProgress.value = Math.min(elapsed / config.animationDuration, 1);

      if (currentPoint.value) {
        const targetCamera = getCameraPosition(animationProgress.value);
        if (targetCamera) {
          const smoothCamera = applyDamping(targetCamera);
          onFrame(smoothCamera);
        }
      }

      if (animationProgress.value < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isAnimating.value = false;
        startTime = null;
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function pauseAnimation() {
    isAnimating.value = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function resetAnimation() {
    pauseAnimation();
    animationProgress.value = 0;
    startTime = null;
    resetDampedCamera();
  }

  function cleanup() {
    pauseAnimation();
  }

  return {
    // State
    isAnimating,
    animationProgress,
    gpsPoints,
    routeCoordinates,
    currentPoint,

    // Methods
    loadGpxFile,
    createRouteGeoJson,
    startAnimation,
    pauseAnimation,
    resetAnimation,
    cleanup,
  };
}
