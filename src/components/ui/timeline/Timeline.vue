<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Keyframe } from '@/composables/keyframeTypes';
import { Diamond } from 'lucide-vue-next';

interface Props {
  progress: number;
  keyframes: Keyframe[];
  selectedKeyframeId?: string | null;
  duration?: number; // Total duration in seconds
  isPlaying?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selectedKeyframeId: null,
  duration: 60,
  isPlaying: false,
});

const emit = defineEmits<{
  (e: 'update:progress', value: number): void;
  (e: 'select-keyframe', keyframe: Keyframe): void;
  (e: 'move-keyframe', id: string, progress: number): void;
  (e: 'add-keyframe', progress: number): void;
}>();

const timelineRef = ref<HTMLElement | null>(null);
const isDraggingPlayhead = ref(false);
const isDraggingKeyframe = ref<string | null>(null);
const isHovering = ref(false);
const hoverProgress = ref(0);

// Zoom and scroll
const zoom = ref(1);
const scrollOffset = ref(0);

// Calculate visible range based on zoom
const visibleRange = computed(() => {
  const visibleWidth = 1 / zoom.value;
  const start = scrollOffset.value;
  const end = Math.min(1, start + visibleWidth);
  return { start, end, width: end - start };
});

// Time markers (show every N seconds based on zoom)
const timeMarkers = computed(() => {
  const markers: { position: number; label: string; isMajor: boolean }[] = [];
  const totalSeconds = props.duration;
  
  // Determine interval based on zoom level
  let majorInterval: number;
  let minorInterval: number;
  
  if (zoom.value < 2) {
    majorInterval = 10;
    minorInterval = 5;
  } else if (zoom.value < 4) {
    majorInterval = 5;
    minorInterval = 1;
  } else {
    majorInterval = 2;
    minorInterval = 0.5;
  }
  
  for (let t = 0; t <= totalSeconds; t += minorInterval) {
    const progress = t / totalSeconds;
    if (progress >= visibleRange.value.start && progress <= visibleRange.value.end) {
      const isMajor = t % majorInterval === 0;
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      const label = isMajor ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '';
      markers.push({
        position: (progress - visibleRange.value.start) / visibleRange.value.width,
        label,
        isMajor,
      });
    }
  }
  
  return markers;
});

// Convert progress to pixel position
const progressToPosition = (progress: number) => {
  return ((progress - visibleRange.value.start) / visibleRange.value.width) * 100;
};

// Convert pixel position to progress
const positionToProgress = (clientX: number) => {
  if (!timelineRef.value) return 0;
  const rect = timelineRef.value.getBoundingClientRect();
  const relativeX = (clientX - rect.left) / rect.width;
  const progress = visibleRange.value.start + relativeX * visibleRange.value.width;
  return Math.max(0, Math.min(1, progress));
};

// Playhead position
const playheadPosition = computed(() => {
  return progressToPosition(props.progress);
});

// Visible keyframes
const visibleKeyframes = computed(() => {
  return props.keyframes.filter(
    kf => kf.progress >= visibleRange.value.start - 0.05 && 
          kf.progress <= visibleRange.value.end + 0.05
  );
});

// Handle mouse events
const handleTimelineClick = (e: MouseEvent) => {
  if (isDraggingKeyframe.value) return;
  const progress = positionToProgress(e.clientX);
  emit('update:progress', progress);
};

const handleTimelineDoubleClick = (e: MouseEvent) => {
  const progress = positionToProgress(e.clientX);
  emit('add-keyframe', progress);
};

const startPlayheadDrag = (e: MouseEvent) => {
  e.stopPropagation();
  isDraggingPlayhead.value = true;
  document.addEventListener('mousemove', handlePlayheadDrag);
  document.addEventListener('mouseup', stopPlayheadDrag);
};

const handlePlayheadDrag = (e: MouseEvent) => {
  if (!isDraggingPlayhead.value) return;
  const progress = positionToProgress(e.clientX);
  emit('update:progress', progress);
};

const stopPlayheadDrag = () => {
  isDraggingPlayhead.value = false;
  document.removeEventListener('mousemove', handlePlayheadDrag);
  document.removeEventListener('mouseup', stopPlayheadDrag);
};

const startKeyframeDrag = (e: MouseEvent, keyframeId: string) => {
  e.stopPropagation();
  isDraggingKeyframe.value = keyframeId;
  document.addEventListener('mousemove', handleKeyframeDrag);
  document.addEventListener('mouseup', stopKeyframeDrag);
};

const handleKeyframeDrag = (e: MouseEvent) => {
  if (!isDraggingKeyframe.value) return;
  const progress = positionToProgress(e.clientX);
  emit('move-keyframe', isDraggingKeyframe.value, progress);
};

const stopKeyframeDrag = () => {
  isDraggingKeyframe.value = null;
  document.removeEventListener('mousemove', handleKeyframeDrag);
  document.removeEventListener('mouseup', stopKeyframeDrag);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!timelineRef.value) return;
  isHovering.value = true;
  hoverProgress.value = positionToProgress(e.clientX);
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

// Zoom controls
const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    zoom.value = Math.max(1, Math.min(10, zoom.value + delta));
  } else {
    // Horizontal scroll
    const scrollDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    const scrollAmount = (scrollDelta / 1000) / zoom.value;
    scrollOffset.value = Math.max(0, Math.min(1 - 1/zoom.value, scrollOffset.value + scrollAmount));
  }
};

