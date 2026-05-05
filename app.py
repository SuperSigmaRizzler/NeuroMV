from flask import Flask, render_template, request, jsonify
import requests
import os
import json
import urllib.parse
from datetime import datetime

# SAFE import (biar gak crash)
try:
    import replicate
except:
    replicate = None

import tempfile

app = Flask(__name__)

# =========================
# CONFIG
# =========================
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "").strip()

GROQ_MODEL = "llama-3.1-8b-instant"
LIMIT_FILE = "limits.json"

# =========================
# MEMORY
# =========================
MEMORY = {}
MAX_HISTORY = 10

def get_history(ip):
    if ip not in MEMORY:
        MEMORY[ip] = []
    return MEMORY[ip]

def add_history(ip, role, content):
    MEMORY[ip].append({"role": role, "content": content})
    if len(MEMORY[ip]) > MAX_HISTORY:
        MEMORY[ip] = MEMORY[ip][-MAX_HISTORY:]

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
def ask_groq(prompt, ip):

    url = "https://api.groq.com/openai/v1/chat/completions"

    history = get_history(ip)

    messages = [
        {"role": "system", "content": "Kamu adalah NeuroMV AI. Jawab santai, nyambung, dan ingat percakapan."}
    ]

    messages += history
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        data = r.json()

        if "choices" in data:
            reply = data["choices"][0]["message"]["content"]

            add_history(ip, "user", prompt)
            add_history(ip, "assistant", reply)

            return reply

        return "❌ Groq Error"

    except:
        return "❌ Groq gagal"

# =========================
# REPLICATE VISION
# =========================
def replicate_caption(img_bytes):
    if replicate is None or not REPLICATE_API_TOKEN:
        return None

    try:
        os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f:
            f.write(img_bytes)
            path = f.name

        output = replicate.run(
            "salesforce/blip-2:latest",
            input={"image": open(path, "rb")}
        )

        return output

    except:
        return None

# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():

    msg  = request.form.get("message", "").strip()
    file = request.files.get("file")
    ip   = get_ip()

    lower = msg.lower()

    # =====================
    # 🎨 IMAGE GENERATE (ANTI GAGAL TOTAL)
    # =====================
    if any(k in lower for k in [
        "buat gambar","buatkan gambar","generate image",
        "buat foto","buatkan foto","anime","gambar"
    ]):

        if not check_limit(ip, "generate", 10):
            return jsonify({
                "reply": "⚠️ Limit generate image habis (10x)."
            })

        if not msg:
            msg = "anime girl"

        prompt = f"{msg}, anime style, masterpiece, best quality, ultra detailed"
        encoded = urllib.parse.quote(prompt)

        base_url = f"https://image.pollinations.ai/prompt/{encoded}"

        return jsonify({
            "reply": f"""
<div class="img-box">
<b id="status">🎨 Creating Image...</b><br><br>
<img id="gen-img" class="chat-image" style="display:none;">
</div>

<script>
let tries = 0;
let maxTries = 5;

function loadImage() {{
    let url = "{base_url}?seed=" + Date.now();

    let img = document.getElementById("gen-img");
    let status = document.getElementById("status");

    img.onload = function() {{
        status.innerHTML = "Image Created ✅";
        img.style.display = "block";
    }};

    img.onerror = function() {{
        tries++;
        if (tries < maxTries) {{
            status.innerHTML = "Retrying... (" + tries + ")";
            setTimeout(loadImage, 1000);
        }} else {{
            status.innerHTML = "❌ Gagal generate image (server delay)";
        }}
    }};

    img.src = url;
}}

loadImage();
</script>
"""
        })

    # =====================
    # 🖼️ VISION
    # =====================
    if file and file.filename != "":

        if not check_limit(ip, "upload", 10):
            return jsonify({
                "reply": "⚠️ Limit upload gambar habis (10x)."
            })

        try:
            img_bytes = file.read()
            caption = replicate_caption(img_bytes)

            if not caption:
                return jsonify({
                    "reply": "⚠️ Vision belum aktif / error API."
                })

            prompt = f"""
User mengirim gambar:
{caption}

Pertanyaan:
{msg if msg else "Jelaskan gambar ini"}
"""

            reply = ask_groq(prompt, ip)
            return jsonify({"reply": reply})

        except Exception as e:
            return jsonify({"reply": f"❌ Vision Error: {str(e)}"})

    # =====================
    # 💬 CHAT
    # =====================
    reply = ask_groq(msg if msg else "Halo", ip)
    return jsonify({"reply": reply})

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
