"use server";

/**
 * Toutes les écritures du système. Chaque action commence par le contrôle des
 * droits côté serveur (RG-04), applique les règles de gestion qu'elle cite, et
 * laisse une trace au journal d'audit (RG-81). Rien n'est supprimé : une
 * erreur se corrige par une nouvelle opération (RG-24, RG-42).
 */
import type { CategorieDepense, ModePaiement, Prisma, StatutPresence, TypeChantier, TypeMouvement, TypeSignalement } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigerChantier, exigerSession, hacherMotDePasse, journaliser, verifierMotDePasse } from "@/lib/auth";
import { COOKIE_SESSION, DUREE_SESSION_S, signerSession, type Role, type Session } from "@/lib/session";
import { ajouterJours, aujourdhui, cleJour, jourUTC } from "@/lib/format";
import { televerserJustificatif } from "@/lib/fichiers";
import { signeMouvement } from "@/lib/indicateurs";

// ------------------------------------------------------------------ Outils

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => txt(f, k) || null;
const num = (f: FormData, k: string) => Number(txt(f, k).replace(/\s/g, "").replace(",", "."));
const ent = (f: FormData, k: string) => Math.round(num(f, k));
const dateDe = (f: FormData, k: string) => (txt(f, k) ? jourUTC(txt(f, k)) : aujourdhui());

class Refus extends Error {}
const refuser = (msg: string): never => {
  throw new Refus(msg);
};

/** Exécute l'action et revient sur la page d'origine avec un message. */
async function executer(f: FormData, ok: string, fn: () => Promise<void | string>) {
  const retour = txt(f, "retour") || "/";
  let msg = ok;
  try {
    const r = await fn();
    if (typeof r === "string") msg = r;
  } catch (e) {
    if (e instanceof Refus) redirect(`${retour}?erreur=${encodeURIComponent(e.message)}`);
    if (e instanceof Error && e.message.includes("Unique constraint")) redirect(`${retour}?erreur=${encodeURIComponent("Cette saisie existe déjà.")}`);
    if (e instanceof Error && !("digest" in e)) redirect(`${retour}?erreur=${encodeURIComponent(e.message)}`);
    throw e;
  }
  // L'action peut changer la page de retour (création d'un chantier, par exemple).
  const vers = txt(f, "retour") || retour;
  revalidatePath(vers.split("?")[0], "layout");
  redirect(`${vers}?ok=${encodeURIComponent(msg)}`);
}

async function chantierOuvert(f: FormData, roles: Role[]) {
  const r = await exigerChantier(Number(txt(f, "chantierId")), roles);
  // RG-11 : un chantier suspendu ou terminé n'accepte plus de saisie.
  if (r.chantier.statut === "TERMINE") refuser("Chantier clôturé : il est en lecture seule.");
  if (r.chantier.statut === "SUSPENDU") refuser("Chantier suspendu : aucune saisie n'est possible.");
  return r;
}

/** RG-80 : l'auteur saisit le jour J jusqu'à J + 1 ; au-delà, seul l'ingénieur. */
function controlerDate(s: Session, d: Date) {
  const auj = aujourdhui();
  if (d > auj) refuser("Impossible de saisir une date future.");
  if (s.role !== "INGENIEUR" && d < ajouterJours(auj, -1)) refuser("Saisie close (RG-80) : seul l'ingénieur peut saisir au-delà de la veille.");
}

async function valider(objetType: string, objetId: number, decision: "VALIDEE" | "REJETEE", responsableId: number, commentaire?: string | null) {
  await prisma.validation.create({ data: { objetType, objetId, decision, responsableId, commentaire: commentaire ?? null } });
}

async function stockTheorique(materiauId: number) {
  const mv = await prisma.mouvementStock.findMany({ where: { materiauId }, select: { type: true, quantite: true } });
  return mv.reduce((a, m) => a + signeMouvement(m.type) * m.quantite, 0);
}

// ------------------------------------------------------------------ Connexion

export async function connexion(f: FormData) {
  const u = await prisma.utilisateur.findUnique({ where: { telephone: txt(f, "telephone").replace(/\s/g, "") } });
  if (!u || !u.actif || !verifierMotDePasse(txt(f, "motDePasse"), u.motDePasseHash)) {
    redirect("/login?erreur=" + encodeURIComponent("Téléphone ou mot de passe incorrect."));
  }
  cookies().set(COOKIE_SESSION, await signerSession({ id: u.id, role: u.role, nom: `${u.prenom} ${u.nom}` }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DUREE_SESSION_S,
    path: "/",
  });
  redirect("/espace");
}

export async function deconnexion() {
  cookies().delete(COOKIE_SESSION);
  redirect("/");
}

// ------------------------------------------------------------------ Comptes (RG-02)

