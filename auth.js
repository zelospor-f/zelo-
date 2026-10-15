// ===== تسجيل الدخول بالبريد الإلكتروني (مثل منصة X) =====
// الخطوات: 1) البريد  2) رمز التحقق  3) الاسم + اسم المستخدم + تاريخ الميلاد (للمستخدم الجديد)  4) اختيار الأندية
(function() {
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const isAr = () => String(US().lang || LS.get('app_lang') || 'ar').startsWith('ar');
    const T = (ar, en) => isAr() ? ar : en;

    let step = 'email';
    let email = '';
    let busy = false;
    let resendLeft = 0;
    let resendTimer = null;
    let usernameOk = false;
    let checkTimer = null;

    const MIN_AGE = 13;

    function hideBars() {
        const tb = document.getElementById('top-bar'), bn = document.getElementById('bottom-nav');
        if (tb) tb.style.display = 'none';
        if (bn) bn.style.display = 'none';
    }
    function showBars() {
        const tb = document.getElementById('top-bar'), bn = document.getElementById('bottom-nav');
        if (tb) tb.style.display = 'flex';
        if (bn) bn.style.display = 'flex';
    }
    const mainEl = () => document.getElementById('main-content') || document.body;

    function css() {
        const ar = isAr();
        return `<style>
            .au-wrap { width:100%; max-width:480px; min-height:100vh; min-height:100dvh; margin:0 auto; box-sizing:border-box; padding:18px 18px 28px; background:#08090C; color:#fff; direction:${ar ? 'rtl' : 'ltr'}; text-align:${ar ? 'right' : 'left'}; display:flex; flex-direction:column; }
            .au-lang { display:flex; justify-content:center; gap:8px; margin-bottom:18px; }
            .au-lang span { padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.78rem; cursor:pointer; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); }
            .au-lang .on { background:linear-gradient(135deg,#2AABEE,#00FF87); color:#04110B; border-color:transparent; }
            .au-logo { width:64px; height:64px; border-radius:18px; margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:900; color:#04110B; background:linear-gradient(135deg,#2AABEE,#00FF87); box-shadow:0 0 24px rgba(0,255,135,0.3); }
            .au-title { font-size:1.45rem; font-weight:900; margin:6px 0 6px; }
            .au-sub { font-size:0.82rem; color:#94a3b8; font-weight:600; line-height:1.6; margin-bottom:20px; }
            .au-field { border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:8px 14px 10px; margin-bottom:14px; background:rgba(255,255,255,0.03); }
            .au-field:focus-within { border-color:#00FF87; }
            .au-field label { display:block; font-size:0.7rem; font-weight:800; color:#7a7f9a; margin-bottom:2px; }
            .au-field input { width:100%; box-sizing:border-box; background:transparent; border:none; outline:none; color:#fff; font-size:1rem; font-weight:700; padding:4px 0; font-family:inherit; }
            .au-code input { text-align:center; letter-spacing:10px; font-size:1.5rem; direction:ltr; }
            .au-dob { display:flex; gap:8px; }
            .au-dob select { flex:1; min-width:0; background:#12142a; color:#fff; border:1px solid rgba(255,255,255,0.18); border-radius:10px; padding:11px 8px; font-size:0.9rem; font-weight:700; outline:none; }
            .au-note { font-size:0.72rem; font-weight:700; margin:-6px 0 14px; min-height:1em; color:#7a7f9a; }
            .au-ok { color:#00FF87; } .au-bad { color:#ff6b6b; }
            .au-btn { width:100%; border:none; cursor:pointer; margin-top:auto; background:#fff; color:#000; font-weight:900; font-size:1rem; padding:14px; border-radius:30px; }
            .au-btn:disabled { opacity:0.4; cursor:default; }
            .au-link { text-align:center; margin-top:14px; font-size:0.8rem; font-weight:800; color:#2AABEE; cursor:pointer; }
            .au-link.off { color:#7a7f9a; cursor:default; }
            .au-spacer { flex:1; min-height:20px; }
        </style>`;
    }

    function langBar() {
        const ar = isAr();
        return `<div class="au-lang"><span class="${ar ? 'on' : ''}" onclick="window.authSetLang('ar')">🇸🇦 العربية</span><span class="${!ar ? 'on' : ''}" onclick="window.authSetLang('en')">🇬🇧 English</span></div>`;
    }
    window.authSetLang = function(l) {
        if (typeof userState !== 'undefined') userState.lang = l;
        LS.set('app_lang', l);
        if (typeof applyLanguageSettings === 'function') try { applyLanguageSettings(); } catch (e) {}
        draw();
    };

    function draw() {
        hideBars();
        const el = mainEl();
        if (step === 'email') el.innerHTML = css() + `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-logo">Z</div>
                <div class="au-title">${T('سجّل الدخول إلى Zelo Sport', 'Sign in to Zelo Sport')}</div>
                <div class="au-sub">${T('أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق. إن لم يكن لديك حساب فسننشئ لك واحداً.', "Enter your email and we'll send you a verification code. No account? We'll create one.")}</div>
                <div class="au-field"><label>${T('البريد الإلكتروني', 'Email')}</label>
                    <input id="au-email" type="email" dir="ltr" autocomplete="email" inputmode="email" value="${esc(email)}" placeholder="name@example.com" oninput="window.authEmailInput()"></div>
                <div class="au-note" id="au-msg"></div>
                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authSendCode()" disabled>${T('التالي', 'Next')}</button>
            </div>`;
        else if (step === 'code') el.innerHTML = css() + `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-title">${T('أدخل رمز التحقق', 'Enter verification code')}</div>
                <div class="au-sub">${T('أرسلنا رمزاً إلى', 'We sent a code to')} <b dir="ltr">${esc(email)}</b></div>
                <div class="au-field au-code"><label>${T('الرمز', 'Code')}</label>
                    <input id="au-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••" oninput="this.value=this.value.replace(/[^0-9]/g,''); window.authCodeInput()"></div>
                <div class="au-note" id="au-msg"></div>
                <div class="au-link" id="au-resend" onclick="window.authResend()"></div>
                <div class="au-link" onclick="window.authBack()">${T('تغيير البريد', 'Change email')}</div>
                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authVerify()" disabled>${T('تحقق', 'Verify')}</button>
            </div>`;
        else el.innerHTML = css() + setupHtml();
        if (step === 'code') updateResend();
        if (step === 'email') window.authEmailInput();
        if (step === 'setup') window.authSetupInput();
        const first = document.getElementById(step === 'email' ? 'au-email' : step === 'code' ? 'au-code' : 'au-user');
        if (first && step !== 'setup') setTimeout(() => first.focus(), 50);
    }

    function setupHtml() {
        const ar = isAr();
        const months = ar
            ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
            : ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const thisYear = new Date().getFullYear();
        let years = '';
        for (let y = thisYear - MIN_AGE; y >= 1930; y--) years += `<option value="${y}">${y}</option>`;
        let days = '';
        for (let d = 1; d <= 31; d++) days += `<option value="${d}">${d}</option>`;
        return `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-title">${T('أنشئ حسابك', 'Create your account')}</div>
                <div class="au-sub">${T('اختر اسم مستخدم فريداً وأدخل تاريخ ميلادك. يمكنك تغيير اسمك المستعار لاحقاً من ملفك الشخصي.', 'Pick a unique username and enter your date of birth. You can change your nickname later from your profile.')}</div>

                <div class="au-field"><label>${T('اسم المستخدم (إنجليزي، أرقام و_)', 'Username (English, numbers, _)')}</label>
                    <input id="au-user" dir="ltr" maxlength="20" autocapitalize="none" autocomplete="username" placeholder="username_123" oninput="this.value=this.value.replace(/[^a-zA-Z0-9_]/g,''); window.authUsernameInput()"></div>
                <div class="au-note" id="au-umsg"></div>

                <div class="au-field"><label>${T('تاريخ الميلاد', 'Date of birth')}</label>
                    <div class="au-dob">
                        <select id="au-day" onchange="window.authSetupInput()"><option value="">${T('اليوم', 'Day')}</option>${days}</select>
                        <select id="au-month" onchange="window.authSetupInput()"><option value="">${T('الشهر', 'Month')}</option>${months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
                        <select id="au-year" onchange="window.authSetupInput()"><option value="">${T('السنة', 'Year')}</option>${years}</select>
                    </div>
                </div>
                <div class="au-note" id="au-dmsg">${T(`يجب ألا يقل العمر عن ${MIN_AGE} سنة`, `You must be at least ${MIN_AGE} years old`)}</div>
                <div class="au-note au-bad" id="au-msg"></div>

                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authFinishSetup()" disabled>${T('التالي', 'Next')}</button>
            </div>`;
    }

    const setMsg = (txt, cls) => { const m = document.getElementById('au-msg'); if (m) { m.textContent = txt || ''; m.className = 'au-note ' + (cls || ''); } };
    const val = id => (document.getElementById(id)?.value || '').trim();
    const setBtn = on => { const b = document.getElementById('au-next'); if (b) b.disabled = !on || busy; };

    // ---------- خطوة 1: البريد ----------
    window.authEmailInput = function() {
        email = val('au-email');
        setBtn(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    };

    window.authSendCode = async function() {
        const c = db();
        if (!c || !c.auth) { setMsg(T('لا يوجد اتصال بقاعدة البيانات', 'No database connection'), 'au-bad'); return; }
        email = val('au-email').toLowerCase();
        busy = true; setBtn(false); setMsg(T('جارٍ الإرسال...', 'Sending...'));
        const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        busy = false;
        if (error) { setBtn(true); setMsg(T('تعذر إرسال الرمز: ', 'Could not send code: ') + error.message, 'au-bad'); return; }
        step = 'code';
        startResend(60);
        draw();
    };

    // ---------- خطوة 2: الرمز ----------
    window.authCodeInput = function() { setBtn(val('au-code').length >= 6); };

    function startResend(sec) {
        resendLeft = sec;
        clearInterval(resendTimer);
        resendTimer = setInterval(() => { resendLeft--; updateResend(); if (resendLeft <= 0) clearInterval(resendTimer); }, 1000);
    }
    function updateResend() {
        const r = document.getElementById('au-resend');
        if (!r) return;
        if (resendLeft > 0) { r.textContent = T(`إعادة الإرسال بعد ${resendLeft}ث`, `Resend in ${resendLeft}s`); r.className = 'au-link off'; }
        else { r.textContent = T('إعادة إرسال الرمز', 'Resend code'); r.className = 'au-link'; }
    }
    window.authResend = async function() {
        if (resendLeft > 0) return;
        const c = db();
        setMsg(T('جارٍ الإرسال...', 'Sending...'));
        const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) { setMsg(error.message, 'au-bad'); return; }
        setMsg(T('تم إرسال رمز جديد ✅', 'New code sent ✅'), 'au-ok');
        startResend(60);
    };
    window.authBack = function() { step = 'email'; clearInterval(resendTimer); draw(); };

    window.authVerify = async function() {
        const c = db();
        const token = val('au-code');
        busy = true; setBtn(false); setMsg(T('جارٍ التحقق...', 'Verifying...'));
        const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' });
        busy = false;
        if (error || !data || !data.user) { setBtn(true); setMsg(T('الرمز غير صحيح أو منتهي', 'Invalid or expired code') + (error ? ' (' + error.message + ')' : ''), 'au-bad'); return; }
        await afterSession(data.user);
    };

    // ---------- بعد نجاح الجلسة ----------
    async function afterSession(authUser) {
        const c = db();
        let row = null;
        try {
            const r = await c.from('users').select('*').eq('user_id', String(authUser.id)).maybeSingle();
            row = r.data || null;
        } catch (e) {}
        applyRowToState(authUser, row);
        if (!row || !row.username || !row.dob) { step = 'setup'; draw(); return; }
        proceedAfterAuth(row);
    }

    function applyRowToState(authUser, row) {
        if (typeof userState === 'undefined') return;
        userState.userId = String(authUser.id);
        userState.email = authUser.email || (row && row.email) || '';
        LS.set('zelo_email', userState.email);
        if (row) {
            userState.username = row.username || '';
            userState.nickname_ar = row.nickname_ar || '';
            userState.nickname_en = row.nickname_en || '';
            userState.dob = row.dob || '';
            userState.bio = row.bio || '';
            userState.photoUrl = row.photo_url || '';
            userState.badgeClub = row.badge_club || '';
            userState.ownedNfts = Array.isArray(row.owned_nfts) ? row.owned_nfts : (userState.ownedNfts || []);
            userState.selectedClubs = Array.isArray(row.selected_clubs) ? row.selected_clubs.map(String) : [];
            if (row.points != null) userState.points = row.points;
            if (row.lang) userState.lang = row.lang;
            ['username','nickname_ar','nickname_en','dob','bio'].forEach(k => LS.set('zelo_' + k, row[k] || ''));
            LS.set('zelo_photo_url', row.photo_url || '');
            LS.set('zelo_badge_club', row.badge_club || '');
        }
    }

    function proceedAfterAuth(row) {
        const clubs = (row && Array.isArray(row.selected_clubs)) ? row.selected_clubs : [];
        if (clubs.length) {
            if (typeof userState !== 'undefined') userState.hasLoggedIn = true;
            showBars();
            if (typeof updateTopBar === 'function') updateTopBar();
            if (typeof showPage === 'function') showPage('home');
        } else {
            window.tempSelectedClubs = [];
            if (typeof window.renderLoginScreen === 'function') window.renderLoginScreen(); // شاشة اختيار الأندية
        }
    }

    // ---------- خطوة 3: الاسم + اسم المستخدم + تاريخ الميلاد ----------
    window.authUsernameInput = function() {
        const u = val('au-user');
        const msg = document.getElementById('au-umsg');
        usernameOk = false;
        clearTimeout(checkTimer);
        if (!u) { if (msg) { msg.textContent = ''; } window.authSetupInput(); return; }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
            if (msg) { msg.textContent = T('من 3 إلى 20 حرفاً إنجليزياً أو أرقاماً أو _', '3-20 letters, numbers or _'); msg.className = 'au-note au-bad'; }
            window.authSetupInput(); return;
        }
        if (msg) { msg.textContent = T('جارٍ الفحص...', 'Checking...'); msg.className = 'au-note'; }
        checkTimer = setTimeout(async () => {
            const c = db();
            let taken = false;
            try {
                const { data } = await c.from('users').select('user_id').ilike('username', u).limit(1);
                taken = !!(data && data.length && String(data[0].user_id) !== String(US().userId));
            } catch (e) {}
            if (val('au-user') !== u) return;
            usernameOk = !taken;
            if (msg) {
                msg.textContent = taken ? T('اسم المستخدم محجوز، جرّب اسماً آخر', 'Username is taken') : T('✅ اسم المستخدم متاح', '✅ Username is available');
                msg.className = 'au-note ' + (taken ? 'au-bad' : 'au-ok');
            }
            window.authSetupInput();
        }, 400);
    };

    function readDob() {
        const d = parseInt(val('au-day')), m = parseInt(val('au-month')), y = parseInt(val('au-year'));
        if (!d || !m || !y) return null;
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return 'invalid';
        const now = new Date();
        let age = now.getFullYear() - y;
        if (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d)) age--;
        if (age < MIN_AGE) return 'young';
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    window.authSetupInput = function() {
        const dob = readDob();
        const dm = document.getElementById('au-dmsg');
        if (dm) {
            if (dob === 'invalid') { dm.textContent = T('تاريخ غير صحيح', 'Invalid date'); dm.className = 'au-note au-bad'; }
            else if (dob === 'young') { dm.textContent = T(`يجب ألا يقل العمر عن ${MIN_AGE} سنة`, `You must be at least ${MIN_AGE} years old`); dm.className = 'au-note au-bad'; }
            else { dm.className = 'au-note'; }
        }
        setBtn(usernameOk && dob && dob !== 'invalid' && dob !== 'young');
    };

    window.authFinishSetup = async function() {
        const c = db();
        const username = val('au-user');
        const dob = readDob();
        busy = true; setBtn(false); setMsg('');
        const uid = String(US().userId || '');
        // الاسم المستعار الافتراضي = ما قبل @ في البريد (مثال: abolooae@gmail.com -> abolooae)
        const name = String(US().email || email || '').split('@')[0].slice(0, 30);
        const hasArabic = /[\u0600-\u06FF]/.test(name);
        const payload = {
            user_id: uid,
            email: US().email || email,
            username,
            dob,
            lang: US().lang || LS.get('app_lang') || 'ar'
        };
        if (hasArabic) payload.nickname_ar = name; else payload.nickname_en = name;
        const { error } = await c.from('users').upsert(payload, { onConflict: 'user_id' });
        busy = false;
        if (error) {
            setBtn(true);
            const dup = /duplicate|unique/i.test(error.message);
            setMsg(dup ? T('اسم المستخدم محجوز', 'Username is taken') : (T('تعذر الحفظ: ', 'Save failed: ') + error.message), 'au-bad');
            return;
        }
        if (typeof userState !== 'undefined') {
            Object.assign(userState, { username, dob, nickname_ar: hasArabic ? name : (userState.nickname_ar || ''), nickname_en: hasArabic ? (userState.nickname_en || '') : name });
        }
        LS.set('zelo_username', username); LS.set('zelo_dob', dob);
        LS.set('zelo_nickname_ar', US().nickname_ar || ''); LS.set('zelo_nickname_en', US().nickname_en || '');
        proceedAfterAuth(null); // مستخدم جديد: اختيار الأندية
    };

    // ---------- نقطة الدخول: استدعِها عند بدء التطبيق ----------
    window.zeloStartAuth = async function() {
        const c = db();
        if (!c || !c.auth) { step = 'email'; draw(); return; }
        try {
            const { data } = await c.auth.getSession();
            if (data && data.session && data.session.user) { await afterSession(data.session.user); return; }
        } catch (e) { console.error('session error', e); }
        step = 'email';
        draw();
    };
    window.renderAuthScreen = function() { step = 'email'; draw(); };
})();
