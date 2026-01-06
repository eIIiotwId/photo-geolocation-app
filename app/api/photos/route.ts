import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizeGps } from "@/lib/gps";
import { getVisionProvider } from "@/lib/ai/visionProvider";
import exifr from "exifr";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Ensure Node.js runtime (required for fs/promises and path operations)
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Accept both image/jpeg (standard) and image/jpg (non-standard but commonly used)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg"];

/**
 * Generate AI description for a photo (async, fire-and-forget)
 */
async function generateAIDescription(photoId: string, imageUrl: string): Promise<void> {
  try {
    const provider = getVisionProvider();
    const description = await provider.describeImage(imageUrl);

    // Update photo with AI description
    await db.photo.update({
      where: { id: photoId },
      data: {
        aiStatus: "DONE",
        aiDescription: description,
        aiError: null,
      },
    });
  } catch (error) {
    // Update photo with error status
    await db.photo.update({
      where: { id: photoId },
      data: {
        aiStatus: "ERROR",
        aiError: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Check if "all" query parameter is present to show all photos
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";

    // Fetch photos based on toggle state
    const photos = await db.photo.findMany({
      where: showAll
        ? {} // No filter - show all photos
        : {
            ownerId: user.id, // Only user's photos
          },
      select: {
        id: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error("Photos list error:", error);

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

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please select an image file to upload." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG/JPG images are allowed. Received: " + file.type },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { error: `File size (${sizeMB}MB) exceeds the 10MB limit. Please upload a smaller image.` },
        { status: 400 }
      );
    }

    // Convert File to Buffer for EXIF extraction
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract GPS coordinates from EXIF
    const exifData = await exifr.parse(buffer, {
      gps: true,
      pick: ["latitude", "longitude", "GPSLatitude", "GPSLongitude"],
    });

    // Try multiple possible GPS field names
    let lat = exifData?.latitude || exifData?.GPSLatitude;
    let lng = exifData?.longitude || exifData?.GPSLongitude;

    // Normalize GPS coordinates to numbers
    lat = normalizeGps(lat);
    lng = normalizeGps(lng);

    if (lat === null || lng === null) {
      return NextResponse.json(
        { error: "Image does not contain GPS coordinates in EXIF metadata. Please upload a photo taken with a device that has location services enabled." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const filename = `${uuidv4()}.jpg`;
    const uploadsDir = join(process.cwd(), "public", "uploads");

    // Ensure uploads directory exists
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file to public/uploads
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Create Photo record in database with PENDING status
    const photo = await db.photo.create({
      data: {
        ownerId: user.id,
        url: `/uploads/${filename}`,
        lat: lat as number,
        lng: lng as number,
        aiStatus: "PENDING",
      },
      select: {
        id: true,
        url: true,
        lat: true,
        lng: true,
        createdAt: true,
        aiStatus: true,
        aiDescription: true,
      },
    });

    // Generate AI description asynchronously (fire-and-forget)
    generateAIDescription(photo.id, photo.url).catch((error) => {
      console.error(`Failed to generate AI description for photo ${photo.id}:`, error);
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("Photo upload error:", error);
    
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

