export type OutputMime = "image/webp" | "image/jpeg" | "image/png";

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  savedPercent: number;
}
