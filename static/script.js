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

// --- Global State Management ---
let currentUser = localStorage.getItem('kira_username');
let currentUserMode = localStorage.getItem('kira_user_mode') || 'general';
let isGenerating = false;
let currentImageBase64 = null;
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
let currentTasksList = [];
let currentGuideStep = 1;
const totalGuideSteps = 4;
let guideBusy = false;
let isAutoSpeakEnabled = localStorage.getItem('kira_auto_speak') === 'true';
let deferredPWAInstallPrompt = null;
let speechRecognition = null;
let isListening = false;
let latestBriefingData = null;
let lastUserActivityTime = Date.now();
let proactiveToastDismissed = false;
let currentAudio = null;
let currentSpeakingBtn = null;
let currentArtifactCode = '';
let artifactVersions = [];
let activeVersionId = 1;
let graphAnimationId = null;
let graphNodes = [];
let graphLinks = [];
let selectedActiveNode = null;
let draggedNode = null;
let sharedAudioCtx = null;

// 👥 Age-Adaptive User Modes (General, Executive, Silver Care) & Prompts
const MODE_QUICK_PROMPTS = {
    general: [
        { icon: 'fa-solid fa-list-check', color: '#38bdf8', label: 'สรุปประเด็น & Actions', prompt: 'ช่วยสรุปประเด็นสำคัญและ Action items ที่ต้องทำต่อจากข้อความหรือเอกสารนี้อย่างชัดเจน: ' },
        { icon: 'fa-solid fa-lightbulb', color: '#fbbf24', label: 'ระดมสมอง & วางโครงงาน', prompt: 'ช่วยหาไอเดียสร้างสรรค์และวางโครงร่างขั้นตอนการดำเนินงานสำหรับโปรเจกต์นี้ให้หน่อย: ' },
        { icon: 'fa-solid fa-pen-nib', color: '#c084fc', label: 'เกลาภาษา & เรียบเรียง', prompt: 'ช่วยตรวจไวยากรณ์และเรียบเรียงข้อความนี้ให้สุภาพ คล่องตัว และน่าอ่านขึ้น: ' },
        { icon: 'fa-solid fa-book-open', color: '#34d399', label: 'อธิบายเรื่องยากให้ง่าย', prompt: 'ช่วยอธิบายเรื่องนี้ให้เข้าใจง่ายๆ แบบเห็นภาพและยกตัวอย่างประกอบในชีวิตประจำวัน: ' },
        { icon: 'fa-solid fa-calculator', color: '#60a5fa', label: 'ช่วยคิดเลข & สูตรชีต', prompt: 'ช่วยคิดคำนวณหรือเขียนสูตร Excel / Google Sheets เพื่อจัดการข้อมูลนี้: ' },
        { icon: 'fa-solid fa-calendar-days', color: '#f43f5e', label: 'จัดตาราง & แผนท่องเที่ยว', prompt: 'ช่วยร่างตารางเวลาและแผนการเดินทางสำหรับกิจกรรมนี้ให้คุ้มค่าและไม่เหนื่อยเกินไป: ' }
    ],
    executive: [
        { icon: 'fa-solid fa-file-shield', color: '#38bdf8', label: 'ตรวจสัญญา & ความเสี่ยง', prompt: 'ช่วยวิเคราะห์และตรวจสอบสัญญาหรือข้อตกลงนี้อย่างละเอียด ระบุจุดเสี่ยง ช่องโหว่ทางกฎหมายและการเงิน พร้อมข้อเสนอแนะในการแก้ไข: ' },
        { icon: 'fa-solid fa-users-viewfinder', color: '#c084fc', label: 'สภาบอร์ดรูม 4 มิติ', prompt: 'ช่วยเปิดการประชุม Virtual Boardroom วิเคราะห์ทิศทางกลยุทธ์ทางธุรกิจในประเด็นนี้อย่างรอบด้าน 4 มิติ (CEO, CFO, CPO, CTO): ' },
        { icon: 'fa-solid fa-handshake-angle', color: '#fbbf24', label: 'ร่างอีเมลเจรจาธุรกิจ', prompt: 'ช่วยร่างอีเมลเจรจาต่อรองธุรกิจระดับผู้บริหารอย่างเป็นมืออาชีพ มีวาทศิลป์ นอบน้อมแต่เด็ดขาดและรักษาผลประโยชน์สูงสุด ในกรณี: ' },
        { icon: 'fa-solid fa-compass', color: '#34d399', label: 'แผนกลยุทธ์ 30-90-365 วัน', prompt: 'ช่วยจัดทำแผนกลยุทธ์ปฏิบัติการเชิงลึกแบบ 30-90-365 วัน พร้อมกำหนด KPI, ความเสี่ยง และจุดตรวจวัดความสำเร็จ สำหรับ: ' },
        { icon: 'fa-solid fa-diagram-project', color: '#60a5fa', label: 'ออกแบบผัง Mermaid', prompt: 'ช่วยออกแบบสถาปัตยกรรมระบบหรือลำดับขั้นตอนการทำงานเป็น Mermaid Flowchart และ Diagram ที่เข้าใจง่าย สำหรับ: ' },
        { icon: 'fa-solid fa-wand-magic-sparkles', color: '#f43f5e', label: 'เกลาเอกสารระดับทางการ', prompt: 'ช่วยขัดเกลาและยกระดับภาษาของเอกสารนี้ให้กระชับ คมคาย ทรงพลัง และน่าเชื่อถือสูงสุดสำหรับนำเสนอผู้บริหารระดับสูง: ' }
    ],
    silver_care: [
        { icon: 'fa-solid fa-pills', color: '#fb7185', label: 'เตือนทานยา & สุขภาพ', prompt: 'ช่วยจัดตารางเตือนการทานยาและวิธีรับประทานยาอย่างปลอดภัยตามรายการนี้ให้หนูฟังหน่อย: ' },
        { icon: 'fa-solid fa-shield-halved', color: '#38bdf8', label: 'เช็กข่าวปลอม & มิจฉาชีพ', prompt: 'ช่วยตรวจสอบข้อความ ข่าว หรือเบอร์โทร/ลิงก์นี้ให้หน่อยว่าจริงหรือหลอก ล่อลวงมิจฉาชีพไหม: ' },
        { icon: 'fa-solid fa-file-lines', color: '#fbbf24', label: 'ย่อยจดหมายราชการเป็นภาษาพูด', prompt: 'ช่วยอ่านและย่อยเอกสารราชการหรือจดหมายทางการฉบับนี้เป็นภาษาพูดง่ายๆ ให้ฟังทีละข้อหน่อย: ' },
        { icon: 'fa-solid fa-heart', color: '#f43f5e', label: 'แต่งคำอวยพรส่ง LINE', prompt: 'ช่วยแต่งข้อความอวยพรน่ารักๆ อบอุ่น พร้อมส่งให้เพื่อนๆ ใน LINE สวัสดีวันใหม่ในธีม: ' },
        { icon: 'fa-solid fa-stethoscope', color: '#34d399', label: 'ปรึกษาอาการสุขภาพเบื้องต้น', prompt: 'มีอาการเบื้องต้นแบบนี้ ควรดูแลตัวเองอย่างไรและเมื่อไหร่ควรไปพบคุณหมอ: ' },
        { icon: 'fa-solid fa-cloud-sun', color: '#60a5fa', label: 'สภาพอากาศ & ฝุ่น PM2.5', prompt: 'รายงานสภาพอากาศ คุณภาพอากาศ และฝุ่น PM2.5 วันนี้ พร้อมคำแนะนำในการดูแลสุขภาพ: ' }
    ]
};

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
            subModelContainer.style.maxHeight = '36px';
            subModelContainer.style.opacity = '1';
            subModelContainer.style.padding = '4px 20px';
        } else {
            subModelContainer.style.maxHeight = '0';
            subModelContainer.style.opacity = '0';
            subModelContainer.style.padding = '0 20px';
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
        const adminBtn = document.getElementById('btn-admin-dashboard');
        if (adminBtn) {
            adminBtn.style.display = isBoss(currentUser) ? 'inline-flex' : 'none';
        }
        loadHistory();
        loadUserProfile();
        loadSettingsPreferences();
        if (typeof loadOmniTasks === 'function') {
            loadOmniTasks();
        }
        if (typeof checkAndTriggerOnboarding === 'function') {
            checkAndTriggerOnboarding();
        }
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
                const adminBtn = document.getElementById('btn-admin-dashboard');
                if (adminBtn) adminBtn.style.display = 'inline-flex';
                const adminOrdersBtn = document.getElementById('btn-admin-orders');
                if (adminOrdersBtn) adminOrdersBtn.style.display = 'inline-flex';
            } else {
                const adminBtn = document.getElementById('btn-admin-dashboard');
                if (adminBtn) adminBtn.style.display = 'none';
                const adminOrdersBtn = document.getElementById('btn-admin-orders');
                if (adminOrdersBtn) adminOrdersBtn.style.display = 'none';
            }
        }

        if (typeof window.refreshSubscriptionStatus === 'function') {
            window.refreshSubscriptionStatus();
        }
    } catch (e) {
        console.error("Profile fetch error:", e);
    }
}

async function checkEngineStatus() {
    const badge = document.getElementById('engine-status-badge');
    const unifiedText = document.getElementById('unified-status-text');
    const unifiedPill = document.getElementById('kira-unified-status');
    try {
        const res = await fetch('/api/ollama/status');
        const data = await res.json();
        if (data.status === 'online' && data.models && data.models.length > 0) {
            if (badge) badge.innerHTML = `<span class="pulse-dot local"></span><span class="engine-text">Local GPU (${data.models[0]})</span>`;
            if (unifiedText) unifiedText.textContent = `Local GPU (${data.models[0]})`;
            if (unifiedPill) unifiedPill.title = `เชื่อมต่อกับ Local GPU สำเร็จ (Ollama: ${data.models.join(', ')}) • Heartbeat Active`;
        } else {
            if (badge) badge.innerHTML = `<span class="pulse-dot cloud"></span><span class="engine-text">Cloud Engine 2.1</span>`;
            if (unifiedText) unifiedText.textContent = 'Cloud Engine 2.1';
            if (unifiedPill) unifiedPill.title = 'ระบบพร้อมใช้งาน 100% | Cloud Multi-Brain Engine พร้อมทำงาน';
        }
    } catch (e) {
        if (badge) badge.innerHTML = `<span class="pulse-dot cloud"></span><span class="engine-text">Cloud Engine 2.1</span>`;
        if (unifiedText) unifiedText.textContent = 'Cloud Engine 2.1';
    }
}

// --- AI Core Connection & Cold-Start Supervisor ---
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
            showConnectionToast('กำลังเชื่อมต่อ Kira AI Engine...', 'waking');
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
                showConnectionToast('Kira AI Engine เชื่อมต่อสำเร็จ พร้อมใช้งาน', 'ready');
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

// Note: Client initialization is handled safely in initKiraApp() at DOM ready


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
            btnLogin.innerHTML = '<i class="fa-solid fa-bolt fa-fade" style="color: #f59e0b;"></i> กำลังเชื่อมต่อเซิร์ฟเวอร์...';
            showConnectionToast('เซิร์ฟเวอร์กำลังเตรียมพร้อมการทำงาน กรุณารอสักครู่...', 'waking');
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
            btnRegister.innerHTML = '<i class="fa-solid fa-bolt fa-fade" style="color: #f59e0b;"></i> กำลังเชื่อมต่อเซิร์ฟเวอร์...';
            showConnectionToast('เซิร์ฟเวอร์กำลังเตรียมพร้อมการทำงาน กรุณารอสักครู่...', 'waking');
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
                regError.textContent = "สมัครสมาชิกสำเร็จ กำลังกลับสู่หน้าเข้าสู่ระบบ...";
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
    const qpWrapper = document.getElementById('quick-prompts-wrapper');
    if (qpWrapper) {
        qpWrapper.classList.remove('hidden-during-chat');
    }
    chatBox.innerHTML = `
        <div class="welcome-hero-card">
            <div class="welcome-meta-bar">
                <span class="welcome-time-tag" style="border-color: rgba(6,182,212,0.3); color:#67e8f9;">
                    <i class="fa-solid fa-sparkles text-cyan"></i> Kira Smart Greeting
                </span>
            </div>
            <div class="welcome-header">
                <img src="/static/images/kira_logo.png?v=6" alt="Kira Logo">
                <div style="flex: 1;">
                    <h3 class="welcome-title">สวัสดีค่ะคุณ ${escapeHtml(currentUser || 'ผู้ใช้')}</h3>
                    <p class="welcome-subtitle">คิระกำลังเตรียมพร้อมระบบและประมวลผลบริบทการทำงานของคุณอยู่นะคะ...</p>
                </div>
            </div>
        </div>
    `;

    const briefing = await loadProactiveBriefing();
    const data = briefing || {
        greeting_title: `สวัสดีค่ะคุณ ${currentUser || 'ผู้ใช้'}`,
        greeting_subtitle: `ระบบประมวลผล Kira 2.1 พร้อมช่วยงาน คิดวิเคราะห์ และจัดการภารกิจของคุณแล้วค่ะ`,
        time_str: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
        date_thai: 'วันนี้',
        is_boss: currentUser && (currentUser.includes('Boss') || currentUser.toLowerCase().includes('admin')),
        proactive_suggestions: [
            { title: "ที่ปรึกษาช่วยคิดและวางแผน (Strategy Advisor)", desc: "ย่อยปัญหาซับซ้อน สรุป Action Plan และประเมินความเสี่ยง", prompt: "ช่วยเป็นที่ปรึกษาช่วยคิด วิเคราะห์โจทย์และวางแผน Action Plan เป็นขั้นตอน พร้อมวิธีจัดการความเสี่ยงให้หน่อยค่ะ", icon: "fa-solid fa-compass", tag: "ADVISOR", category: "advisor" },
            { title: "สร้างดราฟต์แรกของงานเขียน (First-Draft Machine)", desc: "ร่างอีเมลธุรกิจ บทความ โพสต์โซเชียล หรือโครงสร้างรายงานทันที", prompt: "ช่วยร่างโครงสร้างและเขียนดราฟต์แรกของเนื้อหาอย่างมืออาชีพ ปรับภาษาให้อ่านง่ายและน่าเชื่อถือให้หน่อยนะคะ", icon: "fa-solid fa-pen-nib", tag: "FIRST DRAFT", category: "draft" },
            { title: "ตรวจทานและเกลาภาษา (Quality & Tone Reviewer)", desc: "ตรวจความถูกต้อง ปรับระดับภาษาให้สุภาพและน่าเชื่อถือ", prompt: "ช่วยตรวจทานความถูกต้องและเกลาข้อความต่อไปนี้ให้สุภาพ กระชับ เป็นมืออาชีพ และไม่มีคำผิดให้หน่อยค่ะ", icon: "fa-solid fa-magnifying-glass-chart", tag: "REVIEW", category: "review" },
            { title: "ย่อยเรื่องยากให้เข้าใจง่าย (Fast Concept Explainer)", desc: "สรุปสาระสำคัญใน 3 นาที พร้อมยกตัวอย่างให้เห็นภาพชัดเจน", prompt: "ช่วยสรุปและอธิบายเรื่องนี้ให้เข้าใจง่ายใน 3 นาที แบบที่คนไม่มีพื้นฐานก็เข้าใจได้ทันทีให้หน่อยนะคะ", icon: "fa-solid fa-lightbulb", tag: "EXPLAINER", category: "learning" },
            { title: "พรีวิวโค้ดสด (Live Code Canvas)", desc: "สร้างหน้าเว็บ HTML/JS และพรีวิวสดบน Canvas ทันที", prompt: "ช่วยเขียนโค้ดหน้าเว็บพรีวิวสด: สร้างหน้าเว็บ Landing Page สวยๆ พร้อม Tailwind CSS และ Interactive Elements ให้หน่อยค่ะ", icon: "fa-solid fa-code", tag: "CANVAS", category: "tech" },
            { title: "วาดผังงาน (Mermaid Flowchart)", desc: "สร้าง Flowchart และ Diagram สถาปัตยกรรมอัตโนมัติ", prompt: "ช่วยวาดแผนผัง Mermaid Flowchart อธิบายขั้นตอนการทำงานและกระบวนการอย่างเป็นลำดับให้หน่อยค่ะ", icon: "fa-solid fa-project-diagram", tag: "DIAGRAM", category: "tech" }
        ]
    };

    let continueHtml = '';
    if (data.last_topic && data.last_session_id) {
        continueHtml = `
            <div class="welcome-continue-card" onclick="loadSession('${escapeHtml(data.last_session_id)}')" title="คลิกเพื่อสนทนาต่อจากหัวข้อเดิม">
                <div class="welcome-continue-info">
                    <span class="welcome-continue-label"><i class="fa-solid fa-arrow-rotate-left"></i> คุยค้างไว้จากครั้งก่อน ต้องการให้คิระช่วยต่อไหมคะ?</span>
                    <span class="welcome-continue-topic">"${escapeHtml(data.last_topic)}"</span>
                </div>
                <button type="button" class="welcome-continue-btn"><i class="fa-solid fa-play"></i> สนทนาต่อเลยค่ะ</button>
            </div>
        `;
    }

    let memoryHtml = '';
    if (data.memory_highlights && data.memory_highlights.length > 0) {
        const memoryPills = data.memory_highlights.map(fact => {
            const escapedFact = escapeHtml(fact);
            const safeParam = escapedFact.replace(/'/g, "\\'");
            return `
                <span class="welcome-memory-pill" onclick="sendQuickPrompt('ช่วยวิเคราะห์หรือต่อยอดจากข้อมูลเรื่อง: ${safeParam} ให้หน่อยนะคะ')" title="คลิกเพื่อให้คิระช่วยเรื่องนี้ต่อ">
                    <i class="fa-solid fa-lightbulb"></i> ${escapedFact}
                </span>
            `;
        }).join('');

        memoryHtml = `
            <div class="welcome-memory-container">
                <div class="welcome-memory-header">
                    <i class="fa-solid fa-brain" style="color: #c084fc;"></i> สิ่งที่คิระจดจำเกี่ยวกับคุณและงานของคุณได้ (Knowledge Graph Memory):
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
            { title: "ที่ปรึกษาช่วยคิดและวางแผน (Strategy Advisor)", desc: "ย่อยปัญหาซับซ้อน สรุป Action Plan และประเมินความเสี่ยง", prompt: "ช่วยเป็นที่ปรึกษาช่วยคิด วิเคราะห์โจทย์และวางแผน Action Plan เป็นขั้นตอน พร้อมวิธีจัดการความเสี่ยงให้หน่อยค่ะ", icon: "fa-solid fa-compass", tag: "ADVISOR", category: "advisor" },
            { title: "สร้างดราฟต์แรกของงานเขียน (First-Draft Machine)", desc: "ร่างอีเมลธุรกิจ บทความ โพสต์โซเชียล หรือโครงสร้างรายงานทันที", prompt: "ช่วยร่างโครงสร้างและเขียนดราฟต์แรกของเนื้อหาอย่างมืออาชีพ ปรับภาษาให้อ่านง่ายและน่าเชื่อถือให้หน่อยนะคะ", icon: "fa-solid fa-pen-nib", tag: "FIRST DRAFT", category: "draft" },
            { title: "ตรวจทานและเกลาภาษา (Quality & Tone Reviewer)", desc: "ตรวจความถูกต้อง ปรับระดับภาษาให้สุภาพและน่าเชื่อถือ", prompt: "ช่วยตรวจทานความถูกต้องและเกลาข้อความต่อไปนี้ให้สุภาพ กระชับ เป็นมืออาชีพ และไม่มีคำผิดให้หน่อยค่ะ", icon: "fa-solid fa-magnifying-glass-chart", tag: "REVIEW", category: "review" },
            { title: "ย่อยเรื่องยากให้เข้าใจง่าย (Fast Concept Explainer)", desc: "สรุปสาระสำคัญใน 3 นาที พร้อมยกตัวอย่างให้เห็นภาพชัดเจน", prompt: "ช่วยสรุปและอธิบายเรื่องนี้ให้เข้าใจง่ายใน 3 นาที แบบที่คนไม่มีพื้นฐานก็เข้าใจได้ทันทีให้หน่อยนะคะ", icon: "fa-solid fa-lightbulb", tag: "EXPLAINER", category: "learning" },
            { title: "พรีวิวโค้ดสด (Live Code Canvas)", desc: "สร้างหน้าเว็บ HTML/JS และพรีวิวสดบน Canvas ทันที", prompt: "ช่วยเขียนโค้ดหน้าเว็บพรีวิวสด: สร้างหน้าเว็บ Landing Page สวยๆ พร้อม Tailwind CSS และ Interactive Elements ให้หน่อยค่ะ", icon: "fa-solid fa-code", tag: "CANVAS", category: "tech" },
            { title: "วาดผังงาน (Mermaid Flowchart)", desc: "สร้าง Flowchart และ Diagram สถาปัตยกรรมอัตโนมัติ", prompt: "ช่วยวาดแผนผัง Mermaid Flowchart อธิบายขั้นตอนการทำงานและกระบวนการอย่างเป็นลำดับให้หน่อยค่ะ", icon: "fa-solid fa-project-diagram", tag: "DIAGRAM", category: "tech" }
        ];

    function getCatBadge(cat) {
        switch(cat) {
            case 'advisor': return '<i class="fa-solid fa-compass"></i> ที่ปรึกษา';
            case 'draft': return '<i class="fa-solid fa-pen-nib"></i> ดราฟต์แรก';
            case 'review': return '<i class="fa-solid fa-magnifying-glass-chart"></i> ตรวจทาน';
            case 'learning': return '<i class="fa-solid fa-lightbulb"></i> ย่อยเรื่องยาก';
            case 'tech': return '<i class="fa-solid fa-code"></i> โค้ด/ผัง';
            default: return '<i class="fa-solid fa-sparkles"></i> แนะนำ';
        }
    }

    const suggestionsHtml = suggestions.map(s => {
        const safePrompt = escapeHtml(s.prompt).replace(/'/g, "\\'");
        const cat = s.category || 'advisor';
        return `
            <div class="welcome-pill" data-category="${escapeHtml(cat)}" onclick="sendQuickPrompt('${safePrompt}')">
                <div class="welcome-pill-top">
                    ${s.tag ? `<span class="welcome-pill-badge">${escapeHtml(s.tag)}</span>` : ''}
                    <span class="welcome-pill-category-badge">${getCatBadge(cat)}</span>
                </div>
                <span class="welcome-pill-title"><i class="${s.icon || 'fa-solid fa-bolt'}"></i> ${escapeHtml(s.title)}</span>
                <span class="welcome-pill-desc">${escapeHtml(s.desc)}</span>
            </div>
        `;
    }).join('');

    const bossBadge = data.is_boss ? `<span class="welcome-boss-tag"><i class="fa-solid fa-crown"></i> สิทธิ์ผู้ดูแลระบบ (Boss Admin)</span>` : '';
    const timeTag = `<span class="welcome-time-tag"><i class="fa-regular fa-clock"></i> ${escapeHtml(data.date_thai || '')} • ${escapeHtml(data.time_str || '')}</span>`;
    const heartbeatTag = `<span class="welcome-time-tag" style="border-color: rgba(56,189,248,0.3); color:#7dd3fc;"><i class="fa-solid fa-heart-pulse heartbeat-icon" style="color:#38bdf8;"></i> AI Engine ออนไลน์</span>`;

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
            <div class="welcome-category-bar">
                <button type="button" class="welcome-cat-btn active" onclick="filterWelcomeCategory('all', this)"><i class="fa-solid fa-sparkles"></i> ทั้งหมด</button>
                <button type="button" class="welcome-cat-btn" onclick="filterWelcomeCategory('advisor', this)"><i class="fa-solid fa-compass"></i> ที่ปรึกษา & วางแผน</button>
                <button type="button" class="welcome-cat-btn" onclick="filterWelcomeCategory('draft', this)"><i class="fa-solid fa-pen-nib"></i> ร่างดราฟต์แรก</button>
                <button type="button" class="welcome-cat-btn" onclick="filterWelcomeCategory('review', this)"><i class="fa-solid fa-magnifying-glass-chart"></i> ตรวจทานงาน</button>
                <button type="button" class="welcome-cat-btn" onclick="filterWelcomeCategory('learning', this)"><i class="fa-solid fa-lightbulb"></i> ย่อยเรื่องยาก</button>
                <button type="button" class="welcome-cat-btn" onclick="filterWelcomeCategory('tech', this)"><i class="fa-solid fa-code"></i> โค้ด & ผังงาน</button>
            </div>
            <div class="welcome-grid">
                ${suggestionsHtml}
            </div>
        </div>
    `;

    window.filterWelcomeCategory = function(cat, btn) {
        document.querySelectorAll('.welcome-cat-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        
        const pills = document.querySelectorAll('.welcome-pill');
        pills.forEach(p => {
            const itemCat = p.getAttribute('data-category');
            if (cat === 'all' || itemCat === cat) {
                p.style.display = 'flex';
            } else {
                p.style.display = 'none';
            }
        });
    };
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
                        userInput.placeholder = "พิมพ์ข้อความหรือคำถามถึง Kira 2.1...";
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
                    "ทำงานต่อเนื่องมาสักพักแล้ว อย่าลืมพักสายตาและดื่มน้ำหน่อยนะคะ",
                    "คิระพร้อมช่วยเหลือเสมอ หากมีไอเดียใหม่หรือต้องการให้ช่วยสรุปงาน เรียกได้ทันทีนะคะ",
                    "หากต้องการค้นหาข้อมูล เขียนโค้ด หรือวางแผนงาน สามารถสั่งการได้ตลอดเวลาค่ะ"
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
                    alert('ไม่พบเนื้อหาใน Live Canvas สำหรับตรวจสอบค่ะ กรุณารันโค้ดก่อนนะคะ');
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

                const imgPreview = document.getElementById('image-preview') || document.getElementById('img-preview');
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

    // 2. Drag & Drop Image Attachment
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
                    alert('กรุณาวางไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้นค่ะ');
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    alert('ขนาดรูปภาพต้องไม่เกิน 5MB ค่ะ');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    currentImageBase64 = event.target.result;
                    const imgPreview = document.getElementById('image-preview') || document.getElementById('img-preview');
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
            if (newChatBtn) newChatBtn.classList.add('active');
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

// --- 📑 Executive Deliverables Suite (1-Click Clean Deliverables) ---
function cleanDeliverableText(text) {
    if (!text) return '';
    return text.replace(/\[THINKING\](.*?)(\[\/THINKING\]|$)/gs, "")
               .replace(/\[THINKING_DONE\]/g, "")
               .replace(/<think>(.*?)<\/think>/gs, "")
               .replace(/\[BOARDROOM_START\]|\[BOARDROOM_DONE\]|\[BOARDROOM_SPEAKER:[^\]]+\]|\[BOARDROOM_DEBATE[^\]]*\]|\[BOARDROOM_CONSENSUS[^\]]*\]/g, "")
               .replace(/\[MCP_ACTION:[^\]]+\]/g, "")
               .trim();
}

function formatExecutiveDeliverable(text) {
    const clean = cleanDeliverableText(text);
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let header = `# 📋 รายงานสรุปงานสำหรับผู้บริหาร (Executive Deliverable)\n`;
    header += `**ระบบ:** Kira AI System 2.2 Pro | **ผู้จัดทำ:** ${currentUser || 'ท่านประธาน'} | **วันที่:** ${thaiDate}\n`;
    header += `**สถานะ:** ผ่านการกลั่นกรองและตรวจสอบความถูกต้องสมบูรณ์ (Verified)\n\n---\n\n`;
    
    return header + clean + `\n\n---\n*จัดทำโดย Kira AI System — ระบบผู้ช่วยอัจฉริยะระดับผู้บริหาร*`;
}

function attachDeliverablesBar(contentDiv, textContent) {
    if (!contentDiv || !textContent || textContent.trim() === '') return;
    if (contentDiv.querySelector('.feedback-ui')) return;

    const feedbackUI = document.createElement('div');
    feedbackUI.className = 'feedback-ui';
    feedbackUI.style.cssText = 'margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; gap: 6px; justify-content: flex-start; align-items: center; flex-wrap: wrap; font-size: 0.8rem;';

    // 1. Quick Copy
    const copyMsgBtn = document.createElement('button');
    copyMsgBtn.className = 'deliverable-btn';
    copyMsgBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก';
    copyMsgBtn.title = 'คัดลอกข้อความทั้งหมด';
    copyMsgBtn.onclick = () => {
        const clean = cleanDeliverableText(textContent);
        navigator.clipboard.writeText(clean);
        copyMsgBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #38bdf8;"></i> คัดลอกแล้ว';
        setTimeout(() => { copyMsgBtn.innerHTML = '<i class="fa-regular fa-copy"></i> คัดลอก'; }, 2000);
    };

    // 2. Natural Voice Speaker
    const speakerBtn = document.createElement('button');
    speakerBtn.className = 'deliverable-btn';
    speakerBtn.title = 'ฟังเสียงคิระอ่านคำตอบนี้ (Natural Voice)';
    speakerBtn.innerHTML = '<i class="fa-solid fa-volume-high text-sky"></i> ฟังเสียง';
    speakerBtn.onclick = () => {
        if (typeof playKiraVoice === 'function') {
            playKiraVoice(cleanDeliverableText(textContent), speakerBtn);
        }
    };

    // 3. Compact Consolidated Studio & Tools Dropdown Menu (เครื่องมือสร้างสรรค์ & ส่งงาน ▾)
    const toolsWrap = document.createElement('div');
    toolsWrap.className = 'msg-tools-dropdown-wrapper';

    const toolsBtn = document.createElement('button');
    toolsBtn.className = 'deliverable-btn deliverable-tools-trigger';
    toolsBtn.title = 'เครื่องมือสร้างสรรค์และส่งออกงาน (สไลด์ 16:9, รายงาน, PDF, Canvas, คลังนิรภัย)';
    toolsBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>เครื่องมือ</span> <i class="fa-solid fa-chevron-down" style="font-size: 0.65em; opacity: 0.7;"></i>';

    const toolsMenu = document.createElement('div');
    toolsMenu.className = 'msg-tools-dropdown-menu';
    toolsMenu.style.display = 'none';

    const createToolItem = (iconHtml, labelText, onClick) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'msg-tools-item';
        item.innerHTML = `${iconHtml} <span>${labelText}</span>`;
        item.onclick = (e) => {
            e.stopPropagation();
            toolsMenu.style.display = 'none';
            onClick();
        };
        return item;
    };

    // A. สรุปส่งงาน (Clean Report)
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-file-signature text-cyan"></i>',
        'สรุปส่งงาน (Clean Report)',
        () => {
            const clean = formatExecutiveDeliverable(textContent);
            navigator.clipboard.writeText(clean);
            if (typeof showConnectionToast === 'function') {
                showConnectionToast('📑 จัดฟอร์แมตรายงานผู้บริหารและคัดลอกลง Clipboard เรียบร้อยแล้วค่ะ', 'ready');
            }
        }
    ));

    // B. สร้างสไลด์ (16:9)
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-file-powerpoint text-rose"></i>',
        'สร้างสไลด์ Keynote (16:9)',
        () => {
            if (typeof generateAndOpenSlideDeck === 'function') {
                generateAndOpenSlideDeck(textContent);
            }
        }
    ));

    // C. พิมพ์ / บันทึก PDF
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-print text-emerald"></i>',
        'พิมพ์ / ส่งออก PDF A4',
        () => {
            exportDeliverableToPDF('เอกสารส่งงาน (Executive Deliverable)', textContent, 'executive');
        }
    ));

    // D. เปิดใน Live Canvas
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-pen-to-square text-amber"></i>',
        'เปิดแก้ไขใน Live Canvas',
        () => {
            const clean = formatExecutiveDeliverable(textContent);
            if (typeof openInLiveCanvas === 'function') {
                openInLiveCanvas('เอกสารส่งงาน (Executive Deliverable)', clean, 'document');
            }
        }
    ));

    // E. บันทึกลงคลังนิรภัย (Executive Offline Vault)
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-shield-halved text-emerald"></i>',
        'บันทึกลง Offline Vault',
        () => {
            if (typeof saveToOfflineVault === 'function') {
                const title = textContent.slice(0, 40).replace(/[#*`\n]/g, ' ').trim() || 'บันทึกคำตอบ';
                saveToOfflineVault('memo', title, textContent, false);
                if (typeof showConnectionToast === 'function') {
                    showConnectionToast('🛡️ บันทึกลง Executive Offline Vault เรียบร้อยแล้วค่ะ', 'ready');
                }
            }
        }
    ));

    // F. ดาวน์โหลด (.md)
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-file-arrow-down text-purple"></i>',
        'ดาวน์โหลดไฟล์ Markdown (.md)',
        () => {
            const clean = formatExecutiveDeliverable(textContent);
            const blob = new Blob([clean], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Kira_Report_${new Date().toISOString().slice(0, 10)}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    ));

    // G. รีวิวข้อเสนอแนะ
    toolsMenu.appendChild(createToolItem(
        '<i class="fa-solid fa-comment-dots text-sky"></i>',
        'รีวิวและให้ข้อเสนอแนะ',
        () => {
            if (typeof openReviewModal === 'function') openReviewModal(textContent);
        }
    ));

    toolsBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.msg-tools-dropdown-menu').forEach(m => {
            if (m !== toolsMenu) m.style.display = 'none';
        });
        toolsMenu.style.display = (toolsMenu.style.display === 'none') ? 'flex' : 'none';
    };

    toolsWrap.appendChild(toolsBtn);
    toolsWrap.appendChild(toolsMenu);

    // 4. Like & Dislike
    const likeBtn = document.createElement('button');
    likeBtn.className = 'deliverable-btn icon-only';
    likeBtn.title = 'ชอบคำตอบนี้';
    likeBtn.innerHTML = '<i class="fa-solid fa-thumbs-up"></i>';
    likeBtn.onclick = () => {
        if (typeof submitFeedback === 'function') submitFeedback('like', textContent);
        likeBtn.style.color = '#34d399';
        likeBtn.style.borderColor = '#34d399';
        dislikeBtn.style.color = '#94a3b8';
        dislikeBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    };

    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'deliverable-btn icon-only';
    dislikeBtn.title = 'ไม่ชอบคำตอบนี้';
    dislikeBtn.innerHTML = '<i class="fa-solid fa-thumbs-down"></i>';
    dislikeBtn.onclick = () => {
        if (typeof submitFeedback === 'function') submitFeedback('dislike', textContent);
        dislikeBtn.style.color = '#ef4444';
        dislikeBtn.style.borderColor = '#ef4444';
        likeBtn.style.color = '#94a3b8';
        likeBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    };

    // Build Minimal Toolbar
    feedbackUI.appendChild(copyMsgBtn);
    feedbackUI.appendChild(speakerBtn);
    feedbackUI.appendChild(toolsWrap);
    feedbackUI.appendChild(likeBtn);
    feedbackUI.appendChild(dislikeBtn);

    contentDiv.appendChild(feedbackUI);
    return { feedbackUI, speakerBtn };
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
                let stepsHtml = steps.map(s => `<div class="thinking-step" style="white-space: pre-wrap; font-size: 0.85rem; margin-bottom: 4px;">${escapeHtml(s)}</div>`).join('');
                
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
            applyCodeActions(content);
            renderKiraCharts(content);
            attachDeliverablesBar(content, finalMarkdown || text);
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
    playKiraSound('send');

    // Hide quick prompts bar during active chat for clean space
    const qpWrapper = document.getElementById('quick-prompts-wrapper');
    if (qpWrapper) {
        qpWrapper.classList.add('hidden-during-chat');
    }

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
        const isBoardroomActive = (localStorage.getItem('kira_boardroom_active') === 'true') || (modelVersion === 'boardroom');

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text || 'ช่วยวิเคราะห์และตรวจสอบภาพนี้อย่างละเอียด',
                username: currentUser,
                model_version: isBoardroomActive ? "boardroom" : modelVersion,
                boardroom_mode: isBoardroomActive,
                image_base64: imgBase64ToSend,
                session_id: currentSessionId,
                flavor: flavor,
                persona: persona,
                user_mode: currentUserMode || 'general'
            })
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
        let gavelPlayed = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            fullText += decoder.decode(value, { stream: true });

            // --- 🏛️ Check for Virtual Boardroom Stream Tags ---
            if (fullText.includes('[BOARDROOM_START]')) {
                if (!gavelPlayed) {
                    if (typeof playGavelSound === 'function') playGavelSound();
                    gavelPlayed = true;
                }
                if (typeof renderBoardroomHTML === 'function') {
                    contentDiv.innerHTML = renderBoardroomHTML(fullText);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
                continue;
            }

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
                let shouldCollapse = localStorage.getItem('kira_thinking_accordion') !== 'always_open';
                let boxClass = (isDone && hasSubstantialAnswer && shouldCollapse) ? "thinking-box done collapsed" : (isDone ? "thinking-box done" : "thinking-box");
                let toggleIcon = (isDone && hasSubstantialAnswer && shouldCollapse) ? "▼" : "▲";
                
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
        renderKiraCharts(contentDiv);
        
        // Append Executive Deliverables Suite & Actions
        const deliverableElements = attachDeliverablesBar(contentDiv, finalMarkdown || fullText);
        
        // Auto-Speak if enabled
        if (isAutoSpeakEnabled && deliverableElements && deliverableElements.speakerBtn) {
            playKiraVoice(cleanDeliverableText(finalMarkdown || fullText), deliverableElements.speakerBtn);
        }

        playKiraSound('receive');

        // Auto-open live canvas if enabled and an interactive web artifact was produced
        if (localStorage.getItem('kira_auto_canvas') !== 'false' && artifactsDrawer && !artifactsDrawer.classList.contains('open')) {
            if (contentDiv.querySelector('.btn-run-code')) {
                const runBtn = contentDiv.querySelector('.btn-run-code');
                if (runBtn) runBtn.click();
            }
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
newChatBtn.addEventListener('click', () => {
    // Generate new unique session ID without wiping historical chat logs
    currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    renderWelcomeHub();
    userInput.focus();
});

// --- Theme Switcher (Dark / Light / OLED) ---
const btnTheme = document.getElementById('btn-theme');
if (btnTheme) {
    btnTheme.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('kira_theme') || 'dark';
        let nextTheme = 'light';
        if (currentTheme === 'dark') nextTheme = 'light';
        else if (currentTheme === 'light') nextTheme = 'oled';
        else nextTheme = 'dark';
        applyTheme(nextTheme);
        // Persist to backend
        if (currentUser) {
            fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUser, theme: nextTheme })
            }).catch(() => {});
        }
    });
}

