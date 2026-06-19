<script setup lang="ts">
import 'mapbox-gl/dist/mapbox-gl.css';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGpxAnimation, useMapbox, TrackingMode } from '../composables';
import { useKeyframeAnimation } from '../composables/useKeyframeAnimation';
import { createCameraStrategies, getCameraPosition } from '../composables/cameraStrategies';
import type { Keyframe, EasingType } from '../composables/keyframeTypes';
import { Button } from '@/components/ui/button';

import { Toggle } from '@/components/ui/toggle';
import { Timeline, KeyframeEditor, KeyframeTrack } from '@/components/ui/timeline';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  ChevronUp,
  Eye,
  ZoomIn,
  Compass,
  Camera,
  Video,
  Settings,
  Layers,
  SkipBack,
  SkipForward,
  Maximize2,
  Frame,
} from 'lucide-vue-next';

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
const isKeyframeEditorOpen = ref(true);
const editingKeyframe = ref<Keyframe | null>(null);
const selectedKeyframeId = ref<string | null>(null);
const instantPreview = ref(true); // When true, camera jumps instantly; when false, animates smoothly
const useKeyframeCamera = ref(true); // When true, use keyframe camera; when false, use camera strategy
const selectedCameraMode = ref<TrackingMode>(TrackingMode.ACTIVE_TRACK_TRACE);
const isBottomPanelExpanded = ref(true); // Bottom timeline panel state
const showMultiTrack = ref(false); // Toggle between simple timeline and multi-track view
const selectedAspectRatio = ref<string>('free'); // Aspect ratio for export
const showAspectRatioOverlay = ref(false); // Show aspect ratio frame overlay

// Aspect ratio options
type AspectRatioOption = {
  value: string;
  label: string;
  ratio: number | null; // width/height, null means free/no constraint
};

const aspectRatioOptions: AspectRatioOption[] = [
  { value: 'free', label: 'Free', ratio: null },
  { value: '16:9', label: '16:9 (HD)', ratio: 16/9 },
  { value: '9:16', label: '9:16 (Vertical)', ratio: 9/16 },
  { value: '4:3', label: '4:3 (Classic)', ratio: 4/3 },
  { value: '1:1', label: '1:1 (Square)', ratio: 1 },
  { value: '21:9', label: '21:9 (Ultra-wide)', ratio: 21/9 },
  { value: '4:5', label: '4:5 (Instagram)', ratio: 4/5 },
];

// Camera strategies
const cameraStrategies = createCameraStrategies();

// Actual camera state from Mapbox (updated in real-time)
const actualCameraState = ref({
  pitch: 0,
  zoom: 15,
  bearing: 0,
  center: [0, 0] as [number, number],
});

// Form state for new/edit keyframe
const keyframeForm = ref({
  progress: 0,
  altitude: 500,
  pitch: 60,
  zoom: 15,
  bearingOffset: 0,
  cameraDistance: 0.001,
  easing: 'easeInOut' as EasingType,
  label: '',
});

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
  resetAnimation: resetGpxAnimation,
  cleanup: cleanupAnimation,
} = useGpxAnimation();

const {
  keyframes,
  addKeyframe,
  updateKeyframe,
  removeKeyframe,
  getInterpolatedState,
  clearKeyframes,
  importKeyframes,
  exportKeyframes,
} = useKeyframeAnimation();

const {
  map,
  initializeMap,
  addRouteLayer,
  addMarkerLayer,
  updateMarkerPosition,
  animateToTopView,
  animateToStartingView,
  cleanup: cleanupMap,
} = useMapbox(mapContainer, {
  accessToken: MAPBOX_ACCESS_TOKEN,
  center: INITIAL_CENTER,
});

// ============================================
// Computed
// ============================================

const sortedKeyframes = computed(() =>
  [...keyframes.value].sort((a, b) => a.progress - b.progress)
);

// Format current time for display
const formatCurrentTime = computed(() => {
  const totalSeconds = animationProgress.value * 60; // Assuming 60 second duration
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
});

