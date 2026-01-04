# app.py
# AI Voice Calling Agent - Hackathon Prototype

from flask import Flask, request

app = Flask(__name__)

@app.route("/voice", methods=["POST"])
def handle_call():
    return "AI Voice Agent Response"

if __name__ == "__main__":
    app.run(debug=True)
