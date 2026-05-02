from flask import Flask, request, jsonify, render_template
import requests
import os

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    # Ambil API_KEY dari Railway Variables setiap request
    api_key = os.environ.get("API_KEY", "").strip()

    # Debug ke logs Railway
    print("=== CHAT REQUEST ===")
    print("API_KEY VALUE:", api_key)
    print("API_KEY LENGTH:", len(api_key))

    # Kalau kosong
    if not api_key:
        return jsonify({
            "reply": "❌ API_KEY belum terbaca di server (runtime)"
        })

    # Ambil pesan user
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

    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )

        print("STATUS CODE:", r.status_code)
        print("RAW RESPONSE:", r.text)

        data = r.json()

        reply = data["choices"][0]["message"]["content"]

        return jsonify({
            "reply": reply
        })

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({
            "reply": f"❌ AI error: {str(e)}"
        })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8080))
    )