export async function creerUtilisateur(f: FormData) {
  await executer(f, "Compte créé.", async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const role = txt(f, "role") as Role;
    if (!["CLIENT", "CHEF_CHANTIER", "MANOEUVRE"].includes(role)) refuser("Rôle invalide.");
    const mdp = txt(f, "motDePasse");
    if (mdp.length < 8) refuser("Mot de passe : 8 caractères au minimum.");
    const u = await prisma.utilisateur.create({
      data: {
        nom: txt(f, "nom"),
        prenom: txt(f, "prenom"),
        telephone: txt(f, "telephone").replace(/\s/g, ""),
        email: opt(f, "email"),
        role,
        metier: role === "MANOEUVRE" ? opt(f, "metier") : null,
        tauxJournalier: role === "MANOEUVRE" && txt(f, "tauxJournalier") ? ent(f, "tauxJournalier") : null,
        motDePasseHash: hacherMotDePasse(mdp),
      },
    });
    await journaliser(s.id, "CREATION", "Utilisateur", u.id, undefined, { role, telephone: u.telephone });
  });
}

export async function basculerActif(f: FormData) {
  await executer(f, "Compte mis à jour.", async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: ent(f, "id") } });
    if (u.role === "INGENIEUR") refuser("Le compte de l'ingénieur ne se désactive pas.");
    await prisma.utilisateur.update({ where: { id: u.id }, data: { actif: !u.actif } });
    await journaliser(s.id, u.actif ? "DESACTIVATION" : "REACTIVATION", "Utilisateur", u.id);
  });
}

// ------------------------------------------------------------------ Chantier (RG-10 à RG-13)

export async function creerChantier(f: FormData) {
  await executer(f, "Chantier créé : enregistrez maintenant ses matériaux.", async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const budget = ent(f, "budgetInitial");
    if (!(budget > 0)) refuser("Le budget doit être positif.");
    const debut = jourUTC(txt(f, "dateDebutPrevue"));
    const fin = jourUTC(txt(f, "dateFinPrevue"));
    if (fin <= debut) refuser("La date de fin doit suivre la date de début.");
    let clientId = ent(f, "clientId");
    if (!clientId) {
      if (!txt(f, "clientTelephone")) refuser("Choisissez un client ou créez-le.");
      const c = await prisma.utilisateur.create({
        data: {
          nom: txt(f, "clientNom"),
          prenom: txt(f, "clientPrenom"),
          telephone: txt(f, "clientTelephone").replace(/\s/g, ""),
          role: "CLIENT",
          motDePasseHash: hacherMotDePasse(txt(f, "clientMotDePasse") || "Chantier2026"),
        },
      });
      clientId = c.id;
    }
    const c = await prisma.chantier.create({
      data: {
        code: txt(f, "code").toUpperCase(),
        nom: txt(f, "nom"),
        localisation: txt(f, "localisation"),
        type: txt(f, "type") as TypeChantier,
        budgetInitial: budget,
        dateDebutPrevue: debut,
        dateFinPrevue: fin,
        seuilValidation: ent(f, "seuilValidation") || 250000,
        seuilAlerteBudget: ent(f, "seuilAlerteBudget") || 90,
        ingenieurId: s.id,
        clientId,
      },
    });
    await journaliser(s.id, "CREATION", "Chantier", c.id, undefined, { code: c.code, budget });
    f.set("retour", `/chantiers/${c.id}/stock`);
  });
}

const TRANSITIONS: Record<string, string[]> = {
  PREPARATION: ["EN_COURS"],
  EN_COURS: ["SUSPENDU", "TERMINE"],
  SUSPENDU: ["EN_COURS"],
  TERMINE: [],
};

export async function changerStatutChantier(f: FormData) {
  await executer(f, "Statut du chantier mis à jour.", async () => {
    const { s, chantier } = await exigerChantier(ent(f, "chantierId"), ["INGENIEUR"]);
    const cible = txt(f, "statut") as keyof typeof TRANSITIONS;
    if (!TRANSITIONS[chantier.statut].includes(cible)) refuser("Transition interdite (RG-11).");
    if (cible === "SUSPENDU" && !txt(f, "motif")) refuser("Le motif de suspension est obligatoire.");
    if (cible === "TERMINE") {
      const [dep, prod, av] = await Promise.all([
        prisma.depense.count({ where: { chantierId: chantier.id, statut: "EN_ATTENTE" } }),
        prisma.production.count({ where: { tache: { chantierId: chantier.id }, statut: "EN_ATTENTE" } }),
        prisma.avance.count({ where: { chantierId: chantier.id, statut: "EN_ATTENTE" } }),
      ]);
      if (dep + prod + av > 0) refuser(`Clôture refusée : ${dep} dépense(s), ${prod} production(s) et ${av} avance(s) attendent une validation.`);
    }
    await prisma.chantier.update({
      where: { id: chantier.id },
      data: {
        statut: cible as never,
        motifSuspension: cible === "SUSPENDU" ? txt(f, "motif") : null,
        dateDebutReelle: cible === "EN_COURS" && !chantier.dateDebutReelle ? aujourdhui() : undefined,
        dateFinReelle: cible === "TERMINE" ? aujourdhui() : undefined,
      },
    });
    await journaliser(s.id, "STATUT", "Chantier", chantier.id, chantier.statut, { statut: cible, motif: opt(f, "motif") });
  });
}

