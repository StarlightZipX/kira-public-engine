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
    renderer: renderer,
    gfm: true,
    breaks: true
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

// Global function for password visibility toggle
window.togglePasswordVisibility = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
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
const regNicknameInput = document.getElementById('reg-nickname');
const regPasswordInput = document.getElementById('reg-password');
const regConfirmInput = document.getElementById('reg-confirm');
const regTermsInput = document.getElementById('reg-terms');
const btnRegister = document.getElementById('btn-register');
const regError = document.getElementById('register-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const strengthContainer = document.getElementById('strength-container');
const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');
const matchStatusIcon = document.getElementById('match-status-icon');

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
let isGenerating = false;
let currentImageBase64 = null;


const isBoss = (name) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes('boss') || n.includes('บอส') || n.includes('admin') || name === '👑 Boss (Owner)';
};

function updateModelUI() {
    const modelSelect = document.getElementById('model-select');
    const attachBtn = document.getElementById('attach-toggle-btn') || document.querySelector('.attach-btn');
    if (!modelSelect) return;

    const val = modelSelect.value;
    const subModelContainer = document.getElementById('sub-model-container');

    // Advanced models (all 2.0 series and legacy 1.1, 1.2, 1.3)
    const isAdvanced = val !== '1.0';

    if (isAdvanced) {
        document.body.classList.add('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.add('unlocked');
            attachBtn.title = "แนบไฟล์ / รูปภาพ (Kira Multimodal)";
        }
    } else {
        document.body.classList.remove('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.remove('unlocked');
            attachBtn.title = "แนบไฟล์ (รองรับใน 1.1 หรือ 2.0 ขึ้นไป)";
        }
    }

    // Toggle Sub-model UI with Animation for all modern/advanced versions
    if (subModelContainer) {
        if (isAdvanced) {
            subModelContainer.style.maxHeight = '50px';
            subModelContainer.style.opacity = '1';
            subModelContainer.style.padding = '8px 15px';
            subModelContainer.style.borderBottom = '1px solid #334155';
        } else {
            subModelContainer.style.maxHeight = '0';
            subModelContainer.style.opacity = '0';
            subModelContainer.style.padding = '0 15px';
            subModelContainer.style.borderBottom = '1px solid transparent';
        }
    }
}

function checkAuth() {
    const storedUser = localStorage.getItem('kira_username') || localStorage.getItem('kira_user');
    const isExplicitlyLoggedOut = localStorage.getItem('kira_logged_out') === 'true';

    // 👑 VIP Auto-Login for Owner only on initial visit (if user has not explicitly clicked Logout)
    if ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && !storedUser && !isExplicitlyLoggedOut) {
        currentUser = "👑 Boss (Owner)";
        localStorage.setItem('kira_username', currentUser);
    } else {
        currentUser = storedUser;
    }

    if (currentUser) {
        localStorage.removeItem('kira_logged_out');
        authModal.style.display = 'none';
        appContainer.style.display = 'flex';
        profileName.textContent = currentUser;
        const customAvatar = localStorage.getItem('kira_avatar');
        if (customAvatar) {
            profilePic.src = customAvatar;
        } else {
            profilePic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=0D8ABC&color=fff`;
        }
        loadHistory();
        loadUserProfile();
    } else {
        authModal.style.display = 'flex';
        appContainer.style.display = 'none';
        loginView.style.display = 'block';
        registerView.style.display = 'none';
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`/api/user/profile/${encodeURIComponent(currentUser)}`);
        const data = await response.json();
        if (data.status === 'success') {
            profileName.textContent = currentUser;
        }
        
        // Fetch Quota
        const qRes = await fetch(`/api/user/quota/${encodeURIComponent(currentUser)}`);
        const qData = await qRes.json();
        const quotaBadge = document.getElementById('user-quota-badge');
        const quotaText = document.getElementById('quota-text');
        if (quotaBadge && quotaText && qData.status === 'success') {
            quotaText.textContent = qData.badge;
            if (qData.is_boss) {
                quotaBadge.style.color = '#f59e0b';
                quotaBadge.style.background = 'rgba(245, 158, 11, 0.15)';
                quotaBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
            }
        }
    } catch (e) {
        console.error("Profile fetch error:", e);
    }
}

async function checkEngineStatus() {
    const badge = document.getElementById('engine-status-badge');
    if (!badge) return;
    try {
        const res = await fetch('/api/ollama/status');
        const data = await res.json();
        if (data.status === 'online' && data.models && data.models.length > 0) {
            badge.innerHTML = `<span class="pulse-dot local"></span><span class="engine-text">Local GPU (${data.models[0]})</span>`;
            badge.title = `เชื่อมต่อกับ Local GPU สำเร็จ (Ollama: ${data.models.join(', ')})`;
        } else {
            badge.innerHTML = `<span class="pulse-dot cloud"></span><span class="engine-text">Cloud Swarm 2.1</span>`;
            badge.title = "ประมวลผลผ่านโครงข่าย Supercluster Cloud Multi-Brain";
        }
    } catch (e) {
        badge.innerHTML = `<span class="pulse-dot cloud"></span><span class="engine-text">Cloud Swarm 2.1</span>`;
    }
}

// --- Neural Core Connection & Cold-Start Supervisor ---
let isCoreWaking = false;

function showConnectionToast(text, type = 'waking') {
    const toast = document.getElementById('kira-connection-toast');
    const toastText = document.getElementById('kira-toast-text');
    if (!toast || !toastText) return;
    
    toastText.textContent = text;
    toast.className = `kira-connection-toast ${type}`;
}

function hideConnectionToast(delayMs = 2500) {
    const toast = document.getElementById('kira-connection-toast');
    if (!toast) return;
    setTimeout(() => {
        toast.classList.add('hidden');
    }, delayMs);
}

async function checkNeuralCoreHealth(isInitial = false) {
    const startTime = Date.now();
    let showTimer = null;
    
    if (isInitial) {
        showTimer = setTimeout(() => {
            isCoreWaking = true;
            showConnectionToast('⚡ กำลังเชื่อมต่อ Kira Neural Core บน Cloud... (กำลังปลุกระบบ 5-10s)', 'waking');
        }, 1800);
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (showTimer) clearTimeout(showTimer);
        
        if (res.ok) {
            const data = await res.json();
            if (isCoreWaking || (Date.now() - startTime > 2000)) {
                showConnectionToast('✨ Kira Neural Core เชื่อมต่อสำเร็จ พร้อมใช้งาน!', 'ready');
                hideConnectionToast(2500);
                isCoreWaking = false;
            }
            return true;
        }
    } catch (e) {
        if (showTimer) clearTimeout(showTimer);
        console.log("Core wakeup ping notice:", e);
    }
    return false;
}

// --- Check for OAuth Return Errors ---
try {
    const urlParams = new URLSearchParams(window.location.search);
    const authErr = urlParams.get('auth_error');
    if (authErr) {
        if (loginError) {
            loginError.style.color = '#f87171';
            loginError.textContent = `❌ เข้าสู่ระบบไม่สำเร็จ: ${authErr}`;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
} catch (e) {
    console.warn("Auth error check notice:", e);
}

// Check auth on load
checkNeuralCoreHealth(true);
checkAuth();
updateModelUI();
checkEngineStatus();
initProactiveHeartbeat();
initLiveScreenInspector();
setInterval(checkEngineStatus, 30000);
setInterval(() => checkNeuralCoreHealth(false), 240000); // 4-min Keepalive Heartbeat

// --- Auth UI Toggles & Tabs ---
function switchAuthTab(tab) {
    if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (loginView) loginView.style.display = 'flex';
        if (registerView) registerView.style.display = 'none';
        if (loginError) loginError.textContent = '';
        if (loginUsernameInput) loginUsernameInput.focus();
    } else {
        if (tabRegister) tabRegister.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (registerView) registerView.style.display = 'flex';
        if (loginView) loginView.style.display = 'none';
        if (regError) regError.textContent = '';
        if (regUsernameInput) regUsernameInput.focus();
    }
}

if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('register');
    });
}

if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('login');
    });
}

// --- Purpose Selector Pills ---
let selectedPurpose = 'coding';
const purposePills = document.querySelectorAll('.purpose-pill');
purposePills.forEach(pill => {
    pill.addEventListener('click', () => {
        purposePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedPurpose = pill.dataset.purpose || 'general';
    });
});

// --- Password Strength Meter ---
function calculatePasswordStrength(password) {
    if (!password) return { score: 0, text: '', color: '', width: '0%' };
    let score = 0;
    if (password.length >= 4) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
        return { score: 1, text: 'ความปลอดภัย: ต่ำ (Weak)', color: '#ef4444', width: '33%' };
    } else if (score <= 3) {
        return { score: 2, text: 'ความปลอดภัย: ปานกลาง (Medium)', color: '#f59e0b', width: '66%' };
    } else {
        return { score: 3, text: 'ความปลอดภัย: แข็งแกร่ง (Strong) 🛡️', color: '#10b981', width: '100%' };
    }
}

if (regPasswordInput && strengthContainer && strengthBar && strengthText) {
    regPasswordInput.addEventListener('input', () => {
        const val = regPasswordInput.value;
        if (!val) {
            strengthContainer.style.display = 'none';
            return;
        }
        strengthContainer.style.display = 'flex';
        const res = calculatePasswordStrength(val);
        strengthBar.style.width = res.width;
        strengthBar.style.backgroundColor = res.color;
        strengthText.textContent = res.text;
        strengthText.style.color = res.color;
        checkPasswordMatch();
    });
}

// --- Real-time Password Confirmation Match Checker ---
function checkPasswordMatch() {
    if (!regConfirmInput || !matchStatusIcon) return;
    const p1 = regPasswordInput ? regPasswordInput.value : '';
    const p2 = regConfirmInput.value;
    if (!p2) {
        matchStatusIcon.innerHTML = '';
        return;
    }
    if (p1 === p2) {
        matchStatusIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #10b981;" title="รหัสผ่านตรงกัน"></i>';
    } else {
        matchStatusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;" title="รหัสผ่านไม่ตรงกัน"></i>';
    }
}

if (regConfirmInput) {
    regConfirmInput.addEventListener('input', checkPasswordMatch);
}

// --- Interactive Mouse Spotlight Effect on Auth Card ---
const authBoxElement = document.getElementById('auth-box');
if (authBoxElement) {
    authBoxElement.addEventListener('mousemove', (e) => {
        const rect = authBoxElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        authBoxElement.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(56, 189, 248, 0.12) 0%, rgba(30, 41, 59, 0.85) 45%, rgba(15, 23, 42, 0.92) 100%)`;
    });
    authBoxElement.addEventListener('mouseleave', () => {
        authBoxElement.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.92) 100%)';
    });
}

