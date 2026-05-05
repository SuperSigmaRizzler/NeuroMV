import os
import requests
from flask import Flask, render_template, request, jsonify, session
from uuid import uuid4

app = Flask(__name__)
app.secret_key = "neuromv-godmode"

# =========================
# CONFIG
# =========================
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
HF_API_KEY = os.getenv("HF_API_KEY", "").strip()

GROQ_MODEL = "llama3-8b-8192"

# =========================
# MEMORY
# =========================
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

# =========================
# AI CHAT (MAIN BRAIN)
# =========================
def ask_ai(prompt):
    if not GROQ_API_KEY:
        return "⚠️ API KEY belum di-set."

    url = "https://api.groq.com/openai/v1/chat/completions"

    messages = get_memory() + [{"role": "user", "content": prompt}]

    payload = {
        "model": GROQ_MODEL,
        "messages": messages
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=30)

        if r.status_code != 200:
            print("GROQ ERROR:", r.text)
            return "⚠️ AI lagi error / limit."

        data = r.json()
        reply = data["choices"][0]["message"]["content"]

        add_memory("user", prompt)
        add_memory("assistant", reply)

        return reply

    except Exception as e:
        print("ERROR:", e)
        return "⚠️ AI tidak merespon."

# =========================
# IMAGE GENERATION (FREE)
# =========================
def generate_image(prompt):
    try:
        url = f"https://image.pollinations.ai/prompt/{prompt.replace(' ', '%20')}"
        return url
    except:
        return None

# =========================
# VISION (HF FREE)
# =========================
def analyze_image(file):
    if not HF_API_KEY:
        return "📷 Gambar diterima (Vision basic aktif)"

    try:
        url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base"
        headers = {"Authorization": f"Bearer {HF_API_KEY}"}

        img_bytes = file.read()

        r = requests.post(url, headers=headers, data=img_bytes, timeout=30)

        if r.status_code != 200:
            print("HF ERROR:", r.text)
            return "📷 Gambar diterima, tapi vision error."

        data = r.json()

        if isinstance(data, list) and "generated_text" in data[0]:
            caption = data[0]["generated_text"]
            return f"📷 Gambar ini terlihat seperti: {caption}"

        return "📷 Gambar diterima (tidak bisa dianalisa)."

    except Exception as e:
        print("VISION ERROR:", e)
        return "📷 Gagal membaca gambar."

# =========================
# ROUTES
# =========================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    message = request.form.get("message", "").strip()
    file = request.files.get("file")

    # =========================
    # IMAGE UPLOAD (VISION)
    # =========================
    if file:
        result = analyze_image(file)
        return jsonify({
            "type": "text",
            "reply": result
        })

    # =========================
    # IMAGE GENERATION DETECT
    # =========================
    if any(x in message.lower() for x in ["gambar", "image", "foto", "anime", "draw"]):
        img = generate_image(message)

        if img:
            return jsonify({
                "type": "image",
                "url": img
            })

        return jsonify({
            "type": "text",
            "reply": "❌ Gagal generate image"
        })

    # =========================
    # NORMAL CHAT
    # =========================
    reply = ask_ai(message)

    return jsonify({
        "type": "text",
        "reply": reply
    })

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
