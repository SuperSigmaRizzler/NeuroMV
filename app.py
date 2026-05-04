from flask import Flask, render_template, request, jsonify
import os
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
    msg = request.form.get("message", "").strip()
    file = request.files.get("file")

    if file and file.filename:
        filename = secure_filename(file.filename)
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        try:
            img = Image.open(path)
            text = pytesseract.image_to_string(img)

            if text.strip():
                return jsonify({
                    "reply": "📸 Teks pada gambar:\n\n" + text
                })
            else:
                return jsonify({
                    "reply": "📸 Gambar diterima, tapi tidak ada teks terdeteksi."
                })

        except Exception as e:
            return jsonify({
                "reply": f"❌ Gagal membaca gambar: {str(e)}"
            })

    if msg:
        return jsonify({
            "reply": "Kamu bilang: " + msg
        })

    return jsonify({
        "reply":"❌ Tidak ada input"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