// --- Keyboard Enter Navigation ---
[loginUsernameInput, loginPasswordInput].forEach(input => {
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnLogin.click();
            }
        });
    }
});

[regUsernameInput, regNicknameInput, regPasswordInput, regConfirmInput].forEach(input => {
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnRegister.click();
            }
        });
    }
});

// --- Auth API Calls ---
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        
        if (!username || !password) {
            loginError.style.color = '#f87171';
            loginError.textContent = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วนค่ะ";
            return;
        }

        const originalText = btnLogin.innerHTML;
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';

        const coldStartTimer = setTimeout(() => {
            btnLogin.innerHTML = '<i class="fa-solid fa-bolt fa-fade" style="color: #f59e0b;"></i> กำลังปลุกระบบ Cloud...';
            showConnectionToast('⚡ เซิร์ฟเวอร์กำลังตื่นจากการหลับ (Cold Start) กรุณารอสักครู่...', 'waking');
        }, 2200);

        try {
            const response = await fetch(`/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            clearTimeout(coldStartTimer);
            const data = await response.json();

            if (data.status === 'success') {
                localStorage.setItem('kira_username', data.username);
                if (data.token) {
                    localStorage.setItem('kira_auth_token', data.token);
                }
                localStorage.removeItem('kira_logged_out');
                currentUser = data.username;
                loginUsernameInput.value = '';
                loginPasswordInput.value = '';
                loginError.textContent = '';
                hideConnectionToast(500);
                checkAuth();
                updateModelUI();
            } else {
                loginError.style.color = '#f87171';
                loginError.textContent = data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องค่ะ";
            }
        } catch (err) {
            clearTimeout(coldStartTimer);
            loginError.style.color = '#f87171';
            loginError.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง";
        } finally {
            clearTimeout(coldStartTimer);
            btnLogin.disabled = false;
            btnLogin.innerHTML = originalText;
        }
    });
}

if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const username = regUsernameInput.value.trim();
        const nickname = regNicknameInput ? regNicknameInput.value.trim() : '';
        const password = regPasswordInput.value.trim();
        const confirm = regConfirmInput.value.trim();
        const termsChecked = regTermsInput ? regTermsInput.checked : true;
        
        if (!username || !password || !confirm) {
            regError.style.color = '#f87171';
            regError.textContent = "กรุณากรอกข้อมูลให้ครบทุกช่องค่ะ";
            return;
        }

        if (username.length < 3) {
            regError.style.color = '#f87171';
            regError.textContent = "ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษรค่ะ";
            return;
        }

        if (password.length < 4) {
            regError.style.color = '#f87171';
            regError.textContent = "รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษรค่ะ";
            return;
        }

        if (password !== confirm) {
            regError.style.color = '#f87171';
            regError.textContent = "รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้งค่ะ";
            return;
        }

        if (!termsChecked) {
            regError.style.color = '#f87171';
            regError.textContent = "กรุณากดยอมรับข้อตกลงและเงื่อนไขการใช้งานค่ะ";
            return;
        }

        const originalText = btnRegister.innerHTML;
        btnRegister.disabled = true;
        btnRegister.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างบัญชี...';

        const coldStartTimer = setTimeout(() => {
            btnRegister.innerHTML = '<i class="fa-solid fa-bolt fa-fade" style="color: #f59e0b;"></i> กำลังปลุกระบบ Cloud...';
            showConnectionToast('⚡ เซิร์ฟเวอร์กำลังตื่นจากการหลับ (Cold Start) กรุณารอสักครู่...', 'waking');
        }, 2200);

        try {
            const response = await fetch(`/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    nickname: nickname || username,
                    purpose: selectedPurpose || 'general' 
                })
            });
            clearTimeout(coldStartTimer);
            const data = await response.json();

            if (data.status === 'success') {
                regError.style.color = '#34d399';
                regError.textContent = "✨ สมัครสมาชิกสำเร็จ! กำลังพากลับไปหน้าเข้าสู่ระบบ...";
                hideConnectionToast(500);
                setTimeout(() => {
                    switchAuthTab('login');
                    loginUsernameInput.value = username; // Auto-fill username
                    regUsernameInput.value = '';
                    if (regNicknameInput) regNicknameInput.value = '';
                    regPasswordInput.value = '';
                    regConfirmInput.value = '';
                    regError.textContent = '';
                    if (strengthContainer) strengthContainer.style.display = 'none';
                    if (matchStatusIcon) matchStatusIcon.innerHTML = '';
                    loginError.style.color = '#34d399';
                    loginError.textContent = "ลงทะเบียนเรียบร้อยแล้ว กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบค่ะ";
                    if (loginPasswordInput) loginPasswordInput.focus();
                }, 1200);
            } else {
                regError.style.color = '#f87171';
                regError.textContent = data.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก";
            }
        } catch (err) {
            clearTimeout(coldStartTimer);
            regError.style.color = '#f87171';
            regError.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง";
        } finally {
            clearTimeout(coldStartTimer);
            btnRegister.disabled = false;
            btnRegister.innerHTML = originalText;
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('kira_username');
        localStorage.removeItem('kira_auth_token');
        localStorage.removeItem('kira_user');
        localStorage.removeItem('kira_token');
        localStorage.removeItem('kira_avatar');
        localStorage.setItem('kira_logged_out', 'true');
        currentUser = null;
        chatBox.innerHTML = '';
        chatHistorySidebar.innerHTML = '<p class="history-title">ยังไม่มีประวัติการแชท</p>';
        checkAuth();
        updateModelUI();
    });
}

// --- Chat Logic ---
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Kira 2.2 Proactive Heartbeat & Briefing Suite ---
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

let latestBriefingData = null;
let lastUserActivityTime = Date.now();
let proactiveToastDismissed = false;

