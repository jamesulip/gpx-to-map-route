import { ref, shallowRef, type Ref } from 'vue';
import mapboxgl from 'mapbox-gl';

interface MapConfig {
  accessToken: string;
  style?: string;
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

interface TerrainConfig {
  sourceUrl?: string;
  exaggeration?: number;
}

const DEFAULT_MAP_CONFIG: Partial<MapConfig> = {
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [0, 0],
  zoom: 13,
  pitch: 60,
  bearing: 0,
};

const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  sourceUrl: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  exaggeration: 1.5,
};

export function useMapbox(
  containerRef: Ref<HTMLElement | null>,
  config: MapConfig,
  terrainConfig: TerrainConfig = {}
) {
  const map = shallowRef<mapboxgl.Map | null>(null);
  const isMapLoaded = ref(false);

  const mergedConfig = { ...DEFAULT_MAP_CONFIG, ...config };
  const mergedTerrainConfig = { ...DEFAULT_TERRAIN_CONFIG, ...terrainConfig };

  function initializeMap() {
    if (map.value || !containerRef.value) return;

    mapboxgl.accessToken = mergedConfig.accessToken;

    map.value = new mapboxgl.Map({
      container: containerRef.value,
      style: mergedConfig.style,
      center: mergedConfig.center,
      zoom: mergedConfig.zoom,
      pitch: mergedConfig.pitch,
      bearing: mergedConfig.bearing,
    });

    map.value.on('style.load', () => {
      if (!map.value) return;

      // Add terrain source
      map.value.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: mergedTerrainConfig.sourceUrl,
        tileSize: 512,
        maxzoom: 14,
      });

      map.value.setTerrain({
        source: 'mapbox-dem',
        exaggeration: mergedTerrainConfig.exaggeration,
      });

      // Add 3D buildings layer
      map.value.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': '#2a2a2a',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.4,
          },
        },
        'waterway-label'
      );

      isMapLoaded.value = true;
    });
  }

  function addRouteLayer(sourceId: string, geojsonData: any) {
    if (!map.value) return;

    map.value.addSource(sourceId, {
      type: 'geojson',
      data: geojsonData,
    });

    // Glow effect layer
    map.value.addLayer({
      id: `${sourceId}-glow`,
      type: 'line',
      source: sourceId,
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

    // Main line layer
    map.value.addLayer({
      id: `${sourceId}-line`,
      type: 'line',
      source: sourceId,
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

  function addMarkerLayer(sourceId: string, initialCoordinates: [number, number]) {
    if (!map.value) return;

    map.value.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: initialCoordinates,
            },
            properties: {},
          },
        ],
      },
    });

    // Marker layer
    map.value.addLayer({
      id: `${sourceId}-circle`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 10,
        'circle-color': '#00BFFF',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0066FF',
        'circle-opacity': 0.9,
      },
    });

    // Glow effect
    map.value.addLayer({
      id: `${sourceId}-glow`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 15,
        'circle-color': '#00BFFF',
        'circle-opacity': 0.2,
      },
    });
  }

  function updateMarkerPosition(sourceId: string, coordinates: [number, number]) {
    if (!map.value) return;

    const source = map.value.getSource(sourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates,
            },
            properties: {},
          },
        ],
      });
    }
  }

  function flyTo(options: Parameters<mapboxgl.Map['flyTo']>[0]) {
    if (!map.value) return;
    map.value.flyTo(options);
  }

  function setCamera(center: [number, number], bearing: number) {
    if (!map.value) return;
    map.value.jumpTo({
      center,
      bearing,
    });
  }

  // Helper to wait for a single map event
  function onceMapEvent(event: string): Promise<void> {
    return new Promise((resolve) => {
      if (!map.value) return resolve();
      const handler = () => {
        map.value?.off(event, handler);
        resolve();
      };
      map.value.on(event, handler);
    });
  }

  // Animate to top-down view showing the entire route
  async function animateToTopView(bounds: [[number, number], [number, number]], duration = 2000): Promise<void> {
    if (!map.value) return;
    const [sw, ne] = bounds;
    const boundingBox = new mapboxgl.LngLatBounds(sw, ne);

    map.value.fitBounds(boundingBox, {
      padding: 50,
      pitch: 0,
      bearing: 0,
      duration,
    });

    await onceMapEvent('moveend');
  }

  // Animate to starting position view as a Promise
  async function animateToStartingView(
    startCoord: [number, number],
    bearing = 0,
    options?: { zoom?: number; pitch?: number; duration?: number }
  ): Promise<void> {
    if (!map.value) return;
    const { zoom = 15, pitch = 60, duration = 2000 } = options || {};

    map.value.flyTo({
      center: startCoord,
      zoom,
      pitch,
      bearing,
      duration,
    });

    await onceMapEvent('moveend');
  }

  function cleanup() {
    if (map.value) {
      map.value.remove();
      map.value = null;
    }
  }

  
  return {
    map,
    isMapLoaded,
    initializeMap,
    addRouteLayer,
    addMarkerLayer,
    updateMarkerPosition,
    flyTo,
    setCamera,
    animateToTopView,
    animateToStartingView,
    cleanup,
  };
}
