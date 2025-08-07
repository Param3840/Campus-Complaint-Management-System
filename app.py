from flask import Flask, render_template, request, jsonify
import json
import os
from flask_cors import CORS
from datetime import datetime, timedelta
import jwt
from functools import wraps

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key_here'

DATA_FILE = 'complaints.json'
STUDENT_FILE = 'students.json'  # for registration

# Load static users (admins)
users = {
    'admins': {
        'admin': {'password': 'admin123', 'name': 'Yash Choubey'}
    }
}

@app.route('/')
def index():
    return render_template('index.html')

# Utilities for complaints

def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Utilities for students

def load_students():
    if not os.path.exists(STUDENT_FILE):
        return []
    with open(STUDENT_FILE, 'r') as f:
        return json.load(f)

def save_students(students):
    with open(STUDENT_FILE, 'w') as f:
        json.dump(students, f, indent=2)

# Auth Decorator

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
            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify({'status': 'error', 'message': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'status': 'error', 'message': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated

# 🔐 Login
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    role = data.get('role')
    user_id = data.get('id')
    password = data.get('password')

    if role == 'student':
        students = load_students()
        student = next((s for s in students if s['id'] == user_id and s['password'] == password), None)
        if student:
            token = jwt.encode({
                'id': student['id'],
                'name': student['name'],
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

# 🆕 Register student
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    student_id = data.get('id')
    password = data.get('password')

    if not all([name, student_id, password]):
        return jsonify({'status': 'fail', 'message': 'Missing fields'}), 400

    students = load_students()
    if any(s['id'] == student_id for s in students):
        return jsonify({'status': 'fail', 'message': 'Student ID already registered'}), 400

    students.append({
        'name': name,
        'id': student_id,

        'password': password
    })

    save_students(students)
    return jsonify({'status': 'success', 'message': 'Student registered successfully!'})

# 📥 Submit Complaint
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

# 📄 Get Complaints
@app.route('/get_complaints', methods=['GET'])
@token_required
def get_complaints():
    return jsonify(load_data())

# ✅ Resolve Complaint
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

# Run app
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
