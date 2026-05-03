from flask import Flask, jsonify, request
import os
import requests

app = Flask(__name__)

@app.route("/")
def home():
    return "NeuroMV online 🚀"

@app.route("/chat", methods=["POST"])
def chat():
    API_KEY = os.getenv("API_KEY", "").strip()

    if not API_KEY:
        return jsonify({
            "reply": "❌ API_KEY tidak terbaca"
        })

    data = request.get_json(silent=True) or {}
    msg = data.get("message", "").strip()

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
            {"role": "user", "content": msg}
        ]
    }

    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        result = r.json()

        if "choices" not in result:
            return jsonify({
                "reply": f"❌ API Error: {result}"
            })

        reply = result["choices"][0]["message"]["content"]

        return jsonify({
            "reply": reply
        })

    except Exception as e:
        return jsonify({
            "reply": f"❌ Error: {str(e)}"
        })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
