import { describe, it, expect } from "vitest";
import { buildDownloadUrl, buildChangelogUrl } from "../scripts/shared/utils.js";

describe("buildDownloadUrl", () => {
  it("constructs correct download URL", () => {
    const url = buildDownloadUrl(
      "https://github.com/alice/novelist-word-frequency",
      "word-frequency",
      "1.1.0",
    );
    expect(url).toBe(
      "https://github.com/alice/novelist-word-frequency/releases/download/v1.1.0/word-frequency-1.1.0.zip",
    );
  });
});

describe("buildChangelogUrl", () => {
  it("constructs correct changelog URL", () => {
    const url = buildChangelogUrl(
      "https://github.com/alice/novelist-word-frequency",
      "1.1.0",
    );
    expect(url).toBe(
      "https://github.com/alice/novelist-word-frequency/releases/tag/v1.1.0",
    );
  });
});
