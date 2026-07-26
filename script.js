// Configure marked.js to use highlight.js
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

// --- UI Elements ---
const authModal = document.getElementById('auth-modal');
const appContainer = document.getElementById('app-container');

// Auth Views
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const goToRegister = document.getElementById('go-to-register');
const goToLogin = document.getElementById('go-to-login');

// Login Elements
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

// Register Elements
const regUsernameInput = document.getElementById('reg-username');
const regPasswordInput = document.getElementById('reg-password');
const regConfirmInput = document.getElementById('reg-confirm');
const btnRegister = document.getElementById('btn-register');
const regError = document.getElementById('register-error');

// App Elements
const profileName = document.getElementById('profile-name');
const profilePic = document.getElementById('profile-pic');
const btnLogout = document.getElementById('btn-logout');
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const newChatBtn = document.querySelector('.new-chat-btn');
const chatHistorySidebar = document.getElementById('chat-history');

// --- Auth State Management ---
let currentUser = localStorage.getItem('kira_username');

function checkAuth() {
    // 👑 VIP Auto-Login for Owner (Localhost only)
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        if (!currentUser || currentUser === "👑 Boss (Owner)") {
            currentUser = "👑 Boss (Owner)";
            localStorage.setItem('kira_username', currentUser);
        }
    }

    if (currentUser) {
        authModal.style.display = 'none';
        appContainer.style.display = 'flex';
        profileName.textContent = currentUser;
        profilePic.src = `https://ui-avatars.com/api/?name=${currentUser}&background=0D8ABC&color=fff`;
        loadHistory();
    } else {
        authModal.style.display = 'flex';
        appContainer.style.display = 'none';
        loginView.style.display = 'block';
        registerView.style.display = 'none';
    }
}

// Check auth on load
checkAuth();

// --- Auth UI Toggles ---
goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    registerView.style.display = 'block';
    loginError.textContent = '';
});

goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerView.style.display = 'none';
    loginView.style.display = 'block';
    regError.textContent = '';
});

// --- Auth API Calls ---
btnLogin.addEventListener('click', async () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    
    if (!username || !password) {
        loginError.style.color = '#ef4444';
        loginError.textContent = "กรุณากรอกข้อมูลให้ครบถ้วน";
        return;
    }

    try {
        const response = await fetch(`/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.status === 'success') {
            localStorage.setItem('kira_username', data.username);
            currentUser = data.username;
            loginUsernameInput.value = '';
            loginPasswordInput.value = '';
            loginError.textContent = '';
            checkAuth();
        } else {
            loginError.style.color = '#ef4444';
            loginError.textContent = data.message;
        }
    } catch (err) {
        loginError.style.color = '#ef4444';
        loginError.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
    }
});

btnRegister.addEventListener('click', async () => {
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();
    const confirm = regConfirmInput.value.trim();
    
    if (!username || !password || !confirm) {
        regError.style.color = '#ef4444';
        regError.textContent = "กรุณากรอกข้อมูลให้ครบถ้วน";
        return;
    }

    if (password !== confirm) {
        regError.style.color = '#ef4444';
        regError.textContent = "รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง";
        return;
    }

    try {
        const response = await fetch(`/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.status === 'success') {
            regError.style.color = '#10b981';
            regError.textContent = "สมัครสมาชิกสำเร็จ! กำลังพากลับไปหน้าเข้าสู่ระบบ...";
            setTimeout(() => {
                registerView.style.display = 'none';
                loginView.style.display = 'block';
                loginUsernameInput.value = username; // Auto-fill username
                regUsernameInput.value = '';
                regPasswordInput.value = '';
                regConfirmInput.value = '';
                regError.textContent = '';
                loginError.style.color = '#10b981';
                loginError.textContent = "ลงทะเบียนเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ";
            }, 1500);
        } else {
            regError.style.color = '#ef4444';
            regError.textContent = data.message;
        }
    } catch (err) {
        regError.style.color = '#ef4444';
        regError.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
    }
});

btnLogout.addEventListener('click', () => {
    if (currentUser === "👑 Boss (Owner)") {
        alert("คำเตือน: คุณคือ VIP เจ้าของระบบ (Owner) ไม่สามารถออกจากระบบผ่านหน้าเว็บได้ครับ!");
        return;
    }
    localStorage.removeItem('kira_username');
    currentUser = null;
    chatBox.innerHTML = '';
    chatHistorySidebar.innerHTML = '<p class="history-title">ยังไม่มีประวัติการแชท</p>';
    checkAuth();
});

// --- Chat Logic ---
async function loadHistory() {
    try {
        const response = await fetch(`/api/history/${currentUser}`);
        const data = await response.json();
        
        chatBox.innerHTML = '';
        chatHistorySidebar.innerHTML = '<p class="history-title">ประวัติการแชท</p>';

        if (data.history.length === 0) {
            addMessage(`สวัสดีค่ะคุณ ${currentUser}! หนู Kira ยินดีต้อนรับนะคะ วันนี้มีอะไรให้หนูช่วยไหมคะ?`, false);
        } else {
            data.history.forEach(msg => {
                addMessage(msg.content, msg.role === 'User');
            });
            data.history.forEach(msg => {
                if (msg.role === 'User') {
                    const snippet = msg.content.substring(0, 20) + (msg.content.length > 20 ? '...' : '');
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `<i class="fa-regular fa-message"></i> ${snippet}`;
                    chatHistorySidebar.appendChild(div);
                }
            });
        }
    } catch (err) {
        console.error("Load history error:", err);
    }
}

function addMessage(text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? '' : '<i class="fa-solid fa-robot"></i>';

    const content = document.createElement('div');
    content.className = 'content';
    
    if (isUser) {
        content.textContent = text;
    } else {
        content.innerHTML = marked.parse(text);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatBox.appendChild(msgDiv);
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message ai typing';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="content typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatBox.appendChild(indicator);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !currentUser) return;

    addMessage(text, true);
    
    const snippet = text.substring(0, 20) + (text.length > 20 ? '...' : '');
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<i class="fa-regular fa-message"></i> ${snippet}`;
    chatHistorySidebar.appendChild(div);

    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, username: currentUser })
        });

        const data = await response.json();
        hideTypingIndicator();
        
        if (data.status === 'success') {
            addMessage(data.reply, false);
        } else {
            addMessage('Error: ' + data.reply, false);
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('ระบบขัดข้อง: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', false);
    }
}

// --- Event Listeners ---
newChatBtn.addEventListener('click', () => {
    chatBox.innerHTML = ''; 
    addMessage(`สร้างหน้าต่างแชทใหม่แล้วค่ะคุณ ${currentUser}! มีอะไรให้หนูช่วยไหมคะ?`, false);
    userInput.focus();
});

const btnInfo = document.getElementById('btn-info');
if (btnInfo) {
    btnInfo.addEventListener('click', () => {
        alert("Kira AI - Public Cloud Engine\nเวอร์ชัน: 1.0 (ระบบทดสอบ)\nผู้สร้าง: บอส");
    });
}

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    sendBtn.disabled = this.value.trim() === '';
});

toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);
sendBtn.disabled = true;
