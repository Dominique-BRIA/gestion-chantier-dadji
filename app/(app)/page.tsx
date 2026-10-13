import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigerSession, filtreChantiers } from "@/lib/auth";

export default async function Accueil() {
  const s = await exigerSession();
  if (s.role === "INGENIEUR") redirect("/chantiers");
  // Les autres rôles vont droit à leur chantier quand ils n'en ont qu'un.
  const chantiers = await prisma.chantier.findMany({ where: filtreChantiers(s), select: { id: true } });
  redirect(chantiers.length === 1 ? `/chantiers/${chantiers[0].id}` : "/chantiers");
}
