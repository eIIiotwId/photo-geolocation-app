/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // For user-uploaded images in /uploads
  },
};

module.exports = nextConfig;

