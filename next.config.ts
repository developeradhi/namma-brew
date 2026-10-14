import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static HTML export for GitHub Pages
  output: "export",
  basePath: isProd ? "/namma-brew" : "",
  assetPrefix: isProd ? "/namma-brew/" : "",
  images: {
    unoptimized: true,
  },
  // This is critical to allow ngrok to route without Next.js blocking client actions
  allowedDevOrigins: ['griminess-curable-sizable.ngrok-free.dev', 'localhost:3000'],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
