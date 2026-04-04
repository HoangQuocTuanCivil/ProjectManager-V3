/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  typescript: {
    // Pre-existing type errors from placeholder Database type
    // Remove after running `npm run db:types`
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
};
export default nextConfig;
