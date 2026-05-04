from flask import Flask, render_template, request, jsonify
import requests, os, base64
from PIL import Image
import pytesseract
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    api_key = os.getenv("OPENROUTER_API_KEY","").strip()

    msg = request.form.get("message","")
    file = request.files.get("file")

    image_text = ""

    # =========================
    # 1. OCR IMAGE (GRATIS)
    # =========================
    if file:
        filename = secure_filename(file.filename)
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        try:
            img = Image.open(path)
            image_text = pytesseract.image_to_string(img)
        except:
            image_text = ""

    # =========================
    # 2. REQUEST KE AI GRATIS
    # =========================
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    prompt = f"""
Kamu adalah AI santai bernama NeuroMV.
Jawab dengan bahasa gaul dan tidak formal.

User message:
{msg}

Text dari gambar (jika ada):
{image_text}
"""

    payload = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )

        data = r.json()

        if "choices" not in data:
            return jsonify({"reply": f"❌ API Error: {data}"})

        reply = data["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
