/**
 * Jeu de données fictives (étape 5 du cahier) : deux chantiers simulés jour par
 * jour, avec des consommations cohérentes avec les travaux et quelques
 * situations volontaires pour faire réagir les alertes (rapport manquant,
 * dépense atypique sans justificatif, production non validée, avance en attente).
 *
 * Générateur pseudo-aléatoire à graine fixe : chaque exécution donne les mêmes
 * chiffres, ce qui permet de vérifier les calculs d'une fois sur l'autre.
 *
 * Mot de passe de démonstration de tous les comptes : Chantier2026
 */
import { PrismaClient, type Prisma, type TypeChantier } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const MDP = "Chantier2026";

let graine = 20261013;
function alea(): number {
  graine |= 0;
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + (b - a) * alea();
const bruit = (v: number, p: number) => v * entre(1 - p, 1 + p);
const arrondi = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function hache(mdp: string) {
  const sel = randomBytes(16).toString("hex");
  return `${sel}:${scryptSync(mdp, sel, 64).toString("hex")}`;
}

const auj = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
})();
const jour = (n: number) => new Date(auj.getTime() + n * 86_400_000);

interface Mat {
  designation: string;
  unite: string;
  categorie: string;
  prix: number;
  delai: number;
  seuil: number;
  commande: number;
}
interface Tache {
  lot: string;
  designation: string;
  unite: string;
  quantite: number;
  cout: number;
  debut: number;
  fin: number;
  /** Rythme réel rapporté au rythme prévu (< 1 : la tâche prend du retard). */
  rythme: number;
  /** Consommation de matériaux par unité d'ouvrage. */
  conso: Record<string, number>;
  cause?: string;
}
interface Config {
  code: string;
  nom: string;
  localisation: string;
  type: TypeChantier;
  budget: number;
  debut: number;
  duree: number;
  client: { nom: string; prenom: string; telephone: string };
  chef: { nom: string; prenom: string; telephone: string };
  ouvriers: number;
  telBase: number;
  materiaux: Mat[];
  taches: Tache[];
  avances: { jour: number; montant: number; enAttente?: boolean }[];
  locationJour: number;
}

