# 🌿 MindCare - Mental Wellness Companion

A free, dark-themed mental wellness web app built with **Flask** and the **Google Gemini API** (free tier).

> MindCare is a support tool. It is **not** a doctor or therapist and does not diagnose.
> If you are in danger or thinking about harming yourself, call your local emergency number
> (India: **112**, Tele-MANAS **14416**) or find a helpline at https://findahelpline.com.

## Features

| Activity | What it does |
|---|---|
| 💬 Chat | Talk to a warm AI companion (Gemini). Crisis words skip the AI and show helplines immediately. |
| 🫁 Breathe | Guided breathing with Box 4-4-4-4, 4-7-8 and Easy 4-6 patterns. |
| 📈 Mood | Log your mood (1-5) and see a chart of recent check-ins and the average. |
| 📓 Journal | Writing prompts and saved entries (stored only in your browser). |
| 🖐️ Grounding | The 5-4-3-2-1 grounding exercise, step by step. |

## Setup

1. Get a free API key at https://aistudio.google.com/apikey (copy the key itself, not the project name).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create your `.env` file from the example and paste your key:
   ```bash
   cp .env.example .env        # Windows: copy .env.example .env
   ```
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-3.8-flash
   ```
4. Run:
   ```bash
   python app.py
   ```
5. Open http://127.0.0.1:5000

## Project structure

```
mindcare/
├── app.py              # Flask server + Gemini calls, retry and model fallback
├── requirements.txt
├── .env.example        # copy to .env (never commit .env)
├── templates/
│   └── index.html
└── static/
    ├── style.css       # dark theme
    └── app.js
```

## Safety and privacy

- Crisis keywords (suicide, self-harm, ...) skip the AI and show helpline numbers.
- The system prompt tells the AI not to diagnose or prescribe.
- Your API key lives only in `.env`, which is git-ignored.
- Mood and journal data stay in your own browser (localStorage).

## Troubleshooting

| Error | Fix |
|---|---|
| `API key not valid` | Copy the real key from AI Studio (not the `gen-lang-client-...` project name) and restart. |
| `404 model no longer available` | Set `GEMINI_MODEL` in `.env` to the model named in the error. |
| `503 high demand` | Google is busy (free tier). Wait a minute and retry. The app already retries automatically. |

## Deploy for free

Works on Render, Railway or PythonAnywhere. Set `GEMINI_API_KEY` as an environment variable there
and run with `gunicorn app:app` (add `gunicorn` to requirements.txt). Do not deploy with `debug=True`.
