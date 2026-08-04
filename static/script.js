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
    const attachBtn = document.querySelector('.attach-btn');
    if (!modelSelect) return;

    const opt11 = modelSelect.querySelector('option[value="1.1"]');
    const opt12 = modelSelect.querySelector('option[value="1.2"]');
    const subModelContainer = document.getElementById('sub-model-container');
    
    if (opt11) {
        opt11.textContent = "Kira 1.1 [Pioneer]";
    }
    if (opt12) {
        if (isBoss(currentUser)) {
            opt12.textContent = "Kira 1.2 [Apex]";
        } else {
            opt12.textContent = "Kira 1.2 [Apex] 🔒";
        }
    }

    if (modelSelect.value === '1.1' || modelSelect.value === '1.2') {
        document.body.classList.add('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.add('unlocked');
            attachBtn.title = "แนบไฟล์ (Kira PRO)";
        }
    } else {
        document.body.classList.remove('glow-1-1');
        if (attachBtn) {
            attachBtn.classList.remove('unlocked');
            attachBtn.title = "แนบไฟล์ (ยังไม่รองรับใน 1.0)";
        }
    }

    // Toggle Sub-model UI with Animation
    if (subModelContainer) {
        if (modelSelect.value === '1.2') {
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

    // --- Magic Image Generation Interception (Free AI Art) ---
    if (text.toLowerCase().startsWith('/image') || text.startsWith('วาดรูป')) {
        hideTypingIndicator();
        isGenerating = false;
        userInput.disabled = false;
        userInput.focus();
        
        let promptText = text.replace(/^\/image/i, '').replace(/^วาดรูป/, '').trim();
        if (!promptText) promptText = "a beautiful random artwork";
        
        // Use Pollinations AI (Free, no-key image generation)
        const encodedPrompt = encodeURIComponent(promptText);
        const seed = Math.floor(Math.random() * 100000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
        
        const botMsg = `นี่คือรูปภาพที่คุณขอครับ:\n\n![${promptText}](${imageUrl})`;
        const msgContainer = addMessage('', false);
        msgContainer.innerHTML = marked.parse(botMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        return; // Don't send to backend LLM
    }

    try {
        const modelVersion = document.getElementById('model-select') ? document.getElementById('model-select').value : "1.0";
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
            let displayTxt = fullText.replace(/^(✨ \*\*\[Kira 1\.1 PRO\]\*\*\n\n|🤖 \*\*\[Kira 1\.0\]\*\*\n\n|✨ \*\*\[Kira 1\.2 PRO\]\*\*\n\n)/i, "");
            contentDiv.innerHTML = marked.parse(displayTxt);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        // Apply Advanced Markdown features (MathJax, Copy code)
        if (typeof applyAdvancedMarkdown === 'function') {
            applyAdvancedMarkdown(contentDiv);
        }
        
        // Append Feedback UI
        const feedbackUI = document.createElement('div');
        feedbackUI.className = 'feedback-ui';
        feedbackUI.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 8px; justify-content: flex-start;';
        
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

        feedbackUI.appendChild(likeBtn);
        feedbackUI.appendChild(dislikeBtn);
        feedbackUI.appendChild(reviewBtn);
        contentDiv.appendChild(feedbackUI);
        
        // Play Voice Cloning (TTS) if disabled

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
    hiddenFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const fileName = file.name;
            const username = localStorage.getItem('username');
            
            if (!username) {
                alert("กรุณาล็อกอินก่อนอัปโหลดไฟล์ค่ะ");
                return;
            }
            
            // Show uploading message in chat
            addMessageToChat("System", `กำลังอัปโหลดไฟล์: ${fileName}... ⏳`);
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('username', username);
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    addMessageToChat("System", `✅ อัปโหลดไฟล์ ${fileName} สำเร็จแล้ว! บอสสามารถถามคำถามเกี่ยวกับไฟล์นี้ได้เลยค่ะ`);
                } else {
                    addMessageToChat("System", `❌ อัปโหลดไฟล์ล้มเหลว: ${data.message}`);
                }
            } catch (error) {
                console.error("Upload error:", error);
                addMessageToChat("System", `❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์`);
            }
            
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
        if (e.target.value === '1.2') {
            if (!isBoss(currentUser)) {
                alert("Kira 1.2 กำลังอยู่ในช่วงการฝึกฝนแบบปิด (Private Beta) และจะเปิดให้ทุกคนร่วมทดสอบเร็วๆ นี้ค่ะ! ✨");
                e.target.value = '1.1'; // Revert back to 1.1 instead of 1.0 since 1.1 is public now
                localStorage.setItem('kira_model', '1.1');
            } else {
                localStorage.setItem('kira_model', e.target.value);
            }
        } else {
            localStorage.setItem('kira_model', e.target.value);
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
var micBtn = document.getElementById('mic-btn');
if (micBtn) {
    let recognition;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'th-TH';

        recognition.onstart = function() {
            micBtn.style.color = '#ef4444';
            micBtn.classList.add('glow-1-1');
            userInput.placeholder = "กำลังฟัง...";
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            userInput.value += transcript;
            sendBtn.disabled = false;
        };

        recognition.onerror = function(event) {
            console.error("Speech error:", event.error);
        };

        recognition.onend = function() {
            micBtn.style.color = ''; 
            micBtn.classList.remove('glow-1-1');
            userInput.placeholder = "พิมพ์ข้อความหา Kira...";
        };

        micBtn.addEventListener('click', () => {
            if (micBtn.style.color === 'rgb(239, 68, 68)' || micBtn.style.color === '#ef4444') {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        micBtn.addEventListener('click', () => {
            alert("เบราว์เซอร์ของคุณไม่รองรับระบบสั่งงานด้วยเสียง กรุณาใช้ Chrome หรือ Edge ครับ");
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
        if (modelVersion !== "1.1") {
            alert("ฟีเจอร์แนบไฟล์สงวนสิทธิ์เฉพาะระดับ Boss (Kira 1.1 PRO) เท่านั้นครับ");
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