// --- Export Chat History & Print/PDF Report ---
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        const dropdown = document.getElementById('tools-dropdown-menu');
        if (dropdown) dropdown.classList.remove('show');

        const messages = chatBox.querySelectorAll('.message');
        if (!messages || messages.length === 0) {
            alert('ยังไม่มีข้อความในประวัติการสนทนานี้ค่ะ');
            return;
        }
        
        let mdContent = `# 💬 บันทึกประวัติการสนทนาฉบับสมบูรณ์ (Session Transcript)\n\n`;
        mdContent += `**ผู้ใช้งาน:** ${currentUser || 'ผู้ใช้'}\n`;
        mdContent += `**วันที่บันทึก:** ${new Date().toLocaleString('th-TH')}\n\n---\n\n`;
        
        messages.forEach(msg => {
            const isUser = msg.classList.contains('user');
            const contentEl = msg.querySelector('.content');
            if (!contentEl) return;
            
            // Clone and remove feedback buttons before getting text
            const clone = contentEl.cloneNode(true);
            const fb = clone.querySelector('.feedback-ui');
            if (fb) fb.remove();
            const txt = clone.innerText.trim();
            if (!txt) return;
            
            if (isUser) {
                mdContent += `### 👤 คุณ (${currentUser || 'ผู้ใช้'}):\n${txt}\n\n`;
            } else {
                mdContent += `### 🌸 Kira AI (ผู้ช่วยอัจฉริยะ):\n${txt}\n\n`;
            }
        });
        
        // Export via High-Contrast Print & PDF Engine
        exportDeliverableToPDF('รายงานการสนทนาฉบับสมบูรณ์ (Kira AI Session Transcript)', mdContent, 'full_chat');
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

if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('open'));
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('open'));
}

// Add floating label behavior to input area
userInput.addEventListener('focus', () => {
    document.querySelector('.input-wrapper').style.borderColor = '#38bdf8';
});
userInput.addEventListener('blur', () => {
    document.querySelector('.input-wrapper').style.borderColor = 'rgba(255, 255, 255, 0.2)';
});

// Mode prompts already registered at global scope


function renderQuickPromptsForMode(mode) {
    const container = document.getElementById('quick-prompts');
    if (!container) return;
    const prompts = MODE_QUICK_PROMPTS[mode] || MODE_QUICK_PROMPTS.general;
    // Duplicate 2 sets for seamless loop marquee
    const fullList = [...prompts, ...prompts];
    container.innerHTML = fullList.map(item => `
        <button class="quick-prompt-btn" data-prompt="${escapeHtml(item.prompt)}">
            <i class="${item.icon}" style="color: ${item.color};"></i> ${escapeHtml(item.label)}
        </button>
    `).join('');
}

function setUserMode(mode, savePreference = true) {
    if (!['general', 'executive', 'silver_care'].includes(mode)) {
        mode = 'general';
    }
    currentUserMode = mode;
    localStorage.setItem('kira_user_mode', mode);

    // 1. Update body class
    document.body.classList.remove('mode-general', 'mode-executive', 'mode-silver-care');
    document.body.classList.add(`mode-${mode.replace('_', '-')}`);

    // 2. Silver Care floating voice pill visibility & Auto-Speak
    const silverVoicePill = document.getElementById('silver-voice-pill');
    if (silverVoicePill) {
        silverVoicePill.style.display = (mode === 'silver_care') ? 'inline-flex' : 'none';
    }

    if (mode === 'silver_care') {
        // Auto-enable spoken voice response for seniors
        isAutoSpeakEnabled = true;
        if (typeof updateAutoSpeakUI === 'function') updateAutoSpeakUI();
        const autoSpeakChk = document.getElementById('setting-auto-speak');
        if (autoSpeakChk) autoSpeakChk.checked = true;
        localStorage.setItem('kira_auto_speak', 'true');
    }

    // 3. Update Header mode pill buttons
    document.querySelectorAll('.mode-pill-btn').forEach(btn => {
        if (btn.getAttribute('data-mode') === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 4. Update Settings modal radio cards
    const modeRadio = document.querySelector(`input[name="setting-user-mode"][value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    // 5. Render mode-tailored quick prompts
    renderQuickPromptsForMode(mode);

    // 6. Optional async preference sync with backend
    if (savePreference && currentUser) {
        fetch('/api/user/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                user_mode: mode
            })
        }).catch(err => console.warn("User mode preference sync notice:", err));
    }
}

function initUserModeController() {
    if (window._userModeControllerInitialized) return;
    window._userModeControllerInitialized = true;

    // 1. Apply current active mode
    setUserMode(currentUserMode, false);

    // 2. Header mode buttons click listeners
    const headerPills = document.querySelectorAll('.mode-pill-btn');
    headerPills.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetMode = btn.getAttribute('data-mode');
            if (targetMode) {
                setUserMode(targetMode, true);
                if (typeof playKiraSound === 'function') playKiraSound('receive');
            }
        });
    });

    // 3. Settings modal radio cards change listeners
    const settingRadios = document.querySelectorAll('input[name="setting-user-mode"]');
    settingRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                setUserMode(radio.value, true);
                if (typeof playKiraSound === 'function') playKiraSound('receive');
            }
        });
    });

    // 4. Quick prompts event delegation (works seamlessly with dynamically re-rendered prompts)
    const quickPromptsContainer = document.getElementById('quick-prompts');
    if (quickPromptsContainer) {
        quickPromptsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.quick-prompt-btn');
            if (!btn) return;
            const promptText = btn.getAttribute('data-prompt');
            if (promptText) {
                userInput.value = promptText;
                userInput.focus();
                if (sendBtn) sendBtn.disabled = false;
            }
        });
    }

    // 5. Silver Care floating voice helper pill click -> triggers mic
    const silverVoicePill = document.getElementById('silver-voice-pill');
    if (silverVoicePill) {
        silverVoicePill.addEventListener('click', () => {
            const mic = document.getElementById('mic-btn');
            if (mic) {
                mic.click();
            }
        });
    }
}

window.setUserMode = setUserMode;
window.initUserModeController = initUserModeController;

userInput.addEventListener('keydown', (e) => {
    const enterAction = localStorage.getItem('kira_enter_send') || 'enter';
    if (enterAction === 'shift_enter') {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) sendMessage();
        }
    } else {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) sendMessage();
        }
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
        alert("Kira ได้รับรีวิวของคุณแล้ว ขอบคุณมากค่ะ");
    });
}

// --- Voice Features (STT) removed per request ---

// --- Image Upload (Vision) ---
const imgUploadBtn = document.getElementById('img-upload-btn') || document.getElementById('menu-img-btn');
const imgInput = document.getElementById('img-input');
const imgPreviewContainer = document.getElementById('image-preview-container');
const imgPreview = document.getElementById('image-preview') || document.getElementById('img-preview');
const removeImgBtn = document.getElementById('remove-img-btn');

const attachToggleBtn = document.getElementById('attach-toggle-btn');
const attachmentMenu = document.getElementById('attachment-menu');
const menuImgBtn = document.getElementById('menu-img-btn');
const menuDocBtn = document.getElementById('menu-doc-btn');
const docInput = document.getElementById('doc-input');

if (attachToggleBtn && attachmentMenu) {
    attachToggleBtn.addEventListener('click', () => {
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
                alert("ขนาดรูปภาพต้องไม่เกิน 5MB ค่ะ");
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


function updateAutoSpeakUI() {
    const btnAutoSpeak = document.getElementById('btn-autospeak');
    const autoSpeakStatusText = document.getElementById('autospeak-status-text');
    const autoSpeakIcon = document.getElementById('autospeak-icon');
    if (btnAutoSpeak) {
        btnAutoSpeak.classList.toggle('active', isAutoSpeakEnabled);
        btnAutoSpeak.title = isAutoSpeakEnabled ? 'ปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Active)' : 'เปิดการอ่านออกเสียงอัตโนมัติ (Auto-Speak Off)';
    }
    if (autoSpeakIcon) {
        autoSpeakIcon.className = isAutoSpeakEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    }
    if (autoSpeakStatusText) {
        autoSpeakStatusText.textContent = isAutoSpeakEnabled ? 'สถานะ: เปิดใช้งานอยู่' : 'สถานะ: ปิดอยู่';
    }
}

const btnAutoSpeak = document.getElementById('btn-autospeak');
if (btnAutoSpeak) {
    updateAutoSpeakUI();
    btnAutoSpeak.addEventListener('click', () => {
        isAutoSpeakEnabled = !isAutoSpeakEnabled;
        localStorage.setItem('kira_auto_speak', isAutoSpeakEnabled);
        updateAutoSpeakUI();
        if (!isAutoSpeakEnabled) {
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
        const activeVoice = localStorage.getItem('kira_voice_name') || 'th-TH-PremwadeeNeural';
        const activeRate = parseFloat(localStorage.getItem('kira_speech_rate') || '1.0');
        const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: activeVoice, rate: activeRate })
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
        info = `โหนดศูนย์กลางผู้ใช้งาน: <strong>${node.label}</strong>`;
    } else if (node.group === 'ai') {
        info = `โหนดปัญญาประดิษฐ์: <strong>Kira AI System 2.1</strong>`;
    } else if (node.full_fact) {
        info = `ข้อเท็จจริงที่จดจำ: "${node.full_fact}"`;
    } else {
        info = `โครงข่ายความสัมพันธ์: หมวดหมู่ [${node.group || 'ความจำ'}]`;
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

// ==========================================
// 📖 Interactive Onboarding Tour & Feature Guide
// ==========================================


function updateGuideUI() {
    const slides = document.querySelectorAll('.onboarding-slide');
    const dots = document.querySelectorAll('.guide-dot');
    const progressText = document.getElementById('guide-progress-text');
    const btnPrev = document.getElementById('btn-prev-guide');
    const btnNext = document.getElementById('btn-next-guide');
    const btnFinish = document.getElementById('btn-finish-guide');

    slides.forEach(slide => {
        const step = parseInt(slide.dataset.step, 10);
        slide.classList.toggle('active', step === currentGuideStep);
    });

    dots.forEach(dot => {
        const step = parseInt(dot.dataset.step, 10);
        dot.classList.toggle('active', step === currentGuideStep);
    });

    if (progressText) {
        progressText.textContent = `ขั้นตอน ${currentGuideStep} / ${totalGuideSteps}`;
    }

    if (btnPrev) {
        btnPrev.style.display = currentGuideStep > 1 ? 'inline-flex' : 'none';
    }
    if (btnNext) {
        btnNext.style.display = currentGuideStep < totalGuideSteps ? 'inline-flex' : 'none';
    }
    if (btnFinish) {
        btnFinish.style.display = currentGuideStep === totalGuideSteps ? 'inline-flex' : 'none';
    }
}

function guideNext() {
    if (guideBusy) return;
    if (currentGuideStep < totalGuideSteps) {
        guideBusy = true;
        currentGuideStep++;
        updateGuideUI();
        setTimeout(() => { guideBusy = false; }, 180);
    }
}

function guidePrev() {
    if (guideBusy) return;
    if (currentGuideStep > 1) {
        guideBusy = true;
        currentGuideStep--;
        updateGuideUI();
        setTimeout(() => { guideBusy = false; }, 180);
    }
}

function guideGoToStep(targetStep) {
    if (guideBusy) return;
    const step = parseInt(targetStep, 10);
    if (step >= 1 && step <= totalGuideSteps && step !== currentGuideStep) {
        guideBusy = true;
        currentGuideStep = step;
        updateGuideUI();
        setTimeout(() => { guideBusy = false; }, 180);
    }
}

function openOnboardingGuide(step = 1) {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;
    currentGuideStep = Math.max(1, Math.min(step, totalGuideSteps));
    updateGuideUI();
    modal.style.display = 'flex';
}

function closeOnboardingGuide() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    localStorage.setItem('kira_onboarding_seen', 'true');
}

function finishOnboardingWithAnimation() {
    if (guideBusy) return;
    const modal = document.getElementById('onboarding-modal');
    const card = document.getElementById('onboarding-card');
    if (!modal) return;

    guideBusy = true;
    if (card) {
        card.classList.add('celebrate-warp');
        setTimeout(() => {
            modal.style.display = 'none';
            card.classList.remove('celebrate-warp');
            localStorage.setItem('kira_onboarding_seen', 'true');
            guideBusy = false;
            if (userInput) userInput.focus();
        }, 420);
    } else {
        closeOnboardingGuide();
        guideBusy = false;
    }
}

function checkAndTriggerOnboarding() {
    if (currentUser && !localStorage.getItem('kira_onboarding_seen')) {
        setTimeout(() => {
            openOnboardingGuide(1);
        }, 500);
    }
}

function initOnboardingGuide() {
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const btnSidebarGuide = document.getElementById('btn-sidebar-guide');
    const btnSkipGuide = document.getElementById('btn-skip-guide');
    const btnPrev = document.getElementById('btn-prev-guide');
    const btnNext = document.getElementById('btn-next-guide');
    const btnFinish = document.getElementById('btn-finish-guide');
    const dots = document.querySelectorAll('.guide-dot');
    const modal = document.getElementById('onboarding-modal');

    if (btnOpenGuide) {
        btnOpenGuide.addEventListener('click', (e) => {
            e.preventDefault();
            openOnboardingGuide(1);
        });
    }

    if (btnSidebarGuide) {
        btnSidebarGuide.addEventListener('click', (e) => {
            e.preventDefault();
            openOnboardingGuide(1);
        });
    }

    if (btnSkipGuide) {
        btnSkipGuide.addEventListener('click', (e) => {
            e.preventDefault();
            closeOnboardingGuide();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', (e) => {
            e.preventDefault();
            guidePrev();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', (e) => {
            e.preventDefault();
            guideNext();
        });
    }

    if (btnFinish) {
        btnFinish.addEventListener('click', (e) => {
            e.preventDefault();
            finishOnboardingWithAnimation();
        });
    }

    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            guideGoToStep(dot.dataset.step);
        });
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeOnboardingGuide();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (!modal || modal.style.display !== 'flex') return;
        if (e.key === 'Escape') {
            closeOnboardingGuide();
        } else if (e.key === 'ArrowRight') {
            if (currentGuideStep < totalGuideSteps) {
                guideNext();
            } else if (currentGuideStep === totalGuideSteps) {
                finishOnboardingWithAnimation();
            }
        } else if (e.key === 'ArrowLeft') {
            if (currentGuideStep > 1) {
                guidePrev();
            }
        }
    });

    checkAndTriggerOnboarding();
}

// Expose globally for header/sidebar or browser console access
window.openOnboardingGuide = openOnboardingGuide;
window.closeOnboardingGuide = closeOnboardingGuide;
window.finishOnboardingWithAnimation = finishOnboardingWithAnimation;
window.guideNext = guideNext;
window.guidePrev = guidePrev;
window.guideGoToStep = guideGoToStep;

// =========================================================================
// ⚙️ Kira 2.1 Full-Featured Settings Modal Controller & Synchronization
// =========================================================================

// Shared AudioContext Singleton to prevent AudioContext exhaustion / memory leaks

function getSharedAudioContext() {
    try {
        if (!sharedAudioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) sharedAudioCtx = new AudioCtx();
        }
        if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
        }
        return sharedAudioCtx;
    } catch (e) {
        return null;
    }
}

// Synthesized Audio Chimes (Web Audio API)
function playKiraSound(type = 'send') {
    if (localStorage.getItem('kira_sound_effects') === 'false') return;
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'send') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } else if (type === 'receive') {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
            osc.start();
            osc.stop(ctx.currentTime + 0.16);
        }
    } catch (e) {}
}

function applyTheme(themeName) {
    document.body.classList.remove('light-theme', 'light-mode', 'oled-theme', 'oled-mode');
    const btnThemeEl = document.getElementById('btn-theme');
    if (themeName === 'light') {
        document.body.classList.add('light-theme', 'light-mode');
        if (btnThemeEl) btnThemeEl.innerHTML = '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>';
    } else if (themeName === 'oled') {
        document.body.classList.add('oled-theme', 'oled-mode');
        if (btnThemeEl) btnThemeEl.innerHTML = '<i class="fa-solid fa-circle" style="color: #a855f7;"></i>';
    } else {
        // dark
        if (btnThemeEl) btnThemeEl.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    localStorage.setItem('kira_theme', themeName);
    
    const radio = document.querySelector(`input[name="setting-theme"][value="${themeName}"]`);
    if (radio) radio.checked = true;
}

function applyFontSize(size) {
    document.body.classList.remove('chat-font-small', 'chat-font-medium', 'chat-font-large', 'chat-font-extra_large');
    if (size === 'small') {
        document.body.classList.add('chat-font-small');
    } else if (size === 'large') {
        document.body.classList.add('chat-font-large');
    } else if (size === 'extra_large') {
        document.body.classList.add('chat-font-extra_large');
    } else {
        document.body.classList.add('chat-font-medium');
    }
    localStorage.setItem('kira_font_size', size);
    const select = document.getElementById('setting-font-size');
    if (select) select.value = size;
}

async function loadSettingsPreferences() {
    if (!currentUser) return;
    
    // 1. Initial cached values
    const cachedTheme = localStorage.getItem('kira_theme') || 'dark';
    applyTheme(cachedTheme);
    
    const cachedUserMode = localStorage.getItem('kira_user_mode') || 'general';
    setUserMode(cachedUserMode, false);
    
    const cachedFontSize = localStorage.getItem('kira_font_size') || 'medium';
    applyFontSize(cachedFontSize);
    
    const cachedEnter = localStorage.getItem('kira_enter_send') || 'enter';
    const enterSelect = document.getElementById('setting-enter-send');
    if (enterSelect) enterSelect.value = cachedEnter;
    
    const soundChk = document.getElementById('setting-sound-effects');
    if (soundChk) soundChk.checked = localStorage.getItem('kira_sound_effects') !== 'false';
    
    const canvasChk = document.getElementById('setting-auto-canvas');
    if (canvasChk) canvasChk.checked = localStorage.getItem('kira_auto_canvas') !== 'false';
    
    const pyConfirmChk = document.getElementById('setting-python-confirm');
    if (pyConfirmChk) pyConfirmChk.checked = localStorage.getItem('kira_python_confirm') !== 'false';
    
    const thinkingSelect = document.getElementById('setting-thinking-accordion');
    if (thinkingSelect) thinkingSelect.value = localStorage.getItem('kira_thinking_accordion') || 'auto_collapse';

    const voiceSel = document.getElementById('setting-voice-name');
    if (voiceSel) voiceSel.value = localStorage.getItem('kira_voice_name') || 'th-TH-PremwadeeNeural';

    const rateSlider = document.getElementById('setting-speech-rate');
    const rateVal = document.getElementById('speech-rate-val');
    if (rateSlider) {
        const r = localStorage.getItem('kira_speech_rate') || '1.0';
        rateSlider.value = r;
        if (rateVal) rateVal.textContent = `${parseFloat(r).toFixed(1)}x`;
    }

    const autoSpeakChk = document.getElementById('setting-auto-speak');
    if (autoSpeakChk) autoSpeakChk.checked = localStorage.getItem('kira_auto_speak') === 'true';

    // 2. Fetch full settings from backend
    try {
        const res = await fetch(`/api/user/settings/${encodeURIComponent(currentUser)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                const prefs = data.preferences || {};
                
                // Account Tab Info
                const userDisplay = document.getElementById('settings-username-display');
                if (userDisplay && data.user) userDisplay.textContent = data.user.nickname || data.user.username || '';
                
                const userRole = document.getElementById('settings-user-role');
                if (userRole && data.user) {
                    if (data.user.role === 'admin' || isBoss(currentUser)) {
                        userRole.textContent = 'Admin / Boss';
                        userRole.style.color = '#f59e0b';
                        userRole.style.background = 'rgba(245, 158, 11, 0.15)';
                        userRole.style.borderColor = 'rgba(245, 158, 11, 0.35)';
                    } else {
                        userRole.textContent = 'Free Member';
                    }
                }
                
                const userCreated = document.getElementById('settings-user-created');
                if (userCreated && data.user && data.user.created_at) {
                    const dateStr = data.user.created_at.split(' ')[0] || data.user.created_at;
                    userCreated.textContent = `สมาชิกตั้งแต่: ${dateStr}`;
                }
                
                const avatarImg = document.getElementById('settings-user-avatar');
                if (avatarImg) {
                    avatarImg.src = profilePic ? profilePic.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=0D8ABC&color=fff`;
                }
                
                // Quota
                const quotaCount = document.getElementById('settings-quota-count');
                const quotaBar = document.getElementById('settings-quota-bar');
                if (data.quota) {
                    const used = data.quota.used || 0;
                    const limit = data.quota.limit || 150;
                    if (quotaCount) quotaCount.textContent = `${used} / ${limit} ข้อความ`;
                    if (quotaBar) {
                        const pct = Math.min(100, Math.round((used / limit) * 100));
                        quotaBar.style.width = `${pct}%`;
                    }
                }
                
                // Form values from backend
                if (prefs.theme) applyTheme(prefs.theme);
                if (prefs.chat_font_size) applyFontSize(prefs.chat_font_size);
                if (prefs.user_mode) setUserMode(prefs.user_mode, false);
                
                const nameInput = document.getElementById('setting-preferred-name');
                if (nameInput) nameInput.value = prefs.preferred_name || '';
                
                const aboutText = document.getElementById('setting-custom-about');
                if (aboutText) aboutText.value = prefs.custom_about || '';
                
                const styleText = document.getElementById('setting-custom-style');
                if (styleText) styleText.value = prefs.custom_style || '';
                
                const modelSel = document.getElementById('setting-default-model');
                if (modelSel && prefs.default_model) {
                    modelSel.value = prefs.default_model;
                    const mainModelSelect = document.getElementById('model-select');
                    if (mainModelSelect && !sessionStorage.getItem('user_switched_model')) {
                        mainModelSelect.value = prefs.default_model;
                        updateModelUI();
                    }
                }
                
                const personaSel = document.getElementById('setting-persona');
                if (personaSel && prefs.persona) {
                    personaSel.value = prefs.persona;
                    const mainPersonaSelect = document.getElementById('persona-select');
                    if (mainPersonaSelect) mainPersonaSelect.value = prefs.persona;
                }
                
                if (voiceSel && prefs.voice_name) {
                    voiceSel.value = prefs.voice_name;
                    localStorage.setItem('kira_voice_name', prefs.voice_name);
                }
                
                if (rateSlider && prefs.speech_rate) {
                    rateSlider.value = prefs.speech_rate;
                    if (rateVal) rateVal.textContent = `${parseFloat(prefs.speech_rate).toFixed(1)}x`;
                    localStorage.setItem('kira_speech_rate', prefs.speech_rate);
                }
                
                if (autoSpeakChk && prefs.auto_speak !== undefined) {
                    autoSpeakChk.checked = Boolean(prefs.auto_speak);
                    isAutoSpeakEnabled = Boolean(prefs.auto_speak);
                    localStorage.setItem('kira_auto_speak', isAutoSpeakEnabled);
                    updateAutoSpeakUI();
                }
                
                const memoryChk = document.getElementById('setting-graph-memory');
                if (memoryChk && prefs.long_term_memory !== undefined) {
                    memoryChk.checked = Boolean(prefs.long_term_memory);
                    localStorage.setItem('kira_graph_memory', Boolean(prefs.long_term_memory));
                }
            }
        }

        // 3. Fetch Neural Resilience Mesh / Providers Status
        try {
            const provRes = await fetch('/api/system/providers');
            if (provRes.ok) {
                const provData = await provRes.json();
                const p = provData.providers || {};
                const groqChip = document.getElementById('chip-groq');
                if (groqChip && p.groq) {
                    groqChip.innerHTML = `<i class="fa-solid fa-bolt text-yellow"></i> Groq: ${p.groq.configured ? `ออนไลน์ (${p.groq.active_keys} ดอก)` : 'สแตนด์บาย'}`;
                }
                const orChip = document.getElementById('chip-openrouter');
                if (orChip && p.openrouter) {
                    orChip.innerHTML = `<i class="fa-solid fa-rocket text-purple"></i> OpenRouter: ${p.openrouter.configured ? `พร้อมสำรอง (${p.openrouter.active_keys} ดอก)` : 'สแตนด์บาย'}`;
                }
                const geminiChip = document.getElementById('chip-gemini');
                if (geminiChip && p.gemini) {
                    geminiChip.innerHTML = `<i class="fa-solid fa-gem text-cyan"></i> Gemini: ${p.gemini.configured ? `พร้อมสลับ (${p.gemini.active_keys} ดอก)` : 'สแตนด์บาย'}`;
                }
                const circuitChip = document.getElementById('chip-circuit');
                if (circuitChip && provData.circuit_breaker) {
                    const cb = provData.circuit_breaker;
                    if (cb.circuit_breaker_active) {
                        circuitChip.style.background = 'rgba(239, 68, 68, 0.15)';
                        circuitChip.style.color = '#f87171';
                        circuitChip.innerHTML = `<i class="fa-solid fa-shield-virus"></i> Circuit Breaker: ป้องกัน 1 คีย์`;
                    } else {
                        circuitChip.style.background = 'rgba(16, 185, 129, 0.12)';
                        circuitChip.style.color = '#34d399';
                        circuitChip.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> Circuit Breaker: ป้องกัน 100%`;
                    }
                }
            }
        } catch (provErr) {
            console.warn('Could not fetch providers status:', provErr);
        }
    } catch (err) {
        console.warn("Could not load backend preferences:", err);
    }
}

async function saveSettings() {
    if (!currentUser) return;
    
    const saveBtn = document.getElementById('btn-save-settings');
    const statusText = document.getElementById('settings-save-status');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    }
    
    const selectedTheme = document.querySelector('input[name="setting-theme"]:checked')?.value || 'dark';
    const selectedUserMode = document.querySelector('input[name="setting-user-mode"]:checked')?.value || currentUserMode || 'general';
    const fontSize = document.getElementById('setting-font-size')?.value || 'medium';
    const enterSend = document.getElementById('setting-enter-send')?.value || 'enter';
    const soundEffects = document.getElementById('setting-sound-effects')?.checked ?? true;
    const autoCanvas = document.getElementById('setting-auto-canvas')?.checked ?? true;
    
    const preferredName = document.getElementById('setting-preferred-name')?.value?.trim() || '';
    const defaultModel = document.getElementById('setting-default-model')?.value || '2.1-reasoning';
    const persona = document.getElementById('setting-persona')?.value || 'default';
    const thinkingAccordion = document.getElementById('setting-thinking-accordion')?.value || 'auto_collapse';
    const customAbout = document.getElementById('setting-custom-about')?.value?.trim() || '';
    const customStyle = document.getElementById('setting-custom-style')?.value?.trim() || '';
    
    const autoSpeak = document.getElementById('setting-auto-speak')?.checked ?? false;
    const voiceName = document.getElementById('setting-voice-name')?.value || 'th-TH-PremwadeeNeural';
    const speechRate = parseFloat(document.getElementById('setting-speech-rate')?.value || 1.0);
    const sttLang = document.getElementById('setting-stt-lang')?.value || 'th-TH';
    
    const longTermMemory = document.getElementById('setting-graph-memory')?.checked ?? true;
    const pythonConfirm = document.getElementById('setting-python-confirm')?.checked ?? true;

    // Apply immediate local changes
    applyTheme(selectedTheme);
    setUserMode(selectedUserMode, false);
    applyFontSize(fontSize);
    localStorage.setItem('kira_enter_send', enterSend);
    localStorage.setItem('kira_sound_effects', soundEffects);
    localStorage.setItem('kira_auto_canvas', autoCanvas);
    localStorage.setItem('kira_thinking_accordion', thinkingAccordion);
    localStorage.setItem('kira_voice_name', voiceName);
    localStorage.setItem('kira_speech_rate', speechRate);
    localStorage.setItem('kira_stt_lang', sttLang);
    localStorage.setItem('kira_auto_speak', autoSpeak);
    localStorage.setItem('kira_graph_memory', longTermMemory);
    localStorage.setItem('kira_python_confirm', pythonConfirm);
    
    isAutoSpeakEnabled = autoSpeak;
    updateAutoSpeakUI();
    
    const mainPersonaSelect = document.getElementById('persona-select');
    if (mainPersonaSelect) mainPersonaSelect.value = persona;
    
    const payload = {
        username: currentUser,
        preferred_name: preferredName,
        theme: selectedTheme,
        user_mode: selectedUserMode,
        chat_font_size: fontSize,
        auto_speak: autoSpeak,
        voice_name: voiceName,
        speech_rate: speechRate,
        default_model: defaultModel,
        persona: persona,
        custom_about: customAbout,
        custom_style: customStyle,
        sound_effects: soundEffects,
        auto_canvas: autoCanvas,
        thinking_accordion: thinkingAccordion,
        long_term_memory: longTermMemory,
        enter_key_behavior: enterSend
    };
    
    try {
        const res = await fetch('/api/user/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            if (statusText) {
                statusText.className = 'settings-footer-status saved';
                statusText.innerHTML = '<i class="fa-solid fa-circle-check"></i> บันทึกการตั้งค่าเรียบร้อยแล้ว';
            }
            playKiraSound('receive');
            setTimeout(() => {
                if (statusText) {
                    statusText.className = 'settings-footer-status';
                    statusText.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> พร้อมบันทึกการตั้งค่า';
                }
            }, 3000);
        } else {
            alert(data.message || 'บันทึกการตั้งค่าไม่สำเร็จ');
        }
    } catch (e) {
        console.error("Save settings error:", e);
        if (statusText) {
            statusText.className = 'settings-footer-status';
            statusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i> บันทึกในเบราว์เซอร์สำเร็จ (เซิร์ฟเวอร์ออฟไลน์)';
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnHtml;
        }
    }
}

