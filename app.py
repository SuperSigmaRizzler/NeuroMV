from flask import Flask, render_template, request, jsonify
import requests, os, base64
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    api_key = os.getenv("OPENROUTER_API_KEY","").strip()

    if not api_key:
        return jsonify({"reply":"❌ API key belum terbaca."})

    msg = request.form.get("message","Jelaskan gambar ini")
    file = request.files.get("file")

    if not file:
        return jsonify({"reply":"❌ Upload gambar dulu."})

    filename = secure_filename(file.filename)
    path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(path)

    with open(path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "meta-llama/llama-3.2-11b-vision-instruct:free",
        "messages": [
            {
                "role":"user",
                "content":[
                    {"type":"text","text":msg},
                    {
                        "type":"image_url",
                        "image_url":{
                            "url": f"data:image/jpeg;base64,{img_b64}"
                        }
                    }
                ]
            }
        ]
    }

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=90
        )

        data = r.json()
        print(data)

        if "choices" not in data:
            return jsonify({"reply": f"❌ API Error: {data}"})

        reply = data["choices"][0]["message"]["content"]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
