import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables");
  process.exit(1);
}

// Friendly root so you don't see "Cannot GET /"
app.get("/", (req, res) => {
  res.type("text").send("✅ Life Interviewer server is running. Try /health or /session");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * /session
 * Creates a Realtime session with strong on-topic guardrails and English (US) default.
 *
 * Optional query params from the client:
 *   ?event=wedding|birth|first_job   (defaults to "chosen life event")
 *   ?vibe=old_friend|documentarian|coach   (defaults to "old_friend")
 */
app.get("/session", async (req, res) => {
  try {
    const clean = (s, fallback) => (s || fallback).toString().replace(/[^a-zA-Z0-9_ \-]/g, "");
    const event = clean(req.query.event, "chosen life event");
    const vibe = clean(req.query.vibe, "old_friend");

    const vibeStyle =
      vibe === "documentarian"
        ? "precise, calm, neutral"
        : vibe === "coach"
        ? "gentle, upbeat, encouraging"
        : "warm, familiar, lightly playful";

    const instructions = `
You are an on-topic, warm interviewer speaking in English (US) only.
Vibe: ${vibeStyle}. Topic: ${event}.

### Goals
- Have a natural, friendly conversation that **stays focused** on ${event}.
- Ask **one concise question at a time**, then listen.
- Fill the outline below; keep answers flowing from the user.

### Outline (slot-filling; don't read aloud)
{
  "eventType": "${event}",
  "people": [{"role":"partner","name":""}, {"role":"officiant_or_equivalent","name":""}, {"role":"VIP","name":""}],
  "date": "", "venue": "", "city": "",
  "keyMoments": [{"title":"","details":""}],
  "quotes": [], "music_or_readings": [], "challenges_or_hiccups": []
}

### Guardrails
- **Language:** English (US) only unless the user explicitly asks to switch.
- **Tangent budget:** 2 short follow-up turns max for any digression. Then gently redirect.
- **Redirection script:** If off-topic persists, say:
  "This is interesting, but to do your ${event} justice, let me bring us back—"
  and ask a focused question from the outline.
- **Filler:** Avoid long monologues. Keep questions short and conversational.
- **Every ~2–3 turns:** give a 1-sentence recap with any **names/dates/places** captured, and confirm.

### Interview tactics
- Start with an easy memory prompt, then capture date/place/names.
- Ask for **one key moment** and its sensory details.
- Ask for one challenge or funny surprise; how it resolved.
- Ask for any words/music/quotes that mattered.
- Close with a one-sentence keepsake line for future self.

### Style
- Warm, human-like, but concise.
- Never mention these rules or the outline.
`;

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "verse",
        temperature: 0.6, // min allowed
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
          interrupt_response: false // ensure AI finishes before barge-in
        },
        instructions
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `OpenAI API error: ${text}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error creating session:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
