"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
  };
}

interface PhotoDetail {
  id: string;
  url: string;
  lat: number;
  lng: number;
  aiStatus: string;
  aiDescription: string | null;
  aiError: string | null;
  createdAt: string;
  ownerId: string;
}

interface PhotoDetailModalProps {
  photoId: string | null;
  onClose: () => void;
  onDelete?: () => void; // Callback when photo is deleted
}

export default function PhotoDetailModal({
  photoId,
  onClose,
  onDelete,
}: PhotoDetailModalProps) {
  const { data: session } = useSession();
  const [photo, setPhoto] = useState<PhotoDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Check if current user owns this photo
  const isOwner = photo && session?.user?.id && photo.ownerId === session.user.id;

  // Reset modal state when photoId changes or modal closes
  useEffect(() => {
    if (!photoId) {
      setPhoto(null);
      setComments([]);
      setShowDeleteConfirm(false);
      setDeleting(false);
      setRegenerating(false);
      setError("");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [photoRes, commentsRes] = await Promise.all([
          fetch(`/api/photos/${photoId}`),
          fetch(`/api/photos/${photoId}/comments`),
        ]);

        if (!photoRes.ok) {
          throw new Error("Failed to load photo");
        }

        const photoData = await photoRes.json();
        setPhoto(photoData);

        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          setComments(commentsData);
        }
        
        // Reset delete and regenerate states when loading a new photo
        setShowDeleteConfirm(false);
        setDeleting(false);
        setRegenerating(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load photo");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [photoId]);

  // Auto-refresh when AI status is PENDING
  useEffect(() => {
    if (!photoId || !photo || photo.aiStatus !== "PENDING") {
      return;
    }

    // Poll every 2 seconds to check if AI generation is complete
    const interval = setInterval(async () => {
      try {
        const photoRes = await fetch(`/api/photos/${photoId}`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          setPhoto(photoData);
          
          // Stop polling if status changed from PENDING
          if (photoData.aiStatus !== "PENDING") {
            clearInterval(interval);
          }
        }
      } catch (err) {
        // Silently fail - don't show error for polling
        console.error("Failed to refresh photo status:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [photoId, photo]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoId || !commentContent.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: commentContent.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to post comment");
      }

      const newComment = await response.json();
      setComments([...comments, newComment]);
      setCommentContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!photoId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete photo");
      }

      // Reset all states before closing
      setShowDeleteConfirm(false);
      setDeleting(false);
      setPhoto(null);
      setComments([]);
      
      // Close modal and refresh photo list
      onClose();
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!photoId) return;

    setRegenerating(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/regenerate-description`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to regenerate description");
      }

      // Update photo state to show PENDING status
      if (photo) {
        setPhoto({
          ...photo,
          aiStatus: "PENDING",
          aiDescription: null,
          aiError: null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate description");
    } finally {
      setRegenerating(false);
    }
  };

  if (!photoId) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Photo Details</h2>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : photo ? (
            <>
              <div className="mb-4 relative w-full h-auto">
                <Image
                  src={photo.url}
                  alt="Photo"
                  width={800}
                  height={600}
                  sizes="100vw"
                  className="w-full h-auto rounded-lg"
                  unoptimized
                />
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">AI Description</h3>
                  {isOwner && (
                    <button
                      onClick={handleRegenerateDescription}
                      disabled={regenerating || photo.aiStatus === "PENDING"}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {regenerating ? "Regenerating..." : "Regenerate"}
                    </button>
                  )}
                </div>
                {photo.aiStatus === "PENDING" && (
                  <p className="text-gray-500 italic">Generating description...</p>
                )}
                {photo.aiStatus === "ERROR" && (
                  <div>
                    <p className="text-red-500">Failed to generate description</p>
                    {photo.aiError && (
                      <p className="text-xs text-red-400 mt-1">{photo.aiError}</p>
                    )}
                  </div>
                )}
                {photo.aiStatus === "DONE" && photo.aiDescription && (
                  <p className="text-gray-700">{photo.aiDescription}</p>
                )}
                {photo.aiStatus === "DONE" && !photo.aiDescription && (
                  <p className="text-gray-500">No description available</p>
                )}
              </div>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">Comments</h3>
                <div className="space-y-3 mb-4">
                  {comments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="border-b pb-3 last:border-b-0"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm">
                            {comment.author.email}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSubmitComment} className="space-y-2">
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {commentContent.length}/500
                    </span>
                    <button
                      type="submit"
                      disabled={!commentContent.trim() || submitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4">
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Delete Photo</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this photo? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