async function loadProactiveBriefing() {
    if (!currentUser) return null;
    try {
        const token = localStorage.getItem('kira_auth_token') || '';
        const url = `/api/user/briefing/${encodeURIComponent(currentUser)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                latestBriefingData = data;
                return data;
            }
        }
    } catch (err) {
        console.warn("Proactive briefing fetch notice:", err);
    }
    return null;
}

async function renderWelcomeHub() {
    chatBox.innerHTML = `
        <div class="welcome-hero-card">
            <div class="welcome-meta-bar">
                <span class="welcome-time-tag" style="border-color: rgba(244,63,94,0.3); color:#fda4af;">
                    <i class="fa-solid fa-heart-pulse heartbeat-icon" style="color:#f43f5e;"></i> Kira Proactive Heartbeat
                </span>
            </div>
            <div class="welcome-header">
                <img src="/static/images/kira_logo.png?v=6" alt="Kira Logo">
                <div style="flex: 1;">
                    <h3 class="welcome-title">สวัสดีค่ะคุณ ${escapeHtml(currentUser || 'ผู้ใช้')}! 🌸</h3>
                    <p class="welcome-subtitle">กำลังประมวลผลบริบทและสังเคราะห์คำทักทายเชิงรุก...</p>
                </div>
            </div>
        </div>
    `;

    const briefing = await loadProactiveBriefing();
    const data = briefing || {
        greeting_title: `สวัสดีค่ะคุณ ${currentUser || 'ผู้ใช้'}! 🌸`,
        greeting_subtitle: `หนูคือ Kira AI 2.1 ผู้ช่วยอัจฉริยะส่วนตัวของคุณ พร้อมช่วยงานทุกด้านแล้วค่ะ`,
        time_str: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
        date_thai: 'วันนี้',
        is_boss: currentUser && (currentUser.includes('Boss') || currentUser.toLowerCase().includes('admin')),
        proactive_suggestions: [
            { title: "พรีวิวโค้ดสด (Live Canvas)", desc: "สร้างหน้าเว็บ HTML/JS และพรีวิวสดบน Canvas ทันที", prompt: "ช่วยเขียนโค้ดหน้าเว็บพรีวิวสด: สร้างหน้าเว็บร้านกาแฟสวยๆ พร้อม Tailwind CSS และ Interactive Elements", icon: "fa-solid fa-code", tag: "LIVE CANVAS" },
            { title: "วาดผังงาน (Mermaid)", desc: "สร้าง Flowchart และ Diagram สถาปัตยกรรมอัตโนมัติ", prompt: "ช่วยวาดแผนผัง Mermaid Flowchart อธิบายขั้นตอนการทำงานของระบบสั่งอาหาร Delivery", icon: "fa-solid fa-project-diagram", tag: "DIAGRAM" },
            { title: "คิดวิเคราะห์เชิงลึก (Reasoning)", desc: "สกัดตรรกะ วิจัย วางแผนกลยุทธ์ และคำนวณซับซ้อน", prompt: "ช่วยวิเคราะห์จุดเด่นจุดด้อยและกลยุทธ์การนำ AI มาใช้ในองค์กรยุค 2026", icon: "fa-solid fa-brain", tag: "REASONING" },
            { title: "ค้นหาเว็บสด (Web Search)", desc: "สืบค้นข่าวสาร ข้อมูลสด และราคาสินทรัพย์แบบเรียลไทม์", prompt: "สรุปข่าวเทคโนโลยี AI และแนวโน้มสำคัญล่าสุดของวันนี้ให้ฟังหน่อย", icon: "fa-solid fa-globe", tag: "LIVE WEB" }
        ]
    };

    let continueHtml = '';
    if (data.last_topic && data.last_session_id) {
        continueHtml = `
            <div class="welcome-continue-card" onclick="loadSession('${escapeHtml(data.last_session_id)}')" title="คลิกเพื่อสนทนาต่อจากหัวข้อเดิม">
                <div class="welcome-continue-info">
                    <span class="welcome-continue-label"><i class="fa-solid fa-arrow-rotate-left"></i> คุยต่อจากที่ค้างไว้ล่าสุด</span>
                    <span class="welcome-continue-topic">"${escapeHtml(data.last_topic)}"</span>
                </div>
                <button type="button" class="welcome-continue-btn"><i class="fa-solid fa-play"></i> เปิดแชทนี้</button>
            </div>
        `;
    }

    let memoryHtml = '';
    if (data.memory_highlights && data.memory_highlights.length > 0) {
        const memoryPills = data.memory_highlights.map(fact => {
            const escapedFact = escapeHtml(fact);
            const safeParam = escapedFact.replace(/'/g, "\\'");
            return `
                <span class="welcome-memory-pill" onclick="sendQuickPrompt('ช่วยเล่าหรือทบทวนความจำเรื่อง: ${safeParam}')" title="คลิกเพื่อคุยเรื่องนี้ต่อ">
                    <i class="fa-solid fa-lightbulb"></i> ${escapedFact}
                </span>
            `;
        }).join('');

        memoryHtml = `
            <div class="welcome-memory-container">
                <div class="welcome-memory-header">
                    <i class="fa-solid fa-brain" style="color: #c084fc;"></i> ความจำล่าสุดที่คิระจดจำเกี่ยวกับคุณ (GraphRAG):
                </div>
                <div class="welcome-memory-pills">
                    ${memoryPills}
                </div>
            </div>
        `;
    }

    const suggestions = data.proactive_suggestions && data.proactive_suggestions.length > 0
        ? data.proactive_suggestions
        : [
            { title: "พรีวิวโค้ดสด (Live Canvas)", desc: "สร้างหน้าเว็บ HTML/JS และพรีวิวสดบน Canvas ทันที", prompt: "ช่วยเขียนโค้ดหน้าเว็บพรีวิวสด: สร้างหน้าเว็บร้านกาแฟสวยๆ พร้อม Tailwind CSS และ Interactive Elements", icon: "fa-solid fa-code", tag: "LIVE CANVAS" },
            { title: "วาดผังงาน (Mermaid)", desc: "สร้าง Flowchart และ Diagram สถาปัตยกรรมอัตโนมัติ", prompt: "ช่วยวาดแผนผัง Mermaid Flowchart อธิบายขั้นตอนการทำงานของระบบสั่งอาหาร Delivery", icon: "fa-solid fa-project-diagram", tag: "DIAGRAM" },
            { title: "คิดวิเคราะห์เชิงลึก (Reasoning)", desc: "สกัดตรรกะ วิจัย วางแผนกลยุทธ์ และคำนวณซับซ้อน", prompt: "ช่วยวิเคราะห์จุดเด่นจุดด้อยและกลยุทธ์การนำ AI มาใช้ในองค์กรยุค 2026", icon: "fa-solid fa-brain", tag: "REASONING" },
            { title: "ค้นหาเว็บสด (Web Search)", desc: "สืบค้นข่าวสาร ข้อมูลสด และราคาสินทรัพย์แบบเรียลไทม์", prompt: "สรุปข่าวเทคโนโลยี AI และแนวโน้มสำคัญล่าสุดของวันนี้ให้ฟังหน่อย", icon: "fa-solid fa-globe", tag: "LIVE WEB" }
        ];

    const suggestionsHtml = suggestions.map(s => {
        const safePrompt = escapeHtml(s.prompt).replace(/'/g, "\\'");
        return `
            <div class="welcome-pill" onclick="sendQuickPrompt('${safePrompt}')">
                ${s.tag ? `<span class="welcome-pill-badge">${escapeHtml(s.tag)}</span>` : ''}
                <span class="welcome-pill-title"><i class="${s.icon || 'fa-solid fa-bolt'}"></i> ${escapeHtml(s.title)}</span>
                <span class="welcome-pill-desc">${escapeHtml(s.desc)}</span>
            </div>
        `;
    }).join('');

    const bossBadge = data.is_boss ? `<span class="welcome-boss-tag"><i class="fa-solid fa-crown"></i> ฐานบัญชาการผู้สร้าง</span>` : '';
    const timeTag = `<span class="welcome-time-tag"><i class="fa-regular fa-clock"></i> ${escapeHtml(data.date_thai || '')} • ${escapeHtml(data.time_str || '')}</span>`;
    const heartbeatTag = `<span class="welcome-time-tag" style="border-color: rgba(244,63,94,0.3); color:#fda4af;"><i class="fa-solid fa-heart-pulse heartbeat-icon" style="color:#f43f5e;"></i> Heartbeat ตื่นรู้</span>`;

    chatBox.innerHTML = `
        <div class="welcome-hero-card">
            <div class="welcome-meta-bar">
                ${bossBadge}
                ${timeTag}
                ${heartbeatTag}
            </div>
            <div class="welcome-header">
                <img src="/static/images/kira_logo.png?v=6" alt="Kira Logo">
                <div style="flex: 1;">
                    <h3 class="welcome-title">${escapeHtml(data.greeting_title)}</h3>
                    <p class="welcome-subtitle">${escapeHtml(data.greeting_subtitle)}</p>
                </div>
            </div>
            ${continueHtml}
            ${memoryHtml}
            <div class="welcome-grid">
                ${suggestionsHtml}
            </div>
        </div>
    `;
}

// --- Proactive Ambient Heartbeat & Idle Care Loop ---
function initProactiveHeartbeat() {
    const toast = document.getElementById('kira-proactive-toast');
    const toastMsg = document.getElementById('proactive-toast-msg');
    const toastTime = document.getElementById('proactive-toast-time');
    const btnDismiss = document.getElementById('btn-proactive-toast-dismiss');
    const btnAction = document.getElementById('btn-proactive-toast-action');
    const replyBox = document.getElementById('proactive-toast-reply-box');
    const replyInput = document.getElementById('proactive-reply-input');
    const btnSendReply = document.getElementById('btn-proactive-send-reply');

    const resetActivity = () => {
        lastUserActivityTime = Date.now();
    };
    window.addEventListener('mousemove', resetActivity, { passive: true });
    window.addEventListener('keydown', resetActivity, { passive: true });
    window.addEventListener('click', resetActivity, { passive: true });
    window.addEventListener('scroll', resetActivity, { passive: true });

    // Smooth dismissal handler
    const dismissProactiveToast = () => {
        if (!toast) return;
        proactiveToastDismissed = true;
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('fade-out');
            if (replyBox) replyBox.classList.add('hidden');
            if (replyInput) replyInput.value = '';
        }, 260);
    };

    // Reply sender handler
    const sendProactiveReply = (text) => {
        if (!text || !text.trim()) return;
        const replyMsg = text.trim();
        dismissProactiveToast();
        if (userInput) {
            userInput.value = replyMsg;
            userInput.style.height = 'auto';
            if (sendBtn) sendBtn.disabled = false;
            if (typeof sendMessage === 'function' && !isGenerating) {
                sendMessage();
            } else {
                userInput.focus();
            }
        }
    };

    // Expose globally for testing / direct access
    window.dismissProactiveToast = dismissProactiveToast;
    window.sendProactiveReply = sendProactiveReply;

    if (btnDismiss) {
        btnDismiss.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissProactiveToast();
        });
    }

    if (btnAction) {
        btnAction.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (replyBox) {
                const isHidden = replyBox.classList.contains('hidden');
                if (isHidden) {
                    replyBox.classList.remove('hidden');
                    if (replyInput) {
                        setTimeout(() => replyInput.focus(), 80);
                    }
                } else {
                    replyBox.classList.add('hidden');
                }
            } else {
                dismissProactiveToast();
                if (userInput) {
                    userInput.focus();
                    if (!userInput.value) {
                        userInput.placeholder = "มีอะไรให้คิระช่วยบอกได้เลยนะคะ 🌸";
                    }
                }
            }
        });
    }

    // Quick chips interaction
    if (toast) {
        const chips = toast.querySelectorAll('.proactive-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const msg = chip.getAttribute('data-reply') || chip.textContent.trim();
                sendProactiveReply(msg);
            });
        });
    }

    // Custom input reply interaction
    if (btnSendReply && replyInput) {
        btnSendReply.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sendProactiveReply(replyInput.value);
        });

        replyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                sendProactiveReply(replyInput.value);
            }
        });
    }

    // Periodic Heartbeat Check (every 60 seconds)
    setInterval(() => {
        if (!currentUser) return;
        const now = Date.now();
        const idleDuration = now - lastUserActivityTime;

        // If idle > 7 minutes (420,000 ms) and not dismissed, show gentle ambient care
        if (idleDuration > 420000 && !proactiveToastDismissed && toast) {
            const tzTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            if (toastTime) toastTime.textContent = tzTime;
            if (toastMsg) {
                const msgs = [
                    "ทำงานต่อเนื่องมาสักพักแล้ว อย่าลืมพักสายตาและดื่มน้ำหน่อยนะคะ 🌸",
                    "คิระยังอยู่ตรงนี้เสมอ หากมีไอเดียใหม่หรือต้องการให้ช่วยสรุปงาน เรียกได้ทันทีนะคะ ✨",
                    "หากต้องการให้ค้นหาข้อมูลหรือเขียนโค้ดเพิ่ม บอกคิระได้เลยนะคะ 💻"
                ];
                toastMsg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
            }
            toast.classList.remove('fade-out');
            toast.classList.remove('hidden');
            if (replyBox) replyBox.classList.add('hidden');
            if (replyInput) replyInput.value = '';
        }
    }, 60000);

    // Page Visibility Change (Wake on return)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentUser) {
            const awayDuration = Date.now() - lastUserActivityTime;
            lastUserActivityTime = Date.now();
            if (awayDuration > 600000) { // Away for > 10 mins
                proactiveToastDismissed = false; // Reset dismiss flag
                const hbBadge = document.getElementById('heartbeat-badge');
                if (hbBadge) {
                    hbBadge.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.6)';
                    setTimeout(() => { hbBadge.style.boxShadow = ''; }, 2000);
                }
            }
        }
    });
}

// --- 📷 3. Live Screen & Vision Inspector (Pillar 3) ---
function initLiveScreenInspector() {
    const btnInspectCanvas = document.getElementById('btn-inspect-canvas');
    const chatArea = document.querySelector('.chat-area');
    const dragOverlay = document.getElementById('drag-drop-overlay');

    // 1. Live Canvas Snapshot Inspector
    if (btnInspectCanvas) {
        btnInspectCanvas.addEventListener('click', async () => {
            try {
                if (!artifactsIframe) return;
                const iframeDoc = artifactsIframe.contentDocument || (artifactsIframe.contentWindow ? artifactsIframe.contentWindow.document : null);
                if (!iframeDoc || !iframeDoc.body || !iframeDoc.body.innerText.trim()) {
                    alert('ไม่พบเนื้อหาใน Live Canvas สำหรับตรวจสอบครับ กรุณารันโค้ดก่อน');
                    return;
                }

                btnInspectCanvas.disabled = true;
                const originalHtml = btnInspectCanvas.innerHTML;
                btnInspectCanvas.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจ...';

                if (typeof html2canvas === 'undefined') {
                    throw new Error('html2canvas library is not loaded');
                }

                const canvas = await html2canvas(iframeDoc.body, {
                    scale: 1.5,
                    useCORS: true,
                    logging: false,
                    backgroundColor: null
                });

                const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                currentImageBase64 = snapshotDataUrl;

                const imgPreview = document.getElementById('img-preview');
                const imgPreviewContainer = document.getElementById('image-preview-container');
                if (imgPreview) imgPreview.src = snapshotDataUrl;
                if (imgPreviewContainer) imgPreviewContainer.style.display = 'block';

                // Auto-switch to Vision model
                const modelSelect = document.getElementById('model-select');
                if (modelSelect) {
                    modelSelect.value = '2.0-vision';
                    localStorage.setItem('kira_model', '2.0-vision');
                    updateModelUI();
                }

                if (!userInput.value.trim()) {
                    userInput.value = 'ช่วยตรวจสอบ UI, Layout, สี และฟังก์ชันการทำงานของหน้าจอ Canvas นี้อย่างละเอียด พร้อมระบุจุดที่ควรปรับปรุง';
                }
                userInput.style.height = 'auto';
                userInput.style.height = (userInput.scrollHeight) + 'px';
                userInput.focus();
                sendBtn.disabled = false;

                showConnectionToast('📷 จับภาพ Canvas ส่งให้ Kira Vision Inspector เรียบร้อย!', 'ready');
                hideConnectionToast(3000);
            } catch (err) {
                console.error('Inspect canvas error:', err);
                alert('ไม่สามารถจับภาพ Canvas ได้: ' + err.message);
            } finally {
                if (btnInspectCanvas) {
                    btnInspectCanvas.disabled = false;
                    btnInspectCanvas.innerHTML = '<i class="fa-solid fa-camera"></i> ตรวจ Canvas';
                }
            }
        });
    }

    // 2. Drag & Drop Vision Diagnostics
    if (chatArea && dragOverlay) {
        let dragCounter = 0;

        chatArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            dragOverlay.classList.add('active');
        });

        chatArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dragOverlay.classList.contains('active')) {
                dragOverlay.classList.add('active');
            }
        });

        chatArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dragOverlay.classList.remove('active');
            }
        });

        chatArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            dragOverlay.classList.remove('active');

            const files = e.dataTransfer ? e.dataTransfer.files : null;
            if (files && files.length > 0) {
                const file = files[0];
                if (!file.type.startsWith('image/')) {
                    alert('กรุณาวางไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้นครับ');
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    alert('ขนาดรูปภาพต้องไม่เกิน 5MB ครับ');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    currentImageBase64 = event.target.result;
                    const imgPreview = document.getElementById('img-preview');
                    const imgPreviewContainer = document.getElementById('image-preview-container');
                    if (imgPreview) imgPreview.src = currentImageBase64;
                    if (imgPreviewContainer) imgPreviewContainer.style.display = 'block';

                    // Auto-switch to Vision model
                    const modelSelect = document.getElementById('model-select');
                    if (modelSelect) {
                        modelSelect.value = '2.0-vision';
                        localStorage.setItem('kira_model', '2.0-vision');
                        updateModelUI();
                    }

                    if (!userInput.value.trim()) {
                        userInput.value = 'ช่วยวิเคราะห์และตรวจสอบภาพนี้อย่างละเอียด';
                    }
                    userInput.style.height = 'auto';
                    userInput.style.height = (userInput.scrollHeight) + 'px';
                    userInput.focus();
                    sendBtn.disabled = false;

                    showConnectionToast('🖼️ โหลดรูปภาพสำเร็จ! Kira Vision Inspector สแตนด์บาย', 'ready');
                    hideConnectionToast(2500);
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function sendQuickPrompt(promptText) {
    if (!userInput) return;
    userInput.value = promptText;
    sendMessage();
}

async function loadHistory() {
    try {
        const response = await fetch(`/api/history/sessions/${currentUser}`);
        const data = await response.json();
        
        chatHistorySidebar.innerHTML = '<p class="history-title">ประวัติการแชท</p>';
        
        // Add "New Chat" button
        const newChatDiv = document.createElement('div');
        newChatDiv.className = 'history-item';
        newChatDiv.style.border = '1px solid #3b82f6';
        newChatDiv.style.color = '#60a5fa';
        newChatDiv.innerHTML = `<i class="fa-solid fa-plus"></i> แชทใหม่ (New Chat)`;
        newChatDiv.onclick = () => {
            currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            renderWelcomeHub();
            document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
            newChatDiv.classList.add('active');
        };
        chatHistorySidebar.appendChild(newChatDiv);

        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach((session, idx) => {
                const div = document.createElement('div');
                div.className = 'history-item';
                if (idx === 0) {
                    div.classList.add('active');
                    currentSessionId = session.session_id;
                    loadSession(session.session_id); // Load the latest session
                }
                div.innerHTML = `<i class="fa-regular fa-message"></i> ${session.title}`;
                div.onclick = () => {
                    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                    div.classList.add('active');
                    currentSessionId = session.session_id;
                    loadSession(session.session_id);
                };
                chatHistorySidebar.appendChild(div);
            });
        } else {
            // New user, no sessions
            newChatDiv.classList.add('active');
            renderWelcomeHub();
        }
    } catch (err) {
        console.error("Load sessions error:", err);
    }
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/history/${currentUser}/${sessionId}`);
        const data = await response.json();
        chatBox.innerHTML = '';
        if (data.history.length === 0) {
            renderWelcomeHub();
        } else {
            data.history.forEach(msg => {
                // Strip badge when rendering old history
                let displayTxt = msg.content.replace(/^(✨ \*\*\[Kira 1\.1 PRO\]\*\*\n\n|🤖 \*\*\[Kira 1\.0\]\*\*\n\n|✨ \*\*\[Kira 1\.1 👑\]\*\*\n\n|✨ \*\*\[Kira 1\.2 PRO\]\*\*\n\n)/i, "");
                addMessage(displayTxt, msg.role === 'User');
            });
        }
    } catch (err) {
        console.error("Load session error:", err);
    }
}

