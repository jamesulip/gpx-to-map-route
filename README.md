# GPX to Map Route

A Vue 3 application for visualizing and animating GPX route files on an interactive 3D Mapbox map with cinematic camera tracking modes.

![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)

## Features

- 🗺️ **3D Terrain Visualization** - Display routes on Mapbox with terrain elevation
- 🎬 **Cinematic Camera Modes** - 5 different camera tracking styles for route playback
- 📍 **GPX File Support** - Load and parse standard GPX route files
- ⚡ **Smooth Animations** - Physics-based camera damping for fluid movement
- 🎮 **Playback Controls** - Play, pause, and reset animations

## Getting Started

### Prerequisites

- Node.js 18+
- A [Mapbox Access Token](https://account.mapbox.com/access-tokens/)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

Update the Mapbox access token in `src/App.vue`:

```typescript
const MAPBOX_ACCESS_TOKEN = 'your-mapbox-token-here';
```

## Composables API

The application is built with modular Vue composables for flexibility and reusability.

### `useGpxAnimation`

Main composable that orchestrates GPX route animation with camera tracking.

```typescript
import { useGpxAnimation, TrackingMode } from './composables';

const {
  // State
  isAnimating,        // Ref<boolean> - Animation running state
  animationProgress,  // Ref<number> - Progress from 0 to 1
  currentPoint,       // ComputedRef<GpsPoint | null> - Current interpolated position
  bounds,             // Ref<Bounds | null> - Route bounding box
  hasData,            // ComputedRef<boolean> - Whether route is loaded

  // Methods
  loadGpxFile,        // (url: string) => Promise<PathAnalysis>
  createRouteGeoJson, // () => GeoJSON.FeatureCollection
  startAnimation,     // (mode: TrackingMode, onFrame: callback) => void
  pauseAnimation,     // () => void
  resetAnimation,     // () => void
  cleanup,            // () => void
} = useGpxAnimation({
  animationDuration: 50000,  // Animation length in ms (default: 50000)
  positionDamping: 0.04,     // Camera position smoothing (default: 0.04)
  bearingDamping: 0.02,      // Camera rotation smoothing (default: 0.02)
  velocityDecay: 0.92,       // Momentum decay factor (default: 0.92)
});

// Load a GPX file
await loadGpxFile('/path/to/route.gpx');

// Start animation with a tracking mode
startAnimation(TrackingMode.ACTIVE_TRACK_TRACE, (camera) => {
  // camera.center: [lng, lat]
  // camera.bearing: number (degrees)
  map.setCamera(camera.center, camera.bearing);
});
```

### Camera Tracking Modes

| Mode | Description |
|------|-------------|
| `TrackingMode.ACTIVE_TRACK_TRACE` | Camera follows behind the subject along the route |
| `TrackingMode.ACTIVE_TRACK_PARALLEL` | Camera tracks side-by-side with the subject |
| `TrackingMode.SPOTLIGHT` | Camera follows at a distance, always pointing at subject |
| `TrackingMode.POINT_OF_INTEREST` | Camera orbits around the moving subject |
| `TrackingMode.FIXED_OVERVIEW` | Camera stays fixed at route center, tracks subject |

### `useMapbox`

Composable for Mapbox GL initialization and map controls.

```typescript
import { useMapbox } from './composables';

const mapContainer = ref<HTMLElement | null>(null);

const {
  map,                    // ShallowRef<mapboxgl.Map | null>
  isMapLoaded,            // Ref<boolean>
  initializeMap,          // () => void
  addRouteLayer,          // (sourceId: string, geojson: any) => void
  addMarkerLayer,         // (sourceId: string, coords: [number, number]) => void
  updateMarkerPosition,   // (sourceId: string, coords: [number, number]) => void
  setCamera,              // (center: [number, number], bearing: number) => void
  animateToTopView,       // (bounds: Bounds) => Promise<void>
  animateToStartingView,  // (coord: [number, number]) => Promise<void>
  cleanup,                // () => void
} = useMapbox(mapContainer, {
  accessToken: 'your-mapbox-token',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [121.0, 13.4],
  zoom: 13,
  pitch: 60,
  bearing: 0,
});
```

### `useGpxLoader`

Standalone composable for loading and parsing GPX files.

```typescript
import { useGpxLoader } from './composables';

const {
  isLoading,
  error,
  gpsPoints,          // Array of { longitude, latitude, elevation }
  routeCoordinates,   // Array of [lng, lat] tuples
  bounds,
  totalDistance,      // Distance in kilometers
  startingCoordinate,
  hasData,
  loadGpxFile,
  createRouteGeoJson,
  clearData,
} = useGpxLoader();

const analysis = await loadGpxFile('/route.gpx');
console.log(`Route is ${analysis.totalDistance.toFixed(2)} km`);
```

### `useCameraDamping`

Composable for smooth, physics-based camera movement.

```typescript
import { useCameraDamping } from './composables';

const { apply, reset, updateConfig } = useCameraDamping({
  positionDamping: 0.04,
  bearingDamping: 0.02,
  velocityDecay: 0.92,
});

// In animation loop
const smoothCamera = apply({
  center: [lng, lat],
  bearing: 45,
});
```

### Custom Camera Strategies

Create custom camera behaviors using the strategy pattern:

```typescript
import { createCameraStrategies, getCameraPosition } from './composables';
import type { CameraStrategy, CameraStrategyContext } from './composables';

// Use built-in strategies
const strategies = createCameraStrategies();

// Or create a custom strategy
const myStrategy: CameraStrategy = {
  name: 'custom',
  getPosition(context: CameraStrategyContext) {
    const { center, currentIndex, progress, routeCoordinates } = context;
    // Calculate custom camera position
    return {
      center: [lng, lat],
      bearing: 0,
    };
  },
  reset() {
    // Optional: reset internal state
  },
};
```

## Project Structure

```
src/
├── composables/
│   ├── index.ts              # Public exports
│   ├── types.ts              # Shared types and interfaces
│   ├── cameraStrategies.ts   # Camera tracking strategies
│   ├── useGpxAnimation.ts    # Main animation orchestrator
│   ├── useGpxLoader.ts       # GPX file loading
│   ├── useCameraDamping.ts   # Camera smoothing
│   └── useMapbox.ts          # Mapbox integration
├── utils/
│   └── gpxParser.ts          # Legacy GPX parser (deprecated)
├── App.vue                   # Main application component
└── main.ts                   # Application entry point
```

## Types Reference

```typescript
// GPS point with optional elevation
interface GpsPoint {
  longitude: number;
  latitude: number;
  elevation?: number;
}

// Coordinate tuple [longitude, latitude]
type Coordinate = [number, number];

// Bounding box [[sw_lng, sw_lat], [ne_lng, ne_lat]]
type Bounds = [Coordinate, Coordinate];

// Camera position for map
interface CameraPosition {
  center: Coordinate;
  bearing: number;
}

// Result from loading a GPX file
interface PathAnalysis {
  coordinates: Coordinate[];
  points: GpsPoint[];
  totalDistance: number;
  bounds: Bounds;
}
```

## License

MIT
