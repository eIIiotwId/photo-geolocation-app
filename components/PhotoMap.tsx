"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

interface Photo {
  id: string;
  lat: number;
  lng: number;
  createdAt: string;
}

interface PhotoMapProps {
  photos: Photo[];
  onMarkerClick: (photoId: string) => void;
  onMapReady?: (map: maplibregl.Map) => void;
}

export default function PhotoMap({ photos, onMarkerClick, onMapReady }: PhotoMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const previousPhotoIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: "osm-tiles-layer",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [0, 0],
      zoom: 2,
      minZoom: 0, // Prevent zooming out too far
      maxZoom: 18, // Limit max zoom to prevent map from disappearing (OSM tiles are reliable up to zoom 18)
    });

    map.current.on("load", () => {
      setMapLoaded(true);
      // Notify parent that map is ready
      if (onMapReady && map.current) {
        onMapReady(map.current);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Get current photo IDs
    const currentPhotoIds = new Set(photos.map(p => p.id));
    const previousPhotoIds = previousPhotoIdsRef.current;
    
    // Check if this is the first load
    const isFirstLoad = previousPhotoIds.size === 0;
    
    // Find new photos (photos that weren't in the previous set)
    const newPhotos = photos.filter(photo => !previousPhotoIds.has(photo.id));

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each photo
    photos.forEach((photo) => {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#3b82f6";
      el.style.border = "2px solid white";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([photo.lng, photo.lat])
        .addTo(map.current!);

      // Use the marker element's click event
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onMarkerClick(photo.id);
      });

      markersRef.current.push(marker);
    });

    // Update previous photo IDs for next comparison
    previousPhotoIdsRef.current = currentPhotoIds;

    // Only fit bounds if:
    // 1. This is the first load (no previous photos)
    // 2. OR there are new photos that are outside the current view
    if (photos.length > 0 && map.current) {
      const currentBounds = map.current.getBounds();
      
      if (isFirstLoad) {
        // First load: always fit bounds
        const bounds = new maplibregl.LngLatBounds();
        photos.forEach((photo) => {
          bounds.extend([photo.lng, photo.lat]);
        });
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        });
      } else if (newPhotos.length > 0) {
        // Check if any new photos are outside the current view
        const newPhotosOutsideView = newPhotos.some((photo) => {
          return !currentBounds.contains([photo.lng, photo.lat]);
        });

        if (newPhotosOutsideView) {
          // Only fit bounds if new photos are outside view
          const bounds = new maplibregl.LngLatBounds();
          photos.forEach((photo) => {
            bounds.extend([photo.lng, photo.lat]);
          });
          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
          });
        }
        // If new photos are within view, don't change zoom/pan
      }
      // If no new photos (e.g., deletion), don't change zoom/pan
    }
  }, [photos, mapLoaded, onMarkerClick]);

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden shadow-md">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

