import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { unlink } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth();

    const photoId = params.id;

    // Fetch photo by ID (any authenticated user can view)
    const photo = await db.photo.findFirst({
      where: {
        id: photoId,
      },
      select: {
        id: true,
        url: true,
        lat: true,
        lng: true,
        aiStatus: true,
        aiDescription: true,
        aiError: true,
        createdAt: true,
        ownerId: true, // Include ownerId to check ownership on client
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(photo);
  } catch (error) {
    console.error("Photo detail error:", error);

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

export async function DELETE(
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
        ownerId: user.id, // Only allow deleting own photos
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

    // Delete the image file
    try {
      const imagePath = join(process.cwd(), "public", photo.url);
      await unlink(imagePath);
    } catch (fileError) {
      // Log but don't fail if file doesn't exist
      console.warn(`Failed to delete image file: ${photo.url}`, fileError);
    }

    // Delete photo from database (cascade will delete comments)
    await db.photo.delete({
      where: {
        id: photoId,
      },
    });

    return NextResponse.json({ message: "Photo deleted successfully" });
  } catch (error) {
    console.error("Photo deletion error:", error);

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