function addMessage(text, isUser, imageBase64 = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? '' : '<img src="/static/images/kira_avatar.jpg?v=5" alt="Kira">';

    const content = document.createElement('div');
    content.className = 'content';
    
    if (isUser) {
        if (imageBase64) {
            const imgEl = document.createElement('img');
            imgEl.src = imageBase64;
            imgEl.className = 'chat-user-thumbnail';
            imgEl.alt = 'User uploaded image';
            imgEl.style.maxWidth = '240px';
            imgEl.style.maxHeight = '180px';
            imgEl.style.borderRadius = '12px';
            imgEl.style.display = 'block';
            imgEl.style.marginBottom = text ? '8px' : '0';
            imgEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            imgEl.style.cursor = 'pointer';
            imgEl.title = 'คลิกเพื่อดูภาพขนาดเต็ม';
            imgEl.onclick = () => {
                const w = window.open('');
                if (w) w.document.write(`<img src="${imageBase64}" style="max-width:100%; height:auto; background:#0f172a;">`);
            };
            content.appendChild(imgEl);
        }
        if (text) {
            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            content.appendChild(textSpan);
        }
    } else {
        if (!text) {
            content.innerHTML = '<span class="typing-cursor"></span>';
        } else {
            let normalizedTxt = text.replace(/<think>/gi, "[THINKING]").replace(/<\/think>/gi, "[/THINKING][THINKING_DONE]");
            let htmlContent = "";
            let finalMarkdown = normalizedTxt;
            
            if (normalizedTxt.includes("[THINKING]")) {
                let steps = [];
                let regex = /\[THINKING\](.*?)(\[\/THINKING\]|$)/gs;
                let match;
                while ((match = regex.exec(normalizedTxt)) !== null) {
                    if (match[1] && match[1].trim()) {
                        steps.push(match[1].trim());
                    }
                }
                
                finalMarkdown = normalizedTxt.replace(/\[THINKING\](.*?)(\[\/THINKING\]|$)/gs, "")
                                              .replace(/\[THINKING_DONE\]/g, "")
                                              .trim();
                
                let hasSubstantialAnswer = finalMarkdown.length > 25;
                let boxClass = hasSubstantialAnswer ? "thinking-box done collapsed" : "thinking-box done";
                let toggleIcon = hasSubstantialAnswer ? "▼" : "▲";
                
                htmlContent += `
                <div class="${boxClass}">
                    <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="thinking-title">🧠 กระบวนการคิดเชิงลึก (Deep Reasoning)</div>
                        <div class="thinking-toggle-icon">${toggleIcon}</div>
                    </div>
                    <div class="thinking-progress-bar"></div>
                    <div class="thinking-content">
                        ${stepsHtml}
                    </div>
                </div>
                `;
            }
            
            try {
                htmlContent += finalMarkdown ? marked.parse(finalMarkdown) : "";
            } catch (mErr) {
                htmlContent += `<div style="white-space: pre-wrap;">${finalMarkdown}</div>`;
            }

            if (!finalMarkdown && normalizedTxt.includes("[THINKING]")) {
                htmlContent += `<div class="thinking-summary-note" style="margin-top: 10px; padding: 10px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; color: #7dd3fc; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-circle-check" style="color: #38bdf8;"></i>
                    <span>คิระได้วิเคราะห์และสรุปแนวทางไว้ในขั้นตอนการคิดเชิงลึกด้านบนเรียบร้อยแล้วค่ะ</span>
                </div>`;
            }
            content.innerHTML = htmlContent;
        }
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
        <div class="avatar"><img src="/static/images/kira_avatar.jpg?v=5" alt="Kira"></div>
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
    const imgBase64ToSend = currentImageBase64;
    if ((!text && !imgBase64ToSend) || !currentUser) return;

    addMessage(text || 'ส่งรูปภาพเพื่อตรวจสอบ (Visual Diagnostic)', true, imgBase64ToSend);

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

    // Clear image immediately from UI after sending
    currentImageBase64 = null;
    const imgPreviewContainer = document.getElementById('image-preview-container');
    const imgInput = document.getElementById('img-input');
    if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';
    if (imgInput) imgInput.value = '';

    try {
        const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "2.1-reasoning";
        const flavor = document.querySelector('input[name="sub-model-flavor"]:checked') ? document.querySelector('input[name="sub-model-flavor"]:checked').value : "fast";
        const persona = document.getElementById('persona-select') ? document.getElementById('persona-select').value : "default";

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text || 'ช่วยวิเคราะห์และตรวจสอบภาพนี้อย่างละเอียด', username: currentUser, model_version: modelVersion, image_base64: imgBase64ToSend, session_id: currentSessionId, flavor: flavor, persona: persona })
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
            let displayTxt = fullText.replace(/^(✨ \*\*\[Kira.*?\]\*\*\n\n|🤖 \*\*\[Kira.*?\]\*\*\n\n|👁️ \*\*\[Kira.*?\]\*\*\n\n|🧠 \*\*\[Kira.*?\]\*\*\n\n|👑 \*\*\[Kira.*?\]\*\*\n\n|💼 \*\*\[Kira.*?\]\*\*\n\n)/i, "");
            
            // --- Parse Thinking Tags (<think> and [THINKING]) ---
            let normalizedTxt = displayTxt.replace(/<think>/gi, "[THINKING]").replace(/<\/think>/gi, "[/THINKING][THINKING_DONE]");
            let htmlContent = "";
            let finalMarkdown = normalizedTxt;
            
            if (normalizedTxt.includes("[THINKING]")) {
                let isDone = normalizedTxt.includes("[THINKING_DONE]") || normalizedTxt.includes("[/THINKING]");
                let steps = [];
                let regex = /\[THINKING\](.*?)(\[\/THINKING\]|$)/gs;
                let match;
                while ((match = regex.exec(normalizedTxt)) !== null) {
                    if (match[1] && match[1].trim()) {
                        steps.push(match[1].trim());
                    }
                }
                
                // Remove all thinking tags from the markdown that will be parsed
                finalMarkdown = normalizedTxt.replace(/\[THINKING\](.*?)(\[\/THINKING\]|$)/gs, "")
                                              .replace(/\[THINKING_DONE\]/g, "")
                                              .trim();
                
                let stepsHtml = steps.map(s => `<div class="thinking-step" style="white-space: pre-wrap; font-size: 0.9em; line-height: 1.5; color: #94a3b8;">${marked.parse(s)}</div>`).join('');
                let hasSubstantialAnswer = finalMarkdown.length > 25;
                let boxClass = (isDone && hasSubstantialAnswer) ? "thinking-box done collapsed" : (isDone ? "thinking-box done" : "thinking-box");
                let toggleIcon = (isDone && hasSubstantialAnswer) ? "▼" : "▲";
                
                htmlContent += `
                <div class="${boxClass}">
                    <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="thinking-title">🧠 กระบวนการคิดเชิงลึก (Deep Reasoning)</div>
                        <div class="thinking-toggle-icon">${toggleIcon}</div>
                    </div>
                    <div class="thinking-progress-bar"></div>
                    <div class="thinking-content">
                        ${stepsHtml}
                    </div>
                </div>
                `;
            }
            
            try {
                htmlContent += finalMarkdown ? marked.parse(finalMarkdown) : "";
            } catch (mErr) {
                htmlContent += `<div style="white-space: pre-wrap;">${finalMarkdown}</div>`;
            }

            if (normalizedTxt.includes("[THINKING_DONE]") && !finalMarkdown) {
                htmlContent += `<div class="thinking-summary-note" style="margin-top: 10px; padding: 10px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; color: #7dd3fc; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-circle-check" style="color: #38bdf8;"></i>
                    <span>คิระได้วิเคราะห์รายละเอียดและขั้นตอนการคิดไว้ในบล็อกด้านบนนี้เรียบร้อยแล้วค่ะ</span>
                </div>`;
            }
            contentDiv.innerHTML = htmlContent;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        // Apply Advanced Code Actions (Copy & Live Preview)
        applyCodeActions(contentDiv);
        
        // Append Feedback & Voice UI
        const feedbackUI = document.createElement('div');
        feedbackUI.className = 'feedback-ui';
        feedbackUI.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 8px; justify-content: flex-start; align-items: center; flex-wrap: wrap;';
        
        const speakerBtn = document.createElement('button');
        speakerBtn.className = 'btn-speaker';
        speakerBtn.title = 'ฟังเสียงคิระพากย์คำตอบนี้ (Free Neural Voice)';
        speakerBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
        speakerBtn.onclick = () => playKiraVoice(finalMarkdown || fullText, speakerBtn);

        const likeBtn = document.createElement('button');
        likeBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i>';
        likeBtn.style.cssText = 'background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;';
        likeBtn.onclick = () => { 
            submitFeedback('like', fullText); 
            likeBtn.style.color = '#34d399'; 
            likeBtn.style.borderColor = '#34d399'; 
            dislikeBtn.style.color = '#94a3b8'; 
            dislikeBtn.style.borderColor = '#334155'; 
        };

        const dislikeBtn = document.createElement('button');
        dislikeBtn.innerHTML = '<i class="fa-solid fa-thumbs-down"></i>';
        dislikeBtn.style.cssText = 'background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;';
        dislikeBtn.onclick = () => { 
            submitFeedback('dislike', fullText); 
            dislikeBtn.style.color = '#ef4444'; 
            dislikeBtn.style.borderColor = '#ef4444'; 
            likeBtn.style.color = '#94a3b8'; 
            likeBtn.style.borderColor = '#334155'; 
        };

        const copyMsgBtn = document.createElement('button');
        copyMsgBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก';
        copyMsgBtn.title = 'คัดลอกคำตอบนี้';
        copyMsgBtn.style.cssText = 'background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;';
        copyMsgBtn.onclick = () => {
            navigator.clipboard.writeText(finalMarkdown || fullText);
            copyMsgBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #38bdf8;"></i> คัดลอกแล้ว';
            setTimeout(() => {
                copyMsgBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก';
            }, 2000);
        };

        const reviewBtn = document.createElement('button');
        reviewBtn.innerHTML = '<i class="fa-solid fa-comment-dots"></i> รีวิว';
        reviewBtn.style.cssText = 'background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;';
        reviewBtn.onclick = () => openReviewModal(fullText);

        feedbackUI.appendChild(copyMsgBtn);
        feedbackUI.appendChild(speakerBtn);
        feedbackUI.appendChild(likeBtn);
        feedbackUI.appendChild(dislikeBtn);
        feedbackUI.appendChild(reviewBtn);
        contentDiv.appendChild(feedbackUI);
        
        // Auto-Speak if enabled
        if (isAutoSpeakEnabled) {
            playKiraVoice(finalMarkdown || fullText, speakerBtn);
        }

        chatBox.scrollTop = chatBox.scrollHeight;
        loadUserProfile(); // Refresh points & quota after message
        
    } catch (error) {
        console.error("Chat streaming error:", error);
        hideTypingIndicator();
        if (!fullText || fullText.trim() === '') {
            addMessage('ระบบขัดข้อง: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', false);
        }
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
    currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    renderWelcomeHub();
    userInput.focus();
});