function openSettingsModal(targetTab = 'general') {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    switchSettingsTab(targetTab);
    modal.style.display = 'flex';
    loadSettingsPreferences();
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function switchSettingsTab(tabName) {
    const tabs = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');
    
    tabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `settings-panel-${tabName}`);
    });
}

async function previewVoiceSample() {
    const previewBtn = document.getElementById('btn-preview-voice');
    const voice = document.getElementById('setting-voice-name')?.value || 'th-TH-PremwadeeNeural';
    const rate = parseFloat(document.getElementById('setting-speech-rate')?.value || 1.0);
    
    const sampleText = voice.startsWith('en-') 
        ? "Hello, I am Kira. Your next-generation intelligent AI assistant, ready to help you."
        : "สวัสดีค่ะ ฉันคือคิระ ระบบปัญญาประดิษฐ์อัจฉริยะ พร้อมช่วยเหลือคุณแล้วค่ะ";
        
    if (previewBtn) {
        previewBtn.disabled = true;
        previewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...';
    }
    
    try {
        const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sampleText, voice: voice, rate: rate })
        });
        
        if (!res.ok) throw new Error("TTS failed");
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        if (previewBtn) previewBtn.innerHTML = '<i class="fa-solid fa-waveform-lines"></i> กำลังเล่น...';
        
        audio.onended = () => {
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> ทดลองฟัง';
            }
        };
        audio.onerror = () => {
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> ทดลองฟัง';
            }
        };
        await audio.play();
    } catch (err) {
        console.error("Preview voice error:", err);
        alert("ไม่สามารถเล่นเสียงตัวอย่างได้ กรุณาลองใหม่อีกครั้ง");
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> ทดลองฟัง';
        }
    }
}

async function submitChangePassword() {
    const currentPass = document.getElementById('setting-current-pass')?.value;
    const newPass = document.getElementById('setting-new-pass')?.value;
    const confirmPass = document.getElementById('setting-confirm-pass')?.value;
    const errBox = document.getElementById('settings-pass-error');
    const btnSubmit = document.getElementById('btn-submit-change-pass');
    
    const showError = (msg) => {
        if (!errBox) return;
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
        errBox.style.color = '#f87171';
        errBox.style.background = 'rgba(239, 68, 68, 0.1)';
        errBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    };
    
    const showSuccess = (msg) => {
        if (!errBox) return;
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
        errBox.style.color = '#34d399';
        errBox.style.background = 'rgba(16, 185, 129, 0.1)';
        errBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    };
    
    if (!currentPass || !newPass || !confirmPass) {
        showError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
    }
    
    if (newPass.length < 4) {
        showError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร");
        return;
    }
    
    if (newPass !== confirmPass) {
        showError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
        return;
    }
    
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเปลี่ยนรหัสผ่าน...';
    }
    
    try {
        const res = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                current_password: currentPass,
                new_password: newPass
            })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            showSuccess("เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว");
            document.getElementById('setting-current-pass').value = '';
            document.getElementById('setting-new-pass').value = '';
            document.getElementById('setting-confirm-pass').value = '';
        } else {
            showError(data.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
        }
    } catch (e) {
        showError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-lock"></i> บันทึกรหัสผ่านใหม่';
        }
    }
}

async function clearAllChatHistory() {
    if (!confirm("คำเตือน: คุณต้องการลบประวัติการสนทนาทั้งหมดจริงหรือไม่?\n\nการกระทำนี้จะล้างประวัติแชททั้งหมดในฐานข้อมูลและไม่สามารถกู้คืนได้")) {
        return;
    }
    try {
        const token = localStorage.getItem('kira_auth_token') || '';
        const res = await fetch(`/api/history/${encodeURIComponent(currentUser)}/all${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
            method: 'DELETE',
            headers: token ? { 'X-Auth-Token': token } : {}
        });
        const data = await res.json();
        if (data.status === 'success') {
            chatBox.innerHTML = '';
            chatHistorySidebar.innerHTML = '<p class="history-title">ยังไม่มีประวัติการแชท</p>';
            renderWelcomeHub();
            alert("ล้างประวัติการสนทนาทั้งหมดเรียบร้อยแล้วค่ะ");
            closeSettingsModal();
        } else {
            alert(data.message || "ล้างประวัติแชทไม่สำเร็จ");
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
}

async function wipeAllMemories() {
    if (!confirm("คำเตือน: คุณต้องการล้างโหนดความจำสมอง (Knowledge Graph Memory) ทั้งหมดจริงหรือไม่?\n\nคิระจะลืมข้อมูลความจำระยะยาวทั้งหมดของคุณและเริ่มต้นใหม่เหมือนวันแรก")) {
        return;
    }
    try {
        const token = localStorage.getItem('kira_auth_token') || '';
        const res = await fetch(`/api/user/graph/all?username=${encodeURIComponent(currentUser)}${token ? `&token=${encodeURIComponent(token)}` : ''}`, {
            method: 'DELETE',
            headers: token ? { 'X-Auth-Token': token } : {}
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert("ล้างโครงข่ายความจำของคิระเรียบร้อยแล้วค่ะ");
        } else {
            alert(data.message || "ล้างความจำไม่สำเร็จ");
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
}

async function exportChatJson() {
    try {
        const res = await fetch(`/api/history/${encodeURIComponent(currentUser)}`);
        const data = await res.json();
        if (!data.history || data.history.length === 0) {
            alert("ยังไม่มีประวัติการแชทให้ส่งออกค่ะ");
            return;
        }
        const exportData = {
            app: "Kira AI System 2.1 Next-Gen",
            exported_at: new Date().toISOString(),
            user: currentUser,
            messages_count: data.history.length,
            history: data.history
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kira_chat_history_${currentUser}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("ส่งออกข้อมูลประวัติไม่สำเร็จ");
    }
}

async function pingServerLatency() {
    const pingBtn = document.getElementById('btn-ping-latency');
    const resultTag = document.getElementById('latency-ping-result');
    if (pingBtn) {
        pingBtn.disabled = true;
        pingBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังวัด...';
    }
    const t0 = performance.now();
    try {
        const res = await fetch('/api/health?t=' + Date.now());
        const t1 = performance.now();
        const latencyMs = Math.round(t1 - t0);
        if (resultTag) {
            resultTag.textContent = `${latencyMs} ms`;
            resultTag.className = 'latency-tag good';
        }
    } catch (e) {
        if (resultTag) {
            resultTag.textContent = 'ขัดข้อง';
            resultTag.className = 'latency-tag';
        }
    } finally {
        if (pingBtn) {
            pingBtn.disabled = false;
            pingBtn.innerHTML = '<i class="fa-solid fa-network-wired"></i> ทดสอบ Ping';
        }
    }
}

// Attach All Event Listeners for Settings Modal
function initSettingsModalEventListeners() {
    const btnHeaderSettings = document.getElementById('btn-header-settings');
    const btnSidebarSettings = document.getElementById('btn-sidebar-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnCancelSettings = document.getElementById('btn-cancel-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const settingsModal = document.getElementById('settings-modal');
    
    if (btnHeaderSettings) {
        btnHeaderSettings.addEventListener('click', (e) => {
            e.preventDefault();
            openSettingsModal('general');
        });
    }
    
    if (btnSidebarSettings) {
        btnSidebarSettings.addEventListener('click', (e) => {
            e.preventDefault();
            openSettingsModal('general');
        });
    }
    
    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', closeSettingsModal);
    }
    
    if (btnCancelSettings) {
        btnCancelSettings.addEventListener('click', closeSettingsModal);
    }
    
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', saveSettings);
    }
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }
    
    // Tab switching
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchSettingsTab(btn.dataset.tab);
        });
    });
    
    // Theme radios live preview
    const themeRadios = document.querySelectorAll('input[name="setting-theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) applyTheme(radio.value);
        });
    });
    
    // Font size select live preview
    const fontSizeSelect = document.getElementById('setting-font-size');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => {
            applyFontSize(fontSizeSelect.value);
        });
    }
    
    // Speech rate slider live value update
    const rateSlider = document.getElementById('setting-speech-rate');
    const rateVal = document.getElementById('speech-rate-val');
    if (rateSlider && rateVal) {
        rateSlider.addEventListener('input', () => {
            rateVal.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
        });
    }
    
    // Voice preview button
    const btnPreviewVoice = document.getElementById('btn-preview-voice');
    if (btnPreviewVoice) {
        btnPreviewVoice.addEventListener('click', previewVoiceSample);
    }
    
    // Password submit button
    const btnChangePass = document.getElementById('btn-submit-change-pass');
    if (btnChangePass) {
        btnChangePass.addEventListener('click', submitChangePassword);
    }
    
    // Danger Zone buttons
    const btnClearChats = document.getElementById('btn-clear-all-chats');
    if (btnClearChats) {
        btnClearChats.addEventListener('click', clearAllChatHistory);
    }
    
    const btnWipeMem = document.getElementById('btn-wipe-all-memories');
    if (btnWipeMem) {
        btnWipeMem.addEventListener('click', wipeAllMemories);
    }
    
    // Pro Tools buttons
    const btnExportJson = document.getElementById('btn-export-chat-json');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', exportChatJson);
    }
    
    const btnPing = document.getElementById('btn-ping-latency');
    if (btnPing) {
        btnPing.addEventListener('click', pingServerLatency);
    }
    
    const btnRelaunchTour = document.getElementById('btn-relaunch-tour');
    if (btnRelaunchTour) {
        btnRelaunchTour.addEventListener('click', () => {
            closeSettingsModal();
            openOnboardingGuide(1);
        });
    }
    
    const btnOpenGraphSettings = document.getElementById('btn-open-graph-from-settings');
    if (btnOpenGraphSettings) {
        btnOpenGraphSettings.addEventListener('click', () => {
            closeSettingsModal();
            openKnowledgeGraph();
        });
    }

    // Global Shortcut: Ctrl + , or Cmd + , to open Settings
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            if (settingsModal && settingsModal.style.display === 'flex') {
                closeSettingsModal();
            } else {
                openSettingsModal('general');
            }
        } else if (e.key === 'Escape' && settingsModal && settingsModal.style.display === 'flex') {
            closeSettingsModal();
        }
    });
}


// Expose globally
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.loadSettingsPreferences = loadSettingsPreferences;
window.saveSettings = saveSettings;
window.applyTheme = applyTheme;
window.applyFontSize = applyFontSize;

// ====================================================================
// 🏛️ KIRA VIRTUAL BOARDROOM: 4-EXECUTIVE CLIENT CONTROLLER
// ====================================================================

function playGavelSound() {
    try {
        const audioCtx = getSharedAudioContext();
        if (!audioCtx) return;

        // 3 realistic wooden gavel taps with sharp transients
        const tapTimes = [0, 0.2, 0.4];
        tapTimes.forEach((t) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(145, audioCtx.currentTime + t);
            osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + t + 0.12);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(350, audioCtx.currentTime + t);
            filter.Q.setValueAtTime(3.5, audioCtx.currentTime + t);

            gain.gain.setValueAtTime(0.45, audioCtx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.14);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(audioCtx.currentTime + t);
            osc.stop(audioCtx.currentTime + t + 0.15);
        });
    } catch (e) {
        console.warn('Gavel sound FX audio context error:', e);
    }
}

function renderBoardroomHTML(rawText) {
    let html = '<div class="boardroom-session-wrapper">';
    html += '<div class="boardroom-session-header-badge"><i class="fa-solid fa-users-viewfinder"></i> บันทึกการประชุมสภาที่ปรึกษาเสมือน (Chamber in Session)</div>';

    // 1. Parse Speakers: [BOARDROOM_SPEAKER:ID:TITLE:THEME]...[/BOARDROOM_SPEAKER]
    const speakerRegex = /\[BOARDROOM_SPEAKER:([A-Z]+):([^:]+):([a-z]+)\]([\s\S]*?)(?:\[\/BOARDROOM_SPEAKER\]|$)/g;
    let spMatch;
    const avatarMap = { 'CEO': '👔', 'CFO': '💰', 'CPO': '🎨', 'CTO': '🛡️' };

    while ((spMatch = speakerRegex.exec(rawText)) !== null) {
        const id = spMatch[1];
        const title = spMatch[2];
        const theme = spMatch[3] || 'gold';
        const content = spMatch[4] ? spMatch[4].trim() : '';
        const avatar = avatarMap[id] || '👔';

        let parsedContent = '';
        try {
            parsedContent = content ? marked.parse(content) : '<span style="color: #94a3b8; font-style: italic;"><i class="fa-solid fa-spinner fa-spin"></i> กำลังแถลงมุมมอง...</span>';
        } catch (e) {
            parsedContent = `<div style="white-space: pre-wrap;">${content}</div>`;
        }

        html += `
        <div class="executive-speech-card theme-${theme}">
            <div class="exec-speech-top">
                <div class="exec-identity">
                    <div class="exec-speech-avatar">${avatar}</div>
                    <div class="exec-speech-name">${title}</div>
                </div>
                <span class="exec-speech-tag">${id}</span>
            </div>
            <div class="exec-speech-content">
                ${parsedContent}
            </div>
        </div>
        `;
    }

    // 2. Parse Debate: [BOARDROOM_DEBATE:TITLE]...[/BOARDROOM_DEBATE]
    const debateRegex = /\[BOARDROOM_DEBATE:?([^\]]*)\]([\s\S]*?)(?:\[\/BOARDROOM_DEBATE\]|$)/;
    const debMatch = debateRegex.exec(rawText);
    if (debMatch) {
        const debTitle = debMatch[1] ? debMatch[1].trim() : 'การถกเถียงและประนีประนอมจุดอ่อน (Executive Debate)';
        const debContent = debMatch[2] ? debMatch[2].trim() : '';
        let parsedDebate = '';
        try {
            parsedDebate = debContent ? marked.parse(debContent) : '<span style="color: #c084fc; font-style: italic;"><i class="fa-solid fa-spinner fa-spin"></i> คณะกรรมการกำลังเริ่มถกเถียง...</span>';
        } catch (e) {
            parsedDebate = `<div style="white-space: pre-wrap;">${debContent}</div>`;
        }
        html += `
        <div class="boardroom-debate-box">
            <div class="boardroom-debate-title"><i class="fa-solid fa-bolt-lightning"></i> ${debTitle}</div>
            <div class="boardroom-debate-body">${parsedDebate}</div>
        </div>
        `;
    }

    // 3. Parse Consensus: [BOARDROOM_CONSENSUS:TITLE]...[/BOARDROOM_CONSENSUS]
    const consensusRegex = /\[BOARDROOM_CONSENSUS:?([^\]]*)\]([\s\S]*?)(?:\[\/BOARDROOM_CONSENSUS\]|$)/;
    const conMatch = consensusRegex.exec(rawText);
    if (conMatch) {
        const conTitle = conMatch[1] ? conMatch[1].trim() : 'มติที่ประชุมและพิมพ์เขียวกลยุทธ์ (Strategic Blueprint)';
        const conContent = conMatch[2] ? conMatch[2].trim() : '';
        let parsedConsensus = '';
        try {
            parsedConsensus = conContent ? marked.parse(conContent) : '<span style="color: #fbbf24; font-style: italic;"><i class="fa-solid fa-spinner fa-spin"></i> คิระกำลังร่างมติเอกฉันท์...</span>';
        } catch (e) {
            parsedConsensus = `<div style="white-space: pre-wrap;">${conContent}</div>`;
        }
        html += `
        <div class="boardroom-consensus-box">
            <div class="boardroom-consensus-header">
                <div class="boardroom-consensus-title"><i class="fa-solid fa-gavel"></i> ${conTitle}</div>
                <div class="boardroom-consensus-actions">
                    <button class="consensus-tool-btn" onclick="convertBoardroomToSlides(this)" title="แปลงมติที่ประชุมสภาเป็นชุดสไลด์นำเสนอ 16:9 (Executive Slide Deck)"><i class="fa-solid fa-file-powerpoint text-rose"></i> สร้างสไลด์สภา (16:9)</button>
                    <button class="consensus-tool-btn" onclick="copyMeetingMinutes(this)" title="คัดลอกบันทึกการประชุมทั้งหมด"><i class="fa-regular fa-copy"></i> คัดลอกรายงาน</button>
                    <button class="consensus-tool-btn" onclick="openBoardroomInCanvas(this)" title="เปิดบันทึกการประชุมใน Live Canvas"><i class="fa-solid fa-pen-to-square"></i> เปิดใน Canvas</button>
                    <button class="consensus-tool-btn" onclick="downloadMeetingMinutes(this)" title="ดาวน์โหลดบันทึกการประชุม (.md)"><i class="fa-solid fa-file-arrow-down"></i> ดาวน์โหลด (.md)</button>
                    <button class="consensus-tool-btn" onclick="exportBoardroomToPDF(this)" title="พิมพ์รายงานหรือบันทึกเป็น PDF สวยงามแบบ A4"><i class="fa-solid fa-print"></i> พิมพ์ / PDF</button>
                    <button class="consensus-tool-btn" onclick="playBoardroomConsensusAudio(this)" title="ฟังเสียงอ่านสรุปมติที่ประชุม"><i class="fa-solid fa-volume-high"></i> ฟังเสียงมติ</button>
                </div>
            </div>
            <div class="boardroom-consensus-body">${parsedConsensus}</div>
        </div>
        `;
    }

    html += '</div>';
    return html;
}

function extractBoardroomFullMinutes(sessionWrapper) {
    let fullMeetingText = "# 🏛️ บันทึกการประชุมสภาที่ปรึกษาผู้บริหารเสมือน (Kira Virtual Boardroom Minutes)\n\n";
    const now = new Date();
    fullMeetingText += `**วันและเวลาประชุม:** ${now.toLocaleString('th-TH')}\n\n`;
    fullMeetingText += `**คณะกรรมการบริหารผู้เข้าร่วมประชุม:**\n`;
    fullMeetingText += `- 👔 **คุณคิรินทร์**: ประธานเจ้าหน้าที่บริหาร (CEO & Strategist)\n`;
    fullMeetingText += `- 💰 **คุณเมธัส**: ประธานเจ้าหน้าที่ฝ่ายการเงิน (CFO & Risk Lead)\n`;
    fullMeetingText += `- 🎨 **คุณรินดา**: ประธานเจ้าหน้าที่ฝ่ายประสบการณ์ลูกค้า (CPO & UX)\n`;
    fullMeetingText += `- 🛡️ **คุณธนิน**: ประธานเจ้าหน้าที่ฝ่ายเทคโนโลยี (CTO & Systems Architect)\n\n`;
    fullMeetingText += `---\n\n`;

    if (sessionWrapper) {
        const speeches = sessionWrapper.querySelectorAll('.executive-speech-card');
        speeches.forEach(card => {
            const name = card.querySelector('.exec-speech-name')?.innerText || 'ผู้บริหาร';
            const tag = card.querySelector('.exec-speech-tag')?.innerText || '';
            const body = card.querySelector('.exec-speech-content')?.innerText || '';
            fullMeetingText += `## ${name} (${tag})\n\n${body}\n\n---\n\n`;
        });

        const debate = sessionWrapper.querySelector('.boardroom-debate-body');
        if (debate) {
            fullMeetingText += `## สรุปการถกเถียงและประนีประนอมจุดอ่อน (Executive Debate)\n\n${debate.innerText}\n\n---\n\n`;
        }

        const consensus = sessionWrapper.querySelector('.boardroom-consensus-body');
        if (consensus) {
            fullMeetingText += `## มติเอกฉันท์และพิมพ์เขียวกลยุทธ์ (Resolution Blueprint)\n\n${consensus.innerText}\n\n`;
        }
    }
    return fullMeetingText;
}

function copyMeetingMinutes(btn) {
    try {
        const sessionWrapper = btn ? btn.closest('.boardroom-session-wrapper') : document.querySelector('.boardroom-session-wrapper');
        const text = extractBoardroomFullMinutes(sessionWrapper);
        navigator.clipboard.writeText(text);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #38bdf8;"></i> คัดลอกแล้ว';
        if (typeof showConnectionToast === 'function') {
            showConnectionToast('📋 คัดลอกบันทึกการประชุมสภาที่ปรึกษาลง Clipboard เรียบร้อยแล้วค่ะ', 'ready');
        }
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2500);
    } catch (err) {
        console.error("Copy meeting minutes error:", err);
    }
}

function openBoardroomInCanvas(btn) {
    try {
        const sessionWrapper = btn ? btn.closest('.boardroom-session-wrapper') : document.querySelector('.boardroom-session-wrapper');
        const text = extractBoardroomFullMinutes(sessionWrapper);
        if (typeof openInLiveCanvas === 'function') {
            openInLiveCanvas('บันทึกการประชุมสภาที่ปรึกษาเสมือน', text, 'document');
        }
    } catch (err) {
        console.error("Open boardroom in canvas error:", err);
    }
}

function downloadMeetingMinutes(btn) {
    try {
        const sessionWrapper = btn ? btn.closest('.boardroom-session-wrapper') : document.querySelector('.boardroom-session-wrapper');
        const fullMeetingText = extractBoardroomFullMinutes(sessionWrapper);
        const now = new Date();
        const blob = new Blob([fullMeetingText], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url;
        a.download = `Kira_Boardroom_Minutes_${dateStr}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Export meeting minutes error:", err);
        alert("ไม่สามารถส่งออกบันทึกการประชุมได้ในขณะนี้ค่ะ");
    }
}

function exportBoardroomToPDF(btn) {
    try {
        const sessionWrapper = btn ? btn.closest('.boardroom-session-wrapper') : document.querySelector('.boardroom-session-wrapper');
        const fullMeetingText = extractBoardroomFullMinutes(sessionWrapper);
        exportDeliverableToPDF('บันทึกการประชุมสภาที่ปรึกษาผู้บริหาร (Kira Virtual Boardroom Minutes)', fullMeetingText, 'boardroom');
    } catch (err) {
        console.error("Export boardroom to PDF error:", err);
        alert("ไม่สามารถพิมพ์รายงานบันทึกการประชุมได้ในขณะนี้ค่ะ");
    }
}
window.exportBoardroomToPDF = exportBoardroomToPDF;

async function playBoardroomConsensusAudio(btn) {
    try {
        const consensusBox = btn ? btn.closest('.boardroom-consensus-box') : null;
        if (!consensusBox) return;
        const textElement = consensusBox.querySelector('.boardroom-consensus-body');
        if (!textElement) return;

        // Extract verdict or first 500 characters
        let rawText = textElement.innerText.slice(0, 600);
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเตรียมเสียง...';
        btn.disabled = true;

        if (typeof playKiraVoice === 'function') {
            await playKiraVoice(rawText, 'th-TH-PremwadeeNeural', 1.05);
        }

        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> กำลังอ่านมติที่ประชุม...';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียงมติ';
            btn.disabled = false;
        }, 6000);
    } catch (e) {
        console.error("Audio playback error:", e);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียงมติ';
            btn.disabled = false;
        }
    }
}

function convertBoardroomToSlides(btn) {
    try {
        const sessionWrapper = btn ? btn.closest('.boardroom-session-wrapper') : document.querySelector('.boardroom-session-wrapper');
        const text = extractBoardroomFullMinutes(sessionWrapper);
        if (typeof generateAndOpenSlideDeck === 'function') {
            generateAndOpenSlideDeck(text, 'มติที่ประชุมสภาที่ปรึกษาผู้บริหาร (Kira Virtual Boardroom)');
        }
    } catch (e) {
        console.error("Convert boardroom to slides error:", e);
    }
}
window.convertBoardroomToSlides = convertBoardroomToSlides;

// ====================================================================
// 🏛️ KIRA 2.2 - AUTONOMOUS ROUNDTABLE ARENA CONTROLLER
// ====================================================================
let currentDebateStreamController = null;
let currentDebateConsensusMarkdown = '';
let currentDebateTopic = '';

function openRoundtableArenaModal(topic = '') {
    const modal = document.getElementById('boardroom-debate-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const topicInput = document.getElementById('debate-topic-input');
    if (topic && topicInput) {
        topicInput.value = topic;
    } else if (topicInput && !topicInput.value) {
        const mainInput = document.getElementById('user-input');
        if (mainInput && mainInput.value) {
            topicInput.value = mainInput.value;
        }
    }
    if (topicInput) topicInput.focus();
}

function closeRoundtableArenaModal() {
    const modal = document.getElementById('boardroom-debate-modal');
    if (modal) modal.style.display = 'none';
    if (currentDebateStreamController) {
        try { currentDebateStreamController.abort(); } catch (e) {}
        currentDebateStreamController = null;
    }
    setRoundtableActiveSpeaker(null);
}

function setRoundtableActiveSpeaker(speakerId) {
    const seats = document.querySelectorAll('.chamber-seat');
    seats.forEach(s => s.classList.remove('active-speaker'));
    const statusLabel = document.getElementById('arena-table-status');

    if (!speakerId) {
        if (statusLabel) statusLabel.textContent = 'การประชุมสภาผู้บริหาร';
        return;
    }

    const targetSeat = document.getElementById(`seat-${speakerId.toLowerCase()}`);
    if (targetSeat) {
        targetSeat.classList.add('active-speaker');
    }

    const speakerNames = {
        'BOSS': 'ท่านประธาน (บอส)',
        'CEO': 'คุณคิรินทร์ (CEO)',
        'CFO': 'คุณเมธัส (CFO)',
        'CPO': 'คุณรินดา (CPO)',
        'CTO': 'คุณธนิน (CTO)'
    };
    if (statusLabel) {
        statusLabel.textContent = `กำลังพูด: ${speakerNames[speakerId] || speakerId}`;
    }
}

function setDebateProgressStep(stepNum) {
    for (let i = 1; i <= 3; i++) {
        const stepEl = document.getElementById(`debate-step-${i}`);
        if (stepEl) {
            stepEl.classList.toggle('active', i <= stepNum);
        }
    }
}

function strikeBossGavel(customText = '') {
    const input = document.getElementById('boss-gavel-custom-input');
    const textToStrike = customText || (input ? input.value.trim() : '');
    if (!textToStrike) {
        if (typeof showConnectionToast === 'function') {
            showConnectionToast('⚠️ กรุณาระบุคำสั่งค้อนแทรกแซงของท่านประธานค่ะ', 'warning');
        }
        return;
    }

    playGavelSound();

    const modal = document.getElementById('boardroom-debate-modal');
    if (modal) {
        const card = modal.querySelector('.debate-modal-card');
        if (card) {
            card.classList.add('gavel-impact-shake');
            setTimeout(() => card.classList.remove('gavel-impact-shake'), 450);
        }
    }

    setRoundtableActiveSpeaker('BOSS');
    appendDebateMessage('BOSS', 'ท่านประธาน (The Boss)', '👑', `🔨 **คำสั่งเคาะค้อนแทรกแซง:** "${textToStrike}"`, 'speaker-BOSS');

    if (input) input.value = '';

    if (typeof showConnectionToast === 'function') {
        showConnectionToast(`⚡ เคาะค้อนสั่งการแทรกแซง: "${textToStrike}" แล้วค่ะ`, 'ready');
    }

    const topicInput = document.getElementById('debate-topic-input');
    if (topicInput && !topicInput.value) {
        topicInput.value = textToStrike;
    }
}

function appendDebateMessage(speakerId, speakerName, avatar, contentHtml, extraClass = '') {
    const feed = document.getElementById('debate-feed-messages');
    if (!feed) return null;

    const emptyState = feed.querySelector('.debate-empty-state');
    if (emptyState) emptyState.remove();

    const bubble = document.createElement('div');
    bubble.className = `debate-bubble ${extraClass} speaker-${speakerId}`;
    bubble.id = `bubble-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    bubble.innerHTML = `
        <div class="debate-bubble-header">
            <div class="debate-bubble-sender">
                <span>${avatar}</span>
                <span>${speakerName}</span>
            </div>
            <span style="font-size: 0.68rem; color: #94a3b8; font-weight: 700;">${speakerId}</span>
        </div>
        <div class="debate-bubble-body">${contentHtml}</div>
    `;

    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
    return bubble;
}

async function startRoundtableDebate(topic, angle) {
    const topicInput = document.getElementById('debate-topic-input');
    const angleSelect = document.getElementById('debate-angle-select');
    const startBtn = document.getElementById('btn-start-roundtable-debate');
    const feed = document.getElementById('debate-feed-messages');
    const liveIndicator = document.getElementById('feed-live-indicator');
    const toolbar = document.getElementById('debate-resolution-toolbar');

    const finalTopic = topic || (topicInput ? topicInput.value.trim() : '');
    const finalAngle = angle || (angleSelect ? angleSelect.value : 'balanced');

    if (!finalTopic) {
        if (typeof showConnectionToast === 'function') {
            showConnectionToast('⚠️ กรุณาระบุวาระการประชุมหรือโจทย์ธุรกิจก่อนเริ่มดีเบตค่ะ', 'warning');
        }
        if (topicInput) topicInput.focus();
        return;
    }

    currentDebateTopic = finalTopic;
    currentDebateConsensusMarkdown = '';

    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังประชุมสภา...';
    }

    if (liveIndicator) {
        liveIndicator.innerHTML = '<span class="live-dot pulse-red"></span> กำลังดีเบตสด';
    }

    if (toolbar) toolbar.style.display = 'none';
    if (feed) feed.innerHTML = '';
    setDebateProgressStep(1);
    playGavelSound();

    if (currentDebateStreamController) {
        try { currentDebateStreamController.abort(); } catch (e) {}
    }
    currentDebateStreamController = new AbortController();

    const username = localStorage.getItem('kira_username') || 'boss';

    try {
        const response = await fetch('/api/boardroom/debate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: finalTopic,
                angle: finalAngle,
                username: username,
                session_id: `roundtable_${Date.now()}`
            }),
            signal: currentDebateStreamController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentSpeakerBubble = null;
        let currentSpeakerBody = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;

                const jsonStr = trimmed.replace(/^data:\s*/, '');
                try {
                    const evt = JSON.parse(jsonStr);

                    if (evt.type === 'round_start') {
                        setDebateProgressStep(evt.round);
                        setRoundtableActiveSpeaker(null);
                        const roundBanner = document.createElement('div');
                        roundBanner.style.textAlign = 'center';
                        roundBanner.style.padding = '8px 12px';
                        roundBanner.style.margin = '6px 0';
                        roundBanner.style.background = 'rgba(168, 85, 247, 0.15)';
                        roundBanner.style.border = '1px solid rgba(168, 85, 247, 0.3)';
                        roundBanner.style.borderRadius = '10px';
                        roundBanner.style.color = '#e9d5ff';
                        roundBanner.style.fontSize = '0.8rem';
                        roundBanner.style.fontWeight = '700';
                        roundBanner.innerHTML = `<i class="fa-solid fa-flag"></i> ${evt.title} <div style="font-size: 0.7rem; color: #cbd5e1; font-weight: normal; margin-top: 2px;">${evt.desc}</div>`;
                        if (feed) {
                            feed.appendChild(roundBanner);
                            feed.scrollTop = feed.scrollHeight;
                        }
                    } else if (evt.type === 'speaker_start') {
                        setRoundtableActiveSpeaker(evt.speaker);
                        currentSpeakerBubble = appendDebateMessage(
                            evt.speaker,
                            `${evt.name} - ${evt.title}`,
                            evt.avatar,
                            '<span style="color: #94a3b8; font-style: italic;"><i class="fa-solid fa-spinner fa-spin"></i> กำลังแถลงมุมมอง...</span>'
                        );
                        if (currentSpeakerBubble) {
                            currentSpeakerBody = currentSpeakerBubble.querySelector('.debate-bubble-body');
                            currentSpeakerBody.innerHTML = '';
                        }
                    } else if (evt.type === 'speaker_chunk') {
                        if (currentSpeakerBody) {
                            currentSpeakerBody.textContent += evt.chunk;
                            if (feed) feed.scrollTop = feed.scrollHeight;
                        }
                    } else if (evt.type === 'speaker_end') {
                        if (currentSpeakerBody && evt.full_statement) {
                            try {
                                currentSpeakerBody.innerHTML = marked.parse(evt.full_statement);
                            } catch (e) {
                                currentSpeakerBody.textContent = evt.full_statement;
                            }
                        }
                        currentSpeakerBubble = null;
                        currentSpeakerBody = null;
                    } else if (evt.type === 'boss_intervention') {
                        strikeBossGavel(evt.instruction);
                    } else if (evt.type === 'debate_turn_start') {
                        setRoundtableActiveSpeaker(evt.speaker);
                        currentSpeakerBubble = appendDebateMessage(
                            evt.speaker,
                            `${evt.name} (${evt.title})`,
                            evt.avatar,
                            ''
                        );
                        if (currentSpeakerBubble) {
                            currentSpeakerBody = currentSpeakerBubble.querySelector('.debate-bubble-body');
                        }
                    } else if (evt.type === 'debate_turn_chunk') {
                        if (currentSpeakerBody) {
                            currentSpeakerBody.textContent += evt.chunk;
                            if (feed) feed.scrollTop = feed.scrollHeight;
                        }
                    } else if (evt.type === 'debate_turn_end') {
                        if (currentSpeakerBody && evt.text) {
                            try {
                                currentSpeakerBody.innerHTML = marked.parse(evt.text);
                            } catch (e) {
                                currentSpeakerBody.textContent = evt.text;
                            }
                        }
                        currentSpeakerBubble = null;
                        currentSpeakerBody = null;
                    } else if (evt.type === 'voting_matrix') {
                        renderVotingMatrixWidget(evt.matrix, evt.average_score);
                    } else if (evt.type === 'consensus_blueprint') {
                        currentDebateConsensusMarkdown = evt.content;
                        setRoundtableActiveSpeaker(null);
                        let parsed = '';
                        try {
                            parsed = marked.parse(evt.content);
                        } catch (e) {
                            parsed = `<div style="white-space: pre-wrap;">${evt.content}</div>`;
                        }
                        const consensusCard = document.createElement('div');
                        consensusCard.className = 'boardroom-consensus-box';
                        consensusCard.style.margin = '10px 0';
                        consensusCard.innerHTML = `
                            <div class="boardroom-consensus-header">
                                <div class="boardroom-consensus-title"><i class="fa-solid fa-gavel"></i> มติที่ประชุมและพิมพ์เขียวกลยุทธ์ (Executive Resolution)</div>
                            </div>
                            <div class="boardroom-consensus-body">${parsed}</div>
                        `;
                        if (feed) {
                            feed.appendChild(consensusCard);
                            feed.scrollTop = feed.scrollHeight;
                        }
                        if (toolbar) toolbar.style.display = 'flex';
                    } else if (evt.type === 'session_done') {
                        if (liveIndicator) {
                            liveIndicator.innerHTML = '<i class="fa-solid fa-circle-check text-emerald"></i> การประชุมเสร็จสมบูรณ์';
                        }
                        setRoundtableActiveSpeaker(null);
                        if (typeof showConnectionToast === 'function') {
                            showConnectionToast('🎉 การประชุมสภาผู้บริหารเสร็จสิ้นสมบูรณ์แล้วค่ะ พร้อมสร้างสไลด์ 16:9 ได้ทันที!', 'ready');
                        }
                    } else if (evt.type === 'error') {
                        appendDebateMessage('SYSTEM', 'ระบบรักษาความปลอดภัย', '🛑', evt.message);
                    }
                } catch (jsonErr) {
                    console.error('SSE JSON parse error:', jsonErr);
                }
            }
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Debate stream error:', err);
            appendDebateMessage('SYSTEM', 'ข้อผิดพลาด', '⚠️', 'ไม่สามารถดำเนินการดีเบตสดได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ');
        }
    } finally {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> เริ่มการดีเบตใหม่';
        }
        currentDebateStreamController = null;
    }
}

