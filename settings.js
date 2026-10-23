(function () {
    'use strict';

    // ملف الإعدادات المنفصل: يوفّر window.openSettings() ويستدعيه زر الإعدادات في side-drawer.js

    const CSS = `
        .zset-toast {
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: var(--glass-bg, rgba(17, 26, 74, 0.92)); color: var(--text-main, #fff);
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            padding: 12px 20px; border-radius: 14px;
            border: 1px solid var(--gold-line, rgba(245, 195, 90, 0.45));
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            font-size: 0.85rem; font-weight: 700; z-index: 3000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zset-toast.show { opacity: 1; }

        /* ===== شاشة الإعدادات ===== */
        .zset {
            position: fixed; inset: 0; z-index: 2500;
            background: var(--bg-dark, #0a1033); color: var(--text-main, #ffffff);
            display: flex; flex-direction: column;
            padding-top: env(safe-area-inset-top, 0px);
            font-family: inherit;
            animation: zsFade 0.25s ease-out;
        }
        @keyframes zsFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .zs-head { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
        .zs-head.line {
            background: var(--glass-bg, rgba(17, 26, 74, 0.7));
            border-bottom: 1px solid var(--glass-border, rgba(245, 195, 90, 0.12));
        }
        .zs-back {
            width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
            background: rgba(245, 195, 90, 0.08); border: 1px solid var(--glass-border, rgba(245, 195, 90, 0.12));
            color: var(--accent-gold, #f5c35a); font-size: 1.2rem; cursor: pointer;
            transition: transform 0.15s ease, background 0.2s ease;
        }
        .zs-back:active { transform: scale(0.92); background: rgba(245, 195, 90, 0.18); }
        .zs-title { font-size: 1.1rem; font-weight: 900; color: var(--accent-gold, #f5c35a); }
        .zs-sub { font-size: 0.85rem; color: var(--text-muted, #9aa6d6); direction: ltr; text-align: start; }
        .zs-body { flex: 1; overflow-y: auto; padding: 14px 16px 20px; }
        .zs-foot {
            display: flex; justify-content: flex-end; gap: 10px;
            padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
            background: var(--glass-bg, rgba(17, 26, 74, 0.7));
            border-top: 1px solid var(--glass-border, rgba(245, 195, 90, 0.12));
        }
        .zs-foot.two { justify-content: space-between; }
        .zs-pill, .zs-outline {
            border-radius: 16px; padding: 14px 28px; font-weight: 900; font-size: 0.95rem;
            cursor: pointer; font-family: inherit;
            transition: transform 0.15s ease, opacity 0.15s ease, background 0.2s ease;
        }
        .zs-pill:active, .zs-outline:active { transform: scale(0.96); }
        .zs-pill {
            border: none; color: #ffffff;
            background: var(--gradient-primary, linear-gradient(135deg, #14206b, #2c4bb5, #f5c35a));
            box-shadow: var(--shadow-primary, 0 8px 24px rgba(44, 75, 181, 0.35));
        }
        .zs-outline {
            background: transparent; color: var(--accent-gold, #f5c35a);
            border: 1.5px solid var(--gold-line, rgba(245, 195, 90, 0.45));
        }
        .zs-outline:active { background: rgba(245, 195, 90, 0.08); }
        .zs-pill:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
        .zs-box {
            position: relative; display: flex; align-items: center; gap: 8px;
            background: var(--bg-card, #111a4a);
            border: 1px solid rgba(245, 195, 90, 0.25); border-radius: 14px;
            padding: 4px 14px; margin: 22px 0 6px;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .zs-box:focus-within { border-color: var(--accent-gold, #f5c35a); box-shadow: 0 0 0 3px rgba(245, 195, 90, 0.12); }
        .zs-box.off { opacity: 0.6; }
        .zs-box.round { border-radius: 18px; padding: 8px 16px; margin-top: 8px; }
        .zs-box input {
            flex: 1; min-width: 0; background: transparent; border: none; outline: none;
            color: var(--text-main, #fff); font-size: 1.05rem; font-weight: 700; padding: 12px 0; font-family: inherit;
            user-select: text; -webkit-user-select: text;
        }
        .zs-box input::placeholder { color: var(--text-muted, #9aa6d6); opacity: 0.7; font-weight: 600; }
        .zs-lbl {
            position: absolute; top: -10px; inset-inline-start: 12px;
            background: var(--bg-dark, #0a1033); padding: 0 8px; border-radius: 6px;
            font-size: 0.75rem; font-weight: 800; color: var(--accent-gold, #f5c35a);
        }
        .zs-big { font-size: 1.6rem; font-weight: 900; line-height: 1.4; margin: 26px 0 12px; color: var(--text-main, #fff); }
        .zs-p { font-size: 0.92rem; color: var(--text-muted, #9aa6d6); line-height: 1.8; margin-bottom: 16px; }
        .zs-link { font-size: 0.88rem; font-weight: 800; color: var(--accent-gold, #f5c35a); cursor: pointer; margin-top: 14px; display: inline-block; }
        .zs-link.off { color: var(--text-muted, #9aa6d6); opacity: 0.7; cursor: default; }
        .zs-row {
            width: 100%; display: flex; align-items: center; gap: 14px;
            padding: 16px 14px; margin-bottom: 12px; text-align: start;
            background: var(--bg-card, #111a4a); border: 1px solid var(--glass-border, rgba(245, 195, 90, 0.12));
            border-radius: 18px; color: var(--text-main, #fff); cursor: pointer; font-family: inherit;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .zs-row:active { transform: scale(0.98); border-color: rgba(245, 195, 90, 0.4); }
        .zs-row-ico {
            font-size: 1.15rem; width: 40px; height: 40px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(245, 195, 90, 0.08); border-radius: 12px;
        }
        .zs-row-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .zs-row-txt b { font-size: 0.95rem; font-weight: 800; }
        .zs-row-txt small { font-size: 0.78rem; color: var(--text-muted, #9aa6d6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .zs-chev { color: var(--accent-gold, #f5c35a); font-size: 1.4rem; }
        .zs-logout {
            width: 100%; margin-top: 14px; padding: 15px; border-radius: 16px; cursor: pointer;
            background: rgba(255, 107, 107, 0.1); color: #ff6b6b; font-family: inherit;
            border: 1px solid rgba(255, 107, 107, 0.4); font-weight: 900; font-size: 1rem;
            transition: transform 0.15s ease;
        }
        .zs-logout:active { transform: scale(0.97); }
        .zs-eye { background: transparent; border: none; color: var(--text-muted, #9aa6d6); cursor: pointer; padding: 6px; display: flex; align-items: center; flex-shrink: 0; }
        .zs-eye:active { color: var(--accent-gold, #f5c35a); }
        .zs-hint { font-size: 0.8rem; color: var(--text-muted, #9aa6d6); margin: 2px 2px 0; font-weight: 600; }
        .zset-ico { font-size: 1.2rem; font-weight: 900; min-width: 22px; text-align: center; }
        .zset-ico.ok { color: var(--accent-green, #14F195); }
        .zset-ico.bad { color: #ff6b6b; }
        .zset-note { font-size: 0.78rem; font-weight: 700; min-height: 1.2em; margin: 4px 2px 0; color: var(--text-muted, #9aa6d6); }
        .zset-note.ok { color: var(--accent-green, #14F195); }
        .zset-note.bad { color: #ff6b6b; }
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
            <div class="zs-head line">${backBtn()}<div class="zs-title">⚙️ ${tr('set_settings', 'الإعدادات', 'Settings')}</div></div>
            <div class="zs-body">
                ${row('zs-r-nick', '👤', tr('set_nickname', 'الاسم المستعار', 'Nickname'), currentNick())}
                ${row('zs-r-email', '✉️', tr('set_email', 'البريد الإلكتروني', 'Email'), currentEmail() || '—')}
                ${row('zs-r-pass', '🔑', tr('set_password', 'كلمة المرور', 'Password'), '••••••••')}
                <button class="zs-logout" id="zs-logout">🚪 ${tr('set_log_out', 'تسجيل الخروج', 'Log out')}</button>
                <div style="margin-top:56px;padding-top:14px;border-top:1px solid rgba(255,107,107,.25);">
                    <div style="font-size:.75rem;color:#ff9b9b;font-weight:700;margin:0 4px 10px;">⚠️ ${tr('set_danger_zone', 'منطقة الخطر', 'Danger zone')}</div>
                    <button class="zs-logout" id="zs-del-open" style="border-color:#ff6b6b;color:#ff6b6b;background:rgba(255,107,107,.08);">🗑️ ${tr('set_delete_account', 'حذف الحساب', 'Delete account')}</button>
                </div>
            </div>`);
        $('zs-back').addEventListener('click', closeSettings);
        $('zs-r-nick').addEventListener('click', screenNick);
        $('zs-r-email').addEventListener('click', startEmailFlow);
        $('zs-r-pass').addEventListener('click', () => screenPass(false));
        $('zs-logout').addEventListener('click', doLogout);
        $('zs-del-open').addEventListener('click', screenDelete);
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
                <div><div class="zs-title">${tr('set_nickname_2', 'الاسم المستعار', 'Nickname')}</div><div class="zs-sub">${esc(cur)}</div></div>
            </div>
            <div class="zs-body">
                <div class="zs-box off"><span class="zs-lbl">${tr('set_current', 'الحالي', 'Current')}</span><input value="${esc(cur)}" disabled></div>
                <div class="zs-box"><span class="zs-lbl">${tr('set_new', 'جديد', 'New')}</span>
                    <input id="zs-nick" maxlength="30" autocomplete="off" value="${esc(cur)}">
                    <span class="zset-ico" id="zs-nick-ico"></span>
                </div>
                <div class="zset-note" id="zs-nick-msg"></div>
            </div>
            <div class="zs-foot"><button class="zs-pill" id="zs-done" disabled>${tr('set_done', 'تمّ', 'Done')}</button></div>`);
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
            setIco('ok', '✔'); setNote('zs-nick-msg', 'ok', tr('set_this_is_your_current', 'هذا اسمك الحالي', 'This is your current name'));
            return;
        }
        setIco('', '…'); setNote('zs-nick-msg', '', tr('set_checking', 'جارٍ الفحص...', 'Checking...'));
        SET.timer = setTimeout(async () => {
            const taken = await isNickTaken(n);
            if (input.value.trim() !== n) return; // تغيّر النص أثناء الفحص
            if (taken === null) {
                setIco('', '⚠'); setNote('zs-nick-msg', 'bad', tr('set_could_not_check_the', 'تعذر فحص الاسم، حاول مرة أخرى', 'Could not check the name, try again'));
                return;
            }
            if (taken) {
                setIco('bad', '✖'); setNote('zs-nick-msg', 'bad', tr('set_name_is_taken', 'الاسم مأخوذ', 'Name is taken'));
            } else {
                setIco('ok', '✔'); setNote('zs-nick-msg', 'ok', tr('set_name_is_available', 'الاسم متاح', 'Name is available'));
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
            setNote('zs-nick-msg', 'bad', taken ? tr('set_name_is_taken_2', 'الاسم مأخوذ', 'Name is taken') : tr('set_could_not_check_the_2', 'تعذر فحص الاسم', 'Could not check the name'));
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
                    setNote('zs-nick-msg', 'bad', tr('set_name_is_taken_3', 'الاسم مأخوذ', 'Name is taken'));
                    return;
                }
                setNote('zs-nick-msg', 'bad', tr('set_save_failed', 'تعذر الحفظ: ', 'Save failed: ') + error.message);
                return;
            }
        }
        if (window.userState) Object.assign(window.userState, { nickname_ar: nickAr, nickname_en: nickEn });
        LS.set('zelo_nickname_ar', nickAr);
        LS.set('zelo_nickname_en', nickEn);
        toast(tr('set_nickname_saved', 'تم حفظ الاسم المستعار ✅', 'Nickname saved ✅'));
        screenMain();
    }

    // ---------- شاشة إدخال رمز التحقق (تُستخدم مرتين: للبريد الحالي ثم الجديد) ----------
    function screenCode(opts) {
        clearTimers();
        mount(`
            <div class="zs-head">${backBtn()}</div>
            <div class="zs-body">
                <div class="zs-big">${tr('set_we_sent_you_a', 'لقد أرسلنا لك رمزاً', 'We sent you a code')}</div>
                <div class="zs-p">${tr('set_enter_the_verification_code', 'أدخل رمز التحقق المرسل إلى', 'Enter the verification code sent to')} <span dir="ltr">${esc(maskEmail(opts.email))}</span></div>
                <div class="zs-box round">
                    <input id="zs-code" dir="ltr" inputmode="numeric" maxlength="8" autocomplete="one-time-code" style="text-align:center;letter-spacing:6px;" placeholder="${tr('set_enter_verification_code', 'إدخال رمز التحقق', 'Enter verification code')}">
                </div>
                <div class="zset-note" id="zs-code-msg"></div>
                <div class="zs-link off" id="zs-resend"></div>
            </div>
            <div class="zs-foot"><button class="zs-pill" id="zs-confirm" disabled>${tr('set_confirm', 'تأكيد', 'Confirm')}</button></div>`);
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
            setNote('zs-code-msg', '', tr('set_sending', 'جارٍ الإرسال...', 'Sending...'));
            const r = opts.type === 'email'
                ? await c.auth.signInWithOtp({ email: opts.email, options: { shouldCreateUser: false } })
                : await c.auth.resend({ type: 'email_change', email: opts.email });
            if (r.error) { setNote('zs-code-msg', 'bad', r.error.message); return; }
            setNote('zs-code-msg', 'ok', tr('set_new_code_sent', 'تم إرسال رمز جديد ✅', 'New code sent ✅'));
            left = 60; paint(); clearInterval(SET.rt); SET.rt = setInterval(tick, 1000);
        });

        btn.addEventListener('click', async () => {
            const c = sdb();
            const token = code.value.trim();
            if (!c || !c.auth || token.length < 6) return;
            btn.disabled = true;
            setNote('zs-code-msg', '', tr('set_verifying', 'جارٍ التحقق...', 'Verifying...'));
            const { error } = await c.auth.verifyOtp({ email: opts.email, token, type: opts.type });
            if (error) {
                btn.disabled = false;
                setNote('zs-code-msg', 'bad', tr('set_incorrect_code', 'الرمز خطأ', 'Incorrect code'));
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
        if (!c || !c.auth) { toast(tr('set_no_database_connection', 'لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
        const rowBtn = $('zs-r-email'); if (rowBtn) rowBtn.disabled = true;
        toast(tr('set_sending_code', 'جارٍ إرسال الرمز...', 'Sending code...'));
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
                <div class="zs-big">${tr('set_change_email', 'تغيير البريد الإلكتروني', 'Change email')}</div>
                ${cur ? `<div class="zs-p">${tr('set_your_current_email_is', 'بريدك الإلكتروني الحالي هو', 'Your current email is')} <span dir="ltr">${esc(cur)}</span>.</div>` : ''}
                <div class="zs-box round">
                    <input id="zs-newemail" type="email" dir="ltr" inputmode="email" autocomplete="email" placeholder="${tr('set_email_address', 'عنوان البريد الإلكتروني', 'Email address')}">
                </div>
                <div class="zset-note" id="zs-email-msg"></div>
            </div>
            <div class="zs-foot two">
                <button class="zs-outline" id="zs-cancel">${tr('set_cancel', 'إلغاء', 'Cancel')}</button>
                <button class="zs-pill" id="zs-next" disabled>${tr('set_next', 'التالي', 'Next')}</button>
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
            if (v === cur.toLowerCase()) { setNote('zs-email-msg', 'bad', tr('set_this_is_your_current_2', 'هذا بريدك الحالي', 'This is your current email')); return; }
            if (!c || !c.auth) { setNote('zs-email-msg', 'bad', tr('set_no_database_connection_2', 'لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            next.disabled = true;
            setNote('zs-email-msg', '', tr('set_sending_2', 'جارٍ الإرسال...', 'Sending...'));
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
        toast(tr('set_email_changed', 'تم تغيير البريد ✅', 'Email changed ✅'));
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
                <div><div class="zs-title">${tr('set_change_password', 'تغيير كلمة المرور', 'Change password')}</div>${un ? `<div class="zs-sub">@${esc(un)}</div>` : ''}</div>
            </div>
            <div class="zs-body">
                ${reset ? '' : passBox('zs-pass0', tr('set_current_password', 'كلمة المرور الحالية', 'Current password'))}
                ${passBox('zs-pass', tr('set_new_password', 'كلمة المرور الجديدة', 'New password'))}
                <div class="zs-hint">${L(`${MIN_PASS} أحرف على الأقل`, `${MIN_PASS} characters minimum`)}</div>
                ${passBox('zs-pass2', tr('set_confirm_password', 'تأكيد كلمة المرور', 'Confirm password'))}
                <div class="zset-note" id="zs-pass-msg"></div>
                <div style="text-align:center;margin-top:22px;">
                    <button class="zs-pill" id="zs-done" disabled>${tr('set_update_password', 'تحديث كلمة المرور', 'Update password')}</button>
                </div>
                ${reset ? '' : `<div style="text-align:center;"><span class="zs-link" id="zs-forgot">${tr('set_forgot_your_password', 'هل نسيت كلمة المرور؟', 'Forgot your password?')}</span></div>`}
            </div>`);
        wireEyes();
        const p0 = $('zs-pass0'), p1 = $('zs-pass'), p2 = $('zs-pass2'), btn = $('zs-done');
        const check = () => {
            const ok = (reset || p0.value.length > 0) && p1.value.length >= MIN_PASS && p1.value === p2.value;
            btn.disabled = !ok;
            if (p2.value && p1.value !== p2.value) setNote('zs-pass-msg', 'bad', tr('set_passwords_do_not_match', 'كلمتا المرور غير متطابقتين', 'Passwords do not match'));
            else setNote('zs-pass-msg', '', '');
        };
        [p0, p1, p2].forEach(i => i && i.addEventListener('input', check));
        $('zs-back').addEventListener('click', screenMain);
        if (!reset) $('zs-forgot').addEventListener('click', screenRecover);

        btn.addEventListener('click', async () => {
            const c = sdb();
            if (!c || !c.auth) { setNote('zs-pass-msg', 'bad', tr('set_no_database_connection_3', 'لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            btn.disabled = true;
            setNote('zs-pass-msg', '', tr('set_updating', 'جارٍ التحديث...', 'Updating...'));
            if (!reset) {
                // التحقق من كلمة المرور الحالية
                const { error: e0 } = await c.auth.signInWithPassword({ email: currentEmail(), password: p0.value });
                if (e0) {
                    btn.disabled = false;
                    setNote('zs-pass-msg', 'bad', tr('set_current_password_is_incorrect', 'كلمة المرور الحالية غير صحيحة. إن لم تعيّن كلمة مرور من قبل فاستخدم «هل نسيت كلمة المرور؟»', 'Current password is incorrect. If you have never set one, use “Forgot your password?”'));
                    return;
                }
            }
            const { error } = await c.auth.updateUser({ password: p1.value });
            if (error) { btn.disabled = false; setNote('zs-pass-msg', 'bad', error.message); return; }
            toast(tr('set_password_updated', 'تم تحديث كلمة المرور ✅', 'Password updated ✅'));
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
                <div class="zs-big">${tr('set_choose_a_way_to', 'اختر طريقة لاستعادة حسابك', 'Choose a way to recover your account')}</div>
                <div class="zs-p">${L('سنرسل لك رمزاً لتسجيل الدخول', "We'll send you a code to sign in")}</div>
                <div class="zset-note" id="zs-rec-msg"></div>
            </div>
            <div class="zs-foot">
                <button class="zs-outline" id="zs-rec-mail" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;">${envelope}<span>${tr('set_email_code', 'رمز البريد الإلكتروني', 'Email code')}</span></button>
            </div>`);
        $('zs-back').addEventListener('click', () => screenPass(false));
        $('zs-rec-mail').addEventListener('click', async () => {
            const c = sdb(), cur = currentEmail();
            if (!cur) { setNote('zs-rec-msg', 'bad', tr('set_no_email_linked_to', 'لا يوجد بريد مرتبط بحسابك', 'No email linked to your account')); return; }
            if (!c || !c.auth) { setNote('zs-rec-msg', 'bad', tr('set_no_database_connection_4', 'لا يوجد اتصال بقاعدة البيانات', 'No database connection')); return; }
            const b = $('zs-rec-mail'); b.disabled = true;
            setNote('zs-rec-msg', '', tr('set_sending_3', 'جارٍ الإرسال...', 'Sending...'));
            const { error } = await c.auth.signInWithOtp({ email: cur, options: { shouldCreateUser: false } });
            if (error) { b.disabled = false; setNote('zs-rec-msg', 'bad', error.message); return; }
            screenCode({ email: cur, type: 'email', onOk: () => screenPass(true), onBack: screenRecover });
        });
    }

    function doLogout() {
        if (typeof window.logoutUser === 'function') return window.logoutUser();
        (async () => {
            if (!confirm(tr('set_log_out_2', 'هل تريد تسجيل الخروج؟', 'Log out?'))) return;
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

    // ---------- حذف الحساب ----------
    function screenDelete() {
        clearTimers();
        const word = isAr() ? 'حذف' : 'DELETE';
        mount(`
            <div class="zs-head line">${backBtn()}<div class="zs-title">🗑️ ${tr('set_delete_account_2', 'حذف الحساب', 'Delete account')}</div></div>
            <div class="zs-body">
                <div class="zset-note" style="color:#ff9b9b;">${tr('set_your_account_predictions_and', 'سيُحذف حسابك نهائياً مع توقعاتك ورصيد ZELO، ولا يمكن التراجع عن ذلك.', 'Your account, predictions and ZELO balance will be permanently deleted. This cannot be undone.')}</div>
                <div class="zs-box">
                    <div class="zs-lbl">${tr('set_type_the_word_to', 'اكتب الكلمة للتأكيد:', 'Type the word to confirm:')} <b>${word}</b></div>
                    <input id="zs-del-input" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;background:transparent;color:#fff;border:none;outline:none;font-size:1rem;margin-top:8px;">
                </div>
                <div class="zs-foot"><button class="zs-pill" id="zs-del-confirm" disabled style="background:#e5484d;box-shadow:none;">${tr('set_delete_permanently', 'حذف نهائي', 'Delete permanently')}</button></div>
            </div>`);
        $('zs-back').addEventListener('click', screenMain);
        const inp = $('zs-del-input'), btn = $('zs-del-confirm');
        inp.addEventListener('input', () => { btn.disabled = inp.value.trim() !== word; });
        btn.addEventListener('click', doDeleteAccount);
        setTimeout(() => inp.focus(), 80);
    }

    async function doDeleteAccount() {
        const c = sdb();
        const btn = $('zs-del-confirm');
        const label = tr('set_delete_permanently_2', 'حذف نهائي', 'Delete permanently');
        if (!c || !c.functions || !c.auth) { toast(tr('set_connection_failed', 'تعذر الاتصال', 'Connection failed')); return; }
        btn.disabled = true;
        btn.textContent = '…';
        try {
            const { data: sessionData } = await c.auth.getSession();
            const token = sessionData?.session?.access_token || '';
            const { data, error } = await c.functions.invoke('delete-account', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (error || !data?.success) throw error || new Error(data?.error || 'failed');
        } catch (e) {
            btn.disabled = false;
            btn.textContent = label;
            toast(tr('set_could_not_delete_the', 'تعذر حذف الحساب، حاول لاحقاً', 'Could not delete the account, try later'));
            return;
        }
        try { await c.auth.signOut(); } catch (e) {}
        try {
            const lang = localStorage.getItem('app_lang');
            Object.keys(localStorage).filter(k => k.startsWith('zelo_')).forEach(k => localStorage.removeItem(k));
            if (lang) localStorage.setItem('app_lang', lang);
        } catch (e) {}
        location.reload();
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
