from flask import Flask, render_template, request, jsonify
import os, requests
from PIL import Image
import pytesseract
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():

    msg = request.form.get("message", "")
    file = request.files.get("file")

    if not GROQ_API_KEY:
        return jsonify({"reply": "❌ API key belum di-set"})

    extracted_text = ""

    # =====================
    # 🖼️ OCR MODE
    # =====================
    if file:
        try:
            filename = secure_filename(file.filename)
            path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(path)

            img = Image.open(path)

            extracted_text = pytesseract.image_to_string(img)

        except Exception as e:
            return jsonify({"reply": f"❌ OCR Error: {str(e)}"})

    # =====================
    # 🧠 FINAL MESSAGE
    # =====================
    final_prompt = ""

    if extracted_text:
        final_prompt = f"""
Ini hasil OCR dari gambar:

{extracted_text}

Jelaskan dengan santai dan mudah dimengerti.
"""
    else:
        final_prompt = msg

    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {"role": "user", "content": final_prompt}
                ],
                "temperature": 0.7
            },
            timeout=60
        )

        data = r.json()

        if "choices" not in data:
            return jsonify({"reply": f"❌ API Error: {data}"})

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Server Error: {str(e)}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