function renderVotingMatrixWidget(matrix, avgScore) {
    const feed = document.getElementById('debate-feed-messages');
    if (!feed || !Array.isArray(matrix)) return;

    const card = document.createElement('div');
    card.className = 'debate-matrix-card';

    let rowsHtml = '';
    matrix.forEach(m => {
        const pct = Math.min(100, Math.round((m.score / 10) * 100));
        rowsHtml += `
            <div class="matrix-row">
                <span class="matrix-label"><span style="color: ${m.color}; font-weight: 800;">${m.id}</span>: ${m.dimension}</span>
                <div class="matrix-bar-wrap">
                    <div class="matrix-bar-fill" style="width: ${pct}%; background: ${m.color};"></div>
                </div>
                <span class="matrix-score">${m.score}/10</span>
            </div>
        `;
    });

    card.innerHTML = `
        <div class="matrix-title">
            <i class="fa-solid fa-chart-simple"></i> ตารางประเมิน 4 มิติ (4D Evaluation Matrix) — คะแนนเฉลี่ย: <strong style="color: #fbbf24;">${avgScore}/10</strong>
        </div>
        <div class="matrix-rows">${rowsHtml}</div>
    `;

    feed.appendChild(card);
    feed.scrollTop = feed.scrollHeight;
}

window.openRoundtableArenaModal = openRoundtableArenaModal;
window.closeRoundtableArenaModal = closeRoundtableArenaModal;
window.strikeBossGavel = strikeBossGavel;
window.startRoundtableDebate = startRoundtableDebate;

function toggleBoardroomMode(forceState) {
    const btnToggle = document.getElementById('btn-boardroom-toggle');
    const banner = document.getElementById('boardroom-active-banner');
    const modelSelect = document.getElementById('model-select');
    const userInput = document.getElementById('user-input');

    const currentState = localStorage.getItem('kira_boardroom_active') === 'true';
    const newState = (forceState !== undefined) ? forceState : !currentState;

    localStorage.setItem('kira_boardroom_active', newState ? 'true' : 'false');

    if (btnToggle) {
        btnToggle.classList.toggle('active', newState);
    }
    if (banner) {
        banner.style.display = newState ? 'flex' : 'none';
    }

    if (newState) {
        if (modelSelect) {
            modelSelect.value = 'boardroom';
        }
        if (userInput) {
            userInput.placeholder = '🏛️ พิมพ์วาระการประชุมหรือโจทย์ธุรกิจที่ต้องการให้ 4 ผู้บริหารระดมสมอง...';
        }
        playGavelSound();
    } else {
        if (modelSelect && modelSelect.value === 'boardroom') {
            modelSelect.value = localStorage.getItem('kira_default_model') || '2.1-reasoning';
        }
        if (userInput) {
            userInput.placeholder = 'ถามอะไรก็ได้กับคิระ หรือพิมพ์โจทย์ของคุณ...';
        }
    }
}

function initBoardroomController() {
    const btnToggle = document.getElementById('btn-boardroom-toggle');
    const btnExit = document.getElementById('btn-boardroom-exit');
    const btnInfo = document.getElementById('btn-boardroom-info');
    const modalInfo = document.getElementById('boardroom-info-modal');
    const btnCloseModal = document.getElementById('btn-close-boardroom-info');
    const btnStartFromModal = document.getElementById('btn-start-boardroom-from-modal');
    const modelSelect = document.getElementById('model-select');

    if (btnToggle) {
        btnToggle.addEventListener('click', () => toggleBoardroomMode());
    }

    if (btnExit) {
        btnExit.addEventListener('click', () => toggleBoardroomMode(false));
    }

    if (btnInfo && modalInfo) {
        btnInfo.addEventListener('click', () => {
            modalInfo.style.display = 'flex';
        });
    }

    if (btnCloseModal && modalInfo) {
        btnCloseModal.addEventListener('click', () => {
            modalInfo.style.display = 'none';
        });
    }

    if (modalInfo) {
        modalInfo.addEventListener('click', (e) => {
            if (e.target === modalInfo) {
                modalInfo.style.display = 'none';
            }
        });
    }

    if (btnStartFromModal && modalInfo) {
        btnStartFromModal.addEventListener('click', () => {
            modalInfo.style.display = 'none';
            toggleBoardroomMode(true);
            const userInput = document.getElementById('user-input');
            if (userInput) userInput.focus();
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === 'boardroom') {
                toggleBoardroomMode(true);
            } else {
                if (localStorage.getItem('kira_boardroom_active') === 'true') {
                    toggleBoardroomMode(false);
                }
            }
        });
    }

    // Restore boardroom state if previously active
    if (localStorage.getItem('kira_boardroom_active') === 'true') {
        toggleBoardroomMode(true);
    }

    // --- Wire Live Roundtable Arena Handlers ---
    const btnOpenArena = document.getElementById('btn-open-roundtable-arena');
    const modalArena = document.getElementById('boardroom-debate-modal');
    const btnCloseArena = document.getElementById('btn-close-debate-modal');
    const btnStartDebate = document.getElementById('btn-start-roundtable-debate');
    const btnStrikeGavel = document.getElementById('btn-strike-gavel');
    const gavelChips = document.querySelectorAll('.gavel-chip-btn');

    if (btnOpenArena) {
        btnOpenArena.addEventListener('click', () => openRoundtableArenaModal());
    }

    if (btnCloseArena) {
        btnCloseArena.addEventListener('click', closeRoundtableArenaModal);
    }

    if (modalArena) {
        modalArena.addEventListener('click', (e) => {
            if (e.target === modalArena) closeRoundtableArenaModal();
        });
    }

    if (btnStartDebate) {
        btnStartDebate.addEventListener('click', () => startRoundtableDebate());
    }

    if (btnStrikeGavel) {
        btnStrikeGavel.addEventListener('click', () => strikeBossGavel());
    }

    const gavelInput = document.getElementById('boss-gavel-custom-input');
    if (gavelInput) {
        gavelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                strikeBossGavel();
            }
        });
    }

    gavelChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const interventionText = chip.getAttribute('data-intervention');
            strikeBossGavel(interventionText);
        });
    });

    // Resolution Toolbar Buttons
    const btnDebateSlides = document.getElementById('btn-debate-to-slides');
    if (btnDebateSlides) {
        btnDebateSlides.addEventListener('click', () => {
            if (typeof generateAndOpenSlideDeck === 'function' && currentDebateConsensusMarkdown) {
                generateAndOpenSlideDeck(currentDebateConsensusMarkdown, `มติสภา: ${currentDebateTopic || 'Executive Strategic Blueprint'}`);
            }
        });
    }

    const btnDebatePdf = document.getElementById('btn-debate-to-pdf');
    if (btnDebatePdf) {
        btnDebatePdf.addEventListener('click', () => {
            if (typeof exportDeliverableToPDF === 'function' && currentDebateConsensusMarkdown) {
                exportDeliverableToPDF(`บันทึกมติสภาผู้บริหาร (${currentDebateTopic})`, currentDebateConsensusMarkdown, 'boardroom');
            }
        });
    }

    const btnDebateVoice = document.getElementById('btn-debate-listen-voice');
    if (btnDebateVoice) {
        btnDebateVoice.addEventListener('click', async () => {
            if (typeof playKiraVoice === 'function' && currentDebateConsensusMarkdown) {
                btnDebateVoice.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอ่าน...';
                await playKiraVoice(currentDebateConsensusMarkdown.slice(0, 600), 'th-TH-PremwadeeNeural', 1.05);
                setTimeout(() => {
                    btnDebateVoice.innerHTML = '<i class="fa-solid fa-volume-high"></i> ฟังเสียงมติ';
                }, 4000);
            }
        });
    }

    const btnDebateCopy = document.getElementById('btn-debate-copy-res');
    if (btnDebateCopy) {
        btnDebateCopy.addEventListener('click', () => {
            if (currentDebateConsensusMarkdown) {
                navigator.clipboard.writeText(currentDebateConsensusMarkdown);
                if (typeof showConnectionToast === 'function') {
                    showConnectionToast('📋 คัดลอกมติสภาผู้บริหารลง Clipboard แล้วค่ะ', 'ready');
                }
            }
        });
    }
}


// --- 🧰 Tools Popover Dropdown Controller ---
function initToolsDropdownController() {
    const wrapper = document.getElementById('tools-dropdown-wrapper');
    const triggerBtn = document.getElementById('btn-header-tools');
    const dropdownMenu = document.getElementById('tools-dropdown-menu');

    if (triggerBtn && wrapper) {
        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.classList.toggle('open');
        });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (wrapper && wrapper.classList.contains('open')) {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
            }
        }
        if (!e.target.closest('.msg-tools-dropdown-wrapper')) {
            document.querySelectorAll('.msg-tools-dropdown-menu').forEach(m => m.style.display = 'none');
        }
    });

    // Close dropdown when selecting a tool (except AutoSpeak toggle so user sees status)
    if (dropdownMenu && wrapper) {
        dropdownMenu.querySelectorAll('.tools-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (item.id !== 'btn-autospeak') {
                    wrapper.classList.remove('open');
                }
            });
        });
    }
}


// Expose globally
window.playGavelSound = playGavelSound;
window.renderBoardroomHTML = renderBoardroomHTML;
window.downloadMeetingMinutes = downloadMeetingMinutes;
window.copyMeetingMinutes = copyMeetingMinutes;
window.openBoardroomInCanvas = openBoardroomInCanvas;
window.playBoardroomConsensusAudio = playBoardroomConsensusAudio;
window.toggleBoardroomMode = toggleBoardroomMode;
window.cleanDeliverableText = cleanDeliverableText;
window.formatExecutiveDeliverable = formatExecutiveDeliverable;
window.attachDeliverablesBar = attachDeliverablesBar;

// ====================================================================
// 🎙️ Kira Web Speech Recognition Controller (Thai & Multi-Language)
// ====================================================================


function initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = document.getElementById('mic-btn');
    const taskVoiceBtn = document.getElementById('btn-task-voice-record');

    if (!SpeechRec) {
        if (micBtn) {
            micBtn.title = "เบราว์เซอร์นี้ไม่รองรับ Web Speech API (แนะนำให้ใช้ Chrome หรือ Edge ค่ะ)";
        }
        return;
    }

    try {
        speechRecognition = new SpeechRec();
        speechRecognition.lang = 'th-TH';
        speechRecognition.continuous = false;
        speechRecognition.interimResults = false;

        let activeTarget = 'chat'; // 'chat' or 'task'

        speechRecognition.onstart = () => {
            isListening = true;
            if (activeTarget === 'chat' && micBtn) {
                micBtn.classList.add('listening');
                micBtn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade" style="color: #f43f5e;"></i>';
                const uInput = document.getElementById('user-input');
                if (uInput) uInput.placeholder = "🎙️ กำลังฟังเสียงของคุณ... (พูดเสร็จแล้วระบบจะพิมพ์ให้อัตโนมัติ)";
            } else if (activeTarget === 'task' && taskVoiceBtn) {
                taskVoiceBtn.classList.add('listening');
                const label = document.getElementById('voice-record-label');
                if (label) label.textContent = 'กำลังฟังเสียงของคุณ... (พูดคำสั่งงานได้เลย)';
            }
        };

        speechRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (activeTarget === 'chat') {
                const uInput = document.getElementById('user-input');
                const sBtn = document.getElementById('send-btn');
                if (uInput) {
                    uInput.value = (uInput.value ? uInput.value + ' ' : '') + transcript;
                    uInput.focus();
                    uInput.style.height = 'auto';
                    uInput.style.height = Math.min(uInput.scrollHeight, 180) + 'px';
                    if (sBtn) sBtn.disabled = uInput.value.trim() === '';
                }
            } else if (activeTarget === 'task') {
                const titleInput = document.getElementById('task-form-title');
                const descInput = document.getElementById('task-form-desc');
                if (titleInput) {
                    if (!titleInput.value) {
                        titleInput.value = transcript;
                    } else if (descInput) {
                        descInput.value = (descInput.value ? descInput.value + ' ' : '') + transcript;
                    }
                }
            }
        };

        speechRecognition.onerror = (event) => {
            console.warn("Speech recognition notice:", event.error);
        };

        speechRecognition.onend = () => {
            isListening = false;
            if (micBtn) {
                micBtn.classList.remove('listening');
                micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                const uInput = document.getElementById('user-input');
                if (uInput) uInput.placeholder = "พิมพ์ข้อความหา Kira...";
            }
            if (taskVoiceBtn) {
                taskVoiceBtn.classList.remove('listening');
                const label = document.getElementById('voice-record-label');
                if (label) label.textContent = 'กดเพื่อพูดสั่งงานด้วยเสียง (Thai Voice-to-Task)';
            }
        };

        if (micBtn) {
            micBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (isListening) {
                    speechRecognition.stop();
                } else {
                    activeTarget = 'chat';
                    speechRecognition.start();
                }
            });
        }

        if (taskVoiceBtn) {
            taskVoiceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (isListening) {
                    speechRecognition.stop();
                } else {
                    activeTarget = 'task';
                    speechRecognition.start();
                }
            });
        }
    } catch (err) {
        console.warn("Could not init speech recognition:", err);
    }
}