// --- Theme Switcher ---
const btnTheme = document.getElementById('btn-theme');
if (btnTheme) {
    const isLight = localStorage.getItem('kira_theme') === 'light';
    if (isLight) {
        document.body.classList.add('light-theme');
        btnTheme.innerHTML = '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>';
    }

    btnTheme.addEventListener('click', () => {
        const lightActive = document.body.classList.toggle('light-theme');
        if (lightActive) {
            localStorage.setItem('kira_theme', 'light');
            btnTheme.innerHTML = '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>';
        } else {
            localStorage.setItem('kira_theme', 'dark');
            btnTheme.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    });
}

// --- Export Chat History ---
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        const messages = chatBox.querySelectorAll('.message');
        if (!messages || messages.length === 0) {
            alert('ยังไม่มีข้อความในประวัติการสนทนานี้ค่ะ');
            return;
        }
        
        let mdContent = `# 💬 Kira AI System 2.1 - ประวัติการสนทนา\n`;
        mdContent += `**ผู้ใช้งาน:** ${currentUser || 'User'}\n`;
        mdContent += `**วันที่บันทึก:** ${new Date().toLocaleString('th-TH')}\n\n---\n\n`;
        
        messages.forEach(msg => {
            const isUser = msg.classList.contains('user');
            const contentEl = msg.querySelector('.content');
            if (!contentEl) return;
            
            // Clone and remove feedback buttons before getting text
            const clone = contentEl.cloneNode(true);
            const fb = clone.querySelector('div[style*="border-top"]');
            if (fb) fb.remove();
            const txt = clone.innerText.trim();
            
            if (isUser) {
                mdContent += `### 👤 คุณ (${currentUser}):\n${txt}\n\n`;
            } else {
                mdContent += `### 🤖 Kira AI:\n${txt}\n\n`;
            }
        });
        
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Kira_Chat_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// --- Info Modal ---
const btnInfo = document.getElementById('btn-info');
const infoModal = document.getElementById('info-modal');
const closeInfoModal = document.getElementById('close-info-modal');

if (btnInfo && infoModal) {
    btnInfo.addEventListener('click', () => {
        infoModal.style.display = 'flex';
    });
}

if (closeInfoModal && infoModal) {
    closeInfoModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) infoModal.style.display = 'none';
    });
}

