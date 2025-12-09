# Ollama Provider Setup

> **Best for**: Privacy-sensitive content, offline translation, cost-free experimentation

## Features

- ✅ Run models locally on your machine
- ✅ No API key required
- ✅ Completely private (no data leaves your computer)
- ✅ Supports various open-source models
- ⚠️ Quality varies by model
- ⚠️ Slower than cloud APIs (depends on hardware)

## Setup

1. **Install Ollama** from [ollama.ai](https://ollama.ai/)

   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows: Download from website
   ```

2. **Start Ollama server**

   ```bash
   ollama serve
   ```

3. **Pull a model**

   ```bash
   # Recommended models
   ollama pull llama2:70b      # Best quality (requires ~40GB RAM)
   ollama pull mistral:7b      # Good balance
   ollama pull gemma:7b        # Google's open model
   ollama pull qwen2:7b        # Multilingual support
   ```

4. **Configure in ChigyuSubs**
   - Select "Ollama" as provider
   - Enter base URL: `http://localhost:11434` (default)
   - Choose your installed model from dropdown

## Recommended Models

| Model | Size | RAM Needed | Quality | Speed | Best For |
|-------|------|------------|---------|-------|----------|
| `llama2:70b` | ~40GB | 40GB+ | Excellent | Slow | Production quality |
| `mistral:7b` | ~4GB | 8GB+ | Good | Medium | Balanced use |
| `gemma:7b` | ~4GB | 8GB+ | Good | Medium | General purpose |
| `qwen2:7b` | ~4GB | 8GB+ | Good | Medium | Multilingual |
| `llama2:13b` | ~7GB | 16GB+ | Good | Medium | Step-up quality |

## System Requirements

- **CPU**: Modern multi-core processor (8+ cores recommended)
- **RAM**:
  - 8GB minimum (for 7B models)
  - 16GB+ recommended (for 13B models)
  - 40GB+ required (for 70B models)
- **Disk**: 4-50GB per model
- **OS**: macOS, Linux, or Windows

## When to Use Ollama

**Choose Ollama if you need**:
- Complete privacy (sensitive content)
- Offline translation (no internet required)
- Cost-free experimentation
- No API key management

**Don't choose Ollama if you need**:
- Best possible quality (cloud models are better)
- Fast processing (cloud APIs are faster)
- Media/video context (not supported)
- Minimal hardware requirements

## Performance Tips

1. **Use GPU acceleration** (if available)
   ```bash
   # Check if GPU is detected
   ollama ps
   ```

2. **Close other applications** to free up RAM

3. **Start with smaller models** (7B) and scale up if quality isn't sufficient

4. **Adjust concurrency**
   - Set Concurrency = 1 in ChigyuSubs settings
   - Local models can't handle parallel requests efficiently

5. **Use quantized models** for lower RAM usage
   ```bash
   ollama pull llama2:7b-q4_0  # 4-bit quantization
   ```

## Limitations

- **No media upload**: Text-only translation
- **No vision support**: Cannot see video or images
- **Variable quality**: Depends heavily on model size
- **Slower processing**: Especially on CPU-only systems
- **High RAM usage**: Large models need significant memory

## Troubleshooting

### "Connection refused" error

- Ensure Ollama is running: `ollama serve`
- Verify base URL is correct: `http://localhost:11434`
- Check firewall isn't blocking port 11434

### "Model not found" error

- List installed models: `ollama list`
- Pull the model: `ollama pull <model-name>`
- Verify model name matches exactly (case-sensitive)

### Very slow responses

- Check RAM usage - if swapping, model is too large
- Try a smaller model variant (e.g., 7B instead of 13B)
- Reduce chunk size in ChigyuSubs settings
- Set Concurrency = 1

### Poor translation quality

- Try a larger model (13B or 70B if RAM permits)
- Adjust temperature (try 0.3-0.7)
- Check prompts - some models need specific formatting
- Consider switching to cloud provider for this content

### Out of memory

- Use quantized models (q4_0, q4_1)
- Close other applications
- Try smaller model variants
- Add swap space (not recommended - very slow)

## Model Selection Guide

**For Japanese → English comedy translation**:

1. **Best quality** (if you have 40GB+ RAM):
   - `llama2:70b` or `qwen2:72b`

2. **Good balance** (16GB RAM):
   - `mistral:7b` or `gemma:7b`

3. **Limited RAM** (8GB):
   - `llama2:7b-q4_0` (quantized)
   - Expect lower quality, consider cloud provider instead

---

**External Resources**:
- [Ollama Documentation](https://github.com/ollama/ollama) - Official docs
- [Ollama Models](https://ollama.ai/library) - Browse available models