// Get current aspect ratio value
const currentAspectRatio = computed(() => {
  const option = aspectRatioOptions.find(opt => opt.value === selectedAspectRatio.value);
  return option?.ratio ?? null;
});

// Check if current aspect ratio is vertical (portrait)
const isVerticalAspect = computed(() => {
  return currentAspectRatio.value !== null && currentAspectRatio.value < 1;
});

// ============================================
// Animation Handlers
// ============================================

function handleAnimationFrame(_camera: { center: [number, number]; bearing: number }) {
  if (!map.value || !currentPoint.value) return;
  
  // Update marker position (the moving point on the route)
  const markerPos: [number, number] = [
    currentPoint.value.longitude,
    currentPoint.value.latitude,
  ];
  updateMarkerPosition('marker-source', markerPos);

  // Get keyframe interpolated state based on current animation progress
  const progress = animationProgress.value;
  const keyframeState = getInterpolatedState(progress);
  
  if (useKeyframeCamera.value) {
    // Use keyframe camera position if available, otherwise use current point
    const center: [number, number] = keyframeState.cameraPosition 
      ? keyframeState.cameraPosition
      : markerPos;
    
    // Apply camera purely from keyframe values
    map.value.jumpTo({
      center: center,
      bearing: keyframeState.bearingOffset,
      pitch: keyframeState.pitch,
      zoom: keyframeState.zoom,
    });
  } else {
    // Use camera strategy
    const currentIndex = Math.floor(progress * (routeCoordinates.value.length - 1));
    const cameraPosition = getCameraPosition(
      selectedCameraMode.value,
      {
        center: markerPos,
        currentIndex,
        routeCoordinates: routeCoordinates.value,
        progress,
      },
      cameraStrategies
    );
    
    map.value.jumpTo({
      center: cameraPosition.center,
      bearing: cameraPosition.bearing,
      pitch: keyframeState.pitch,
      zoom: keyframeState.zoom,
    });
  }
}

async function startAnimation() {
  if (!bounds.value || !routeCoordinates.value[0]) return;

  // Get initial keyframe state for the starting view
  const initialState = getInterpolatedState(0);

  await animateToTopView(bounds.value);
  await animateToStartingView(routeCoordinates.value[0], 0, {
    pitch: initialState.pitch,
    zoom: initialState.zoom,
  });
  
  startGpxAnimation(TrackingMode.ACTIVE_TRACK_TRACE, handleAnimationFrame);
}

function resetAnimation() {
  resetGpxAnimation();
  if (map.value && routeCoordinates.value[0]) {
    animateToStartingView(routeCoordinates.value[0]);
  }
}

// ============================================
// Keyframe Methods
// ============================================

function addKeyframeAtCurrentProgress() {
  if (!map.value) return;
  
  // Get ACTUAL current camera state from the map
  const currentCenter = map.value.getCenter();
  const currentPitch = map.value.getPitch();
  const currentZoom = map.value.getZoom();
  const currentBearing = map.value.getBearing();
  
  addKeyframe({
    progress: animationProgress.value,
    altitude: 500,
    pitch: currentPitch,
    zoom: currentZoom,
    bearingOffset: currentBearing,
    cameraDistance: 0.001,
    cameraPosition: [currentCenter.lng, currentCenter.lat], // Capture camera center
    easing: 'easeInOut',
    label: `Keyframe ${keyframes.value.length + 1}`,
  });
}

function openKeyframeEditor(keyframe: Keyframe) {
  editingKeyframe.value = keyframe;
  selectedKeyframeId.value = keyframe.id;
  keyframeForm.value = {
    progress: keyframe.progress,
    altitude: keyframe.altitude ?? 500,
    pitch: keyframe.pitch ?? 60,
    zoom: keyframe.zoom ?? 15,
    bearingOffset: keyframe.bearingOffset ?? 0,
    cameraDistance: keyframe.cameraDistance ?? 0.001,
    easing: keyframe.easing ?? 'easeInOut',
    label: keyframe.label ?? '',
  };
}

function closeKeyframeEditor() {
  editingKeyframe.value = null;
  selectedKeyframeId.value = null;
}

