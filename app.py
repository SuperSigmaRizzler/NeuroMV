from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
from PIL import Image
import pytesseract
import requests

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():

    msg = request.form.get("message", "")
    file = request.files.get("file")

    image_text = ""

    # =========================
    # IMAGE PROCESS (OCR)
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
    # PROMPT KE AI
    # =========================
    prompt = f"""
Kamu adalah AI santai seperti teman ngobrol.

Jawab dengan bahasa gaul, tidak terlalu formal.

User message:
{msg}

Teks dari gambar (jika ada):
{image_text}
"""

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY','')}",
                "Content-Type": "application/json"
            },
            json={
                # model free yang stabil (hindari 404 choices error)
                "model": "meta-llama/llama-3.1-8b-instruct",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )

        data = r.json()

        # =========================
        # SAFE CHECK (biar tidak error 'choices')
        # =========================
        if "choices" in data:
            reply = data["choices"][0]["message"]["content"]
        else:
            return jsonify({"reply": f"❌ API Error: {data}"})

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
