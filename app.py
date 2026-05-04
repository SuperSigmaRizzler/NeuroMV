from flask import Flask, render_template, request, jsonify, session
import requests, os, base64
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = "neuromv_secret_key"

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    api_key = os.getenv("OPENROUTER_API_KEY","").strip()

    if not api_key:
        return jsonify({"reply":"❌ API key belum kebaca"})

    msg = request.form.get("message","")
    file = request.files.get("file")

    if "history" not in session:
        session["history"] = []

    history = session["history"]

    content = []

    if msg:
        content.append({"type":"text","text":msg})

    if file:
        filename = secure_filename(file.filename)
        path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(path)

        with open(path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        content.append({
            "type":"image_url",
            "image_url":{
                "url":f"data:image/jpeg;base64,{img_b64}"
            }
        })

    history.append({
        "role":"user",
        "content": content
    })

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {
                "role":"system",
                "content":"Kamu adalah NeuroMV, AI santai, gaul, ngobrol kayak temen."
            }
        ] + history[-10:]
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=90
        )

        data = r.json()

        if "choices" not in data:
            return jsonify({"reply": f"❌ API Error: {data}"})

        reply = data["choices"][0]["message"]["content"]

        history.append({
            "role":"assistant",
            "content": reply
        })

        session["history"] = history

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"})

@app.route("/clear", methods=["POST"])
def clear():
    session.pop("history", None)
    return jsonify({"status":"cleared"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
