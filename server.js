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

// Friendly root
app.get("/", (req, res) => {
  res.type("text").send("✅ Life Interviewer server is running. Try /health or /session");
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/session", async (req, res) => {
  try {
    const clean = (s, fallback) => (s || fallback).toString().replace(/[^a-zA-Z0-9_ \-]/g, "");
    const event = clean(req.query.event, "chosen life event");
    const vibe = clean(req.query.vibe, "old_friend");

    const vibeStyle =
      vibe === "documentarian" ? "precise, calm, neutral"
      : vibe === "coach" ? "gentle, upbeat, encouraging"
      : "warm, familiar, lightly playful";

    const instructions = `
You are an on-topic interviewer speaking in English (US) only.
Vibe: ${vibeStyle}. Topic: ${event}.

### Conversation rules
- Ask **one concise question** at a time, then **wait quietly**.
- **Do not infer answers**. If you don’t hear a clear reply, **do not proceed**.
- If there is **no audible user response** after a few seconds, say:
  "I didn’t catch that—want me to repeat the question?" and then pause again.
- Stay tightly focused on ${event}. Use at most 2 short follow-ups for any tangent, then redirect.
- Summarize names/dates/places every 2–3 turns to confirm.

### Outline to fill (don’t read aloud)
{
  "eventType": "${event}",
  "people": [{"role":"partner","name":""},{"role":"officiant_or_equivalent","name":""},{"role":"VIP","name":""}],
  "date":"", "venue":"", "city":"",
  "keyMoments":[{"title":"","details":""}],
  "quotes":[], "music_or_readings":[], "challenges_or_hiccups":[]
}
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
        temperature: 0.6,
        // Make VAD less sensitive and require a clearer pause before replying
        turn_detection: {
          type: "server_vad",
          threshold: 0.75,           // was 0.5 — raise to ignore small noises
          prefix_padding_ms: 400,    // a bit more context before the speech
          silence_duration_ms: 650,  // was 200 — wait longer after you stop
          create_response: true,
          interrupt_response: false  // finish its thought before listening again
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
