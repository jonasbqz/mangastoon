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
        protocol: "https",
        hostname: "media.ikigaimangas.cloud",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image.ikigaimangas.cloud",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dashboard.olympusbiblioteca.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "server-img.platformoctopus.workers.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.statically.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "demo.flyimg.io",
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

  async redirects() {
    return [
      {
        source: "/manga/:id",
        destination: "/comics/:id",
        permanent: true,
      },
      {
        source: "/read/:id",
        has: [{ type: "query", key: "chapter", value: "(?<chapter>.*)" }],
        destination: "/comics/:id/chapters/:chapter",
        permanent: true,
      },
      {
        source: "/read/:id",
        destination: "/comics/:id",
        permanent: true,
      },
    ];
  },

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