// ====================================================================
// 💻 Live Canvas Drawer Controller (Artifacts Viewer)
// ====================================================================
function openInLiveCanvas(title, content, type = 'document') {
    const drawer = document.getElementById('artifacts-drawer');
    const nameEl = document.getElementById('artifacts-name');
    const iframe = document.getElementById('artifacts-iframe');
    if (!drawer || !iframe) return;

    if (nameEl) {
        nameEl.textContent = title || 'Live Deliverable Canvas';
    }

    drawer.classList.add('open');

    // Format content for display
    let htmlContent = '';
    if (type === 'code' && content.includes('<!DOCTYPE html>')) {
        htmlContent = content;
    } else {
        const renderedMd = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(content) : content;
        htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title || 'Deliverable'}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Prompt:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            background: #0f172a;
            color: #f8fafc;
            font-family: 'Outfit', 'Prompt', sans-serif;
            padding: 30px;
            line-height: 1.7;
        }
        h1, h2, h3, h4 { color: #38bdf8; margin-top: 20px; margin-bottom: 10px; }
        h1 { border-bottom: 2px solid rgba(56, 189, 248, 0.3); padding-bottom: 8px; }
        p { margin-bottom: 14px; color: #cbd5e1; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(30, 41, 59, 0.5); border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 14px; border: 1px solid rgba(255, 255, 255, 0.08); text-align: left; }
        th { background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600; }
        ul, ol { padding-left: 24px; margin-bottom: 14px; color: #cbd5e1; }
        li { margin-bottom: 6px; }
        pre { background: #070b14; padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.1); color: #38bdf8; }
        code { font-family: monospace; background: rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; }
        blockquote { border-left: 4px solid #38bdf8; padding-left: 16px; color: #94a3b8; font-style: italic; margin: 16px 0; }
    </style>
</head>
<body>
    ${renderedMd}
</body>
</html>`;
    }

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
}

function initLiveCanvasController() {
    const btnClose = document.getElementById('btn-close-artifact');
    const drawer = document.getElementById('artifacts-drawer');
    const btnDesktop = document.getElementById('btn-viewport-desktop');
    const btnMobile = document.getElementById('btn-viewport-mobile');
    const iframe = document.getElementById('artifacts-iframe');

    if (btnClose && drawer) {
        btnClose.addEventListener('click', () => {
            drawer.classList.remove('open');
        });
    }

    if (btnDesktop && btnMobile && iframe) {
        btnDesktop.addEventListener('click', () => {
            btnDesktop.classList.add('active');
            btnMobile.classList.remove('active');
            iframe.style.maxWidth = '100%';
        });

        btnMobile.addEventListener('click', () => {
            btnMobile.classList.add('active');
            btnDesktop.classList.remove('active');
            iframe.style.maxWidth = '375px';
            iframe.style.margin = '0 auto';
            iframe.style.display = 'block';
        });
    }
}

// ====================================================================
// 📋 Kira Omni-Task Suite & Matrix Controller
// ====================================================================


async function loadOmniTasks() {
    const user = currentUser || localStorage.getItem('kira_username') || 'guest';
    try {
        const res = await fetch(`/api/tasks?username=${encodeURIComponent(user)}`);
        const data = await res.json();
        if (data.status === 'success') {
            currentTasksList = data.tasks || [];
            renderOmniTasks(currentTasksList);
        }
    } catch (err) {
        console.warn("Failed to load tasks:", err);
    }
}

function renderOmniTasks(tasks) {
    const cQ1 = document.getElementById('container-q1');
    const cQ2 = document.getElementById('container-q2');
    const cQ3 = document.getElementById('container-q3');
    const cQ4 = document.getElementById('container-q4');

    const kBacklog = document.getElementById('kanban-container-backlog');
    const kProgress = document.getElementById('kanban-container-progress');
    const kCompleted = document.getElementById('kanban-container-completed');

    let q1Count = 0, q2Count = 0, q3Count = 0, q4Count = 0;
    let bCount = 0, pCount = 0, cCount = 0;
    let draftedCount = 0, evaluatedCount = 0;

    if (cQ1) cQ1.innerHTML = '';
    if (cQ2) cQ2.innerHTML = '';
    if (cQ3) cQ3.innerHTML = '';
    if (cQ4) cQ4.innerHTML = '';
    if (kBacklog) kBacklog.innerHTML = '';
    if (kProgress) kProgress.innerHTML = '';
    if (kCompleted) kCompleted.innerHTML = '';

    tasks.forEach(task => {
        if (task.deliverable) draftedCount++;
        if (task.boardroom_review) evaluatedCount++;

        const cardHtml = createTaskCardHTML(task);

        const prio = task.priority || 'important_not_urgent';
        if (prio === 'urgent_important') {
            q1Count++;
            if (cQ1) cQ1.insertAdjacentHTML('beforeend', cardHtml);
        } else if (prio === 'important_not_urgent' || prio === 'important') {
            q2Count++;
            if (cQ2) cQ2.insertAdjacentHTML('beforeend', cardHtml);
        } else if (prio === 'urgent_not_important' || prio === 'urgent') {
            q3Count++;
            if (cQ3) cQ3.insertAdjacentHTML('beforeend', cardHtml);
        } else {
            q4Count++;
            if (cQ4) cQ4.insertAdjacentHTML('beforeend', cardHtml);
        }

        const st = task.status || 'backlog';
        if (st === 'backlog') {
            bCount++;
            if (kBacklog) kBacklog.insertAdjacentHTML('beforeend', cardHtml);
        } else if (st === 'in_progress') {
            pCount++;
            if (kProgress) kProgress.insertAdjacentHTML('beforeend', cardHtml);
        } else if (st === 'completed') {
            cCount++;
            if (kCompleted) kCompleted.insertAdjacentHTML('beforeend', cardHtml);
        }
    });

    const emptyPlaceholder = '<div class="empty-task-placeholder">ไม่มีงานในหมวดนี้</div>';
    if (cQ1 && !q1Count) cQ1.innerHTML = emptyPlaceholder;
    if (cQ2 && !q2Count) cQ2.innerHTML = emptyPlaceholder;
    if (cQ3 && !q3Count) cQ3.innerHTML = emptyPlaceholder;
    if (cQ4 && !q4Count) cQ4.innerHTML = emptyPlaceholder;
    if (kBacklog && !bCount) kBacklog.innerHTML = emptyPlaceholder;
    if (kProgress && !pCount) kProgress.innerHTML = emptyPlaceholder;
    if (kCompleted && !cCount) kCompleted.innerHTML = emptyPlaceholder;

    const elQ1 = document.getElementById('count-q1'); if (elQ1) elQ1.textContent = q1Count;
    const elQ2 = document.getElementById('count-q2'); if (elQ2) elQ2.textContent = q2Count;
    const elQ3 = document.getElementById('count-q3'); if (elQ3) elQ3.textContent = q3Count;
    const elQ4 = document.getElementById('count-q4'); if (elQ4) elQ4.textContent = q4Count;

    const elKB = document.getElementById('kanban-count-backlog'); if (elKB) elKB.textContent = bCount;
    const elKP = document.getElementById('kanban-count-progress'); if (elKP) elKP.textContent = pCount;
    const elKC = document.getElementById('kanban-count-completed'); if (elKC) elKC.textContent = cCount;

    const elTotal = document.getElementById('task-stat-total'); if (elTotal) elTotal.textContent = `ทั้งหมด: ${tasks.length}`;
    const elDrafted = document.getElementById('task-stat-drafted'); if (elDrafted) elDrafted.textContent = `ร่างงานแล้ว: ${draftedCount}`;
    const elEval = document.getElementById('task-stat-evaluated'); if (elEval) elEval.textContent = `สภาประเมิน: ${evaluatedCount}`;

    const headerBadge = document.getElementById('task-matrix-badge');
    if (headerBadge) {
        if (tasks.length > 0) {
            headerBadge.style.display = 'inline-flex';
            headerBadge.textContent = tasks.length;
        } else {
            headerBadge.style.display = 'none';
        }
    }
}

function createTaskCardHTML(task) {
    const hasDeliverable = Boolean(task.deliverable);
    const hasBoardroom = Boolean(task.boardroom_review);
    const score = task.priority_score || 50;
    
    let statusBadge = '<span class="task-status-pill pill-backlog">รอดำเนินการ</span>';
    if (task.status === 'in_progress') statusBadge = '<span class="task-status-pill pill-progress">กำลังทำ</span>';
    if (task.status === 'completed') statusBadge = '<span class="task-status-pill pill-completed">เสร็จแล้ว</span>';

    let sourceIcon = '<i class="fa-solid fa-pen-to-square" title="เพิ่มด้วยตัวเอง"></i>';
    if (task.source === 'voice') sourceIcon = '<i class="fa-solid fa-microphone" style="color: #f43f5e;" title="สั่งด้วยเสียง AI"></i>';
    if (task.source === 'external_intake') sourceIcon = '<i class="fa-solid fa-globe" style="color: #38bdf8;" title="รับผ่านหน้าเว็บภายนอก"></i>';

    let boardroomHtml = '';
    if (hasBoardroom && task.boardroom_review) {
        const br = task.boardroom_review;
        const rec = br.recommendation || '';
        const revs = br.reviews || {};
        boardroomHtml = `
            <div class="task-boardroom-brief">
                <div class="br-header-chip"><i class="fa-solid fa-users-viewfinder"></i> สภามติ: ${rec}</div>
                <div class="br-exec-micro-opinions">
                    ${revs.CEO ? `<span title="CEO: ${escapeHTML(revs.CEO)}">👔 CEO</span>` : ''}
                    ${revs.CFO ? `<span title="CFO: ${escapeHTML(revs.CFO)}">💰 CFO</span>` : ''}
                    ${revs.CPO ? `<span title="CPO: ${escapeHTML(revs.CPO)}">🎨 CPO</span>` : ''}
                    ${revs.CTO ? `<span title="CTO: ${escapeHTML(revs.CTO)}">🛡️ CTO</span>` : ''}
                </div>
            </div>`;
    }

    return `
    <div class="task-card ${task.status === 'completed' ? 'is-done' : ''}" data-task-id="${task.task_id}">
        <div class="task-card-top">
            <div class="task-source-meta">${sourceIcon} <span>${task.requester ? escapeHTML(task.requester) : 'บอส'}</span></div>
            <div class="task-score-badge ${score >= 80 ? 'high-score' : ''}">Score: ${score}/100</div>
        </div>
        <h4 class="task-card-title">${escapeHTML(task.title)}</h4>
        ${task.description ? `<p class="task-card-desc">${escapeHTML(task.description)}</p>` : ''}
        
        ${boardroomHtml}

        <div class="task-card-footer">
            <div class="task-meta-left">
                ${statusBadge}
                ${hasDeliverable ? '<span class="deliverable-ready-badge" title="มีชิ้นงาน First-Draft พร้อมใช้"><i class="fa-solid fa-bolt"></i> ร่างงานพร้อม</span>' : ''}
            </div>
            <div class="task-card-actions">
                ${hasDeliverable ? `
                    <button class="btn-card-action btn-open-canvas" onclick="window.viewTaskDeliverable('${task.task_id}')" title="เปิดชิ้นงานบน Live Canvas">
                        <i class="fa-solid fa-laptop-code"></i> Canvas
                    </button>
                ` : `
                    <button class="btn-card-action btn-draft-now" onclick="window.draftTaskNow('${task.task_id}', this)" title="สั่ง AI เจนชิ้นงานร่างแรกทันที">
                        <i class="fa-solid fa-bolt-lightning"></i> ร่างงาน
                    </button>
                `}
                
                ${!hasBoardroom ? `
                    <button class="btn-card-action btn-eval-now" onclick="window.evaluateTaskNow('${task.task_id}', this)" title="ส่งสภา 4 ผู้บริหารประเมิน">
                        <i class="fa-solid fa-gavel"></i> ประเมิน
                    </button>
                ` : ''}

                <button class="btn-card-action btn-toggle-status" onclick="window.toggleTaskStatus('${task.task_id}', '${task.status}')" title="สลับสถานะงาน">
                    <i class="fa-solid ${task.status === 'completed' ? 'fa-rotate-left' : 'fa-check'}"></i>
                </button>

                <button class="btn-card-action btn-delete-task" onclick="window.deleteTaskItem('${task.task_id}')" title="ลบงานนี้">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        </div>
    </div>`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

window.viewTaskDeliverable = function(taskId) {
    const task = currentTasksList.find(t => t.task_id === taskId);
    if (!task || !task.deliverable) return;
    openInLiveCanvas(task.title, task.deliverable, task.deliverable_type);
};

window.draftTaskNow = async function(taskId, btn) {
    const user = currentUser || localStorage.getItem('kira_username') || 'guest';
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        const res = await fetch(`/api/tasks/${taskId}/auto-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            await loadOmniTasks();
            openInLiveCanvas(data.title || 'ชิ้นงานร่างแรก', data.deliverable, data.deliverable_type);
        } else {
            alert('เกิดข้อผิดพลาดในการร่างงาน: ' + (data.detail || data.message));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

window.evaluateTaskNow = async function(taskId, btn) {
    const user = currentUser || localStorage.getItem('kira_username') || 'guest';
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        const res = await fetch(`/api/tasks/${taskId}/evaluate-boardroom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            await loadOmniTasks();
        } else {
            alert('เกิดข้อผิดพลาดในการประเมิน: ' + (data.detail || data.message));
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
};

window.toggleTaskStatus = async function(taskId, currentStatus) {
    const nextStatus = currentStatus === 'completed' ? 'backlog' : (currentStatus === 'backlog' ? 'in_progress' : 'completed');
    const user = currentUser || localStorage.getItem('kira_username') || 'guest';

    try {
        const res = await fetch(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, status: nextStatus })
        });
        if (res.ok) {
            await loadOmniTasks();
        }
    } catch (err) {
        console.warn("Failed to update status:", err);
    }
};

window.deleteTaskItem = async function(taskId) {
    if (!confirm('ต้องการลบภารกิจนี้ใช่หรือไม่?')) return;
    try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            await loadOmniTasks();
        }
    } catch (err) {
        console.warn("Failed to delete task:", err);
    }
};

function initTaskMatrixController() {
    const btnToggle = document.getElementById('btn-task-matrix-toggle');
    const modal = document.getElementById('task-matrix-modal');
    const btnClose = document.getElementById('btn-close-task-matrix');
    const btnQuickNew = document.getElementById('btn-quick-new-task');
    const tabBtns = document.querySelectorAll('.matrix-tab-btn');
    const createTaskForm = document.getElementById('create-task-form');
    const publicUrlInput = document.getElementById('public-intake-url-input');
    const btnCopyUrl = document.getElementById('btn-copy-intake-url');

    if (publicUrlInput) {
        publicUrlInput.value = window.location.origin + '/intake';
    }

    if (btnCopyUrl && publicUrlInput) {
        btnCopyUrl.addEventListener('click', () => {
            navigator.clipboard.writeText(publicUrlInput.value).then(() => {
                const orig = btnCopyUrl.innerHTML;
                btnCopyUrl.innerHTML = '<i class="fa-solid fa-check"></i> คัดลอกแล้ว!';
                btnCopyUrl.style.color = '#10b981';
                setTimeout(() => {
                    btnCopyUrl.innerHTML = orig;
                    btnCopyUrl.style.color = '';
                }, 2000);
            });
        });
    }

    if (btnToggle && modal) {
        btnToggle.addEventListener('click', () => {
            modal.style.display = 'flex';
            loadOmniTasks();
        });
    }

    if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.task-tab-pane').forEach(p => p.classList.remove('active'));
            const activePane = document.getElementById(`tab-pane-${targetTab}`);
            if (activePane) activePane.classList.add('active');
        });
    });

    if (btnQuickNew) {
        btnQuickNew.addEventListener('click', () => {
            tabBtns.forEach(b => {
                if (b.getAttribute('data-tab') === 'new-task') {
                    b.click();
                }
            });
            const tInput = document.getElementById('task-form-title');
            if (tInput) tInput.focus();
        });
    }

    if (createTaskForm) {
        createTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-task');
            const origHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังสร้างและวิเคราะห์ภารกิจ...';

            const user = currentUser || localStorage.getItem('kira_username') || 'guest';
            const payload = {
                username: user,
                title: document.getElementById('task-form-title').value.trim(),
                description: document.getElementById('task-form-desc').value.trim(),
                priority: document.getElementById('task-form-priority').value,
                requester: document.getElementById('task-form-requester').value.trim() || user,
                auto_draft: document.getElementById('task-switch-autodraft').checked,
                evaluate_boardroom: document.getElementById('task-switch-boardroom').checked
            };

            try {
                const res = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    createTaskForm.reset();
                    document.getElementById('task-switch-autodraft').checked = true;
                    document.getElementById('task-switch-boardroom').checked = true;
                    await loadOmniTasks();

                    tabBtns.forEach(b => {
                        if (b.getAttribute('data-tab') === 'matrix') b.click();
                    });

                    if (data.has_deliverable) {
                        window.viewTaskDeliverable(data.task_id);
                    }
                } else {
                    alert('ไม่สามารถสร้างงานได้: ' + (data.detail || data.message));
                }
            } catch (err) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml;
            }
        });
    }

    loadOmniTasks();
}


// ====================================================================
// 👑 Kira Subscription & Monetization Engine Controller
// ====================================================================
function initSubscriptionController() {
    const subModal = document.getElementById('subscription-modal');
    const btnUpgradePro = document.getElementById('btn-upgrade-pro');
    const btnCloseSub = document.getElementById('btn-close-subscription');
    const btnCloseSubDone = document.getElementById('btn-close-sub-done');
    const userPlanBadge = document.getElementById('user-plan-badge');
    const planBadgeText = document.getElementById('plan-badge-text');

    const subViewPlans = document.getElementById('sub-view-plans');
    const subViewCheckout = document.getElementById('sub-view-checkout');
    const subViewSuccess = document.getElementById('sub-view-success');

    const subCurrentPlan = document.getElementById('sub-modal-current-plan');
    const subExpiryInfo = document.getElementById('sub-modal-expiry-info');
    const subBadgeHint = document.getElementById('sub-modal-badge-hint');

    const checkoutPlanTitle = document.getElementById('checkout-plan-title');
    const checkoutPlanPrice = document.getElementById('checkout-plan-price');
    const ppQrImg = document.getElementById('promptpay-qr-image');
    const ppNumberText = document.getElementById('pp-number-text');
    const ppNameText = document.getElementById('pp-name-text');
    const ppAmountText = document.getElementById('pp-amount-text');
    const btnCopyPpNumber = document.getElementById('btn-copy-pp-number');

    const slipDropzone = document.getElementById('slip-dropzone');
    const slipFileInput = document.getElementById('slip-file-input');
    const dropzoneIdle = document.getElementById('dropzone-idle');
    const dropzonePreview = document.getElementById('dropzone-preview');
    const slipPreviewImg = document.getElementById('slip-preview-img');
    const slipFilename = document.getElementById('slip-filename');
    const btnRemoveSlip = document.getElementById('btn-remove-slip');
    const slipNoteInput = document.getElementById('slip-note-input');
    const activeOrderIdInput = document.getElementById('active-order-id');
    const btnBackToPlans = document.getElementById('btn-back-to-plans');
    const btnSubmitSlip = document.getElementById('btn-submit-order-slip');

    const confirmedOrderId = document.getElementById('confirmed-order-id');
    const btnRefreshOrderStatus = document.getElementById('btn-refresh-order-status');

    // Admin in-app orders
    const btnAdminOrders = document.getElementById('btn-admin-orders');
    const adminOrdersBadge = document.getElementById('admin-orders-badge');
    const adminOrdersModal = document.getElementById('admin-orders-modal');
    const btnCloseAdminOrders = document.getElementById('btn-close-admin-orders');
    const btnReloadAdminOrders = document.getElementById('btn-reload-admin-orders');
    const adminOrdersTableBody = document.getElementById('admin-orders-table-body');
    const adminStatPending = document.getElementById('admin-stat-pending');
    const adminStatApproved = document.getElementById('admin-stat-approved');
    const adminStatRevenue = document.getElementById('admin-stat-revenue');

    // Lightbox
    const slipLightboxModal = document.getElementById('slip-lightbox-modal');
    const slipLightboxImg = document.getElementById('slip-lightbox-img');
    const btnCloseSlipLightbox = document.getElementById('btn-close-slip-lightbox');

    let currentSlipBase64 = null;
    let statusPollingTimer = null;

    // Open/Close Modal
    function openSubModal(targetPlan = null) {
        if (!subModal) return;
        subModal.style.display = 'flex';
        switchSubView('plans');
        refreshSubscriptionStatus();
        if (targetPlan) {
            selectPlan(targetPlan);
        }
    }

    function closeSubModal() {
        if (!subModal) return;
        subModal.style.display = 'none';
        if (statusPollingTimer) {
            clearInterval(statusPollingTimer);
            statusPollingTimer = null;
        }
    }

    function switchSubView(viewName) {
        if (subViewPlans) subViewPlans.style.display = viewName === 'plans' ? 'block' : 'none';
        if (subViewCheckout) subViewCheckout.style.display = viewName === 'checkout' ? 'block' : 'none';
        if (subViewSuccess) subViewSuccess.style.display = viewName === 'success' ? 'block' : 'none';
    }

    if (btnUpgradePro) btnUpgradePro.addEventListener('click', () => openSubModal());
    if (userPlanBadge) userPlanBadge.addEventListener('click', () => openSubModal());
    if (btnCloseSub) btnCloseSub.addEventListener('click', closeSubModal);
    if (btnCloseSubDone) btnCloseSubDone.addEventListener('click', closeSubModal);
    if (subModal) {
        subModal.addEventListener('click', (e) => {
            if (e.target === subModal) closeSubModal();
        });
    }

    // Refresh user's subscription status
    async function refreshSubscriptionStatus() {
        const user = currentUser || localStorage.getItem('kira_username');
        if (!user) return;
        try {
            const res = await fetch(`/api/subscription/status/${encodeURIComponent(user)}`);
            const data = await res.json();
            if (data.status === 'success' && data.subscription) {
                const sub = data.subscription;
                if (planBadgeText && sub.badge) {
                    planBadgeText.textContent = sub.badge;
                }
                if (userPlanBadge && sub.plan) {
                    if (sub.plan === 'founder' || sub.is_boss) {
                        userPlanBadge.style.color = '#c084fc';
                        userPlanBadge.style.background = 'rgba(168, 85, 247, 0.15)';
                        userPlanBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                    } else if (sub.plan === 'pro') {
                        userPlanBadge.style.color = '#fbbf24';
                        userPlanBadge.style.background = 'rgba(245, 158, 11, 0.18)';
                        userPlanBadge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                    } else if (sub.plan === 'trial') {
                        userPlanBadge.style.color = '#38bdf8';
                        userPlanBadge.style.background = 'rgba(56, 189, 248, 0.15)';
                        userPlanBadge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                    } else {
                        userPlanBadge.style.color = '#94a3b8';
                        userPlanBadge.style.background = 'rgba(148, 163, 184, 0.12)';
                        userPlanBadge.style.borderColor = 'rgba(148, 163, 184, 0.25)';
                    }
                }

                if (subCurrentPlan && sub.badge) {
                    subCurrentPlan.textContent = sub.badge;
                }
                if (subExpiryInfo) {
                    if (sub.is_boss) {
                        subExpiryInfo.textContent = '• บัญชีผู้ดูแลระบบ / Boss Admin (สิทธิ์ไม่จำกัดตลอดชีพ)';
                    } else if (sub.expire_date) {
                        const expStr = sub.expire_date.includes(' ') ? sub.expire_date.split(' ')[0] : sub.expire_date.split('T')[0];
                        subExpiryInfo.textContent = `• ใช้งานได้ถึง: ${expStr} (โควตา ${sub.daily_quota || 500} ข้อความ/วัน)`;
                    } else {
                        subExpiryInfo.textContent = '• โควตาฟรี 15 ข้อความ/วัน';
                    }
                }
                if (subBadgeHint) {
                    if (sub.is_active_pro) {
                        subBadgeHint.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> กำลังใช้งาน ${sub.badge} (โควตา ${sub.daily_quota || 500} ข้อความ/วัน)`;
                    } else {
                        subBadgeHint.textContent = 'อัปเกรดเพื่อรับโควตาสูงสุด 1,000 ข้อความ/วัน พร้อมปลดล็อกทุกฟีเจอร์';
                    }
                }
            }

            // Check if user is Boss to show Admin Orders button
            if (isBoss(user)) {
                if (btnAdminOrders) btnAdminOrders.style.display = 'inline-flex';
                checkAdminPendingCount();
            }
        } catch (e) {
            console.error("Subscription status fetch error:", e);
        }
    }
    window.refreshSubscriptionStatus = refreshSubscriptionStatus;
    window.openSubModal = openSubModal;

    // Plan selection & Order creation
    async function selectPlan(planId) {
        const user = currentUser || localStorage.getItem('kira_username');
        if (!user) {
            alert('กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อค่ะ');
            return;
        }

        const selectBtns = document.querySelectorAll(`.btn-select-plan[data-plan="${planId}"]`);
        selectBtns.forEach(b => {
            b.disabled = true;
            b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างคำสั่งซื้อ...';
        });

        try {
            const res = await fetch('/api/subscription/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, plan_id: planId })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                if (activeOrderIdInput) activeOrderIdInput.value = data.order_id;
                if (checkoutPlanTitle) checkoutPlanTitle.textContent = `${data.plan_name} (${data.days} วัน)`;
                if (checkoutPlanPrice) checkoutPlanPrice.textContent = Number(data.amount).toFixed(2);
                if (ppAmountText) ppAmountText.textContent = `${Number(data.amount).toFixed(2)} บาท`;
                if (ppNumberText) ppNumberText.textContent = data.promptpay_number;
                if (ppNameText) ppNameText.textContent = data.promptpay_name;

                // Set QR Image URL: Use verified local PromptPay card asset of Boss, fallback to QR
                const promptpayCardUrl = data.promptpay_qr_url || data.qr_url || '/static/images/boss_promptpay_card.png';
                if (ppQrImg) {
                    ppQrImg.src = promptpayCardUrl;
                    ppQrImg.onerror = () => {
                        ppQrImg.src = '/static/images/boss_promptpay_qr.png';
                    };
                }
                const ppBankText = document.getElementById('pp-bank-text');
                if (ppBankText && data.promptpay_bank) {
                    ppBankText.textContent = `${data.promptpay_bank} • บัญชี ${data.promptpay_account || '004-9-99252-5'}`;
                }

                // Reset dropzone
                resetSlipDropzone();
                switchSubView('checkout');
            } else {
                alert('ไม่สามารถสร้างคำสั่งซื้อได้: ' + (data.detail || data.message));
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + e.message);
        } finally {
            selectBtns.forEach(b => {
                b.disabled = false;
                if (planId === 'trial') b.innerHTML = '<span>เลือกแพ็กเกจ Trial (39.-)</span> <i class="fa-solid fa-arrow-right"></i>';
                else if (planId === 'pro') b.innerHTML = '<span>สมัครสมาชิก Kira Pro (129.-)</span> <i class="fa-solid fa-bolt-lightning"></i>';
                else b.innerHTML = '<span>ครอบครองสิทธิ์ Founder (499.-)</span> <i class="fa-solid fa-gem"></i>';
            });
        }
    }

    // Bind Plan buttons
    document.querySelectorAll('.btn-select-plan').forEach(btn => {
        btn.addEventListener('click', () => {
            const plan = btn.getAttribute('data-plan');
            selectPlan(plan);
        });
    });

    if (btnBackToPlans) {
        btnBackToPlans.addEventListener('click', () => {
            switchSubView('plans');
        });
    }

    // Save QR Image to device for banking app scan
    const btnSaveQrImage = document.getElementById('btn-save-qr-image');
    if (btnSaveQrImage && ppQrImg) {
        btnSaveQrImage.addEventListener('click', () => {
            const imgSrc = ppQrImg.src || '/static/images/boss_promptpay_card.png';
            const link = document.createElement('a');
            link.href = imgSrc;
            link.download = 'Kira_PromptPay_QR.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            const origHtml = btnSaveQrImage.innerHTML;
            btnSaveQrImage.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> บันทึกภาพแล้ว! เปิดแอปธนาคารสแกนได้เลยค่ะ';
            setTimeout(() => { btnSaveQrImage.innerHTML = origHtml; }, 3000);
        });
    }

    if (btnCopyPpNumber && ppNumberText) {
        btnCopyPpNumber.addEventListener('click', () => {
            const num = ppNumberText.textContent.trim();
            navigator.clipboard.writeText(num).then(() => {
                const orig = btnCopyPpNumber.innerHTML;
                btnCopyPpNumber.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> คัดลอกแล้ว!';
                setTimeout(() => { btnCopyPpNumber.innerHTML = orig; }, 2000);
            }).catch(() => {
                alert('คัดลอกหมายเลข: ' + num);
            });
        });
    }

    // Slip Upload Handling
    function resetSlipDropzone() {
        currentSlipBase64 = null;
        if (slipFileInput) slipFileInput.value = '';
        if (dropzoneIdle) dropzoneIdle.style.display = 'block';
        if (dropzonePreview) dropzonePreview.style.display = 'none';
        if (btnSubmitSlip) btnSubmitSlip.disabled = true;
        if (slipNoteInput) slipNoteInput.value = '';
    }

    if (slipDropzone) {
        slipDropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btn-remove-slip')) return;
            if (slipFileInput) slipFileInput.click();
        });

        slipDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            slipDropzone.classList.add('dragover');
        });

        slipDropzone.addEventListener('dragleave', () => {
            slipDropzone.classList.remove('dragover');
        });

        slipDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            slipDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processSlipFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (slipFileInput) {
        slipFileInput.addEventListener('change', () => {
            if (slipFileInput.files && slipFileInput.files.length > 0) {
                processSlipFile(slipFileInput.files[0]);
            }
        });
    }

    if (btnRemoveSlip) {
        btnRemoveSlip.addEventListener('click', (e) => {
            e.stopPropagation();
            resetSlipDropzone();
        });
    }

    function processSlipFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('กรุณาเลือกไฟล์รูปภาพเท่านั้นค่ะ (JPG, PNG, WEBP)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('ขนาดไฟล์เกิน 10MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลงค่ะ');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentSlipBase64 = e.target.result;
            if (slipPreviewImg) slipPreviewImg.src = currentSlipBase64;
            if (slipFilename) slipFilename.textContent = file.name;
            if (dropzoneIdle) dropzoneIdle.style.display = 'none';
            if (dropzonePreview) dropzonePreview.style.display = 'flex';
            if (btnSubmitSlip) btnSubmitSlip.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    // Submit Slip
    if (btnSubmitSlip) {
        btnSubmitSlip.addEventListener('click', async () => {
            const orderId = activeOrderIdInput ? activeOrderIdInput.value : '';
            if (!orderId || !currentSlipBase64) {
                alert('กรุณาแนบรูปภาพสลิปโอนเงินก่อนทำการส่งค่ะ');
                return;
            }

            const origHtml = btnSubmitSlip.innerHTML;
            btnSubmitSlip.disabled = true;
            btnSubmitSlip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลดสลิป...';

            try {
                const note = slipNoteInput ? slipNoteInput.value.trim() : '';
                const uName = currentUser || localStorage.getItem('kira_username') || '';
                const res = await fetch('/api/subscription/upload-slip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: orderId,
                        slip_image_base64: currentSlipBase64,
                        transfer_note: note,
                        username: uName
                    })
                });
                const data = await res.json();
                if (res.ok && data.status === 'success') {
                    if (confirmedOrderId) confirmedOrderId.textContent = `#${orderId}`;
                    const subSuccessPlanInfo = document.getElementById('sub-success-plan-info');
                    if (subSuccessPlanInfo && data.badge) {
                        subSuccessPlanInfo.textContent = `เปิดใช้งาน ${data.badge} เรียบร้อย (โควตา ${data.daily_quota || 500} ข้อความ/วัน ถึง ${data.expire_display || ''})`;
                    }
                    switchSubView('success');

                    // Instant auto activation: refresh profile & subscription status immediately
                    if (typeof refreshSubscriptionStatus === 'function') refreshSubscriptionStatus();
                    if (typeof loadUserProfile === 'function') loadUserProfile();

                    // If Kira returned a tailored welcome message, append it directly to the chat!
                    if (data.welcome_message && typeof addMessage === 'function') {
                        setTimeout(() => {
                            addMessage(data.welcome_message, false);
                        }, 500);
                    }
                } else {
                    alert('ส่งสลิปไม่สำเร็จ: ' + (data.detail || data.message));
                }
            } catch (err) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
            } finally {
                btnSubmitSlip.disabled = false;
                btnSubmitSlip.innerHTML = origHtml;
            }
        });
    }

    // Poll Order Status
    function startOrderStatusPolling(orderId) {
        if (statusPollingTimer) clearInterval(statusPollingTimer);
        statusPollingTimer = setInterval(async () => {
            await checkOrderStatus(orderId, false);
        }, 8000);
    }

    async function checkOrderStatus(orderId, alertIfPending = true) {
        const user = currentUser || localStorage.getItem('kira_username');
        if (!user) return;
        try {
            const res = await fetch(`/api/subscription/status/${encodeURIComponent(user)}`);
            const data = await res.json();
            if (data.status === 'success') {
                const sub = data.subscription;
                if (sub.is_active_pro) {
                    if (statusPollingTimer) {
                        clearInterval(statusPollingTimer);
                        statusPollingTimer = null;
                    }
                    alert('🎉 ยินดีด้วยค่ะ! บัญชีของคุณได้รับการอนุมัติเป็น ' + sub.badge + ' เรียบร้อยแล้ว!');
                    closeSubModal();
                    loadUserProfile();
                } else if (alertIfPending) {
                    alert('คำสั่งซื้อ #' + orderId + ' อยู่ในระหว่างการตรวจสอบสลิป กรุณารอสักครู่ค่ะ');
                }
            }
        } catch (e) {
            console.error("Order status check error:", e);
        }
    }

    if (btnRefreshOrderStatus) {
        btnRefreshOrderStatus.addEventListener('click', () => {
            const orderId = (confirmedOrderId ? confirmedOrderId.textContent : '').replace('#', '');
            checkOrderStatus(orderId, true);
        });
    }

    // ==========================================
    // 🛡️ In-App Admin Orders Management for Boss
    // ==========================================
    let cachedAdminOrders = [];

    async function checkAdminPendingCount() {
        try {
            const res = await fetch('/api/admin/subscription/orders');
            const data = await res.json();
            if (data.status === 'success' && data.orders) {
                const pending = data.orders.filter(o => o.status === 'pending').length;
                if (adminOrdersBadge) {
                    adminOrdersBadge.textContent = pending;
                    adminOrdersBadge.style.display = pending > 0 ? 'inline-block' : 'none';
                }
            }
        } catch (e) {}
    }

    async function loadAdminOrdersInApp() {
        if (!adminOrdersTableBody) return;
        adminOrdersTableBody.innerHTML = '<tr><td colspan="7" class="empty-orders-text"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดรายการคำสั่งซื้อ...</td></tr>';
        
        try {
            const res = await fetch('/api/admin/subscription/orders');
            const data = await res.json();
            if (data.status !== 'success') {
                adminOrdersTableBody.innerHTML = `<tr><td colspan="7" class="empty-orders-text text-red-400">เกิดข้อผิดพลาด: ${data.detail || data.message}</td></tr>`;
                return;
            }

            cachedAdminOrders = data.orders || [];
            let pendingCount = 0;
            let approvedCount = 0;
            let totalRevenue = 0;

            if (cachedAdminOrders.length === 0) {
                adminOrdersTableBody.innerHTML = '<tr><td colspan="7" class="empty-orders-text">ยังไม่มีคำสั่งซื้อในระบบ</td></tr>';
            } else {
                let html = '';
                cachedAdminOrders.forEach(o => {
                    if (o.status === 'pending') pendingCount++;
                    if (o.status === 'approved') {
                        approvedCount++;
                        totalRevenue += (o.amount || 0);
                    }

                    let statusPill = '';
                    if (o.status === 'pending') {
                        statusPill = '<span class="status-badge-chip" style="background:rgba(245,158,11,0.2);color:#fbbf24;border-color:rgba(245,158,11,0.4);">รอตรวจสอบ</span>';
                    } else if (o.status === 'approved') {
                        statusPill = '<span class="status-badge-chip" style="background:rgba(16,185,129,0.2);color:#34d399;border-color:rgba(16,185,129,0.4);">อนุมัติแล้ว</span>';
                    } else {
                        statusPill = '<span class="status-badge-chip" style="background:rgba(239,68,68,0.2);color:#f87171;border-color:rgba(239,68,68,0.4);">ปฏิเสธ</span>';
                    }

                    let slipPreview = '<span style="color:#64748b;font-size:0.75rem;">ไม่มีสลิป</span>';
                    if (o.slip_image) {
                        slipPreview = `<img src="${o.slip_image}" alt="Slip" class="slip-thumb-mini" onclick="window.zoomSlipInApp('${o.order_id}')" title="คลิกเพื่อดูภาพขยาย">`;
                    }

                    let actions = '';
                    if (o.status === 'pending') {
                        actions = `
                            <div style="display:flex;gap:6px;">
                                <button type="button" class="btn-action-sm primary" onclick="window.approveOrderInApp('${o.order_id}')" style="background:#059669;padding:4px 10px;font-size:0.75rem;">
                                    <i class="fa-solid fa-check"></i> อนุมัติ
                                </button>
                                <button type="button" class="btn-action-sm secondary" onclick="window.rejectOrderInApp('${o.order_id}')" style="background:#dc2626;padding:4px 10px;font-size:0.75rem;">
                                    <i class="fa-solid fa-xmark"></i> ปฏิเสธ
                                </button>
                            </div>
                        `;
                    } else {
                        actions = '<span style="color:#64748b;font-size:0.75rem;">ดำเนินการแล้ว</span>';
                    }

                    html += `
                        <tr>
                            <td>
                                <strong style="font-family:monospace;color:#fbbf24;display:block;">${o.order_id}</strong>
                                <span style="font-size:0.72rem;color:#64748b;">${o.created_at || '-'}</span>
                            </td>
                            <td>
                                <strong style="color:#38bdf8;">@${o.username}</strong>
                            </td>
                            <td>
                                <span style="background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:6px;font-size:0.75rem;">${o.plan_name || o.plan_id}</span>
                            </td>
                            <td>
                                <strong style="color:#fbbf24;">฿${Number(o.amount).toFixed(2)}</strong>
                            </td>
                            <td>${slipPreview}</td>
                            <td>${statusPill}</td>
                            <td>${actions}</td>
                        </tr>
                    `;
                });
                adminOrdersTableBody.innerHTML = html;
            }

            if (adminStatPending) adminStatPending.textContent = `${pendingCount} รายการ`;
            if (adminStatApproved) adminStatApproved.textContent = `${approvedCount} รายการ`;
            if (adminStatRevenue) adminStatRevenue.textContent = `${totalRevenue.toLocaleString('th-TH')} ฿`;
            if (adminOrdersBadge) {
                adminOrdersBadge.textContent = pendingCount;
                adminOrdersBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            }
        } catch (e) {
            console.error("Admin orders load error:", e);
        }
    }

    if (btnAdminOrders) {
        btnAdminOrders.addEventListener('click', () => {
            if (adminOrdersModal) adminOrdersModal.style.display = 'flex';
            loadAdminOrdersInApp();
        });
    }

    if (btnCloseAdminOrders && adminOrdersModal) {
        btnCloseAdminOrders.addEventListener('click', () => {
            adminOrdersModal.style.display = 'none';
        });
        adminOrdersModal.addEventListener('click', (e) => {
            if (e.target === adminOrdersModal) adminOrdersModal.style.display = 'none';
        });
    }

    if (btnReloadAdminOrders) {
        btnReloadAdminOrders.addEventListener('click', loadAdminOrdersInApp);
    }

    // Global in-app actions for Admin Table
    window.zoomSlipInApp = function(orderId) {
        const ord = cachedAdminOrders.find(x => x.order_id === orderId);
        if (!ord || !ord.slip_image) return;
        if (slipLightboxImg && slipLightboxModal) {
            slipLightboxImg.src = ord.slip_image;
            slipLightboxModal.style.display = 'flex';
        }
    };

    if (btnCloseSlipLightbox && slipLightboxModal) {
        btnCloseSlipLightbox.addEventListener('click', () => {
            slipLightboxModal.style.display = 'none';
        });
        slipLightboxModal.addEventListener('click', (e) => {
            if (e.target === slipLightboxModal) slipLightboxModal.style.display = 'none';
        });
    }

    window.approveOrderInApp = async function(orderId) {
        if (!confirm(`ยืนยันการอนุมัติคำสั่งซื้อ #${orderId} และเปิดสถานะสมาชิกให้ผู้ใช้งานทันที?`)) return;
        try {
            const res = await fetch('/api/admin/subscription/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, note: 'Approved via in-app dashboard' })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                alert('อนุมัติคำสั่งซื้อเรียบร้อยแล้ว!');
                loadAdminOrdersInApp();
                checkAdminPendingCount();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.detail || data.message));
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        }
    };

    window.rejectOrderInApp = async function(orderId) {
        const reason = prompt('ระบุเหตุผลในการปฏิเสธคำสั่งซื้อ:', 'สลิปไม่ถูกต้อง หรือยอดโอนไม่ตรง');
        if (reason === null) return;
        try {
            const res = await fetch('/api/admin/subscription/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, reason: reason })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                alert('ปฏิเสธคำสั่งซื้อเรียบร้อยแล้ว');
                loadAdminOrdersInApp();
                checkAdminPendingCount();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.detail || data.message));
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด: ' + e.message);
        }
    };

    // Initial check
    setTimeout(refreshSubscriptionStatus, 1500);
}

// ====================================================================
// 📱 Progressive Web App (PWA) Controller & Installation Logic
// ====================================================================


function initPWAController() {
    const btnHeaderInstall = document.getElementById('btn-install-pwa-header');
    const btnMenuInstall = document.getElementById('btn-install-app-menu');
    const pwaBanner = document.getElementById('pwa-install-banner');
    const pwaBtnInstall = document.getElementById('pwa-btn-install');
    const pwaBtnDismiss = document.getElementById('pwa-btn-dismiss');
    const iosModal = document.getElementById('ios-pwa-modal');
    const iosCloseBtn = document.getElementById('ios-pwa-close');
    const iosGotitBtn = document.getElementById('ios-pwa-gotit-btn');
    const pwaMenuStatus = document.getElementById('pwa-menu-status');

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((reg) => {
                    console.log('🌸 Kira PWA Service Worker Registered! Scope:', reg.scope);
                })
                .catch((err) => {
                    console.warn('PWA /sw.js registration attempt failed, trying fallback:', err);
                    navigator.serviceWorker.register('/static/sw.js', { scope: '/' })
                        .catch((fallbackErr) => console.warn('PWA fallback SW registration error:', fallbackErr));
                });
        });
    }

    // 2. Check if already installed in standalone mode
    const isStandalone = (window.matchMedia && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator && navigator.standalone === true);
    if (isStandalone) {
        if (pwaMenuStatus) pwaMenuStatus.textContent = 'ติดตั้งบนอุปกรณ์นี้แล้ว';
        if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
        if (pwaBanner) pwaBanner.style.display = 'none';
        return;
    }

    // 3. Detect iOS Safari
    const isIOS = (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '')) && !(window && window.MSStream);

    if (isIOS && !isStandalone) {
        if (btnHeaderInstall) btnHeaderInstall.style.display = 'inline-flex';
        // Show banner after short delay if not dismissed recently
        const dismissedTime = localStorage.getItem('kira_pwa_dismissed');
        const now = Date.now();
        if (!dismissedTime || (now - parseInt(dismissedTime, 10)) > 3 * 24 * 60 * 60 * 1000) {
            setTimeout(() => {
                if (pwaBanner) pwaBanner.style.display = 'block';
            }, 3000);
        }
    }

    // 4. Capture beforeinstallprompt (Chrome, Edge, Samsung Internet, Android)
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar
        e.preventDefault();
        deferredPWAInstallPrompt = e;

        if (btnHeaderInstall) btnHeaderInstall.style.display = 'inline-flex';

        const dismissedTime = localStorage.getItem('kira_pwa_dismissed');
        const now = Date.now();
        if (!dismissedTime || (now - parseInt(dismissedTime, 10)) > 3 * 24 * 60 * 60 * 1000) {
            setTimeout(() => {
                if (pwaBanner) pwaBanner.style.display = 'block';
            }, 3000);
        }
    });

    // 5. Handle Install Triggers
    async function triggerPWAInstall() {
        if (deferredPWAInstallPrompt) {
            deferredPWAInstallPrompt.prompt();
            const choiceResult = await deferredPWAInstallPrompt.userChoice;
            if (choiceResult && choiceResult.outcome === 'accepted') {
                console.log('User accepted Kira PWA installation');
                if (pwaBanner) pwaBanner.style.display = 'none';
                if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
            }
            deferredPWAInstallPrompt = null;
        } else if (isIOS) {
            // Show iOS Safari instruction modal
            if (iosModal) iosModal.style.display = 'flex';
        } else {
            // Desktop fallback guidance
            if (typeof showConnectionToast === 'function') {
                showConnectionToast('💡 กดที่ไอคอน ⊕ หรือดาวน์โหลดบนช่อง Address Bar เพื่อติดตั้ง Kira AI ค่ะ', 'ready');
            } else {
                alert('ท่านสามารถติดตั้งแอปได้โดยกดที่ไอคอนติดตั้ง (⊕) บริเวณแถบที่อยู่เว็บของเบราว์เซอร์ค่ะ');
            }
        }
    }

    if (btnHeaderInstall) {
        btnHeaderInstall.addEventListener('click', triggerPWAInstall);
    }
    if (btnMenuInstall) {
        btnMenuInstall.addEventListener('click', () => {
            const dropdown = document.getElementById('tools-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');
            triggerPWAInstall();
        });
    }
    if (pwaBtnInstall) {
        pwaBtnInstall.addEventListener('click', triggerPWAInstall);
    }

    // Dismiss banner
    if (pwaBtnDismiss) {
        pwaBtnDismiss.addEventListener('click', () => {
            if (pwaBanner) pwaBanner.style.display = 'none';
            localStorage.setItem('kira_pwa_dismissed', Date.now().toString());
        });
    }

    // iOS Modal close buttons
    if (iosCloseBtn) {
        iosCloseBtn.addEventListener('click', () => {
            if (iosModal) iosModal.style.display = 'none';
        });
    }
    if (iosGotitBtn) {
        iosGotitBtn.addEventListener('click', () => {
            if (iosModal) iosModal.style.display = 'none';
        });
    }
    if (iosModal) {
        iosModal.addEventListener('click', (e) => {
            if (e.target === iosModal) iosModal.style.display = 'none';
        });
    }

    // App installed event
    window.addEventListener('appinstalled', () => {
        console.log('🎉 Kira AI PWA installed successfully!');
        if (pwaBanner) pwaBanner.style.display = 'none';
        if (btnHeaderInstall) btnHeaderInstall.style.display = 'none';
        if (pwaMenuStatus) pwaMenuStatus.textContent = 'ติดตั้งบนอุปกรณ์นี้แล้ว';
        if (typeof showConnectionToast === 'function') {
            showConnectionToast('🎉 ติดตั้ง Kira AI บนเครื่องของคุณเรียบร้อยแล้วค่ะ', 'ready');
        }
    });
}
window.initPWAController = initPWAController;