export async function ajouterAvenant(f: FormData) {
  await executer(f, "Avenant enregistré : le budget révisé s'applique.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const montant = ent(f, "nouveauBudget");
    if (!(montant > 0)) refuser("Montant invalide.");
    if (!txt(f, "motif")) refuser("Le motif est obligatoire (RG-12).");
    const a = await prisma.avenant.create({ data: { chantierId: chantier.id, nouveauBudget: montant, motif: txt(f, "motif"), auteurId: s.id } });
    await journaliser(s.id, "AVENANT", "Chantier", chantier.id, undefined, { avenant: a.id, montant });
  });
}

export async function modifierSeuils(f: FormData) {
  await executer(f, "Seuils d'alerte mis à jour.", async () => {
    const { s, chantier } = await exigerChantier(ent(f, "chantierId"), ["INGENIEUR"]);
    const cles = ["pertePct", "ecartBudgetAvancementPts", "joursTresorerie", "ecartInventairePct", "presencePct", "attenteValidationJours"];
    const seuils: Record<string, number> = {};
    for (const k of cles) if (txt(f, k)) seuils[k] = num(f, k);
    await prisma.chantier.update({
      where: { id: chantier.id },
      data: { seuils, seuilValidation: ent(f, "seuilValidation"), seuilAlerteBudget: ent(f, "seuilAlerteBudget") },
    });
    await journaliser(s.id, "SEUILS", "Chantier", chantier.id, chantier.seuils, seuils);
  });
}

export async function affecter(f: FormData) {
  await executer(f, "Affectation enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: ent(f, "utilisateurId") } });
    if (!["CHEF_CHANTIER", "MANOEUVRE"].includes(u.role)) refuser("Seuls les chefs de chantier et les manœuvres s'affectent.");
    // RG-13 : un manœuvre n'a qu'une affectation en cours.
    const enCours = await prisma.affectation.findFirst({ where: { utilisateurId: u.id, dateFin: null } });
    if (enCours && u.role === "MANOEUVRE") refuser("Ce manœuvre est déjà affecté à un chantier : clôturez d'abord cette affectation.");
    if (enCours && enCours.chantierId === chantier.id) refuser("Déjà affecté à ce chantier.");
    const a = await prisma.affectation.create({
      data: { utilisateurId: u.id, chantierId: chantier.id, fonction: txt(f, "fonction") || (u.metier ?? "Chef de chantier"), dateDebut: dateDe(f, "dateDebut") },
    });
    await journaliser(s.id, "AFFECTATION", "Affectation", a.id, undefined, { utilisateur: u.id, chantier: chantier.id });
  });
}

export async function terminerAffectation(f: FormData) {
  await executer(f, "Affectation clôturée.", async () => {
    const { s, chantier } = await exigerChantier(ent(f, "chantierId"), ["INGENIEUR"]);
    const a = await prisma.affectation.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    await prisma.affectation.update({ where: { id: a.id }, data: { dateFin: aujourdhui() } });
    await journaliser(s.id, "FIN_AFFECTATION", "Affectation", a.id);
  });
}

// ------------------------------------------------------------------ Matériaux et stock (RG-20 à RG-25)

export async function creerMateriau(f: FormData) {
  await executer(f, "Matériau enregistré.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const m = await prisma.materiau.create({
      data: {
        chantierId: chantier.id,
        designation: txt(f, "designation"),
        unite: txt(f, "unite"),
        categorie: txt(f, "categorie"),
        prixReference: ent(f, "prixReference"),
        delaiLivraisonJours: ent(f, "delaiLivraisonJours") || 3,
        seuilAlerteJours: ent(f, "seuilAlerteJours") || 5,
      },
    });
    await journaliser(s.id, "CREATION", "Materiau", m.id, undefined, { designation: m.designation, unite: m.unite });
  });
}

