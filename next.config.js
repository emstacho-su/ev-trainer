/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable WASM support for postflop-solver integration (Phase 3)
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },

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
