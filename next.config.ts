import type { NextConfig } from "next";

const NODE_PROTOCOL_PATTERN = /^node:/;

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          NODE_PROTOCOL_PATTERN,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(
              NODE_PROTOCOL_PATTERN,
              ""
            );
          }
        )
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        worker_threads: false,
        child_process: false,
        module: false,
      };
    }

    return config;
  },
};

export default nextConfig;
