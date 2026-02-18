import { createHmac, timingSafeEqual } from "crypto";

const ALG = "sha256";
const SEP = ".";

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (3 - (str.length % 4)) % 4);
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

export type SharePayload = { planId: string; exp: number };

export function signShareToken(payload: SharePayload, secret: string): string {
  const raw = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(raw, "utf8"));
  const sig = createHmac(ALG, secret).update(payloadB64).digest();
  return `${payloadB64}${SEP}${base64UrlEncode(sig)}`;
}

export function verifyShareToken(token: string, secret: string): SharePayload | null {
  const i = token.lastIndexOf(SEP);
  if (i === -1) return null;
  const payloadB64 = token.slice(0, i);
  const sigB64 = token.slice(i + 1);
  const payloadBuf = base64UrlDecode(payloadB64);
  const sigBuf = base64UrlDecode(sigB64);
  if (!payloadBuf || !sigBuf) return null;
  const expected = createHmac(ALG, secret).update(payloadB64).digest();
  if (expected.length !== sigBuf.length || !timingSafeEqual(expected, sigBuf)) return null;
  try {
    const payload = JSON.parse(payloadBuf.toString("utf8")) as SharePayload;
    if (typeof payload.planId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
