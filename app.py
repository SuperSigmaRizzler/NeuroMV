# app.py — NeuroMV GOD MODE Flask Backend

import os
import time
import random
import requests
from flask import Flask, request, jsonify, render_template, session

app = Flask(__name__)
app.secret_key = "neuromv-god-mode"

# ===============================
# CONFIG
# ===============================
GROQ_KEYS = [k.strip() for k in os.getenv("GROQ_API_KEYS", "").split(",") if k.strip()]
GROQ_MODEL = "llama3-8b-8192"

# ===============================
# MEMORY
# ===============================
def get_memory():
    if "memory" not in session:
        session["memory"] = []
    return session["memory"]

def add_memory(role, content):
    mem = get_memory()
    mem.append({"role": role, "content": content})
    if len(mem) > 12:
        mem.pop(0)
    session["memory"] = mem

# ===============================
# GROQ AI
# ===============================
def ask_groq(prompt):
    if not GROQ_KEYS:
        return None

    keys = GROQ_KEYS.copy()
    random.shuffle(keys)

    for key in keys:
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": get_memory() + [
                        {"role": "user", "content": prompt}
                    ]
                },
                timeout=15
            )

            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]

            if res.status_code == 429:
                continue

        except:
            continue

    return None

# ===============================
# POLLINATIONS TEXT FALLBACK
# ===============================
def ask_pollinations(prompt):
    try:
        url = f"https://text.pollinations.ai/{prompt.replace(' ', '%20')}"
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            return r.text.strip()
    except:
        return None

# ===============================
# MAIN AI
# ===============================
def ask_ai(prompt):
    reply = ask_groq(prompt)
    if reply:
        add_memory("user", prompt)
        add_memory("assistant", reply)
        return reply

    reply = ask_pollinations(prompt)
    if reply:
        add_memory("user", prompt)
        add_memory("assistant", reply)
        return reply

    return "⚠️ AI sedang sibuk / limit. Coba lagi sebentar."

# ===============================
# IMAGE GENERATOR
# ===============================
bad_words = [
    "porn", "sex", "nude", "telanjang",
    "bokep", "hentai", "nsfw"
]

def safe_prompt(prompt):
    p = prompt.lower()
    for w in bad_words:
        if w in p:
            return False
    return True

def generate_image(prompt):
    if not safe_prompt(prompt):
        return None

    q = prompt.replace(" ", "%20")
    return f"https://image.pollinations.ai/prompt/{q}?width=768&height=768&model=flux"

# ===============================
# ROUTES
# ===============================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    msg = request.form.get("message", "").strip()
    file = request.files.get("file")

    # IMAGE GENERATION
    trigger = ["gambar", "image", "foto", "anime", "draw", "generate"]

    if any(t in msg.lower() for t in trigger):
        url = generate_image(msg)

        if not url:
            return jsonify({
                "type": "text",
                "reply": "❌ Prompt gambar tidak diperbolehkan."
            })

        return jsonify({
            "type": "image",
            "url": url
        })

    # VISION BASIC
    if file:
        return jsonify({
            "type": "text",
            "reply": "📷 Gambar diterima. Vision mode akan ditingkatkan lagi nanti."
        })

    # TEXT AI
    reply = ask_ai(msg)

    return jsonify({
        "type": "text",
        "reply": reply
    })

# ===============================
# RESET MEMORY
# ===============================
@app.route("/reset")
def reset():
    session.clear()
    return "reset ok"

# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
