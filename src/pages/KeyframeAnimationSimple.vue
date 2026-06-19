<script setup lang="ts">
import 'mapbox-gl/dist/mapbox-gl.css';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGpxAnimation, useMapbox, TrackingMode } from '../composables';
import { useKeyframeAnimation } from '../composables/useKeyframeAnimation';
import { createCameraStrategies, getCameraPosition } from '../composables/cameraStrategies';
import type { Keyframe, EasingType } from '../composables/keyframeTypes';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Toggle } from '@/components/ui/toggle';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Mountain,
  Eye,
  ZoomIn,
  Compass,
  Move,
  Pencil,
  Video,
} from 'lucide-vue-next';

// ============================================
// Configuration
// ============================================

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const GPX_FILE_URL = '/Morning_Hike.gpx';
const INITIAL_CENTER: [number, number] = [121.093642, 13.376087];

// ============================================
// Refs
// ============================================

const mapContainer = ref<HTMLElement | null>(null);
const isKeyframeEditorOpen = ref(true);
const editingKeyframe = ref<Keyframe | null>(null);
const selectedKeyframeId = ref<string | null>(null);
const popoverOpen = ref<Record<string, boolean>>({});
const instantPreview = ref(true); // When true, camera jumps instantly; when false, animates smoothly
const useKeyframeCamera = ref(true); // When true, use keyframe camera; when false, use camera strategy
const selectedCameraMode = ref<TrackingMode>(TrackingMode.ACTIVE_TRACK_TRACE);
const isBottomPanelExpanded = ref(true); // Bottom timeline panel state
const showMultiTrack = ref(false); // Toggle between simple timeline and multi-track view

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
  setCamera,
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

const currentInterpolatedState = computed(() =>
  getInterpolatedState(animationProgress.value)
);

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

function saveKeyframe() {
  if (!editingKeyframe.value) return;
  
  updateKeyframe(editingKeyframe.value.id, {
    progress: keyframeForm.value.progress,
    altitude: keyframeForm.value.altitude,
    pitch: keyframeForm.value.pitch,
    zoom: keyframeForm.value.zoom,
    bearingOffset: keyframeForm.value.bearingOffset,
    cameraDistance: keyframeForm.value.cameraDistance,
    easing: keyframeForm.value.easing,
    label: keyframeForm.value.label,
  });
  
  closeKeyframeEditor();
}

