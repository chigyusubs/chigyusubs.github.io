import { describe, expect, it } from "vitest";

import { buildUserPrompt, systemPromptMultimodal, systemPromptTextOnly } from "../prompts";

describe("prompts", () => {
  it("constructs user prompt with optional sections only when provided", () => {
    const prompt = buildUserPrompt(
      "ja",
      "en",
      "casual",
      "jp,en\nfoo,bar",
      "WEBVTT context",
      "WEBVTT chunk",
      "Summary text",
      true,
    );

    expect(prompt).toContain("LANGUAGE: ja → en");
    expect(prompt).toContain("STYLE: casual");
    expect(prompt).toContain("GLOSSARY (source->target):\njp,en\nfoo,bar");
    expect(prompt).toContain("SUMMARY:\nSummary text");
    expect(prompt).toContain("PREVIOUS CONTEXT (do not re-emit):\nWEBVTT context");
    expect(prompt).toContain("CUES TO TRANSLATE:\nWEBVTT chunk");
  });

  it("omits glossary and summary blocks when disabled or blank", () => {
    const prompt = buildUserPrompt("ja", "en", "", "  ", "", "chunk text", "", false);
    expect(prompt).not.toContain("GLOSSARY");
    expect(prompt).not.toContain("SUMMARY");
    expect(prompt).toContain("chunk text");
  });

  it("uses defaults only when custom prompts are empty", () => {
    expect(systemPromptTextOnly(undefined)).toContain("WebVTT cues");
    expect(systemPromptMultimodal(undefined, "video")).toContain("attached video");
    expect(systemPromptTextOnly(" custom ")).toBe("custom");
    expect(systemPromptMultimodal(" override ", "audio")).toBe("override");
  });
});
