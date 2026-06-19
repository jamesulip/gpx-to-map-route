<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Keyframe } from '@/composables/keyframeTypes';
import { Diamond, Lock, Unlock, Eye, EyeOff, ChevronRight } from 'lucide-vue-next';

interface TrackConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  property: keyof Keyframe;
}

interface Props {
  keyframes: Keyframe[];
  progress: number;
  selectedKeyframeId?: string | null;
  tracks?: TrackConfig[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedKeyframeId: null,
  tracks: () => [
    { id: 'pitch', name: 'Pitch', icon: Eye, color: '#f59e0b', property: 'pitch' },
    { id: 'zoom', name: 'Zoom', icon: Eye, color: '#3b82f6', property: 'zoom' },
    { id: 'bearing', name: 'Bearing', icon: Eye, color: '#8b5cf6', property: 'bearingOffset' },
    { id: 'altitude', name: 'Altitude', icon: Eye, color: '#22c55e', property: 'altitude' },
  ],
});

const emit = defineEmits<{
  (e: 'select-keyframe', keyframe: Keyframe): void;
  (e: 'seek', progress: number): void;
}>();

// Track visibility state
const trackVisibility = ref<Record<string, boolean>>(
  Object.fromEntries(props.tracks.map(t => [t.id, true]))
);

const trackLocked = ref<Record<string, boolean>>(
  Object.fromEntries(props.tracks.map(t => [t.id, false]))
);

const expandedTracks = ref<Record<string, boolean>>(
  Object.fromEntries(props.tracks.map(t => [t.id, true]))
);

// Sort keyframes by progress
const sortedKeyframes = computed(() => 
  [...props.keyframes].sort((a, b) => a.progress - b.progress)
);

// Get keyframe positions for a track
const getTrackKeyframes = (track: TrackConfig) => {
  return sortedKeyframes.value.filter(kf => kf[track.property] !== undefined);
};

// Calculate curve path between keyframes for visualization
const getCurvePath = (keyframes: Keyframe[], _property: keyof Keyframe) => {
  if (keyframes.length < 2) return '';
  
  const points = keyframes.map(kf => ({
    x: kf.progress * 100,
    y: 50, // Center line for now
  }));
  
  const firstPoint = points[0];
  if (!firstPoint) return '';
  
  let path = `M ${firstPoint.x} ${firstPoint.y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    const cpX1 = prev.x + (curr.x - prev.x) / 3;
    const cpX2 = prev.x + (curr.x - prev.x) * 2 / 3;
    path += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  
  return path;
};

const toggleTrackVisibility = (trackId: string) => {
  trackVisibility.value[trackId] = !trackVisibility.value[trackId];
};

const toggleTrackLocked = (trackId: string) => {
  trackLocked.value[trackId] = !trackLocked.value[trackId];
};

const toggleTrackExpanded = (trackId: string) => {
  expandedTracks.value[trackId] = !expandedTracks.value[trackId];
};
</script>

<template>
  <div class="keyframe-tracks">
    <!-- Track Headers & Content -->
    <div 
      v-for="track in tracks" 
      :key="track.id"
      class="track-row"
      :class="{ 'collapsed': !expandedTracks[track.id] }"
    >
      <!-- Track Header -->
      <div class="track-header" :style="{ '--track-color': track.color }">
        <button class="expand-btn" @click="toggleTrackExpanded(track.id)">
          <ChevronRight 
            :size="12" 
            :class="{ 'rotated': expandedTracks[track.id] }" 
          />
        </button>
        <div class="track-color-indicator" />
        <span class="track-name">{{ track.name }}</span>
        <div class="track-controls">
          <button 
            class="track-btn"
            :class="{ 'active': trackVisibility[track.id] }"
            @click="toggleTrackVisibility(track.id)"
          >
            <Eye v-if="trackVisibility[track.id]" :size="12" />
            <EyeOff v-else :size="12" />
          </button>
          <button 
            class="track-btn"
            :class="{ 'active': trackLocked[track.id] }"
            @click="toggleTrackLocked(track.id)"
          >
            <Lock v-if="trackLocked[track.id]" :size="12" />
            <Unlock v-else :size="12" />
          </button>
        </div>
      </div>

      <!-- Track Content -->
      <div 
        class="track-content"
        v-show="expandedTracks[track.id]"
        :style="{ '--track-color': track.color }"
      >
        <!-- Background -->
        <div class="track-bg">
          <div 
            v-for="i in 10" 
            :key="i" 
            class="track-grid-line"
            :style="{ left: `${(i - 1) * 10}%` }"
          />
        </div>

        <!-- Curve visualization -->
        <svg class="track-curve" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path 
            v-if="getTrackKeyframes(track).length > 1"
            :d="getCurvePath(getTrackKeyframes(track), track.property)"
            fill="none"
            :stroke="track.color"
            stroke-width="2"
            stroke-opacity="0.3"
          />
        </svg>

        <!-- Keyframe diamonds -->
        <div 
          v-for="kf in getTrackKeyframes(track)"
          :key="`${track.id}-${kf.id}`"
          class="track-keyframe"
          :class="{ 'selected': selectedKeyframeId === kf.id }"
          :style="{ left: `${kf.progress * 100}%` }"
          @click="emit('select-keyframe', kf)"
        >
          <Diamond :size="10" />
        </div>

        <!-- Playhead position -->
        <div 
          class="track-playhead"
          :style="{ left: `${progress * 100}%` }"
        />
      </div>
    </div>

    <!-- Time markers at bottom -->
    <div class="time-scale">
      <div class="time-scale-track">
        <span 
          v-for="i in 11" 
          :key="i" 
          class="time-marker"
          :style="{ left: `${(i - 1) * 10}%` }"
        >
          {{ (i - 1) * 10 }}%
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.keyframe-tracks {
  background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
  border-radius: 8px;
  overflow: hidden;
}

.track-row {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.track-row:last-of-type {
  border-bottom: none;
}

.track-row.collapsed {
  .track-content {
    display: none;
  }
}

.track-header {
  width: 160px;
  min-width: 160px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.expand-btn {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.expand-btn .rotated {
  transform: rotate(90deg);
}

.track-color-indicator {
  width: 4px;
  height: 16px;
  background: var(--track-color);
  border-radius: 2px;
}

.track-name {
  flex: 1;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.track-controls {
  display: flex;
  gap: 2px;
}

.track-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.track-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.track-btn.active {
  color: var(--track-color, rgba(255, 255, 255, 0.8));
}

.track-content {
  flex: 1;
  height: 32px;
  position: relative;
  background: rgba(0, 0, 0, 0.15);
}

.track-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.track-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.03);
}

.track-curve {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.track-keyframe {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--track-color);
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 2;
}

.track-keyframe:hover {
  transform: translate(-50%, -50%) scale(1.3);
  filter: drop-shadow(0 0 4px var(--track-color));
}

.track-keyframe.selected {
  color: white;
  filter: drop-shadow(0 0 6px white);
}

.track-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #3b82f6;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.time-scale {
  display: flex;
  padding-left: 160px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.time-scale-track {
  flex: 1;
  position: relative;
  height: 20px;
}

.time-marker {
  position: absolute;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  top: 4px;
}
</style>
