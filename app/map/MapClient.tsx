"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoUpload from "@/components/PhotoUpload";
import PhotoMap from "@/components/PhotoMap";
import PhotoDetailModal from "@/components/PhotoDetailModal";
import SignOutButton from "./signout-button";

interface Photo {
  id: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export default function MapClient() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  useEffect(() => {
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllPhotos]);

  // Auto-refresh when "All Photos" is enabled to see new uploads from other users
  useEffect(() => {
    if (!showAllPhotos) return;

    // Poll every 5 seconds to check for new photos from other users
    const interval = setInterval(() => {
      fetchPhotos(false); // Don't show loading spinner for background refresh
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllPhotos]);

  const fetchPhotos = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const url = showAllPhotos ? "/api/photos?all=true" : "/api/photos";
      const response = await fetch(url);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load photos");
      }
      const data = await response.json();
      setPhotos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleUploadSuccess = () => {
    fetchPhotos(true); // Show loading when user uploads
  };

  const handleMarkerClick = (photoId: string) => {
    setSelectedPhotoId(photoId);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold">Photo Map</h1>
            <SignOutButton />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {showAllPhotos
                ? "Showing all photos from all users."
                : "Only your uploads are shown here. Photos are shareable by direct link."}
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-700">
                {showAllPhotos ? "All Photos" : "My Photos"}
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showAllPhotos}
                  onChange={(e) => setShowAllPhotos(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                    showAllPhotos ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      showAllPhotos ? "translate-x-7" : "translate-x-1"
                    } mt-0.5`}
                  />
                </div>
              </div>
            </label>
          </div>
        </div>

        <PhotoUpload onUploadSuccess={handleUploadSuccess} />

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">Loading photos...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchPhotos(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <PhotoMap photos={photos} onMarkerClick={handleMarkerClick} />
            {photos.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center mt-4">
                <p className="text-gray-600">
                  No photos yet. Upload a photo to get started!
                </p>
              </div>
            )}
          </>
        )}

        <PhotoDetailModal
          photoId={selectedPhotoId}
          onClose={() => setSelectedPhotoId(null)}
          onDelete={() => {
            setSelectedPhotoId(null);
            fetchPhotos(true);
          }}
        />
      </div>
    </main>
  );
}

