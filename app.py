from flask import Flask, render_template, request, jsonify
import requests
import os
import json
import urllib.parse
from datetime import datetime

app = Flask(__name__)

# =========================
# CONFIG
# =========================
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
HF_API_KEY = os.getenv("HF_API_KEY", "").strip()

LIMIT_FILE = "limits.json"

# Hugging Face Vision Model
HF_MODEL = "Salesforce/blip-image-captioning-large"

# Groq Chat Model
GROQ_MODEL = "llama-3.1-8b-instant"

# =========================
# LIMIT SYSTEM
# =========================
def load_limits():
    if not os.path.exists(LIMIT_FILE):
        return {}

    try:
        with open(LIMIT_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_limits(data):
    with open(LIMIT_FILE, "w") as f:
        json.dump(data, f)

def get_ip():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    return ip.split(",")[0].strip()

def check_limit(ip, key, max_limit):

    data = load_limits()
    today = str(datetime.now().date())

    if ip not in data:
        data[ip] = {
            "date": today,
            "upload": 0,
            "generate": 0
        }

    if data[ip]["date"] != today:
        data[ip] = {
            "date": today,
            "upload": 0,
            "generate": 0
        }

    if data[ip][key] >= max_limit:
        return False

    data[ip][key] += 1
    save_limits(data)
    return True

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# CHAT ROUTE
# =========================
@app.route("/chat", methods=["POST"])
def chat():

    msg = request.form.get("message", "").strip()
    file = request.files.get("file")
    ip = get_ip()

    # =====================
    # IMAGE MODE (HF VISION)
    # =====================
    if file:

        if not check_limit(ip, "upload", 10):
            return jsonify({
                "reply": "⚠️ Limit upload gambar hari ini habis (10x)."
            })

        try:
            img_bytes = file.read()

            hf_url = f"https://api-inference.huggingface.co/models/{HF_MODEL}"

            headers = {
                "Authorization": f"Bearer {HF_API_KEY}"
            }

            r = requests.post(
                hf_url,
                headers=headers,
                data=img_bytes,
                timeout=90
            )

            data = r.json()

            # biasanya list caption
            if isinstance(data, list) and len(data) > 0:
                caption = data[0].get("generated_text", "")
            elif isinstance(data, dict):
                caption = data.get("generated_text", "")
            else:
                caption = "gambar"

            if not caption:
                caption = "gambar"

            # kalau user kasih pertanyaan
            final_prompt = f"""
User mengirim gambar dengan isi: {caption}

Pertanyaan user:
{msg if msg else 'Jelaskan gambar ini'}

Jawab santai dalam Bahasa Indonesia.
"""

            reply = ask_groq(final_prompt)

            return jsonify({"reply": reply})

        except Exception as e:
            return jsonify({
                "reply": f"❌ Vision Error: {str(e)}"
            })

    # =====================
    # NORMAL CHAT MODE
    # =====================
    try:
        reply = ask_groq(msg if msg else "Halo")
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({
            "reply": f"❌ Chat Error: {str(e)}"
        })

# =========================
# GROQ FUNCTION
# =========================
def ask_groq(prompt):

    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": """
Kamu adalah NeuroMV AI.
Jawab santai, ramah, modern.
Gunakan markdown seperti **bold**, `code`, _italic_ jika cocok.
Jangan terlalu formal.
"""
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7
    }

    r = requests.post(url, headers=headers, json=payload, timeout=60)
    data = r.json()

    if "choices" in data:
        return data["choices"][0]["message"]["content"]

    return f"❌ Groq Error: {data}"

# =========================
# IMAGE GENERATION
# =========================
@app.route("/generate-image", methods=["POST"])
def generate_image():

    ip = get_ip()

    if not check_limit(ip, "generate", 3):
        return jsonify({
            "error": "⚠️ Limit generate image hari ini habis (3x)."
        })

    prompt = request.form.get("message", "").strip()

    if not prompt:
        prompt = "beautiful fantasy landscape"

    img_url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)

    return jsonify({
        "image": img_url
    })

# =========================
# SUMMARY TITLE
# =========================
@app.route("/summary", methods=["POST"])
def summary():

    text = request.form.get("text", "").strip()

    if not text:
        return jsonify({"title": "💬 New Chat"})

    short = text[:18]

    if len(text) > 18:
        short += "..."

    return jsonify({
        "title": "💬 " + short
    })

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