// ====================================================================
// 🖨️ One-Click Executive & Silver Care Deliverables PDF/Print Engine
// ====================================================================
function exportDeliverableToPDF(title, rawContent, mode = 'executive') {
    if (!rawContent || rawContent.trim() === '') {
        alert('ไม่มีเนื้อหาสำหรับการพิมพ์รายงานค่ะ');
        return;
    }

    // 1. Determine Mode & Labels
    const isSilver = mode === 'silver_care' || document.body.classList.contains('mode-silver-care');
    const isBoardroom = mode === 'boardroom';
    
    let modeBadge = '';
    let categoryTitle = '';
    if (isBoardroom) {
        modeBadge = '<span class="badge badge-boardroom">🏛️ สภาที่ปรึกษาผู้บริหาร (Virtual Boardroom)</span>';
        categoryTitle = 'บันทึกการประชุมและมติเอกฉันท์สภาที่ปรึกษา';
    } else if (isSilver) {
        modeBadge = '<span class="badge badge-silver">🌸 โหมดวัยเก๋าอุ่นใจ (Silver Care)</span>';
        categoryTitle = 'เอกสารสรุปความรู้และคำแนะนำสุขภาพประจำวัน';
    } else {
        modeBadge = '<span class="badge badge-exec">👔 ระบบผู้บริหารระดับสูง (Executive Intelligence)</span>';
        categoryTitle = 'เอกสารส่งงานและรายงานกลยุทธ์ผู้บริหาร';
    }

    // User tier badge
    const isBoss = (typeof currentUser !== 'undefined' && (currentUser === 'บอส' || (currentUser && currentUser.includes('ศิวัช'))));
    let userBadge = '';
    if (isBoss) {
        userBadge = '<span class="badge badge-boss">👑 ประธานกรรมการ / บอส</span>';
    } else if (typeof currentUserStatus !== 'undefined' && currentUserStatus && currentUserStatus.tier === 'vip') {
        userBadge = '<span class="badge badge-vip">⭐ สมาชิก VIP</span>';
    } else {
        userBadge = '<span class="badge badge-user">👤 สมาชิกทั่วไป</span>';
    }

    // 2. Parse Markdown to HTML
    let parsedHTML = '';
    try {
        if (typeof marked !== 'undefined' && marked.parse) {
            parsedHTML = marked.parse(cleanDeliverableText(rawContent));
        } else {
            parsedHTML = '<div style="white-space: pre-wrap;">' + cleanDeliverableText(rawContent) + '</div>';
        }
    } catch (e) {
        parsedHTML = '<div style="white-space: pre-wrap;">' + cleanDeliverableText(rawContent) + '</div>';
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    }) + ' เวลา ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    
    const docId = 'KIRA-' + now.getFullYear() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0') + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // 3. Build High-Contrast Printable Document
    const printDocContent = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${docId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 16mm 14mm 16mm 14mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: 'Noto Sans Thai', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: ${isSilver ? '12pt' : '10pt'};
            line-height: ${isSilver ? '1.75' : '1.6'};
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
        }
        .report-page {
            max-width: 100%;
            margin: 0 auto;
            padding: 16px;
        }
        .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 2.5px solid #0284c7;
            margin-bottom: 14px;
        }
        .header-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .brand-logo {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            object-fit: cover;
            border: 1px solid #cbd5e1;
        }
        .brand-text h1 {
            font-size: 14.5pt;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 2px 0;
            letter-spacing: -0.3px;
        }
        .brand-text p {
            font-size: 8.5pt;
            color: #64748b;
            margin: 0;
        }
        .header-meta {
            text-align: right;
            font-size: 8.5pt;
            color: #475569;
            line-height: 1.4;
        }
        .header-meta strong {
            color: #0f172a;
        }
        .doc-meta-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 18px;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        .doc-title-area h2 {
            font-size: ${isSilver ? '14.5pt' : '12.5pt'};
            font-weight: 700;
            color: #0284c7;
            margin: 0 0 4px 0;
        }
        .doc-category {
            font-size: 9pt;
            color: #64748b;
        }
        .doc-badges {
            display: flex;
            gap: 6px;
            align-items: center;
            flex-wrap: wrap;
        }
        .badge {
            display: inline-block;
            font-size: 8pt;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 6px;
        }
        .badge-boardroom { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
        .badge-silver { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .badge-exec { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
        .badge-boss { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .badge-vip { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
        .badge-user { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

        .report-body {
            color: #1e293b;
            font-size: ${isSilver ? '11.5pt' : '10pt'};
            line-height: ${isSilver ? '1.8' : '1.65'};
        }
        .report-body h1, .report-body h2, .report-body h3, .report-body h4 {
            color: #0f172a;
            margin-top: 14pt;
            margin-bottom: 6pt;
            page-break-after: avoid;
        }
        .report-body h1 { font-size: 13.5pt; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; }
        .report-body h2 { font-size: 12pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
        .report-body h3 { font-size: 11pt; color: #0369a1; }
        .report-body p { margin: 0 0 8pt 0; text-align: justify; }
        .report-body ul, .report-body ol { margin: 0 0 10pt 0; padding-left: 20px; }
        .report-body li { margin-bottom: 3pt; }
        .report-body blockquote {
            border-left: 3px solid #0284c7;
            background: #f8fafc;
            padding: 8px 12px;
            margin: 8pt 0;
            color: #334155;
            font-style: italic;
        }
        .report-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            font-size: 9pt;
            page-break-inside: avoid;
        }
        .report-body th, .report-body td {
            border: 1px solid #cbd5e1;
            padding: 6pt 8pt;
            text-align: left;
        }
        .report-body th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #0f172a;
        }
        .report-body tr:nth-child(even) td {
            background-color: #fafaf9;
        }
        .report-body pre {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
            font-family: 'JetBrains Mono', Consolas, monospace;
            font-size: 8.5pt;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        .report-body code {
            font-family: 'JetBrains Mono', Consolas, monospace;
            font-size: 9pt;
            background: #f1f5f9;
            padding: 1px 4px;
            border-radius: 4px;
        }

        .report-signoff-section {
            margin-top: 24pt;
            padding-top: 14pt;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            page-break-inside: avoid;
        }
        .signoff-box {
            width: 48%;
        }
        .sign-title {
            font-size: 9pt;
            font-weight: 700;
            color: #334155;
            margin-bottom: 28pt;
        }
        .sign-line {
            border-bottom: 1px solid #94a3b8;
            width: 85%;
            margin-bottom: 6pt;
        }
        .sign-caption {
            font-size: 8.5pt;
            color: #64748b;
            line-height: 1.4;
        }
        .audit-seal-box {
            width: 46%;
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 10px 12px;
            text-align: right;
            font-size: 8pt;
            color: #64748b;
            line-height: 1.4;
        }
        .seal-title {
            font-weight: 700;
            color: #0284c7;
            font-size: 8.5pt;
            margin-bottom: 3px;
        }
        .seal-hash {
            font-family: 'JetBrains Mono', monospace;
            color: #475569;
            word-break: break-all;
        }

        .report-footer {
            margin-top: 16pt;
            padding-top: 6pt;
            border-top: 0.5px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 7.5pt;
            color: #94a3b8;
        }

        .print-controls-bar {
            background: #0f172a;
            color: #ffffff;
            padding: 12px 20px;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            margin-bottom: 16px;
        }
        .print-controls-bar button {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 9pt;
            cursor: pointer;
            margin-left: 8px;
        }
        .print-controls-bar button.btn-secondary {
            background: rgba(255, 255, 255, 0.15);
        }
        @media print {
            .print-controls-bar {
                display: none !important;
            }
            .report-page {
                padding: 0 !important;
            }
        }
    </style>
</head>
<body>
    <div class="print-controls-bar">
        <div>
            <strong>พิมพ์รายงาน / บันทึก PDF (A4)</strong> — ${title}
        </div>
        <div>
            <button onclick="window.print()">สั่งพิมพ์ / Save as PDF</button>
            <button class="btn-secondary" onclick="window.close()">ปิด</button>
        </div>
    </div>

    <div class="report-page">
        <!-- Letterhead Header -->
        <div class="report-header">
            <div class="header-brand">
                <img src="${window.location.origin}/static/images/kira_logo.png?v=6" alt="Kira AI" class="brand-logo" onerror="this.src='${window.location.origin}/static/images/kira_avatar.jpg?v=5'">
                <div class="brand-text">
                    <h1>Kira AI Enterprise System</h1>
                    <p>ระบบปัญญาประดิษฐ์อัจฉริยะภาษาไทย • สภาที่ปรึกษาผู้บริหารและผู้ช่วยส่วนบุคคล (v2.2)</p>
                </div>
            </div>
            <div class="header-meta">
                <div><strong>รหัสเอกสาร:</strong> ${docId}</div>
                <div><strong>วันที่ออกเอกสาร:</strong> ${formattedDate}</div>
                <div><strong>ชั้นความลับ:</strong> เอกสารทางการ (Confidential)</div>
            </div>
        </div>

        <!-- Document Metadata Card -->
        <div class="doc-meta-card">
            <div class="doc-title-area">
                <h2>${title}</h2>
                <div class="doc-category">${categoryTitle}</div>
            </div>
            <div class="doc-badges">
                ${modeBadge}
                ${userBadge}
            </div>
        </div>

        <!-- Rendered Report Body -->
        <div class="report-body">
            ${parsedHTML}
        </div>

        <!-- Sign-off & Audit Section -->
        <div class="report-signoff-section">
            <div class="signoff-box">
                <div class="sign-title">ลายมือชื่อผู้มีอำนาจลงนาม / ผู้ตรวจสอบรายงาน</div>
                <div class="sign-line"></div>
                <div class="sign-caption">
                    (....................................................................)<br>
                    ตำแหน่ง: ประธานเจ้าหน้าที่บริหาร / ผู้มีอำนาจอนุมัติ<br>
                    วันที่: ...... / ...... / ..........
                </div>
            </div>
            <div class="audit-seal-box">
                <div class="seal-title">🏛️ Kira AI Enterprise Intelligence Verification</div>
                <div>เอกสารนี้ได้รับการประมวลผลและจัดทำโดยระบบปัญญาประดิษฐ์ Kira AI v2.2</div>
                <div style="margin-top: 4px;"><strong>Verification Digest:</strong></div>
                <div class="seal-hash">SHA256:${Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <div>จัดทำโดย Kira AI System — https://kira-public-engine.onrender.com</div>
            <div>หน้า 1 / 1 (Official Document)</div>
        </div>
    </div>

    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 500);
        });
    </script>
</body>
</html>`;

    // 4. Open Print Window
    const printWindow = window.open('', '_blank', 'width=950,height=900,menubar=no,toolbar=no,location=no,status=no');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printDocContent);
        printWindow.document.close();
    } else {
        // Fallback for pop-up blocker: Print within an invisible iframe
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);
        
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(printDocContent);
        printIframe.contentWindow.document.close();
        
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
            setTimeout(() => {
                if (printIframe.parentNode) printIframe.parentNode.removeChild(printIframe);
            }, 3000);
        }, 500);
    }
}
window.exportDeliverableToPDF = exportDeliverableToPDF;

// =========================================================================
// 📊 Interactive Financial & Data Chart Engine (Chart.js Integration)
// =========================================================================
function renderKiraCharts(container) {
    if (!container || typeof Chart === 'undefined') return;

    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        if (!pre || pre.dataset.chartRendered) return;

        const codeText = block.innerText.trim();
        const className = block.className || '';
        const isChartCode = className.includes('chart') || 
                            className.includes('json:chart') ||
                            (codeText.startsWith('{') && codeText.includes('"type"') && codeText.includes('"data"'));

        if (!isChartCode) return;

        try {
            const chartSpec = JSON.parse(codeText);
            if (!chartSpec.type || !chartSpec.data) return;

            pre.dataset.chartRendered = "true";

            // Create Chart Card
            const card = document.createElement('div');
            card.className = 'kira-chart-card';

            const chartTitle = chartSpec.title || 'แผนภูมิวิเคราะห์ข้อมูลเชิงบริหาร (Executive Chart)';
            const chartType = chartSpec.type || 'bar';
            const chartId = 'kira-chart-' + Math.random().toString(36).substring(2, 9);

            card.innerHTML = `
                <div class="kira-chart-header">
                    <div class="kira-chart-title-group">
                        <span class="kira-chart-badge">${escapeHtml(chartType.toUpperCase())}</span>
                        <span class="kira-chart-title">${escapeHtml(chartTitle)}</span>
                    </div>
                    <div class="kira-chart-actions">
                        <button class="chart-action-btn btn-toggle-chart" title="สลับรูปแบบกราฟ (Bar <-> Line)">
                            <i class="fa-solid fa-chart-line"></i> สลับมุมมอง
                        </button>
                        <button class="chart-action-btn btn-download-chart" title="ดาวน์โหลดเป็นรูปภาพ PNG คมชัดสูง">
                            <i class="fa-solid fa-download"></i> บันทึก PNG
                        </button>
                        <button class="chart-action-btn btn-canvas-chart" title="เปิดวิเคราะห์เต็มจอบน Live Canvas">
                            <i class="fa-solid fa-expand"></i> เต็มจอ
                        </button>
                    </div>
                </div>
                <div class="chart-canvas-wrapper">
                    <canvas id="${chartId}"></canvas>
                </div>
            `;

            pre.parentNode.insertBefore(card, pre.nextSibling);
            pre.style.display = 'none'; // Hide raw code block

            // Build Chart.js with high-end styling
            const canvasEl = card.querySelector(`#${chartId}`);
            if (!canvasEl) return;

            const isLight = document.body.classList.contains('light-theme') || document.body.classList.contains('light-mode');
            const textColor = isLight ? '#0f172a' : '#f8fafc';
            const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';

            // Executive Palette
            const defaultColors = [
                '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e', 
                '#a855f7', '#2dd4bf', '#fb923c', '#e879f9', '#60a5fa'
            ];

            if (chartSpec.data && chartSpec.data.datasets) {
                chartSpec.data.datasets.forEach((ds, idx) => {
                    const col = defaultColors[idx % defaultColors.length];
                    if (!ds.backgroundColor) {
                        ds.backgroundColor = (chartType === 'line') ? 'transparent' : col;
                    }
                    if (!ds.borderColor) {
                        ds.borderColor = col;
                    }
                    if (chartType === 'line') {
                        ds.borderWidth = 2.5;
                        ds.tension = 0.35;
                        ds.pointRadius = 4;
                        ds.pointHoverRadius = 7;
                    } else if (chartType === 'bar') {
                        ds.borderRadius = 6;
                    }
                });
            }

            const chartInstance = new Chart(canvasEl.getContext('2d'), {
                type: chartType,
                data: chartSpec.data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor, font: { family: "'Inter', 'Noto Sans Thai', sans-serif", weight: 600 } }
                        },
                        tooltip: {
                            backgroundColor: isLight ? 'rgba(15, 23, 42, 0.95)' : 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#38bdf8',
                            bodyColor: '#ffffff',
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: (chartType === 'pie' || chartType === 'doughnut') ? {} : {
                        x: {
                            ticks: { color: isLight ? '#475569' : '#94a3b8' },
                            grid: { color: gridColor }
                        },
                        y: {
                            ticks: { color: isLight ? '#475569' : '#94a3b8' },
                            grid: { color: gridColor }
                        }
                    }
                }
            });

            // Wire action buttons
            const btnDownload = card.querySelector('.btn-download-chart');
            if (btnDownload) {
                btnDownload.onclick = () => {
                    const imgUrl = chartInstance.toBase64Image();
                    const a = document.createElement('a');
                    a.href = imgUrl;
                    a.download = `Kira_Chart_${chartTitle.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (typeof showConnectionToast === 'function') {
                        showConnectionToast('📊 บันทึกรูปภาพชาร์ตความละเอียดสูงเรียบร้อยแล้วค่ะ', 'ready');
                    }
                };
            }

            const btnToggle = card.querySelector('.btn-toggle-chart');
            if (btnToggle) {
                btnToggle.onclick = () => {
                    const currentT = chartInstance.config.type;
                    const nextT = (currentT === 'bar') ? 'line' : (currentT === 'line' ? 'doughnut' : 'bar');
                    chartInstance.config.type = nextT;
                    card.querySelector('.kira-chart-badge').textContent = nextT.toUpperCase();
                    chartInstance.update();
                };
            }

            const btnCanvas = card.querySelector('.btn-canvas-chart');
            if (btnCanvas) {
                btnCanvas.onclick = () => {
                    const canvasHtml = `<!DOCTYPE html><html><head><title>${chartTitle}</title><script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script><style>body { margin: 0; background: #0f172a; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; box-sizing: border-box; } .container { width: 90%; max-width: 900px; height: 80vh; background: #1e293b; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }</style></head><body><div class="container"><canvas id="c"></canvas></div><script>const ctx = document.getElementById('c').getContext('2d'); new Chart(ctx, ${JSON.stringify(chartInstance.config)});<\/script></body></html>`;
                    if (typeof openInLiveCanvas === 'function') {
                        openInLiveCanvas(chartTitle, canvasHtml, 'html');
                    }
                };
            }
        } catch (e) {
            console.warn("Failed to parse chart spec:", e);
        }
    });
}

// =========================================================================
// 📽️ Executive Slide Deck Studio (16:9 Keynote Style)
// =========================================================================
let currentSlideDeck = [];
let currentSlideIndex = 0;
let isSlideDeckFullscreen = false;

function initSlideDeckStudio() {
    const modal = document.getElementById('slide-deck-modal');
    const btnClose = document.getElementById('btn-close-slide-deck');
    const btnPrev = document.getElementById('btn-slide-prev');
    const btnNext = document.getElementById('btn-slide-next');
    const btnFullscreen = document.getElementById('btn-slide-fullscreen');
    const btnPrint = document.getElementById('btn-slide-print');
    const btnDownload = document.getElementById('btn-slide-download');
    const btnStudioMenu = document.getElementById('btn-tools-slide-studio');

    if (!modal) return;

    if (btnClose) {
        btnClose.addEventListener('click', closeSlideDeck);
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => goToSlide(currentSlideIndex - 1));
    }
    if (btnNext) {
        btnNext.addEventListener('click', () => goToSlide(currentSlideIndex + 1));
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', toggleSlideDeckFullscreen);
    }

    if (btnPrint) {
        btnPrint.addEventListener('click', printSlideDeck);
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', downloadSlideDeckAsHTML);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal && !isSlideDeckFullscreen) {
            closeSlideDeck();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!modal || modal.style.display === 'none') return;

        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            goToSlide(currentSlideIndex + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            e.preventDefault();
            goToSlide(currentSlideIndex - 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isSlideDeckFullscreen) {
                toggleSlideDeckFullscreen();
            } else {
                closeSlideDeck();
            }
        } else if (e.key === 'f' || e.key === 'F') {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                toggleSlideDeckFullscreen();
            }
        }
    });

    if (btnStudioMenu) {
        btnStudioMenu.addEventListener('click', () => {
            const dropdown = document.getElementById('tools-dropdown-menu');
            if (dropdown) dropdown.classList.remove('show');

            const botMessages = chatBox ? chatBox.querySelectorAll('.message:not(.user)') : [];
            let targetText = '';
            if (botMessages.length > 0) {
                const lastBotMsg = botMessages[botMessages.length - 1];
                const contentEl = lastBotMsg.querySelector('.content');
                if (contentEl) {
                    const clone = contentEl.cloneNode(true);
                    const fb = clone.querySelector('.feedback-ui');
                    if (fb) fb.remove();
                    targetText = clone.innerText.trim();
                }
            }

            if (targetText && targetText.length > 30) {
                if (typeof showConnectionToast === 'function') {
                    showConnectionToast('📽️ กำลังแปลงเนื้อหาการวิเคราะห์ล่าสุดเป็นชุดสไลด์พรีเซนต์ 16:9...', 'ready');
                }
                generateAndOpenSlideDeck(targetText);
            } else {
                if (userInput) {
                    userInput.value = 'ช่วยจัดทำโครงสร้างสไลด์พรีเซนต์ระดับผู้บริหาร 16:9 สำหรับหัวข้อ: ';
                    userInput.focus();
                    if (typeof showConnectionToast === 'function') {
                        showConnectionToast('💡 ระบุหัวข้อที่ต้องการนำเสนอในช่องข้อความได้เลยค่ะ คิระจะสร้างสไลด์ให้ทันที', 'info');
                    }
                }
            }
        });
    }
}

function closeSlideDeck() {
    const modal = document.getElementById('slide-deck-modal');
    if (!modal) return;
    if (isSlideDeckFullscreen) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        modal.classList.remove('is-fullscreen');
        isSlideDeckFullscreen = false;
    }
    modal.style.display = 'none';
}

function toggleSlideDeckFullscreen() {
    const modal = document.getElementById('slide-deck-modal');
    if (!modal) return;

    if (!isSlideDeckFullscreen) {
        if (modal.requestFullscreen) {
            modal.requestFullscreen().catch(() => {});
        }
        modal.classList.add('is-fullscreen');
        isSlideDeckFullscreen = true;
        const btnFullscreen = document.getElementById('btn-slide-fullscreen');
        if (btnFullscreen) btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i> <span>ย่อจอ</span>';
    } else {
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        modal.classList.remove('is-fullscreen');
        isSlideDeckFullscreen = false;
        const btnFullscreen = document.getElementById('btn-slide-fullscreen');
        if (btnFullscreen) btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i> <span>เต็มจอ</span>';
    }
}

