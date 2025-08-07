from flask import Flask, render_template, request, jsonify
import json
import os
from flask_cors import CORS
from datetime import datetime, timedelta
import jwt
from functools import wraps

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key_here'  # Change this in real app

DATA_FILE = 'complaints.json'

users = {
    'students': {
        'ST001': {'password': 'student123', 'name': 'Paramveer Kumar Singh'},
        'ST002': {'password': 'student123', 'name': 'Ankit Singh'},
        'ST003': {'password': 'student123', 'name': 'Rishi Raj Verma'}
    },
    'admins': {
        'admin': {'password': 'admin123', 'name': 'Yash Choubey'}
    }
}

@app.route('/')
def index():
    return render_template('index.html')

# Utility functions
def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Token Required Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            bearer = request.headers['Authorization']
            if bearer.startswith("Bearer "):
                token = bearer.split(" ")[1]

        if not token:
            return jsonify({'status': 'error', 'message': 'Token missing'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            request.user = data  # attach decoded user info
        except jwt.ExpiredSignatureError:
            return jsonify({'status': 'error', 'message': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'status': 'error', 'message': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated

# Login route
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    role = data.get('role')
    user_id = data.get('id')
    password = data.get('password')

    if role == 'student':
        user = users['students'].get(user_id)
        if user and user['password'] == password:
            token = jwt.encode({
                'id': user_id,
                'name': user['name'],
                'role': 'student',
                'exp': datetime.utcnow() + timedelta(hours=2)
            }, app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({'status': 'success', 'token': token})
    elif role == 'admin':
        user = users['admins'].get(user_id)
        if user and user['password'] == password:
            token = jwt.encode({
                'id': user_id,
                'name': user['name'],
                'role': 'admin',
                'exp': datetime.utcnow() + timedelta(hours=2)
            }, app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({'status': 'success', 'token': token})

    return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401

# Get complaints
@app.route('/get_complaints', methods=['GET'])
@token_required
def get_complaints():
    return jsonify(load_data())

# Submit complaint
@app.route('/submit_complaint', methods=['POST'])
@token_required
def submit_complaint():
    data = request.json
    user = request.user

    complaints = load_data()
    new_id = max([c["id"] for c in complaints], default=0) + 1

    complaint = {
        "id": new_id,
        "studentName": data.get("studentName"),
        "studentId": user["id"],
        "category": data.get("category"),
        "description": data.get("description"),
        "status": "pending",
        "submittedAt": datetime.now().strftime("%d/%m/%Y"),
        "resolvedAt": None
    }

    complaints.append(complaint)
    save_data(complaints)
    return jsonify({'status': 'success'})

# Resolve complaint
@app.route('/resolve_complaint', methods=['POST'])
@token_required
def resolve_complaint():
    complaint_id = request.json.get('id')
    complaints = load_data()
    for c in complaints:
        if c['id'] == complaint_id:
            c['status'] = 'resolved'
            c['resolvedAt'] = datetime.now().strftime("%d/%m/%Y")
            break
    save_data(complaints)
    return jsonify({'status': 'success'})

import os

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
