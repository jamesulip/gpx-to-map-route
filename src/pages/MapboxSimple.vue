<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { MapboxMap, MapboxImages, MapboxLayer, MapboxMarker } from '@studiometa/vue-mapbox-gl';
import { useGpxLoader } from '@/composables/useGpxLoader'
import { useDropZone } from '@vueuse/core'
import exifr from 'exifr'
import { useTemplateRef } from 'vue'
import * as turf from '@turf/turf'
import 'mapbox-gl/dist/mapbox-gl.css';
import { v4 } from 'uuid';
import type { PathAnalysis } from '@/composables';
import type { Map } from 'mapbox-gl';
const { loadGpxFile, isLoading, createRouteGeoJson, onLoaded } = useGpxLoader()
loadGpxFile('/Lunch_Hike.gpx')
const mapCenter = ref([0, 0]);
const photoMarkers = ref<Array<{ id: string; coordinates: [number, number]; file: File }>>([])


// computed for random lat and lng for testing
const mapRef = useTemplateRef('mapboxMapRef')
import type { Map as MapboxMapType } from 'mapbox-gl';
import type { ComputedRef } from 'vue';
const map: ComputedRef<MapboxMapType | undefined> = computed(() => mapRef.value?.map);

function addRoute(routeId:string, geojson: GeoJSON.FeatureCollection) {
     if (!map.value) return;

    map.value.addSource(routeId, {
        type: 'geojson',
        data: geojson,
    });

    // Glow effect layer
    map.value.addLayer({
        id: `${routeId}-glow`,
        type: 'line',
        source: routeId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#FF6B35',
            'line-width': 12,
            'line-opacity': 0.4,
            'line-blur': 2,
        },
    });
    // add smooth line layer

    // Main line layer
    map.value.addLayer({
        id: `${routeId}-line`,
        type: 'line',
        source: routeId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#FF6B35',
            'line-width': 3,
        },
    });
}
function addSimplifiedBezierRoute(routeId: string, analysis: PathAnalysis) {
    if (!map.value) return;

   
    // create bezzier curve from analysis.coordinates
    const line = turf.lineString(analysis.coordinates);
    const simplifiedLine = turf.simplify(line, { tolerance: 0.0005, highQuality: false });
    const simplified = turf.bezierSpline(simplifiedLine, { sharpness: 0.85 });

    map.value.addSource(routeId, {
        type: 'geojson',
        data: simplified,
    });

    // Glow effect layer
    map.value.addLayer({
        id: `${routeId}-glow`,
        type: 'line',
        source: routeId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#36A2FF',
            'line-width': 12,
            'line-opacity': 0.3,
            'line-blur': 2,
        },
    });

    // Main line layer
    map.value.addLayer({
        id: `${routeId}-line`,
        type: 'line',
        source: routeId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round',
        },
        paint: {
            'line-color': '#36A2FF',
            'line-width': 3,
        },
    });
}

// Example usage after loading the GPX
onLoaded((e,analysis) => {
    console.log(analysis)
    addRoute(v4(), e);
    addSimplifiedBezierRoute(v4(), analysis);
    // recenter map
    if (analysis.coordinates.length > 0) {
        map.value?.jumpTo({
            center: analysis.coordinates[Math.floor(analysis.coordinates.length / 2)],
            zoom: 12,
            
        });
    }
    
});
</script>

<template>
    <MapboxMap ref="mapboxMapRef" style="height: 100vh"
        access-token=""
        map-style="mapbox://styles/mapbox/streets-v11" :center="mapCenter" :zoom="1">

        <MapboxMarker v-for="marker in photoMarkers" :key="marker.id" :lng-lat="marker.coordinates" :max-width="96"
            :max-height="96">
            <div class="w-24 h-24 overflow-hidden rounded flex items-center justify-center bg-white p-1 shadow"
                style="width: 96px; height: 96px;">
                <img :src="marker.file" alt="Content image" class="object-cover w-full h-full"
                    style="width: 100%; height: 100%;" />
            </div>
        </MapboxMarker>
    </MapboxMap>
</template>