const BATIMENT: Config = {
  code: "BAT-2026-01",
  nom: "Villa R+1 Mendong",
  localisation: "Mendong, Yaoundé",
  type: "BATIMENT",
  budget: 45_000_000,
  debut: -49,
  duree: 120,
  client: { nom: "Atangana", prenom: "Paul", telephone: "690000002" },
  chef: { nom: "Essomba", prenom: "Martin", telephone: "690000010" },
  ouvriers: 9,
  telBase: 690000100,
  materiaux: [
    { designation: "Ciment CPJ 42,5 (50 kg)", unite: "sac", categorie: "Liants", prix: 5500, delai: 3, seuil: 6, commande: 300 },
    { designation: "Sable", unite: "m³", categorie: "Granulats", prix: 12000, delai: 2, seuil: 4, commande: 20 },
    { designation: "Gravier 15/25", unite: "m³", categorie: "Granulats", prix: 18000, delai: 3, seuil: 5, commande: 20 },
    { designation: "Fer HA 10", unite: "barre", categorie: "Aciers", prix: 4800, delai: 5, seuil: 8, commande: 200 },
    { designation: "Parpaing creux de 15", unite: "unité", categorie: "Maçonnerie", prix: 450, delai: 4, seuil: 6, commande: 2500 },
    { designation: "Planche de coffrage", unite: "planche", categorie: "Bois", prix: 2500, delai: 2, seuil: 4, commande: 120 },
  ],
  taches: [
    { lot: "Installation", designation: "Installation de chantier", unite: "forfait", quantite: 1, cout: 800_000, debut: 0, fin: 4, rythme: 1, conso: {} },
    { lot: "Terrassement", designation: "Fouilles en rigole", unite: "m³", quantite: 120, cout: 2_400_000, debut: 3, fin: 14, rythme: 0.8, conso: {}, cause: "Intempéries" },
    { lot: "Fondations", designation: "Béton de propreté", unite: "m³", quantite: 8, cout: 900_000, debut: 14, fin: 18, rythme: 1, conso: { "Ciment CPJ 42,5 (50 kg)": 3, "Sable": 0.45, "Gravier 15/25": 0.85 } },
    { lot: "Fondations", designation: "Semelles et longrines en béton armé", unite: "m³", quantite: 35, cout: 6_500_000, debut: 17, fin: 33, rythme: 0.85, conso: { "Ciment CPJ 42,5 (50 kg)": 7, "Sable": 0.4, "Gravier 15/25": 0.8, "Fer HA 10": 9, "Planche de coffrage": 2 }, cause: "Rupture de matériaux" },
    { lot: "Élévation", designation: "Maçonnerie en parpaings de 15", unite: "m²", quantite: 650, cout: 7_800_000, debut: 31, fin: 62, rythme: 0.92, conso: { "Parpaing creux de 15": 12.5, "Ciment CPJ 42,5 (50 kg)": 0.22, "Sable": 0.03 } },
    { lot: "Élévation", designation: "Poteaux en béton armé", unite: "m³", quantite: 12, cout: 3_600_000, debut: 36, fin: 62, rythme: 0.9, conso: { "Ciment CPJ 42,5 (50 kg)": 7, "Sable": 0.4, "Gravier 15/25": 0.8, "Fer HA 10": 12, "Planche de coffrage": 3 } },
    { lot: "Dalle", designation: "Coffrage et coulage de la dalle", unite: "m²", quantite: 220, cout: 8_500_000, debut: 62, fin: 82, rythme: 1, conso: {} },
    { lot: "Toiture", designation: "Charpente et couverture", unite: "m²", quantite: 240, cout: 6_000_000, debut: 82, fin: 100, rythme: 1, conso: {} },
    { lot: "Finitions", designation: "Enduits intérieurs et extérieurs", unite: "m²", quantite: 1300, cout: 5_200_000, debut: 96, fin: 119, rythme: 1, conso: {} },
  ],
  avances: [
    { jour: 0, montant: 10_000_000 },
    { jour: 20, montant: 8_000_000 },
    { jour: 37, montant: 6_000_000 },
    { jour: 48, montant: 5_000_000, enAttente: true },
  ],
  locationJour: 35_000,
};

const ROUTE: Config = {
  code: "RTE-2026-02",
  nom: "Réhabilitation route Nkolbisson (1,8 km)",
  localisation: "Nkolbisson, Yaoundé",
  type: "ROUTE",
  budget: 62_000_000,
  debut: -27,
  duree: 90,
  client: { nom: "Ngo Bayiha", prenom: "Marie", telephone: "690000003" },
  chef: { nom: "Fouda", prenom: "Serge", telephone: "690000011" },
  ouvriers: 7,
  telBase: 690000200,
  materiaux: [
    { designation: "Latérite", unite: "m³", categorie: "Granulats", prix: 6500, delai: 2, seuil: 4, commande: 400 },
    { designation: "Grave concassée 0/31,5", unite: "m³", categorie: "Granulats", prix: 22000, delai: 4, seuil: 6, commande: 250 },
    { designation: "Ciment CPJ 42,5 (50 kg)", unite: "sac", categorie: "Liants", prix: 5600, delai: 3, seuil: 5, commande: 150 },
    { designation: "Buse béton Ø 800", unite: "unité", categorie: "Assainissement", prix: 65000, delai: 7, seuil: 10, commande: 12 },
  ],
  taches: [
    { lot: "Installation", designation: "Installation et signalisation de chantier", unite: "forfait", quantite: 1, cout: 1_500_000, debut: 0, fin: 3, rythme: 1, conso: {} },
    { lot: "Terrassement", designation: "Décapage et déblais", unite: "m³", quantite: 3200, cout: 9_600_000, debut: 2, fin: 20, rythme: 0.95, conso: {} },
    { lot: "Couche de forme", designation: "Couche de forme en latérite", unite: "m³", quantite: 2700, cout: 14_000_000, debut: 15, fin: 40, rythme: 1.05, conso: { "Latérite": 1.15 } },
    { lot: "Fondation", designation: "Ouvrages d'assainissement (buses)", unite: "ml", quantite: 96, cout: 7_200_000, debut: 18, fin: 45, rythme: 0.9, conso: { "Buse béton Ø 800": 0.5, "Ciment CPJ 42,5 (50 kg)": 1.8 } },
    { lot: "Fondation", designation: "Couche de base en grave concassée", unite: "m³", quantite: 1900, cout: 18_000_000, debut: 38, fin: 65, rythme: 1, conso: {} },
    { lot: "Revêtement", designation: "Revêtement bicouche", unite: "m²", quantite: 12600, cout: 8_500_000, debut: 62, fin: 84, rythme: 1, conso: {} },
    { lot: "Signalisation", designation: "Signalisation horizontale et verticale", unite: "forfait", quantite: 1, cout: 2_000_000, debut: 82, fin: 89, rythme: 1, conso: {} },
  ],
  avances: [
    { jour: 0, montant: 15_000_000 },
    { jour: 14, montant: 10_000_000 },
  ],
  locationJour: 180_000,
};

