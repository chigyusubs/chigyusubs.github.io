import { describe, expect, it } from "vitest";

import {
  buildUserPrompt,
  glossarySystemPrompt,
  summarySystemPrompt,
  systemPromptTextOnly,
} from "../prompts";

describe("prompts", () => {
  it("constructs user prompt with optional sections only when provided", () => {
    const prompt = buildUserPrompt(
      "en",
      "jp,en\nfoo,bar",
      "WEBVTT context",
      "WEBVTT chunk",
      "Summary text",
      true,
    );

    expect(prompt).toContain("### GLOSSARY ###");
    expect(prompt).toContain("jp,en");
    expect(prompt).toContain("GLOBAL SUMMARY");
    expect(prompt).toContain("Summary text");
    expect(prompt).toContain(
      "### PREVIOUS CONTEXT (REFERENCE ONLY, DO NOT TRANSLATE) ###",
    );
    expect(prompt).toContain("WEBVTT context");
    expect(prompt).toContain("### CUES TO TRANSLATE ###");
    expect(prompt).toContain("WEBVTT chunk");
  });

  it("omits glossary and summary blocks when disabled or blank", () => {
    const prompt = buildUserPrompt("en", "", "", "chunk text", "", false);
    expect(prompt).not.toContain("GLOSSARY");
    expect(prompt).not.toContain("SUMMARY");
    expect(prompt).toContain("chunk text");
  });

  it("uses defaults only when custom prompts are empty", () => {
    expect(systemPromptTextOnly(undefined)).toContain("WebVTT cues");
    expect(systemPromptTextOnly(" custom ")).toBe("custom");
  });

  describe("glossarySystemPrompt", () => {
    it("fills default placeholders with the configured languages", () => {
      const prompt = glossarySystemPrompt(undefined, "en");
      expect(prompt).toContain("You are a professional media linguist");
      expect(prompt).toContain(
        "Translate recognizable words and phrases into en",
      );
    });

    it("supports placeholder replacement inside custom prompt", () => {
      const prompt = glossarySystemPrompt(
        "Glossarize idioms for <target> tone.",
        "en",
      );
      expect(prompt).toBe("Glossarize idioms for en tone.");
    });

    it("returns trimmed custom prompts without placeholders", () => {
      const prompt = glossarySystemPrompt("Existing glossary prompt", "en");
      expect(prompt).toBe("Existing glossary prompt");
    });
  });

  describe("summarySystemPrompt", () => {
    it("fills default placeholders without adding headers", () => {
      const prompt = summarySystemPrompt(undefined, "en", "a transcript");
      expect(prompt).not.toContain("LANGUAGE:");
      expect(prompt).toContain("You are summarizing a transcript");
      expect(prompt).toContain("Write the summary entirely in en.");
    });

    it("replaces <file>/<target> placeholders in custom prompts", () => {
      const prompt = summarySystemPrompt(
        "Focus on <file> energy and deliver <target> tone.",
        "en",
        "a media file",
      );
      expect(prompt).toBe("Focus on a media file energy and deliver en tone.");
    });

    it("returns the trimmed custom prompt when no placeholders exist", () => {
      const custom = "Existing summary prompt";
      const prompt = summarySystemPrompt(custom, "en", "a transcript");
      expect(prompt).toBe("Existing summary prompt");
    });
  });
});
