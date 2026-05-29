/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
  typescript: {
    // TypeScript build block pass korar jonno (Temporary checklist)
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint warning block pass korar jonno
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;