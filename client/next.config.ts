import type { NextConfig } from "next";
import { checkEnv } from "./check-env";

// Abort dev/build with a clear message if any required env var is missing.
checkEnv();

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      "images.unsplash.com",
      "stsadekirfan532192938747.blob.core.windows.net",
      "files.tryunsora.com",
      "img.youtube.com",
    ],
  },
};

export default nextConfig;
