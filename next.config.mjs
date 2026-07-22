/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    // Линт запускается отдельным шагом CI; сборку не блокируем на warning'ах.
    ignoreDuringBuilds: false,
  },
  images: {
    // Favicon вендоров грузим с внешних доменов (Google s2 favicons).
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons/**" },
    ],
  },
};

export default nextConfig;
