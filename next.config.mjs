/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Les justificatifs (photo ou PDF, 4 Mo au plus) passent par les actions
    // serveur, limitées à 1 Mo par défaut. Vercel plafonne de toute façon à 4,5 Mo.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
