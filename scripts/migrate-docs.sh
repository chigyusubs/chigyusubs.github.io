#!/bin/bash
set -e

echo "📚 ChigyuSubs Documentation Migration Script"
echo "============================================="
echo ""

# Check if we're in the right directory
if [ ! -d "docs" ]; then
    echo "❌ Error: docs/ directory not found. Run this script from the project root."
    exit 1
fi

# Backup existing docs
echo "📦 Creating backup..."
tar -czf docs-backup-$(date +%Y%m%d-%H%M%S).tar.gz docs/
echo "✅ Backup created: docs-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
echo ""

# Create new directory structure
echo "📁 Creating new directory structure..."
mkdir -p docs/user/providers
mkdir -p docs/developer
mkdir -p docs/reference
mkdir -p docs/archive
echo "✅ Directories created"
echo ""

# ARCHIVE: Move completed/obsolete docs
echo "📦 Archiving completed migration docs..."
if [ -f "docs/MULTI_PROVIDER_CHANGES.md" ]; then
    git mv docs/MULTI_PROVIDER_CHANGES.md docs/archive/multi-provider-migration.md
    echo "  ✓ MULTI_PROVIDER_CHANGES.md → archive/multi-provider-migration.md"
fi

if [ -f "docs/gemini-transcription.md" ]; then
    git mv docs/gemini-transcription.md docs/archive/gemini-transcription-plan.md
    echo "  ✓ gemini-transcription.md → archive/gemini-transcription-plan.md"
fi

# Merge refactor docs into one archive file
if [ -f "docs/refactor-notes.md" ] && [ -f "docs/refactor-status.md" ]; then
    echo "# Refactor History (2024)" > docs/archive/refactor-2024.md
    echo "" >> docs/archive/refactor-2024.md
    echo "## Refactor Status" >> docs/archive/refactor-2024.md
    echo "" >> docs/archive/refactor-2024.md
    cat docs/refactor-status.md >> docs/archive/refactor-2024.md
    echo "" >> docs/archive/refactor-2024.md
    echo "---" >> docs/archive/refactor-2024.md
    echo "" >> docs/archive/refactor-2024.md
    echo "## Refactor Notes" >> docs/archive/refactor-2024.md
    echo "" >> docs/archive/refactor-2024.md
    cat docs/refactor-notes.md >> docs/archive/refactor-2024.md

    git rm docs/refactor-notes.md docs/refactor-status.md
    git add docs/archive/refactor-2024.md
    echo "  ✓ refactor-notes.md + refactor-status.md → archive/refactor-2024.md"
fi
echo ""

# REORGANIZE: Move to user/ folder
echo "📖 Moving user documentation..."
if [ -f "docs/usage.md" ]; then
    git mv docs/usage.md docs/user/translation-guide.md
    echo "  ✓ usage.md → user/translation-guide.md"
fi

if [ -f "docs/gemini.md" ]; then
    git mv docs/gemini.md docs/user/providers/gemini.md
    echo "  ✓ gemini.md → user/providers/gemini.md"
fi
echo ""

# REORGANIZE: Move to developer/ folder
echo "🔧 Moving developer documentation..."
if [ -f "docs/design.md" ]; then
    git mv docs/design.md docs/developer/architecture.md
    echo "  ✓ design.md → developer/architecture.md"
fi

if [ -f "docs/prompt-engineering.md" ]; then
    git mv docs/prompt-engineering.md docs/developer/prompt-engineering.md
    echo "  ✓ prompt-engineering.md → developer/prompt-engineering.md"
fi

if [ -f "docs/STRUCTURED_OUTPUT.md" ]; then
    git mv docs/STRUCTURED_OUTPUT.md docs/developer/structured-output.md
    echo "  ✓ STRUCTURED_OUTPUT.md → developer/structured-output.md"
fi

if [ -f "docs/providers-ui.md" ]; then
    git mv docs/providers-ui.md docs/developer/provider-ui-architecture.md
    echo "  ✓ providers-ui.md → developer/provider-ui-architecture.md"
fi
echo ""

# REORGANIZE: Move to reference/ folder
echo "📚 Moving reference documentation..."
if [ -f "docs/TOKENOMICS.md" ]; then
    git mv docs/TOKENOMICS.md docs/reference/tokenomics.md
    echo "  ✓ TOKENOMICS.md → reference/tokenomics.md"
fi

if [ -f "docs/Transcription_Workflow.md" ]; then
    git mv docs/Transcription_Workflow.md docs/reference/transcription-workflow.md
    echo "  ✓ Transcription_Workflow.md → reference/transcription-workflow.md"
fi

if [ -f "docs/legal.md" ]; then
    git mv docs/legal.md docs/reference/legal.md
    echo "  ✓ legal.md → reference/legal.md"
fi
echo ""

# CREATE: Documentation navigation hub
echo "📝 Creating docs/README.md navigation hub..."
cat > docs/README.md << 'EOF'
# ChigyuSubs Documentation