function deleteKeyframe(id: string) {
  removeKeyframe(id);
  if (selectedKeyframeId.value === id) {
    closeKeyframeEditor();
  }
}

function duplicateKeyframe() {
  if (!editingKeyframe.value) return;
  const kf = editingKeyframe.value;
  addKeyframe({
    progress: Math.min(1, kf.progress + 0.05),
    altitude: kf.altitude,
    pitch: kf.pitch,
    zoom: kf.zoom,
    bearingOffset: kf.bearingOffset,
    cameraDistance: kf.cameraDistance,
    cameraPosition: kf.cameraPosition,
    easing: kf.easing,
    label: `${kf.label || 'Keyframe'} (copy)`,
  });
}

function handleTimelineSelect(keyframe: Keyframe) {
  openKeyframeEditor(keyframe);
  seekToProgress(keyframe.progress);
}

function handleKeyframeMove(id: string, progress: number) {
  updateKeyframe(id, { progress });
}

function handleAddKeyframeAtProgress(progress: number) {
  if (!map.value) return;
  
  // Seek to position first
  seekToProgress(progress);
  
  // Then add keyframe with current camera state
  setTimeout(() => {
    const currentCenter = map.value!.getCenter();
    const currentPitch = map.value!.getPitch();
    const currentZoom = map.value!.getZoom();
    const currentBearing = map.value!.getBearing();
    
    addKeyframe({
      progress,
      altitude: 500,
      pitch: currentPitch,
      zoom: currentZoom,
      bearingOffset: currentBearing,
      cameraDistance: 0.001,
      cameraPosition: [currentCenter.lng, currentCenter.lat],
      easing: 'easeInOut',
      label: `Keyframe ${keyframes.value.length + 1}`,
    });
  }, 100);
}

function handleKeyframeUpdate(updates: Partial<Keyframe>) {
  if (!editingKeyframe.value) return;
  updateKeyframe(editingKeyframe.value.id, updates);
  
  // Update local editing keyframe reference
  editingKeyframe.value = {
    ...editingKeyframe.value,
    ...updates,
  };
  
  // Preview the change
  if (updates.progress !== undefined) {
    seekToProgress(updates.progress);
  }
}

function goToPreviousKeyframe() {
  const currentProgress = animationProgress.value;
  const prevKeyframe = sortedKeyframes.value
    .filter(kf => kf.progress < currentProgress - 0.001)
    .pop();
  if (prevKeyframe) {
    seekToProgress(prevKeyframe.progress);
    openKeyframeEditor(prevKeyframe);
  }
}

function goToNextKeyframe() {
  const currentProgress = animationProgress.value;
  const nextKeyframe = sortedKeyframes.value
    .find(kf => kf.progress > currentProgress + 0.001);
  if (nextKeyframe) {
    seekToProgress(nextKeyframe.progress);
    openKeyframeEditor(nextKeyframe);
  }
}

function handleExport() {
  const data = exportKeyframes();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'keyframes.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      importKeyframes(data);
    } catch (err) {
      console.error('Failed to import keyframes:', err);
    }
  };
  input.click();
}

