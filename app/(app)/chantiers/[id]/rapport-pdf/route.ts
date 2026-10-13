import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, cleJour } from "@/lib/format";
import { RapportChantier } from "@/lib/rapport-pdf";
import { LOGO_PDF } from "@/lib/logo-pdf";

export const dynamic = "force-dynamic";

/** Rapport de chantier en PDF : ingénieur et client (RG-05), rapports journaliers validés seulement. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT"]);
  const [donnees, rapports] = await Promise.all([
    chargerDonnees(chantier.id),
    prisma.rapportJournalier.findMany({ where: { chantierId: chantier.id, statut: "VALIDEE" }, orderBy: { date: "desc" }, take: 10 }),
  ]);
  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
    createElement(RapportChantier, {
      chantier: {
        code: chantier.code,
        nom: chantier.nom,
        type: chantier.type,
        localisation: chantier.localisation,
        dateDebutPrevue: chantier.dateDebutPrevue,
        dateFinPrevue: chantier.dateFinPrevue,
        client: `${chantier.client.prenom} ${chantier.client.nom}`,
      },
      auteur: s.nom,
      logo: LOGO_PDF,
      ind: calculerIndicateurs(donnees, aujourdhui()),
      rapports,
    }) as Parameters<typeof renderToBuffer>[0],
    );
  } catch (e) {
    console.error("Rapport PDF :", e);
    return new Response(`Le rapport PDF n'a pas pu être généré : ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${chantier.code}-${cleJour(aujourdhui())}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
