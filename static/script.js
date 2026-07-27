const renderer = new marked.Renderer();
renderer.code = function(code, language) {
    const lang = (language || '').match(/\S*/)[0];
    const highlightedCode = lang && hljs.getLanguage(lang) 
        ? hljs.highlight(code, { language: lang }).value 
        : hljs.highlightAuto(code).value;
        
    return `<div class="code-block-wrapper">
        <div class="code-header">
            <span class="code-lang">${lang || 'code'}</span>
            <button class="copy-btn" onclick="copyCode(this)">
                <i class="fa-regular fa-copy"></i> Copy
            </button>
        </div>
        <pre><code class="hljs ${lang}">${highlightedCode}</code></pre>
    </div>`;
};

// Configure marked.js to use highlight.js and custom renderer
marked.setOptions({
    renderer: renderer
});

// Global function for copying code
window.copyCode = function(button) {
    const wrapper = button.closest('.code-block-wrapper');
    const code = wrapper.querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        const originalHtml = button.innerHTML;
        button.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        button.style.color = '#10b981';
        setTimeout(() => {
            button.innerHTML = originalHtml;
            button.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};

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
const isBoss = (name) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes('boss') || n.includes('บอส') || n.includes('admin') || name === '👑 Boss (Owner)';
};

function updateModelUI() {
    const modelSelect = document.getElementById('model-select');
    const attachBtn = document.querySelector('.attach-btn');
    if (!modelSelect) return;

    const opt11 = modelSelect.querySelector('option[value="1.1"]');
    if (opt11) {
        if (isBoss(currentUser)) {
            opt11.textContent = "Kira 1.1 👑 (Pro)";
        } else {
            opt11.textContent = "Kira 1.1 🔒";
        }
    }

    if (modelSelect.value === '1.1') {
        document.body.classList.add('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.add('unlocked');
            attachBtn.title = "แนบไฟล์ (Kira 1.1 Pro)";
        }
    } else {
        document.body.classList.remove('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.remove('unlocked');
            attachBtn.title = "แนบไฟล์ (ยังไม่รองรับใน 1.0)";
        }
    }
}

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
updateModelUI();

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
            updateModelUI();
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
    localStorage.removeItem('kira_username');
    currentUser = null;
    chatBox.innerHTML = '';
    chatHistorySidebar.innerHTML = '<p class="history-title">ยังไม่มีประวัติการแชท</p>';
    checkAuth();
    updateModelUI();
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
            
            // Show a single 'Current Chat' item instead of every message
            const div = document.createElement('div');
            div.className = 'history-item active';
            div.innerHTML = `<i class="fa-regular fa-message"></i> แชทปัจจุบัน (ห้องแชทหลัก)`;
            chatHistorySidebar.appendChild(div);
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
        content.innerHTML = text ? marked.parse(text) : '<span class="typing-cursor"></span>';
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatBox.appendChild(msgDiv);
    
    chatBox.scrollTop = chatBox.scrollHeight;
    return content;
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

    // Ensure sidebar has the active chat item if not already there
    if (!chatHistorySidebar.querySelector('.history-item.active')) {
        chatHistorySidebar.innerHTML = '<p class="history-title">ประวัติการแชท</p>';
        const div = document.createElement('div');
        div.className = 'history-item active';
        div.innerHTML = `<i class="fa-regular fa-message"></i> แชทปัจจุบัน (ห้องแชทหลัก)`;
        chatHistorySidebar.appendChild(div);
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;
    userInput.disabled = true;
    isGenerating = true;
    showTypingIndicator();

    try {
        const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "1.0";
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, username: currentUser, model_version: modelVersion })
        });

        hideTypingIndicator();
        
        if (!response.ok) {
            addMessage('ระบบขัดข้อง: เซิร์ฟเวอร์ตอบกลับผิดพลาด', false);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        const contentDiv = addMessage('', false);
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            fullText += decoder.decode(value, { stream: true });
            contentDiv.innerHTML = marked.parse(fullText);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
    } catch (error) {
        hideTypingIndicator();
        addMessage('ระบบขัดข้อง: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', false);
    } finally {
        isGenerating = false;
        userInput.disabled = false;
        userInput.focus();
        sendBtn.disabled = userInput.value.trim() === '';
    }
}

