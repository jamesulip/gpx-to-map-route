<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Keyframe, EasingType } from '@/composables/keyframeTypes';
import { 
  Mountain, 
  Eye, 
  ZoomIn, 
  Compass, 
  Move,
  Trash2,
  Copy,
  Sparkles
} from 'lucide-vue-next';

interface Props {
  keyframe: Keyframe | null;
  easingOptions: { value: EasingType; label: string }[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update', updates: Partial<Keyframe>): void;
  (e: 'delete'): void;
  (e: 'duplicate'): void;
  (e: 'close'): void;
}>();

// Local form state
const localForm = ref({
  label: '',
  progress: 0,
  altitude: 500,
  pitch: 60,
  zoom: 15,
  bearingOffset: 0,
  cameraDistance: 0.001,
  easing: 'easeInOut' as EasingType,
});

// Sync local form with prop
watch(() => props.keyframe, (kf) => {
  if (kf) {
    localForm.value = {
      label: kf.label ?? '',
      progress: kf.progress,
      altitude: kf.altitude ?? 500,
      pitch: kf.pitch ?? 60,
      zoom: kf.zoom ?? 15,
      bearingOffset: kf.bearingOffset ?? 0,
      cameraDistance: kf.cameraDistance ?? 0.001,
      easing: kf.easing ?? 'easeInOut',
    };
  }
}, { immediate: true });

// Debounced update
let updateTimeout: number | null = null;
const debouncedUpdate = (field: keyof typeof localForm.value, value: string | number) => {
  (localForm.value as Record<string, string | number>)[field] = value;
  
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = window.setTimeout(() => {
    emit('update', { [field]: value });
  }, 50);
};

// Easing visualization
const easingPath = computed(() => {
  const easing = localForm.value.easing;
  const paths: Record<EasingType, string> = {
    linear: 'M0,100 L100,0',
    easeIn: 'M0,100 Q50,100 100,0',
    easeOut: 'M0,100 Q50,0 100,0',
    easeInOut: 'M0,100 Q0,50 50,50 Q100,50 100,0',
    easeInQuad: 'M0,100 Q25,100 50,75 Q75,50 100,0',
    easeOutQuad: 'M0,100 Q25,50 50,25 Q75,0 100,0',
    easeInOutQuad: 'M0,100 C33,100 33,0 50,0 C66,0 66,100 100,0',
    easeInCubic: 'M0,100 C50,100 75,100 100,0',
    easeOutCubic: 'M0,100 C25,0 50,0 100,0',
    easeInOutCubic: 'M0,100 C25,100 25,0 50,0 C75,0 75,100 100,0',
  };
  return paths[easing] || paths.linear;
});

const activeTab = ref<'properties' | 'easing'>('properties');
</script>

<template>
  <div v-if="keyframe" class="keyframe-editor">
    <!-- Header -->
    <div class="editor-header">
      <div class="header-title">
        <Sparkles class="title-icon" :size="16" />
        <input 
          :value="localForm.label"
          @input="debouncedUpdate('label', ($event.target as HTMLInputElement).value)"
          type="text"
          class="label-input"
          placeholder="Keyframe name..."
        />
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="emit('duplicate')" title="Duplicate">
          <Copy :size="14" />
        </button>
        <button class="action-btn danger" @click="emit('delete')" title="Delete">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="editor-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'properties' }"
        @click="activeTab = 'properties'"
      >
        Properties
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'easing' }"
        @click="activeTab = 'easing'"
      >
        Easing
      </button>
    </div>

    <!-- Properties Tab -->
    <div v-if="activeTab === 'properties'" class="editor-content">
      <!-- Progress -->
      <div class="property-group">
        <div class="property-header">
          <Move :size="14" class="property-icon" />
          <span class="property-label">Timeline Position</span>
          <span class="property-value">{{ Math.round(localForm.progress * 100) }}%</span>
        </div>
        <div class="slider-container">
          <input
            :value="localForm.progress"
            @input="debouncedUpdate('progress', Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="0"
            max="1"
            step="0.001"
            class="property-slider"
          />
          <div class="slider-fill" :style="{ width: `${localForm.progress * 100}%` }" />
        </div>
      </div>

      <!-- Pitch -->
      <div class="property-group">
        <div class="property-header">
          <Eye :size="14" class="property-icon" />
          <span class="property-label">Camera Pitch</span>
          <span class="property-value">{{ localForm.pitch }}°</span>
        </div>
        <div class="slider-container">
          <input
            :value="localForm.pitch"
            @input="debouncedUpdate('pitch', Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="0"
            max="85"
            step="1"
            class="property-slider"
          />
          <div class="slider-fill" :style="{ width: `${(localForm.pitch / 85) * 100}%` }" />
        </div>
      </div>

      <!-- Zoom -->
      <div class="property-group">
        <div class="property-header">
          <ZoomIn :size="14" class="property-icon" />
          <span class="property-label">Zoom Level</span>
          <span class="property-value">{{ localForm.zoom.toFixed(1) }}</span>
        </div>
        <div class="slider-container">
          <input
            :value="localForm.zoom"
            @input="debouncedUpdate('zoom', Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="10"
            max="20"
            step="0.1"
            class="property-slider"
          />
          <div class="slider-fill" :style="{ width: `${((localForm.zoom - 10) / 10) * 100}%` }" />
        </div>
      </div>

      <!-- Bearing -->
      <div class="property-group">
        <div class="property-header">
          <Compass :size="14" class="property-icon" />
          <span class="property-label">Bearing Offset</span>
          <span class="property-value">{{ localForm.bearingOffset }}°</span>
        </div>
        <div class="slider-container bearing">
          <input
            :value="localForm.bearingOffset"
            @input="debouncedUpdate('bearingOffset', Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="-180"
            max="180"
            step="1"
            class="property-slider"
          />
          <div 
            class="slider-fill-center" 
            :style="{ 
              left: localForm.bearingOffset >= 0 ? '50%' : `${50 + (localForm.bearingOffset / 180) * 50}%`,
              width: `${Math.abs(localForm.bearingOffset / 180) * 50}%`
            }" 
          />
        </div>
      </div>

      <!-- Altitude -->
      <div class="property-group">
        <div class="property-header">
          <Mountain :size="14" class="property-icon" />
          <span class="property-label">Altitude</span>
          <span class="property-value">{{ localForm.altitude }}m</span>
        </div>
        <div class="slider-container">
          <input
            :value="localForm.altitude"
            @input="debouncedUpdate('altitude', Number(($event.target as HTMLInputElement).value))"
            type="range"
            min="100"
            max="5000"
            step="50"
            class="property-slider"
          />
          <div class="slider-fill" :style="{ width: `${((localForm.altitude - 100) / 4900) * 100}%` }" />
        </div>
      </div>
    </div>

    <!-- Easing Tab -->
    <div v-if="activeTab === 'easing'" class="editor-content">
      <!-- Easing Preview -->
      <div class="easing-preview">
        <svg viewBox="0 0 100 100" class="easing-graph">
          <defs>
            <linearGradient id="easing-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
            </linearGradient>
          </defs>
          <!-- Grid -->
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2,2" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2,2" />
          <!-- Curve -->
          <path 
            :d="easingPath" 
            fill="none" 
            stroke="url(#easing-gradient)" 
            stroke-width="3"
            stroke-linecap="round"
          />
          <!-- Dots -->
          <circle cx="0" cy="100" r="4" fill="#3b82f6" />
          <circle cx="100" cy="0" r="4" fill="#8b5cf6" />
        </svg>
      </div>

      <!-- Easing Options -->
      <div class="easing-options">
        <button
          v-for="opt in easingOptions"
          :key="opt.value"
          class="easing-btn"
          :class="{ active: localForm.easing === opt.value }"
          @click="debouncedUpdate('easing', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="editor-footer">
      <div class="keyframe-id">ID: {{ keyframe.id.slice(0, 8) }}...</div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="editor-empty">
    <div class="empty-icon">
      <Sparkles :size="32" />
    </div>
    <p class="empty-text">Select a keyframe to edit</p>
    <p class="empty-hint">Double-click on timeline to add new keyframes</p>
  </div>
</template>

<style scoped>
.keyframe-editor {
  background: linear-gradient(180deg, #1e1e2e 0%, #181825 100%);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.title-icon {
  color: #f59e0b;
}

.label-input {
  background: transparent;
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  flex: 1;
}

.label-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.editor-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.1);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.editor-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.property-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.property-icon {
  color: rgba(255, 255, 255, 0.4);
}

.property-label {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.property-value {
  font-size: 12px;
  font-family: monospace;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.slider-container {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.slider-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 3px;
  pointer-events: none;
}

.slider-fill-center {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 3px;
  pointer-events: none;
}

.property-slider {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
}

.easing-preview {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
}

.easing-graph {
  width: 100%;
  height: 120px;
}

.easing-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.easing-btn {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.easing-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.easing-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #60a5fa;
}

.editor-footer {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.keyframe-id {
  font-size: 10px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.3);
}

.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  background: linear-gradient(180deg, #1e1e2e 0%, #181825 100%);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.empty-icon {
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 16px;
}

.empty-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0 0 4px 0;
}

.empty-hint {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  margin: 0;
}
</style>
