/**
 * Réconciliation Production ↔ Qualité.
 *
 * La Production déclare ce qu'elle a fabriqué ; la Qualité valide
 * indépendamment ce qu'elle accepte. L'écart entre les deux déclarations
 * est le point de contrôle : il alimente la liste des écarts.
 *
 * Exemple : la Production déclare 20 dalots bons ; la Qualité en valide
 * 15 conformes et 5 non conformes → écart de −5 sur la quantité bonne.
 *
 * Module pur (sans accès base) : partagé serveur ↔ client.
 */

export interface ProductionDeclaration {
  qteProduite: number;
  qteBonne: number;
  qteRebut: number;
}

export interface QualityDeclaration {
  qteControlee: number;
  qteConforme: number;
  qteNonConforme: number;
}

export type EcartLevel = "AUCUN" | "MINEUR" | "MAJEUR";

export interface Reconciliation {
  /** Quantité présentée au contrôle − quantité produite déclarée */
  ecartPresente: number;
  /** Quantité validée conforme − quantité déclarée bonne par la Production */
  ecartConforme: number;
  /** Quantité refusée par la Qualité − rebut déclaré par la Production */
  ecartRebut: number;
  /** Écart de conformité en % de la quantité produite */
  ecartConformePct: number;
  /** Taux de conformité constaté par la Qualité */
  tauxConformite: number;
  /** La saisie qualité est-elle cohérente (conforme + non conforme = contrôlée) ? */
  coherent: boolean;
  /** Un écart existe-t-il entre les deux déclarations ? */
  hasEcart: boolean;
  level: EcartLevel;
  /** Décision proposée d'après les quantités */
  suggestedDecision: "CONFORME" | "PARTIEL" | "NON_CONFORME" | "EN_ATTENTE";
}

/** Seuil au-delà duquel un écart de conformité est jugé majeur (% du produit). */
const SEUIL_MAJEUR_PCT = 5;

export function reconcile(
  prod: ProductionDeclaration,
  qual: QualityDeclaration,
): Reconciliation {
  const ecartPresente = qual.qteControlee - prod.qteProduite;
  const ecartConforme = qual.qteConforme - prod.qteBonne;
  const ecartRebut = qual.qteNonConforme - prod.qteRebut;

  const ecartConformePct =
    prod.qteProduite > 0 ? (Math.abs(ecartConforme) / prod.qteProduite) * 100 : 0;

  const tauxConformite =
    qual.qteControlee > 0 ? (qual.qteConforme / qual.qteControlee) * 100 : 0;

  const coherent =
    Math.abs(qual.qteConforme + qual.qteNonConforme - qual.qteControlee) < 0.001;

  const saisieQualite = qual.qteControlee > 0;
  const hasEcart =
    saisieQualite &&
    (Math.abs(ecartPresente) > 0.001 ||
      Math.abs(ecartConforme) > 0.001 ||
      Math.abs(ecartRebut) > 0.001);

  let level: EcartLevel = "AUCUN";
  if (hasEcart) level = ecartConformePct > SEUIL_MAJEUR_PCT ? "MAJEUR" : "MINEUR";

  let suggestedDecision: Reconciliation["suggestedDecision"] = "EN_ATTENTE";
  if (saisieQualite && coherent) {
    if (qual.qteNonConforme <= 0.001) suggestedDecision = "CONFORME";
    else if (qual.qteConforme <= 0.001) suggestedDecision = "NON_CONFORME";
    else suggestedDecision = "PARTIEL";
  }

  return {
    ecartPresente,
    ecartConforme,
    ecartRebut,
    ecartConformePct,
    tauxConformite,
    coherent,
    hasEcart,
    level,
    suggestedDecision,
  };
}

/** Formate un écart signé pour l'affichage. */
export function formatEcart(value: number, digits = 0) {
  const n = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  if (Math.abs(value) < 0.001) return "0";
  return `${value > 0 ? "+" : "−"}${n}`;
}
