import { ref, shallowRef } from 'vue';
import type mapboxgl from 'mapbox-gl';

export function useMapRecording(mapRef: { value: mapboxgl.Map | null }) {
  const isRecording = ref(false);
  const recordingTime = ref(0);
  const mediaRecorder = shallowRef<MediaRecorder | null>(null);
  const recordingChunks = ref<Blob[]>([]);
  const recordingMimeType = ref<string>('video/webm');
  
  let recordingInterval: ReturnType<typeof setInterval> | null = null;

  function getMimeType(): string {
    const mimeTypes = [
      'video/mp4;codecs="avc1.42E01E"',
      'video/mp4',
      'video/webm',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    
    return 'video/webm'; // fallback
  }

  function startRecording() {
    if (!mapRef.value) return;
    
    try {
      const canvas = mapRef.value.getCanvas();
      const stream = canvas.captureStream(60); // 60fps for 1080p
      
      const mimeType = getMimeType();
      recordingMimeType.value = mimeType;
      
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000, // 8 Mbps for 1080p quality
      });
      
      recordingChunks.value = [];
      
      recorder.ondataavailable = (e) => {
        recordingChunks.value.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordingChunks.value, { type: mimeType });
        downloadVideo(blob);
      };
      
      mediaRecorder.value = recorder;
      recorder.start();
      
      isRecording.value = true;
      recordingTime.value = 0;
      
      // Update recording time every 100ms
      recordingInterval = setInterval(() => {
        recordingTime.value += 0.1;
      }, 100);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorder.value && isRecording.value) {
      mediaRecorder.value.stop();
      isRecording.value = false;
      
      if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
      }
    }
  }

  function downloadVideo(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const ext = recordingMimeType.value.includes('mp4') ? 'mp4' : 'webm';
    link.download = `map-recording-${new Date().getTime()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    formatTime,
  };
}
