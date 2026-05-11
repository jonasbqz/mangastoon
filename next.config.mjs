/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.weserv.nl",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8085",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8085",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/data/**",
      },
    ],
  },

  // Explicit in Next 16 and keeps local/dev behavior aligned with lector-comics.
  turbopack: {},

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/image-optimized/:path*",
          destination: "https://images.weserv.nl/:path*",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
