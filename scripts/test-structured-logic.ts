
import { buildStructuredUserPrompt } from "../src/lib/structured/StructuredPrompt";
import { reconstructVtt } from "../src/lib/structured/VttReconstructor";
import { validateStructuredOutput } from "../src/lib/structured/StructuredOutput";
import { parseVtt, type Cue } from "../src/lib/vtt";

async function runTest() {
    console.log("Testing Structured Output Pipeline...");

    // 1. Mock Input Cues
    const cues: Cue[] = [
        { start: 0, end: 1, text: "Hello" },             // ID 1, Short
        { start: 1, end: 2, text: "World" },             // ID 2, Short
        { start: 2, end: 10, text: "Long monologue..." } // ID 3, Long
    ];

    // 2. Generate Prompt
    console.log("\n--- Generated Prompt ---");
    const prompt = buildStructuredUserPrompt(cues, "Spanish", undefined, "", undefined);
    console.log(prompt);

    // START VALIDATION
    if (!prompt.includes("[ID: 1] (Short)")) console.error("FAIL: Missing ID 1 or Short hint");
    if (!prompt.includes("[ID: 3] (Long)")) console.error("FAIL: Missing ID 3 or Long hint");


    // 3. Mock LLM Response (JSON)
    // Scenario: ID 1 and 2 are merged. ID 3 is separate.
    const mockLlmResponse = {
        translations: [
            { ids: [1, 2], text: "Hola Mundo" },
            { ids: [3], text: "Largo monologo..." }
        ]
    };

    console.log("\n--- Mock Response ---");
    console.log(JSON.stringify(mockLlmResponse, null, 2));

    // 4. Validate
    const validated = validateStructuredOutput(mockLlmResponse);

    // 5. Reconstruct
    const result = reconstructVtt(validated, cues);

    console.log("\n--- Reconstructed VTT ---");
    console.log(result.vtt);
    console.log("Warnings:", result.warnings);

    // 6. Verify Timing
    const parsed = parseVtt(result.vtt);
    if (parsed.length !== 2) throw new Error("Expected 2 cues");

    // Merged cue should span 0 -> 2
    if (parsed[0].start !== 0 || parsed[0].end !== 2) {
        throw new Error(`Cue 1 timing mismatch. Expected 0->2, got ${parsed[0].start}->${parsed[0].end}`);
    }
    if (parsed[0].text !== "Hola Mundo") throw new Error("Cue 1 text mismatch");

    // Cue 2 (ID 3) should span 2 -> 10
    if (parsed[1].start !== 2 || parsed[1].end !== 10) {
        throw new Error("Cue 2 timing mismatch");
    }

    console.log("\nPASS: Pipeline verified.");
}

runTest();
