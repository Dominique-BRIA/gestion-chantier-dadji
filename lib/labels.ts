export const ROLES = {
  INGENIEUR: "Ingénieur",
  CLIENT: "Client",
  CHEF_CHANTIER: "Chef de chantier",
  MANOEUVRE: "Manœuvre",
} as const;

export const TYPES_CHANTIER = {
  BATIMENT: "Bâtiment",
  ROUTE: "Route",
  OUVRAGE_ART: "Ouvrage d'art",
  ASSAINISSEMENT_VRD: "Assainissement / VRD",
  AUTRE: "Autre",
} as const;

// RG-10 : lots proposés par défaut selon le type de chantier.
export const LOTS_PAR_TYPE: Record<keyof typeof TYPES_CHANTIER, string[]> = {
  BATIMENT: ["Installation", "Terrassement", "Fondations", "Élévation", "Dalle", "Toiture", "Finitions"],
  ROUTE: ["Installation", "Terrassement", "Couche de forme", "Fondation", "Revêtement", "Signalisation"],
  OUVRAGE_ART: ["Installation", "Fondations", "Appuis", "Tablier", "Équipements"],
  ASSAINISSEMENT_VRD: ["Installation", "Tranchées", "Canalisations", "Regards", "Remblai", "Réfection"],
  AUTRE: [],
};

export const STATUTS_CHANTIER = {
  PREPARATION: "En préparation",
  EN_COURS: "En cours",
  SUSPENDU: "Suspendu",
  TERMINE: "Terminé",
} as const;

export const STATUTS_TACHE = { A_FAIRE: "À faire", EN_COURS: "En cours", TERMINEE: "Terminée" } as const;

export const STATUTS_VALIDATION = { EN_ATTENTE: "En attente", VALIDEE: "Validée", REJETEE: "Rejetée" } as const;

export const TYPES_MOUVEMENT = {
  ENTREE: "Entrée",
  SORTIE: "Sortie",
  PERTE: "Perte",
  RETOUR: "Retour fournisseur",
  CORRECTION: "Correction",
} as const;

export const CATEGORIES_DEPENSE = {
  MATERIAUX: "Matériaux",
  MAIN_OEUVRE: "Main-d'œuvre",
  TRANSPORT: "Transport",
  LOCATION_MATERIEL: "Location de matériel",
  DIVERS: "Divers",
} as const;

export const MODES_PAIEMENT = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile money",
  CHEQUE: "Chèque",
} as const;

export const STATUTS_PRESENCE = { PRESENT: "Présent", RETARD: "En retard", ABSENT: "Absent" } as const;

export const TYPES_SIGNALEMENT = {
  MANQUE_MATERIAU: "Manque de matériau",
  PERTE: "Perte",
  INCIDENT: "Incident",
  ANOMALIE: "Anomalie",
  DEMANDE_JUSTIFICATION: "Demande de justification",
} as const;

export const STATUTS_SIGNALEMENT = { OUVERT: "Ouvert", EN_COURS: "En cours", CLOS: "Clos" } as const;

export const CAUSES_RETARD = [
  "Intempéries",
  "Rupture de matériaux",
  "Manque de main-d'œuvre",
  "Panne de matériel",
  "Modification du client",
  "Autre",
];
