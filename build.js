#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SUBTITLE_EXTS = new Set([".srt", ".ass", ".ssa", ".vtt", ".sub", ".sbv"]);

async function fetchTree(owner, repo, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "chiguyusubs-build",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${owner}/${repo}: ${res.statusText}`);
  }
  const data = await res.json();
  return data.tree || [];
}

async function processContributor(contributor, token) {
  const { name, repo, branch = "main", url } = contributor;
  const [owner, repoName] = repo.split("/");
  const repoUrl = url || `https://github.com/${repo}`;

  console.error(`[build] Crawling ${repo}...`);
  const tree = await fetchTree(owner, repoName, branch, token);

  const files = tree
    .filter((entry) => {
      if (entry.type !== "blob") return false;
      const ext = path.extname(entry.path).toLowerCase();
      return SUBTITLE_EXTS.has(ext);
    })
    .map((entry) => ({
      path: entry.path,
      raw_url: `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${encodeURI(entry.path)}`,
      size: entry.size,
    }));

  console.error(`[build] ${repo}: found ${files.length} subtitle files`);
  return { name, url: repoUrl, files };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || "";
  const registryPath = path.join(__dirname, "registry.json");
  const outputPath = path.join(__dirname, "index.json");

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const results = [];

  for (const contributor of registry.contributors) {
    try {
      const data = await processContributor(contributor, token);
      if (data.files.length > 0) {
        results.push(data);
      } else {
        console.error(`[build] Warning: ${contributor.repo} has no subtitle files`);
      }
    } catch (err) {
      console.error(`[build] Warning: Failed to crawl ${contributor.repo}: ${err.message}`);
    }
  }

  if (results.length === 0) {
    console.error("[build] Error: All contributors failed or returned no files. Aborting.");
    process.exit(1);
  }

  const newIndex = {
    generated_at: new Date().toISOString(),
    contributors: results,
  };

  // Only write if content actually changed (ignore generated_at timestamp)
  let changed = true;
  try {
    const existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    const oldData = JSON.stringify(existing.contributors);
    const newData = JSON.stringify(results);
    if (oldData === newData) {
      changed = false;
      console.error("[build] No changes detected, skipping write");
    }
  } catch {}

  if (changed) {
    fs.writeFileSync(outputPath, JSON.stringify(newIndex, null, 2) + "\n");
    console.error(`[build] Wrote index.json with ${results.length} contributors`);
  }
}

main();