// Format time for display
const formatTime = (progress: number) => {
  const totalSeconds = progress * props.duration;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

onMounted(() => {
  if (timelineRef.value) {
    timelineRef.value.addEventListener('wheel', handleWheel, { passive: false });
  }
});

onUnmounted(() => {
  if (timelineRef.value) {
    timelineRef.value.removeEventListener('wheel', handleWheel);
  }
  stopPlayheadDrag();
  stopKeyframeDrag();
});
</script>

<template>
  <div class="timeline-container">
    <!-- Time Ruler -->
    <div class="time-ruler">
      <div 
        v-for="(marker, index) in timeMarkers" 
        :key="index"
        class="time-marker"
        :class="{ 'major': marker.isMajor }"
        :style="{ left: `${marker.position * 100}%` }"
      >
        <div class="marker-line" />
        <span v-if="marker.label" class="marker-label">{{ marker.label }}</span>
      </div>
    </div>

    <!-- Main Timeline Track -->
    <div 
      ref="timelineRef"
      class="timeline-track"
      @click="handleTimelineClick"
      @dblclick="handleTimelineDoubleClick"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <!-- Background Grid -->
      <div class="timeline-grid">
        <div 
          v-for="i in 20" 
          :key="i" 
          class="grid-line"
          :style="{ left: `${(i - 1) * 5}%` }"
        />
      </div>

      <!-- Progress Fill -->
      <div 
        class="progress-fill"
        :style="{ width: `${playheadPosition}%` }"
      />

      <!-- Hover Indicator -->
      <div 
        v-if="isHovering && !isDraggingPlayhead && !isDraggingKeyframe"
        class="hover-indicator"
        :style="{ left: `${progressToPosition(hoverProgress)}%` }"
      >
        <div class="hover-line" />
        <div class="hover-time">{{ formatTime(hoverProgress) }}</div>
      </div>

      <!-- Keyframes -->
      <div class="keyframes-layer">
        <div
          v-for="keyframe in visibleKeyframes"
          :key="keyframe.id"
          class="keyframe-marker"
          :class="{ 
            'selected': selectedKeyframeId === keyframe.id,
            'dragging': isDraggingKeyframe === keyframe.id
          }"
          :style="{ left: `${progressToPosition(keyframe.progress)}%` }"
          @click.stop="emit('select-keyframe', keyframe)"
          @mousedown="startKeyframeDrag($event, keyframe.id)"
        >
          <Diamond class="keyframe-icon" :size="14" />
          <span v-if="keyframe.label" class="keyframe-label">{{ keyframe.label }}</span>
        </div>
      </div>

      <!-- Playhead -->
      <div 
        class="playhead"
        :class="{ 'dragging': isDraggingPlayhead, 'playing': isPlaying }"
        :style="{ left: `${playheadPosition}%` }"
        @mousedown="startPlayheadDrag"
      >
        <div class="playhead-head">
          <svg viewBox="0 0 12 14" class="playhead-shape">
            <path d="M0,0 L12,0 L12,8 L6,14 L0,8 Z" />
          </svg>
        </div>
        <div class="playhead-line" />
      </div>
    </div>

    <!-- Zoom Controls -->
    <div class="zoom-controls">
      <button 
        class="zoom-btn" 
        @click="zoom = Math.max(1, zoom - 0.5)"
        :disabled="zoom <= 1"
      >
        −
      </button>
      <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
      <button 
        class="zoom-btn" 
        @click="zoom = Math.min(10, zoom + 0.5)"
        :disabled="zoom >= 10"
      >
        +
      </button>
    </div>

    <!-- Current Time Display -->
    <div class="current-time">
      {{ formatTime(progress) }}
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  position: relative;
  background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
  border-radius: 8px;
  padding: 8px;
  user-select: none;
}

.time-ruler {
  position: relative;
  height: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 4px;
}

.time-marker {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.marker-line {
  width: 1px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
}

.time-marker.major .marker-line {
  height: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.marker-label {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.timeline-track {
  position: relative;
  height: 48px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  cursor: crosshair;
  overflow: hidden;
}

.timeline-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.05);
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.15) 100%);
  pointer-events: none;
}

.hover-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 5;
}

.hover-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: rgba(255, 255, 255, 0.3);
  transform: translateX(-50%);
}

.hover-time {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.keyframes-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.keyframe-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  transition: transform 0.1s ease;
}

.keyframe-marker:hover {
  transform: translate(-50%, -50%) scale(1.2);
}

.keyframe-marker.dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.3);
}

.keyframe-icon {
  color: #f59e0b;
  filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.5));
  transition: all 0.15s ease;
}

.keyframe-marker:hover .keyframe-icon,
.keyframe-marker.selected .keyframe-icon {
  color: #fbbf24;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
}

.keyframe-marker.selected .keyframe-icon {
  color: #22c55e;
  filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.8));
}

.keyframe-label {
  position: absolute;
  top: calc(100% + 2px);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 4px;
  border-radius: 2px;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 20;
  cursor: ew-resize;
}

.playhead-head {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 14px;
}

.playhead-shape {
  fill: #3b82f6;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: fill 0.15s ease;
}

.playhead:hover .playhead-shape,
.playhead.dragging .playhead-shape {
  fill: #60a5fa;
}

.playhead.playing .playhead-shape {
  fill: #22c55e;
}

.playhead-line {
  position: absolute;
  top: 6px;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: #3b82f6;
  transform: translateX(-50%);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.playhead.playing .playhead-line {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.zoom-controls {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 8px;
  border-radius: 4px;
}

.zoom-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all 0.15s ease;
}

.zoom-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-level {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 40px;
  text-align: center;
}

.current-time {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 12px;
  font-family: monospace;
  color: #3b82f6;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
