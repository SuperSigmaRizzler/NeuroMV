from flask import Flask, render_template, request, jsonify
import os
import requests

app = Flask(__name__)

# API KEY GROQ
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# MODEL PALING STABLE SAAT INI
MODEL = "llama-3.1-8b-instant"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():

    msg = request.form.get("message", "")

    if not GROQ_API_KEY:
        return jsonify({"reply": "❌ API key belum di-set di server"})

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "user", "content": msg}
                ],
                "temperature": 0.7
            }
        )

        data = response.json()

        # SAFE CHECK biar gak error "choices"
        if "choices" in data:
            reply = data["choices"][0]["message"]["content"]
        else:
            return jsonify({"reply": f"❌ API Error: {data}"})

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Server Error: {str(e)}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
