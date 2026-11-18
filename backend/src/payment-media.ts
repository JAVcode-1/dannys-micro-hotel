import { createClient } from "@supabase/supabase-js";
import { BookingError } from "./booking-quote.js";

export const PROOF_BUCKET = "payment-proofs";
export const QR_BUCKET = "payment-qr";
export const MAX_PAYMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const hasControlCharacters = (value: string) =>
  Array.from(value).some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );

export function validatePaymentImage(
  bytes: Buffer,
  mime: string,
): "png" | "jpg" {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 12 ||
    bytes.length > MAX_PAYMENT_IMAGE_BYTES
  )
    throw new BookingError("Choose a PNG or JPEG image up to 5 MB.");
  if (
    mime === "image/png" &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.length >= 45 &&
    bytes.toString("ascii", 12, 16) === "IHDR" &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0 &&
    bytes
      .subarray(-12)
      .equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))
  )
    return "png";
  if (
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    return "jpg";
  throw new BookingError(
    "Image type or file signature is invalid. Use PNG or JPEG.",
  );
}

export function validateReference(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 100 ||
    hasControlCharacters(value)
  )
    throw new BookingError(
      "A transaction reference is required (up to 100 characters).",
    );
  return value.trim();
}

export type PaymentMediaStore = {
  upload(
    bucket: string,
    key: string,
    bytes: Buffer,
    mime: string,
  ): Promise<void>;
  remove(bucket: string, key: string): Promise<void>;
  signedUrl(bucket: string, key: string): Promise<string>;
};

export function paymentMediaStore(): PaymentMediaStore {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret)
    throw new BookingError("Private payment storage is not configured.", 503);
  const storage = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
  async function privateBucket(bucket: string) {
    if (![PROOF_BUCKET, QR_BUCKET].includes(bucket))
      throw new Error("Unsupported payment bucket");
    const { data, error } = await storage.getBucket(bucket);
    if (error || !data || data.public)
      throw new BookingError("Private payment storage is unavailable.", 503);
    return storage.from(bucket);
  }
  return {
    async upload(bucket, key, bytes, mime) {
      const { error } = await (
        await privateBucket(bucket)
      ).upload(key, bytes, { contentType: mime, upsert: false });
      if (error)
        throw new BookingError(
          "Private image upload failed. Please retry.",
          503,
        );
    },
    async remove(bucket, key) {
      const { error } = await (await privateBucket(bucket)).remove([key]);
      if (error) throw new Error("Private image cleanup failed");
    },
    async signedUrl(bucket, key) {
      const { data, error } = await (
        await privateBucket(bucket)
      ).createSignedUrl(key, 120);
      if (error || !data)
        throw new BookingError("Private payment image is unavailable.", 503);
      return data.signedUrl;
    },
  };
}
