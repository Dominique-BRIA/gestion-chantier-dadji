// Affiche les indicateurs de chaque chantier dans le terminal : contrôle rapide après un chargement de données.
import { PrismaClient } from "@prisma/client";
import { chargerDonnees } from "../lib/donnees";
import { calculerIndicateurs } from "../lib/indicateurs";
import { aujourdhui } from "../lib/format";
const p = new PrismaClient();
(async () => {
  for (const c of await p.chantier.findMany()) {
    const i = calculerIndicateurs(await chargerDonnees(c.id), aujourdhui());
    console.log("==", c.code, "| consommé", i.finances.consommePct.toFixed(1), "% | tréso", i.finances.tresorerie, "| avanc", i.avancement.global.toFixed(1), "prévu", i.avancement.prevu.toFixed(1), "| SPI", i.avancement.spi.toFixed(2), "CPI", i.avancement.cpi.toFixed(2), "| fin", i.avancement.dateFinEstimee, i.avancement.fiabiliteFin);
    console.log("   dépenses n", i.finances.descriptif.n, "moy", Math.round(i.finances.descriptif.moyenne), "CV", i.finances.descriptif.cv.toFixed(1), "| présence", i.personnel.tauxPresence.toFixed(1), "| régr prod", i.productivite.regression && i.productivite.regression.r2.toFixed(2), "n", i.productivite.nuage.length);
    for (const m of i.materiaux) console.log("   ", m.designation.padEnd(26), "stock", m.stock.toFixed(1), "auto", m.autonomie.toFixed(1), "perte%", m.tauxPerte.toFixed(1), "PMP", Math.round(m.prixMoyenPondere));
    console.log("   alertes:", i.alertes.map((a) => a.code + "(" + a.niveau[0] + ")").join(" "));
  }
  await p.$disconnect();
})();