const METIERS = ["Maçon", "Ferrailleur", "Coffreur", "Manœuvre", "Manœuvre", "Maçon"];
const PRENOMS = ["Alain", "Bertrand", "Cyrille", "Daniel", "Éric", "Franck", "Gilles", "Hervé", "Idriss", "Joël", "Kevin", "Luc"];
const NOMS = ["Mvondo", "Onana", "Abena", "Bella", "Tchoua", "Ndzana", "Owona", "Eyenga", "Manga", "Zambo", "Ekani", "Nkoa"];

async function simuler(cfg: Config, ingenieurId: number) {
  const client = await prisma.utilisateur.create({ data: { ...cfg.client, role: "CLIENT", motDePasseHash: hache(MDP) } });
  const chef = await prisma.utilisateur.create({ data: { ...cfg.chef, role: "CHEF_CHANTIER", motDePasseHash: hache(MDP) } });
  const ouvriers = [];
  for (let i = 0; i < cfg.ouvriers; i++) {
    const metier = METIERS[i % METIERS.length];
    ouvriers.push(
      await prisma.utilisateur.create({
        data: {
          nom: NOMS[(i + cfg.telBase) % NOMS.length],
          prenom: PRENOMS[i % PRENOMS.length],
          telephone: String(cfg.telBase + i),
          role: "MANOEUVRE",
          metier,
          tauxJournalier: metier === "Manœuvre" ? 4000 : metier === "Maçon" ? 7000 : 6500,
          motDePasseHash: hache(MDP),
        },
      }),
    );
  }
  const debut = jour(cfg.debut);
  const chantier = await prisma.chantier.create({
    data: {
      code: cfg.code,
      nom: cfg.nom,
      localisation: cfg.localisation,
      type: cfg.type,
      budgetInitial: cfg.budget,
      dateDebutPrevue: debut,
      dateFinPrevue: jour(cfg.debut + cfg.duree),
      dateDebutReelle: debut,
      statut: "EN_COURS",
      ingenieurId,
      clientId: client.id,
    },
  });
  await prisma.affectation.createMany({
    data: [chef, ...ouvriers].map((u) => ({
      utilisateurId: u.id,
      chantierId: chantier.id,
      fonction: u.role === "CHEF_CHANTIER" ? "Chef de chantier" : u.metier!,
      dateDebut: debut,
    })),
  });

  const mats = new Map<string, { id: number; stock: number; m: Mat; enCommande: number | null; prix: number }>();
  for (const m of cfg.materiaux) {
    const r = await prisma.materiau.create({
      data: {
        chantierId: chantier.id,
        designation: m.designation,
        unite: m.unite,
        categorie: m.categorie,
        prixReference: m.prix,
        delaiLivraisonJours: m.delai,
        seuilAlerteJours: m.seuil,
      },
    });
    mats.set(m.designation, { id: r.id, stock: 0, m, enCommande: null, prix: m.prix });
  }
  const taches = [];
  for (const [i, t] of cfg.taches.entries()) {
    taches.push({
      cfg: t,
      realise: 0,
      fini: false,
      rec: await prisma.tache.create({
        data: {
          chantierId: chantier.id,
          lot: t.lot,
          designation: t.designation,
          unite: t.unite,
          quantitePrevue: t.quantite,
          coutPrevu: t.cout,
          dateDebutPrevue: jour(cfg.debut + t.debut),
          dateFinPrevue: jour(cfg.debut + t.fin),
          ordre: i,
        },
      }),
    });
  }

  for (const a of cfg.avances) {
    await prisma.avance.create({
      data: {
        chantierId: chantier.id,
        clientId: client.id,
        montant: a.montant,
        date: jour(cfg.debut + a.jour),
        mode: a.montant >= 8_000_000 ? "VIREMENT" : "MOBILE_MONEY",
        reference: `AV-${cfg.code}-${a.jour}`,
        statut: a.enAttente ? "EN_ATTENTE" : "VALIDEE",
      },
    });
  }

  // Livraison d'une commande : entrée de stock + dépense rattachée (RG-23).
  async function livrer(nom: string, j: number) {
    const s = mats.get(nom)!;
    // Les prix montent doucement au fil du chantier (variation du prix, § 4.2).
    s.prix = Math.round(s.m.prix * (1 + (j - cfg.debut) * 0.0012 * entre(0.5, 1.5)));
    const qte = s.m.commande;
    const mv = await prisma.mouvementStock.create({
      data: { chantierId: chantier.id, materiauId: s.id, type: "ENTREE", quantite: qte, prixUnitaire: s.prix, date: jour(j), motif: `BL-${Math.floor(entre(1000, 9999))}`, auteurId: chef.id },
    });
    const montant = Math.round(qte * s.prix);
    await prisma.depense.create({
      data: {
        chantierId: chantier.id,
        categorie: "MATERIAUX",
        libelle: `Achat ${s.m.designation} (${qte} ${s.m.unite})`,
        montant,
        date: jour(j),
        justificatif: `FAC-${mv.id}`,
        statut: "VALIDEE",
        valideParId: montant > 250_000 ? ingenieurId : null,
        datePaiement: j < -2 ? jour(j + Math.floor(entre(0, 3))) : null,
        auteurId: chef.id,
        mouvementId: mv.id,
      },
    });
    s.stock += qte;
    s.enCommande = null;
  }
  for (const nom of mats.keys()) if (cfg.taches.some((t) => t.debut < 25 && t.conso[nom])) await livrer(nom, cfg.debut);

  const presences: Prisma.PresenceCreateManyInput[] = [];
  const mouvements: Prisma.MouvementStockCreateManyInput[] = [];
  const productions: Prisma.ProductionCreateManyInput[] = [];
  const depenses: Prisma.DepenseCreateManyInput[] = [];
  const rapports: Prisma.RapportJournalierCreateManyInput[] = [];
  const inventaires: Prisma.InventaireCreateManyInput[] = [];
  let paie = 0;

  for (let j = cfg.debut; j <= 0; j++) {
    const date = jour(j);
    const indice = j - cfg.debut;
    // Une livraison arrive à sa date, même un jour de repos.
    for (const [nom, s] of Array.from(mats)) if (s.enCommande !== null && s.enCommande <= j) await livrer(nom, j);
    // RG-25 : inventaire hebdomadaire, le dernier il y a 2 jours. La validation
    // aligne le stock sur le comptage par une correction tracée.
    if (-j % 7 === 2) {
      for (const [, s] of Array.from(mats)) {
        if (s.stock <= 0) continue;
        const physique = arrondi(s.stock * (1 - Math.max(0, entre(-0.004, 0.02))), s.m.unite === "m³" ? 2 : 0);
        inventaires.push({ chantierId: chantier.id, materiauId: s.id, date, stockTheorique: arrondi(s.stock), stockPhysique: physique, auteurId: chef.id, valide: true });
        if (Math.abs(physique - s.stock) > 1e-9) {
          mouvements.push({ chantierId: chantier.id, materiauId: s.id, type: "CORRECTION", quantite: arrondi(physique - s.stock), date, motif: "Écart d'inventaire validé", auteurId: ingenieurId });
          s.stock = physique;
        }
      }
    }
    // RG-63 : un jour de repos par semaine, le dimanche en général.
    if (date.getUTCDay() === 0 && j !== 0) {
      await prisma.jourRepos.create({ data: { chantierId: chantier.id, date, declareParId: chef.id } });
      continue;
    }

    // Présences : la météo du jour pèse sur toute l'équipe.
    const pluie = alea() < 0.18;
    let heuresEquipe = 0;
    for (const o of ouvriers) {
      const r = alea();
      const statut = r < 0.07 ? "ABSENT" : r < 0.15 ? "RETARD" : "PRESENT";
      const h = statut === "ABSENT" ? 0 : statut === "RETARD" ? arrondi(entre(5.5, 7), 1) : alea() < 0.15 ? arrondi(entre(9, 10.5), 1) : 8;
      heuresEquipe += h;
      paie += (h / 8) * (o.tauxJournalier ?? 0);
      presences.push({ chantierId: chantier.id, ouvrierId: o.id, date, statut, heuresPrevues: 8, heuresRealisees: h, saisieParId: chef.id });
    }

    // Production : chaque tâche active reçoit une part des heures de l'équipe.
    const actives = taches.filter((t) => !t.fini && indice >= t.cfg.debut && indice <= t.cfg.fin + 15);
    const travaux: string[] = [];
    for (const t of actives) {
      const heures = arrondi((heuresEquipe / actives.length) * (pluie ? 0.6 : 1), 1);
      if (heures <= 0) continue;
      const effectif = Math.max(1, Math.round(heures / 8));
      const prevuParJour = t.cfg.quantite / Math.max(1, t.cfg.fin - t.cfg.debut + 1);
      const parHeure = prevuParJour / ((ouvriers.length * 8) / Math.max(1, actives.length));
      let q = arrondi(bruit(parHeure * heures * t.cfg.rythme, 0.25));
      q = Math.min(q, t.cfg.quantite - t.realise);
      if (q <= 0) continue;
      // Matériaux disponibles ? sinon la tâche s'arrête (rupture).
      let rupture = false;
      for (const [nom, k] of Object.entries(t.cfg.conso)) if (mats.get(nom)!.stock < q * k) rupture = true;
      if (rupture) {
        for (const nom of Object.keys(t.cfg.conso)) {
          const s = mats.get(nom)!;
          if (s.enCommande === null) s.enCommande = Math.min(0, j + s.m.delai);
        }
        continue;
      }
      for (const [nom, k] of Object.entries(t.cfg.conso)) {
        const s = mats.get(nom)!;
        const qte = Math.min(arrondi(s.stock), arrondi(bruit(q * k, 0.08), s.m.unite === "m³" ? 2 : 0));
        if (qte <= 0) continue;
        s.stock -= qte;
        mouvements.push({ chantierId: chantier.id, materiauId: s.id, type: "SORTIE", quantite: qte, date, tacheId: t.rec.id, auteurId: chef.id });
        // Pertes : plus fréquentes les jours de pluie (ciment mouillé, casse).
        if (alea() < (pluie ? 0.35 : 0.06)) {
          const perte = arrondi(qte * entre(0.03, 0.12), s.m.unite === "m³" ? 2 : 0);
          if (perte > 0 && s.stock > perte) {
            s.stock -= perte;
            mouvements.push({ chantierId: chantier.id, materiauId: s.id, type: "PERTE", quantite: perte, date, motif: pluie ? "Intempérie" : "Casse", auteurId: chef.id });
          }
        }
        // Réapprovisionnement quand l'autonomie devient courte.
        if (s.enCommande === null && s.stock < q * k * (s.m.delai + 3)) s.enCommande = Math.min(0, j + s.m.delai);
      }
      t.realise += q;
      travaux.push(`${t.cfg.designation} : ${q} ${t.cfg.unite}`);
      productions.push({
        tacheId: t.rec.id,
        date,
        quantite: q,
        heuresTravaillees: heures,
        effectif,
        declareParId: chef.id,
        // RG-53 : validation hebdomadaire ; un lot ancien reste en attente (AL-08).
        statut: j > -4 || (j === -6 && t === actives[0]) ? "EN_ATTENTE" : "VALIDEE",
        valideParId: j > -4 ? null : ingenieurId,
      });
      if (t.realise >= t.cfg.quantite - 1e-6) t.fini = true;
    }

    if (indice % 3 === 1) {
      depenses.push({ chantierId: chantier.id, categorie: "TRANSPORT", libelle: "Transport de matériaux", montant: Math.round(bruit(45_000, 0.35) / 500) * 500, date, justificatif: `REC-${j}`, statut: "VALIDEE", datePaiement: date, auteurId: chef.id });
    }
    if (alea() < 0.5) {
      depenses.push({ chantierId: chantier.id, categorie: "LOCATION_MATERIEL", libelle: cfg.type === "ROUTE" ? "Location niveleuse et compacteur" : "Location bétonnière", montant: cfg.locationJour, date, justificatif: `LOC-${j}`, statut: cfg.locationJour > 250_000 ? "EN_ATTENTE" : "VALIDEE", datePaiement: j < -3 ? date : null, auteurId: chef.id });
    }
    if (alea() < 0.3) {
      depenses.push({ chantierId: chantier.id, categorie: "DIVERS", libelle: "Petit outillage et consommables", montant: Math.round(bruit(18_000, 0.5) / 500) * 500, date, justificatif: alea() < 0.85 ? `REC-D${j}` : null, statut: "VALIDEE", datePaiement: date, auteurId: chef.id });
    }
    // Paie hebdomadaire le samedi : coût payé de la main-d'œuvre (RG-44).
    if (date.getUTCDay() === 6 && paie > 0) {
      depenses.push({ chantierId: chantier.id, categorie: "MAIN_OEUVRE", libelle: "Paie hebdomadaire de l'équipe", montant: Math.round(paie / 100) * 100, date, justificatif: `PAIE-${j}`, statut: "VALIDEE", datePaiement: date, valideParId: ingenieurId, auteurId: chef.id });
      paie = 0;
    }
    // AL-11 : le rapport d'hier n'a pas été remis.
    if (j < 0 && !(cfg.type === "BATIMENT" && j === -1)) {
      rapports.push({
        chantierId: chantier.id,
        date,
        meteo: pluie ? "Pluie" : alea() < 0.5 ? "Ensoleillé" : "Nuageux",
        travaux: travaux.join(" ; ") || "Pas de production mesurable",
        incidents: pluie ? "Arrêt partiel pour cause de pluie" : null,
        auteurId: chef.id,
        statut: j < -2 ? "VALIDEE" : "EN_ATTENTE",
      });
    }
  }

  // Dépense atypique et sans justificatif : AL-06 et AL-13.
  if (cfg.type === "BATIMENT") {
    depenses.push({ chantierId: chantier.id, categorie: "DIVERS", libelle: "Réparation de la bétonnière", montant: 420_000, date: jour(-4), statut: "VALIDEE", valideParId: ingenieurId, auteurId: chef.id });
  }

  await prisma.presence.createMany({ data: presences });
  await prisma.mouvementStock.createMany({ data: mouvements });
  await prisma.production.createMany({ data: productions });
  await prisma.depense.createMany({ data: depenses });
  await prisma.rapportJournalier.createMany({ data: rapports });
  await prisma.inventaire.createMany({ data: inventaires });

  // Tâches terminées ou commencées : dates réelles et statut (RG-54).
  for (const t of taches) {
    const prods = await prisma.production.findMany({ where: { tacheId: t.rec.id }, orderBy: { date: "asc" } });
    if (!prods.length) continue;
    const finReelle = t.fini ? prods.at(-1)!.date : null;
    const enRetard = finReelle && finReelle > t.rec.dateFinPrevue;
    await prisma.tache.update({
      where: { id: t.rec.id },
      data: {
        statut: t.fini ? "TERMINEE" : "EN_COURS",
        dateDebutReelle: prods[0].date,
        dateFinReelle: finReelle,
        finConfirmee: t.fini,
        causeRetard: enRetard ? (t.cfg.cause ?? "Autre") : null,
      },
    });
  }

  // Un inventaire du jour attend la validation de l'ingénieur.
  const premier = Array.from(mats.values()).find((m) => m.stock > 0);
  if (premier) {
    await prisma.inventaire.create({
      data: { chantierId: chantier.id, materiauId: premier.id, date: jour(0), stockTheorique: arrondi(premier.stock), stockPhysique: Math.floor(premier.stock * 0.97), auteurId: chef.id },
    });
  }

  await prisma.signalement.createMany({
    data: [
      { chantierId: chantier.id, auteurId: ouvriers[3].id, type: "MANQUE_MATERIAU", description: "Plus de planches de coffrage en bon état.", date: jour(-5), statut: "CLOS", reponse: "Commande passée, livraison sous 48 h.", dateCloture: jour(-4) },
      { chantierId: chantier.id, auteurId: client.id, type: "DEMANDE_JUSTIFICATION", description: "Pouvez-vous justifier la hausse des dépenses de location cette semaine ?", date: jour(-2), statut: "OUVERT" },
    ],
  });
  return chantier;
}

