/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable WASM support for postflop-solver integration (Phase 3)
  webpack(config, { isServer }) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Prevent node: protocol imports from breaking client-side bundles.
    // Server-only modules (fs, path, crypto) are used behind typeof window checks
    // but webpack still tries to resolve them at bundle time.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:fs": false,
        "node:path": false,
        "node:crypto": false,
      };
    }

    return config;
  },

  // Turbopack is default in Next.js 16; empty config acknowledges the webpack->turbopack migration
  turbopack: {},

  // Required for SharedArrayBuffer (multi-threaded WASM solver)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
