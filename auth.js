// ===== تسجيل الدخول (كلمة سر + بريد/اسم مستخدم + رمز تحقق للتسجيل + Google) =====
// الشاشات: login (الافتراضية) | email (تسجيل جديد) | code | setup | forgot | newpass
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

    // داخل تطبيق الأندرويد (Capacitor) أم في المتصفح؟
    const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const NATIVE_REDIRECT = 'com.zelosport.app://login-callback';

    let step = 'login';
    let flow = 'signup'; // signup | reset
    let email = '';
    let busy = false;
    let resendLeft = 0;
    let resendTimer = null;
    let usernameOk = false;
    let checkTimer = null;

    const MIN_AGE = 13;
    const MIN_PASS = 6;

    // رابط صورة الشعار (ضع رابط صورتك هنا). إذا تركته فارغاً أو فشل التحميل يظهر الحرف Z
    const LOGO_URL = 'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png';

    const GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

    let scrollSaved = null;
    function lockScroll() {
        const els = [document.documentElement, document.body, document.getElementById('main-content')].filter(Boolean);
        if (!scrollSaved) scrollSaved = els.map(e => [e, e.style.overflow, e.style.overscrollBehavior]);
        els.forEach(e => { e.style.overflow = 'hidden'; e.style.overscrollBehavior = 'none'; });
        window.scrollTo(0, 0);
    }
    function unlockScroll() {
        if (!scrollSaved) return;
        scrollSaved.forEach(([e, o, ob]) => { e.style.overflow = o; e.style.overscrollBehavior = ob; });
        scrollSaved = null;
    }

    window.zeloLockScroll = lockScroll;
    window.zeloUnlockScroll = unlockScroll;

    function hideBars() {
        lockScroll();
        const tb = document.getElementById('top-bar'), bn = document.getElementById('bottom-nav');
        if (tb) tb.style.display = 'none';
        if (bn) bn.style.display = 'none';
    }
    function showBars() {
        unlockScroll();
        const tb = document.getElementById('top-bar'), bn = document.getElementById('bottom-nav');
        if (tb) tb.style.display = 'flex';
        if (bn) bn.style.display = 'flex';
    }
    const mainEl = () => document.getElementById('main-content') || document.body;

    function css() {
        const ar = isAr();
        return `<style>
            .au-wrap { width:100%; max-width:480px; height:100vh; height:100dvh; overflow:hidden; margin:0 auto; box-sizing:border-box; padding:18px 18px 28px; background:#08090C; color:#fff; direction:${ar ? 'rtl' : 'ltr'}; text-align:${ar ? 'right' : 'left'}; display:flex; flex-direction:column; }
            .au-lang { display:flex; justify-content:center; gap:8px; margin-bottom:18px; }
            .au-lang span { padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.78rem; cursor:pointer; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); }
            .au-lang .on { background:linear-gradient(135deg,#2AABEE,#00FF87); color:#04110B; border-color:transparent; }
            .au-logo { width:64px; height:64px; border-radius:18px; margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:900; color:#04110B; background:linear-gradient(135deg,#2AABEE,#00FF87); box-shadow:0 0 24px rgba(0,255,135,0.3); }
            .au-logo img { width:100%; height:100%; object-fit:cover; border-radius:18px; display:block; }
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
            .au-btn { width:100%; border:none; cursor:pointer; margin-top:auto; background:#fff; color:#000; font-weight:900; font-size:1rem; padding:14px; border-radius:30px; font-family:inherit; }
            .au-btn.flat { margin-top:0; margin-bottom:12px; }
            .au-btn.outline { background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.35); }
            .au-btn:disabled { opacity:0.4; cursor:default; }
            .au-link { text-align:center; margin-top:14px; font-size:0.8rem; font-weight:800; color:#2AABEE; cursor:pointer; }
            .au-link.off { color:#7a7f9a; cursor:default; }
            .au-forgot { text-align:right; direction:ltr; margin:-4px 0 16px; font-size:0.8rem; font-weight:800; color:#2AABEE; cursor:pointer; }
            .au-spacer { flex:1; min-height:20px; }
            .au-or { display:flex; align-items:center; gap:12px; margin:6px 0 16px; color:#7a7f9a; font-size:0.78rem; font-weight:800; }
            .au-or::before, .au-or::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.12); }
            .au-social { width:100%; display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:12px; padding:13px; border-radius:30px; cursor:pointer; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.18); color:#fff; font-weight:800; font-size:0.95rem; font-family:inherit; }
            .au-social:active { background:rgba(255,255,255,0.12); }
            @media (max-height:720px) {
                .au-wrap { padding:10px 16px 14px; }
                .au-lang { margin-bottom:8px; }
                .au-logo { width:48px; height:48px; margin-bottom:8px; font-size:1.5rem; }
                .au-title { font-size:1.2rem; margin:2px 0; }
                .au-sub { margin-bottom:10px; font-size:0.76rem; line-height:1.4; }
                .au-field { padding:5px 12px 6px; margin-bottom:8px; }
                .au-note { margin:-3px 0 8px; }
                .au-btn { padding:11px; }
                .au-btn.flat { margin-bottom:8px; }
                .au-dob select { padding:8px 6px; }
                .au-or { margin:2px 0 10px; }
                .au-social { padding:10px; margin-bottom:8px; }
            }
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

    function logoHtml() {
        if (!LOGO_URL) return 'Z';
        return `<img src="${esc(LOGO_URL)}" alt="Zelo Sport" onerror="this.parentNode.textContent='Z'">`;
    }

    function googleBtn() {
        return `<button class="au-social" onclick="window.authOAuth('google')">${GOOGLE_SVG}<span>${T('المتابعة عبر Google', 'Continue with Google')}</span></button>`;
    }

    function draw() {
        hideBars();
        const el = mainEl();
        if (step === 'login') el.innerHTML = css() + `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-logo">${logoHtml()}</div>
                <div class="au-title">${T('سجّل الدخول إلى Zelo Sport', 'Sign in to Zelo Sport')}</div>
                <div class="au-sub">${T('أدخل اسم المستخدم أو البريد الإلكتروني وكلمة السر.', 'Enter your username or email and your password.')}</div>
                <div class="au-field"><label>${T('اسم المستخدم أو البريد الإلكتروني', 'Username or email')}</label>
                    <input id="au-id" dir="ltr" autocapitalize="none" autocomplete="username" value="${esc(LS.get('zelo_last_id'))}" oninput="window.authLoginInput()"></div>
                <div class="au-field"><label>${T('كلمة السر', 'Password')}</label>
                    <input id="au-pass" type="password" dir="ltr" autocomplete="current-password" oninput="window.authLoginInput()"></div>
                <div class="au-forgot" onclick="window.authForgot()">${T('هل نسيت كلمة السر؟', 'Forgot password?')}</div>
                <div class="au-note" id="au-msg"></div>
                <button class="au-btn flat" id="au-next" onclick="window.authLogin()" disabled>${T('تسجيل الدخول', 'Sign in')}</button>
                <button class="au-btn flat outline" onclick="window.authGoSignup()">${T('إنشاء حساب عبر البريد الإلكتروني', 'Sign up with email')}</button>
                <div class="au-or"><span>${T('أو', 'or')}</span></div>
                ${googleBtn()}
            </div>`;
        else if (step === 'email' || step === 'forgot') {
            const reset = step === 'forgot';
            el.innerHTML = css() + `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-title">${reset ? T('إعادة تعيين كلمة السر', 'Reset password') : T('إنشاء حساب جديد', 'Create an account')}</div>
                <div class="au-sub">${reset
                    ? T('أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق لتعيين كلمة سر جديدة.', "Enter your email and we'll send a code so you can set a new password.")
                    : T('أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق.', "Enter your email and we'll send you a verification code.")}</div>
                <div class="au-field"><label>${T('البريد الإلكتروني', 'Email')}</label>
                    <input id="au-email" type="email" dir="ltr" autocomplete="email" inputmode="email" value="${esc(email)}" placeholder="name@example.com" oninput="window.authEmailInput()"></div>
                <div class="au-note" id="au-msg"></div>
                <div class="au-link" onclick="window.authToLogin()">${T('لديّ حساب – تسجيل الدخول', 'I have an account – Sign in')}</div>
                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authSendCode()" disabled>${T('التالي', 'Next')}</button>
            </div>`;
        }
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
        else if (step === 'newpass') el.innerHTML = css() + `
            <div class="au-wrap">
                ${langBar()}
                <div class="au-title">${T('كلمة سر جديدة', 'New password')}</div>
                <div class="au-sub">${T(`اختر كلمة سر لا تقل عن ${MIN_PASS} أحرف.`, `Choose a password of at least ${MIN_PASS} characters.`)}</div>
                <div class="au-field"><label>${T('كلمة السر الجديدة', 'New password')}</label>
                    <input id="au-pass" type="password" dir="ltr" autocomplete="new-password" oninput="window.authNewPassInput()"></div>
                <div class="au-field"><label>${T('تأكيد كلمة السر', 'Confirm password')}</label>
                    <input id="au-pass2" type="password" dir="ltr" autocomplete="new-password" oninput="window.authNewPassInput()"></div>
                <div class="au-note" id="au-msg"></div>
                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authSaveNewPass()" disabled>${T('حفظ', 'Save')}</button>
            </div>`;
        else el.innerHTML = css() + setupHtml();

        if (step === 'code') updateResend();
        if (step === 'login') window.authLoginInput();
        if (step === 'email' || step === 'forgot') window.authEmailInput();
        if (step === 'setup') window.authSetupInput();
        if (step === 'newpass') window.authNewPassInput();
        const firstId = { login: 'au-id', email: 'au-email', forgot: 'au-email', code: 'au-code', newpass: 'au-pass' }[step];
        const first = firstId && document.getElementById(firstId);
        if (first) setTimeout(() => first.focus(), 50);
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
                <div class="au-sub">${T('اختر اسم مستخدم فريداً وكلمة سر وأدخل تاريخ ميلادك. يمكنك تغيير اسمك المستعار لاحقاً من ملفك الشخصي.', 'Pick a unique username, a password and enter your date of birth. You can change your nickname later from your profile.')}</div>

                <div class="au-field"><label>${T('اسم المستخدم (إنجليزي، أرقام و_)', 'Username (English, numbers, _)')}</label>
                    <input id="au-user" dir="ltr" maxlength="20" autocapitalize="none" autocomplete="username" placeholder="username_123" oninput="this.value=this.value.replace(/[^a-zA-Z0-9_]/g,''); window.authUsernameInput()"></div>
                <div class="au-note" id="au-umsg"></div>

                <div class="au-field"><label>${T('كلمة السر', 'Password')}</label>
                    <input id="au-pass" type="password" dir="ltr" autocomplete="new-password" oninput="window.authSetupInput()"></div>
                <div class="au-note" id="au-pmsg">${T(`${MIN_PASS} أحرف على الأقل`, `At least ${MIN_PASS} characters`)}</div>

                <div class="au-field"><label>${T('تاريخ الميلاد', 'Date of birth')}</label>
                    <div class="au-dob">
                        <select id="au-day" onchange="window.authSetupInput()"><option value="">${T('اليوم', 'Day')}</option>${days}</select>
                        <select id="au-month" onchange="window.authSetupInput()"><option value="">${T('الشهر', 'Month')}</option>${months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
                        <select id="au-year" onchange="window.authSetupInput()"><option value="">${T('السنة', 'Year')}</option>${years}</select>
                    </div>
                </div>
                <div class="au-note" id="au-dmsg">${T(`يجب ألا يقل العمر عن ${MIN_AGE} سنة`, `You must be at least ${MIN_AGE} years old`)}</div>
                <div class="au-note au-bad" id="au-msg"></div>

                <div class="au-link" onclick="window.authCancelSetup()">${T('لديّ حساب – رجوع لتسجيل الدخول', 'I have an account – Back to sign in')}</div>

                <div class="au-spacer"></div>
                <button class="au-btn" id="au-next" onclick="window.authFinishSetup()" disabled>${T('التالي', 'Next')}</button>
            </div>`;
    }

    const setMsg = (txt, cls) => { const m = document.getElementById('au-msg'); if (m) { m.textContent = txt || ''; m.className = 'au-note ' + (cls || ''); } };
    const val = id => (document.getElementById(id)?.value || '').trim();
    const rawVal = id => (document.getElementById(id)?.value || ''); // كلمة السر بدون تقليم
    const setBtn = on => { const b = document.getElementById('au-next'); if (b) b.disabled = !on || busy; };

    // ---------- التنقل بين الشاشات ----------
    window.authGoSignup = function() { flow = 'signup'; step = 'email'; draw(); };
    window.authForgot = function() {
        flow = 'reset'; step = 'forgot';
        const id = val('au-id');
        if (id.includes('@')) email = id.toLowerCase();
        draw();
    };
    window.authToLogin = function() { flow = 'signup'; step = 'login'; clearInterval(resendTimer); draw(); };

    // ---------- تسجيل الدخول بكلمة السر ----------
    window.authLoginInput = function() {
        setBtn(val('au-id').length > 0 && rawVal('au-pass').length > 0);
    };

    window.authLogin = async function() {
        const c = db();
        if (!c || !c.auth) { setMsg(T('لا يوجد اتصال بقاعدة البيانات', 'No database connection'), 'au-bad'); return; }
        const id = val('au-id');
        const pass = rawVal('au-pass');
        busy = true; setBtn(false); setMsg(T('جارٍ تسجيل الدخول...', 'Signing in...'));
        let mail = id.toLowerCase();
        if (!id.includes('@')) {
            // اسم مستخدم -> نجلب البريد المرتبط به
            mail = '';
            try {
                const { data, error } = await c.rpc('get_email_by_username', { p_username: id });
                if (!error && data) mail = String(data).toLowerCase();
            } catch (e) {}
            if (!mail) {
                busy = false; setBtn(true);
                setMsg(T('اسم المستخدم أو كلمة السر غير صحيحة', 'Incorrect username or password'), 'au-bad');
                return;
            }
        }
        const { data, error } = await c.auth.signInWithPassword({ email: mail, password: pass });
        busy = false;
        if (error || !data || !data.user) {
            setBtn(true);
            setMsg(T('البريد/اسم المستخدم أو كلمة السر غير صحيحة', 'Incorrect email/username or password'), 'au-bad');
            return;
        }
        LS.set('zelo_last_id', id);
        await afterSession(data.user);
    };

    // ---------- البريد (تسجيل جديد أو نسيت كلمة السر) ----------
    window.authEmailInput = function() {
        email = val('au-email');
        setBtn(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    };

    window.authSendCode = async function() {
        const c = db();
        if (!c || !c.auth) { setMsg(T('لا يوجد اتصال بقاعدة البيانات', 'No database connection'), 'au-bad'); return; }
        email = val('au-email').toLowerCase();
        busy = true; setBtn(false); setMsg(T('جارٍ الإرسال...', 'Sending...'));
        const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: flow !== 'reset' } });
        busy = false;
        if (error) { setBtn(true); setMsg(T('تعذر إرسال الرمز: ', 'Could not send code: ') + error.message, 'au-bad'); return; }
        step = 'code';
        startResend(60);
        draw();
    };

    // ---------- الدخول عبر Google ----------
    window.authOAuth = async function(provider) {
        const c = db();
        if (!c || !c.auth) { setMsg(T('لا يوجد اتصال بقاعدة البيانات', 'No database connection'), 'au-bad'); return; }
        setMsg(T('جارٍ التحويل...', 'Redirecting...'));
        const { data, error } = await c.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: NATIVE ? NATIVE_REDIRECT : location.origin + location.pathname,
                skipBrowserRedirect: NATIVE,
                queryParams: { prompt: 'select_account' }
            }
        });
        if (error) { setMsg(T('تعذر تسجيل الدخول: ', 'Sign-in failed: ') + error.message, 'au-bad'); return; }
        if (NATIVE && data && data.url) {
            try {
                const B = window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
                if (!B) throw new Error('Browser plugin missing');
                await B.open({ url: data.url });
            } catch (e) {
                console.error('Browser.open failed:', e);
                try {
                    window.open(data.url, '_system');
                } catch (e2) {
                    setMsg(T('تعذر فتح المتصفح: ', 'Could not open the browser: ') + (e.message || e), 'au-bad');
                }
            }
        }
    };

    // الرجوع من المتصفح إلى التطبيق بعد موافقة Google
    if (NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('appUrlOpen', async function(ev) {
            const url = (ev && ev.url) || '';
            if (!url.startsWith(NATIVE_REDIRECT)) return;
            try { await window.Capacitor.Plugins.Browser.close(); } catch (e) {}
            const c = db();
            if (!c || !c.auth) return;
            const queryPart = (url.split('?')[1] || '').split('#')[0];
            const hashPart = url.split('#')[1] || '';
            const q = new URLSearchParams(queryPart);
            const h = new URLSearchParams(hashPart);
            try {
                if (q.get('code')) {
                    await c.auth.exchangeCodeForSession(q.get('code'));
                } else if (h.get('access_token')) {
                    await c.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
                } else if (q.get('error_description') || h.get('error_description')) {
                    setMsg(q.get('error_description') || h.get('error_description'), 'au-bad');
                    return;
                }
            } catch (e) { console.error('oauth return error', e); }
            window.zeloStartAuth();
        });
    }

    // ---------- رمز التحقق ----------
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
        const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: flow !== 'reset' } });
        if (error) { setMsg(error.message, 'au-bad'); return; }
        setMsg(T('تم إرسال رمز جديد ✅', 'New code sent ✅'), 'au-ok');
        startResend(60);
    };
    window.authBack = function() { step = flow === 'reset' ? 'forgot' : 'email'; clearInterval(resendTimer); draw(); };

    window.authVerify = async function() {
        const c = db();
        const token = val('au-code');
        busy = true; setBtn(false); setMsg(T('جارٍ التحقق...', 'Verifying...'));
        const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' });
        busy = false;
        if (error || !data || !data.user) { setBtn(true); setMsg(T('الرمز غير صحيح أو منتهي', 'Invalid or expired code') + (error ? ' (' + error.message + ')' : ''), 'au-bad'); return; }
        if (flow === 'reset') { step = 'newpass'; draw(); return; }
        await afterSession(data.user);
    };

    // ---------- كلمة سر جديدة (بعد "نسيت كلمة السر") ----------
    window.authNewPassInput = function() {
        const p1 = rawVal('au-pass'), p2 = rawVal('au-pass2');
        if (p1.length > 0 && p1.length < MIN_PASS) setMsg(T(`${MIN_PASS} أحرف على الأقل`, `At least ${MIN_PASS} characters`), 'au-bad');
        else if (p2 && p1 !== p2) setMsg(T('كلمتا السر غير متطابقتين', 'Passwords do not match'), 'au-bad');
        else setMsg('');
        setBtn(p1.length >= MIN_PASS && p1 === p2);
    };

    window.authSaveNewPass = async function() {
        const c = db();
        busy = true; setBtn(false); setMsg(T('جارٍ الحفظ...', 'Saving...'));
        const { data, error } = await c.auth.updateUser({ password: rawVal('au-pass') });
        busy = false;
        if (error) { setBtn(true); setMsg(T('تعذر الحفظ: ', 'Save failed: ') + error.message, 'au-bad'); return; }
        flow = 'signup';
        const user = (data && data.user) || (await c.auth.getUser()).data.user;
        await afterSession(user);
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
            // يبقى التمرير الخارجي مقفلاً؛ login.js يفكّه عند الدخول للتطبيق
            if (typeof window.renderLoginScreen === 'function') window.renderLoginScreen(); // شاشة اختيار الأندية
        }
    }

    // ---------- إكمال الحساب: اسم المستخدم + كلمة السر + تاريخ الميلاد ----------
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
                const { data, error } = await c.rpc('is_username_available', { p_username: u });
                taken = !error && data === false;
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
        const passOk = rawVal('au-pass').length >= MIN_PASS;
        const pm = document.getElementById('au-pmsg');
        if (pm) pm.className = 'au-note' + (rawVal('au-pass').length && !passOk ? ' au-bad' : '');
        setBtn(usernameOk && passOk && dob && dob !== 'invalid' && dob !== 'young');
    };

    window.authFinishSetup = async function() {
        const c = db();
        const username = val('au-user');
        const dob = readDob();
        const pass = rawVal('au-pass');
        busy = true; setBtn(false); setMsg('');

        // حفظ كلمة السر في حساب المصادقة
        const { error: pErr } = await c.auth.updateUser({ password: pass });
        if (pErr) {
            busy = false; setBtn(true);
            setMsg(T('تعذر حفظ كلمة السر: ', 'Could not save password: ') + pErr.message, 'au-bad');
            return;
        }

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
        LS.set('zelo_last_id', username);
        // تسجيل الإحالة (تبقى معلّقة حتى أول كسب للمدعو)
        if (typeof window.zeloRegisterReferral === 'function') { try { await window.zeloRegisterReferral(); } catch (e) {} }
        proceedAfterAuth(null); // مستخدم جديد: اختيار الأندية
    };

    // الرجوع من شاشة إكمال الحساب إلى تسجيل الدخول (مع إنهاء الجلسة غير المكتملة)
    window.authCancelSetup = async function() {
        const c = db();
        try { if (c && c.auth) await c.auth.signOut(); } catch (e) { console.error('signOut error', e); }
        usernameOk = false;
        clearTimeout(checkTimer);
        flow = 'signup';
        step = 'login';
        draw();
    };

    // ---------- نقطة الدخول: استدعِها عند بدء التطبيق ----------
    window.zeloStartAuth = async function() {
        const c = db();
        if (!c || !c.auth) { step = 'login'; draw(); return; }
        try {
            const { data } = await c.auth.getSession();
            if (data && data.session && data.session.user) { await afterSession(data.session.user); return; }
        } catch (e) { console.error('session error', e); }
        step = 'login';
        draw();
    };
    // تُستدعى بعد تسجيل الخروج: تظهر شاشة تسجيل الدخول في المقدمة
    window.renderAuthScreen = function() { flow = 'signup'; step = 'login'; draw(); };
})();