function seekToProgress(progress: number) {
  // Update the animation progress
  animationProgress.value = progress;
  
  // Get marker position based on current point
  const markerPos: [number, number] | null = currentPoint.value 
    ? [currentPoint.value.longitude, currentPoint.value.latitude]
    : null;
  
  // Update marker position
  if (markerPos) {
    updateMarkerPosition('marker-source', markerPos);
  }
  
  // Update camera preview
  if (map.value) {
    const keyframeState = getInterpolatedState(progress);
    
    let cameraCenter: [number, number];
    let cameraBearing: number;
    
    if (useKeyframeCamera.value) {
      // Use keyframe camera position if available
      cameraCenter = keyframeState.cameraPosition 
        ? keyframeState.cameraPosition
        : markerPos 
          ? markerPos
          : map.value.getCenter().toArray() as [number, number];
      cameraBearing = keyframeState.bearingOffset;
    } else {
      // Use camera strategy
      const currentIndex = Math.floor(progress * (routeCoordinates.value.length - 1));
      const strategyCenter = markerPos || map.value.getCenter().toArray() as [number, number];
      
      const cameraPosition = getCameraPosition(
        selectedCameraMode.value,
        {
          center: strategyCenter,
          currentIndex,
          routeCoordinates: routeCoordinates.value,
          progress,
        },
        cameraStrategies
      );
      
      cameraCenter = cameraPosition.center;
      cameraBearing = cameraPosition.bearing;
    }
    
    if (instantPreview.value) {
      // Instant jump to position - no animation
      map.value.jumpTo({
        center: cameraCenter,
        bearing: cameraBearing,
        pitch: keyframeState.pitch,
        zoom: keyframeState.zoom,
      });
    } else {
      // Smooth animation to position
      map.value.easeTo({
        center: cameraCenter,
        bearing: cameraBearing,
        pitch: keyframeState.pitch,
        zoom: keyframeState.zoom,
        duration: 500,
      });
    }
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

// Add default keyframes based on route coordinates
function addDefaultKeyframes() {
  if (keyframes.value.length === 0 && routeCoordinates.value.length > 0) {
    const coords = routeCoordinates.value;
    const startCoord = coords[0];
    const quarterCoord = coords[Math.floor(coords.length * 0.25)];
    const midCoord = coords[Math.floor(coords.length * 0.5)];
    const threeQuarterCoord = coords[Math.floor(coords.length * 0.75)];
    const endCoord = coords[coords.length - 1];
    
    if (startCoord) {
      addKeyframe({
        progress: 0,
        pitch: 60,
        zoom: 16,
        altitude: 300,
        bearingOffset: 0,
        cameraPosition: startCoord,
        easing: 'easeOut',
        label: 'Start',
      });
    }
    
    if (quarterCoord) {
      addKeyframe({
        progress: 0.25,
        pitch: 70,
        zoom: 15,
        altitude: 600,
        bearingOffset: 45,
        cameraPosition: quarterCoord,
        easing: 'easeInOut',
        label: '25%',
      });
    }
    
    if (midCoord) {
      addKeyframe({
        progress: 0.5,
        pitch: 45,
        zoom: 14,
        altitude: 1000,
        bearingOffset: 90,
        cameraPosition: midCoord,
        easing: 'easeInOut',
        label: 'Mid',
      });
    }
    
    if (threeQuarterCoord) {
      addKeyframe({
        progress: 0.75,
        pitch: 60,
        zoom: 15,
        altitude: 500,
        bearingOffset: 135,
        cameraPosition: threeQuarterCoord,
        easing: 'easeIn',
        label: '75%',
      });
    }
    
    if (endCoord) {
      addKeyframe({
        progress: 1,
        pitch: 60,
        zoom: 16,
        altitude: 300,
        bearingOffset: 180,
        cameraPosition: endCoord,
        easing: 'linear',
        label: 'End',
      });
    }
  }
}

// ============================================
// Lifecycle
// ============================================

onMounted(() => {
  initializeMap();
  setTimeout(() => {
    initializeRoute();
    addDefaultKeyframes();
    
    // Listen for camera changes to update actual camera state
    if (map.value) {
      map.value.on('move', () => {
        if (map.value) {
          actualCameraState.value = {
            pitch: map.value.getPitch(),
            zoom: map.value.getZoom(),
            bearing: map.value.getBearing(),
            center: map.value.getCenter().toArray() as [number, number],
          };
        }
      });
    }
  }, 1000);
});

onUnmounted(() => {
  cleanupAnimation();
  cleanupMap();
});

// ============================================
// Easing options for select
// ============================================

const easingOptions: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In Out' },
  { value: 'easeInQuad', label: 'Ease In Quad' },
  { value: 'easeOutQuad', label: 'Ease Out Quad' },
  { value: 'easeInOutQuad', label: 'Ease In Out Quad' },
  { value: 'easeInCubic', label: 'Ease In Cubic' },
  { value: 'easeOutCubic', label: 'Ease Out Cubic' },
  { value: 'easeInOutCubic', label: 'Ease In Out Cubic' },
];

// Camera strategy options
const cameraModeOptions: { value: TrackingMode; label: string }[] = [
  { value: TrackingMode.ACTIVE_TRACK_TRACE, label: 'Follow Behind' },
  { value: TrackingMode.ACTIVE_TRACK_PARALLEL, label: 'Side View' },
  { value: TrackingMode.SPOTLIGHT, label: 'Spotlight' },
  { value: TrackingMode.POINT_OF_INTEREST, label: 'Orbit' },
  { value: TrackingMode.FIXED_OVERVIEW, label: 'Overview' },
];
</script>

<template>
  <div class="relative h-screen w-full flex flex-col bg-gray-900">
    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Map Container -->
      <div class="flex-1 relative">
        <div ref="mapContainer" class="h-full w-full" />

        <!-- Aspect Ratio Overlay -->
        <div 
          v-if="showAspectRatioOverlay && currentAspectRatio"
          class="aspect-ratio-overlay"
        >
          <div 
            class="aspect-frame"
            :class="{ 'vertical': isVerticalAspect }"
            :style="{ aspectRatio: currentAspectRatio }"
          >
            <div class="frame-corners">
              <div class="corner tl" />
              <div class="corner tr" />
              <div class="corner bl" />
              <div class="corner br" />
            </div>
            <div class="frame-label">{{ selectedAspectRatio }}</div>
          </div>
        </div>

        <!-- Top Bar - Camera Info & Controls -->
        <div class="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
          <!-- Camera State Display -->
          <div class="camera-info-panel pointer-events-auto">
            <div class="panel-header">
              <Camera :size="14" />
              <span>Camera</span>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <Eye :size="12" />
                <span>{{ Math.round(actualCameraState.pitch) }}°</span>
              </div>
              <div class="info-item">
                <ZoomIn :size="12" />
                <span>{{ actualCameraState.zoom.toFixed(1) }}</span>
              </div>
              <div class="info-item">
                <Compass :size="12" />
                <span>{{ Math.round(actualCameraState.bearing) }}°</span>
              </div>
            </div>
          </div>

          <!-- View Controls -->
          <div class="flex gap-2 pointer-events-auto">
            <Button 
              @click="showTopView" 
              :disabled="!bounds" 
              variant="secondary" 
              size="sm"
              class="control-btn"
            >
              <Maximize2 :size="14" class="mr-1" />
              Overview
            </Button>
          </div>
        </div>
      </div>

      <!-- Right Sidebar - Keyframe Editor -->
      <div 
        :class="[
          'transition-all duration-300 flex flex-col border-l border-gray-800',
          isKeyframeEditorOpen ? 'w-80' : 'w-0'
        ]"
      >
        <div v-if="isKeyframeEditorOpen" class="flex-1 flex flex-col overflow-hidden bg-gray-900">
          <!-- Sidebar Header -->
          <div class="sidebar-header">
            <div class="flex items-center gap-2">
              <Layers :size="16" />
              <span class="font-semibold">Keyframes</span>
              <span class="keyframe-count">{{ keyframes.length }}</span>
            </div>
            <div class="flex gap-1">
              <button class="icon-btn" @click="handleImport" title="Import">
                <Upload :size="14" />
              </button>
              <button class="icon-btn" @click="handleExport" title="Export">
                <Download :size="14" />
              </button>
              <button class="icon-btn danger" @click="clearKeyframes" title="Clear All">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <!-- Keyframe Editor Component -->
          <div class="flex-1 overflow-y-auto p-3">
            <KeyframeEditor
              :keyframe="editingKeyframe"
              :easing-options="easingOptions"
              @update="handleKeyframeUpdate"
              @delete="editingKeyframe && deleteKeyframe(editingKeyframe.id)"
              @duplicate="duplicateKeyframe"
              @close="closeKeyframeEditor"
            />
          </div>

          <!-- Quick Actions -->
          <div class="sidebar-footer">
            <Button 
              @click="addKeyframeAtCurrentProgress" 
              size="sm" 
              class="w-full add-keyframe-btn"
            >
              <Plus :size="14" class="mr-2" />
              Add at {{ Math.round(animationProgress * 100) }}%
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Timeline Panel -->
    <div 
      :class="[
        'timeline-panel transition-all duration-300',
        isBottomPanelExpanded ? 'h-48' : 'h-14'
      ]"
    >
      <!-- Panel Header with Playback Controls -->
      <div class="timeline-header">
        <button 
          class="expand-toggle"
          @click="isBottomPanelExpanded = !isBottomPanelExpanded"
        >
          <ChevronUp :size="16" :class="{ 'rotate-180': !isBottomPanelExpanded }" />
        </button>

        <!-- Playback Controls -->
        <div class="playback-controls">
          <button class="playback-btn" @click="resetAnimation" title="Reset">
            <RotateCcw :size="14" />
          </button>
          
          <button class="playback-btn" @click="goToPreviousKeyframe" title="Previous Keyframe">
            <SkipBack :size="14" />
          </button>

          <button 
            class="playback-btn primary"
            @click="isAnimating ? pauseAnimation() : startAnimation()"
            :disabled="!hasData"
          >
            <Pause v-if="isAnimating" :size="16" />
            <Play v-else :size="16" />
          </button>

          <button class="playback-btn" @click="goToNextKeyframe" title="Next Keyframe">
            <SkipForward :size="14" />
          </button>

          <button 
            class="playback-btn accent" 
            @click="addKeyframeAtCurrentProgress"
            title="Add Keyframe"
          >
            <Plus :size="14" />
          </button>
        </div>
        
        <div class="timeline-title">
          <span class="current-time">{{ formatCurrentTime }}</span>
          <span class="separator">/</span>
          <span class="total-time">1:00</span>
        </div>

        <!-- Mode Toggles -->
        <div class="mode-toggles">
          <Toggle
            v-model:model-value="instantPreview"
            size="sm"
            class="mode-toggle"
          >
            <Eye :size="12" class="mr-1" />
            {{ instantPreview ? 'Instant' : 'Smooth' }}
          </Toggle>
          
          <Toggle
            v-model:model-value="useKeyframeCamera"
            size="sm"
            class="mode-toggle"
          >
            <Video :size="12" class="mr-1" />
            {{ useKeyframeCamera ? 'Keyframe' : 'Strategy' }}
          </Toggle>

          <select
            v-if="!useKeyframeCamera"
            v-model="selectedCameraMode"
            class="strategy-select"
          >
            <option v-for="opt in cameraModeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Aspect Ratio Controls -->
        <div class="aspect-controls">
          <Toggle
            v-model:model-value="showAspectRatioOverlay"
            size="sm"
            class="mode-toggle"
            :disabled="selectedAspectRatio === 'free'"
          >
            <Frame :size="12" class="mr-1" />
            Frame
          </Toggle>
          
          <select
            v-model="selectedAspectRatio"
            class="aspect-select"
          >
            <option v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="timeline-actions">
          <Toggle
            v-model:model-value="showMultiTrack"
            size="sm"
            class="track-toggle"
          >
            <Layers :size="12" class="mr-1" />
            {{ showMultiTrack ? 'Multi' : 'Simple' }}
          </Toggle>
          
          <button 
            class="icon-btn"
            @click="isKeyframeEditorOpen = !isKeyframeEditorOpen"
          >
            <Settings :size="14" />
          </button>
        </div>
      </div>

      <!-- Timeline Content -->
      <div v-if="isBottomPanelExpanded" class="timeline-content">
        <!-- Simple Timeline View -->
        <div v-if="!showMultiTrack" class="px-4 pb-4">
          <Timeline
            :progress="animationProgress"
            :keyframes="sortedKeyframes"
            :selected-keyframe-id="selectedKeyframeId"
            :is-playing="isAnimating"
            :duration="60"
            @update:progress="seekToProgress"
            @select-keyframe="handleTimelineSelect"
            @move-keyframe="handleKeyframeMove"
            @add-keyframe="handleAddKeyframeAtProgress"
          />
        </div>

        <!-- Multi-Track View -->
        <div v-else class="px-4 pb-4">
          <KeyframeTrack
            :keyframes="sortedKeyframes"
            :progress="animationProgress"
            :selected-keyframe-id="selectedKeyframeId"
            @select-keyframe="handleTimelineSelect"
            @seek="seekToProgress"
          />
        </div>
      </div>

      <!-- Collapsed View - Mini Timeline -->
      <div v-if="!isBottomPanelExpanded" class="mini-timeline">
        <div class="mini-progress" :style="{ width: `${animationProgress * 100}%` }" />
        <div 
          v-for="kf in sortedKeyframes" 
          :key="kf.id"
          class="mini-keyframe"
          :class="{ 'selected': selectedKeyframeId === kf.id }"
          :style="{ left: `${kf.progress * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Camera Info Panel */
