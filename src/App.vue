<script setup lang="ts">
import 'mapbox-gl/dist/mapbox-gl.css';
import { ref, onMounted, onUnmounted } from 'vue';
import { useGpxAnimation, useMapbox, TrackingMode } from './composables';

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
  // Wait for map to be ready before loading route
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
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      max-width: 90vw;
      z-index: 1000;
    ">
      <!-- Play/Pause Controls -->
      <button @click="startAnimation" :disabled="isAnimating || !hasData" :style="{
        padding: '8px 16px',
        backgroundColor: '#00BFFF',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
        opacity: isAnimating || !hasData ? 0.5 : 1,
      }">
        ▶ Play
      </button>

      <button @click="pauseAnimation" :disabled="!isAnimating" :style="{
        padding: '8px 16px',
        backgroundColor: '#FF6B35',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
        opacity: !isAnimating ? 0.5 : 1,
      }">
        ⏸ Pause
      </button>

      <button @click="resetAnimation" style="
          padding: 8px 16px;
          background-color: #888;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        ">
        ⟲ Reset
      </button>

      <div style="width: 1px; height: 24px; background-color: #ddd;"></div>

      <!-- Tracking Mode Buttons -->
      <button 
        @click="selectedTrackingMode = TrackingMode.ACTIVE_TRACK_TRACE" 
        :disabled="isAnimating || !hasData"
        :style="{
          padding: '8px 16px',
          backgroundColor: selectedTrackingMode === TrackingMode.ACTIVE_TRACK_TRACE ? '#FF9800' : '#BDBDBD',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isAnimating || !hasData ? 0.5 : 1,
        }">
        📍 Trace
      </button>

      <button 
        @click="selectedTrackingMode = TrackingMode.ACTIVE_TRACK_PARALLEL" 
        :disabled="isAnimating || !hasData"
        :style="{
          padding: '8px 16px',
          backgroundColor: selectedTrackingMode === TrackingMode.ACTIVE_TRACK_PARALLEL ? '#FF9800' : '#BDBDBD',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isAnimating || !hasData ? 0.5 : 1,
        }">
        ↔ Parallel
      </button>

      <button 
        @click="selectedTrackingMode = TrackingMode.SPOTLIGHT" 
        :disabled="isAnimating || !hasData"
        :style="{
          padding: '8px 16px',
          backgroundColor: selectedTrackingMode === TrackingMode.SPOTLIGHT ? '#FF9800' : '#BDBDBD',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isAnimating || !hasData ? 0.5 : 1,
        }">
        💡 Spotlight
      </button>

      <button 
        @click="selectedTrackingMode = TrackingMode.POINT_OF_INTEREST" 
        :disabled="isAnimating || !hasData"
        :style="{
          padding: '8px 16px',
          backgroundColor: selectedTrackingMode === TrackingMode.POINT_OF_INTEREST ? '#FF9800' : '#BDBDBD',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isAnimating || !hasData ? 0.5 : 1,
        }">
        🎯 POI
      </button>

      <button 
        @click="selectedTrackingMode = TrackingMode.FIXED_OVERVIEW" 
        :disabled="isAnimating || !hasData"
        :style="{
          padding: '8px 16px',
          backgroundColor: selectedTrackingMode === TrackingMode.FIXED_OVERVIEW ? '#FF9800' : '#BDBDBD',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isAnimating || !hasData ? 0.5 : 1,
        }">
        🔭 Overview
      </button>

      <div style="width: 1px; height: 24px; background-color: #ddd;"></div>

      <button @click="showTopView" :disabled="!bounds" :style="{
        padding: '8px 16px',
        backgroundColor: '#9C27B0',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
        opacity: !bounds ? 0.5 : 1,
      }">
        ⬆ Top View
      </button>

      <button @click="showStartingView" :disabled="!hasData" :style="{
        padding: '8px 16px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: '500',
        opacity: !hasData ? 0.5 : 1,
      }">
        🏁 Start View
      </button>

      <!-- Progress bar -->
      <div style="
        flex: 1;
        min-width: 200px;
        height: 6px;
        background-color: #ddd;
        border-radius: 3px;
        overflow: hidden;
      ">
        <div :style="{
          height: '100%',
          backgroundColor: '#00BFFF',
          width: '100%',
          transform: `scaleX(${animationProgress})`,
          transformOrigin: 'left',
          transition: 'transform 0.05s linear',
        }"></div>
      </div>

      <span style="font-size: 12px; color: #666; min-width: 50px;">
        {{ Math.round(animationProgress * 100) }}%
      </span>
    </div>
  </div>
</template>