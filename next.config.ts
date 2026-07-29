import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit charge ses métriques de police (.afm) depuis son propre dossier :
  // il doit rester externe au bundle serveur, sinon les chemins sont perdus.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdfkit", "exceljs"],
};

export default nextConfig;