.camera-info-panel {
  background: rgba(17, 24, 39, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 140px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.info-item span {
  color: #60a5fa;
  font-family: monospace;
  font-size: 12px;
}

.control-btn {
  background: rgba(17, 24, 39, 0.9) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

.control-btn:hover {
  background: rgba(31, 41, 55, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

/* Playback Controls - now inline in timeline header */
.playback-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.playback-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.playback-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.playback-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.playback-btn.primary {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.playback-btn.primary:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(59, 130, 246, 0.6);
  transform: scale(1.08);
}

.playback-btn.accent {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.playback-btn.accent:hover {
  background: rgba(245, 158, 11, 0.3);
}

.mode-toggles {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-toggle {
  font-size: 11px !important;
  padding: 4px 8px !important;
  height: auto !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

.mode-toggle[data-state="on"] {
  background: rgba(59, 130, 246, 0.2) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
  color: #60a5fa !important;
}

.strategy-select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  outline: none;
}

/* Sidebar */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.keyframe-count {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.sidebar-footer {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.add-keyframe-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  border: none !important;
  color: white !important;
}

.add-keyframe-btn:hover {
  filter: brightness(1.1);
}

/* Timeline Panel */
.timeline-panel {
  background: linear-gradient(180deg, #111827 0%, #0d1117 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 54px;
}

.expand-toggle {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.expand-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.expand-toggle svg {
  transition: transform 0.2s ease;
}

.timeline-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: monospace;
}

.current-time {
  color: #60a5fa;
  font-size: 14px;
  font-weight: 600;
}

.separator {
  color: rgba(255, 255, 255, 0.3);
}

.total-time {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.timeline-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-toggle {
  font-size: 11px !important;
  padding: 4px 10px !important;
  height: auto !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.6) !important;
}

.track-toggle[data-state="on"] {
  background: rgba(139, 92, 246, 0.2) !important;
  border-color: rgba(139, 92, 246, 0.4) !important;
  color: #a78bfa !important;
}

.timeline-content {
  flex: 1;
  overflow: hidden;
  padding-top: 8px;
}

/* Mini Timeline (collapsed state) */
.mini-timeline {
  position: relative;
  flex: 1;
  margin: 0 16px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  align-self: center;
}

.mini-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
}

.mini-keyframe {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #f59e0b;
  border-radius: 2px;
  transform-origin: center;
  rotate: 45deg;
}

.mini-keyframe.selected {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
}

/* Aspect Ratio Overlay */
.aspect-ratio-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.aspect-frame {
  position: relative;
  max-width: calc(100% - 48px);
  max-height: calc(100% - 48px);
  width: 100%;
  height: auto;
  border: 2px solid rgba(59, 130, 246, 0.8);
  box-shadow: 
    0 0 0 9999px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

/* Vertical (portrait) aspect ratio mode */
.aspect-frame.vertical {
  width: auto;
  height: 100%;
  max-height: calc(100% - 48px);
}

.frame-corners {
  position: absolute;
  inset: -4px;
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid #3b82f6;
}

.corner.tl {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.corner.tr {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
}

.corner.bl {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
}

.corner.br {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}

.frame-label {
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(59, 130, 246, 0.9);
  color: white;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Aspect Ratio Controls */
.aspect-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aspect-select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  outline: none;
  cursor: pointer;
}

.aspect-select:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.aspect-select:focus {
  border-color: rgba(59, 130, 246, 0.5);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