export async function enregistrerMouvement(f: FormData) {
  await executer(f, "Mouvement enregistré.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const type = txt(f, "type") as TypeMouvement;
    if (!["ENTREE", "SORTIE", "PERTE", "RETOUR"].includes(type)) refuser("Type de mouvement invalide.");
    const m = await prisma.materiau.findFirstOrThrow({ where: { id: ent(f, "materiauId"), chantierId: chantier.id } });
    const quantite = num(f, "quantite");
    if (!(quantite > 0)) refuser("La quantité doit être strictement positive (RG-22).");
    const date = dateDe(f, "date");
    controlerDate(s, date);
    const tacheId = type === "SORTIE" ? ent(f, "tacheId") || refuser("Une sortie doit indiquer la tâche qui consomme (RG-21).") : null;
    if (type === "SORTIE") await prisma.tache.findFirstOrThrow({ where: { id: tacheId!, chantierId: chantier.id } });
    if ((type === "PERTE" || type === "RETOUR") && !txt(f, "motif")) refuser("Le motif est obligatoire pour une perte ou un retour.");
    const prix = type === "ENTREE" ? ent(f, "prixUnitaire") : null;
    if (type === "ENTREE" && !(prix! > 0)) refuser("Le prix unitaire est obligatoire pour une entrée.");
    if (type !== "ENTREE") {
      const stock = await stockTheorique(m.id);
      if (quantite > stock + 1e-9) refuser(`Stock insuffisant (${stock.toLocaleString("fr-FR")} ${m.unite}) : faites un inventaire (RG-22).`);
    }
    const mv = await prisma.mouvementStock.create({
      data: { chantierId: chantier.id, materiauId: m.id, type, quantite, prixUnitaire: prix, date, motif: opt(f, "motif"), tacheId, auteurId: s.id },
    });
    await journaliser(s.id, "MOUVEMENT", "MouvementStock", mv.id, undefined, { type, quantite, materiau: m.designation });
    if (type === "ENTREE") {
      // RG-23 : l'achat apparaît aussi dans les finances.
      const montant = Math.round(quantite * prix!);
      const auto = montant <= chantier.seuilValidation;
      const d = await prisma.depense.create({
        data: {
          chantierId: chantier.id,
          categorie: "MATERIAUX",
          libelle: `Achat ${m.designation} (${quantite} ${m.unite})`,
          montant,
          date,
          justificatif: opt(f, "motif"),
          statut: auto ? "VALIDEE" : "EN_ATTENTE",
          auteurId: s.id,
          mouvementId: mv.id,
        },
      });
      if (auto) await valider("Depense", d.id, "VALIDEE", s.id, "Validation automatique : montant sous le seuil (RG-41)");
      return auto ? "Entrée enregistrée ; la dépense correspondante est validée." : "Entrée enregistrée ; la dépense attend la validation de l'ingénieur.";
    }
  });
}

export async function annulerMouvement(f: FormData) {
  await executer(f, "Mouvement corrigé par une opération opposée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const mv = await prisma.mouvementStock.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id }, include: { corrections: true } });
    if (mv.type === "CORRECTION") refuser("Une correction ne se corrige pas.");
    if (mv.corrections.length) refuser("Ce mouvement a déjà été corrigé.");
    // RG-24 : l'auteur le jour même, l'ingénieur ensuite.
    if (s.role !== "INGENIEUR" && (mv.auteurId !== s.id || cleJour(mv.date) !== cleJour(aujourdhui()))) refuser("Seul l'ingénieur corrige un mouvement passé (RG-24).");
    const motif = txt(f, "motif") || "Annulation d'une saisie erronée";
    const c = await prisma.mouvementStock.create({
      data: {
        chantierId: chantier.id,
        materiauId: mv.materiauId,
        type: "CORRECTION",
        quantite: -signeMouvement(mv.type) * mv.quantite,
        date: aujourdhui(),
        motif,
        auteurId: s.id,
        corrigeId: mv.id,
      },
    });
    await journaliser(s.id, "CORRECTION", "MouvementStock", mv.id, mv, { correction: c.id, motif });
  });
}

export async function saisirInventaire(f: FormData) {
  await executer(f, "Inventaire saisi : il attend la validation de l'ingénieur.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const m = await prisma.materiau.findFirstOrThrow({ where: { id: ent(f, "materiauId"), chantierId: chantier.id } });
    const physique = num(f, "stockPhysique");
    if (!(physique >= 0)) refuser("Stock physique invalide.");
    const inv = await prisma.inventaire.create({
      data: { chantierId: chantier.id, materiauId: m.id, date: aujourdhui(), stockTheorique: await stockTheorique(m.id), stockPhysique: physique, auteurId: s.id, commentaire: opt(f, "commentaire") },
    });
    await journaliser(s.id, "INVENTAIRE", "Inventaire", inv.id, undefined, { theorique: inv.stockTheorique, physique });
  });
}

export async function validerInventaire(f: FormData) {
  await executer(f, "Inventaire validé : le stock théorique est aligné.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const inv = await prisma.inventaire.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id, valide: false } });
    // RG-25 : l'écart se corrige par rapport au stock ACTUEL, des mouvements ayant pu suivre le comptage.
    const ecart = inv.stockPhysique - inv.stockTheorique;
    await prisma.inventaire.update({ where: { id: inv.id }, data: { valide: true } });
    if (Math.abs(ecart) > 1e-9) {
      await prisma.mouvementStock.create({
        data: { chantierId: chantier.id, materiauId: inv.materiauId, type: "CORRECTION", quantite: ecart, date: aujourdhui(), motif: `Écart de l'inventaire du ${cleJour(inv.date)}`, auteurId: s.id },
      });
    }
    await valider("Inventaire", inv.id, "VALIDEE", s.id);
    await journaliser(s.id, "VALIDATION", "Inventaire", inv.id, undefined, { ecart });
  });
}

