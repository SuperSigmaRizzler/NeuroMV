from flask import Flask, render_template, request, jsonify
import requests, os, json, base64, urllib.parse
from datetime import datetime

app = Flask(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
LIMIT_FILE = "limits.json"

# =========================
# LIMIT SYSTEM
# =========================
def load_limits():
    if not os.path.exists(LIMIT_FILE):
        return {}
    with open(LIMIT_FILE, "r") as f:
        return json.load(f)

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
# CHAT + VISION
# =========================
@app.route("/chat", methods=["POST"])
def chat():

    msg = request.form.get("message", "").strip()
    file = request.files.get("file")
    ip = get_ip()

    parts = []

    if msg:
        parts.append({"text": msg})

    if file:
        if not check_limit(ip, "upload", 10):
            return jsonify({
                "reply":"⚠️ Limit upload gambar hari ini habis (10x)."
            })

        img = base64.b64encode(file.read()).decode("utf-8")

        parts.append({
            "inline_data":{
                "mime_type":"image/jpeg",
                "data": img
            }
        })

    if not parts:
        parts = [{"text":"Halo"}]

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents":[
            {
                "parts": parts
            }
        ]
    }

    try:
        r = requests.post(url, json=payload, timeout=60)
        data = r.json()

        reply = data["candidates"][0]["content"]["parts"][0]["text"]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"})

# =========================
# GENERATE IMAGE
# =========================
@app.route("/generate-image", methods=["POST"])
def generate_image():

    ip = get_ip()

    if not check_limit(ip, "generate", 3):
        return jsonify({
            "error":"⚠️ Limit generate image hari ini habis (3x)."
        })

    prompt = request.form.get("prompt","anime cat").strip()

    img_url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)

    return jsonify({
        "image": img_url
    })

# =========================
# SUMMARY TITLE
# =========================
@app.route("/summary", methods=["POST"])
def summary():

    text = request.form.get("text","").strip()

    if not text:
        return jsonify({"title":"New Chat"})

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"

    prompt = f"""
Buat judul sidebar singkat max 3 kata dari pesan ini.
Kasih emoji cocok.
Contoh:
Apa itu 1+1 = 🧮 Matematika Dasar
Buat gambar kucing = 🎨 Kucing Lucu

Pesan:
{text}
"""

    payload = {
        "contents":[
            {
                "parts":[{"text":prompt}]
            }
        ]
    }

    try:
        r = requests.post(url, json=payload, timeout=30)
        data = r.json()

        title = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        return jsonify({"title": title})

    except:
        return jsonify({"title":"💬 New Chat"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