function saveKeyframeAndClose(keyframeId: string) {
  saveKeyframe();
  popoverOpen.value[keyframeId] = false;
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
  <div class="relative h-screen w-full flex">
    <!-- Keyframe Editor Panel -->
    <div 
      :class="[
        'transition-all duration-300 bg-white border-r border-gray-200 flex flex-col',
        isKeyframeEditorOpen ? 'w-80' : 'w-12'
      ]"
    >
      <!-- Panel Header -->
      <div class="flex items-center justify-between p-3 border-b border-gray-200">
        <h2 v-if="isKeyframeEditorOpen" class="font-semibold text-gray-800">
          Keyframe Editor
        </h2>
        <Button
          variant="ghost"
          size="sm"
          @click="isKeyframeEditorOpen = !isKeyframeEditorOpen"
          class="p-1"
        >
          <ChevronDown v-if="isKeyframeEditorOpen" class="w-4 h-4 rotate-90" />
          <ChevronUp v-else class="w-4 h-4 -rotate-90" />
        </Button>
      </div>

      <!-- Panel Content -->
      <div v-if="isKeyframeEditorOpen" class="flex-1 overflow-hidden flex flex-col">
        <!-- Actions -->
        <div class="p-3 border-b border-gray-200 space-y-2">
          <Button @click="addKeyframeAtCurrentProgress" size="sm" class="w-full">
            <Plus class="w-4 h-4 mr-2" />
            Add at {{ Math.round(animationProgress * 100) }}%
          </Button>
          <div class="flex gap-2">
            <Button @click="handleImport" variant="outline" size="sm" class="flex-1">
              <Upload class="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button @click="handleExport" variant="outline" size="sm" class="flex-1">
              <Download class="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
          <Button @click="clearKeyframes" variant="destructive" size="sm" class="w-full">
            <Trash2 class="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        <!-- Keyframe List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <Popover
            v-for="keyframe in sortedKeyframes"
            :key="keyframe.id"
            v-model:open="popoverOpen[keyframe.id]"
          >
            <PopoverTrigger as-child>
              <div
                :class="[
                  'p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedKeyframeId === keyframe.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                ]"
                @click="openKeyframeEditor(keyframe)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-sm text-gray-800">
                    {{ keyframe.label || `${Math.round(keyframe.progress * 100)}%` }}
                  </span>
                  <div class="flex items-center gap-1">
                    <Pencil class="w-3 h-3 text-gray-400" />
                    <Button
                      variant="ghost"
                      size="sm"
                      class="p-1 h-6 w-6"
                      @click.stop="deleteKeyframe(keyframe.id)"
                    >
                      <X class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  <div class="flex items-center gap-1">
                    <Mountain class="w-3 h-3" />
                    {{ Math.round(keyframe.altitude ?? 500) }}m
                  </div>
                  <div class="flex items-center gap-1">
                    <Eye class="w-3 h-3" />
                    {{ Math.round(keyframe.pitch ?? 60) }}°
                  </div>
                  <div class="flex items-center gap-1">
                    <ZoomIn class="w-3 h-3" />
                    {{ (keyframe.zoom ?? 15).toFixed(1) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <Compass class="w-3 h-3" />
                    {{ Math.round(keyframe.bearingOffset ?? 0) }}°
                  </div>
                </div>
                <!-- Timeline marker -->
                <div class="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 rounded-full"
                    :style="{ width: `${keyframe.progress * 100}%` }"
                  />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent class="w-80 p-0" side="right" align="start">
              <div class="p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="font-medium text-sm text-gray-800">Edit Keyframe</h3>
                  <Button variant="ghost" size="sm" class="p-1 h-6 w-6" @click="popoverOpen[keyframe.id] = false">
                    <X class="w-4 h-4" />
                  </Button>
                </div>

                <!-- Label -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">Label</label>
                  <input
                    v-model="keyframeForm.label"
                    type="text"
                    class="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    placeholder="Keyframe name"
                  />
                </div>

                <!-- Progress -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">
                    Progress: {{ Math.round(keyframeForm.progress * 100) }}%
                  </label>
                  <input
                    v-model.number="keyframeForm.progress"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    class="w-full"
                  />
                </div>

                <!-- Altitude -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">
                    Altitude: {{ keyframeForm.altitude }}m
                  </label>
                  <input
                    v-model.number="keyframeForm.altitude"
                    type="range"
                    min="100"
                    max="5000"
                    step="50"
                    class="w-full"
                  />
                </div>

                <!-- Pitch -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">
                    Pitch: {{ keyframeForm.pitch }}°
                  </label>
                  <input
                    v-model.number="keyframeForm.pitch"
                    type="range"
                    min="0"
                    max="85"
                    step="1"
                    class="w-full"
                  />
                </div>

                <!-- Zoom -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">
                    Zoom: {{ keyframeForm.zoom.toFixed(1) }}
                  </label>
                  <input
                    v-model.number="keyframeForm.zoom"
                    type="range"
                    min="10"
                    max="20"
                    step="0.1"
                    class="w-full"
                  />
                </div>

                <!-- Bearing Offset -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">
                    Bearing Offset: {{ keyframeForm.bearingOffset }}°
                  </label>
                  <input
                    v-model.number="keyframeForm.bearingOffset"
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    class="w-full"
                  />
                </div>

                <!-- Easing -->
                <div>
                  <label class="text-xs text-gray-600 block mb-1">Easing</label>
                  <select
                    v-model="keyframeForm.easing"
                    class="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option v-for="opt in easingOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <!-- Save/Cancel -->
                <div class="flex gap-2">
                  <Button @click="saveKeyframeAndClose(keyframe.id)" size="sm" class="flex-1">
                    Save
                  </Button>
                  <Button @click="popoverOpen[keyframe.id] = false" variant="outline" size="sm" class="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <!-- Empty state -->
          <div v-if="keyframes.length === 0" class="text-center py-8 text-gray-500">
            <Move class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No keyframes yet</p>
            <p class="text-xs">Click "Add" to create your first keyframe</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Container -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="h-full w-full" />

      <!-- Current State Display -->
      <div
        class="absolute top-4 right-4 bg-white/95 rounded-lg p-3 shadow-lg text-sm space-y-1"
      >
        <div class="font-semibold text-gray-800 mb-2">Current Camera</div>
        <div class="flex items-center gap-2 text-gray-600">
          <Eye class="w-4 h-4" />
          <span>Pitch: {{ Math.round(actualCameraState.pitch) }}°</span>
        </div>
        <div class="flex items-center gap-2 text-gray-600">
          <ZoomIn class="w-4 h-4" />
          <span>Zoom: {{ actualCameraState.zoom.toFixed(1) }}</span>
        </div>
        <div class="flex items-center gap-2 text-gray-600">
          <Compass class="w-4 h-4" />
          <span>Bearing: {{ Math.round(actualCameraState.bearing) }}°</span>
        </div>
        <div class="flex items-center gap-2 text-gray-600">
          <Mountain class="w-4 h-4" />
          <span>Lng: {{ actualCameraState.center[0].toFixed(4) }}</span>
        </div>
        <div class="flex items-center gap-2 text-gray-600">
          <Mountain class="w-4 h-4" />
          <span>Lat: {{ actualCameraState.center[1].toFixed(4) }}</span>
        </div>
      </div>

      <!-- Animation Controls -->
      <div
        class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/95 rounded-xl p-4 shadow-lg flex gap-4 items-center"
      >
        <!-- Play/Pause Controls -->
        <div class="flex gap-2">
          <Button @click="startAnimation" :disabled="isAnimating || !hasData" size="sm">
            <Play class="w-4 h-4 mr-1" />
            Play
          </Button>

          <Button @click="pauseAnimation" :disabled="!isAnimating" variant="outline" size="sm">
            <Pause class="w-4 h-4 mr-1" />
            Pause
          </Button>

          <Button @click="resetAnimation" variant="secondary" size="sm">
            <RotateCcw class="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>

        <div class="w-px h-6 bg-gray-300" />

        <!-- Progress Slider -->
        <div class="flex items-center gap-3 min-w-[250px]">
          <input
            :value="animationProgress"
            @input="seekToProgress(Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="0"
            max="1"
            step="0.001"
            class="flex-1"
            :disabled="isAnimating"
          />
          <span class="text-sm text-gray-600 min-w-[40px] text-right">
            {{ Math.round(animationProgress * 100) }}%
          </span>
        </div>

        <div class="w-px h-6 bg-gray-300" />

        <!-- Preview Toggle -->
        <div class="flex items-center gap-2">
          <Toggle
            v-model:model-value="instantPreview"
            size="sm"
            :aria-label="instantPreview ? 'Instant preview on' : 'Instant preview off'"
            class="data-[state=on]:bg-blue-500 data-[state=on]:text-white"
          >
            <Eye class="w-4 h-4 mr-1" />
            {{ instantPreview ? 'Instant' : 'Animate' }}
          </Toggle>
        </div>

        <div class="w-px h-6 bg-gray-300" />

        <!-- Camera Mode Toggle -->
        <div class="flex items-center gap-2">
          <Toggle
            v-model:model-value="useKeyframeCamera"
            size="sm"
            :aria-label="useKeyframeCamera ? 'Using keyframe camera' : 'Using camera strategy'"
            class="data-[state=on]:bg-green-500 data-[state=on]:text-white"
          >
            <Video class="w-4 h-4 mr-1" />
            {{ useKeyframeCamera ? 'Keyframe' : 'Strategy' }}
          </Toggle>
          
          <!-- Camera Strategy Select (only shown when not using keyframe camera) -->
          <select
            v-if="!useKeyframeCamera"
            v-model="selectedCameraMode"
            class="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
          >
            <option v-for="opt in cameraModeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="w-px h-6 bg-gray-300" />

        <!-- View Controls -->
        <Button @click="showTopView" :disabled="!bounds" variant="secondary" size="sm">
          Top View
        </Button>
      </div>

      <!-- Timeline with Keyframe Markers -->
      <div class="absolute bottom-28 left-1/2 -translate-x-1/2 w-100">
        <div class="relative h-4 bg-gray-200 rounded-full overflow-visible">
          <!-- Progress bar -->
          <div
            class="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
            :style="{ width: `${animationProgress * 100}%` }"
          />
          
          <!-- Keyframe markers -->
            <div
            v-for="keyframe in sortedKeyframes"
            :key="keyframe.id"
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-125"
            :class="[
              selectedKeyframeId === keyframe.id
              ? 'bg-yellow-400 ring-2 ring-yellow-500'
              : 'bg-orange-500'
            ]"
            :style="{ left: `calc(${keyframe.progress * 100}% - 6px)` }"
            :title="keyframe.label || `${Math.round(keyframe.progress * 100)}%`"
            @click="openKeyframeEditor(keyframe)"
            @dblclick="seekToProgress(keyframe.progress)"
            />
          <!-- Current position marker -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-600 shadow"
            :style="{ left: `calc(${animationProgress * 100}% - 8px)` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type="range"] {
  height: 0.5rem;
  border-radius: 9999px;
  appearance: none;
  background-color: #e5e7eb;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background-color: #3b82f6;
  cursor: pointer;
}

input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input[type="range"]:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}
</style>