// ------------------------------------------------------------------ Finances (RG-30 à RG-45)

export async function declarerAvance(f: FormData) {
  await executer(f, "Avance enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CLIENT"]);
    const montant = ent(f, "montant");
    if (!(montant > 0)) refuser("Montant invalide.");
    const date = dateDe(f, "date");
    if (date > aujourdhui()) refuser("Date future impossible.");
    const a = await prisma.avance.create({
      data: {
        chantierId: chantier.id,
        clientId: chantier.clientId,
        montant,
        date,
        mode: txt(f, "mode") as ModePaiement,
        reference: opt(f, "reference"),
        // RG-30 : déclarée par le client = en attente ; saisie par l'ingénieur = validée.
        statut: s.role === "INGENIEUR" ? "VALIDEE" : "EN_ATTENTE",
      },
    });
    if (s.role === "INGENIEUR") await valider("Avance", a.id, "VALIDEE", s.id, "Fonds reçus par l'ingénieur");
    await journaliser(s.id, "CREATION", "Avance", a.id, undefined, { montant, statut: a.statut });
    return s.role === "INGENIEUR" ? "Avance enregistrée et validée." : "Versement déclaré : l'ingénieur doit confirmer sa réception.";
  });
}

export async function deciderAvance(f: FormData) {
  await executer(f, "Décision enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const a = await prisma.avance.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id, statut: "EN_ATTENTE" } });
    const decision = txt(f, "decision") === "REJETEE" ? "REJETEE" : "VALIDEE";
    if (decision === "REJETEE" && !txt(f, "motif")) refuser("Le motif du rejet est obligatoire.");
    await prisma.avance.update({ where: { id: a.id }, data: { statut: decision } });
    await valider("Avance", a.id, decision, s.id, opt(f, "motif"));
    await journaliser(s.id, decision, "Avance", a.id, { statut: a.statut }, { statut: decision });
  });
}

export async function creerDepense(f: FormData) {
  await executer(f, "Dépense enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const montant = ent(f, "montant");
    if (!(montant > 0)) refuser("Le montant doit être un entier positif en FCFA (RG-40).");
    const date = dateDe(f, "date");
    controlerDate(s, date);
    const fichierCle = await televerserJustificatif(f.get("fichier") as File | null, `chantiers/${chantier.id}/depenses`);
    // RG-41 : validation automatique sous le seuil.
    const auto = montant <= chantier.seuilValidation;
    const d = await prisma.depense.create({
      data: {
        chantierId: chantier.id,
        categorie: txt(f, "categorie") as CategorieDepense,
        libelle: txt(f, "libelle"),
        montant,
        date,
        justificatif: opt(f, "justificatif"),
        fichierCle,
        statut: auto ? "VALIDEE" : "EN_ATTENTE",
        auteurId: s.id,
      },
    });
    if (auto) await valider("Depense", d.id, "VALIDEE", s.id, "Validation automatique : montant sous le seuil (RG-41)");
    await journaliser(s.id, "CREATION", "Depense", d.id, undefined, { montant, statut: d.statut });
    return auto ? "Dépense enregistrée et validée (sous le seuil)." : "Dépense enregistrée : elle attend la validation de l'ingénieur.";
  });
}

export async function deciderDepense(f: FormData) {
  await executer(f, "Décision enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const d = await prisma.depense.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    const decision = txt(f, "decision") === "REJETEE" ? "REJETEE" : "VALIDEE";
    if (decision === "REJETEE" && !txt(f, "motif")) refuser("Le motif du rejet est obligatoire (RG-41).");
    if (d.statut === decision) refuser("Décision déjà prise.");
    if (d.datePaiement && decision === "REJETEE") refuser("Une dépense payée ne se rejette pas : enregistrez un remboursement.");
    await prisma.depense.update({ where: { id: d.id }, data: { statut: decision, valideParId: s.id } });
    await valider("Depense", d.id, decision, s.id, opt(f, "motif"));
    await journaliser(s.id, decision, "Depense", d.id, { statut: d.statut }, { statut: decision, motif: opt(f, "motif") });
  });
}

export async function payerDepense(f: FormData) {
  await executer(f, "Paiement enregistré : la trésorerie est mise à jour.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const d = await prisma.depense.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id, statut: "VALIDEE", datePaiement: null } });
    await prisma.depense.update({ where: { id: d.id }, data: { datePaiement: aujourdhui() } });
    await journaliser(s.id, "PAIEMENT", "Depense", d.id, undefined, { montant: d.montant });
  });
}

