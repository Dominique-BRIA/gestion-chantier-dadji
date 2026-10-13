import { prisma } from "@/lib/db";
import { exigerSession, filtreChantiers } from "@/lib/auth";
import { deconnexion } from "@/app/actions";
import { Coque } from "@/components/app/Coque";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await exigerSession();
  const chantiers = await prisma.chantier.findMany({
    where: filtreChantiers(s),
    select: { id: true, code: true, nom: true },
    orderBy: { creeLe: "desc" },
  });
  return (
    <Coque nom={s.nom} role={s.role} chantiers={chantiers} deconnexion={deconnexion}>
      {children}
    </Coque>
  );
}
