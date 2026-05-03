from flask import Flask, render_template, request, jsonify
import os
import requests

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    print("=== CHAT REQUEST ===")

    # Ambil API key saat request (lebih aman di Railway)
    API_KEY = os.getenv("API_KEY", "").strip()

    if not API_KEY:
        return jsonify({
            "reply": "❌ API_KEY belum terbaca di server"
        })

    # Ambil pesan user
    msg = request.json.get("message", "").strip()

    if not msg:
        return jsonify({
            "reply": "❌ Pesan kosong"
        })

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {
                "role": "user",
                "content": msg
            }
        ]
    }

    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        data = r.json()

        if "choices" not in data:
            return jsonify({
                "reply": f"❌ API Error: {data}"
            })

        reply = data["choices"][0]["message"]["content"]

        return jsonify({
            "reply": reply
        })

    except Exception as e:
        return jsonify({
            "reply": f"❌ AI Error: {str(e)}"
        })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
