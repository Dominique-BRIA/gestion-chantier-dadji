import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Justificatifs sur Backblaze B2, par son API compatible S3. Le compartiment
// reste privé : on ne sert les fichiers que par des liens signés de courte durée.
const conf = {
  id: process.env.B2_KEY_ID,
  cle: process.env.B2_APPLICATION_KEY,
  bucket: process.env.B2_BUCKET,
  endpoint: process.env.B2_ENDPOINT,
};

export const stockageActif = Boolean(conf.id && conf.cle && conf.bucket && conf.endpoint);

function client() {
  // La région est la 2e partie de l'endpoint : s3.<region>.backblazeb2.com
  const region = conf.endpoint!.replace(/^https?:\/\//, "").split(".")[1] ?? "us-west-004";
  return new S3Client({ region, endpoint: conf.endpoint, credentials: { accessKeyId: conf.id!, secretAccessKey: conf.cle! } });
}

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const TAILLE_MAX = 4 * 1024 * 1024;

/** Dépose un justificatif et renvoie sa clé, ou null si aucun fichier n'est fourni. */
export async function televerserJustificatif(fichier: File | null, prefixe: string): Promise<string | null> {
  if (!fichier || fichier.size === 0) return null;
  if (!stockageActif) throw new Error("Le stockage des fichiers (Backblaze B2) n'est pas configuré : saisissez seulement la référence.");
  if (!TYPES.includes(fichier.type)) throw new Error("Format accepté : photo (JPEG, PNG, WebP) ou PDF.");
  if (fichier.size > TAILLE_MAX) throw new Error("Fichier trop lourd : 4 Mo au maximum.");
  const ext = fichier.name.split(".").pop()?.toLowerCase() ?? "bin";
  const cle = `${prefixe}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await client().send(
    new PutObjectCommand({ Bucket: conf.bucket, Key: cle, Body: Buffer.from(await fichier.arrayBuffer()), ContentType: fichier.type }),
  );
  return cle;
}

export async function lienJustificatif(cle: string): Promise<string | null> {
  if (!stockageActif) return null;
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: conf.bucket, Key: cle }), { expiresIn: 600 });
}
