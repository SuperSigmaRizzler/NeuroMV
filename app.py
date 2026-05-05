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
HF_API_KEY   = os.getenv("HF_API_KEY", "").strip()

GROQ_MODEL = "llama-3.1-8b-instant"
HF_MODEL   = "nlpconnect/vit-gpt2-image-captioning"

LIMIT_FILE = "limits.json"

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
        data[ip] = {"date": today, "upload": 0, "generate": 0}

    if data[ip]["date"] != today:
        data[ip] = {"date": today, "upload": 0, "generate": 0}

    if data[ip][key] >= max_limit:
        return False

    data[ip][key] += 1
    save_limits(data)
    return True

# =========================
# GROQ CHAT
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
Jawab santai, modern, ramah.
Gunakan markdown seperti **bold**, `code`, _italic_ bila cocok.
"""
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.7
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        data = r.json()

        if "choices" in data:
            return data["choices"][0]["message"]["content"]

        return f"❌ Groq Error: {data}"

    except:
        return "❌ Groq tidak merespon."

# =========================
# HF VISION (ANTI ERROR)
# =========================
def hf_caption(img_bytes):

    urls = [
        f"https://api-inference.huggingface.co/models/{HF_MODEL}",
        f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"
    ]

    headers = {
        "Authorization": f"Bearer {HF_API_KEY}"
    }

    for url in urls:
        try:
            r = requests.post(url, headers=headers, data=img_bytes, timeout=120)

            raw = r.text.strip()

            try:
                data = r.json()
            except:
                continue

            if isinstance(data, dict) and "error" in data:
                continue

            if isinstance(data, list) and len(data) > 0:
                return data[0].get("generated_text", "gambar")

            if isinstance(data, dict) and "generated_text" in data:
                return data["generated_text"]

        except:
            continue

    return None

# =========================
# HOME
# =========================
@app.route("/")
def home():
    return render_template("index.html")

# =========================
# CHAT / IMAGE / VISION
# =========================
@app.route("/chat", methods=["POST"])
def chat():

    msg  = request.form.get("message", "").strip()
    file = request.files.get("file")
    ip   = get_ip()

    lower = msg.lower()

    # =====================
    # AUTO GENERATE IMAGE
    # =====================
    if any(k in lower for k in [
        "buat gambar","buatkan gambar","generate image",
        "buat foto","buatkan foto","gambar","ilustrasi",
        "anime","lukisan","draw"
    ]):

        if not check_limit(ip, "generate", 10):
            return jsonify({
                "reply": "⚠️ Limit generate image hari ini habis (10x)."
            })

        prompt = f"{msg}, anime style, high quality, 4k, detailed, cinematic lighting"

        image_url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)

        return jsonify({
            "reply": f"<b>Image Created ✅</b><br><br><img src='{image_url}' class='chat-image fade-in-img'>"
        })

    # =====================
    # VISION MODE
    # =====================
    if file and file.filename != "":

        if not check_limit(ip, "upload", 10):
            return jsonify({
                "reply": "⚠️ Limit upload gambar hari ini habis (10x)."
            })

        try:
            img_bytes = file.read()

            caption = hf_caption(img_bytes)

            if not caption:
                return jsonify({
                    "reply": "❌ Vision gagal (HF sedang error / model tidak tersedia)."
                })

            prompt = f"""
User mengirim gambar:
{caption}

Pertanyaan:
{msg if msg else "Jelaskan gambar ini"}

Jawab santai.
"""

            reply = ask_groq(prompt)

            return jsonify({"reply": reply})

        except Exception as e:
            return jsonify({
                "reply": f"❌ Vision Error: {str(e)}"
            })

    # =====================
    # NORMAL CHAT
    # =====================
    reply = ask_groq(msg if msg else "Halo")

    return jsonify({"reply": reply})

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
