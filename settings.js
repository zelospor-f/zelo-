(function () {
    'use strict';

    // ملف الإعدادات المنفصل: يوفّر window.openSettings() ويستدعيه زر الإعدادات في side-drawer.js

    const CSS = `
        .zset-toast {
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(28, 28, 34, 0.95); color: #fff;
            padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(252, 176, 69, 0.3);
            font-size: 0.85rem; z-index: 3000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zset-toast.show { opacity: 1; }

        /* ===== شاشة الإعدادات ===== */
        .zset {
            position: fixed; inset: 0; z-index: 2500;
            background: #0b0b0f; color: #f8fafc;
            display: flex; flex-direction: column;
            padding-top: env(safe-area-inset-top, 0px);
            font-family: inherit;
        }
        .zs-head { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
        .zs-head.line { border-bottom: 1px solid rgba(255,255,255,0.08); }
        .zs-back {
            width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
            background: transparent; border: none; color: #fff; font-size: 1.35rem; cursor: pointer;
        }
        .zs-title { font-size: 1.1rem; font-weight: 900; }
        .zs-sub { font-size: 0.85rem; color: #888899; direction: ltr; text-align: start; }
        .zs-body { flex: 1; overflow-y: auto; padding: 8px 16px 20px; }
        .zs-foot {
            display: flex; justify-content: flex-end; gap: 10px;
            padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
            border-top: 1px solid rgba(255,255,255,0.08);
        }
        .zs-foot.two { justify-content: space-between; }
        .zs-pill, .zs-outline {
            border-radius: 999px; padding: 12px 26px; font-weight: 900; font-size: 0.95rem;
            cursor: pointer; font-family: inherit;
        }
        .zs-pill { border: none; background: linear-gradient(135deg, #14F195, #2AABEE); color: #04110B; }
        .zs-outline { background: transparent; border: 1px solid rgba(255,255,255,0.28); color: #fff; }
        .zs-pill:disabled { opacity: 0.4; cursor: default; }
        .zs-box {
            position: relative; display: flex; align-items: center; gap: 8px;
            border: 1px solid rgba(255,255,255,0.2); border-radius: 10px;
            padding: 4px 14px; margin: 22px 0 6px;
        }
        .zs-box:focus-within { border-color: #14F195; }
        .zs-box.off { opacity: 0.6; }
        .zs-box.round { border-radius: 16px; padding: 8px 16px; margin-top: 8px; }
        .zs-box input {
            flex: 1; min-width: 0; background: transparent; border: none; outline: none;
            color: #fff; font-size: 1.05rem; font-weight: 700; padding: 12px 0; font-family: inherit;
            user-select: text; -webkit-user-select: text;
        }
        .zs-lbl {
            position: absolute; top: -9px; inset-inline-start: 12px;
            background: #0b0b0f; padding: 0 6px;
            font-size: 0.75rem; font-weight: 800; color: #888899;
        }
        .zs-big { font-size: 1.6rem; font-weight: 900; line-height: 1.4; margin: 26px 0 12px; }
        .zs-p { font-size: 0.92rem; color: #9aa0b4; line-height: 1.8; margin-bottom: 16px; }
        .zs-link { font-size: 0.88rem; font-weight: 800; color: #2AABEE; cursor: pointer; margin-top: 14px; display: inline-block; }
        .zs-link.off { color: #7a7f9a; cursor: default; }
        .zs-row {
            width: 100%; display: flex; align-items: center; gap: 14px;
            padding: 14px 12px; margin-bottom: 10px; text-align: start;
            background: rgba(28, 28, 34, 0.7); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px; color: #fff; cursor: pointer; font-family: inherit;
        }
        .zs-row-ico { font-size: 1.25rem; width: 28px; text-align: center; }
        .zs-row-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .zs-row-txt b { font-size: 0.95rem; font-weight: 800; }
        .zs-row-txt small { font-size: 0.78rem; color: #888899; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .zs-chev { color: #888899; font-size: 1.4rem; }
        .zs-logout {
            width: 100%; margin-top: 14px; padding: 14px; border-radius: 14px; cursor: pointer;
            background: rgba(253, 29, 29, 0.12); color: #ff6b6b; font-family: inherit;
            border: 1px solid rgba(253, 29, 29, 0.4); font-weight: 900; font-size: 1rem;
        }
        .zs-eye { background: transparent; border: none; color: #8899a6; cursor: pointer; padding: 6px; display: flex; align-items: center; flex-shrink: 0; }
        .zs-hint { font-size: 0.8rem; color: #cbd5e1; margin: 2px 2px 0; font-weight: 600; }
        .zset-ico { font-size: 1.2rem; font-weight: 900; min-width: 22px; text-align: center; }
        .zset-ico.ok { color: #14F195; }
        .zset-ico.bad { color: #ff4d4d; }
        .zset-note { font-size: 0.78rem; font-weight: 700; min-height: 1.2em; margin: 4px 2px 0; color: #888899; }
        .zset-note.ok { color: #14F195; }
        .zset-note.bad { color: #ff4d4d; }
    `;

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg) {
        let el = document.getElementById('zset-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zset-toast';
            el.className = 'zset-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2000);
    }

    function injectStyle() {
        if (document.getElementById('zset-style')) return;
        const st = document.createElement('style');
        st.id = 'zset-style';
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    // ===================== الإعدادات =====================
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const US = () => window.userState || {};
    const sdb = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const $ = id => document.getElementById(id);

    const SET = { timer: null, rt: null };

    function currentNick() {
        const u = US();
        return u.nickname_ar || u.nickname_en
            || LS.get('zelo_nickname_ar') || LS.get('zelo_nickname_en')
            || String(u.email || LS.get('zelo_email') || '').split('@')[0];
    }
    function currentEmail() { return US().email || LS.get('zelo_email') || ''; }

    function maskEmail(e) {
        const parts = String(e || '').split('@');
        if (parts.length !== 2) return e || '';
        const u = parts[0];
        return u.slice(0, 2) + '*'.repeat(Math.max(3, u.length - 2)) + '@' + parts[1];
    }

    function setNote(id, cls, text) {
        const el = $(id);
        if (!el) return;
        el.className = 'zset-note' + (cls ? ' ' + cls : '');
        el.textContent = text || '';
    }
    function setIco(cls, glyph) {
        const el = $('zs-nick-ico');
        if (!el) return;
        el.className = 'zset-ico' + (cls ? ' ' + cls : '');
        el.textContent = glyph || '';
    }
    function clearTimers() { clearTimeout(SET.timer); clearInterval(SET.rt); }
    function mount(html) { const z = $('zset'); if (z) z.innerHTML = html; }
    const backBtn = () => `<button class="zs-back" id="zs-back">${isAr() ? '➔' : '←'}</button>`;

    // ---------- الشاشة الرئيسية ----------
    function screenMain() {
        clearTimers();
        const row = (id, ico, label, val) => `
            <button class="zs-row" id="${id}">
                <span class="zs-row-ico">${ico}</span>
                <span class="zs-row-txt"><b>${label}</b><small dir="auto">${esc(val)}</small></span>
                <span class="zs-chev">${isAr() ? '‹' : '›'}</span>
            </button>`;
        mount(`
            <div class="zs-head line">${backBtn()}<div class="zs-title">⚙️ ${L('الإعدادات', 'Settings')}</div></div>
            <div class="zs-body">
                ${row('zs-r-nick', '👤', L('الاسم المستعار', 'Nickname'), currentNick())}
                ${row('zs-r-email', '✉️', L('البريد الإلكتروني', 'Email'), currentEmail() || '—')}
                ${row('zs-r-pass', '🔑', L('كلمة المرور', 'Password'), '••••••••')}
                <button class="zs-logout" id="zs-logout">🚪 ${L('تسجيل الخروج', 'Log out')}</button>
            </div>`);
        $('zs-back').addEventListener('click', closeSettings);
        $('zs-r-nick').addEventListener('click', screenNick);
        $('zs-r-email').addEventListener('click', startEmailFlow);
        $('zs-r-pass').addEventListener('click', () => screenPass(false));
        $('zs-logout').addEventListener('click', doLogout);
    }

    // ---------- الاسم المستعار ----------
    // هل الاسم مأخوذ من لاعب آخر؟ true / false / null (تعذر الفحص)
    // يعتمد على دالة قاعدة البيانات is_nickname_available (تتجاوز RLS دون كشف بيانات أحد)
    async function isNickTaken(n) {
        const c = sdb();
        if (!c) return null;
        try {
            const { data, error } = await c.rpc('is_nickname_available', { p_nick: n });
            if (error) return null;
            return data === false;
        } catch (e) { return null; }
    }

    function screenNick() {
        clearTimers();
        const cur = currentNick();
        mount(`
            <div class="zs-head line">${backBtn()}
                <div><div class="zs-title">${L('الاسم المستعار', 'Nickname')}</div><div class="zs-sub">${esc(cur)}</div></div>
            </div>
            <div class="zs-body">
                <div class="zs-box off"><span class="zs-lbl">${L('الحالي', 'Current')}</span><input value="${esc(cur)}" disabled></div>
                <div class="zs-box"><span class="zs-lbl">${L('جديد', 'New')}</span>
                    <input id="zs-nick" maxlength="30" autocomplete="off" value="${esc(cur)}">
                    <span class="zset-ico" id="zs-nick-ico"></span>
                </div>
                <div class="zset-note" id="zs-nick-msg"></div>
            </div>
            <div class="zs-foot"><button class="zs-pill" id="zs-done" disabled>${L('تمّ', 'Done')}</button></div>`);
        $('zs-back').addEventListener('click', screenMain);
        $('zs-nick').addEventListener('input', onNickInput);
        $('zs-done').addEventListener('click', saveNick);
        setTimeout(() => { const i = $('zs-nick'); if (i) { i.focus(); i.select(); } }, 80);
    }

    function onNickInput() {
        const input = $('zs-nick'), btn = $('zs-done');
        if (!input || !btn) return;
        const n = input.value.trim();
        btn.disabled = true;
        clearTimeout(SET.timer);

        if (n.length < 2) { setIco('', ''); setNote('zs-nick-msg', '', ''); return; }
        if (n.toLowerCase() === currentNick().toLowerCase()) {
            setIco('ok', '✔'); setNote('zs-nick-msg', 'ok', L('هذا اسمك الحالي', 'This is your current name'));
            return;
        }
        setIco('', '…'); setNote('zs-nick-msg', '', L('جارٍ الفحص...', 'Checking...'));
        SET.timer = setTimeout(async () => {
            const taken = await isNickTaken(n);
            if (input.value.trim() !== n) return; // تغيّر النص أثناء الفحص
            if (taken === null) {
                setIco('', '⚠'); setNote('zs-nick-msg', 'bad', L('تعذر فحص الاسم، حاول مرة أخرى', 'Could not check the name, try again'));
                return;
            }
            if (taken) {
                setIco('bad', '✖'); setNote('zs-nick-msg', 'bad', L('الاسم مأخوذ', 'Name is taken'));
            } else {
                setIco('ok', '✔'); setNote('zs-nick-msg', 'ok', L('الاسم متاح', 'Name is available'));
                btn.disabled = false;
            }
        }, 400);
    }

    async function saveNick() {
        const input = $('zs-nick'), btn = $('zs-done');
        const n = input.value.trim();
        if (n.length < 2) return;
        btn.disabled = true;
        // فحص أخير قبل الحفظ لتفادي التعارض
        const taken = await isNickTaken(n);
        if (taken !== false) {
            setIco(taken ? 'bad' : '', taken ? '✖' : '⚠');
            setNote('zs-nick-msg', 'bad', taken ? L('الاسم مأخوذ', 'Name is taken') : L('تعذر فحص الاسم', 'Could not check the name'));
            return;
        }
        const hasArabic = /[\u0600-\u06FF]/.test(n);
        const nickAr = hasArabic ? n : '';
        const nickEn = hasArabic ? '' : n;
        const c = sdb(), uid = String(US().userId || '');
        if (c && uid) {
            const { error } = await c.from('users').upsert({
                user_id: uid, nickname_ar: nickAr || null, nickname_en: nickEn || null
            }, { onConflict: 'user_id' });
            if (error) {
                btn.disabled = false;
                if (error.code === '23505') {
                    setIco('bad', '✖');
                    setNote('zs-nick-msg', 'bad', L('الاسم مأخوذ', 'Name is taken'));
                    return;
                }
                setNote('zs-nick-msg', 'bad', L('تعذر الحفظ: ', 'Save failed: ') + error.message);
                return;
            }
        }
        if (window.userState) Object.assign(window.userState, { nickname_ar: nickAr, nickname_en: nickEn });
        LS.set('zelo_nickname_ar', nickAr);
        LS.set('zelo_nickname_en', nickEn);
        toast(L('تم حفظ الاسم المستعار ✅', 'Nickname saved ✅'));
        screenMain();
    }

    // ---------- شاشة إدخال رمز التحقق (تُستخدم مرتين: للبريد الحالي ثم الجديد) ----------
    function screenCode(opts) {
        clearTimers();
        mount(`
            <div class="zs-head">${backBtn()}</div>
            <div class="zs-body">
                <div class="zs-big">${L('لقد أرسلنا لك رمزاً', 'We sent you a code')}</div>
                <div class="zs-p">${L('أدخل رمز التحقق المرسل إلى', 'Enter the verification code sent to')} <span dir="ltr">${esc(maskEmail(opts.email))}</span></div>
                <div class="zs-box round">
                    <input id="zs-code" dir="ltr" inputmode="numeric" maxlength="8" autocomplete="one-time-code" style="text-align:center;letter-spacing:6px;" placeholder="${L('إدخال رمز التحقق', 'Enter verification code')}">
                </div>
                <div class="zset-note" id="zs-code-msg"></div>
                <div class="zs-link off" id="zs-resend"></div>
            </div>
            <div class="zs-foot"><button class="zs-pill" id="zs-confirm" disabled>${L('تأكيد', 'Confirm')}</button></div>`);
        $('zs-back').addEventListener('click', opts.onBack || screenMain);
        const code = $('zs-code'), btn = $('zs-confirm'), rs = $('zs-resend');

        code.addEventListener('input', () => {
            code.value = code.value.replace(/[^0-9]/g, '');
            btn.disabled = code.value.length < 6;
            if (code.value.length) setNote('zs-code-msg', '', '');
        });

        let left = 60;
        const paint = () => {
            if (left > 0) { rs.className = 'zs-link off'; rs.textContent = L(`ألم تستلم الرمز؟ أعد المحاولة بعد ${left}ث`, `Didn't get a code? Retry in ${left}s`); }
            else { rs.className = 'zs-link'; rs.textContent = L('ألم تستلم الرمز؟', "Didn't receive the code?"); }
        };
        const tick = () => { if (left > 0) left--; paint(); if (left <= 0) clearInterval(SET.rt); };
        paint();
        SET.rt = setInterval(tick, 1000);

        rs.addEventListener('click', async () => {
            if (left > 0) return;
            const c = sdb();
            if (!c || !c.auth) return;
            setNote('zs-code-msg', '', L('جارٍ الإرسال...', 'Sending...'));
            const r = opts.type === 'email'
                ? await c.auth.signInWithOtp({ email: opts.email, options: { shouldCreateUser: false } })
                : await c.auth.resend({ type: 'email_change', email: opts.email });
            if (r.error) { setNote('zs-code-msg', 'bad', r.error.message); return; }
            setNote('zs-code-msg', 'ok', L('تم إرسال رمز جديد ✅', 'New code sent ✅'));
            left = 60; paint(); clearInterval(SET.rt); SET.rt = setInterval(tick, 1000);
        });

        btn.addEventListener('click', async () => {
            const c = sdb();
            const token = code.value.trim();
            if (!c || !c.auth || token.length < 6) return;
            btn.disabled = true;
            setNote('zs-code-msg', '', L('جارٍ التحقق...', 'Verifying...'));
            const { error } = await c.auth.verifyOtp({ email: opts.email, token, type: opts.type });
            if (error) {
                btn.disabled = false;
                setNote('zs-code-msg', 'bad', L('الرمز خطأ', 'Incorrect code'));
                return;
            }
            clearTimers();
            opts.onOk();
        });
        setTimeout(() => code.focus(), 80);
    }

    // ---------- تغيير البريد ----------
    // 1) إرسال رمز إلى البريد الحالي  2) إدخال الرمز  3) نافذة تغيير البريد  4) رمز للبريد الجديد
    async function startEmailFlow() {
        const cur = currentEmail();
        const c = sdb();
        if (!cur) { screenEmailChange(); return; }
        if (!c || !c.auth) { toast(L('لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
        const rowBtn = $('zs-r-email'); if (rowBtn) rowBtn.disabled = true;
        toast(L('جارٍ إرسال الرمز...', 'Sending code...'));
        const { error } = await c.auth.signInWithOtp({ email: cur, options: { shouldCreateUser: false } });
        if (rowBtn) rowBtn.disabled = false;
        if (error) { toast(error.message); return; }
        screenCode({ email: cur, type: 'email', onOk: screenEmailChange, onBack: screenMain });
    }

    function screenEmailChange() {
        clearTimers();
        const cur = currentEmail();
        mount(`
            <div class="zs-head">${backBtn()}</div>
            <div class="zs-body">
                <div class="zs-big">${L('تغيير البريد الإلكتروني', 'Change email')}</div>
                ${cur ? `<div class="zs-p">${L('بريدك الإلكتروني الحالي هو', 'Your current email is')} <span dir="ltr">${esc(cur)}</span>.</div>` : ''}
                <div class="zs-box round">
                    <input id="zs-newemail" type="email" dir="ltr" inputmode="email" autocomplete="email" placeholder="${L('عنوان البريد الإلكتروني', 'Email address')}">
                </div>
                <div class="zset-note" id="zs-email-msg"></div>
            </div>
            <div class="zs-foot two">
                <button class="zs-outline" id="zs-cancel">${L('إلغاء', 'Cancel')}</button>
                <button class="zs-pill" id="zs-next" disabled>${L('التالي', 'Next')}</button>
            </div>`);
        const inp = $('zs-newemail'), next = $('zs-next');
        const valid = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
        inp.addEventListener('input', () => { next.disabled = !valid(); setNote('zs-email-msg', '', ''); });
        $('zs-back').addEventListener('click', screenMain);
        $('zs-cancel').addEventListener('click', screenMain);
        next.addEventListener('click', async () => {
            const v = inp.value.trim().toLowerCase();
            const c = sdb();
            if (!valid()) return;
            if (v === cur.toLowerCase()) { setNote('zs-email-msg', 'bad', L('هذا بريدك الحالي', 'This is your current email')); return; }
            if (!c || !c.auth) { setNote('zs-email-msg', 'bad', L('لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            next.disabled = true;
            setNote('zs-email-msg', '', L('جارٍ الإرسال...', 'Sending...'));
            const { error } = await c.auth.updateUser({ email: v });
            if (error) { next.disabled = false; setNote('zs-email-msg', 'bad', error.message); return; }
            screenCode({ email: v, type: 'email_change', onOk: () => finishEmail(v), onBack: screenEmailChange });
        });
        setTimeout(() => inp.focus(), 80);
    }

    async function finishEmail(newEmail) {
        const c = sdb(), uid = String(US().userId || '');
        try { if (c) await c.from('users').update({ email: newEmail }).eq('user_id', uid); } catch (e) {}
        if (window.userState) window.userState.email = newEmail;
        LS.set('zelo_email', newEmail);
        toast(L('تم تغيير البريد ✅', 'Email changed ✅'));
        screenMain();
    }

    // ---------- كلمة المرور ----------
    const EYE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
    const EYE_OFF = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10.5 7 10.5 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 1.5 12S5.5 19 12 19a10 10 0 0 0 4.2-.9"/><path d="M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2"/></svg>';
    const MIN_PASS = 8;

    // حقل كلمة مرور مع زر العين
    function passBox(id, placeholder) {
        return `<div class="zs-box">
            <input id="${id}" type="password" dir="ltr" autocomplete="off" placeholder="${placeholder}" style="text-align:start;">
            <button type="button" class="zs-eye" data-eye="${id}" aria-label="show">${EYE}</button>
        </div>`;
    }
    function wireEyes() {
        document.querySelectorAll('#zset [data-eye]').forEach(b => {
            b.addEventListener('click', () => {
                const inp = $(b.dataset.eye);
                if (!inp) return;
                const show = inp.type === 'password';
                inp.type = show ? 'text' : 'password';
                b.innerHTML = show ? EYE_OFF : EYE;
            });
        });
    }

    // reset = true: بعد التحقق برمز البريد (بدون كلمة المرور الحالية)
    function screenPass(reset) {
        clearTimers();
        reset = reset === true;
        const un = US().username || '';
        mount(`
            <div class="zs-head line">${backBtn()}
                <div><div class="zs-title">${L('تغيير كلمة المرور', 'Change password')}</div>${un ? `<div class="zs-sub">@${esc(un)}</div>` : ''}</div>
            </div>
            <div class="zs-body">
                ${reset ? '' : passBox('zs-pass0', L('كلمة المرور الحالية', 'Current password'))}
                ${passBox('zs-pass', L('كلمة المرور الجديدة', 'New password'))}
                <div class="zs-hint">${L(`${MIN_PASS} أحرف على الأقل`, `${MIN_PASS} characters minimum`)}</div>
                ${passBox('zs-pass2', L('تأكيد كلمة المرور', 'Confirm password'))}
                <div class="zset-note" id="zs-pass-msg"></div>
                <div style="text-align:center;margin-top:22px;">
                    <button class="zs-pill" id="zs-done" disabled>${L('تحديث كلمة المرور', 'Update password')}</button>
                </div>
                ${reset ? '' : `<div style="text-align:center;"><span class="zs-link" id="zs-forgot">${L('هل نسيت كلمة المرور؟', 'Forgot your password?')}</span></div>`}
            </div>`);
        wireEyes();
        const p0 = $('zs-pass0'), p1 = $('zs-pass'), p2 = $('zs-pass2'), btn = $('zs-done');
        const check = () => {
            const ok = (reset || p0.value.length > 0) && p1.value.length >= MIN_PASS && p1.value === p2.value;
            btn.disabled = !ok;
            if (p2.value && p1.value !== p2.value) setNote('zs-pass-msg', 'bad', L('كلمتا المرور غير متطابقتين', 'Passwords do not match'));
            else setNote('zs-pass-msg', '', '');
        };
        [p0, p1, p2].forEach(i => i && i.addEventListener('input', check));
        $('zs-back').addEventListener('click', screenMain);
        if (!reset) $('zs-forgot').addEventListener('click', screenRecover);

        btn.addEventListener('click', async () => {
            const c = sdb();
            if (!c || !c.auth) { setNote('zs-pass-msg', 'bad', L('لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            btn.disabled = true;
            setNote('zs-pass-msg', '', L('جارٍ التحديث...', 'Updating...'));
            if (!reset) {
                // التحقق من كلمة المرور الحالية
                const { error: e0 } = await c.auth.signInWithPassword({ email: currentEmail(), password: p0.value });
                if (e0) {
                    btn.disabled = false;
                    setNote('zs-pass-msg', 'bad', L('كلمة المرور الحالية غير صحيحة. إن لم تعيّن كلمة مرور من قبل فاستخدم «هل نسيت كلمة المرور؟»', 'Current password is incorrect. If you have never set one, use “Forgot your password?”'));
                    return;
                }
            }
            const { error } = await c.auth.updateUser({ password: p1.value });
            if (error) { btn.disabled = false; setNote('zs-pass-msg', 'bad', error.message); return; }
            toast(L('تم تحديث كلمة المرور ✅', 'Password updated ✅'));
            screenMain();
        });
    }

    // ---------- استعادة الحساب (نسيت كلمة المرور) ----------
    function screenRecover() {
        clearTimers();
        const envelope = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 8l8 5 8-5"/></svg>';
        mount(`
            <div class="zs-head"><button class="zs-back" id="zs-back">✕</button></div>
            <div class="zs-body">
                <div class="zs-big">${L('اختر طريقة لاستعادة حسابك', 'Choose a way to recover your account')}</div>
                <div class="zs-p">${L('سنرسل لك رمزاً لتسجيل الدخول', "We'll send you a code to sign in")}</div>
                <div class="zset-note" id="zs-rec-msg"></div>
            </div>
            <div class="zs-foot">
                <button class="zs-outline" id="zs-rec-mail" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;">${envelope}<span>${L('رمز البريد الإلكتروني', 'Email code')}</span></button>
            </div>`);
        $('zs-back').addEventListener('click', () => screenPass(false));
        $('zs-rec-mail').addEventListener('click', async () => {
            const c = sdb(), cur = currentEmail();
            if (!cur) { setNote('zs-rec-msg', 'bad', L('لا يوجد بريد مرتبط بحسابك', 'No email linked to your account')); return; }
            if (!c || !c.auth) { setNote('zs-rec-msg', 'bad', L('لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            const b = $('zs-rec-mail'); b.disabled = true;
            setNote('zs-rec-msg', '', L('جارٍ الإرسال...', 'Sending...'));
            const { error } = await c.auth.signInWithOtp({ email: cur, options: { shouldCreateUser: false } });
            if (error) { b.disabled = false; setNote('zs-rec-msg', 'bad', error.message); return; }
            screenCode({ email: cur, type: 'email', onOk: () => screenPass(true), onBack: screenRecover });
        });
    }

    function doLogout() {
        if (typeof window.logoutUser === 'function') return window.logoutUser();
        (async () => {
            if (!confirm(L('هل تريد تسجيل الخروج؟', 'Log out?'))) return;
            const c = sdb();
            try { if (c && c.auth) await c.auth.signOut(); } catch (e) {}
            try {
                const lang = localStorage.getItem('app_lang');
                Object.keys(localStorage).filter(k => k.startsWith('zelo_')).forEach(k => localStorage.removeItem(k));
                if (lang) localStorage.setItem('app_lang', lang);
            } catch (e) {}
            location.reload();
        })();
    }

    function closeSettings() {
        clearTimers();
        $('zset')?.remove();
    }

    function openSettings() {
        closeSettings();
        injectStyle();
        const box = document.createElement('div');
        box.id = 'zset';
        box.className = 'zset';
        box.dir = isAr() ? 'rtl' : 'ltr';
        document.body.appendChild(box);
        screenMain();
    }

    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
})();
