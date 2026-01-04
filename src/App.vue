<script setup lang="ts">
import 'mapbox-gl/dist/mapbox-gl.css';
import { ref, onMounted, onUnmounted } from 'vue';
import { useGpxAnimation, useMapbox, TrackingMode } from './composables';
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, RotateCcw, MapPin, ArrowLeftRight, Lightbulb, Target, Binoculars, ArrowUp, Flag } from 'lucide-vue-next'
// ============================================
// Configuration
// ============================================

const MAPBOX_ACCESS_TOKEN = 'REMOVED';
const GPX_FILE_URL = '/Morning_Hike.gpx';
const INITIAL_CENTER: [number, number] = [121.093642, 13.376087];

// ============================================
// Refs
// ============================================

const mapContainer = ref<HTMLElement | null>(null);
const selectedTrackingMode = ref<TrackingMode>(TrackingMode.ACTIVE_TRACK_TRACE);

// ============================================
// Composables
// ============================================

const {
  isAnimating,
  animationProgress,
  hasData,
  currentPoint,
  bounds,
  routeCoordinates,
  loadGpxFile,
  createRouteGeoJson,
  startAnimation: startGpxAnimation,
  pauseAnimation,
  resetAnimation,
  cleanup: cleanupAnimation,
} = useGpxAnimation();

const {
  initializeMap,
  addRouteLayer,
  addMarkerLayer,
  updateMarkerPosition,
  setCamera,
  animateToTopView,
  animateToStartingView,
  cleanup: cleanupMap,
} = useMapbox(mapContainer, {
  accessToken: MAPBOX_ACCESS_TOKEN,
  center: INITIAL_CENTER,
});

// ============================================
// Animation Handlers
// ============================================

function handleAnimationFrame(camera: { center: [number, number]; bearing: number }) {
  if (currentPoint.value) {
    updateMarkerPosition('marker-source', [
      currentPoint.value.longitude,
      currentPoint.value.latitude,
    ]);
  }
  setCamera(camera.center, camera.bearing);
}

async function startAnimation() {
  if (!bounds.value || !routeCoordinates.value[0]) return;

  await animateToTopView(bounds.value);
  await animateToStartingView(routeCoordinates.value[0]);
  startGpxAnimation(selectedTrackingMode.value, handleAnimationFrame);
}

// ============================================
// Route Initialization
// ============================================

async function initializeRoute() {
  try {
    const analysis = await loadGpxFile(GPX_FILE_URL);

    if (analysis.coordinates.length > 0) {
      addRouteLayer('route-source', createRouteGeoJson());
      await animateToTopView(analysis.bounds);

      const firstCoord = analysis.coordinates[0];
      if (firstCoord) {
        addMarkerLayer('marker-source', firstCoord);
      }
    }
  } catch (err) {
    console.error('Error loading GPX:', err);
  }
}

// ============================================
// View Controls
// ============================================

function showTopView() {
  if (bounds.value) {
    animateToTopView(bounds.value);
  }
}

function showStartingView() {
  const startCoord = routeCoordinates.value[0];
  if (startCoord) {
    animateToStartingView(startCoord);
  }
}

// ============================================
// Lifecycle
// ============================================

onMounted(() => {
  initializeMap();
  setTimeout(initializeRoute, 1000);
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupMap();
});
</script>

<template>
  <div style="position: relative; height: 100vh; width: 100%;">
    <div ref="mapContainer" style="height: 100%; width: 100%;"></div>
    
    <!-- Animation Controls -->
    <div style="
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 20px 25px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
      max-width: 90vw;
      z-index: 1000;
      border: 1px solid rgba(0, 0, 0, 0.05);
    ">
      <!-- Play/Pause Controls -->
      <Button @click="startAnimation" :disabled="isAnimating || !hasData" size="sm">
        <Play class="w-4 h-4 mr-2" />
        Play
      </Button>

      <Button @click="pauseAnimation" :disabled="!isAnimating" variant="outline" size="sm">
        <Pause class="w-4 h-4 mr-2" />
        Pause
      </Button>

      <Button @click="resetAnimation" variant="secondary" size="sm">
        <RotateCcw class="w-4 h-4 mr-2" />
        Reset
      </Button>

      <div style="width: 1px; height: 24px; background-color: #e0e0e0;"></div>

      <!-- Tracking Mode Toggle Group -->
      <ToggleGroup type="single" :value="selectedTrackingMode" @update:value="selectedTrackingMode = $event" size="sm" :disabled="isAnimating || !hasData">
        <ToggleGroupItem :value="TrackingMode.ACTIVE_TRACK_TRACE" aria-label="Trace mode">
          <MapPin class="w-4 h-4 mr-2" />
          Trace
        </ToggleGroupItem>
        <ToggleGroupItem :value="TrackingMode.ACTIVE_TRACK_PARALLEL" aria-label="Parallel mode">
          <ArrowLeftRight class="w-4 h-4 mr-2" />
          Parallel
        </ToggleGroupItem>
        <ToggleGroupItem :value="TrackingMode.SPOTLIGHT" aria-label="Spotlight mode">
          <Lightbulb class="w-4 h-4 mr-2" />
          Spotlight
        </ToggleGroupItem>
        <ToggleGroupItem :value="TrackingMode.POINT_OF_INTEREST" aria-label="POI mode">
          <Target class="w-4 h-4 mr-2" />
          POI
        </ToggleGroupItem>
        <ToggleGroupItem :value="TrackingMode.FIXED_OVERVIEW" aria-label="Overview mode">
          <Binoculars class="w-4 h-4 mr-2" />
          Overview
        </ToggleGroupItem>
      </ToggleGroup>

      <div style="width: 1px; height: 24px; background-color: #e0e0e0;"></div>

      <Button @click="showTopView" :disabled="!bounds" variant="secondary" size="sm">
        <ArrowUp class="w-4 h-4 mr-2" />
        Top View
      </Button>

      <Button @click="showStartingView" :disabled="!hasData" variant="secondary" size="sm">
        <Flag class="w-4 h-4 mr-2" />
        Start View
      </Button>

      <!-- Progress bar -->
      <div style="flex: 1; min-width: 150px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <Progress :model-value="animationProgress * 100" class="flex-1" style="min-width: 120px;" />
          <span style="font-size: 12px; color: #666; min-width: 40px; text-align: right;">
            {{ Math.round(animationProgress * 100) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>