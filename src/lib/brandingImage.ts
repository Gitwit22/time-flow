/** Largest image file a user may pick for a logo or banner. */
export const MAX_BRANDING_UPLOAD_BYTES = 5 * 1024 * 1024;

export type BrandingAsset = "logo" | "banner";

// Stored images travel with every settings/organizations request, so large
// uploads are scaled down before saving. These sizes stay sharp on invoices.
const ASSET_LIMITS: Record<BrandingAsset, { maxDimension: number; targetBytes: number }> = {
  logo: { maxDimension: 1024, targetBytes: 750 * 1024 },
  banner: { maxDimension: 2000, targetBytes: 1536 * 1024 },
};

export class BrandingImageError extends Error {}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new BrandingImageError("The image could not be read. Try a different file."));
    reader.readAsDataURL(file);
  });
}

/** Scales (width, height) to fit inside a maxDimension square, never upscaling. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Byte size of the file a base64 data URL encodes. */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new BrandingImageError("The image could not be loaded. Try a different file."));
    image.src = src;
  });
}

function encode(image: HTMLImageElement, width: number, height: number, type: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new BrandingImageError("This browser can't process images. Try a smaller file.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(type, 0.9);
}

/**
 * Validates a picked logo/banner (up to 5 MB) and returns a data URL to store.
 * Images already within the size and dimension limits are kept as-is; larger
 * ones are re-encoded smaller. PNG keeps transparency; JPEG stays JPEG.
 */
export async function prepareBrandingImage(file: File, asset: BrandingAsset): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new BrandingImageError("Please upload a PNG, JPG, WEBP, or SVG image.");
  }
  if (file.size > MAX_BRANDING_UPLOAD_BYTES) {
    throw new BrandingImageError("Use an image of 5 MB or less.");
  }

  const { maxDimension, targetBytes } = ASSET_LIMITS[asset];
  const original = await readFileAsDataUrl(file);

  // Vector images scale without loss and can't be meaningfully re-encoded.
  if (file.type === "image/svg+xml") {
    if (file.size > targetBytes) throw new BrandingImageError("SVG images must be under 750 KB.");
    return original;
  }

  const image = await loadImage(original);
  const withinDimensions = Math.max(image.naturalWidth, image.naturalHeight) <= maxDimension;
  if (withinDimensions && file.size <= targetBytes) {
    return original;
  }

  const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  // Step down until the result fits; logos rarely need more than one pass.
  for (const dimension of [maxDimension, Math.round(maxDimension * 0.75), Math.round(maxDimension / 2)]) {
    const size = fitWithin(image.naturalWidth, image.naturalHeight, dimension);
    let result = encode(image, size.width, size.height, outputType);
    if (dataUrlByteSize(result) > targetBytes && outputType === "image/png") {
      // Photos saved as PNG compress poorly; WebP keeps transparency and is far smaller.
      const webp = encode(image, size.width, size.height, "image/webp");
      if (webp.startsWith("data:image/webp")) result = webp;
    }
    if (dataUrlByteSize(result) <= targetBytes) return result;
  }

  throw new BrandingImageError("This image is too detailed to shrink. Try a simpler or smaller image.");
}