const modelSelect = document.getElementById('model-select');
if (modelSelect) {
    const savedModel = localStorage.getItem('kira_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    }

    modelSelect.addEventListener('change', (e) => {
        localStorage.setItem('kira_model', e.target.value);
        updateModelUI();
    });
}

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (!isGenerating) {
        sendBtn.disabled = this.value.trim() === '';
    }
});

toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));

// Add floating label behavior to input area
userInput.addEventListener('focus', () => {
    document.querySelector('.input-wrapper').style.borderColor = '#38bdf8';
});
userInput.addEventListener('blur', () => {
    document.querySelector('.input-wrapper').style.borderColor = 'rgba(255, 255, 255, 0.2)';
});

// --- Quick Prompts ---
document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        userInput.value = btn.getAttribute('data-prompt');
        userInput.focus();
        sendBtn.disabled = false;
    });
});

// --- Speech-to-Text (Web Speech API) ---
const micBtn = document.getElementById('mic-btn');
if (micBtn) {
    let recognition = null;
    let isRecording = false;
    let initialTextBeforeSpeech = '';

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true; // Stream words in real-time
        recognition.lang = 'th-TH'; // Default to Thai with English loanword support

        recognition.onstart = function() {
            isRecording = true;
            micBtn.classList.add('listening');
            micBtn.title = "กำลังฟัง... (คลิกอีกครั้งเพื่อหยุด)";
            initialTextBeforeSpeech = userInput.value;
            userInput.placeholder = "🎙️ กำลังฟังเสียงของคุณ...";
        };

        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const prefix = initialTextBeforeSpeech ? initialTextBeforeSpeech.trim() + ' ' : '';
            userInput.value = prefix + (finalTranscript || interimTranscript);
            
            // Auto grow input
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
            sendBtn.disabled = userInput.value.trim() === '';
        };

        recognition.onerror = function(event) {
            console.warn("Speech recognition notice:", event.error);
            if (event.error === 'not-allowed') {
                alert("กรุณาอนุญาตการเข้าถึงไมโครโฟนในเบราว์เซอร์เพื่อใช้งานระบบเสียงครับ");
            }
        };

        recognition.onend = function() {
            isRecording = false;
            micBtn.classList.remove('listening');
            micBtn.title = "พูดด้วยเสียง (Web Speech API)";
            userInput.placeholder = "พิมพ์ข้อความหา Kira...";
            userInput.focus();
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Mic start error:", e);
                }
            }
        });
    } else {
        micBtn.addEventListener('click', () => {
            alert("เบราว์เซอร์ของคุณไม่รองรับระบบสั่งงานด้วยเสียง กรุณาเปิดใช้งานผ่าน Google Chrome หรือ Microsoft Edge ครับ");
        });
    }
}

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

// --- Advanced Markdown (Copy Code & MathJax) ---
function applyAdvancedMarkdown(container) {
    // 1. MathJax
    if (typeof MathJax !== 'undefined') {
        MathJax.typesetPromise([container]).catch((err) => console.log(err.message));
    }
    
    // 2. Copy Code Button
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
        if (pre.querySelector('.copy-btn')) return; // Already added
        pre.style.position = 'relative';
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        btn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.1); color: #cbd5e1; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; transition: 0.2s;';
        
        btn.addEventListener('click', () => {
            const code = pre.querySelector('code');
            if (code) {
                navigator.clipboard.writeText(code.innerText);
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                btn.style.background = 'rgba(74, 222, 128, 0.2)';
                btn.style.color = '#4ade80';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    btn.style.background = 'rgba(255,255,255,0.1)';
                    btn.style.color = '#cbd5e1';
                }, 2000);
            }
        });
        
        pre.appendChild(btn);
    });
}

// --- Feedback Logic ---
async function submitFeedback(rating, botText, review = "") {
    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                rating: rating,
                review: review,
                bot_response: botText
            })
        });
    } catch(e) { console.error("Feedback error", e); }
}

function openReviewModal(botText) {
    document.getElementById('feedback-modal').style.display = 'flex';
    document.getElementById('feedback-rating').value = 'review';
    document.getElementById('feedback-bot-msg').value = botText;
    document.getElementById('feedback-text').value = '';
    document.getElementById('feedback-text').focus();
}

const btnCancelFeedback = document.getElementById('btn-cancel-feedback');
if (btnCancelFeedback) {
    btnCancelFeedback.addEventListener('click', () => {
        document.getElementById('feedback-modal').style.display = 'none';
    });
}

const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', () => {
        const text = document.getElementById('feedback-text').value;
        const botMsg = document.getElementById('feedback-bot-msg').value;
        const rating = document.getElementById('feedback-rating').value;
        submitFeedback(rating, botMsg, text);
        document.getElementById('feedback-modal').style.display = 'none';
        alert("Kira ได้รับรีวิวของคุณแล้ว ขอบคุณมากค่ะ! ✨");
    });
}

// --- Voice Features (STT) removed per request ---

// --- Image Upload (Vision) ---
const imgUploadBtn = document.getElementById('img-upload-btn');
const imgInput = document.getElementById('img-input');
const imgPreviewContainer = document.getElementById('image-preview-container');
const imgPreview = document.getElementById('image-preview');
const removeImgBtn = document.getElementById('remove-img-btn');

const attachToggleBtn = document.getElementById('attach-toggle-btn');
const attachmentMenu = document.getElementById('attachment-menu');
const menuImgBtn = document.getElementById('menu-img-btn');
const menuDocBtn = document.getElementById('menu-doc-btn');
const docInput = document.getElementById('doc-input');

if (attachToggleBtn && attachmentMenu) {
    attachToggleBtn.addEventListener('click', () => {
        const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "1.0";
        if (modelVersion === "1.0") {
            alert("ฟีเจอร์แนบไฟล์และวิเคราะห์รูปภาพรองรับใน Kira 1.1 ขึ้นไปค่ะ กรุณาเลือกเวอร์ชันด้านบนนะคะ ✨");
            return;
        }
        attachmentMenu.style.display = attachmentMenu.style.display === 'none' ? 'flex' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (!attachToggleBtn.contains(e.target) && !attachmentMenu.contains(e.target)) {
            attachmentMenu.style.display = 'none';
        }
    });

    if (menuImgBtn) {
        menuImgBtn.addEventListener('click', () => {
            imgInput.click();
            attachmentMenu.style.display = 'none';
        });
    }

    if (menuDocBtn) {
        menuDocBtn.addEventListener('click', () => {
            docInput.click();
            attachmentMenu.style.display = 'none';
        });
    }

    imgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("ขนาดรูปภาพต้องไม่เกิน 5MB ครับ");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                currentImageBase64 = event.target.result;
                imgPreview.src = currentImageBase64;
                imgPreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    removeImgBtn.addEventListener('click', () => {
        currentImageBase64 = null;
        imgPreview.src = "";
        imgPreviewContainer.style.display = 'none';
        imgInput.value = '';
    });
    
    if (docInput) {
        docInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("username", currentUser);
                if (currentSessionId) {
                    formData.append("session_id", currentSessionId);
                }
                
                try {
                    addMessage(`กำลังอัปโหลดไฟล์ ${file.name}...`, true);
                    showTypingIndicator();
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    hideTypingIndicator();
                    if (result.status === 'success') {
                        addMessage(result.message, false);
                    } else {
                        addMessage("❌ Error: " + result.message, false);
                    }
                } catch (err) {
                    hideTypingIndicator();
                    console.error(err);
                    addMessage("❌ เกิดข้อผิดพลาดในการอัปโหลด", false);
                }
                docInput.value = '';
            }
        });
    }
}