> **Project Mission**: Build a browser-only subtitle translation tool focused on Japanese comedy content. See [MISSION.md](./MISSION.md) for scope and goals.

## For Users

### Getting Started
- **[Translation Guide](./user/translation-guide.md)** - How to translate subtitles with glossary and summary
- **[Transcription Guide](./user/transcription-guide.md)** - How to transcribe videos to subtitles *(coming soon)*

### Provider Setup
Choose your AI provider and get set up:
- **[Gemini](./user/providers/gemini.md)** - Google's multimodal AI (default, recommended for comedy)
- **[OpenAI](./user/providers/openai.md)** - GPT-4 and GPT-3.5 models *(guide coming soon)*
- **[Anthropic](./user/providers/anthropic.md)** - Claude 3.5 models *(guide coming soon)*
- **[Ollama](./user/providers/ollama.md)** - Local models (privacy-first) *(guide coming soon)*

---

## For Developers

### Architecture & Design
- **[Architecture](./developer/architecture.md)** - System design decisions and rationale
- **[Prompt Engineering](./developer/prompt-engineering.md)** - How prompts are structured and why
- **[Provider Abstraction](./developer/provider-abstraction.md)** - Multi-provider system design *(coming soon)*
- **[Provider UI Architecture](./developer/provider-ui-architecture.md)** - Dynamic UI based on provider capabilities

### Experimental Features
- **[Structured Output](./developer/structured-output.md)** - JSON-based transcription workflow (experimental branch)

### Testing & Development
- **[Testing Guide](./developer/testing.md)** - How to test, mock mode, fixtures *(coming soon)*

---

## Reference

Technical specifications and details:
- **[Tokenomics](./reference/tokenomics.md)** - Cost estimates and token usage
- **[Transcription Workflow](./reference/transcription-workflow.md)** - Technical details of chunking and processing
- **[Legal](./reference/legal.md)** - Copyright, licensing, and usage terms

---

## Archive

Historical documents (completed migrations, old plans):
- [Multi-Provider Migration](./archive/multi-provider-migration.md) - Provider abstraction layer migration notes
- [Gemini Transcription Plan](./archive/gemini-transcription-plan.md) - Original transcription feature plan
- [Refactor History (2024)](./archive/refactor-2024.md) - Translation/transcription separation refactor

---

## Quick Links

- 🏠 [Project README](../README.md) - Main project page
- 🎯 [MISSION.md](./MISSION.md) - Why this project exists
- 🚀 [Live App](https://chigyusubs.github.io) - Try it now
- 🐛 [GitHub Issues](https://github.com/chigyusubs/chigyusubs/issues) - Report bugs or request features

---

## Contributing to Docs

When adding or updating documentation:
1. **User docs** go in `user/` - focus on "how to use"
2. **Developer docs** go in `developer/` - focus on "how it works"
3. **Reference docs** go in `reference/` - technical specifications
4. **Archive** completed work - preserve history but keep main docs clean
5. Update this README.md with links to new docs
EOF

git add docs/README.md
echo "✅ Created docs/README.md"
echo ""

# Handle providers.md - mark for manual split
echo "⚠️  MANUAL ACTION REQUIRED: providers.md"
echo ""
echo "The file docs/providers.md needs to be split manually:"
echo "  1. Extract per-provider setup → docs/user/providers/[provider].md"
echo "  2. Extract architecture content → docs/developer/provider-abstraction.md"
echo "  3. Delete the original once content is extracted"
echo ""
echo "Keeping providers.md in place for now (not moved)."
echo ""

# Summary
echo "============================================="
echo "✅ Documentation migration complete!"
echo ""
echo "📂 New structure:"
echo "  docs/"
echo "    ├── README.md                    (NEW - navigation hub)"
echo "    ├── MISSION.md                   (kept in place)"
echo "    ├── user/"
echo "    │   ├── translation-guide.md     (was usage.md)"
echo "    │   └── providers/"
echo "    │       └── gemini.md            (moved)"
echo "    ├── developer/"
echo "    │   ├── architecture.md          (was design.md)"
echo "    │   ├── prompt-engineering.md    (moved)"
echo "    │   ├── structured-output.md     (was STRUCTURED_OUTPUT.md)"
echo "    │   └── provider-ui-architecture.md (was providers-ui.md)"
echo "    ├── reference/"
echo "    │   ├── tokenomics.md            (was TOKENOMICS.md)"
echo "    │   ├── transcription-workflow.md (was Transcription_Workflow.md)"
echo "    │   └── legal.md                 (moved)"
echo "    └── archive/"
echo "        ├── multi-provider-migration.md"
echo "        ├── gemini-transcription-plan.md"
echo "        └── refactor-2024.md"
echo ""
echo "📝 Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Manually split providers.md (see above)"
echo "  3. Create missing docs marked as '(coming soon)' in docs/README.md"
echo "  4. Update links in moved files to reflect new paths"
echo "  5. Commit: git commit -m 'docs: reorganize documentation structure'"
echo ""
echo "💾 Backup saved: docs-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
