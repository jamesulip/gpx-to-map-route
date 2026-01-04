import { gpx } from '@tmcw/togeojson';

export interface GpsPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: string;
}

export async function parseGpxFile(gpxUrl: string): Promise<GpsPoint[]> {
  const response = await fetch(gpxUrl);
  const gpxText = await response.text();
  const parser = new DOMParser();
  const gpxDoc = parser.parseFromString(gpxText, 'application/xml');
  const geojson = gpx(gpxDoc);

  const points: GpsPoint[] = [];

  // Extract coordinates from the GeoJSON features
  geojson.features.forEach((feature) => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates as [number, number, number][];
      coords.forEach((coord) => {
        points.push({
          longitude: coord[0],
          latitude: coord[1],
          elevation: coord[2],
        });
      });
    }
  });

  return points;
}

// Interpolate between two points for smooth animation
export function interpolatePoint(
  point1: GpsPoint | undefined,
  point2: GpsPoint | undefined,
  progress: number
): GpsPoint | null {
  if (!point1 || !point2) return null;
  
  return {
    longitude: point1.longitude + (point2.longitude - point1.longitude) * progress,
    latitude: point1.latitude + (point2.latitude - point1.latitude) * progress,
    elevation:
      point1.elevation && point2.elevation
        ? point1.elevation + (point2.elevation - point1.elevation) * progress
        : undefined,
  };
}
