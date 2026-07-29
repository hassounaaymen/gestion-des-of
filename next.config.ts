import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Paquets à laisser hors du bundle serveur :
  //  - pdfkit charge ses métriques de police (.afm) depuis son propre dossier ;
  //  - libSQL embarque un binaire natif que webpack ne sait pas empaqueter.
  serverExternalPackages: [
    "@prisma/client",
    "bcryptjs",
    "pdfkit",
    "exceljs",
    "@prisma/adapter-libsql",
    "@libsql/client",
    "libsql",
  ],
};

export default nextConfig;
