from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

URL = "https://api.groq.com/openai/v1/chat/completions"

print("=== APP START ===")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    # ambil API key SAAT REQUEST
    api_key = os.getenv("API_KEY")

    print("REQUEST API_KEY EXISTS:", bool(api_key))

    user_input = request.json.get("message", "")

    if not api_key:
        return jsonify({"reply": "❌ API_KEY belum terbaca di server (runtime)"}), 200

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are NeuroMV. Reply naturally in the user's language."},
            {"role": "user", "content": user_input}
        ]
    }

    try:
        r = requests.post(URL, headers=headers, json=payload, timeout=30)
        print("STATUS:", r.status_code)
        print("TEXT:", r.text[:500])

        if r.status_code != 200:
            return jsonify({"reply": f"❌ API Error {r.status_code}: {r.text}"}), 200

        data = r.json()
        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply}), 200

    except Exception as e:
        print("EXCEPTION:", str(e))
        return jsonify({"reply": f"❌ Server Error: {str(e)}"}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
