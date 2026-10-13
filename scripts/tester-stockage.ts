// Vérifie la configuration Backblaze B2 : dépôt d'un petit PDF, lien signé, relecture, suppression.
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { lienJustificatif, stockageActif, televerserJustificatif } from "../lib/fichiers";

(async () => {
  if (!stockageActif) throw new Error("Variables B2_* absentes");
  const pdf = new File([Buffer.from("%PDF-1.4\n% test gestion-chantier\n%%EOF\n")], "test.pdf", { type: "application/pdf" });
  const cle = (await televerserJustificatif(pdf, "tests"))!;
  console.log("déposé :", cle);
  const lien = (await lienJustificatif(cle))!;
  const rep = await fetch(lien);
  console.log("relu par le lien signé :", rep.status, (await rep.text()).slice(0, 8));
  const region = process.env.B2_ENDPOINT!.replace(/^https?:\/\//, "").split(".")[1];
  await new S3Client({ region, endpoint: process.env.B2_ENDPOINT, credentials: { accessKeyId: process.env.B2_KEY_ID!, secretAccessKey: process.env.B2_APPLICATION_KEY! } }).send(
    new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET, Key: cle }),
  );
  console.log("supprimé : le compartiment reste propre");
})().catch((e) => {
  console.error("ÉCHEC :", e.message);
  process.exit(1);
});
