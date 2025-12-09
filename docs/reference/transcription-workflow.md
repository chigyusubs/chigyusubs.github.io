## ChiguyuSubs Transcription Workflow

### Architecture Overview
- **Sequential processing**: Process 2-minute video chunks with context handoff (Gemini-only)
- **Model**: `gemini-2.5-flash` with thinking mode OFF
- **Validation**: `gemini-2.5-flash-lite` for automated sanity checking
- **Output**: Structured JSON → VTT format

### Chunk Processing Strategy

**Chunk 0 (First chunk):**
- Video segment: 00:00:00.000 - 00:02:00.000
- No context needed
- Start cue numbering at 1
- Suggest break point: 00:01:40.000 - 00:02:00.000

**Chunk N (Subsequent chunks):**
- Video segment starts at first context cue's startTime
- Show 2 minutes of video from that point
- Include last 2 cues from previous chunk as context
- Continue cue numbering
- Suggest break point in last 20 seconds

### Prompt Template - Chunk 0

```
Transcribe this Japanese video segment to structured subtitle data.

This is the first chunk starting at 00:00:00.000.

VIDEO SEGMENT: 00:00:00.000 to 00:02:00.000

TIMESTAMP FORMAT: Use HH:MM:SS.mmm format where:
- HH = hours (always 2 digits, e.g., 00)
- MM = minutes (always 2 digits)
- SS = seconds (always 2 digits)
- mmm = milliseconds (always 3 digits)
Example: "00:00:03.483" NOT "00:03:483" or "00:03.483"

TEXT FORMAT RULES:
1. Write Japanese text naturally WITHOUT spaces between characters
   CORRECT: "バンジージャンプがギリギリ地面って書いてるやつ"
   WRONG: "バンジー ジャンプ が ギリギリ 地面 って 書い てるやつ"

2. Natural Japanese uses spaces only:
   - After punctuation (。、)
   - Between distinct phrases (rare)
   NOT between every character or word

3. Keep sentences together in one cue when possible
   - Don't break mid-sentence unless speaker changes

Include sound effects in parentheses: (音楽), (拍手), (笑い)

Suggest a natural break point between 00:01:40.000 and 00:02:00.000 based on:
- Pause after punchline
- Scene change
- Topic shift
- Speaker change

OUTPUT ONLY THE JSON following the schema.
```

### Prompt Template - Chunk N

```
Transcribe this Japanese video segment to structured subtitle data.

VIDEO SEGMENT: {videoStart} to {videoEnd}

CONTEXT (already transcribed, for reference only):
[Cue {contextCue1.number}] {contextCue1.startTime} - {contextCue1.endTime}
{contextCue1.text}

[Cue {contextCue2.number}] {contextCue2.startTime} - {contextCue2.endTime}
{contextCue2.text}

BEGIN TRANSCRIPTION from {contextCue2.endTime}
Start cue numbering at: {contextCue2.number + 1}

TIMESTAMP FORMAT: Use HH:MM:SS.mmm format where:
- HH = hours (always 2 digits, e.g., 00)
- MM = minutes (always 2 digits)
- SS = seconds (always 2 digits)
- mmm = milliseconds (always 3 digits)
Example: "00:00:03.483" NOT "00:03:483" or "00:03.483"

TEXT FORMAT RULES:
1. Write Japanese text naturally WITHOUT spaces between characters
   CORRECT: "バンジージャンプがギリギリ地面って書いてるやつ"
   WRONG: "バンジー ジャンプ が ギリギリ 地面 って 書い てるやつ"

2. Natural Japanese uses spaces only:
   - After punctuation (。、)
   - Between distinct phrases (rare)
   NOT between every character or word

3. Keep sentences together in one cue when possible
   - Don't break mid-sentence unless speaker changes

Include sound effects in parentheses: (音楽), (拍手), (笑い)

Suggest a natural break point between {breakMin} and {breakMax} based on:
- Pause after punchline
- Scene change
- Topic shift
- Speaker change

OUTPUT ONLY THE JSON following the schema.
```

### JSON Schema

```json
{
  "type": "object",
  "properties": {
    "cues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "number": {"type": "integer"},
          "startTime": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$"
          },
          "endTime": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$"
          },
          "text": {"type": "string"}
        },
        "required": ["number", "startTime", "endTime", "text"]
      }
    },
    "suggestedNextBreak": {
      "type": "string",
      "pattern": "^\\d{2}:\\d{2}:\\d{2}\\.\\d{3}$"
    },
    "breakReason": {
      "type": "string",
      "enum": ["pause_after_punchline", "scene_change", "topic_shift", "natural_conversation_break", "speaker_change"]
    },
    "lastTwoCues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "number": {"type": "integer"},
          "startTime": {"type": "string"},
          "endTime": {"type": "string"},
          "text": {"type": "string"}
        },
        "required": ["number", "startTime", "endTime", "text"]
      },
      "minItems": 2,
      "maxItems": 2
    }
  },
  "required": ["cues", "suggestedNextBreak", "breakReason", "lastTwoCues"]
}
```

### Generation Config

```javascript
{
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: schema
  },
  // CRITICAL: Disable thinking mode
  thinkingConfig: {
    mode: "DISABLED"  // or set thinking budget to 0
  }
}
```

### Sanity Check (Optional but Recommended)

After each chunk, validate with `gemini-2.5-flash-lite`:

```javascript
{
  model: "gemini-2.5-flash-lite",
  prompt: `Review this Japanese transcript chunk for obvious errors:

PREVIOUS CONTEXT:
${contextCues}

CURRENT CHUNK:
${currentCues}

Check for:
- Nonsensical word sequences
- Sudden topic breaks inconsistent with context
- Repeated hallucinated phrases
- Character names that don't match context
- Gibberish or malformed Japanese

Return your assessment.`,
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 512,
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        valid: {type: "boolean"},
        confidence: {type: "string", enum: ["high", "medium", "low"]},
        issues: {type: "array", items: {type: "string"}}
      }
    }
  }
}
```

### Key Implementation Details

1. **Video segmentation**: Extract video from `contextCue1.startTime` for 120 seconds
2. **Break point calculation**: 
   - `breakMin = videoEnd - 20 seconds`
   - `breakMax = videoEnd`
3. **Context handoff**: Use `lastTwoCues` from previous chunk including full timing info
4. **Spacing issue**: Model may add extra spaces in Japanese text - this is cosmetic and doesn't affect translation
5. **Cost**: ~$0.50-1.00 per 30-minute video with sanity checks

### Success Criteria
- Timestamps accurate enough to follow video
- Comedian names correctly identified
- Story/jokes comprehensible
- Context flows between chunks