// =========================================================================
// 🎙️ 1. Free Natural Neural Voice Engine (Edge-TTS Integration)
// =========================================================================
let currentAudio = null;
let currentSpeakingBtn = null;
let isAutoSpeakEnabled = localStorage.getItem('kira_auto_speak') === 'true';

const btnAutoSpeak = document.getElementById('btn-autospeak');
if (btnAutoSpeak) {
    if (isAutoSpeakEnabled) {
        btnAutoSpeak.classList.add('active');
        btnAutoSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btnAutoSpeak.title = 'ปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Active)';
    } else {
        btnAutoSpeak.classList.remove('active');
        btnAutoSpeak.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btnAutoSpeak.title = 'เปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Off)';
    }

    btnAutoSpeak.addEventListener('click', () => {
        isAutoSpeakEnabled = !isAutoSpeakEnabled;
        localStorage.setItem('kira_auto_speak', isAutoSpeakEnabled);
        if (isAutoSpeakEnabled) {
            btnAutoSpeak.classList.add('active');
            btnAutoSpeak.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btnAutoSpeak.title = 'ปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Active)';
        } else {
            btnAutoSpeak.classList.remove('active');
            btnAutoSpeak.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btnAutoSpeak.title = 'เปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Off)';
            if (currentAudio) {
                currentAudio.pause();
                if (currentSpeakingBtn) {
                    currentSpeakingBtn.classList.remove('speaking');
                    currentSpeakingBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
                }
            }
        }
    });
}

async function playKiraVoice(text, btn) {
    if (!text) return;
    
    // Toggle Pause if same button is playing
    if (currentAudio && !currentAudio.paused && currentSpeakingBtn === btn) {
        currentAudio.pause();
        btn.classList.remove('speaking');
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
        return;
    }

    // Stop any existing audio
    if (currentAudio) {
        currentAudio.pause();
        if (currentSpeakingBtn) {
            currentSpeakingBtn.classList.remove('speaking');
            currentSpeakingBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
        }
    }

    if (btn) {
        btn.classList.add('speaking');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดเสียง...';
    }

    try {
        const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: 'th-TH-PremwadeeNeural' })
        });

        if (!res.ok) {
            throw new Error(`TTS Error: ${res.statusText}`);
        }

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        currentSpeakingBtn = btn;

        currentAudio.onplay = () => {
            if (btn) {
                btn.classList.add('speaking');
                btn.innerHTML = '<i class="fa-solid fa-waveform-lines"></i> กำลังพูด...';
            }
        };

        currentAudio.onended = () => {
            if (btn) {
                btn.classList.remove('speaking');
                btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
            }
            currentAudio = null;
            currentSpeakingBtn = null;
        };

        currentAudio.onerror = () => {
            if (btn) {
                btn.classList.remove('speaking');
                btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
            }
        };

        await currentAudio.play();
    } catch (e) {
        console.error("Audio playback error:", e);
        if (btn) {
            btn.classList.remove('speaking');
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> เล่นเสียงไม่สำเร็จ';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียง';
            }, 3000);
        }
    }
}

// =========================================================================
// 🎨 2. Live Interactive Code Canvas & Artifacts
// =========================================================================
// =========================================================================
// 🎨 2. Live Interactive Code Canvas & Artifacts Version Control
// =========================================================================
const artifactsDrawer = document.getElementById('artifacts-drawer');
const artifactsIframe = document.getElementById('artifacts-iframe');
const artifactsName = document.getElementById('artifacts-name');
const artifactsVersionsContainer = document.getElementById('artifacts-versions');
const btnCloseArtifact = document.getElementById('btn-close-artifact');
const btnViewportDesktop = document.getElementById('btn-viewport-desktop');
const btnViewportMobile = document.getElementById('btn-viewport-mobile');
const btnDownloadArtifact = document.getElementById('btn-download-artifact');

let currentArtifactCode = '';
let artifactVersions = []; // Array of { id: 1, label: 'v1', code: '...', fullHtml: '...', timestamp: Date }
let activeVersionId = 1;

if (btnCloseArtifact) {
    btnCloseArtifact.addEventListener('click', () => {
        artifactsDrawer.classList.remove('open');
    });
}

if (btnViewportDesktop && btnViewportMobile) {
    btnViewportDesktop.addEventListener('click', () => {
        btnViewportDesktop.classList.add('active');
        btnViewportMobile.classList.remove('active');
        artifactsIframe.classList.remove('mobile-view');
    });

    btnViewportMobile.addEventListener('click', () => {
        btnViewportMobile.classList.add('active');
        btnViewportDesktop.classList.remove('active');
        artifactsIframe.classList.add('mobile-view');
    });
}