async function main() {
  // Garde-fou : ce script VIDE la base. Sur une base qui contient déjà des
  // chantiers, il faut le demander explicitement : npm run db:seed -- --reinitialiser
  if ((await prisma.chantier.count()) > 0 && !process.argv.includes("--reinitialiser")) {
    console.error("La base contient déjà des chantiers. Relancez avec --reinitialiser pour TOUT effacer et recharger les données fictives.");
    process.exit(1);
  }
  // Ordre inverse des dépendances : on vide d'abord ce qui référence le reste.
  await prisma.$transaction([
    prisma.journalAudit.deleteMany(),
    prisma.validation.deleteMany(),
    prisma.signalement.deleteMany(),
    prisma.rapportJournalier.deleteMany(),
    prisma.presence.deleteMany(),
    prisma.depense.deleteMany(),
    prisma.avance.deleteMany(),
    prisma.inventaire.deleteMany(),
    prisma.mouvementStock.deleteMany(),
    prisma.production.deleteMany(),
    prisma.tache.deleteMany(),
    prisma.materiau.deleteMany(),
    prisma.jourRepos.deleteMany(),
    prisma.avenant.deleteMany(),
    prisma.affectation.deleteMany(),
    prisma.chantier.deleteMany(),
    prisma.utilisateur.deleteMany(),
  ]);
  const ing = await prisma.utilisateur.create({
    data: { nom: "Mbarga", prenom: "Jean", telephone: "690000001", email: "ingenieur@exemple.cm", role: "INGENIEUR", motDePasseHash: hache(MDP) },
  });
  await simuler(BATIMENT, ing.id);
  await simuler(ROUTE, ing.id);
  const n = await prisma.$transaction([prisma.mouvementStock.count(), prisma.production.count(), prisma.presence.count(), prisma.depense.count()]);
  console.log(`Données créées : ${n[0]} mouvements, ${n[1]} productions, ${n[2]} présences, ${n[3]} dépenses.`);
  console.log(`Connexion : 690000001 (ingénieur), 690000002 (client), 690000010 (chef), 690000100 (manœuvre) — mot de passe ${MDP}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