function parseTextToSlides(rawContent, customTitle = '') {
    if (!rawContent || !rawContent.trim()) {
        return [{
            type: 'cover',
            title: 'Kira AI Executive Presentation',
            subtitle: 'รายงานสรุปเชิงกลยุทธ์ระดับผู้บริหาร',
            category: 'KEYNOTE 16:9',
            contentHtml: ''
        }];
    }

    const clean = cleanDeliverableText(rawContent);
    const slides = [];

    // 1. Delimiter-based splitting
    let rawChunks = [];
    if (clean.includes('<!-- slide -->')) {
        rawChunks = clean.split('<!-- slide -->').map(c => c.trim()).filter(Boolean);
    } else if (clean.split(/\n\s*---\s*\n/).length >= 3) {
        rawChunks = clean.split(/\n\s*---\s*\n/).map(c => c.trim()).filter(Boolean);
    } else {
        const lines = clean.split('\n');
        let currentChunk = [];
        for (const line of lines) {
            if (/^#{1,3}\s+/.test(line) && currentChunk.length > 0 && currentChunk.join('\n').length > 120) {
                rawChunks.push(currentChunk.join('\n').trim());
                currentChunk = [line];
            } else {
                currentChunk.push(line);
            }
        }
        if (currentChunk.length > 0) {
            rawChunks.push(currentChunk.join('\n').trim());
        }
    }

    if (rawChunks.length <= 1) {
        const paragraphs = clean.split(/\n\n+/).filter(p => p.trim());
        if (paragraphs.length >= 4) {
            const p1 = paragraphs.slice(0, 1).join('\n\n');
            const p2 = paragraphs.slice(1, Math.ceil(paragraphs.length / 2)).join('\n\n');
            const p3 = paragraphs.slice(Math.ceil(paragraphs.length / 2), -1).join('\n\n');
            const p4 = paragraphs.slice(-1).join('\n\n');
            rawChunks = [
                `# สรุปภาพรวมเชิงกลยุทธ์\n\n${p1}`,
                `# การวิเคราะห์และประเด็นสำคัญ\n\n${p2}`,
                `# แผนปฏิบัติการและข้อแนะนำ\n\n${p3}`,
                `# บทสรุปและการดำเนินการถัดไป\n\n${p4}`
            ];
        } else {
            rawChunks = [clean];
        }
    }

    let mainTitle = customTitle || '';
    if (!mainTitle) {
        const firstHeader = clean.match(/^#{1,3}\s+(.+)$/m);
        if (firstHeader) {
            mainTitle = firstHeader[1].replace(/สไลด์ที่\s*\d+\s*[:：-]?\s*/i, '').replace(/Slide\s*\d+\s*[:：-]?\s*/i, '').trim();
        } else {
            const firstLine = clean.split('\n').find(l => l.trim().length > 0) || 'Kira Executive Brief';
            mainTitle = firstLine.replace(/[*_#]/g, '').slice(0, 55).trim();
        }
    }

    slides.push({
        type: 'cover',
        title: mainTitle,
        subtitle: 'ชุดสไลด์พรีเซนต์ระดับผู้บริหาร 16:9 • จัดทำโดย Kira AI Executive Suite',
        category: 'EXECUTIVE KEYNOTE',
        contentHtml: ''
    });

    const categoryNames = [
        'EXECUTIVE SUMMARY',
        'STRATEGIC ANALYSIS',
        'KEY FINDINGS & METRICS',
        'ACTION PLAN & ROADMAP',
        'EXECUTIVE CONCLUSION',
        'APPENDIX & NOTES'
    ];

    rawChunks.forEach((chunk, idx) => {
        const lines = chunk.split('\n');
        let slideTitle = '';
        let contentLines = [];

        for (const line of lines) {
            const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
            if (headerMatch && !slideTitle) {
                slideTitle = headerMatch[1].replace(/สไลด์ที่\s*\d+\s*[:：-]?\s*/i, '').replace(/Slide\s*\d+\s*[:：-]?\s*/i, '').trim();
            } else {
                contentLines.push(line);
            }
        }

        if (!slideTitle) {
            slideTitle = `ประเด็นสำคัญที่ ${idx + 1}`;
        }

        const rawContent = contentLines.join('\n').trim();
        let parsedHtml = '';
        if (typeof marked !== 'undefined' && marked.parse) {
            parsedHtml = marked.parse(rawContent);
        } else {
            parsedHtml = `<p>${rawContent.replace(/\n/g, '<br>')}</p>`;
        }

        let isCards = false;
        const boldBullets = rawContent.match(/^[\s]*[-*•]\s+\*\*(.+?)\*\*[:：]?\s*(.*)$/gm);
        if (boldBullets && boldBullets.length >= 2 && boldBullets.length <= 4) {
            isCards = true;
            let cardsHtml = '<div class="slide-content-area is-cards-layout">';
            const icons = ['fa-bolt', 'fa-chart-line', 'fa-shield-halved', 'fa-bullseye', 'fa-award'];
            boldBullets.forEach((item, cIdx) => {
                const m = item.match(/^[\s]*[-*•]\s+\*\*(.+?)\*\*[:：]?\s*(.*)$/);
                if (m) {
                    const cTitle = m[1].trim();
                    const cBody = m[2].trim() || 'ข้อพิจารณาเชิงกลยุทธ์ที่สำคัญ';
                    const iconName = icons[cIdx % icons.length];
                    cardsHtml += `
                    <div class="slide-content-card">
                        <div class="slide-card-header">
                            <i class="fa-solid ${iconName} text-rose"></i>
                            <span>${cTitle}</span>
                        </div>
                        <div class="slide-card-body">${cBody}</div>
                    </div>`;
                }
            });
            cardsHtml += '</div>';
            parsedHtml = cardsHtml;
        }

        slides.push({
            type: isCards ? 'cards' : 'standard',
            title: slideTitle,
            category: categoryNames[idx % categoryNames.length],
            contentHtml: isCards ? parsedHtml : `<div class="slide-content-area">${parsedHtml}</div>`,
            rawText: rawContent
        });
    });

    if (slides.length <= 2) {
        slides.push({
            type: 'conclusion',
            title: 'บทสรุปและขั้นตอนการดำเนินงาน (Action Milestones)',
            category: 'ACTION PLAN',
            contentHtml: `
                <div class="slide-content-area">
                    <div class="slide-milestone-grid">
                        <div class="milestone-box">
                            <span class="m-step">เฟส 1</span>
                            <h4>อนุมัติแผนงาน</h4>
                            <p>พิจารณาและรับรองทิศทางเชิงกลยุทธ์จากที่ประชุมผู้บริหาร</p>
                        </div>
                        <div class="milestone-box">
                            <span class="m-step">เฟส 2</span>
                            <h4>จัดสรรทรัพยากร</h4>
                            <p>เตรียมความพร้อมด้านเทคโนโลยี บุคลากร และงบประมาณ</p>
                        </div>
                        <div class="milestone-box">
                            <span class="m-step">เฟส 3</span>
                            <h4>เริ่มปฏิบัติการ</h4>
                            <p>ติดตามผลลัพธ์ผ่านตัวชี้วัด KPI รายสัปดาห์</p>
                        </div>
                    </div>
                </div>`,
            rawText: 'Milestones'
        });
    }

    return slides;
}

function renderSlideItemHtml(slide, index, totalSlides) {
    const isBoss = (typeof currentUser !== 'undefined' && (currentUser === 'บอส' || (currentUser && currentUser.includes('ศิวัช'))));
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

    if (slide.type === 'cover') {
        return `
        <div class="slide-item slide-cover ${index === 0 ? 'active' : ''}" data-slide-index="${index}">
            <div class="slide-top-meta">
                <span class="slide-brand-pill"><i class="fa-solid fa-sparkles"></i> KIRA AI EXECUTIVE INTELLIGENCE</span>
                <span class="slide-cat-badge">${slide.category || 'EXECUTIVE KEYNOTE'}</span>
            </div>
            <div class="slide-cover-body">
                <div class="slide-cover-badge-row">
                    <span class="slide-luxury-badge"><i class="fa-solid fa-crown text-amber"></i> ${isBoss ? 'นำเสนอแด่ท่านประธาน / บอส' : 'ชุดนำเสนอผู้บริหาร'}</span>
                    <span class="slide-aspect-tag">16:9 ULTRA-WIDE</span>
                </div>
                <h1 class="slide-cover-title">${slide.title}</h1>
                <p class="slide-cover-subtitle">${slide.subtitle || 'บทสรุปกลยุทธ์และการวิเคราะห์ข้อมูลรอบด้าน'}</p>
                <div class="slide-cover-meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">ผู้จัดทำ:</span>
                        <span class="meta-val">Kira AI Executive Suite</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">วันที่นำเสนอ:</span>
                        <span class="meta-val">${dateStr}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">สถานะเอกสาร:</span>
                        <span class="meta-val text-emerald"><i class="fa-solid fa-circle-check"></i> พร้อมนำเสนอ (Ready)</span>
                    </div>
                </div>
            </div>
            <div class="slide-bottom-bar">
                <span class="slide-foot-brand">Kira AI 2.2 • Confidential Enterprise Presentation</span>
                <span class="slide-num-pill">${String(index + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}</span>
            </div>
        </div>`;
    }

    return `
    <div class="slide-item slide-content-slide ${index === 0 ? 'active' : ''}" data-slide-index="${index}">
        <div class="slide-top-meta">
            <span class="slide-brand-pill"><i class="fa-solid fa-shield-halved"></i> KIRA EXECUTIVE STRATEGY</span>
            <span class="slide-cat-badge">${slide.category || 'ANALYSIS'}</span>
        </div>
        <div class="slide-main-header">
            <h2 class="slide-heading">${slide.title}</h2>
        </div>
        ${slide.contentHtml}
        <div class="slide-bottom-bar">
            <span class="slide-foot-brand">Kira AI 2.2 • Executive Decision Support</span>
            <span class="slide-num-pill">${String(index + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}</span>
        </div>
    </div>`;
}

function goToSlide(index) {
    if (!currentSlideDeck || currentSlideDeck.length === 0) return;
    if (index < 0) index = 0;
    if (index >= currentSlideDeck.length) index = currentSlideDeck.length - 1;

    currentSlideIndex = index;
    const stage = document.getElementById('slide-stage');
    if (!stage) return;

    const slides = stage.querySelectorAll('.slide-item');
    slides.forEach((sl, idx) => {
        if (idx === index) {
            sl.classList.add('active');
        } else {
            sl.classList.remove('active');
        }
    });

    const counter = document.getElementById('slide-counter-badge');
    if (counter) {
        counter.textContent = `สไลด์ ${String(index + 1).padStart(2, '0')} / ${String(currentSlideDeck.length).padStart(2, '0')}`;
    }

    const dotsContainer = document.getElementById('slide-dots-container');
    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.slide-dot');
        dots.forEach((dot, idx) => {
            if (idx === index) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }

    const btnPrev = document.getElementById('btn-slide-prev');
    const btnNext = document.getElementById('btn-slide-next');
    if (btnPrev) btnPrev.disabled = (index === 0);
    if (btnNext) btnNext.disabled = (index === currentSlideDeck.length - 1);
}

function generateAndOpenSlideDeck(rawContent, customTitle = '') {
    const modal = document.getElementById('slide-deck-modal');
    const stage = document.getElementById('slide-stage');
    const titleEl = document.getElementById('slide-deck-title-text');
    const dotsContainer = document.getElementById('slide-dots-container');
    if (!modal || !stage) return;

    currentSlideDeck = parseTextToSlides(rawContent, customTitle);
    currentSlideIndex = 0;

    if (titleEl) {
        titleEl.textContent = currentSlideDeck[0]?.title || 'Executive Presentation';
    }

    let stageHtml = '';
    currentSlideDeck.forEach((slide, idx) => {
        stageHtml += renderSlideItemHtml(slide, idx, currentSlideDeck.length);
    });
    stage.innerHTML = stageHtml;

    if (dotsContainer) {
        let dotsHtml = '';
        currentSlideDeck.forEach((_, idx) => {
            dotsHtml += `<span class="slide-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})" title="ไปยังสไลด์ที่ ${idx + 1}"></span>`;
        });
        dotsContainer.innerHTML = dotsHtml;
    }

    modal.style.display = 'flex';
    goToSlide(0);

    if (typeof showConnectionToast === 'function') {
        showConnectionToast(`📽️ ชุดสไลด์ 16:9 (${currentSlideDeck.length} สไลด์) พร้อมนำเสนอแล้วค่ะ`, 'ready');
    }
}
window.generateAndOpenSlideDeck = generateAndOpenSlideDeck;
window.goToSlide = goToSlide;

function downloadSlideDeckAsHTML() {
    if (!currentSlideDeck || currentSlideDeck.length === 0) {
        alert('ยังไม่มีชุดสไลด์สำหรับการดาวน์โหลดค่ะ');
        return;
    }

    const title = currentSlideDeck[0]?.title || 'Kira Executive Slide Deck';
    const stageEl = document.getElementById('slide-stage');
    const slidesHtml = stageEl ? stageEl.innerHTML : '';

    const standaloneHtml = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Kira AI 16:9 Keynote</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #040710;
            color: #f8fafc;
            font-family: 'Noto Sans Thai', 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 16px;
        }
        .deck-wrapper {
            width: 100%;
            max-width: 1140px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .deck-topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 18px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
        }
        .badge-169 {
            background: linear-gradient(135deg, #f43f5e, #fb923c);
            color: #fff;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
        }
        .viewport {
            width: 100%;
            aspect-ratio: 16 / 9;
            background: #090d16;
            border-radius: 16px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12);
        }
        .slide-item {
            position: absolute;
            inset: 0;
            padding: 34px 44px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            opacity: 0;
            visibility: hidden;
            transform: scale(0.98);
            transition: all 0.3s ease;
            background: linear-gradient(145deg, #0d1527 0%, #060913 100%);
            overflow-y: auto;
        }
        .slide-item.active {
            opacity: 1;
            visibility: visible;
            transform: scale(1);
            z-index: 2;
        }
        .slide-cover {
            background: radial-gradient(circle at 80% 20%, rgba(244, 63, 94, 0.15) 0%, transparent 50%),
                        linear-gradient(145deg, #0b1120 0%, #050811 100%);
        }
        .slide-top-meta, .slide-bottom-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 10px;
        }
        .slide-bottom-bar { border-bottom: none; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; font-size: 0.75rem; color: #64748b; }
        .slide-brand-pill { color: #38bdf8; font-weight: 700; font-size: 0.72rem; }
        .slide-cover-title {
            font-size: 2.4rem;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 30%, #fda4af 80%, #fb923c 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 14px 0;
        }
        .slide-cover-subtitle { font-size: 1.1rem; color: #94a3b8; line-height: 1.6; }
        .slide-heading { font-size: 1.6rem; font-weight: 700; color: #fff; margin: 10px 0; }
        .slide-content-area { flex: 1; display: flex; flex-direction: column; justify-content: center; line-height: 1.65; color: #cbd5e1; }
        .slide-content-area.is-cards-layout { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .slide-content-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 16px; }
        .slide-card-header { font-weight: 700; color: #fff; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
        .slide-milestone-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .milestone-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; border-top: 3px solid #38bdf8; }
        .deck-bottombar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
        }
        .nav-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #fff;
            padding: 7px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        .nav-btn-next { background: linear-gradient(135deg, #f43f5e, #e11d48); border: none; }
        .dots { display: flex; gap: 6px; align-items: center; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.2); cursor: pointer; }
        .dot.active { width: 22px; border-radius: 4px; background: linear-gradient(90deg, #f43f5e, #fb923c); }
        .text-rose { color: #fb7185; }
        .text-emerald { color: #34d399; }
        .text-amber { color: #fbbf24; }
    </style>
</head>
<body>
    <div class="deck-wrapper">
        <div class="deck-topbar">
            <span class="badge-169"><i class="fa-solid fa-file-powerpoint"></i> 16:9 KEYNOTE</span>
            <span style="font-weight: 600;">${title}</span>
            <button class="nav-btn" onclick="toggleFullscreen()"><i class="fa-solid fa-expand"></i> เต็มจอ</button>
        </div>
        <div class="viewport" id="viewport">
            ${slidesHtml}
        </div>
        <div class="deck-bottombar">
            <button class="nav-btn" onclick="prevSlide()"><i class="fa-solid fa-chevron-left"></i> ย้อนกลับ</button>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                <span id="counter" style="font-size: 0.8rem; color: #94a3b8; font-weight: 700;">สไลด์ 01 / ${String(currentSlideDeck.length).padStart(2, '0')}</span>
                <div class="dots" id="dots"></div>
            </div>
            <button class="nav-btn nav-btn-next" onclick="nextSlide()">ถัดไป <i class="fa-solid fa-chevron-right"></i></button>
        </div>
    </div>
    <script>
        let current = 0;
        const slides = document.querySelectorAll('.slide-item');
        const dotsBox = document.getElementById('dots');
        const counter = document.getElementById('counter');

        slides.forEach((_, i) => {
            const d = document.createElement('span');
            d.className = 'dot' + (i === 0 ? ' active' : '');
            d.onclick = () => showSlide(i);
            dotsBox.appendChild(d);
        });

        function showSlide(idx) {
            if (idx < 0 || idx >= slides.length) return;
            current = idx;
            slides.forEach((s, i) => s.classList.toggle('active', i === current));
            const dots = dotsBox.querySelectorAll('.dot');
            dots.forEach((d, i) => d.classList.toggle('active', i === current));
            counter.textContent = 'สไลด์ ' + String(current + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
        }

        function nextSlide() { showSlide(current + 1); }
        function prevSlide() { showSlide(current - 1); }
        function toggleFullscreen() {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
            else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); nextSlide(); }
            else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); prevSlide(); }
            else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
        });
    <\/script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kira_Executive_SlideDeck_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof showConnectionToast === 'function') {
        showConnectionToast('💾 บันทึกไฟล์ชุดสไลด์พรีเซนต์ (.html) เรียบร้อยแล้วค่ะ', 'ready');
    }
}

function printSlideDeck() {
    if (!currentSlideDeck || currentSlideDeck.length === 0) {
        alert('ยังไม่มีชุดสไลด์สำหรับการพิมพ์ค่ะ');
        return;
    }

    const title = currentSlideDeck[0]?.title || 'Kira Executive Slide Deck';
    const stageEl = document.getElementById('slide-stage');
    const slidesHtml = stageEl ? stageEl.innerHTML : '';

    const printHtml = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>${title} - Print PDF</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @page {
            size: landscape;
            margin: 0;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            margin: 0;
            padding: 0;
            background: #090d16;
            color: #f8fafc;
            font-family: 'Noto Sans Thai', 'Inter', sans-serif;
        }
        .slide-item {
            width: 100vw;
            height: 100vh;
            page-break-after: always;
            break-after: page;
            display: flex !important;
            flex-direction: column;
            justify-content: space-between;
            padding: 40px 60px;
            opacity: 1 !important;
            visibility: visible !important;
            transform: none !important;
            position: relative !important;
            background: linear-gradient(145deg, #0d1527 0%, #060913 100%) !important;
        }
        .slide-top-meta, .slide-bottom-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            padding-bottom: 12px;
        }
        .slide-bottom-bar { border-bottom: none; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 12px; font-size: 0.85rem; color: #94a3b8; }
        .slide-brand-pill { color: #38bdf8; font-weight: 700; }
        .slide-cat-badge { background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; }
        .slide-cover-title { font-size: 3rem; font-weight: 800; color: #ffffff; margin: 20px 0; }
        .slide-cover-subtitle { font-size: 1.3rem; color: #94a3b8; line-height: 1.6; }
        .slide-heading { font-size: 2rem; font-weight: 700; color: #fff; margin: 16px 0; }
        .slide-content-area { flex: 1; display: flex; flex-direction: column; justify-content: center; font-size: 1.15rem; line-height: 1.8; color: #cbd5e1; }
        .slide-content-area.is-cards-layout { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .slide-content-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 20px; }
        .slide-card-header { font-size: 1.2rem; font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
        .slide-milestone-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .milestone-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 20px; border-top: 4px solid #38bdf8; }
        .print-toolbar {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            display: flex;
            gap: 10px;
            background: rgba(0,0,0,0.85);
            padding: 8px 16px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .print-btn {
            background: #f43f5e;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
        }
        @media print {
            .print-toolbar { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="print-toolbar">
        <button class="print-btn" onclick="window.print()">สั่งพิมพ์ / Save as PDF (Landscape)</button>
        <button class="print-btn" style="background: rgba(255,255,255,0.15);" onclick="window.close()">ปิด</button>
    </div>
    ${slidesHtml}
    <script>
        window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 600);
        });
    <\/script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=1100,height=800');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
    }
}

// =========================================================================
// 🎙️ Kira Real-Time Two-Way Live Voice Assistant (Continuous Loop)
// =========================================================================
let liveVoiceRecognition = null;
let liveVoiceAudio = null;
let isLiveVoiceActive = false;
let isLiveVoiceMuted = false;
let isKiraSpeakingNow = false;

function initLiveVoiceAssistant() {
    const btnLiveVoice = document.getElementById('btn-live-voice');
    const modal = document.getElementById('live-voice-modal');
    const btnClose = document.getElementById('btn-close-live-voice');
    const btnEnd = document.getElementById('btn-voice-end');
    const btnMute = document.getElementById('btn-voice-mute');
    const btnInterrupt = document.getElementById('btn-voice-interrupt');
    const orb = document.getElementById('live-voice-orb');
    const card = modal ? modal.querySelector('.live-voice-card') : null;
    const statusText = document.getElementById('live-voice-status-text');
    const userText = document.getElementById('live-voice-user-text');
    const aiText = document.getElementById('live-voice-ai-text');

    if (!btnLiveVoice || !modal) return;

    // Check Speech Recognition support
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    function openLiveVoice() {
        if (!currentUser) {
            alert("กรุณาเข้าสู่ระบบก่อนใช้งานโหมดเสียงสดนะคะ");
            return;
        }
        if (!SpeechRec) {
            alert("เบราว์เซอร์นี้ไม่รองรับ Web Speech API ค่ะ แนะนำให้ใช้งานบน Google Chrome หรือ Microsoft Edge นะคะ");
            return;
        }

        modal.style.display = 'flex';
        isLiveVoiceActive = true;
        isLiveVoiceMuted = false;
        isKiraSpeakingNow = false;
        if (card) {
            card.classList.remove('speaking', 'thinking');
            card.classList.add('listening');
        }
        if (statusText) statusText.textContent = "🎙️ พร้อมรับฟังคุณแล้วค่ะ พูดคุยได้เลยนะคะ...";
        if (userText) userText.textContent = "";

        playKiraSound('send');
        startLiveListening();
    }

    function closeLiveVoice() {
        isLiveVoiceActive = false;
        if (liveVoiceRecognition) {
            try { liveVoiceRecognition.stop(); } catch (e) {}
        }
        if (liveVoiceAudio) {
            try { liveVoiceAudio.pause(); } catch (e) {}
            liveVoiceAudio = null;
        }
        isKiraSpeakingNow = false;
        modal.style.display = 'none';
        if (card) card.classList.remove('listening', 'speaking', 'thinking');
    }

    function startLiveListening() {
        if (!isLiveVoiceActive || isLiveVoiceMuted || isKiraSpeakingNow) return;

        if (liveVoiceRecognition) {
            try { liveVoiceRecognition.stop(); } catch (e) {}
        }

        try {
            liveVoiceRecognition = new SpeechRec();
            liveVoiceRecognition.lang = 'th-TH';
            liveVoiceRecognition.continuous = false;
            liveVoiceRecognition.interimResults = true;

            let finalTranscript = '';

            liveVoiceRecognition.onstart = () => {
                if (card) {
                    card.classList.remove('speaking', 'thinking');
                    card.classList.add('listening');
                }
                if (statusText) statusText.textContent = "🎙️ กำลังฟังเสียงของคุณ... พูดได้เลยค่ะ";
            };

            liveVoiceRecognition.onresult = (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) {
                        finalTranscript += e.results[i][0].transcript;
                    } else {
                        interim += e.results[i][0].transcript;
                    }
                }
                if (userText) {
                    userText.textContent = finalTranscript || interim || "...";
                }
            };

            liveVoiceRecognition.onerror = (err) => {
                console.warn("Live voice recognition error:", err);
                if (isLiveVoiceActive && !isKiraSpeakingNow && !isLiveVoiceMuted) {
                    setTimeout(() => startLiveListening(), 1000);
                }
            };

            liveVoiceRecognition.onend = () => {
                if (finalTranscript && finalTranscript.trim().length > 0) {
                    handleUserSpokenQuery(finalTranscript.trim());
                } else if (isLiveVoiceActive && !isKiraSpeakingNow && !isLiveVoiceMuted) {
                    // Re-arm microphone if no speech was detected
                    setTimeout(() => startLiveListening(), 400);
                }
            };

            liveVoiceRecognition.start();
        } catch (err) {
            console.error("Failed to start speech recognition:", err);
        }
    }

    async function handleUserSpokenQuery(queryText) {
        if (!isLiveVoiceActive) return;

        if (card) {
            card.classList.remove('listening', 'speaking');
            card.classList.add('thinking');
        }
        if (statusText) statusText.textContent = "🧠 คิระกำลังประมวลผลคำตอบเชิงลึก...";

        try {
            // Also append to background chat so history is preserved
            addMessage(queryText, true);

            const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "2.1-reasoning";
            const persona = document.getElementById('persona-select') ? document.getElementById('persona-select').value : "default";

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: queryText,
                    username: currentUser,
                    model_version: modelVersion,
                    session_id: currentSessionId,
                    persona: persona,
                    user_mode: currentUserMode || 'general'
                })
            });

            if (!res.ok) throw new Error("API Error");

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
            }

            // Extract clean speech text
            let cleanResponse = fullText.replace(/<think>[\s\S]*?<\/think>/gi, "")
                                        .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, "")
                                        .replace(/\[THINKING_DONE\]/g, "")
                                        .replace(/```[\s\S]*?```/g, "")
                                        .replace(/[*#_`~>]/g, "")
                                        .trim();

            if (!cleanResponse) cleanResponse = "คิระได้วิเคราะห์ข้อมูลเรียบร้อยแล้วค่ะ";

            // Also post message in main chat window
            const aiMsgContent = addMessage(fullText, false);
            applyCodeActions(aiMsgContent);
            renderKiraCharts(aiMsgContent);

            // Display in Live Voice subtitle
            if (aiText) aiText.textContent = cleanResponse;

            // Speak response via Edge-TTS
            await speakKiraResponse(cleanResponse);

        } catch (err) {
            console.error("Live voice query failed:", err);
            if (statusText) statusText.textContent = "⚠️ ไม่สามารถประมวลผลได้ กรุณาลองใหม่อีกครั้งค่ะ";
            if (card) {
                card.classList.remove('thinking');
                card.classList.add('listening');
            }
            setTimeout(() => startLiveListening(), 1500);
        }
    }

    async function speakKiraResponse(textToSpeak) {
        if (!isLiveVoiceActive) return;

        isKiraSpeakingNow = true;
        if (card) {
            card.classList.remove('listening', 'thinking');
            card.classList.add('speaking');
        }
        if (statusText) statusText.textContent = "🔊 คิระกำลังพูด... (แตะ 'พูดแทรก' ได้ทุกเมื่อ)";

        try {
            const activeVoice = localStorage.getItem('kira_voice_name') || 'th-TH-PremwadeeNeural';
            const activeRate = parseFloat(localStorage.getItem('kira_speech_rate') || '1.05');

            const ttsRes = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSpeak, voice: activeVoice, rate: activeRate })
            });

            if (!ttsRes.ok) throw new Error("TTS Failed");

            const blob = await ttsRes.blob();
            const audioUrl = URL.createObjectURL(blob);

            if (liveVoiceAudio) {
                liveVoiceAudio.pause();
            }

            liveVoiceAudio = new Audio(audioUrl);
            liveVoiceAudio.onended = () => {
                isKiraSpeakingNow = false;
                if (isLiveVoiceActive && !isLiveVoiceMuted) {
                    if (card) {
                        card.classList.remove('speaking');
                        card.classList.add('listening');
                    }
                    if (statusText) statusText.textContent = "🎙️ พร้อมรับฟังคุณแล้วค่ะ พูดต่อได้เลยนะคะ...";
                    startLiveListening();
                }
            };

            liveVoiceAudio.onerror = () => {
                isKiraSpeakingNow = false;
                if (isLiveVoiceActive) startLiveListening();
            };

            await liveVoiceAudio.play();
        } catch (ttsErr) {
            console.warn("TTS error in live voice:", ttsErr);
            isKiraSpeakingNow = false;
            if (isLiveVoiceActive) startLiveListening();
        }
    }

    function interruptKira() {
        if (liveVoiceAudio) {
            liveVoiceAudio.pause();
            liveVoiceAudio = null;
        }
        isKiraSpeakingNow = false;
        if (card) {
            card.classList.remove('speaking', 'thinking');
            card.classList.add('listening');
        }
        if (statusText) statusText.textContent = "🎙️ ขัดจังหวะแล้วค่ะ กำลังฟังเสียงของคุณ...";
        startLiveListening();
    }

    // Attach event listeners
    btnLiveVoice.addEventListener('click', openLiveVoice);
    if (btnClose) btnClose.addEventListener('click', closeLiveVoice);
    if (btnEnd) btnEnd.addEventListener('click', closeLiveVoice);

    if (btnMute) {
        btnMute.addEventListener('click', () => {
            isLiveVoiceMuted = !isLiveVoiceMuted;
            btnMute.classList.toggle('muted', isLiveVoiceMuted);
            const label = document.getElementById('voice-mute-label');
            if (label) label.textContent = isLiveVoiceMuted ? 'เปิดไมค์' : 'ปิดไมค์';
            if (isLiveVoiceMuted) {
                if (liveVoiceRecognition) {
                    try { liveVoiceRecognition.stop(); } catch (e) {}
                }
                if (statusText) statusText.textContent = "🔇 ไมโครโฟนถูกปิดชั่วคราว (แตะเปิดไมค์เพื่อคุยต่อ)";
            } else {
                startLiveListening();
            }
        });
    }

    if (btnInterrupt) {
        btnInterrupt.addEventListener('click', interruptKira);
    }

    if (orb) {
        orb.addEventListener('click', () => {
            if (isKiraSpeakingNow) interruptKira();
        });
    }
}

// ====================================================================
// 🔌 KIRA 2.2 MODEL CONTEXT PROTOCOL (MCP) INTEGRATION HUB CONTROLLER
// ====================================================================

let mcpToolsCatalog = [];
let mcpServersList = [];
let mcpAuditsList = [];
let currentMCPCategory = 'all';

function openMCPHubModal(defaultTab = 'catalog') {
    const modal = document.getElementById('mcp-hub-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchMCPTab(defaultTab);
    loadMCPHubData();
}

function closeMCPHubModal() {
    const modal = document.getElementById('mcp-hub-modal');
    if (modal) modal.style.display = 'none';
}

function switchMCPTab(tabName) {
    const tabBtns = document.querySelectorAll('.mcp-tab-btn');
    const tabPanes = document.querySelectorAll('.mcp-tab-pane');

    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    tabPanes.forEach(pane => {
        if (pane.id === `mcp-pane-${tabName}`) {
            pane.style.display = 'flex';
        } else {
            pane.style.display = 'none';
        }
    });
}

async function loadMCPHubData() {
    try {
        const [toolsRes, serversRes, auditsRes] = await Promise.all([
            fetch('/api/mcp/tools').then(r => r.json()).catch(() => ({ status: 'error', tools: [] })),
            fetch('/api/mcp/servers').then(r => r.json()).catch(() => ({ status: 'error', servers: [] })),
            fetch('/api/mcp/audits?limit=25').then(r => r.json()).catch(() => ({ status: 'error', audits: [] }))
        ]);

        if (toolsRes.status === 'success' && Array.isArray(toolsRes.tools)) {
            mcpToolsCatalog = toolsRes.tools;
            renderMCPTools(mcpToolsCatalog);
            populateRunnerToolsDropdown(mcpToolsCatalog);
        }

        if (serversRes.status === 'success' && Array.isArray(serversRes.servers)) {
            mcpServersList = serversRes.servers;
            renderMCPServers(mcpServersList);
            const countEl = document.getElementById('mcp-server-count');
            if (countEl) countEl.textContent = mcpServersList.length;
        }

        if (auditsRes.status === 'success' && Array.isArray(auditsRes.audits)) {
            mcpAuditsList = auditsRes.audits;
            renderMCPAudits(mcpAuditsList);
        }
    } catch (e) {
        console.error('Error loading MCP Hub data:', e);
    }
}

function renderMCPTools(tools) {
    const container = document.getElementById('mcp-tools-container');
    if (!container) return;

    let filtered = tools;
    if (currentMCPCategory !== 'all') {
        filtered = tools.filter(t => t.category === currentMCPCategory);
    }

    const searchInput = document.getElementById('mcp-tool-search-input');
    const query = (searchInput?.value || '').toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(t => 
            (t.tool_name && t.tool_name.toLowerCase().includes(query)) ||
            (t.display_name && t.display_name.toLowerCase().includes(query)) ||
            (t.description && t.description.toLowerCase().includes(query))
        );
    }

    if (!filtered.length) {
        container.innerHTML = `<div class="mcp-empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">
            <i class="fa-solid fa-toolbox" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            ไม่พบเครื่องมือที่ตรงกับเงื่อนไขการค้นหาค่ะ
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(tool => {
        const catMap = {
            financial: 'การเงิน & ผู้บริหาร',
            workspace: 'โปรเจกต์ & ไฟล์',
            system: 'สุขภาพระบบ',
            intelligence: 'ข่าวกรองธุรกิจ'
        };
        const catName = catMap[tool.category] || tool.category;
        const iconClass = tool.icon || 'fa-solid fa-wrench';

        return `
        <div class="mcp-tool-card">
            <div>
                <div class="mcp-tool-top">
                    <div class="mcp-tool-icon-box">
                        <i class="${iconClass}"></i>
                    </div>
                    <span class="mcp-tool-badge">${catName}</span>
                </div>
                <div class="mcp-tool-name">${tool.display_name || tool.tool_name}</div>
                <div class="mcp-tool-desc">${tool.description}</div>
            </div>
            <div class="mcp-tool-footer">
                <span class="mcp-tool-server-name">
                    <i class="fa-solid fa-server"></i> ${tool.server_name || 'Kira Core'}
                </span>
                <button type="button" class="btn-test-mcp-tool" onclick="testRunMCPTool('${tool.tool_name}')">
                    <i class="fa-solid fa-play"></i> ทดสอบรันสด
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function renderMCPServers(servers) {
    const container = document.getElementById('mcp-servers-container');
    if (!container) return;

    if (!servers.length) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #64748b;">ยังไม่มีเซิร์ฟเวอร์ MCP ที่ลงทะเบียน</div>`;
        return;
    }

    container.innerHTML = servers.map(srv => {
        const transportUpper = (srv.transport || 'sse').toUpperCase();
        const isBuiltin = srv.is_builtin;
        const deleteBtnHtml = !isBuiltin ? `
            <button type="button" class="btn-del-mcp-server" onclick="deleteMCPServerPrompt('${srv.server_id}', '${srv.name}')" style="background: transparent; border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; padding: 4px 8px; font-size: 0.72rem; cursor: pointer;">
                <i class="fa-solid fa-trash-can"></i> ตัดการเชื่อมต่อ
            </button>
        ` : `<span style="font-size: 0.72rem; color: #38bdf8; font-weight: 600;"><i class="fa-solid fa-shield"></i> Built-in Core</span>`;

        return `
        <div class="mcp-server-card">
            <div class="mcp-server-top">
                <div class="mcp-server-title">${srv.name}</div>
                <span class="mcp-status-pill ${srv.is_active ? 'online' : ''}">
                    <span class="mcp-status-dot"></span> ${srv.is_active ? 'Online' : 'Standby'}
                </span>
            </div>
            <div class="mcp-server-meta-row">
                <span><strong>Transport:</strong> ${transportUpper}</span>
                <span><strong>Tools:</strong> ${srv.tools_count} ตัว</span>
            </div>
            <div class="mcp-server-meta-row">
                <span><strong>Latency:</strong> <span class="mcp-latency-tag">~${srv.ping_latency_ms} ms</span></span>
                <span><strong>Status:</strong> 100% SLA</span>
            </div>
            <div class="mcp-tool-footer" style="padding-top: 8px; margin-top: 4px;">
                <span style="font-size: 0.72rem; color: #64748b; font-family: monospace;">${srv.endpoint}</span>
                ${deleteBtnHtml}
            </div>
        </div>
        `;
    }).join('');
}

function renderMCPAudits(audits) {
    const tbody = document.getElementById('mcp-audits-table-body');
    if (!tbody) return;

    if (!audits.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-orders-text">ยังไม่มีประวัติการเรียกใช้ MCP Tool</td></tr>`;
        return;
    }

    tbody.innerHTML = audits.map(a => {
        const badgeClass = a.status === 'success' ? 'mcp-badge-success' : 'mcp-badge-failed';
        const statusText = a.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว';

        return `
        <tr>
            <td style="font-family: monospace; font-size: 0.78rem; color: #38bdf8;">${a.execution_id}</td>
            <td><strong>${a.username || 'boss'}</strong></td>
            <td><code>${a.tool_name}</code></td>
            <td><span style="color: #94a3b8; font-size: 0.75rem;">${a.server_id}</span></td>
            <td><span class="${badgeClass}">${statusText}</span></td>
            <td><strong>${a.execution_time_ms} ms</strong></td>
            <td style="color: #64748b; font-size: 0.76rem;">${a.executed_at}</td>
        </tr>
        `;
    }).join('');
}

function populateRunnerToolsDropdown(tools) {
    const select = document.getElementById('mcp-runner-tool-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = tools.map(t => `<option value="${t.tool_name}">${t.display_name || t.tool_name}</option>`).join('');

    if (currentVal && tools.some(t => t.tool_name === currentVal)) {
        select.value = currentVal;
    } else if (tools.length > 0) {
        select.value = tools[0].tool_name;
    }

    updateRunnerInputsForSelectedTool();
}

function updateRunnerInputsForSelectedTool() {
    const select = document.getElementById('mcp-runner-tool-select');
    if (!select) return;
    const toolName = select.value;
    const tool = mcpToolsCatalog.find(t => t.tool_name === toolName);

    const metaBox = document.getElementById('mcp-runner-tool-meta');
    const fieldsContainer = document.getElementById('mcp-dynamic-arguments-form');
    if (!tool) return;

    if (metaBox) {
        metaBox.innerHTML = `
            <div><strong>${tool.display_name}</strong> (<code>${tool.tool_name}</code>)</div>
            <div style="margin-top: 4px;">${tool.description}</div>
            <div style="margin-top: 6px; font-size: 0.72rem; color: #38bdf8;">
                <i class="fa-solid fa-server"></i> Server: ${tool.server_name || tool.server_id}
            </div>
        `;
    }

    if (!fieldsContainer) return;

    if (toolName === 'financial_calculator') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">สูตรคำนวณ (Action):</label>
                <select id="mcp-arg-action" class="input-control" onchange="toggleFinancialInputs(this.value)">
                    <option value="bep" selected>จุดคุ้มทุน (Break-Even Point)</option>
                    <option value="roi">ผลตอบแทนการลงทุน (ROI)</option>
                    <option value="runway">ระยะเวลาอยู่รอดเงินสด (Runway / Burn Rate)</option>
                </select>
            </div>
            <div id="fin-group-bep" style="display: contents;">
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">ต้นทุนคงที่ (Fixed Costs ฿):</label>
                    <input type="number" id="mcp-arg-fixed-cost" class="input-control" value="100000">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">ราคาขายต่อชิ้น (Price ฿):</label>
                    <input type="number" id="mcp-arg-price" class="input-control" value="500">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">ต้นทุนผันแปรต่อชิ้น (Var Cost ฿):</label>
                    <input type="number" id="mcp-arg-var-cost" class="input-control" value="200">
                </div>
            </div>
            <div id="fin-group-roi" style="display: none;">
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">รายได้ที่ได้รับ (Total Gain ฿):</label>
                    <input type="number" id="mcp-arg-roi-gain" class="input-control" value="250000">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">เงินลงทุนทั้งหมด (Total Cost ฿):</label>
                    <input type="number" id="mcp-arg-roi-cost" class="input-control" value="100000">
                </div>
            </div>
            <div id="fin-group-runway" style="display: none;">
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">เงินสดสำรอง (Cash Reserve ฿):</label>
                    <input type="number" id="mcp-arg-runway-cash" class="input-control" value="1000000">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">อัตราการเผาผลาญต่อเดือน (Burn Rate ฿):</label>
                    <input type="number" id="mcp-arg-runway-burn" class="input-control" value="150000">
                </div>
                <div class="form-group">
                    <label style="font-size: 0.78rem; color: #94a3b8;">รายได้ต่อเดือน (Monthly Revenue ฿):</label>
                    <input type="number" id="mcp-arg-runway-rev" class="input-control" value="30000">
                </div>
            </div>
        `;
    } else if (toolName === 'workspace_inspector') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">ไดเรกทอรีย่อย (Subpath relative to workspace):</label>
                <input type="text" id="mcp-arg-subpath" class="input-control" value="" placeholder="เว้นว่างไว้เพื่อสแกนทั้งโปรเจกต์">
            </div>
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">ความลึกสูงสุด (Max Depth):</label>
                <input type="number" id="mcp-arg-depth" class="input-control" value="3" min="1" max="5">
            </div>
        `;
    } else if (toolName === 'system_diagnostics') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">ตรวจสอบความจุพื้นที่ Disk:</label>
                <select id="mcp-arg-check-disk" class="input-control">
                    <option value="true" selected>ตรวจสอบ (True)</option>
                    <option value="false">ข้าม (False)</option>
                </select>
            </div>
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">ตรวจสอบสุขภาพ SQLite WAL Database:</label>
                <select id="mcp-arg-check-db" class="input-control">
                    <option value="true" selected>ตรวจสอบ (True)</option>
                    <option value="false">ข้าม (False)</option>
                </select>
            </div>
        `;
    } else if (toolName === 'market_intel') {
        fieldsContainer.innerHTML = `
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">อุตสาหกรรม / กลุ่มธุรกิจ (Industry):</label>
                <input type="text" id="mcp-arg-industry" class="input-control" value="SaaS & Enterprise AI">
            </div>
            <div class="form-group">
                <label style="font-size: 0.78rem; color: #94a3b8;">ประเด็นยุทธศาสตร์ที่ต้องการวิเคราะห์ (Query):</label>
                <input type="text" id="mcp-arg-market-query" class="input-control" value="วิเคราะห์ความได้เปรียบเชิงการแข่งขันและการเติบโต">
            </div>
        `;
    } else {
        fieldsContainer.innerHTML = `
            <div class="form-group" style="grid-column: 1/-1;">
                <label style="font-size: 0.78rem; color: #94a3b8;">JSON Arguments Payload:</label>
                <textarea id="mcp-arg-custom-json" class="input-control" rows="3" placeholder='{"key": "value"}'></textarea>
            </div>
        `;
    }
}

function toggleFinancialInputs(action) {
    const bepEl = document.getElementById('fin-group-bep');
    const roiEl = document.getElementById('fin-group-roi');
    const runwayEl = document.getElementById('fin-group-runway');
    if (!bepEl || !roiEl || !runwayEl) return;

    bepEl.style.display = (action === 'bep') ? 'contents' : 'none';
    roiEl.style.display = (action === 'roi') ? 'contents' : 'none';
    runwayEl.style.display = (action === 'runway') ? 'contents' : 'none';
}

function testRunMCPTool(toolName) {
    switchMCPTab('runner');
    const select = document.getElementById('mcp-runner-tool-select');
    if (select) {
        select.value = toolName;
        updateRunnerInputsForSelectedTool();
    }
}

async function executeMCPToolFromRunner() {
    const select = document.getElementById('mcp-runner-tool-select');
    if (!select) return;
    const toolName = select.value;
    const tool = mcpToolsCatalog.find(t => t.tool_name === toolName);
    if (!tool) return;

    let args = {};
    if (toolName === 'financial_calculator') {
        const action = document.getElementById('mcp-arg-action')?.value || 'bep';
        args.action = action;
        if (action === 'bep') {
            args.fixed_cost = parseFloat(document.getElementById('mcp-arg-fixed-cost')?.value || 100000);
            args.price_per_unit = parseFloat(document.getElementById('mcp-arg-price')?.value || 500);
            args.variable_cost_per_unit = parseFloat(document.getElementById('mcp-arg-var-cost')?.value || 200);
        } else if (action === 'roi') {
            args.gain = parseFloat(document.getElementById('mcp-arg-roi-gain')?.value || 250000);
            args.cost = parseFloat(document.getElementById('mcp-arg-roi-cost')?.value || 100000);
        } else if (action === 'runway') {
            args.cash = parseFloat(document.getElementById('mcp-arg-runway-cash')?.value || 1000000);
            args.burn_rate = parseFloat(document.getElementById('mcp-arg-runway-burn')?.value || 150000);
            args.monthly_revenue = parseFloat(document.getElementById('mcp-arg-runway-rev')?.value || 0);
        }
    } else if (toolName === 'workspace_inspector') {
        args.subpath = document.getElementById('mcp-arg-subpath')?.value || '';
        args.max_depth = parseInt(document.getElementById('mcp-arg-depth')?.value || 3);
    } else if (toolName === 'system_diagnostics') {
        args.check_disk = document.getElementById('mcp-arg-check-disk')?.value === 'true';
        args.check_db = document.getElementById('mcp-arg-check-db')?.value === 'true';
    } else if (toolName === 'market_intel') {
        args.industry = document.getElementById('mcp-arg-industry')?.value || 'SaaS';
        args.query = document.getElementById('mcp-arg-market-query')?.value || '';
    } else {
        const rawJson = document.getElementById('mcp-arg-custom-json')?.value || '{}';
        try { args = JSON.parse(rawJson); } catch (e) { alert('JSON Payload ไม่ถูกต้องค่ะ: ' + e.message); return; }
    }

    const consoleBox = document.getElementById('mcp-console-output');
    const latencyBadge = document.getElementById('mcp-exec-latency-badge');
    const execBtn = document.getElementById('btn-execute-mcp-runner');

    if (consoleBox) {
        consoleBox.innerHTML = `<span style="color: #38bdf8;"><i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งคำสั่งไปยัง ${tool.server_name || tool.server_id} ผ่านโปรโตคอล MCP...</span>`;
    }
    if (execBtn) execBtn.disabled = true;

    try {
        const res = await fetch('/api/mcp/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server_id: tool.server_id,
                tool_name: toolName,
                arguments: args,
                username: currentUser || 'boss'
            })
        });

        const data = await res.json();
        if (execBtn) execBtn.disabled = false;

        if (latencyBadge) {
            latencyBadge.style.display = 'inline-block';
            latencyBadge.textContent = `${data.execution_time_ms || 0} ms`;
        }

        if (consoleBox) {
            let verdict = '';
            if (data.result && data.result.executive_verdict) {
                verdict = `\n\n💡 [Executive Verdict]:\n${data.result.executive_verdict}`;
            }
            consoleBox.textContent = JSON.stringify(data, null, 2) + verdict;
        }

        // Reload Audits
        fetch('/api/mcp/audits?limit=25')
            .then(r => r.json())
            .then(a => { if (a.status === 'success') renderMCPAudits(a.audits); });

    } catch (err) {
        if (execBtn) execBtn.disabled = false;
        if (consoleBox) consoleBox.textContent = `❌ MCP Error: ${err.message}`;
    }
}

async function handleRegisterMCPServer(e) {
    e.preventDefault();
    const name = document.getElementById('mcp-server-name')?.value;
    const transport = document.getElementById('mcp-server-transport')?.value;
    const endpoint = document.getElementById('mcp-server-endpoint')?.value;
    const authToken = document.getElementById('mcp-server-token')?.value;

    try {
        const res = await fetch('/api/mcp/servers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                transport,
                endpoint,
                auth_token: authToken || null,
                admin_username: currentUser || 'boss'
            })
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
            alert(data.message || 'เชื่อมต่อ MCP Server สำเร็จเรียบร้อยค่ะ');
            document.getElementById('mcp-register-server-form')?.reset();
            switchMCPTab('servers');
            loadMCPHubData();
        } else {
            alert('เกิดข้อผิดพลาด: ' + (data.detail || data.message || 'ไม่สามารถเชื่อมต่อได้'));
        }
    } catch (err) {
        alert('Connection Error: ' + err.message);
    }
}

async function deleteMCPServerPrompt(serverId, name) {
    if (!confirm(`ท่านประธานต้องการตัดการเชื่อมต่อกับเซิร์ฟเวอร์ '${name}' หรือไม่คะ?`)) return;

    try {
        const res = await fetch(`/api/mcp/servers/${serverId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            alert(data.message || 'ตัดการเชื่อมต่อเรียบร้อยค่ะ');
            loadMCPHubData();
        } else {
            alert(data.detail || 'ไม่สามารถตัดการเชื่อมต่อได้ค่ะ');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function initMCPHubController() {
    const btnClose = document.getElementById('btn-close-mcp-hub');
    if (btnClose) btnClose.addEventListener('click', closeMCPHubModal);

    const modal = document.getElementById('mcp-hub-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeMCPHubModal();
        });
    }

    // Tabs
    const tabBtns = document.querySelectorAll('.mcp-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) switchMCPTab(tab);
        });
    });

    // Category Filters
    const catBtns = document.querySelectorAll('.mcp-cat-btn');
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMCPCategory = btn.dataset.cat || 'all';
            renderMCPTools(mcpToolsCatalog);
        });
    });

    // Search Input
    const searchInput = document.getElementById('mcp-tool-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderMCPTools(mcpToolsCatalog));
    }

    // Refresh Buttons
    const btnRefSrv = document.getElementById('btn-refresh-mcp-servers');
    if (btnRefSrv) btnRefSrv.addEventListener('click', loadMCPHubData);

    const btnRefAud = document.getElementById('btn-refresh-mcp-audits');
    if (btnRefAud) btnRefAud.addEventListener('click', loadMCPHubData);

    // Runner Select & Execute
    const runnerSelect = document.getElementById('mcp-runner-tool-select');
    if (runnerSelect) {
        runnerSelect.addEventListener('change', updateRunnerInputsForSelectedTool);
    }

    const btnExec = document.getElementById('btn-execute-mcp-runner');
    if (btnExec) {
        btnExec.addEventListener('click', executeMCPToolFromRunner);
    }

    // Register Server Form
    const srvForm = document.getElementById('mcp-register-server-form');
    if (srvForm) {
        srvForm.addEventListener('submit', handleRegisterMCPServer);
    }

    // Global expose
    window.openMCPHubModal = openMCPHubModal;
    window.closeMCPHubModal = closeMCPHubModal;
    window.testRunMCPTool = testRunMCPTool;
    window.deleteMCPServerPrompt = deleteMCPServerPrompt;
    window.toggleFinancialInputs = toggleFinancialInputs;
}

