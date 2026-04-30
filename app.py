from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

# 🔑 Ambil API key dari Railway
API_KEY = os.getenv("API_KEY")

# 🔥 DEBUG AWAL (cek di Logs Railway)
print("=== DEBUG START ===")
print("API_KEY:", API_KEY)
print("=== DEBUG END ===")

URL = "https://api.groq.com/openai/v1/chat/completions"

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message")

    # ❌ kalau API key belum kebaca
    if not API_KEY:
        return jsonify({"reply": "❌ API_KEY belum terbaca di server (cek Railway Variables)"})

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are NeuroMV. Reply naturally in user's language."},
            {"role": "user", "content": user_input}
        ]
    }

    try:
        r = requests.post(URL, headers=headers, json=payload)

        # 🔥 DEBUG STATUS
        print("STATUS CODE:", r.status_code)

        # ❌ kalau API error
        if r.status_code != 200:
            print("ERROR RESPONSE:", r.text)
            return jsonify({"reply": f"❌ API Error: {r.text}"})

        data = r.json()

        # 🔥 DEBUG RESPONSE
        print("RESPONSE:", data)

        # ❌ kalau format aneh
        if "choices" not in data:
            return jsonify({"reply": f"❌ Response tidak valid: {data}"})

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        print("SERVER ERROR:", str(e))
        return jsonify({"reply": f"❌ Server Error: {str(e)}"})


# 🔥 WAJIB UNTUK RAILWAY
port = int(os.environ.get("PORT", 3000))
app.run(host="0.0.0.0", port=port)
