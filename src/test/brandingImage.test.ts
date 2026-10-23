import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandingImageError,
  MAX_BRANDING_UPLOAD_BYTES,
  dataUrlByteSize,
  fitWithin,
  prepareBrandingImage,
} from "@/lib/brandingImage";
import { useAppStore } from "@/store/appStore";
import type { Organization } from "@/types";

function makeFile(bytes: number, type: string, name = "logo") {
  return new File([new Uint8Array(bytes)], name, { type });
}

// jsdom never loads images or renders canvases, so stand in for both.
let imageSize = { width: 400, height: 200 };
let encodedBytes = 10_000;
const encodeCalls: Array<{ width: number; height: number; type: string }> = [];

class FakeImage {
  naturalWidth = imageSize.width;
  naturalHeight = imageSize.height;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

beforeEach(() => {
  imageSize = { width: 400, height: 200 };
  encodedBytes = 10_000;
  encodeCalls.length = 0;
  vi.stubGlobal("Image", FakeImage);
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag !== "canvas") return realCreateElement(tag);
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement & { width: number; height: number };
    canvas.getContext = (() => ({ drawImage: () => undefined })) as unknown as HTMLCanvasElement["getContext"];
    canvas.toDataURL = ((type: string) => {
      encodeCalls.push({ width: canvas.width, height: canvas.height, type });
      return `data:${type};base64,${"A".repeat(Math.ceil((encodedBytes * 4) / 3))}`;
    }) as HTMLCanvasElement["toDataURL"];
    return canvas;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("prepareBrandingImage", () => {
  it("accepts images up to 5 MB", async () => {
    imageSize = { width: 4000, height: 2000 };
    const result = await prepareBrandingImage(makeFile(MAX_BRANDING_UPLOAD_BYTES, "image/png"), "logo");

    expect(result.startsWith("data:image/png")).toBe(true);
  });

  it("rejects images over 5 MB", async () => {
    await expect(prepareBrandingImage(makeFile(MAX_BRANDING_UPLOAD_BYTES + 1, "image/png"), "logo")).rejects.toBeInstanceOf(
      BrandingImageError,
    );
  });

  it("rejects files that are not images", async () => {
    await expect(prepareBrandingImage(makeFile(100, "application/pdf"), "logo")).rejects.toThrow(/PNG, JPG/);
  });

  it("keeps small images unchanged", async () => {
    const result = await prepareBrandingImage(makeFile(50_000, "image/png"), "logo");

    expect(encodeCalls).toHaveLength(0);
    expect(dataUrlByteSize(result)).toBe(50_000);
  });

  it("shrinks large logos to at most 1024px and keeps PNG transparency", async () => {
    imageSize = { width: 4000, height: 2000 };
    await prepareBrandingImage(makeFile(4 * 1024 * 1024, "image/png"), "logo");

    expect(encodeCalls[0]).toEqual({ width: 1024, height: 512, type: "image/png" });
  });

  it("keeps JPEGs as JPEG when shrinking", async () => {
    imageSize = { width: 3000, height: 3000 };
    await prepareBrandingImage(makeFile(3 * 1024 * 1024, "image/jpeg"), "logo");

    expect(encodeCalls[0].type).toBe("image/jpeg");
  });

  it("allows wider banners than logos", async () => {
    imageSize = { width: 6000, height: 1500 };
    await prepareBrandingImage(makeFile(4 * 1024 * 1024, "image/png"), "banner");

    expect(encodeCalls[0]).toEqual({ width: 2000, height: 500, type: "image/png" });
  });

  it("fails clearly when an image cannot be shrunk enough", async () => {
    imageSize = { width: 4000, height: 4000 };
    encodedBytes = 5 * 1024 * 1024;

    await expect(prepareBrandingImage(makeFile(4 * 1024 * 1024, "image/png"), "logo")).rejects.toThrow(/too detailed/);
  });
});

describe("fitWithin", () => {
  it("never upscales", () => {
    expect(fitWithin(200, 100, 1024)).toEqual({ width: 200, height: 100 });
  });

  it("scales the longest side to the limit", () => {
    expect(fitWithin(1000, 3000, 1024)).toEqual({ width: 341, height: 1024 });
  });
});

describe("workspace cache", () => {
  const organization: Organization = {
    id: "org-a",
    name: "Alpha",
    ownerUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "active",
    branding: { logoDataUrl: "data:image/png;base64,QUxQSEE=", primaryColor: "#112233" },
  };

  it("does not store logos in localStorage", () => {
    window.localStorage.clear();
    useAppStore.setState({ organizations: [organization], activeOrganizationId: undefined });

    useAppStore.getState().setActiveOrganization("org-a");

    const cached = JSON.parse(window.localStorage.getItem("timeflow-workspaces-v1") ?? "{}");
    expect(cached.organizations[0].branding).toEqual({ primaryColor: "#112233" });
    // The in-memory organization keeps its logo.
    expect(useAppStore.getState().organizations[0].branding?.logoDataUrl).toBe(organization.branding?.logoDataUrl);
  });

  it("keeps switching workspaces when browser storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useAppStore.setState({ organizations: [organization], activeOrganizationId: undefined });

    expect(() => useAppStore.getState().setActiveOrganization("org-a")).not.toThrow();
    expect(useAppStore.getState().activeOrganizationId).toBe("org-a");
  });
});