export async function justifierDepense(f: FormData) {
  await executer(f, "Justificatif ajouté.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const d = await prisma.depense.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    const fichierCle = await televerserJustificatif(f.get("fichier") as File | null, `chantiers/${chantier.id}/depenses`);
    if (!fichierCle && !txt(f, "justificatif")) refuser("Indiquez une référence ou joignez un fichier.");
    await prisma.depense.update({ where: { id: d.id }, data: { justificatif: opt(f, "justificatif") ?? d.justificatif, fichierCle: fichierCle ?? d.fichierCle } });
    await journaliser(s.id, "JUSTIFICATIF", "Depense", d.id, { justificatif: d.justificatif }, { justificatif: opt(f, "justificatif"), fichierCle });
  });
}

// ------------------------------------------------------------------ Tâches et avancement (RG-50 à RG-55)

export async function creerTache(f: FormData) {
  await executer(f, "Tâche créée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const quantite = num(f, "quantitePrevue");
    const cout = ent(f, "coutPrevu");
    if (!(quantite > 0) || !(cout > 0)) refuser("Quantité et coût prévus doivent être positifs.");
    const t = await prisma.tache.create({
      data: {
        chantierId: chantier.id,
        lot: txt(f, "lot"),
        designation: txt(f, "designation"),
        unite: txt(f, "unite"),
        quantitePrevue: quantite,
        coutPrevu: cout,
        dateDebutPrevue: jourUTC(txt(f, "dateDebutPrevue")),
        dateFinPrevue: jourUTC(txt(f, "dateFinPrevue")),
        ordre: await prisma.tache.count({ where: { chantierId: chantier.id } }),
      },
    });
    await journaliser(s.id, "CREATION", "Tache", t.id, undefined, { designation: t.designation, cout });
    const total = await prisma.tache.aggregate({ where: { chantierId: chantier.id }, _sum: { coutPrevu: true } });
    if ((total._sum.coutPrevu ?? 0) > chantier.budgetInitial) return "Tâche créée. Attention : la somme des coûts prévus dépasse le budget (RG-50).";
  });
}

export async function declarerProduction(f: FormData) {
  await executer(f, "Production déclarée : elle attend la validation de l'ingénieur.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const t = await prisma.tache.findFirstOrThrow({ where: { id: ent(f, "tacheId"), chantierId: chantier.id } });
    if (t.statut === "TERMINEE") refuser("Cette tâche est clôturée.");
    const date = dateDe(f, "date");
    controlerDate(s, date);
    const quantite = num(f, "quantite");
    const heures = num(f, "heuresTravaillees");
    if (!(quantite > 0) || !(heures > 0)) refuser("Quantité et heures doivent être positives.");
    const p = await prisma.production.create({
      data: { tacheId: t.id, date, quantite, heuresTravaillees: heures, effectif: ent(f, "effectif") || 1, declareParId: s.id },
    });
    if (t.statut === "A_FAIRE") await prisma.tache.update({ where: { id: t.id }, data: { statut: "EN_COURS", dateDebutReelle: date } });
    await journaliser(s.id, "DECLARATION", "Production", p.id, undefined, { tache: t.designation, quantite, heures });
    // RG-54 : dépassement de la quantité prévue → demande de revoir le métré.
    const cumul = await prisma.production.aggregate({ where: { tacheId: t.id, statut: { not: "REJETEE" } }, _sum: { quantite: true } });
    if ((cumul._sum.quantite ?? 0) > t.quantitePrevue) {
      await prisma.signalement.create({
        data: { chantierId: chantier.id, auteurId: s.id, type: "ANOMALIE", date: aujourdhui(), description: `Quantité déclarée supérieure au prévu pour « ${t.designation} » : revoir le métré (RG-54).` },
      });
    }
  });
}

export async function deciderProduction(f: FormData) {
  await executer(f, "Décision enregistrée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const decision = txt(f, "decision") === "REJETEE" ? "REJETEE" : "VALIDEE";
    // RG-53 : validation à l'unité ou en lot (toutes les déclarations en attente).
    const where: Prisma.ProductionWhereInput = { tache: { chantierId: chantier.id }, statut: "EN_ATTENTE" };
    if (txt(f, "id")) where.id = ent(f, "id");
    const prods = await prisma.production.findMany({ where });
    if (!prods.length) refuser("Aucune déclaration en attente.");
    await prisma.production.updateMany({ where: { id: { in: prods.map((p) => p.id) } }, data: { statut: decision, valideParId: s.id } });
    for (const p of prods) await valider("Production", p.id, decision, s.id, opt(f, "motif"));
    await journaliser(s.id, decision, "Production", prods[0].id, undefined, { nombre: prods.length });
    return `${prods.length} déclaration(s) ${decision === "VALIDEE" ? "validée(s)" : "rejetée(s)"}.`;
  });
}

