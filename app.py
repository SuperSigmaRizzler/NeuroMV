import os
import time
import random
import requests
from flask import Flask, request, jsonify, render_template, session

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "neuromv-safe-mode")

# =====================================
# CONFIG
# =====================================
GROQ_KEYS = [
    k.strip()
    for k in os.getenv("GROQ_API_KEYS", "").split(",")
    if k.strip()
]

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")
MAX_MEMORY = 12
REQUEST_TIMEOUT = 12

# =====================================
# SESSION MEMORY
# =====================================
def get_memory():
    if "memory" not in session:
        session["memory"] = []
    return session["memory"]

def save_memory(role, content):
    mem = get_memory()
    mem.append({
        "role": role,
        "content": content
    })

    if len(mem) > MAX_MEMORY:
        mem = mem[-MAX_MEMORY:]

    session["memory"] = mem

def clear_memory():
    session["memory"] = []

# =====================================
# SAFE HELPERS
# =====================================
def safe_json(resp):
    try:
        return resp.json()
    except:
        return {}

def is_image_request(text):
    if not text:
        return False

    text = text.lower()

    keywords = [
        "gambar",
        "image",
        "foto",
        "draw",
        "anime",
        "buatkan gambar",
        "generate image",
        "create image",
        "lukis"
    ]

    return any(word in text for word in keywords)

def encode_prompt(text):
    return requests.utils.quote(text)

# =====================================
# IMAGE GENERATOR (POLLINATIONS)
# =====================================
def generate_image(prompt):
    prompt = prompt.strip()

    if not prompt:
        prompt = "beautiful futuristic city"

    clean = encode_prompt(prompt)

    # Stable working source
    return f"https://image.pollinations.ai/prompt/{clean}?width=768&height=768&seed={random.randint(1,999999)}&model=flux"

# =====================================
# GROQ SAFE CALL
# =====================================
def ask_groq(prompt):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS[:]
    random.shuffle(keys)

    memory = get_memory()

    for key in keys:
        for retry in range(2):
            try:
                payload = {
                    "model": GROQ_MODEL,
                    "messages": memory + [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7
                }

                r = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=REQUEST_TIMEOUT
                )

                if r.status_code == 200:
                    data = safe_json(r)
                    return data["choices"][0]["message"]["content"]

                # rate limit
                if r.status_code == 429:
                    time.sleep(1.2)
                    continue

                # bad key
                if r.status_code in [401, 403]:
                    break

                time.sleep(0.5)

            except:
                time.sleep(0.5)

    return None

# =====================================
# FREE FALLBACK TEXT AI
# =====================================
def ask_pollinations_text(prompt):
    try:
        url = f"https://text.pollinations.ai/{encode_prompt(prompt)}"
        r = requests.get(url, timeout=10)

        if r.status_code == 200:
            txt = r.text.strip()
            if txt:
                return txt
    except:
        pass

    return None

# =====================================
# MASTER AI ROUTER
# =====================================
def ask_ai(prompt):
    # Groq first
    reply = ask_groq(prompt)

    if reply:
        save_memory("user", prompt)
        save_memory("assistant", reply)
        return reply

    # Free fallback
    reply = ask_pollinations_text(prompt)

    if reply:
        save_memory("user", prompt)
        save_memory("assistant", reply)
        return reply

    # Offline final fallback
    return (
        "🤖 Safe Mode aktif.\n"
        "AI utama sedang sibuk / limit sementara.\n\n"
        f"Pesan kamu: {prompt}"
    )

# =====================================
# ROUTES
# =====================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/new_chat", methods=["POST"])
def new_chat():
    clear_memory()
    return jsonify({
        "ok": True
    })

@app.route("/chat", methods=["POST"])
def chat():
    try:
        msg = request.form.get("message", "").strip()
        file = request.files.get("file")

        # -----------------------------
        # BASIC IMAGE UPLOAD RESPONSE
        # -----------------------------
        if file:
            filename = file.filename or "image"

            return jsonify({
                "type": "text",
                "reply": f"📷 Gambar '{filename}' diterima. Vision mode basic aktif."
            })

        # -----------------------------
        # EMPTY MESSAGE
        # -----------------------------
        if not msg:
            return jsonify({
                "type": "text",
                "reply": "Tulis pesan dulu ya."
            })

        # -----------------------------
        # IMAGE GENERATION
        # -----------------------------
        if is_image_request(msg):
            return jsonify({
                "type": "image",
                "url": generate_image(msg)
            })

        # -----------------------------
        # TEXT CHAT
        # -----------------------------
        reply = ask_ai(msg)

        return jsonify({
            "type": "text",
            "reply": reply
        })

    except Exception as e:
        return jsonify({
            "type": "text",
            "reply": f"❌ Safe Error: {str(e)}"
        })

# =====================================
# HEALTH CHECK
# =====================================
@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "mode": "safe"
    })

# =====================================
# RUN
# =====================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
