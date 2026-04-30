from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

API_KEY = os.environ.get("API_KEY")

URL = "https://api.groq.com/openai/v1/chat/completions"

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message")

    if not API_KEY:
        return jsonify({"reply": "❌ API_KEY belum diset di Railway"})

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are NeuroMV. Reply naturally."},
            {"role": "user", "content": user_input}
        ]
    }

    try:
        r = requests.post(URL, headers=headers, json=payload)

        # 🔥 kalau status error
        if r.status_code != 200:
            return jsonify({"reply": f"❌ API Error: {r.text}"})

        data = r.json()

        # 🔥 validasi structure
        if "choices" not in data:
            return jsonify({"reply": f"❌ Response aneh: {data}"})

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Server Error: {str(e)}"})


# 🔥 WAJIB UNTUK RAILWAY
port = int(os.environ.get("PORT", 3000))
app.run(host="0.0.0.0", port=port)
