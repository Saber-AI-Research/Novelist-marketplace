import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRegistry, fetchDownloadCount } from "../scripts/build-registry.js";

const repo = "https://github.com/alice/novelist-word-frequency";

function releases(assets: Array<{ name: string; download_count: number }>, link?: string): Response {
  return new Response(JSON.stringify([{ assets }]), {
    headers: link ? { link } : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registry generation", () => {
  it("excludes draft seed plugins without fetching their unpublished releases", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => releases([]));
    vi.stubGlobal("fetch", fetchMock);

    const registry = await buildRegistry(true);

    expect(registry.version).toBe(1);
    expect(registry.plugins.some((plugin) => plugin.id === "word-frequency")).toBe(false);
    expect(registry.plugins.some((plugin) => plugin.id === "pomodoro-timer")).toBe(false);
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.some((url) => url.includes("Saber-AI-Research/novelist-word-frequency/releases"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("Saber-AI-Research/novelist-pomodoro-timer/releases"))).toBe(false);
  });
});

describe("release download counts", () => {
  it("sums every release page and excludes other plugins with a shared ID prefix", async () => {
    const next = "https://api.github.com/repos/alice/novelist-word-frequency/releases?page=2";
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(releases([
        { name: "word-frequency-1.0.0.zip", download_count: 4 },
        { name: "word-frequency-extra-1.0.0.zip", download_count: 100 },
      ], `<${next}>; rel="next"`))
      .mockResolvedValueOnce(releases([
        { name: "word-frequency-2.0.0.zip", download_count: 6 },
      ]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDownloadCount(repo, "word-frequency")).resolves.toBe(10);
    expect(fetchMock).toHaveBeenNthCalledWith(2, next, expect.any(Object));
  });

  it("reports failure if a later page cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(releases([
        { name: "word-frequency-1.0.0.zip", download_count: 4 },
      ], '<https://api.github.com/repos/alice/novelist-word-frequency/releases?page=2>; rel="next"'))
      .mockResolvedValueOnce(new Response(null, { status: 429 })));

    await expect(fetchDownloadCount(repo, "word-frequency")).resolves.toBeNull();
  });

  it("reports invalid download counts instead of generating NaN", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(releases([
      { name: "word-frequency-1.0.0.zip", download_count: -1 },
    ])));

    await expect(fetchDownloadCount(repo, "word-frequency")).resolves.toBeNull();
  });
});