export async function declarerFinTache(f: FormData) {
  await executer(f, "Fin de tâche signalée au chef de chantier.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["MANOEUVRE", "CHEF_CHANTIER"]);
    const t = await prisma.tache.findFirstOrThrow({ where: { id: ent(f, "tacheId"), chantierId: chantier.id, statut: "EN_COURS" } });
    // RG-52 : déclarée par le manœuvre, confirmée directement si c'est le chef.
    await prisma.tache.update({ where: { id: t.id }, data: { finDeclareeLe: aujourdhui(), finConfirmee: s.role === "CHEF_CHANTIER" } });
    await journaliser(s.id, "FIN_DECLAREE", "Tache", t.id);
  });
}

export async function confirmerFinTache(f: FormData) {
  await executer(f, "Fin de tâche confirmée : l'ingénieur peut la clôturer.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["CHEF_CHANTIER"]);
    const t = await prisma.tache.findFirstOrThrow({ where: { id: ent(f, "tacheId"), chantierId: chantier.id } });
    await prisma.tache.update({ where: { id: t.id }, data: { finConfirmee: txt(f, "decision") !== "REFUS", finDeclareeLe: txt(f, "decision") === "REFUS" ? null : t.finDeclareeLe } });
    await journaliser(s.id, txt(f, "decision") === "REFUS" ? "FIN_REFUSEE" : "FIN_CONFIRMEE", "Tache", t.id);
  });
}

export async function cloturerTache(f: FormData) {
  await executer(f, "Tâche clôturée.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const t = await prisma.tache.findFirstOrThrow({ where: { id: ent(f, "tacheId"), chantierId: chantier.id } });
    if (t.statut === "TERMINEE") refuser("Tâche déjà clôturée.");
    const fin = dateDe(f, "dateFinReelle");
    // RG-55 : une tâche finie en retard exige sa cause.
    if (fin > t.dateFinPrevue && !txt(f, "causeRetard")) refuser("La tâche finit en retard : indiquez la cause (RG-55).");
    await prisma.tache.update({
      where: { id: t.id },
      data: { statut: "TERMINEE", dateFinReelle: fin, finConfirmee: true, causeRetard: fin > t.dateFinPrevue ? txt(f, "causeRetard") : null },
    });
    await valider("Tache", t.id, "VALIDEE", s.id, "Clôture de la tâche");
    await journaliser(s.id, "CLOTURE", "Tache", t.id, { statut: t.statut }, { statut: "TERMINEE", fin: cleJour(fin) });
  });
}

// ------------------------------------------------------------------ Personnel (RG-60 à RG-63)

export async function saisirPresences(f: FormData) {
  await executer(f, "Présences enregistrées.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const date = dateDe(f, "date");
    controlerDate(s, date);
    const affectes = await prisma.affectation.findMany({ where: { chantierId: chantier.id, dateFin: null, utilisateur: { role: "MANOEUVRE" } } });
    let n = 0;
    for (const a of affectes) {
      const statut = txt(f, `statut_${a.utilisateurId}`) as StatutPresence;
      if (!statut) continue;
      const heures = statut === "ABSENT" ? 0 : num(f, `heures_${a.utilisateurId}`);
      if (!(heures >= 0 && heures <= 16)) refuser("Heures invalides (entre 0 et 16).");
      const data = { chantierId: chantier.id, statut, heuresRealisees: heures, heuresPrevues: 8, saisieParId: s.id, confirmee: true };
      await prisma.presence.upsert({
        where: { ouvrierId_date: { ouvrierId: a.utilisateurId, date } },
        create: { ...data, ouvrierId: a.utilisateurId, date },
        update: data,
      });
      n++;
    }
    await journaliser(s.id, "PRESENCES", "Chantier", chantier.id, undefined, { date: cleJour(date), lignes: n });
    return `${n} présence(s) enregistrée(s) pour le ${cleJour(date)}.`;
  });
}

export async function pointer(f: FormData) {
  await executer(f, "Pointage envoyé : le chef de chantier le confirmera.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["MANOEUVRE"]);
    const date = aujourdhui();
    const deja = await prisma.presence.findUnique({ where: { ouvrierId_date: { ouvrierId: s.id, date } } });
    if (deja) refuser("Votre présence du jour est déjà enregistrée.");
    // RG-61 : pointage déclaré, confirmé ensuite par le chef.
    await prisma.presence.create({ data: { chantierId: chantier.id, ouvrierId: s.id, date, statut: "PRESENT", heuresRealisees: 8, saisieParId: s.id, confirmee: false } });
    await journaliser(s.id, "POINTAGE", "Presence", s.id, undefined, { date: cleJour(date) });
  });
}

function lundi(d: Date) {
  return ajouterJours(d, -((d.getUTCDay() + 6) % 7));
}

