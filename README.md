# Life Interviewer — Server
Creates ephemeral Realtime sessions with English (US) default and on-topic guardrails.

## Setup
1) `cp .env.example .env` and paste your `OPENAI_API_KEY`
2) `npm install`
3) `npm run dev` (http://localhost:3000)

Routes:
- `GET /health` → {"ok":true}
- `GET /session?event=wedding&vibe=old_friend` → Realtime client token JSON
