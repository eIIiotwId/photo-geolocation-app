import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getVisionProvider } from "@/lib/ai/visionProvider";

// Ensure Node.js runtime (required for vision provider file operations)
export const runtime = "nodejs";

/**
 * Regenerate AI description for a photo
 * Only the photo owner can regenerate the description
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth();

    const photoId = params.id;

    // Fetch photo and verify ownership
    const photo = await db.photo.findFirst({
      where: {
        id: photoId,
        ownerId: user.id, // Only allow owner to regenerate
      },
      select: {
        id: true,
        url: true,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Reset AI status to PENDING
    await db.photo.update({
      where: { id: photoId },
      data: {
        aiStatus: "PENDING",
        aiDescription: null,
        aiError: null,
      },
    });

    // Generate AI description asynchronously (fire-and-forget)
    const provider = getVisionProvider();
    provider
      .describeImage(photo.url)
      .then(async (description) => {
        // Update photo with AI description
        await db.photo.update({
          where: { id: photoId },
          data: {
            aiStatus: "DONE",
            aiDescription: description,
            aiError: null,
          },
        });
      })
      .catch(async (error) => {
        // Update photo with error status
        await db.photo.update({
          where: { id: photoId },
          data: {
            aiStatus: "ERROR",
            aiError: error instanceof Error ? error.message : "Unknown error",
          },
        });
      });

    return NextResponse.json({
      message: "AI description regeneration started",
      aiStatus: "PENDING",
    });
  } catch (error) {
    console.error("Regenerate description error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

