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
let isGenerating = false;
let currentImageBase64 = null;

// Audio context and current playing audio
let currentAudio = null;

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
        const response = await fetch(`/api/user/profile/${currentUser}`);
        const data = await response.json();
        if (data.status === 'success') {
            profileName.textContent = currentUser;
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

// Check auth on load
checkAuth();
updateModelUI();
checkEngineStatus();
setInterval(checkEngineStatus, 30000);

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
let currentSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

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
            chatBox.innerHTML = '';
            addMessage(`สวัสดีค่ะคุณ ${currentUser}! หนู Kira ยินดีต้อนรับนะคะ วันนี้มีอะไรให้หนูช่วยไหมคะ?`, false);
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
            chatBox.innerHTML = '';
            addMessage(`สวัสดีค่ะคุณ ${currentUser}! หนู Kira ยินดีต้อนรับนะคะ วันนี้มีอะไรให้หนูช่วยไหมคะ?`, false);
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
            addMessage(`สวัสดีค่ะคุณ ${currentUser}! หนู Kira ยินดีต้อนรับนะคะ วันนี้มีอะไรให้หนูช่วยไหมคะ?`, false);
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

function addMessage(text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? '' : '<img src="/static/images/kira_avatar.jpg?v=5" alt="Kira">';

    const content = document.createElement('div');
    content.className = 'content';
    
    if (isUser) {
        content.textContent = text;
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
                
                let stepsHtml = steps.map(s => `<div class="thinking-step" style="white-space: pre-wrap; font-size: 0.9em; line-height: 1.5; color: #94a3b8;">${marked.parse(s)}</div>`).join('');
                
                htmlContent += `
                <div class="thinking-box done collapsed">
                    <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="thinking-title">🧠 กระบวนการคิดเชิงลึก (Deep Reasoning)</div>
                        <div class="thinking-toggle-icon">▼</div>
                    </div>
                    <div class="thinking-progress-bar"></div>
                    <div class="thinking-content">
                        ${stepsHtml}
                    </div>
                </div>
                `;
            }
            
            htmlContent += finalMarkdown ? marked.parse(finalMarkdown) : "";
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

    const imgBase64ToSend = currentImageBase64;
    // Clear image immediately from UI after sending
    currentImageBase64 = null;
    const imgPreviewContainer = document.getElementById('image-preview-container');
    const imgInput = document.getElementById('img-input');
    if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';
    if (imgInput) imgInput.value = '';




    try {
        const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "2.0-flash";
        const flavor = document.querySelector('input[name="sub-model-flavor"]:checked') ? document.querySelector('input[name="sub-model-flavor"]:checked').value : "fast";
        const persona = document.getElementById('persona-select') ? document.getElementById('persona-select').value : "default";

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, username: currentUser, model_version: modelVersion, image_base64: imgBase64ToSend, session_id: currentSessionId, flavor: flavor, persona: persona })
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
                let boxClass = isDone ? "thinking-box done collapsed" : "thinking-box";
                let toggleIcon = isDone ? "▼" : "▲";
                
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
            
            htmlContent += finalMarkdown ? marked.parse(finalMarkdown) : "";
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

        const reviewBtn = document.createElement('button');
        reviewBtn.innerHTML = '<i class="fa-solid fa-comment-dots"></i> รีวิวติชม';
        reviewBtn.style.cssText = 'background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;';
        reviewBtn.onclick = () => openReviewModal(fullText);

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
        loadUserProfile(); // Refresh points after message
        
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
    const savedModel = localStorage.getItem('kira_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    }

    modelSelect.addEventListener('change', (e) => {
        localStorage.setItem('kira_model', e.target.value);
        updateModelUI();
    });
}

const btnInfo = document.getElementById('btn-info');
if (btnInfo) {
    btnInfo.addEventListener('click', () => {
        alert("Kira AI - Public Cloud Engine\nเวอร์ชัน: 1.0 (ระบบทดสอบ)\nผู้สร้าง: Kira Studio");
    });
}

// Duplicate declaration removed

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

// --- Speech Recognition (STT) ---
var micBtn = document.getElementById('mic-btn');
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.interimResults = true;
    
    let isRecording = false;
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
                micBtn.style.color = '#ef4444'; // Red
                micBtn.classList.add('pulsing');
            }
            isRecording = !isRecording;
        });

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                userInput.value = (userInput.value + ' ' + finalTranscript).trim();
                userInput.dispatchEvent(new Event('input'));
            }
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.style.color = '';
            micBtn.classList.remove('pulsing');
        };
        
        recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            isRecording = false;
            micBtn.style.color = '';
            micBtn.classList.remove('pulsing');
        };
    }
} else {
    if (micBtn) micBtn.style.display = 'none'; // Not supported
}

// --- Chat Export Feature ---
const btnExport = document.getElementById('btn-export');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        if (confirm('ต้องการบันทึกบทสนทนานี้เป็น PDF ใช่หรือไม่? (ระบบจะเปิดหน้าต่าง Print ให้เลือก Save as PDF)')) {
            window.print();
        }
    });
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
    
    // Inject full HTML wrapper if code is just a fragment
    let fullHtml = code;
    if (!code.toLowerCase().includes('<!doctype') && !code.toLowerCase().includes('<html')) {
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
        
        // Live Preview Button
        if (isHtmlOrWeb) {
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