if (btnDownloadArtifact) {
    btnDownloadArtifact.addEventListener('click', () => {
        if (!currentArtifactCode) return;
        const blob = new Blob([currentArtifactCode], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const currentVersion = artifactVersions.find(v => v.id === activeVersionId);
        const verLabel = currentVersion ? `_${currentVersion.label}` : '';
        a.download = `kira_live_app${verLabel}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function renderArtifactVersion(versionId) {
    const version = artifactVersions.find(v => v.id === versionId);
    if (!version) return;
    
    activeVersionId = versionId;
    currentArtifactCode = version.code;
    artifactsIframe.srcdoc = version.fullHtml;
    
    // Update version pills in header
    if (artifactsVersionsContainer) {
        artifactsVersionsContainer.innerHTML = '';
        artifactVersions.forEach(v => {
            const chip = document.createElement('button');
            chip.className = `version-chip ${v.id === activeVersionId ? 'active' : ''}`;
            chip.textContent = v.label;
            chip.title = `สลับไปยังเวอร์ชัน ${v.label}`;
            chip.onclick = () => renderArtifactVersion(v.id);
            artifactsVersionsContainer.appendChild(chip);
        });
    }
}

function openArtifacts(code, title = 'Live Preview') {
    if (!artifactsDrawer || !artifactsIframe) return;
    if (artifactsName) artifactsName.textContent = title;
    
    const isMermaid = title.toLowerCase().includes('mermaid') || 
                      code.trim().startsWith('graph ') || 
                      code.trim().startsWith('flowchart ') || 
                      code.trim().startsWith('sequenceDiagram ') || 
                      code.trim().startsWith('classDiagram ') || 
                      code.trim().startsWith('stateDiagram') || 
                      code.trim().startsWith('erDiagram');

    // Inject full HTML wrapper if code is just a fragment or mermaid
    let fullHtml = code;
    if (isMermaid) {
        fullHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kira Mermaid Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body { margin: 0; padding: 2rem; background: #0f172a; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; box-sizing: border-box; }
        .mermaid { background: rgba(30, 41, 59, 0.7); padding: 2rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 100%; overflow: auto; }
    </style>
</head>
<body>
    <div class="mermaid">
${code}
    </div>
    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    </script>
</body>
</html>`;
    } else if (!code.toLowerCase().includes('<!doctype') && !code.toLowerCase().includes('<html')) {
        fullHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kira Live Canvas</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 p-4">
    ${code}
</body>
</html>`;
    }
    
    // Version History Management: Check if this exact code already exists in history
    let existingVersion = artifactVersions.find(v => v.code.trim() === code.trim());
    if (!existingVersion) {
        const newVersionId = artifactVersions.length + 1;
        const newVersion = {
            id: newVersionId,
            label: `v${newVersionId}`,
            code: code,
            fullHtml: fullHtml,
            timestamp: new Date()
        };
        artifactVersions.push(newVersion);
        activeVersionId = newVersionId;
    } else {
        activeVersionId = existingVersion.id;
    }
    
    renderArtifactVersion(activeVersionId);
    artifactsDrawer.classList.add('open');
}

function applyCodeActions(container) {
    if (!container) return;
    
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        if (pre.parentElement.querySelector('.code-action-bar')) return; // Already has bar
        
        const codeText = block.innerText;
        const className = block.className || '';
        const isMermaid = className.includes('mermaid') || 
                          codeText.trim().startsWith('graph ') || 
                          codeText.trim().startsWith('flowchart ') || 
                          codeText.trim().startsWith('sequenceDiagram ') || 
                          codeText.trim().startsWith('classDiagram ') || 
                          codeText.trim().startsWith('stateDiagram') || 
                          codeText.trim().startsWith('erDiagram');
        const isHtmlOrWeb = className.includes('html') || className.includes('svg') || className.includes('xml') || codeText.includes('<div') || codeText.includes('<html') || codeText.includes('<svg');
        
        const actionBar = document.createElement('div');
        actionBar.className = 'code-action-bar';
        
        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.style.fontSize = '0.75rem';
        copyBtn.style.padding = '2px 8px';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(codeText);
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> คัดลอกแล้ว';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก';
            }, 2000);
        };
        actionBar.appendChild(copyBtn);
        
        // Live Preview Button (Mermaid or Web Canvas)
        if (isMermaid) {
            const mermaidBtn = document.createElement('button');
            mermaidBtn.className = 'btn-run-code';
            mermaidBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #ec4899)';
            mermaidBtn.innerHTML = '<i class="fa-solid fa-project-diagram"></i> ดูผังไดอะแกรม (Mermaid Flowchart)';
            mermaidBtn.onclick = () => openArtifacts(codeText, 'Mermaid Flowchart / Diagram');
            actionBar.appendChild(mermaidBtn);
        } else if (isHtmlOrWeb) {
            const previewBtn = document.createElement('button');
            previewBtn.className = 'btn-run-code';
            previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> พรีวิวสด (Live Canvas)';
            previewBtn.onclick = () => openArtifacts(codeText, 'Live Web Artifact');
            actionBar.appendChild(previewBtn);
        }
        
        pre.parentElement.insertBefore(actionBar, pre);
    });
}

// =========================================================================
// 🕸️ 3. Interactive Knowledge Graph Mind-Map Simulation (Canvas 2D Force)
// =========================================================================
const btnGraph = document.getElementById('btn-graph');
const graphModal = document.getElementById('graph-modal');
const closeGraphModal = document.getElementById('close-graph-modal');
const btnAddMemory = document.getElementById('btn-add-memory');
const btnDeleteNode = document.getElementById('btn-delete-node');
const btnCloseDetail = document.getElementById('btn-close-detail');
const graphCanvas = document.getElementById('graph-canvas');
const graphNodeDetails = document.getElementById('graph-node-details');
const detailNodeName = document.getElementById('detail-node-name');
const detailNodeDesc = document.getElementById('detail-node-desc');

let graphAnimationId = null;
let graphNodes = [];
let graphLinks = [];
let selectedActiveNode = null;
let draggedNode = null;

if (btnGraph) {
    btnGraph.addEventListener('click', () => openKnowledgeGraph());
}

if (closeGraphModal) {
    closeGraphModal.addEventListener('click', () => {
        graphModal.style.display = 'none';
        if (graphAnimationId) cancelAnimationFrame(graphAnimationId);
    });
}

if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', () => {
        if (graphNodeDetails) graphNodeDetails.style.display = 'none';
        selectedActiveNode = null;
    });
}

if (btnDeleteNode) {
    btnDeleteNode.addEventListener('click', async () => {
        if (!selectedActiveNode) return;
        
        if (selectedActiveNode.type === 'user' || selectedActiveNode.type === 'ai') {
            alert('โหนดศูนย์กลาง (ผู้ใช้ หรือ Kira) ไม่สามารถลบได้ค่ะ');
            return;
        }

        const confirmDelete = confirm(`คุณต้องการลบ "${selectedActiveNode.label}" ออกจากสมองของคิระหรือไม่?`);
        if (!confirmDelete) return;

        try {
            let url = '';
            if (selectedActiveNode.db_type === 'memory' && selectedActiveNode.db_id) {
                url = `/api/user/graph/memory/${selectedActiveNode.db_id}?username=${encodeURIComponent(currentUser)}`;
            } else if (selectedActiveNode.db_type === 'triple' && selectedActiveNode.db_id) {
                url = `/api/user/graph/triple/${selectedActiveNode.db_id}?username=${encodeURIComponent(currentUser)}`;
            }

            if (url) {
                const res = await fetch(url, { method: 'DELETE' });
                const data = await res.json();
                if (data.status === 'success') {
                    if (graphNodeDetails) graphNodeDetails.style.display = 'none';
                    selectedActiveNode = null;
                    await openKnowledgeGraph(); // Reload and simulate
                } else {
                    alert(data.message || 'เกิดข้อผิดพลาดในการลบข้อมูล');
                }
            } else {
                alert('ไม่พบรหัสความจำในฐานข้อมูล');
            }
        } catch (err) {
            console.error('Delete memory error:', err);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    });
}

if (btnAddMemory) {
    btnAddMemory.addEventListener('click', async () => {
        const fact = prompt('🧠 ป้อนข้อมูลหรือข้อเท็จจริงที่คุณต้องการให้คิระจดจำ (เช่น "ฉันชอบดื่มกาแฟดำไม่ใส่น้ำตาล"):');
        if (!fact || !fact.trim()) return;

        try {
            const res = await fetch('/api/user/graph/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser,
                    fact: fact.trim()
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                await openKnowledgeGraph(); // Reload and simulate
            } else {
                alert(data.message || 'เกิดข้อผิดพลาดในการบันทึกความจำ');
            }
        } catch (err) {
            console.error('Add memory error:', err);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    });
}

async function openKnowledgeGraph() {
    if (!graphModal || !graphCanvas) return;
    graphModal.style.display = 'flex';
    
    // Resize Canvas
    const container = document.getElementById('graph-canvas-container');
    graphCanvas.width = container.clientWidth;
    graphCanvas.height = container.clientHeight;
    
    try {
        const res = await fetch(`/api/user/graph/${currentUser}`);
        const data = await res.json();
        
        if (data.status === 'success' && data.graph) {
            initGraphSimulation(data.graph.nodes, data.graph.links);
        }
    } catch (e) {
        console.error("Knowledge Graph fetch error:", e);
    }
}

function initGraphSimulation(nodes, links) {
    const width = graphCanvas.width;
    const height = graphCanvas.height;
    
    // Initialize node coordinates around center
    graphNodes = nodes.map((n, i) => ({
        ...n,
        x: width / 2 + (Math.random() - 0.5) * (width * 0.6),
        y: height / 2 + (Math.random() - 0.5) * (height * 0.6),
        vx: 0,
        vy: 0,
        radius: n.size || 15
    }));
    
    graphLinks = links.map(l => {
        const sourceNode = graphNodes.find(n => n.id === l.source);
        const targetNode = graphNodes.find(n => n.id === l.target);
        return { ...l, sourceNode, targetNode };
    }).filter(l => l.sourceNode && l.targetNode);

    // Mouse Dragging & Hover Handling
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    graphCanvas.onmousedown = (e) => {
        const rect = graphCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        draggedNode = graphNodes.find(n => Math.hypot(n.x - mx, n.y - my) <= n.radius + 6);
        if (draggedNode) {
            isDragging = true;
            dragOffset.x = mx - draggedNode.x;
            dragOffset.y = my - draggedNode.y;
            showNodeDetails(draggedNode);
        } else {
            graphNodeDetails.style.display = 'none';
        }
    };

    window.onmousemove = (e) => {
        if (!isDragging || !draggedNode) return;
        const rect = graphCanvas.getBoundingClientRect();
        draggedNode.x = e.clientX - rect.left - dragOffset.x;
        draggedNode.y = e.clientY - rect.top - dragOffset.y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
    };

    window.onmouseup = () => {
        isDragging = false;
        draggedNode = null;
    };

    startPhysicsLoop();
}

function showNodeDetails(node) {
    if (!graphNodeDetails || !detailNodeName || !detailNodeDesc) return;
    detailNodeName.textContent = node.label;
    
    let info = '';
    if (node.group === 'user') {
        info = `👤 โหนดศูนย์กลางผู้ใช้งาน: <strong>${node.label}</strong> (คุณ)`;
    } else if (node.group === 'ai') {
        info = `🤖 โหนดปัญญาประดิษฐ์: <strong>Kira AI System 2.1</strong> (ผู้ช่วยอัจฉริยะ)`;
    } else if (node.full_fact) {
        info = `📝 ข้อเท็จจริงที่จดจำ: "${node.full_fact}"`;
    } else {
        info = `🏷️ โครงข่ายความสัมพันธ์: หมวดหมู่ [${node.group || 'ความจำ'}]`;
    }
    
    detailNodeDesc.innerHTML = info;
    graphNodeDetails.style.display = 'block';
}

function startPhysicsLoop() {
    const ctx = graphCanvas.getContext('2d');
    const width = graphCanvas.width;
    const height = graphCanvas.height;
    
    function tick() {
        // Physics Simulation: Spring Tension & Repulsion
        const k = 0.04;
        const repulsion = 800;
        
        // Repulsion between nodes
        for (let i = 0; i < graphNodes.length; i++) {
            for (let j = i + 1; j < graphNodes.length; j++) {
                const n1 = graphNodes[i];
                const n2 = graphNodes[j];
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist < 300) {
                    const force = repulsion / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    n1.vx -= fx;
                    n1.vy -= fy;
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }

        // Link Spring Attraction
        for (const link of graphLinks) {
            const dx = link.targetNode.x - link.sourceNode.x;
            const dy = link.targetNode.y - link.sourceNode.y;
            const dist = Math.hypot(dx, dy) || 1;
            const force = (dist - 100) * k;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            link.sourceNode.vx += fx;
            link.sourceNode.vy += fy;
            link.targetNode.vx -= fx;
            link.targetNode.vy -= fy;
        }

        // Center Gravity & Damping
        for (const n of graphNodes) {
            if (n === draggedNode) continue;
            n.vx += (width / 2 - n.x) * 0.005;
            n.vy += (height / 2 - n.y) * 0.005;
            n.vx *= 0.88;
            n.vy *= 0.88;
            n.x += n.vx;
            n.y += n.vy;
            
            // Constrain within bounds
            n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x));
            n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y));
        }

        // Render Canvas
        ctx.clearRect(0, 0, width, height);

        // Draw Links
        for (const link of graphLinks) {
            ctx.beginPath();
            ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
            ctx.lineTo(link.targetNode.x, link.targetNode.y);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Link Label
            if (link.label) {
                const midX = (link.sourceNode.x + link.targetNode.x) / 2;
                const midY = (link.sourceNode.y + link.targetNode.y) / 2;
                ctx.fillStyle = '#64748b';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(link.label, midX, midY - 3);
            }
        }

        // Draw Nodes
        for (const n of graphNodes) {
            // Glow
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = n.color ? `${n.color}33` : 'rgba(59, 130, 246, 0.2)';
            ctx.fill();

            // Core Node Circle
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            ctx.fillStyle = n.color || '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Node Text Label
            ctx.fillStyle = '#f8fafc';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(n.label, n.x, n.y + n.radius + 14);
        }

        graphAnimationId = requestAnimationFrame(tick);
    }

    if (graphAnimationId) cancelAnimationFrame(graphAnimationId);
    tick();
}
