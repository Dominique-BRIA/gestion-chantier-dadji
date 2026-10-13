/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Les justificatifs (photo ou PDF, 4 Mo au plus) passent par les actions
    // serveur, limitées à 1 Mo par défaut. Vercel plafonne de toute façon à 4,5 Mo.
    serverActions: { bodySizeLimit: "5mb" },
    // Le moteur PDF charge ses polices et son module de mise en page à
    // l'exécution : il ne doit pas passer par le regroupement de Next.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
