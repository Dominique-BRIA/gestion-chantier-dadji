import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { prisma } from "./db";
import { COOKIE_SESSION, lireSession, type Role, type Session } from "./session";

export function hacherMotDePasse(mdp: string): string {
  const sel = randomBytes(16).toString("hex");
  return `${sel}:${scryptSync(mdp, sel, 64).toString("hex")}`;
}

export function verifierMotDePasse(mdp: string, hache: string): boolean {
  const [sel, h] = hache.split(":");
  if (!sel || !h) return false;
  const attendu = Buffer.from(h, "hex");
  const calcule = scryptSync(mdp, sel, 64);
  return attendu.length === calcule.length && timingSafeEqual(attendu, calcule);
}

export async function session(): Promise<Session | null> {
  return lireSession(cookies().get(COOKIE_SESSION)?.value);
}

/** RG-04 : toute page et toute action commence par ce contrôle. */
export async function exigerSession(roles?: Role[]): Promise<Session> {
  const s = await session();
  if (!s) redirect("/login");
  if (roles && !roles.includes(s.role)) redirect("/");
  return s;
}

/** RG-03 : clause Prisma des chantiers visibles par l'utilisateur. */
export function filtreChantiers(s: Session) {
  switch (s.role) {
    case "INGENIEUR":
      return { ingenieurId: s.id };
    case "CLIENT":
      return { clientId: s.id };
    default:
      return { affectations: { some: { utilisateurId: s.id, dateFin: null } } };
  }
}

/**
 * Charge un chantier en vérifiant qu'il est dans le périmètre (RG-03). Hors
 * périmètre, on répond « introuvable » : on ne révèle pas qu'il existe (RG-04).
 */
export async function exigerChantier(id: number, roles?: Role[]) {
  const s = await exigerSession(roles);
  if (!Number.isInteger(id)) notFound();
  const chantier = await prisma.chantier.findFirst({
    where: { id, ...filtreChantiers(s) },
    include: { client: true, ingenieur: true },
  });
  if (!chantier) notFound();
  return { s, chantier };
}

/** RG-81 : journal d'audit en écriture seule. */
export async function journaliser(
  auteurId: number,
  action: string,
  entite: string,
  entiteId: number,
  ancienne?: unknown,
  nouvelle?: unknown,
) {
  await prisma.journalAudit.create({
    data: {
      auteurId,
      action,
      entite,
      entiteId,
      ancienneValeur: ancienne === undefined ? null : JSON.stringify(ancienne),
      nouvelleValeur: nouvelle === undefined ? null : JSON.stringify(nouvelle),
    },
  });
}
