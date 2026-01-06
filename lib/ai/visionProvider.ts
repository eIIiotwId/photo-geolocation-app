import { join } from "path";
import { readFile } from "fs/promises";

/**
 * Vision Provider Interface
 * Describes a provider that can generate descriptions for images
 * 
 * Note: For providers like Ollama that need file bytes, convert the URL path
 * to an absolute file path carefully. Since imageUrlOrPath may start with "/"
 * (e.g., "/uploads/x.jpg"), use one of these safer patterns:
 * - Strip leading "/" first: join(process.cwd(), "public", imageUrlOrPath.replace(/^\//, ""))
 * - Or split and filter: join(process.cwd(), "public", ...imageUrlOrPath.split("/").filter(Boolean))
 * Alternatively, read the file and send as base64, depending on the provider's API.
 */
export interface VisionProvider {
  describeImage(imageUrlOrPath: string): Promise<string>;
}

/**
 * Mock Vision Provider
 * Returns a deterministic description for demo purposes
 */
export class MockVisionProvider implements VisionProvider {
  async describeImage(imageUrlOrPath: string): Promise<string> {
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return a deterministic description
    return "A photo taken near railway tracks and vegetation.";
  }
}

/**
 * Ollama Vision Provider
 * Uses local Ollama HTTP API to generate image descriptions via LLaVA or other vision models
 */
export class OllamaVisionProvider implements VisionProvider {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.model = process.env.OLLAMA_MODEL || "llava";
  }

  async describeImage(imageUrlOrPath: string): Promise<string> {
    try {
      // Validate path to prevent path traversal attacks
      // Only allow paths that start with /uploads/
      if (!imageUrlOrPath.startsWith("/uploads/")) {
        throw new Error("Invalid image path. Only /uploads/ paths are allowed.");
      }

      // Strip the /uploads/ prefix to get the relative filename
      const rel = imageUrlOrPath.replace(/^\/uploads\//, "");

      // Extra safety: prevent traversal and Windows-style separators
      if (rel.includes("..") || rel.includes("\\") || rel.startsWith("/")) {
        throw new Error("Invalid image path.");
      }

      // Length cap for extra defense
      if (rel.length > 200) {
        throw new Error("Invalid image path.");
      }

      // Only allow .jpg/.jpeg extensions (matches upload validation)
      if (!rel.toLowerCase().endsWith(".jpg") && !rel.toLowerCase().endsWith(".jpeg")) {
        throw new Error("Invalid image path. Only .jpg/.jpeg files are allowed.");
      }

      // Build absolute path safely within public/uploads/
      const absolutePath = join(process.cwd(), "public", "uploads", rel);

      // Read image file and convert to base64
      const imageBuffer = await readFile(absolutePath);
      const base64Image = imageBuffer.toString("base64");

      // Call Ollama API
      // Note: Ollama expects raw base64 in images array, not data URI format
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: "Describe what you see in this image directly and concisely. Do not use phrases like 'the image shows', 'this picture depicts', or 'the photo contains'. Just describe the content directly, for example: 'empty train tracks with grassy field around it' or 'train tracks with incoming train in middle of grassy field'. Be specific and descriptive.",
              images: [base64Image],
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama API error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();
      
      // Extract description from response
      if (data.message?.content) {
        // Get the raw response from Ollama
        let description = data.message.content.trim();
        
        // Remove markdown formatting (bullets, headers)
        description = description.replace(/^(?:\s*[-*]+\s*|#+\s*)/gm, "").trim();
        
        // Remove common verbose phrases that add no value
        description = description
          .replace(/^(the\s+)?(image|photo|picture)\s+(shows?|depicts?|displays?|contains?|features?)\s+/i, "")
          .replace(/^(this\s+)?(image|photo|picture)\s+(shows?|depicts?|displays?|contains?|features?)\s+/i, "")
          .replace(/^(in\s+)?(this\s+)?(image|photo|picture)[\s,]+/i, "")
          .trim();
        
        // Take the first complete sentence (up to period, exclamation, or question mark)
        const sentenceEnd = description.search(/[.!?]/);
        if (sentenceEnd > 0) {
          description = description.substring(0, sentenceEnd).trim();
        }
        
        // If still too long, truncate at word boundary
        if (description.length > 200) {
          const truncated = description.substring(0, 200);
          const lastSpace = truncated.lastIndexOf(" ");
          if (lastSpace > 150) {
            // Break at word boundary if reasonable
            description = truncated.substring(0, lastSpace).trim();
          } else {
            // If no good word boundary, just truncate (shouldn't happen often)
            description = truncated.trim();
          }
        }
        
        // Remove trailing punctuation
        description = description.replace(/[.,;:!?]+$/, "").trim();
        
        return description.trim();
      }

      // Log unexpected response shape for debugging (only keys, not full payload)
      console.error("Unexpected Ollama response keys:", Object.keys(data ?? {}));
      if (data?.model) {
        console.error("Ollama model:", data.model);
      }
      throw new Error(`Unexpected response format from Ollama API. Expected data.message.content, got keys: ${Object.keys(data ?? {}).join(", ")}`);
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        // Check if it's a connection error (Ollama not running)
        if (
          error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND")
        ) {
          throw new Error(
            `Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running.`
          );
        }
        // Check if file doesn't exist
        if (error.message.includes("ENOENT")) {
          throw new Error(`Image file not found: ${imageUrlOrPath}`);
        }
        throw error;
      }
      throw new Error("Unknown error during image description generation");
    }
  }
}

/**
 * Get the vision provider based on environment variable
 */
export function getVisionProvider(): VisionProvider {
  const provider = process.env.VISION_PROVIDER || "mock";
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV !== "production") {
    console.log(`[VisionProvider] Selected provider: ${provider} (from env: ${process.env.VISION_PROVIDER || 'not set'})`);
  }

  switch (provider) {
    case "mock":
      return new MockVisionProvider();
    case "ollama":
      return new OllamaVisionProvider();
    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[VisionProvider] Unknown provider "${provider}", defaulting to mock`);
      }
      return new MockVisionProvider();
  }
}

