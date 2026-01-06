import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

/**
 * Check if photo exists (any authenticated user can view/comment)
 * Returns the photo ID if valid, null otherwise
 */
async function verifyPhotoExists(photoId: string): Promise<string | null> {
  const photo = await db.photo.findFirst({
    where: {
      id: photoId,
    },
    select: {
      id: true,
    },
  });

  return photo?.id || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth();

    const photoId = params.id;

    // Verify photo exists (any authenticated user can view comments)
    const photo = await verifyPhotoExists(photoId);
    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Fetch comments for this photo, sorted by createdAt ascending
    const comments = await db.comment.findMany({
      where: {
        photoId: photoId,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Comments list error:", error);

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const user = await requireAuth();

    const photoId = params.id;

    // Verify photo exists (any authenticated user can comment)
    const photo = await verifyPhotoExists(photoId);
    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Comment content is required and must be a string. Please provide a valid comment." },
        { status: 400 }
      );
    }

    // Trim whitespace and validate length
    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { error: "Comment cannot be empty. Please enter some text." },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 500) {
      return NextResponse.json(
        { error: `Comment is too long (${trimmedContent.length} characters). Maximum length is 500 characters.` },
        { status: 400 }
      );
    }

    // Create comment
    const comment = await db.comment.create({
      data: {
        photoId: photoId,
        authorId: user.id,
        content: trimmedContent,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Comment creation error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

