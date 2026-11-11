import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/map/combined", destination: "/map", permanent: false },
      { source: "/map/personal", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
