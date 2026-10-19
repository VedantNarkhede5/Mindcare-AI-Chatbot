import os
import time
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(override=True)  # .env wins over any old system variable

app = Flask(__name__)

API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
if "paste_your_key" in API_KEY or API_KEY == "your_key":
    API_KEY = ""  # placeholder was never replaced
print("Gemini key loaded:", (API_KEY[:6] + "..." + API_KEY[-4:] + f" (length {len(API_KEY)})") if API_KEY else "NONE")
if API_KEY and not API_KEY.startswith(("AIza", "AQ.")):
    print("WARNING: This does not look like a Gemini API key (usually starts with 'AIza' or 'AQ.').")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
# Tried in order if a model is retired / not found
MODEL_FALLBACKS = [m for m in dict.fromkeys([MODEL, "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"]) if m]
client = genai.Client(api_key=API_KEY) if API_KEY else None

SYSTEM_PROMPT = """You are MindCare, a warm, calm and non-judgmental mental wellness companion.
- Listen first. Reflect the person's feelings in simple, kind language.
- Offer gentle coping ideas (breathing, grounding, journaling, sleep, talking to someone trusted).
- Keep replies short (3-6 sentences) and ask at most one caring follow-up question.
- You are NOT a doctor or therapist. Never diagnose or prescribe medication.
- For persistent or serious problems, encourage seeing a qualified professional.
- If the user mentions self-harm or suicide, respond with care, urge them to contact a
  helpline or emergency services and a trusted person right now."""

CRISIS_WORDS = [
    "suicide", "kill myself", "end my life", "want to die", "self harm",
    "self-harm", "hurt myself", "no reason to live", "cut myself",
]

CRISIS_MESSAGE = (
    "I'm really sorry you're feeling this much pain, and I'm glad you told me. "
    "You deserve support right now. Please reach out to someone immediately:\n\n"
    "• Emergency (India): 112\n"
    "• Tele-MANAS (free, 24/7, India): 14416 or 1-800-891-4416\n"
    "• iCall (India): 9152987821\n"
    "• Outside India: find a helpline at findahelpline.com\n\n"
    "If you can, please tell a trusted person near you and stay with them. "
    "I'm here to keep talking too."
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    history = data.get("history") or []

    if not message:
        return jsonify({"error": "Empty message"}), 400

    # Safety check runs before the AI call
    if any(w in message.lower() for w in CRISIS_WORDS):
        return jsonify({"reply": CRISIS_MESSAGE, "crisis": True})

    if client is None:
        return jsonify({"error": "GEMINI_API_KEY is not set. See README."}), 500

    contents = []
    for turn in history[-12:]:
        role = "user" if turn.get("role") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=str(turn.get("text", "")))]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    cfg = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.8, max_output_tokens=400)
    try:
        last_err = None
        for model in MODEL_FALLBACKS:
            for attempt in range(2):  # retry once on temporary overload
                try:
                    resp = client.models.generate_content(model=model, contents=contents, config=cfg)
                    return jsonify({"reply": resp.text or "I'm here with you. Could you say that again?", "crisis": False})
                except Exception as e:
                    last_err = e
                    msg = str(e)
                    if "UNAVAILABLE" in msg or "503" in msg or "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                        time.sleep(1.5)
                        continue  # retry, then fall through to the next model
                    if "NOT_FOUND" in msg or "404" in msg:
                        break  # model retired: go to next model
                    raise
        raise last_err
    except Exception as e:
        if "UNAVAILABLE" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            return jsonify({"error": "The AI is very busy right now (free tier). Please wait a few seconds and send again."}), 503
        if "API_KEY_INVALID" in str(e) or "API key not valid" in str(e):
            return jsonify({"error": "Your Gemini API key was rejected by Google. Create a new key at "
                            "https://aistudio.google.com/apikey, paste it in .env as GEMINI_API_KEY=AIza... "
                            "(no quotes or spaces), then restart the server."}), 500
        return jsonify({"error": f"AI error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