// --- Event Listeners ---
newChatBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/clear_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "", username: currentUser })
        });
    } catch(e) { console.error(e); }
    chatBox.innerHTML = ''; 
    addMessage(`สร้างหน้าต่างแชทใหม่แล้วค่ะคุณ ${currentUser}! วันนี้มีอะไรให้หนูช่วยไหมคะ?`, false);
    userInput.focus();
});

// Event Delegation for dynamic history items
chatHistorySidebar.addEventListener('click', (e) => {
    if (e.target.closest('.history-item')) {
        alert("ระบบแยกห้องแชทกำลังพัฒนาค่ะ ปัจจุบันระบบจะเป็นการแชทแบบต่อเนื่องนะคะ");
    }
});

const attachBtn = document.querySelector('.attach-btn');

// Create hidden file input if it doesn't exist
let hiddenFileInput = document.getElementById('kira-hidden-file-input');
if (!hiddenFileInput) {
    hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.id = 'kira-hidden-file-input';
    hiddenFileInput.style.display = 'none';
    document.body.appendChild(hiddenFileInput);
    
    // Listen for file selection
    hiddenFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            alert(`[Kira 1.1 Pro] รับทราบการอัปโหลดไฟล์: ${fileName}\n(ระบบประมวลผลไฟล์ส่วน Backend จะถูกเปิดให้ใช้งานเร็วๆ นี้ค่ะ)`);
            e.target.value = ''; // reset
        }
    });
}

if (attachBtn) {
    attachBtn.addEventListener('click', () => {
        const modelSelect = document.getElementById('model-select');
        if (modelSelect && modelSelect.value === '1.1') {
            // Trigger actual file picker for Boss!
            hiddenFileInput.click();
        } else {
            alert("ฟีเจอร์นี้สงวนไว้สำหรับ Kira 1.1 (Next-Gen) เท่านั้นค่ะ เนื่องจากสมอง 1.0 ไม่รองรับการมองเห็นภาพ!");
        }
    });
}

const btnTheme = document.getElementById('btn-theme');
if (btnTheme) {
    const isLightMode = localStorage.getItem('kira_theme') === 'light';
    if (isLightMode) {
        document.body.classList.add('light-mode');
        btnTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        if (document.body.classList.contains('light-mode')) {
            localStorage.setItem('kira_theme', 'light');
            btnTheme.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            localStorage.setItem('kira_theme', 'dark');
            btnTheme.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    });
}

const modelSelect = document.getElementById('model-select');
if (modelSelect) {
    // Restore previous selection if it's Boss
    const savedModel = localStorage.getItem('kira_model');
    if (savedModel && (savedModel === '1.0' || isBoss(currentUser))) {
        modelSelect.value = savedModel;
    }

    modelSelect.addEventListener('change', (e) => {
        if (e.target.value === '1.1') {
            if (!isBoss(currentUser)) {
                alert("Kira 1.1 กำลังอยู่ในช่วงการฝึกฝนแบบปิด (Private Beta) และจะเปิดให้ทุกคนร่วมทดสอบเร็วๆ นี้ค่ะ! ฝากติดตามด้วยนะคะ ✨");
                e.target.value = '1.0'; // Revert back
                localStorage.setItem('kira_model', '1.0');
            } else {
                localStorage.setItem('kira_model', '1.1');
            }
        } else {
            localStorage.setItem('kira_model', '1.0');
        }
        updateModelUI();
    });
}

const btnInfo = document.getElementById('btn-info');
if (btnInfo) {
    btnInfo.addEventListener('click', () => {
        alert("Kira AI - Public Cloud Engine\nเวอร์ชัน: 1.0 (ระบบทดสอบ)\nผู้สร้าง: Kira Studio");
    });
}

let isGenerating = false;

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (!isGenerating) {
        sendBtn.disabled = this.value.trim() === '';
    }
});

toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isGenerating) sendMessage();
    }
});

sendBtn.addEventListener('click', () => {
    if (!isGenerating) sendMessage();
});
sendBtn.disabled = true;
