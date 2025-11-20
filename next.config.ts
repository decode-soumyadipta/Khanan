import type { NextConfig } from "next";

const DEFAULT_API_URL = "https://khananapi.jambagrad.com/api";
const resolvedApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: resolvedApiUrl,
  },
  // Rewrites to forward API calls from frontend to backend
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${resolvedApiUrl}/:path*`,
        },
      ],
    };
  },
}

module.exports = nextConfig
