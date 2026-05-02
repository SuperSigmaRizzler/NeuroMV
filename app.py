from flask import Flask, request, jsonify, render_template
import requests
import os

# Ambil API key SEKALI saat server boot
API_KEY = os.getenv("API_KEY", "").strip()

print("=== APP BOOTING ===")
print("BOOT API_KEY =", repr(API_KEY))

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    print("=== CHAT REQUEST ===")

    # Kalau API key kosong
    if not API_KEY:
        return jsonify({
            "reply": "❌ API_KEY belum terbaca saat server boot"
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

        print("STATUS CODE =", r.status_code)
        print("RAW RESPONSE =", r.text)

        data = r.json()

        # Kalau Groq kirim error
        if "choices" not in data:
            return jsonify({
                "reply": f"❌ API Error: {data}"
            })

        reply = data["choices"][0]["message"]["content"]

        return jsonify({
            "reply": reply
        })

    except Exception as e:
        print("ERROR =", str(e))

        return jsonify({
            "reply": f"❌ AI error: {str(e)}"
        })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8080))
    )