export async function declarerRepos(f: FormData) {
  await executer(f, "Jour de repos enregistré pour cette semaine.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const date = dateDe(f, "date");
    const auj = aujourdhui();
    if (date < auj) refuser("Un jour de repos se déclare avant le jour concerné (RG-63).");
    if (+date === +auj && (await prisma.presence.count({ where: { chantierId: chantier.id, date } }))) refuser("Des présences sont déjà saisies aujourd'hui.");
    const l = lundi(date);
    const deja = await prisma.jourRepos.count({ where: { chantierId: chantier.id, date: { gte: l, lt: ajouterJours(l, 7) } } });
    if (deja) refuser("Un seul jour de repos par semaine (RG-63).");
    const r = await prisma.jourRepos.create({ data: { chantierId: chantier.id, date, declareParId: s.id } });
    await journaliser(s.id, "REPOS", "JourRepos", r.id, undefined, { date: cleJour(date) });
  });
}

export async function annulerRepos(f: FormData) {
  await executer(f, "Jour de repos annulé.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR", "CHEF_CHANTIER"]);
    const r = await prisma.jourRepos.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    if (r.date < aujourdhui()) refuser("Un jour de repos passé ne s'annule plus.");
    await prisma.jourRepos.delete({ where: { id: r.id } });
    await journaliser(s.id, "ANNULATION_REPOS", "JourRepos", r.id, { date: cleJour(r.date) });
  });
}

// ------------------------------------------------------------------ Rapports et signalements (RG-65, RG-70)

export async function soumettreRapport(f: FormData) {
  await executer(f, "Rapport soumis.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["CHEF_CHANTIER", "INGENIEUR"]);
    const date = dateDe(f, "date");
    controlerDate(s, date);
    const r = await prisma.rapportJournalier.create({
      data: { chantierId: chantier.id, date, meteo: txt(f, "meteo"), travaux: txt(f, "travaux"), incidents: opt(f, "incidents"), observations: opt(f, "observations"), auteurId: s.id },
    });
    await journaliser(s.id, "CREATION", "RapportJournalier", r.id, undefined, { date: cleJour(date) });
  });
}

export async function validerRapport(f: FormData) {
  await executer(f, "Rapport validé : le client peut le lire.", async () => {
    const { s, chantier } = await chantierOuvert(f, ["INGENIEUR"]);
    const r = await prisma.rapportJournalier.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    await prisma.rapportJournalier.update({ where: { id: r.id }, data: { statut: "VALIDEE" } });
    await valider("RapportJournalier", r.id, "VALIDEE", s.id);
    await journaliser(s.id, "VALIDATION", "RapportJournalier", r.id);
  });
}

export async function creerSignalement(f: FormData) {
  await executer(f, "Signalement transmis à l'ingénieur.", async () => {
    const { s, chantier } = await exigerChantier(ent(f, "chantierId"));
    const type = txt(f, "type") as TypeSignalement;
    // RG-70 : types permis selon le rôle.
    const permis: Record<Role, TypeSignalement[]> = {
      MANOEUVRE: ["MANQUE_MATERIAU", "PERTE", "INCIDENT"],
      CLIENT: ["ANOMALIE", "DEMANDE_JUSTIFICATION"],
      CHEF_CHANTIER: ["MANQUE_MATERIAU", "PERTE", "INCIDENT", "ANOMALIE", "DEMANDE_JUSTIFICATION"],
      INGENIEUR: ["MANQUE_MATERIAU", "PERTE", "INCIDENT", "ANOMALIE", "DEMANDE_JUSTIFICATION"],
    };
    if (!permis[s.role].includes(type)) refuser("Type de signalement non permis pour votre rôle.");
    if (!txt(f, "description")) refuser("Décrivez la situation.");
    const sg = await prisma.signalement.create({ data: { chantierId: chantier.id, auteurId: s.id, type, description: txt(f, "description"), date: aujourdhui() } });
    await journaliser(s.id, "CREATION", "Signalement", sg.id, undefined, { type });
  });
}

export async function traiterSignalement(f: FormData) {
  await executer(f, "Signalement mis à jour.", async () => {
    const { s, chantier } = await exigerChantier(ent(f, "chantierId"), ["INGENIEUR"]);
    const sg = await prisma.signalement.findFirstOrThrow({ where: { id: ent(f, "id"), chantierId: chantier.id } });
    const clos = txt(f, "statut") === "CLOS";
    if (clos && !txt(f, "reponse")) refuser("Une réponse écrite est obligatoire pour clore (RG-70).");
    await prisma.signalement.update({ where: { id: sg.id }, data: { statut: clos ? "CLOS" : "EN_COURS", reponse: opt(f, "reponse") ?? sg.reponse, dateCloture: clos ? aujourdhui() : null } });
    await journaliser(s.id, clos ? "CLOTURE" : "PRISE_EN_CHARGE", "Signalement", sg.id);
  });
}
