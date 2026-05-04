from flask import Flask, render_template, request, jsonify
import requests, os, base64
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

    if not api_key:
        return jsonify({"reply":"API key belum terpasang."})

    msg = request.form.get("message","Jelaskan gambar ini dengan santai.")
    file = request.files.get("file")

    image_content = None

    if file:
        filename = secure_filename(file.filename)
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        with open(path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        image_content = {
            "type":"image_url",
            "image_url":{
                "url":f"data
            }