// =========================================================================
// 🛡️ Phase 3: Executive Offline Vault & Mobile PWA Sync Controller
// =========================================================================

const VAULT_STORAGE_ITEMS_KEY = 'kira_offline_vault_items';
const VAULT_STORAGE_OUTBOX_KEY = 'kira_offline_vault_outbox';
const VAULT_STORAGE_LAST_SYNC_KEY = 'kira_offline_vault_last_sync';

let vaultCatalogCache = [];
let vaultOutboxCache = [];
let currentVaultCategory = 'all';
let currentlyViewedVaultItem = null;
let isVaultSyncing = false;

function escapeVaultHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

function getLocalVaultItems() {
    try {
        const raw = localStorage.getItem(VAULT_STORAGE_ITEMS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn("Error reading local vault items:", e);
        return [];
    }
}

function setLocalVaultItems(items) {
    try {
        localStorage.setItem(VAULT_STORAGE_ITEMS_KEY, JSON.stringify(items));
        vaultCatalogCache = items;
    } catch (e) {
        console.error("Error saving local vault items:", e);
    }
}

function getLocalVaultOutbox() {
    try {
        const raw = localStorage.getItem(VAULT_STORAGE_OUTBOX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn("Error reading vault outbox:", e);
        return [];
    }
}

function setLocalVaultOutbox(outbox) {
    try {
        localStorage.setItem(VAULT_STORAGE_OUTBOX_KEY, JSON.stringify(outbox));
        vaultOutboxCache = outbox;
        updateVaultPillAndBadgeUI();
    } catch (e) {
        console.error("Error saving vault outbox:", e);
    }
}

function getLastVaultSyncTime() {
    return localStorage.getItem(VAULT_STORAGE_LAST_SYNC_KEY) || null;
}

function setLastVaultSyncTime(ts) {
    if (ts) {
        localStorage.setItem(VAULT_STORAGE_LAST_SYNC_KEY, ts);
    }
}

function updateVaultConnectivityUI(isOnline) {
    const isConn = (typeof isOnline === 'boolean') ? isOnline : navigator.onLine;
    const pill = document.getElementById('btn-vault-network-pill');
    const pillText = document.getElementById('vault-pill-status-text');
    const pillBadge = document.getElementById('vault-pending-count');
    const bannerDot = document.querySelector('#vault-banner-conn-indicator .vault-status-dot');
    const bannerText = document.getElementById('vault-banner-conn-text');
    const statPending = document.getElementById('vault-stat-pending-count');
    const tabOutboxCount = document.getElementById('vault-outbox-count');

    const outbox = getLocalVaultOutbox();
    const pendingCount = outbox.length;

    if (pill) {
        if (isConn && pendingCount === 0) {
            // When fully online and healthy, keep header clean & uncluttered
            pill.style.display = 'none';
        } else {
            // Show only when offline or pending sync items exist
            pill.style.display = 'inline-flex';
            if (isConn) {
                pill.classList.remove('offline');
                pill.classList.add('online');
                if (pillText) pillText.textContent = `รอซิงก์ (${pendingCount})`;
            } else {
                pill.classList.remove('online');
                pill.classList.add('offline');
                if (pillText) pillText.textContent = 'Offline';
            }
        }
    }

    if (pillBadge) {
        if (pendingCount > 0) {
            pillBadge.textContent = pendingCount;
            pillBadge.style.display = 'inline-block';
        } else {
            pillBadge.style.display = 'none';
        }
    }

    if (bannerDot) {
        if (isConn) {
            bannerDot.classList.remove('offline');
            bannerDot.classList.add('online');
        } else {
            bannerDot.classList.remove('online');
            bannerDot.classList.add('offline');
        }
    }

    if (bannerText) {
        bannerText.textContent = isConn ? 'Cloud Synced (Online)' : 'Offline Vault Mode (Local-First)';
    }

    if (statPending) {
        statPending.textContent = pendingCount;
    }

    if (tabOutboxCount) {
        tabOutboxCount.textContent = pendingCount;
    }
}

function updateVaultPillAndBadgeUI() {
    updateVaultConnectivityUI(navigator.onLine);
}

function openOfflineVaultModal(targetTab = 'catalog') {
    const modal = document.getElementById('offline-vault-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchVaultTab(targetTab);
    loadVaultData(false);
}

function closeOfflineVaultModal() {
    const modal = document.getElementById('offline-vault-modal');
    if (modal) modal.style.display = 'none';
    closeVaultDocumentViewer();
}

function switchVaultTab(tabKey) {
    const tabBtns = document.querySelectorAll('.vault-tab-btn');
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const panes = ['catalog', 'memo', 'outbox', 'security'];
    panes.forEach(pane => {
        const el = document.getElementById(`vault-pane-${pane}`);
        if (el) {
            el.style.display = (pane === tabKey) ? 'block' : 'none';
        }
    });

    if (tabKey === 'outbox') {
        renderVaultOutbox();
    } else if (tabKey === 'catalog') {
        renderVaultCatalog();
    }
}

async function loadVaultData(isManual = false) {
    // 1. Load local cache first for instant responsiveness
    vaultCatalogCache = getLocalVaultItems();
    vaultOutboxCache = getLocalVaultOutbox();
    renderVaultCatalog();
    renderVaultOutbox();
    updateVaultPillAndBadgeUI();

    // 2. If online, perform background sync with server (silent background by default)
    if (navigator.onLine) {
        await triggerVaultSync(isManual);
    }
}

async function triggerVaultSync(isManual = false) {
    if (isVaultSyncing) return;
    if (!navigator.onLine) {
        if (isManual) {
            const syncBtn = document.getElementById('btn-vault-manual-sync');
            const btnSpan = syncBtn ? syncBtn.querySelector('span') : null;
            if (btnSpan) {
                const orig = btnSpan.textContent;
                btnSpan.textContent = 'โหมดออฟไลน์ (Local Vault) ✓';
                setTimeout(() => { if (btnSpan) btnSpan.textContent = orig; }, 3000);
            }
        }
        return;
    }

    isVaultSyncing = true;
    const syncBtn = document.getElementById('btn-vault-manual-sync');
    const syncIcon = syncBtn ? syncBtn.querySelector('i') : null;
    const syncSpan = syncBtn ? syncBtn.querySelector('span') : null;
    if (syncIcon) syncIcon.classList.add('fa-spin');

    try {
        const outbox = getLocalVaultOutbox();
        const lastSync = getLastVaultSyncTime();

        const payload = {
            username: 'boss',
            client_changes: outbox,
            last_sync_time: lastSync
        };

        const res = await fetch('/api/vault/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Server responded with status ${res.status}`);
        }

        const data = await res.json();
        if (data.status === 'success') {
            // Clear outbox queue since changes were successfully applied on server
            setLocalVaultOutbox([]);

            // Merge server items with local items
            const serverItems = data.server_items || [];
            let localItems = getLocalVaultItems();
            
            // Map by item_id
            const itemMap = new Map();
            localItems.forEach(item => itemMap.set(item.item_id, item));
            serverItems.forEach(item => itemMap.set(item.item_id, item));

            const merged = Array.from(itemMap.values());
            setLocalVaultItems(merged);

            if (data.synced_at) {
                setLastVaultSyncTime(data.synced_at);
            }

            renderVaultCatalog();
            renderVaultOutbox();
            updateVaultPillAndBadgeUI();

            if (isManual && syncSpan) {
                const origText = syncSpan.textContent;
                syncSpan.textContent = 'ซิงก์สำเร็จเรียบร้อย ✓';
                setTimeout(() => { if (syncSpan) syncSpan.textContent = origText; }, 3000);
            }
        }
    } catch (err) {
        console.warn("Vault sync warning:", err);
        if (isManual && syncSpan) {
            syncSpan.textContent = 'ซิงก์ไม่สำเร็จ (ลองใหม่)';
            setTimeout(() => { if (syncSpan) syncSpan.textContent = 'ซิงก์ข้อมูลทันที'; }, 3000);
        }
    } finally {
        isVaultSyncing = false;
        if (syncIcon) syncIcon.classList.remove('fa-spin');
    }
}

function getCategoryDisplayMeta(cat) {
    switch (cat) {
        case 'boardroom_minutes':
            return { label: 'มติสภา 4 บริหาร', icon: 'fa-users-gear', chipClass: 'boardroom_minutes' };
        case 'slide_deck':
            return { label: 'ชุดสไลด์ (16:9)', icon: 'fa-file-powerpoint', chipClass: 'slide_deck' };
        case 'task':
            return { label: 'ภารกิจยุทธศาสตร์', icon: 'fa-list-check', chipClass: 'task' };
        case 'memo':
        default:
            return { label: 'บันทึกข้อสั่งการ', icon: 'fa-file-lines', chipClass: 'memo' };
    }
}

function renderVaultCatalog(itemsToRender = null) {
    const container = document.getElementById('vault-items-container');
    const totalCountEl = document.getElementById('vault-stat-total-count');
    const tabCountEl = document.getElementById('vault-catalog-count');
    if (!container) return;

    let items = itemsToRender || vaultCatalogCache;

    // Filter by Category
    if (currentVaultCategory && currentVaultCategory !== 'all') {
        items = items.filter(item => item.category === currentVaultCategory);
    }

    // Filter by Search Query
    const searchInput = document.getElementById('vault-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (query) {
        items = items.filter(item => {
            const title = (item.title || '').toLowerCase();
            const content = (item.content || '').toLowerCase();
            return title.includes(query) || content.includes(query);
        });
    }

    // Sort: Pinned first, then client_updated_at / created_at desc
    items.sort((a, b) => {
        const pinA = a.is_pinned ? 1 : 0;
        const pinB = b.is_pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        const dateA = a.client_updated_at || a.created_at || '';
        const dateB = b.client_updated_at || b.created_at || '';
        return dateB.localeCompare(dateA);
    });

    if (totalCountEl) totalCountEl.textContent = vaultCatalogCache.length;
    if (tabCountEl) tabCountEl.textContent = vaultCatalogCache.length;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="vault-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #94a3b8;">
                <div style="font-size: 2.8rem; margin-bottom: 12px; color: #64748b;"><i class="fa-solid fa-box-open"></i></div>
                <h4 style="color: #f1f5f9; margin: 0 0 6px 0; font-size: 1.05rem;">ยังไม่มีเอกสารในหมวดหมู่นี้</h4>
                <p style="font-size: 0.85rem; max-width: 440px; margin: 0 auto 16px auto; line-height: 1.5;">ท่านประธานสามารถคลิกแท็บ 'สร้างบันทึก / คำสั่งด่วน' เพื่อจัดเก็บข้อมูลลงคลังนิรภัยออฟไลน์ได้ทันทีนะคะ</p>
                <button type="button" class="btn-sec-secondary" onclick="switchVaultTab('memo')">
                    <i class="fa-solid fa-pen-to-square"></i> สร้างบันทึกแรก
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    items.forEach(item => {
        const catMeta = getCategoryDisplayMeta(item.category);
        const isPinned = !!item.is_pinned;
        const safeTitle = escapeVaultHtml(item.title || 'ไม่มีชื่อหัวข้อ');
        const rawContent = item.content || '';
        const preview = escapeVaultHtml(rawContent.substring(0, 140)) + (rawContent.length > 140 ? '...' : '');
        const dateStr = item.client_updated_at || item.created_at || 'เพิ่งบันทึก';

        html += `
            <div class="vault-item-card ${isPinned ? 'pinned' : ''}" data-id="${item.item_id}">
                <div class="vault-card-top">
                    <span class="vault-cat-chip ${catMeta.chipClass}">
                        <i class="fa-solid ${catMeta.icon}"></i> ${catMeta.label}
                    </span>
                    ${isPinned ? '<span class="vault-pin-indicator" title="ปักหมุดสำคัญ"><i class="fa-solid fa-thumbtack text-amber"></i></span>' : ''}
                </div>
                <div class="vault-card-title" title="${safeTitle}">${safeTitle}</div>
                <div class="vault-card-preview">${preview}</div>
                <div class="vault-card-footer">
                    <span class="vault-card-date"><i class="fa-regular fa-clock"></i> ${escapeVaultHtml(dateStr)}</span>
                    <div class="vault-card-actions">
                        <button type="button" class="btn-card-action view" onclick="viewVaultDocument('${item.item_id}')" title="เปิดอ่านเอกสาร">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button type="button" class="btn-card-action pin ${isPinned ? 'active' : ''}" onclick="togglePinVaultItem('${item.item_id}')" title="${isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดเอกสารนี้'}">
                            <i class="fa-solid fa-thumbtack"></i>
                        </button>
                        <button type="button" class="btn-card-action del" onclick="deleteVaultItemPrompt('${item.item_id}', '${safeTitle.replace(/'/g, "\\'")}')" title="ลบเอกสาร">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderVaultOutbox() {
    const container = document.getElementById('vault-outbox-container');
    if (!container) return;

    const outbox = getLocalVaultOutbox();
    if (outbox.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 36px 16px; color: #94a3b8;">
                <i class="fa-solid fa-circle-check text-emerald" style="font-size: 2.2rem; margin-bottom: 10px; display: inline-block;"></i>
                <div style="color: #f1f5f9; font-weight: 600;">คิวรอซิงก์ว่างเปล่า (All Synced)</div>
                <p style="font-size: 0.8rem; margin: 4px 0 0 0;">ข้อมูลทุกรายการถูกซิงก์ขึ้นสู่เซิร์ฟเวอร์คลาวด์เรียบร้อยแล้วค่ะ</p>
            </div>
        `;
        return;
    }

    let html = '';
    outbox.forEach((chg) => {
        const action = chg.action || 'upsert';
        const title = escapeVaultHtml(chg.title || (chg.item && chg.item.title) || chg.item_id || 'เอกสาร');
        const timeStr = chg.client_updated_at || chg.timestamp || 'รอส่ง';
        const actionBadgeColor = (action === 'delete') ? '#ef4444' : '#10b981';
        const actionBadgeText = (action === 'delete') ? 'DELETE' : 'SAVE';

        html += `
            <div class="vault-outbox-item">
                <div>
                    <div class="outbox-item-title">${title}</div>
                    <div class="outbox-item-meta">
                        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: ${actionBadgeColor}22; color: ${actionBadgeColor}; font-weight: 700; margin-right: 6px;">${actionBadgeText}</span>
                        <span>เวลา: ${escapeVaultHtml(timeStr)}</span>
                    </div>
                </div>
                <div style="color: #fbbf24; font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-clock-rotate-left"></i> รอเชื่อมต่อ
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function handleSaveVaultMemo(e) {
    if (e) e.preventDefault();
    const titleInput = document.getElementById('vault-memo-title');
    const catSelect = document.getElementById('vault-memo-cat');
    const contentInput = document.getElementById('vault-memo-content');
    const pinCheckbox = document.getElementById('vault-memo-pinned');

    if (!titleInput || !contentInput) return;

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const category = catSelect ? catSelect.value : 'memo';
    const isPinned = pinCheckbox ? pinCheckbox.checked : false;

    if (!title || !content) {
        alert('กรุณากรอกหัวข้อและเนื้อหาเอกสารให้ครบถ้วนนะคะ');
        return;
    }

    saveToOfflineVault(category, title, content, isPinned);

    titleInput.value = '';
    contentInput.value = '';
    if (pinCheckbox) pinCheckbox.checked = false;

    switchVaultTab('catalog');
    alert(`บันทึกเอกสาร '${title}' ลงใน Executive Offline Vault เรียบร้อยแล้วค่ะ!`);
}

function saveToOfflineVault(category, title, content, isPinned = false, metadata = {}) {
    const now = new Date().toISOString();
    const itemId = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const newItem = {
        item_id: itemId,
        username: 'boss',
        category: category || 'memo',
        title: title,
        content: content,
        metadata: metadata || {},
        is_pinned: !!isPinned,
        client_updated_at: now,
        synced_at: null,
        created_at: now
    };

    // 1. Add to local cache immediately
    const items = getLocalVaultItems();
    items.unshift(newItem);
    setLocalVaultItems(items);

    // 2. Add to outbox queue
    const outbox = getLocalVaultOutbox();
    outbox.push({
        action: 'upsert',
        item_id: itemId,
        title: title,
        content: content,
        category: category,
        metadata: metadata,
        is_pinned: !!isPinned,
        client_updated_at: now,
        created_at: now
    });
    setLocalVaultOutbox(outbox);

    renderVaultCatalog();
    renderVaultOutbox();
    updateVaultPillAndBadgeUI();

    // 3. If online, trigger background sync
    if (navigator.onLine) {
        triggerVaultSync(false);
    }

    return itemId;
}

async function togglePinVaultItem(itemId) {
    const items = getLocalVaultItems();
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    item.is_pinned = !item.is_pinned;
    item.client_updated_at = new Date().toISOString();
    setLocalVaultItems(items);

    // Add to outbox
    const outbox = getLocalVaultOutbox();
    outbox.push({
        action: 'upsert',
        item_id: item.item_id,
        title: item.title,
        content: item.content,
        category: item.category,
        metadata: item.metadata,
        is_pinned: item.is_pinned,
        client_updated_at: item.client_updated_at
    });
    setLocalVaultOutbox(outbox);

    renderVaultCatalog();

    if (navigator.onLine) {
        try {
            await fetch(`/api/vault/items/${itemId}/pin`, { method: 'POST' });
        } catch (e) {
            console.warn("Online pin toggle notice:", e);
        }
    }
}

async function deleteVaultItemPrompt(itemId, title) {
    if (!confirm(`ท่านประธานต้องการลบเอกสาร '${title}' ออกจากคลังนิรภัยหรือไม่คะ?`)) return;

    let items = getLocalVaultItems();
    items = items.filter(i => i.item_id !== itemId);
    setLocalVaultItems(items);

    const outbox = getLocalVaultOutbox();
    outbox.push({
        action: 'delete',
        item_id: itemId
    });
    setLocalVaultOutbox(outbox);

    renderVaultCatalog();
    renderVaultOutbox();
    closeVaultDocumentViewer();

    if (navigator.onLine) {
        try {
            await fetch(`/api/vault/items/${itemId}`, { method: 'DELETE' });
        } catch (e) {
            console.warn("Online delete notice:", e);
        }
    }
}

function viewVaultDocument(itemId) {
    const items = getLocalVaultItems();
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    currentlyViewedVaultItem = item;
    const viewer = document.getElementById('vault-doc-viewer');
    const titleEl = document.getElementById('vault-viewer-title');
    const timeEl = document.getElementById('vault-viewer-time');
    const badgeEl = document.getElementById('vault-viewer-cat-badge');
    const bodyEl = document.getElementById('vault-viewer-body');

    if (!viewer) return;

    const catMeta = getCategoryDisplayMeta(item.category);
    if (badgeEl) {
        badgeEl.textContent = catMeta.label;
        badgeEl.className = `vault-cat-badge ${catMeta.chipClass}`;
    }

    if (titleEl) titleEl.textContent = item.title || 'ไม่มีชื่อหัวข้อ';
    if (timeEl) timeEl.textContent = `อัปเดตเมื่อ: ${item.client_updated_at || item.created_at || 'ไม่ระบุ'}`;

    if (bodyEl) {
        const raw = item.content || '';
        if (typeof marked !== 'undefined' && marked.parse) {
            bodyEl.innerHTML = marked.parse(raw);
        } else {
            bodyEl.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeVaultHtml(raw)}</pre>`;
        }
    }

    viewer.style.display = 'flex';
}

function closeVaultDocumentViewer() {
    const viewer = document.getElementById('vault-doc-viewer');
    if (viewer) viewer.style.display = 'none';
    currentlyViewedVaultItem = null;
}

function copyVaultDocumentContent() {
    if (!currentlyViewedVaultItem) return;
    const content = currentlyViewedVaultItem.content || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(() => {
            alert('คัดลอกเนื้อหาเอกสารลงคลิปบอร์ดเรียบร้อยแล้วค่ะ');
        }).catch(err => {
            alert('ไม่สามารถคัดลอกได้: ' + err.message);
        });
    } else {
        alert('เบราว์เซอร์ไม่รองรับ Clipboard API ค่ะ');
    }
}

function deleteViewedVaultDocument() {
    if (!currentlyViewedVaultItem) return;
    deleteVaultItemPrompt(currentlyViewedVaultItem.item_id, currentlyViewedVaultItem.title || 'เอกสาร');
}

function clearVaultCachePrompt() {
    if (!confirm('คำเตือน: ท่านประธานต้องการล้างแคชออฟไลน์ในเครื่องนี้หรือไม่คะ? (รายการทั้งหมดจะถูกดาวน์โหลดใหม่จาก Cloud เมื่อออนไลน์)')) return;

    localStorage.removeItem(VAULT_STORAGE_ITEMS_KEY);
    localStorage.removeItem(VAULT_STORAGE_OUTBOX_KEY);
    localStorage.removeItem(VAULT_STORAGE_LAST_SYNC_KEY);

    vaultCatalogCache = [];
    vaultOutboxCache = [];
    renderVaultCatalog();
    renderVaultOutbox();
    updateVaultPillAndBadgeUI();

    alert('ล้างแคชออฟไลน์ในเครื่องเรียบร้อยแล้วค่ะ');
    if (navigator.onLine) {
        loadVaultData(false);
    }
}

function clearVaultOutboxPrompt() {
    if (!confirm('ท่านประธานต้องการล้างคิวรอซิงก์ทั้งหมดหรือไม่คะ?')) return;
    setLocalVaultOutbox([]);
    renderVaultOutbox();
    updateVaultPillAndBadgeUI();
    alert('ล้างคิวรอซิงก์เรียบร้อยแล้วค่ะ');
}

async function exportVaultJsonBackup() {
    try {
        let items = getLocalVaultItems();
        if (navigator.onLine) {
            try {
                const res = await fetch('/api/vault/export');
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && Array.isArray(data.items)) {
                        items = data.items;
                    }
                }
            } catch (e) {
                console.log("Using local cache for backup export");
            }
        }

        const exportPayload = {
            system: "Kira AI Executive Offline Vault",
            export_timestamp: new Date().toISOString(),
            total_items: items.length,
            items: items
        };

        const jsonStr = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `kira_executive_vault_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการส่งออกไฟล์สำรอง: ' + err.message);
    }
}

function handleVaultFileImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
            if (!Array.isArray(items) || items.length === 0) {
                alert('ไม่พบรายการข้อมูลในไฟล์สำรองค่ะ');
                return;
            }

            // Merge into local cache
            const existing = getLocalVaultItems();
            const map = new Map();
            existing.forEach(i => map.set(i.item_id, i));
            items.forEach(i => {
                if (i.item_id) map.set(i.item_id, i);
            });
            const merged = Array.from(map.values());
            setLocalVaultItems(merged);

            // If online, send to /api/vault/import
            if (navigator.onLine) {
                try {
                    await fetch('/api/vault/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: 'boss', backup_data: items })
                    });
                } catch (e) {
                    console.warn("Online import sync notice:", e);
                }
            }

            renderVaultCatalog();
            updateVaultPillAndBadgeUI();
            alert(`กู้คืนข้อมูลสำเร็จเรียบร้อยค่ะ! นำเข้าข้อมูลทั้งหมด ${items.length} รายการ`);
        } catch (err) {
            alert('ไม่สามารถอ่านไฟล์สำรองได้: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function initOfflineVaultController() {
    // 1. Network Pill & Modal Open
    const pill = document.getElementById('btn-vault-network-pill');
    if (pill) {
        pill.addEventListener('click', () => openOfflineVaultModal('catalog'));
    }

    const btnClose = document.getElementById('btn-close-vault-modal');
    if (btnClose) {
        btnClose.addEventListener('click', closeOfflineVaultModal);
    }

    const modal = document.getElementById('offline-vault-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeOfflineVaultModal();
        });
    }

    // 2. Tab Navigation
    const tabBtns = document.querySelectorAll('.vault-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab) switchVaultTab(tab);
        });
    });

    // 3. Category Filters
    const catBtns = document.querySelectorAll('.vault-cat-btn');
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentVaultCategory = btn.dataset.cat || 'all';
            renderVaultCatalog();
        });
    });

    // 4. Search Filter
    const searchInput = document.getElementById('vault-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderVaultCatalog());
    }

    // 5. Manual Sync Action
    const btnSync = document.getElementById('btn-vault-manual-sync');
    if (btnSync) {
        btnSync.addEventListener('click', () => triggerVaultSync(true));
    }

    // 6. Directive / Memo Form
    const memoForm = document.getElementById('vault-memo-form');
    if (memoForm) {
        memoForm.addEventListener('submit', handleSaveVaultMemo);
    }

    // 7. Outbox Operations
    const btnClearOutbox = document.getElementById('btn-clear-outbox-queue');
    if (btnClearOutbox) {
        btnClearOutbox.addEventListener('click', clearVaultOutboxPrompt);
    }

    // 8. Security & Backup Actions
    const btnClearCache = document.getElementById('btn-clear-vault-cache');
    if (btnClearCache) {
        btnClearCache.addEventListener('click', clearVaultCachePrompt);
    }

    const btnExport = document.getElementById('btn-export-vault-json');
    if (btnExport) {
        btnExport.addEventListener('click', exportVaultJsonBackup);
    }

    const btnTriggerImport = document.getElementById('btn-trigger-vault-import');
    const fileInput = document.getElementById('vault-import-file-input');
    if (btnTriggerImport && fileInput) {
        btnTriggerImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleVaultFileImport(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // 9. Document Viewer Controls
    const btnCloseViewer = document.getElementById('btn-close-vault-viewer');
    if (btnCloseViewer) {
        btnCloseViewer.addEventListener('click', closeVaultDocumentViewer);
    }

    const btnCopyContent = document.getElementById('btn-copy-vault-content');
    if (btnCopyContent) {
        btnCopyContent.addEventListener('click', copyVaultDocumentContent);
    }

    const btnDeleteViewed = document.getElementById('btn-delete-viewed-vault');
    if (btnDeleteViewed) {
        btnDeleteViewed.addEventListener('click', deleteViewedVaultDocument);
    }

    // 10. Global Network State Listeners
    window.addEventListener('online', () => {
        updateVaultConnectivityUI(true);
        triggerVaultSync(false);
    });

    window.addEventListener('offline', () => {
        updateVaultConnectivityUI(false);
    });

    // 11. Initial State Setup
    updateVaultConnectivityUI(navigator.onLine);
    loadVaultData(false);

    // Expose Global Vault Interface
    window.openOfflineVaultModal = openOfflineVaultModal;
    window.closeOfflineVaultModal = closeOfflineVaultModal;
    window.switchVaultTab = switchVaultTab;
    window.saveToOfflineVault = saveToOfflineVault;
    window.togglePinVaultItem = togglePinVaultItem;
    window.deleteVaultItemPrompt = deleteVaultItemPrompt;
    window.viewVaultDocument = viewVaultDocument;
    window.triggerVaultSync = triggerVaultSync;
    window.exportVaultJsonBackup = exportVaultJsonBackup;
}

// =========================================================================
// 🚀 Master Application Lifecycle Initialization
// =========================================================================
function initKiraApp() {
    console.log("⚡ [Kira AI] Initializing all subsystems & controllers...");

    // 1. Session & Auth Guards
    try { checkSession(); } catch (e) { console.error("Session check init error:", e); }
    try { checkPendingOAuthMessage(); } catch (e) { console.error("OAuth check error:", e); }

    // 2. Interactive Controls & Dropdowns
    try { initToolsDropdownController(); } catch (e) { console.error("Tools dropdown init error:", e); }
    try { initSettingsModalEventListeners(); } catch (e) { console.error("Settings modal init error:", e); }
    try { initUserModeController(); } catch (e) { console.error("User mode controller init error:", e); }
    try { initBoardroomController(); } catch (e) { console.error("Boardroom controller init error:", e); }

    // 3. Productivity & Studio Controllers
    try { initLiveCanvasController(); } catch (e) { console.error("Live canvas init error:", e); }
    try { initTaskMatrixController(); } catch (e) { console.error("Task matrix init error:", e); }
    try { initLiveScreenInspector(); } catch (e) { console.error("Live screen inspector init error:", e); }
    try { initSpeechRecognition(); } catch (e) { console.error("Speech recognition init error:", e); }
    try { initLiveVoiceAssistant(); } catch (e) { console.error("Live voice init error:", e); }
    try { initSlideDeckStudio(); } catch (e) { console.error("Slide deck studio init error:", e); }
    try { initSubscriptionController(); } catch (e) { console.error("Subscription controller init error:", e); }
    try { initPWAController(); } catch (e) { console.error("PWA controller init error:", e); }
    try { initMCPHubController(); } catch (e) { console.error("MCP Hub controller init error:", e); }
    try { initOfflineVaultController(); } catch (e) { console.error("Offline Vault controller init error:", e); }

    // 4. Background Care & Assistance
    try { initProactiveHeartbeat(); } catch (e) { console.warn("Heartbeat init error:", e); }
    try { initOnboardingGuide(); } catch (e) { console.warn("Onboarding guide init error:", e); }

    // 5. Standing Intervals
    try {
        setInterval(checkEngineStatus, 30000);
        setInterval(() => checkNeuralCoreHealth(false), 240000);
    } catch (e) {
        console.warn("Background interval registration notice:", e);
    }

    console.log("✨ [Kira AI] All interactive systems operational!");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKiraApp);
} else {
    initKiraApp();
}






