import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { fetchZipBounded, isAllowedZipHost, validateZipArchive } from "../scripts/validate.js";
import { ManifestSchema, type Manifest } from "../scripts/shared/types.js";

const manifestToml = `[plugin]
id = "word-frequency"
name = "Word Frequency"
version = "1.0.0"
description = "Analyze word frequency"
author = "alice"
permissions = ["read"]

[ui]
type = "panel"
entry = "index.html"

[marketplace]
repo = "https://github.com/alice/novelist-word-frequency"
category = "analysis"
min_novelist_version = "0.1.0"
`;

function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    ...ManifestSchema.parse({
      plugin: {
        id: "word-frequency",
        name: "Word Frequency",
        version: "1.0.0",
        description: "Analyze word frequency",
        author: "alice",
        permissions: ["read"],
      },
      ui: {
        type: "panel",
        entry: "index.html",
      },
      marketplace: {
        repo: "https://github.com/alice/novelist-word-frequency",
        category: "analysis",
        min_novelist_version: "0.1.0",
      },
    }),
    ...overrides,
  };
}

async function zipBuffer(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("ZIP validation", () => {
  it("accepts a minimal valid plugin ZIP", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml,
      "index.html": "<main>Word Frequency</main>",
      "index.js": "export function activate() { return true; }\n",
    });

    await expect(validateZipArchive(buffer, manifest())).resolves.toEqual([]);
  });

  it("scans JavaScript files outside the root entrypoint", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml,
      "index.html": "<script type=\"module\" src=\"assets/hidden.js\"></script>",
      "assets/hidden.js": "eval('alert(1)');\n",
    });

    const errors = await validateZipArchive(buffer, manifest());

    expect(errors).toContain(
      "assets/hidden.js contains dangerous pattern: \\beval\\s*\\(",
    );
  });

  it("requires network permission for HTML network access", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml,
      "index.html": "<script>fetch('https://example.com/collect')</script>",
    });

    const errors = await validateZipArchive(buffer, manifest());

    expect(errors).toContain(
      'index.html contains network access but no network permission ("net", "network", or "ai:http") is declared',
    );
  });

  it("allows HTML network access when declared", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml.replace('permissions = ["read"]', 'permissions = ["read", "network"]'),
      "index.html": "<script>fetch('https://example.com/api')</script>",
    });

    const errors = await validateZipArchive(
      buffer,
      manifest({ permissions: ["read", "network"] }),
    );

    expect(errors).toEqual([]);
  });

  it("rejects unsafe ZIP entry paths", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml,
      "index.html": "<main>Word Frequency</main>",
      "../escape.js": "export default true;\n",
    });

    const errors = await validateZipArchive(buffer, manifest());

    expect(errors).toContain("ZIP contains unsafe path: ../escape.js");
  });

  it("rejects release permissions that differ from the reviewed manifest", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml.replace('permissions = ["read"]', 'permissions = ["read", "fs"]'),
      "index.html": "<main>Word Frequency</main>",
    });

    const errors = await validateZipArchive(buffer, manifest());
    expect(errors).toContain(
      "ZIP manifest.toml does not match submitted manifest (including permissions and UI configuration)",
    );
  });

  it("accepts the UI entry declared in a nested directory", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml.replace('entry = "index.html"', 'entry = "ui/panel.html"'),
      "ui/panel.html": "<main>Word Frequency</main>",
    });

    await expect(validateZipArchive(buffer, manifest({
      ui: { type: "panel", entry: "ui/panel.html" },
    }))).resolves.toEqual([]);
  });

  it("rejects a missing declared UI entry even when index.js exists", async () => {
    const buffer = await zipBuffer({
      "manifest.toml": manifestToml,
      "index.js": "export default true;\n",
    });

    await expect(validateZipArchive(buffer, manifest())).resolves.toContain(
      "ZIP missing declared entry file: index.html",
    );
  });

  it("rejects oversized JavaScript after decompression", async () => {
    const zip = new JSZip();
    zip.file("manifest.toml", manifestToml);
    zip.file("index.html", "<main>Word Frequency</main>");
    zip.file("assets/large.js", "// padding\n".repeat(220_000));
    const buffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

    const errors = await validateZipArchive(buffer, manifest());
    expect(errors.some((error) => error.includes("assets/large.js") && error.includes("2MB uncompressed limit"))).toBe(true);
  });

  it("caps the total decompressed bytes across many entries", async () => {
    const zip = new JSZip();
    zip.file("manifest.toml", manifestToml);
    zip.file("index.html", "<main>Word Frequency</main>");
    // Each file stays under the 2MB per-file cap; together they exceed 20MB.
    const chunk = "// padding\n".repeat(150_000);
    for (let i = 0; i < 16; i++) zip.file(`assets/part-${i}.js`, chunk);
    const buffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

    const errors = await validateZipArchive(buffer, manifest());
    expect(errors).toContain("ZIP exceeds 20MB total uncompressed limit");
  });

  it("rejects archives with too many entries before inflating them", async () => {
    const zip = new JSZip();
    zip.file("manifest.toml", manifestToml);
    zip.file("index.html", "<main>Word Frequency</main>");
    for (let i = 0; i < 1000; i++) zip.file(`assets/f-${i}.js`, "export {};\n");
    const buffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

    const errors = await validateZipArchive(buffer, manifest());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^ZIP contains \d+ entries; the limit is 1000$/);
  });
});

describe("ZIP download boundaries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "http://github.com/alice/plugin.zip",
    "https://github.com:8443/alice/plugin.zip",
    "https://user:password@github.com/alice/plugin.zip",
    "https://alice.github.io/plugin.zip",
    "https://localhost/plugin.zip",
  ])("rejects unsupported ZIP URL %s", (url) => {
    expect(isAllowedZipHost(url)).toBe(false);
  });

  it("follows a GitHub release redirect to the asset CDN", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://release-assets.githubusercontent.com/plugin.zip" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);
    const errors: string[] = [];

    const result = await fetchZipBounded("https://github.com/alice/plugin.zip", errors);

    expect(result && Array.from(new Uint8Array(result))).toEqual([1, 2, 3]);
    expect(errors).toEqual([]);
  });

  it("refuses redirects to an untrusted host before fetching it", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://localhost/plugin.zip" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const errors: string[] = [];

    await expect(fetchZipBounded("https://github.com/alice/plugin.zip", errors)).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errors[0]).toContain("non-GitHub host");
  });

  it("turns body-stream failures into validation errors", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.error(new Error("connection lost")); },
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(body)));
    const errors: string[] = [];

    await expect(fetchZipBounded("https://github.com/alice/plugin.zip", errors)).resolves.toBeNull();

    expect(errors[0]).toContain("Failed to read ZIP");
    expect(errors[0]).toContain("connection lost");
  });
});
