from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    api_key = os.environ.get("API_KEY", "").strip()

    if not api_key:
        return jsonify({"reply": "❌ API_KEY belum terbaca"})

    msg = request.json.get("message", "")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": msg}
        ]
    }

    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=payload
    )

    data = r.json()
    reply = data["choices"][0]["message"]["content"]

    return jsonify({"reply": reply})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
