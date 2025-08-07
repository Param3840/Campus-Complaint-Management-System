let currentUser = null;
let userType = null;
let allComplaints = [];
const API_BASE = "https://campus-complaint-management-system.onrender.com";

window.addEventListener('DOMContentLoaded', () => {
    setupDarkMode();
    setupLoginForms();
    setupFilters();
    setupLogout();
    setupComplaintSubmit();
    setupViewToggles();
    setupRegistration();
    tryAutoLogin();
});

function getToken() {
    return localStorage.getItem('token');
}

function tryAutoLogin() {
    const token = getToken();
    if (!token) return;

    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
        localStorage.removeItem('token');
        return;
    }

    currentUser = { id: payload.id, name: payload.name };
    userType = payload.role;
    showMainApp();
}

function setupViewToggles() {
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');

    document.getElementById('goToRegisterBtn')?.addEventListener('click', () => {
        loginPage.classList.add('hidden');
        registerPage.classList.remove('hidden');
    });

    document.getElementById('goToLoginBtn')?.addEventListener('click', () => {
        registerPage.classList.add('hidden');
        loginPage.classList.remove('hidden');
    });
}

function setupLoginForms() {
    document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('studentLoginId').value;
        const password = document.getElementById('studentPassword').value;

        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'student', id, password })
        });

        const data = await res.json();
        if (data.status === 'success') {
            localStorage.setItem('token', data.token);
            tryAutoLogin();
        } else {
            alert(data.message || "Invalid student login");
        }
    });

    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'admin', id, password })
        });

        const data = await res.json();
        if (data.status === 'success') {
            localStorage.setItem('token', data.token);
            tryAutoLogin();
        } else {
            alert(data.message || "Invalid admin login");
        }
    });

    document.getElementById('studentLoginBtn').addEventListener('click', () => {
        document.getElementById('studentLoginForm').classList.remove('hidden');
        document.getElementById('adminLoginForm').classList.add('hidden');
    });

    document.getElementById('adminLoginBtn').addEventListener('click', () => {
        document.getElementById('adminLoginForm').classList.remove('hidden');
        document.getElementById('studentLoginForm').classList.add('hidden');
    });
}

function setupRegistration() {
    document.getElementById('studentRegisterForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('regStudentName').value.trim();
        const id = document.getElementById('regStudentId').value.trim();
        const password = document.getElementById('regStudentPassword').value;
        const confirmPassword = document.getElementById('regStudentConfirmPassword').value;

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, id, password })
        });

        const data = await res.json();
        if (data.status === 'success') {
            alert("Registered successfully! You can now login.");
            document.getElementById('goToLoginBtn').click();
            document.getElementById('studentRegisterForm').reset();
        } else {
            alert(data.message || "Registration failed.");
        }
    });
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('registerPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');

    const welcome = document.getElementById('welcomeMessage');
    welcome.textContent = `Welcome, ${currentUser.name} (${currentUser.id})`;

    if (userType === 'student') {
        document.getElementById('studentPortal').classList.remove('hidden');
        document.getElementById('adminPortal').classList.add('hidden');
        document.getElementById('studentId').value = currentUser.id;
    } else {
        document.getElementById('adminPortal').classList.remove('hidden');
        document.getElementById('studentPortal').classList.add('hidden');
    }

    loadComplaints();
}

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        location.reload();
    });
}

function setupComplaintSubmit() {
    document.getElementById('complaintForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            studentName: document.getElementById('studentName').value,
            category: document.getElementById('category').value,
            description: document.getElementById('complaintText').value
        };

        const res = await fetch(`${API_BASE}/submit_complaint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.status === 'success') {
            document.getElementById('complaintForm').reset();
            document.getElementById('studentId').value = currentUser.id;
            loadComplaints();
            alert("Complaint submitted!");
        } else {
            alert(result.message || "Error");
        }
    });
}

async function loadComplaints() {
    const res = await fetch(`${API_BASE}/get_complaints`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (res.status === 401) {
        alert("Session expired. Please log in again.");
        localStorage.removeItem('token');
        location.reload();
        return;
    }

    allComplaints = await res.json();

    if (userType === 'student') renderStudentComplaints();
    else {
        renderAdminComplaints();
        updateStats();
    }
}

function renderStudentComplaints() {
    const container = document.getElementById('studentComplaints');
    const my = allComplaints.filter(c => c.studentId === currentUser.id);
    if (my.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-center">No complaints yet</p>`;
        return;
    }

    container.innerHTML = my.map(c => `
        <div class="border rounded p-3 dark:bg-gray-800">
            <div class="flex justify-between">
                <span class="text-sm font-medium text-gray-800 dark:text-white">#${c.id}</span>
                <span class="text-xs ${c.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'}">
                    ${c.status}
                </span>
            </div>
            <div class="font-semibold text-gray-800 dark:text-white">${c.category}</div>
            <p class="text-sm text-gray-700 dark:text-white">${c.description}</p>
            <div class="text-xs text-gray-500 dark:text-gray-300">
                Submitted: ${c.submittedAt}${c.resolvedAt ? ` | Resolved: ${c.resolvedAt}` : ''}
            </div>
        </div>
    `).join('');
}

function renderAdminComplaints() {
    const container = document.getElementById('adminComplaints');
    const status = document.getElementById('statusFilter').value;
    const category = document.getElementById('categoryFilter').value;

    let filtered = [...allComplaints];
    if (status !== 'all') filtered = filtered.filter(c => c.status === status);
    if (category !== 'all') filtered = filtered.filter(c => c.category === category);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-center">No complaints to show</p>`;
        return;
    }

    container.innerHTML = filtered.map(c => `
        <div class="border rounded p-3 dark:bg-gray-800">
            <div class="flex justify-between">
                <div>
                    <strong class="text-gray-800 dark:text-white">${c.studentName}</strong>
                    <span class="text-gray-600 dark:text-gray-300">(${c.studentId})</span><br>
                    <span class="text-sm text-gray-700 dark:text-white">
                        ${c.category} - ${c.description}
                    </span>
                </div>
                <div class="text-right">
                    <span class="text-xs ${c.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'}">${c.status}</span><br>
                    ${c.status === 'pending' ? `<button onclick="resolveComplaint(${c.id})" class="text-xs bg-green-500 text-white rounded px-2 py-1 mt-1 hover:bg-green-600 transition">
                        Resolve
                    </button>` : ''}
                </div>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Submitted: ${c.submittedAt}${c.resolvedAt ? ` | Resolved: ${c.resolvedAt}` : ''}
            </div>
        </div>
    `).join('');
}

async function resolveComplaint(id) {
    const res = await fetch(`${API_BASE}/resolve_complaint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ id })
    });

    const data = await res.json();
    if (data.status === 'success') {
        loadComplaints();
        alert("Marked as resolved");
    }
}

function updateStats() {
    document.getElementById('totalComplaints').textContent = allComplaints.length;
    document.getElementById('pendingComplaints').textContent = allComplaints.filter(c => c.status === 'pending').length;
    document.getElementById('resolvedComplaints').textContent = allComplaints.filter(c => c.status === 'resolved').length;
}

function setupFilters() {
    document.getElementById('statusFilter').addEventListener('change', renderAdminComplaints);
    document.getElementById('categoryFilter').addEventListener('change', renderAdminComplaints);
}

function setupDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const icon = document.getElementById('darkModeIcon');
    if (localStorage.getItem('darkMode') === 'true') {
        document.documentElement.classList.add('dark');
        icon.textContent = '☀️';
    }

    toggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        icon.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('darkMode', isDark);
    });
}
