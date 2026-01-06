# Photo Geolocation App

A full-stack web application for uploading photos with GPS coordinates, displaying them on an interactive map, and managing comments with AI-generated descriptions.

## 🚀 Quick Start (< 10 minutes)

### Prerequisites

- **Node.js 18+** and npm
- **Docker** and Docker Compose (for PostgreSQL)
- **Git** (to clone the repository)

### Step-by-Step Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd photo-geolocation-app
   npm install
   ```

2. **Start PostgreSQL with Docker Compose:**
   ```bash
   docker compose up -d
   ```
   Wait ~10 seconds for PostgreSQL to be ready. Verify with:
   ```bash
   docker compose ps
   ```
   The `photo-geolocation-db` container should show status "healthy".

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Generate a NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```
   
   Edit `.env` and set:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/photo_geolocation?schema=public"
   NEXTAUTH_SECRET="<paste-generated-secret>"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

7. **Create an account:**
   - Click "Sign up"
   - Enter email and password (min 8 characters)
   - You'll be redirected to the map page

8. **Upload a photo:**
   - Click "Choose File" and select a JPEG image with GPS coordinates in EXIF metadata
   - The photo will appear on the map as a marker
   - Click the marker to view details, AI description, and comments

9. **Explore photos:**
   - Use the toggle switch to switch between "My Photos" (your uploads only) and "All Photos" (all users' photos)
   - When "All Photos" is enabled, the map automatically refreshes every 5 seconds to show new uploads
   - The map intelligently zooms only when new photos are outside your current view

**🎉 You're all set!** The app should be running and ready to use.

### Health Check

Visit [http://localhost:3000/health](http://localhost:3000/health) to verify the app is running correctly.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [AI Description Generation](#ai-description-generation)
- [Authorization Model](#authorization-model)
- [Development](#development)
- [Database Management](#database-management)
- [Rate Limiting](#rate-limiting)
- [Tradeoffs & Next Steps](#tradeoffs--next-steps)

---

## ✨ Features

- **User Authentication**: Sign up and login with email/password
- **Photo Upload**: Upload JPEG images with GPS coordinates (EXIF extraction)
- **Interactive Map**: View uploaded photos on a MapLibre GL map with smart zoom behavior
- **Photo Filtering**: Toggle between "My Photos" (private view) and "All Photos" (shared view)
- **Photo Details**: Click markers to view full-size images, AI descriptions, and comments
- **AI Descriptions**: Automatic image description generation using Ollama (LLaVA) or mock provider
- **Comments**: Add and view comments on any photo (authenticated users)
- **Photo Management**: Delete your own photos with confirmation
- **Regenerate AI**: Retry AI description generation for your photos
- **Auto-Refresh**: Automatically updates when viewing "All Photos" to show new uploads from other users

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: Auth.js (NextAuth) with Credentials provider
- **Maps**: MapLibre GL (OpenStreetMap tiles)
- **Image Processing**: `exifr` for EXIF GPS extraction
- **AI**: Ollama (local LLaVA model) or mock provider
- **File Storage**: Local filesystem (`public/uploads/`)

---

## 📁 Project Structure

```
├── app/
│   ├── api/              # API route handlers
│   │   ├── photos/       # Photo CRUD operations
│   │   ├── signup/       # User registration
│   │   └── auth/         # NextAuth configuration
│   ├── map/              # Map page (protected)
│   ├── login/            # Login page
│   ├── signup/           # Signup page
│   └── layout.tsx        # Root layout
├── components/
│   ├── PhotoMap.tsx      # MapLibre GL map component
│   ├── PhotoUpload.tsx   # File upload component
│   └── PhotoDetailModal.tsx  # Photo detail modal
├── lib/
│   ├── ai/               # AI vision providers
│   ├── auth-helpers.ts   # Authentication utilities
│   ├── db.ts             # Prisma client singleton
│   └── gps.ts            # GPS coordinate normalization
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
└── public/
    └── uploads/          # Uploaded photo storage
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/signup` - Create new user account
- `POST /api/auth/callback/credentials` - Login (handled by NextAuth)
- `POST /api/auth/signout` - Sign out

### Photos
- `GET /api/photos` - List user's photos (auth required)
  - Query parameter: `?all=true` to get all photos from all users
- `POST /api/photos` - Upload new photo (auth required, multipart/form-data)
- `GET /api/photos/[id]` - Get photo details (auth required, any user can view)
- `DELETE /api/photos/[id]` - Delete photo (auth required, owner only)
- `POST /api/photos/[id]/regenerate-description` - Regenerate AI description (auth required, owner only)

### Comments
- `GET /api/photos/[id]/comments` - List comments for a photo (auth required)
- `POST /api/photos/[id]/comments` - Create comment (auth required)

### Error Response Format

All API errors follow a consistent JSON format:
```json
{
  "error": "Error message describing what went wrong"
}
```

Common status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (e.g., email already exists)
- `500` - Internal Server Error

---

## 🤖 AI Description Generation

### How It Works

1. **Upload**: When a photo is uploaded, it's saved with `aiStatus='PENDING'`
2. **Async Processing**: AI description generation runs asynchronously (fire-and-forget)
3. **Status Updates**: The photo's `aiStatus` is updated to `'DONE'` (with description) or `'ERROR'` (with error message)
4. **Auto-Refresh**: The UI automatically polls the photo status every 2 seconds when `aiStatus='PENDING'` to show the description when ready

### Vision Providers

The app supports two vision providers:

#### Mock Provider (Default)
- Returns a deterministic description: "A photo taken near railway tracks and vegetation."
- Useful for testing without AI dependencies
- Set via: `VISION_PROVIDER=mock` (or leave unset)

#### Ollama Provider
- Uses local Ollama with vision models (e.g., LLaVA)
- Generates real AI descriptions based on image content
- Requires Ollama to be installed and running

**Setting up Ollama:**

1. **Install Ollama**: Download from [https://ollama.ai](https://ollama.ai)
2. **Pull a vision model**:
   ```bash
   ollama pull llava
   ```
3. **Verify Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```
4. **Configure `.env`**:
   ```bash
   VISION_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434  # Optional, defaults to this
   OLLAMA_MODEL=llava                      # Optional, defaults to "llava"
   ```
5. **Restart the dev server** (environment variables load on startup)

**Note**: If Ollama is not running or unavailable, photo uploads still succeed, but the AI description will show an error status. Users can click "Regenerate" to retry.

### Server Restart Resilience

The current implementation uses "fire-and-forget" async processing. If the server restarts while AI generation is in progress:
- The in-flight request is lost
- The photo remains in `PENDING` status
- Users can click "Regenerate" to retry

**Production Consideration**: In production, this would be handled by a persistent job queue (e.g., Bull, BullMQ, Redis Queue) that survives server restarts.

---

## 🔐 Authorization Model

- **Photo Listing**: 
  - Default: Users see only their own uploaded photos ("My Photos" view)
  - Optional: Users can toggle to "All Photos" to see photos from all users
  - The "All Photos" view automatically refreshes every 5 seconds to show new uploads
- **Photo Details**: Any authenticated user can view any photo's details
- **Comments**: Any authenticated user can view and add comments to any photo
- **Photo Deletion**: Only the photo owner can delete their photos
- **AI Regeneration**: Only the photo owner can regenerate AI descriptions

This hybrid model supports:
- **Privacy**: Users control their photo listings (default private view)
- **Sharing**: Users can opt-in to see all photos via the toggle switch
- **Collaboration**: Comments enable discussion on shared photos
- **Real-time Updates**: Auto-refresh when viewing "All Photos" keeps the map up-to-date

---

## 💻 Development

### Available Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Scripts

```bash
npm run db:push      # Push schema changes to database (development)
npm run db:migrate   # Create and apply migrations
npm run db:studio    # Open Prisma Studio (database GUI)
```

### Docker Commands

```bash
docker compose up -d        # Start PostgreSQL container
docker compose down         # Stop PostgreSQL container
docker compose ps           # Check container status
docker compose down -v      # Stop and remove volumes (fresh database)
```

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for NextAuth session encryption
- `NEXTAUTH_URL` - Base URL of the application

Optional (AI):
- `VISION_PROVIDER` - `"mock"` (default) or `"ollama"`
- `OLLAMA_BASE_URL` - Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `"llava"`)

---

## 🗄 Database Management

### Reset Database

To start with a fresh database (removes all user data, photos, and comments):

```bash
docker compose down -v      # Remove volumes (deletes all data)
docker compose up -d        # Start fresh container
npm run db:migrate          # Run migrations
```

**Note**: This will delete all uploaded photos, user accounts, and comments. The `public/uploads/` directory will also need to be cleaned manually if you want to remove uploaded image files.

### View Database

Use Prisma Studio to browse and edit data:

```bash
npm run db:studio
```

Opens at [http://localhost:5555](http://localhost:5555)

---

## 🚦 Rate Limiting

**Current Status**: Rate limiting is not implemented in this MVP.

**Production Recommendations**:
- Implement rate limiting for API endpoints (e.g., using `@upstash/ratelimit` or `express-rate-limit`)
- Suggested limits:
  - Photo uploads: 10 per minute per user
  - Comments: 30 per minute per user
  - Signup/Login: 5 attempts per 15 minutes per IP
- Consider using a Redis-backed rate limiter for distributed systems

---

## ⚖️ Tradeoffs & Next Steps

### Current Tradeoffs

1. **File Storage**: Using local filesystem (`public/uploads/`) instead of object storage (S3, Cloudflare R2)
   - **Why**: Simpler for MVP, no external dependencies
   - **Next**: Migrate to object storage for production scalability

2. **AI Processing**: Fire-and-forget async instead of job queue
   - **Why**: Simpler implementation, no queue infrastructure needed
   - **Next**: Implement persistent job queue (Bull/BullMQ) for reliability

3. **Rate Limiting**: Not implemented
   - **Why**: MVP focus on core features
   - **Next**: Add rate limiting middleware

4. **Error Handling**: Basic error messages
   - **Why**: Sufficient for MVP
   - **Next**: Add structured error codes, i18n support

5. **Image Optimization**: Using Next.js unoptimized images
   - **Why**: User-uploaded images, simpler setup
   - **Next**: Add image resizing/optimization pipeline

### Recommended Next Steps

1. **Production Hardening**:
   - Add rate limiting
   - Implement persistent job queue for AI generation
   - Add comprehensive error logging (Sentry, etc.)
   - Set up monitoring and alerting

2. **Scalability**:
   - Migrate file storage to object storage (S3/R2)
   - Add CDN for static assets
   - Implement database connection pooling
   - Add caching layer (Redis)

3. **Features**:
   - Photo albums/collections
   - Photo sharing via public links (currently authenticated users only)
   - Advanced map filters (date range, location, user filter)
   - Photo search
   - User profiles
   - Real-time updates via WebSockets (instead of polling)

4. **Testing**:
   - Add unit tests (Jest)
   - Add integration tests (Playwright)
   - Add API tests (Supertest)

5. **Documentation**:
   - API documentation (OpenAPI/Swagger)
   - Deployment guide
   - Architecture diagrams

---

## 📝 License

This project is a technical assessment submission.

---

## 🙏 Acknowledgments

- OpenStreetMap for map tiles
- Ollama for local AI inference
- Next.js and the React ecosystem
