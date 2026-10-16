/* ============================================================
   rooms.js — غرف الدردشة
   ------------------------------------------------------------
   أنواع الغرف:
     1) غرف المباريات  (match_<id>)   تُفتح قبل المباراة بـ30 د وتُغلق بعدها بـ3 س
     2) غرف الأندية    (club_<id>)    دائمة
     3) غرف المستخدمين (custom_<uuid>) ينشئها المستخدم، مفتوحة وتُحذف تلقائياً بعد 6 ساعات من إنشائها،
        الانضمام برمز أو رابط أو دعوة من داخل التطبيق، ويستطيع مالكها
        حذفها في أي وقت. فيها رسائل صوتية تُحذف تلقائياً (المدة في
        جدول app_config → voice_ttl_hours، الافتراضي 6 ساعات).
   القيود الأمنية مفروضة في قاعدة البيانات (rooms.sql + rooms_custom.sql).
   ============================================================ */
(function () {
    'use strict';

    const OPEN_BEFORE_MIN = 30;
    const CLOSE_AFTER_MIN = 180;
    const MAX_LEN = 500;
    const SEND_GAP_MS = 2000;
    const PAGE_SIZE = 60;
    const MAX_DOM_MSGS = 200;
    const MAX_VOICE_SEC = 60;
    const MIN_VOICE_MS = 700;
    const AUDIO_BUCKET = 'room-audio';
    const ROOM_COLS = 'id, name, code, owner_id, emoji, expires_at';
    const EMOJIS = ['🎙️', '⚽', '🔥', '🏆', '🎧', '💬', '🦁', '🐐', '👑', '🎉', '🥅', '🧤'];
    const QUICK_EMOJIS = ['😀', '😂', '🤣', '😍', '😎', '🤔', '😮', '😢', '😡', '👏', '🙏', '👍', '🔥', '❤️', '⚽', '🥅', '🏆', '🎉', '💪', '🐐'];
    const MSG_COLS = 'id, user_id, username, body, created_at, kind, audio_path, audio_ms, expires_at';

    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const T = (key, ar, en, params) => (window.tr
        ? window.tr(key, ar, en, params)
        : String(isAr() ? ar : en).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined) ? params[k] : m));
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const me = () => String((window.userState && window.userState.userId) || '');
    const locale = () => (isAr() ? 'ar-EG' : 'en-US');

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg) {
        let el = document.getElementById('rm-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rm-toast';
            el.className = 'rm-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 2600);
    }

    const fmtTime = iso => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    };
    const fmtDur = ms => {
        const s = Math.max(0, Math.round(ms / 1000));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    };

    // رسالة خطأ مفهومة من أخطاء قاعدة البيانات
    function errText(err) {
        const m = String((err && err.message) || '');
        const map = [
            ['room_expired',   T('rmErrExpired', 'انتهت مدة هذه الغرفة', 'This room has expired')],
            ['room_limit',     T('rmErrLimit', 'وصلت للحد الأقصى: 5 غرف', 'You reached the limit: 5 rooms')],
            ['bad_name',       T('rmErrName', 'اسم الغرفة يجب أن يكون بين 2 و40 حرفاً', 'Room name must be 2–40 characters')],
            ['room_not_found', T('rmErrNotFound', 'لا توجد غرفة بهذا الرمز', 'No room with this code')],
            ['room_full',      T('rmErrFull', 'الغرفة ممتلئة', 'The room is full')],
            ['user_not_found', T('rmErrUser', 'المستخدم غير موجود', 'User not found')],
            ['not_member',     T('rmErrMember', 'لست عضواً في هذه الغرفة', 'You are not a member of this room')],
            ['slow_down',      T('rmSlow', 'مهلاً، أرسل ببطء قليلاً', 'Slow down a little')],
            ['room_closed',    T('rmClosed', 'هذه الغرفة مغلقة حالياً', 'This room is closed right now')],
            ['bad_voice',      T('rmVoiceFail', 'تعذر إرسال الرسالة الصوتية', 'Could not send the voice message')]
        ];
        for (const [k, v] of map) if (m.includes(k)) return v;
        return T('rmError', 'تعذر تنفيذ الإجراء', 'Action failed');
    }

    /* ---------------- أنماط ---------------- */
    function ensureCss() {
        if (document.getElementById('rm-css')) return;
        const st = document.createElement('style');
        st.id = 'rm-css';
        st.textContent = `
        .rm-title { margin:0 0 14px; font-size:1.35rem; font-weight:900; text-align:center;
            background:linear-gradient(135deg,#2AABEE,#8B5CF6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .rm-tabs { display:flex; gap:6px; margin-bottom:14px; }
        .rm-tab { flex:1; padding:10px 4px; border-radius:14px; font-weight:800; font-size:.78rem; cursor:pointer;
            background:rgba(255,255,255,.06); color:#94a3b8; border:1px solid rgba(255,255,255,.08); }
        .rm-tab.on { color:#00FF87; border-color:rgba(0,255,135,.4); background:rgba(0,255,135,.08); }
        .rm-actions { display:flex; gap:8px; margin-bottom:14px; }
        .rm-actions button { flex:1; padding:12px 6px; border-radius:14px; font-weight:800; font-size:.85rem; cursor:pointer;
            color:#2AABEE; background:rgba(42,171,238,.12); border:1px solid rgba(42,171,238,.4); }
        .rm-card { display:flex; align-items:center; gap:12px; padding:12px 14px; margin-bottom:10px; cursor:pointer;
            background:linear-gradient(135deg,rgba(20,22,48,.95),rgba(12,14,32,.95));
            border:1px solid rgba(90,110,255,.3); border-radius:18px; }
        .rm-card:active { transform:scale(.985); }
        .rm-card .logo { width:42px; height:42px; min-width:42px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; }
        .rm-card .logo img { width:38px; height:38px; object-fit:contain; }
        .rm-card .info { flex:1; min-width:0; text-align:start; }
        .rm-card .name { color:#fff; font-weight:800; font-size:.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rm-card .sub { color:#94a3b8; font-size:.74rem; margin-top:3px; font-weight:700; }
        .rm-chip { font-size:.7rem; font-weight:800; padding:3px 9px; border-radius:9px; flex-shrink:0; }
        .rm-chip.open { color:#00FF87; background:rgba(0,255,135,.1); border:1px solid rgba(0,255,135,.35); }
        .rm-chip.soon { color:#fcb045; background:rgba(252,176,69,.1); border:1px solid rgba(252,176,69,.35); }
        .rm-chip.club { color:#2AABEE; background:rgba(42,171,238,.1); border:1px solid rgba(42,171,238,.35); }
        .rm-empty { text-align:center; padding:36px 16px; color:#94a3b8; font-weight:700; font-size:.88rem;
            background:rgba(20,22,48,.8); border:1px solid rgba(90,110,255,.3); border-radius:16px; }
        .rm-search { width:100%; box-sizing:border-box; padding:11px 14px; margin-bottom:12px; border-radius:14px; font-size:16px;
            background:#12142a; color:#fff; border:1px solid rgba(255,255,255,.12); outline:none;
            -webkit-user-select:text; user-select:text; }
        .rm-sec { color:#94a3b8; font-size:.78rem; font-weight:800; margin:10px 2px 8px; }

        .rm-overlay { position:fixed; inset:0; z-index:100010; background:#121215; color:#f8fafc;
            display:flex; flex-direction:column; }
        .rm-head { display:flex; align-items:center; gap:10px; padding:12px 14px; flex-shrink:0;
            background:rgba(18,18,22,.95); border-bottom:1px solid rgba(252,176,69,.25); }
        .rm-hbtn { width:38px; height:38px; border-radius:50%; font-size:1.1rem; cursor:pointer; flex-shrink:0;
            background:rgba(255,255,255,.08); color:#fff; border:1px solid rgba(255,255,255,.12); }
        .rm-head .t { flex:1; min-width:0; text-align:start; }
        .rm-head .t b { display:block; font-size:1rem; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rm-head .t span { font-size:.72rem; color:#00FF87; font-weight:700; }
        .rm-list { flex:1; overflow-y:auto; padding:12px 12px 6px; -webkit-overflow-scrolling:touch; }
        .rm-note { text-align:center; color:#7b8296; font-size:.72rem; font-weight:700; margin:4px 0 12px; }
        .rm-msg { display:flex; gap:8px; margin-bottom:10px; align-items:flex-start; }
        .rm-msg.mine { flex-direction:row-reverse; }
        .rm-av { width:34px; height:34px; min-width:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-weight:900; color:#fff; background:linear-gradient(135deg,#2AABEE,#8B5CF6); }
        .rm-bub { max-width:78%; min-width:150px; padding:8px 12px; border-radius:16px; text-align:start;
            background:rgba(28,28,40,.95); border:1px solid rgba(255,255,255,.08); }
        .rm-msg.mine .rm-bub { background:linear-gradient(135deg,rgba(42,171,238,.25),rgba(139,92,246,.2)); border-color:rgba(42,171,238,.4); }
        .rm-meta { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
        .rm-user { color:#7CF7C4; font-size:.74rem; font-weight:800; direction:ltr; }
        .rm-time { color:#7b8296; font-size:.66rem; font-weight:700; }
        .rm-more { margin-inline-start:auto; background:none; color:#94a3b8; font-size:1rem; cursor:pointer; padding:0 2px; }
        .rm-text { font-size:.92rem; line-height:1.5; word-break:break-word; white-space:pre-wrap;
            -webkit-user-select:text; user-select:text; }
        .rm-voice { display:flex; align-items:center; gap:10px; padding:4px 0; direction:ltr; }
        .rm-play { width:38px; height:38px; border-radius:50%; flex-shrink:0; font-size:1rem; cursor:pointer; color:#fff;
            background:linear-gradient(135deg,#2AABEE,#8B5CF6); }
        .rm-bar { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; }
        .rm-bar i { display:block; height:100%; width:0; background:#00FF87; transition:width .2s linear; }
        .rm-dur { font-size:.74rem; color:#b6bdd0; font-weight:700; font-variant-numeric:tabular-nums; min-width:34px; text-align:end; }
        .rm-exp { color:#7b8296; font-size:.64rem; font-weight:700; margin-top:2px; }

        .rm-compose { display:flex; align-items:center; gap:8px; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); flex-shrink:0;
            background:rgba(18,18,22,.95); border-top:1px solid rgba(255,255,255,.08); }
        .rm-input { flex:1; min-width:0; padding:12px 14px; border-radius:22px; font-size:16px; outline:none;
            background:#12142a; color:#fff; border:1px solid rgba(255,255,255,.14);
            -webkit-user-select:text; user-select:text; }
        .rm-send, .rm-mic { width:46px; height:46px; border-radius:50%; font-size:1.2rem; cursor:pointer; flex-shrink:0; color:#fff;
            background:linear-gradient(135deg,#2AABEE,#8B5CF6); }
        .rm-mic { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.15); }
        .rm-send:disabled { opacity:.5; }
        .rm-recbar { display:none; flex:1; align-items:center; gap:12px; }
        .rm-compose.recording > :not(.rm-recbar) { display:none; }
        .rm-compose.recording .rm-recbar { display:flex; }
        .rm-rc-cancel { width:46px; height:46px; border-radius:50%; font-size:1.2rem; cursor:pointer; flex-shrink:0;
            background:rgba(255,77,77,.15); border:1px solid rgba(255,77,77,.4); color:#ff6b6b; }
        .rm-rec-info { flex:1; display:flex; align-items:center; gap:8px; font-weight:800; font-variant-numeric:tabular-nums; }
        .rm-rec-dot { color:#ff4d4d; animation:rmBlink 1s infinite; }
        @keyframes rmBlink { 50% { opacity:.2; } }

        .rm-sheet { position:fixed; inset:0; z-index:100015; background:rgba(0,0,0,.6); display:flex; align-items:flex-end; }
        .rm-sheet.center { align-items:center; padding:20px; box-sizing:border-box; }
        .rm-sheet > div { width:100%; padding:14px 14px calc(14px + env(safe-area-inset-bottom)); background:#1c1c22;
            border-radius:20px 20px 0 0; border-top:1px solid rgba(252,176,69,.25); max-height:80vh; overflow-y:auto; }
        .rm-sheet.center > div { border-radius:20px; border:1px solid rgba(252,176,69,.25); padding:18px; max-width:420px; margin:0 auto; }
        .rm-sheet button { display:block; width:100%; padding:14px; margin-bottom:8px; border-radius:14px; font-size:1rem; font-weight:800; cursor:pointer;
            background:rgba(255,255,255,.07); color:#fff; border:1px solid rgba(255,255,255,.1); }
        .rm-sheet button.danger { color:#ff6b6b; }
        .rm-sheet button.primary { background:linear-gradient(135deg,#2AABEE,#8B5CF6); border:none; }
        .rm-mt { margin:0 0 12px; text-align:center; font-size:1.05rem; font-weight:900; color:#fcb045; }
        .rm-mp { margin:0 0 14px; text-align:center; font-size:.88rem; color:#cbd5e1; line-height:1.6; }
        .rm-urow { display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid rgba(255,255,255,.06); }
        .rm-urow .n { flex:1; font-weight:800; direction:ltr; text-align:start; }
        .rm-urow button { width:auto; margin:0; padding:7px 14px; font-size:.82rem; }
        .rm-toast { position:fixed; bottom:110px; left:50%; transform:translateX(-50%); z-index:100020; max-width:86%;
            background:rgba(28,28,34,.97); color:#fff; padding:10px 18px; border-radius:12px; text-align:center;
            border:1px solid rgba(252,176,69,.3); font-size:.85rem; opacity:0; transition:opacity .25s; pointer-events:none; }
        .rm-pick { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; margin-bottom:12px; }
        .rm-sheet .rm-pick button { margin:0; padding:8px 0; font-size:1.4rem; border-radius:12px; }
        .rm-sheet .rm-pick button.on { border-color:#00FF87; background:rgba(0,255,135,.12); }
        .rm-quick { display:flex; flex-wrap:wrap; gap:6px; padding:8px 12px 0; max-height:110px; overflow-y:auto; flex-shrink:0; background:rgba(18,18,22,.95); }
        .rm-quick button { font-size:1.3rem; padding:4px 10px; border-radius:14px; flex-shrink:0; cursor:pointer;
            background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); }
        .rm-count { flex-shrink:0; font-size:.78rem; font-weight:800; color:#00FF87; padding:4px 9px; border-radius:12px;
            background:rgba(0,255,135,.1); border:1px solid rgba(0,255,135,.35); font-variant-numeric:tabular-nums; }
        .rm-handle { position:fixed; top:50%; transform:translateY(-50%); width:22px; height:64px; z-index:100000; padding:0;
            font-size:.8rem; cursor:pointer; color:#fff; border:none; opacity:.85;
            background:linear-gradient(135deg,rgba(42,171,238,.9),rgba(139,92,246,.9)); }
        .rm-handle.right { right:0; border-radius:12px 0 0 12px; }
        .rm-handle.left { left:0; border-radius:0 12px 12px 0; }
        .rm-drawer-bg { position:fixed; inset:0; z-index:100005; background:rgba(0,0,0,.55); }
        .rm-drawer { position:absolute; top:0; bottom:0; width:min(82vw,320px); box-sizing:border-box; overflow-y:auto; color:#f8fafc;
            padding:16px 14px calc(16px + env(safe-area-inset-bottom)); background:#17171d; border:1px solid rgba(252,176,69,.25); }
        .rm-drawer.from-right { right:0; border-radius:20px 0 0 20px; animation:rmInR .22s ease-out; }
        .rm-drawer.from-left { left:0; border-radius:0 20px 20px 0; animation:rmInL .22s ease-out; }
        @keyframes rmInR { from { transform:translateX(100%); } to { transform:none; } }
        @keyframes rmInL { from { transform:translateX(-100%); } to { transform:none; } }
        .rm-dr-create { display:block; width:100%; padding:13px; margin-top:10px; border-radius:14px; font-weight:800; font-size:.95rem;
            cursor:pointer; color:#fff; border:none; background:linear-gradient(135deg,#2AABEE,#8B5CF6); }
        .rm-toast.show { opacity:1; }`;
        document.head.appendChild(st);
    }

    /* ---------------- نوافذ صغيرة ---------------- */
    function askText(title, placeholder, okLabel, opts) {
        opts = opts || {};
        return new Promise(resolve => {
            const el = document.createElement('div');
            el.className = 'rm-sheet center';
            el.dir = isAr() ? 'rtl' : 'ltr';
            el.innerHTML = `<div>
                <h3 class="rm-mt">${esc(title)}</h3>
                <input class="rm-search" id="rm-ask" maxlength="${opts.max || 60}" placeholder="${esc(placeholder)}"
                       autocomplete="off" ${opts.upper ? 'style="text-transform:uppercase;letter-spacing:3px;text-align:center"' : ''}>
                <button class="primary" data-do="ok">${esc(okLabel)}</button>
                <button data-do="cancel">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
            </div>`;
            document.body.appendChild(el);
            const inp = el.querySelector('#rm-ask');
            setTimeout(() => inp.focus(), 60);
            const done = v => { el.remove(); resolve(v); };
            el.addEventListener('click', e => {
                if (e.target === el) return done(null);
                const b = e.target.closest('[data-do]');
                if (b) done(b.dataset.do === 'ok' ? inp.value.trim() : null);
            });
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(inp.value.trim()); });
        });
    }

    function askRoom() {
        return new Promise(resolve => {
            let emoji = EMOJIS[0];
            const el = document.createElement('div');
            el.className = 'rm-sheet center';
            el.dir = isAr() ? 'rtl' : 'ltr';
            el.innerHTML = `<div>
                <h3 class="rm-mt">${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</h3>
                <div class="rm-pick">${EMOJIS.map(e => `<button type="button" data-e="${e}" class="${e === emoji ? 'on' : ''}">${e}</button>`).join('')}</div>
                <input class="rm-search" id="rm-ask" maxlength="40" autocomplete="off"
                       placeholder="${esc(T('rmCreatePh', 'اسم الغرفة', 'Room name'))}">
                <p class="rm-mp" style="margin:0 0 12px;font-size:.78rem">⏳ ${T('rmTtlNote', 'تُحذف الغرفة تلقائياً بعد 6 ساعات من إنشائها', 'The room is deleted automatically 6 hours after it is created')}</p>
                <button class="primary" data-do="ok">${T('rmCreateBtn', 'إنشاء', 'Create')}</button>
                <button data-do="cancel">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
            </div>`;
            document.body.appendChild(el);
            const inp = el.querySelector('#rm-ask');
            setTimeout(() => inp.focus(), 60);
            const done = v => { el.remove(); resolve(v); };
            el.addEventListener('click', e => {
                if (e.target === el) return done(null);
                const pick = e.target.closest('[data-e]');
                if (pick) {
                    emoji = pick.dataset.e;
                    el.querySelectorAll('[data-e]').forEach(b => b.classList.toggle('on', b === pick));
                    return;
                }
                const b = e.target.closest('[data-do]');
                if (b) done(b.dataset.do === 'ok' && inp.value.trim() ? { name: inp.value.trim(), emoji } : null);
            });
            inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) done({ name: inp.value.trim(), emoji }); });
        });
    }

    function askConfirm(text, okLabel, danger) {
        return new Promise(resolve => {
            const el = document.createElement('div');
            el.className = 'rm-sheet center';
            el.dir = isAr() ? 'rtl' : 'ltr';
            el.innerHTML = `<div>
                <p class="rm-mp">${esc(text)}</p>
                <button class="${danger ? 'danger' : 'primary'}" data-do="ok">${esc(okLabel)}</button>
                <button data-do="cancel">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
            </div>`;
            document.body.appendChild(el);
            const done = v => { el.remove(); resolve(v); };
            el.addEventListener('click', e => {
                if (e.target === el) return done(false);
                const b = e.target.closest('[data-do]');
                if (b) done(b.dataset.do === 'ok');
            });
        });
    }

    function actionSheet(buttons) {
        const sheet = document.createElement('div');
        sheet.className = 'rm-sheet';
        sheet.dir = isAr() ? 'rtl' : 'ltr';
        sheet.innerHTML = `<div>
            ${buttons.map((b, i) => `<button class="${b.danger ? 'danger' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}
            <button data-i="-1">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
        </div>`;
        document.body.appendChild(sheet);
        sheet.addEventListener('click', e => {
            if (e.target === sheet) { sheet.remove(); return; }
            const b = e.target.closest('[data-i]');
            if (!b) return;
            sheet.remove();
            const i = Number(b.dataset.i);
            if (i >= 0 && buttons[i].run) buttons[i].run();
        });
    }

    function copyText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
                return;
            }
        } catch (e) { /* ننتقل للبديل */ }
        fallbackCopy(text);
    }
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
    }

    /* ---------------- حالة الغرفة الحالية ---------------- */
    const cur = {
        roomId: null, channel: null, ids: new Set(), blocked: new Set(), lastSend: 0,
        overlay: null, custom: null, audio: null, tick: null,
        rec: null, recStream: null, recChunks: [], recStart: 0, recTimer: null, recCancelled: false,
        expTimer: null, pres: null
    };

    function roomState(matchDate) {
        const t = new Date(matchDate).getTime();
        if (!isFinite(t)) return 'ended';
        const now = Date.now();
        if (now < t - OPEN_BEFORE_MIN * 60000) return 'soon';
        if (now > t + CLOSE_AFTER_MIN * 60000) return 'ended';
        return 'open';
    }

    async function loadBlocked() {
        cur.blocked = new Set();
        const c = db();
        if (!c || !me()) return;
        try {
            const r = await c.from('user_blocks').select('blocked_id').eq('user_id', me());
            (r.data || []).forEach(x => cur.blocked.add(String(x.blocked_id)));
        } catch (e) { /* الجدول اختياري */ }
    }

    /* ---------------- عرض الرسائل ---------------- */
    function expLabel(iso) {
        const ms = new Date(iso).getTime() - Date.now();
        if (!isFinite(ms) || ms <= 0) return '';
        const h = Math.floor(ms / 3600000);
        const m = Math.ceil((ms % 3600000) / 60000);
        const t = h > 0 ? (isAr() ? `${h}س ${m}د` : `${h}h ${m}m`) : (isAr() ? `${m}د` : `${m}m`);
        return T('rmExpires', '⏳ تُحذف خلال {t}', '⏳ Deleted in {t}', { t });
    }

    function msgHtml(m) {
        const mine = String(m.user_id) === me();
        const name = m.username || 'fan';
        const isVoice = m.kind === 'voice' && m.audio_path;
        const content = isVoice
            ? `<div class="rm-voice" data-path="${esc(m.audio_path)}" data-ms="${esc(m.audio_ms || 0)}">
                   <button class="rm-play" data-act="play">▶</button>
                   <div class="rm-bar"><i></i></div>
                   <span class="rm-dur">${esc(fmtDur(m.audio_ms || 0))}</span>
               </div>
               <div class="rm-exp">${esc(expLabel(m.expires_at))}</div>`
            : `<div class="rm-text" dir="auto">${esc(m.body)}</div>`;
        return `
        <div class="rm-msg ${mine ? 'mine' : ''}" data-id="${esc(m.id)}" data-uid="${esc(m.user_id)}"
             ${m.expires_at ? `data-exp="${esc(m.expires_at)}"` : ''}>
            <div class="rm-av">${esc(String(name).charAt(0).toUpperCase())}</div>
            <div class="rm-bub">
                <div class="rm-meta">
                    <span class="rm-user">@${esc(name)}</span>
                    <span class="rm-time">${esc(fmtTime(m.created_at))}</span>
                    <button class="rm-more" data-act="menu">⋮</button>
                </div>
                ${content}
            </div>
        </div>`;
    }

    function addMessage(m, listEl) {
        if (!m || cur.ids.has(m.id)) return;
        if (cur.blocked.has(String(m.user_id))) return;
        if (m.expires_at && new Date(m.expires_at).getTime() <= Date.now()) return;
        cur.ids.add(m.id);
        const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;
        listEl.insertAdjacentHTML('beforeend', msgHtml(m));
        while (listEl.querySelectorAll('.rm-msg').length > MAX_DOM_MSGS) {
            listEl.querySelector('.rm-msg')?.remove();
        }
        if (nearBottom || String(m.user_id) === me()) listEl.scrollTop = listEl.scrollHeight;
    }

    // كل 30 ثانية: نزيل الرسائل الصوتية المنتهية ونحدّث عدّاد الحذف
    function startTick(listEl) {
        clearInterval(cur.tick);
        cur.tick = setInterval(() => {
            listEl.querySelectorAll('.rm-msg[data-exp]').forEach(el => {
                const left = new Date(el.dataset.exp).getTime() - Date.now();
                if (left <= 0) {
                    if (cur.audio && cur.audio.wrap && el.contains(cur.audio.wrap)) stopAudio();
                    el.remove();
                } else {
                    const x = el.querySelector('.rm-exp');
                    if (x) x.textContent = expLabel(el.dataset.exp);
                }
            });
        }, 30000);
    }

    /* ---------------- تشغيل الصوت ---------------- */
    function stopAudio() {
        if (!cur.audio) return;
        try { cur.audio.el.pause(); } catch (e) {}
        const { btn, wrap } = cur.audio;
        if (btn) btn.textContent = '▶';
        const bar = wrap && wrap.querySelector('.rm-bar i');
        if (bar) bar.style.width = '0';
        cur.audio = null;
    }

    async function playVoice(btn) {
        const wrap = btn.closest('.rm-voice');
        if (!wrap) return;
        const path = wrap.dataset.path;

        if (cur.audio && cur.audio.path === path) {
            if (cur.audio.el.paused) cur.audio.el.play().catch(() => {});
            else cur.audio.el.pause();
            return;
        }
        stopAudio();

        const c = db();
        if (!c) return;
        btn.textContent = '⏳';
        try {
            const { data, error } = await c.storage.from(AUDIO_BUCKET).createSignedUrl(path, 600);
            if (error || !data) throw error || new Error('no url');
            const el = new Audio(data.signedUrl);
            const totalSec = Math.max(1, Number(wrap.dataset.ms) / 1000);
            const bar = wrap.querySelector('.rm-bar i');
            cur.audio = { el, path, btn, wrap };
            el.addEventListener('play', () => { btn.textContent = '⏸'; });
            el.addEventListener('pause', () => { btn.textContent = '▶'; });
            el.addEventListener('ended', () => { btn.textContent = '▶'; if (bar) bar.style.width = '0'; cur.audio = null; });
            el.addEventListener('timeupdate', () => { if (bar) bar.style.width = Math.min(100, (el.currentTime / totalSec) * 100) + '%'; });
            el.addEventListener('error', () => { toast(T('rmVoiceFail', 'تعذر تشغيل الصوت', 'Could not play audio')); stopAudio(); });
            await el.play();
        } catch (err) {
            console.error('[rooms] play failed:', err);
            btn.textContent = '▶';
            cur.audio = null;
            toast(T('rmVoiceFail', 'تعذر تشغيل الصوت', 'Could not play audio'));
        }
    }

    /* ---------------- تسجيل الصوت وإرساله ---------------- */
    function cleanupRecording() {
        clearInterval(cur.recTimer);
        cur.recTimer = null;
        if (cur.recStream) { cur.recStream.getTracks().forEach(t => t.stop()); cur.recStream = null; }
        cur.rec = null;
        cur.recChunks = [];
        cur.overlay?.querySelector('#rm-compose')?.classList.remove('recording');
    }

    async function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            toast(T('rmNoMic', 'التسجيل الصوتي غير مدعوم على هذا الجهاز', 'Voice recording is not supported on this device'));
            return;
        }
        stopAudio();
        try {
            cur.recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            toast(T('rmMicDenied', 'اسمح للتطبيق باستخدام الميكروفون', 'Allow the app to use the microphone'));
            return;
        }
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
            .find(t => MediaRecorder.isTypeSupported(t)) || '';
        try {
            cur.rec = new MediaRecorder(cur.recStream, mime ? { mimeType: mime } : undefined);
        } catch (e) {
            cleanupRecording();
            toast(T('rmNoMic', 'التسجيل الصوتي غير مدعوم على هذا الجهاز', 'Voice recording is not supported on this device'));
            return;
        }
        cur.recChunks = [];
        cur.recCancelled = false;
        cur.rec.ondataavailable = e => { if (e.data && e.data.size) cur.recChunks.push(e.data); };
        cur.rec.start();
        cur.recStart = Date.now();

        const compose = cur.overlay.querySelector('#rm-compose');
        const timeEl = cur.overlay.querySelector('#rm-rec-time');
        compose.classList.add('recording');
        timeEl.textContent = '0:00';
        cur.recTimer = setInterval(() => {
            const ms = Date.now() - cur.recStart;
            timeEl.textContent = fmtDur(ms);
            if (ms >= MAX_VOICE_SEC * 1000) finishRecording(true);
        }, 250);
    }

    function finishRecording(send) {
        const rec = cur.rec;
        if (!rec) return;
        const started = cur.recStart;
        const chunks = cur.recChunks;
        const mimeFull = rec.mimeType || 'audio/webm';
        cur.recCancelled = !send;

        rec.onstop = async () => {
            const ms = Date.now() - started;
            const cancelled = cur.recCancelled;
            const blob = new Blob(chunks, { type: mimeFull });
            cleanupRecording();
            if (cancelled) return;
            if (ms < MIN_VOICE_MS) { toast(T('rmTooShort', 'التسجيل قصير جداً', 'Recording is too short')); return; }
            await sendVoice(blob, mimeFull, ms);
        };
        try { rec.stop(); } catch (e) { cleanupRecording(); }
    }

    async function sendVoice(blob, mimeFull, ms) {
        const c = db();
        if (!c || !cur.custom || !cur.overlay) return;
        const now = Date.now();
        if (now - cur.lastSend < SEND_GAP_MS) { toast(T('rmSlow', 'مهلاً، أرسل ببطء قليلاً', 'Slow down a little')); return; }
        cur.lastSend = now;

        const base = mimeFull.split(';')[0];
        const ext = base.includes('ogg') ? 'ogg' : base.includes('mp4') ? 'm4a' : 'webm';
        const path = `${cur.custom.id}/${me()}/${Date.now()}.${ext}`;
        const listEl = cur.overlay.querySelector('#rm-list');

        toast(T('rmSendingVoice', '⏳ جاري إرسال الرسالة الصوتية...', '⏳ Sending voice message...'));
        try {
            const up = await c.storage.from(AUDIO_BUCKET).upload(path, blob, { contentType: base, upsert: false });
            if (up.error) throw up.error;

            const { data, error } = await c.from('room_messages')
                .insert([{ room_id: cur.roomId, user_id: me(), kind: 'voice', body: '🎤', audio_path: path, audio_ms: Math.round(ms) }])
                .select(MSG_COLS).single();
            if (error) {
                c.storage.from(AUDIO_BUCKET).remove([path]).catch(() => {});
                throw error;
            }
            addMessage(data, listEl);
        } catch (err) {
            console.error('[rooms] voice send failed:', err);
            toast(errText(err));
        }
    }

    /* ---------------- قائمة إجراءات الرسالة ---------------- */
    function openMsgMenu(msgEl) {
        const id = msgEl.dataset.id;
        const uid = msgEl.dataset.uid;
        const mine = uid === me();
        const isOwner = !!(cur.custom && String(cur.custom.owner_id) === me());
        const list = [];

        if (mine || isOwner) {
            list.push({ label: '🗑 ' + (mine ? T('rmDelete', 'حذف رسالتي', 'Delete my message') : T('rmDeleteMod', 'حذف الرسالة (المالك)', 'Delete message (owner)')), danger: true,
                run: async () => {
                    const c = db(); if (!c) return;
                    const { error } = await c.from('room_messages').delete().eq('id', id);
                    if (error) { console.error(error); toast(errText(error)); return; }
                    msgEl.remove();
                } });
        }
        if (!mine) {
            list.push({ label: '🚩 ' + T('rmReport', 'إبلاغ عن الرسالة', 'Report message'),
                run: async () => {
                    const c = db(); if (!c) return;
                    const { error } = await c.from('room_reports').insert([{ reporter_id: me(), message_id: Number(id), reason: 'abuse' }]);
                    if (error && !String(error.message).includes('duplicate')) { console.error(error); toast(errText(error)); return; }
                    toast(T('rmReported', 'تم إرسال البلاغ، شكراً لك', 'Report sent, thank you'));
                } });
            list.push({ label: '⛔ ' + T('rmBlock', 'حظر هذا المستخدم', 'Block this user'), danger: true,
                run: async () => {
                    const c = db(); if (!c) return;
                    const { error } = await c.from('user_blocks').insert([{ user_id: me(), blocked_id: uid }]);
                    if (error && !String(error.message).includes('duplicate')) { console.error(error); toast(errText(error)); return; }
                    cur.blocked.add(String(uid));
                    cur.overlay?.querySelectorAll('.rm-msg').forEach(el => { if (el.dataset.uid === uid) el.remove(); });
                    toast(T('rmBlocked', 'تم حظر المستخدم', 'User blocked'));
                } });
        }
        if (list.length) actionSheet(list);
    }

    // يحدّث عدّاد الحذف ويغلق الغرفة عند انتهاء مدتها
    function startExpiryWatch() {
        clearInterval(cur.expTimer);
        if (!cur.custom || !cur.custom.expires_at) return;
        const draw = () => {
            if (!cur.custom) return;
            const left = new Date(cur.custom.expires_at).getTime() - Date.now();
            if (left <= 0) {
                toast(T('rmRoomExpired', 'انتهت مدة الغرفة وتم حذفها', 'The room time is over and it was deleted'));
                closeRoom();
                return;
            }
            const sub = cur.overlay && cur.overlay.querySelector('#rm-sub');
            if (sub) sub.textContent = '🔑 ' + cur.custom.code + ' · ' + expLabel(cur.custom.expires_at);
        };
        draw();
        cur.expTimer = setInterval(draw, 30000);
    }

    /* ---------------- فتح / إغلاق الغرفة ---------------- */
    function closeRoom() {
        clearInterval(cur.expTimer);
        cur.expTimer = null;
        stopPresence();
        stopAudio();
        if (cur.rec) { cur.recCancelled = true; try { cur.rec.stop(); } catch (e) {} }
        cleanupRecording();
        clearInterval(cur.tick);
        cur.tick = null;
        if (cur.channel && db()) { try { db().removeChannel(cur.channel); } catch (e) {} }
        cur.channel = null;
        cur.roomId = null;
        cur.custom = null;
        cur.ids = new Set();
        cur.overlay?.remove();
        cur.overlay = null;
    }

    async function openRoom(opts) {
        ensureCss();
        const c = db();
        if (!c || !me()) { toast(T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')); return; }
        if (cur.overlay) closeRoom();

        cur.roomId = opts.roomId;
        cur.custom = opts.custom || null;
        cur.ids = new Set();

        const isCustom = !!cur.custom;
        const ov = document.createElement('div');
        ov.className = 'rm-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.innerHTML = `
            <div class="rm-head">
                <button class="rm-hbtn" data-act="back">${isAr() ? '➡️' : '⬅️'}</button>
                <div class="t"><b>${esc(opts.title)}</b><span id="rm-sub">${esc(opts.sub || '')}</span></div>
                <span class="rm-count" id="rm-count">👥 1</span>
                ${isCustom ? '<button class="rm-hbtn" data-act="share">📤</button><button class="rm-hbtn" data-act="room-menu">⋮</button>' : ''}
            </div>
            <div class="rm-list" id="rm-list">
                <div class="rm-note">${T('rmRules', 'كن محترماً. الإساءة والروابط المشبوهة تؤدي للحظر.', 'Be respectful. Abuse and suspicious links get you blocked.')}</div>
            </div>
            ${isCustom ? `<div class="rm-quick" id="rm-quick" style="display:none">${QUICK_EMOJIS.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>` : ''}
            <div class="rm-compose" id="rm-compose">
                ${isCustom ? '<button class="rm-mic" id="rm-mic">🎤</button>' : ''}
                <button class="rm-mic" id="rm-emo">😊</button>
                <input class="rm-input" id="rm-input" maxlength="${MAX_LEN}" autocomplete="off"
                       placeholder="${esc(T('rmPlaceholder', 'اكتب رسالة...', 'Write a message...'))}">
                <button class="rm-send" id="rm-send">➤</button>
                <div class="rm-recbar">
                    <button class="rm-rc-cancel" id="rm-rc-cancel">🗑</button>
                    <div class="rm-rec-info"><span class="rm-rec-dot">●</span><span id="rm-rec-time">0:00</span></div>
                    <button class="rm-send" id="rm-rc-send">➤</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        cur.overlay = ov;

        const listEl = ov.querySelector('#rm-list');
        const input = ov.querySelector('#rm-input');
        const sendBtn = ov.querySelector('#rm-send');

        ov.querySelector('[data-act="back"]').addEventListener('click', closeRoom);
        ov.querySelector('[data-act="room-menu"]')?.addEventListener('click', () => openRoomMenu());
        ov.querySelector('[data-act="share"]')?.addEventListener('click', () => { if (cur.custom) shareRoom(cur.custom); });
        const quick = ov.querySelector('#rm-quick');
        ov.querySelector('#rm-emo')?.addEventListener('click', () => {
            quick.style.display = quick.style.display === 'none' ? 'flex' : 'none';
        });
        quick?.addEventListener('click', e => {
            const b = e.target.closest('[data-emo]');
            if (!b) return;
            const i = ov.querySelector('#rm-input');
            const pos = i.selectionStart == null ? i.value.length : i.selectionStart;
            i.value = (i.value.slice(0, pos) + b.dataset.emo + i.value.slice(pos)).slice(0, MAX_LEN);
            i.focus();
        });
        listEl.addEventListener('click', e => {
            const more = e.target.closest('[data-act="menu"]');
            if (more) { openMsgMenu(more.closest('.rm-msg')); return; }
            const play = e.target.closest('[data-act="play"]');
            if (play) playVoice(play);
        });

        if (isCustom) {
            ov.querySelector('#rm-mic').addEventListener('click', startRecording);
            ov.querySelector('#rm-rc-cancel').addEventListener('click', () => finishRecording(false));
            ov.querySelector('#rm-rc-send').addEventListener('click', () => finishRecording(true));
        }

        await loadBlocked();

        try {
            const { data, error } = await c.from('room_messages')
                .select(MSG_COLS)
                .eq('room_id', opts.roomId)
                .order('id', { ascending: false })
                .limit(PAGE_SIZE);
            if (error) throw error;
            (data || []).reverse().forEach(m => addMessage(m, listEl));
            listEl.scrollTop = listEl.scrollHeight;
        } catch (err) {
            console.error('[rooms] load failed:', err);
            listEl.insertAdjacentHTML('beforeend', `<div class="rm-empty">${T('rmLoadFail', 'تعذر تحميل الرسائل', 'Could not load messages')}</div>`);
        }

        startTick(listEl);

        let ch = c.channel('room-' + opts.roomId)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'room_messages', filter: 'room_id=eq.' + opts.roomId },
                payload => addMessage(payload.new, listEl))
            .on('postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'room_messages' },
                payload => {
                    const id = payload.old && payload.old.id;
                    if (id != null) listEl.querySelector(`.rm-msg[data-id="${id}"]`)?.remove();
                });
        if (isCustom) {
            ch = ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'custom_rooms' }, payload => {
                if (cur.custom && payload.old && String(payload.old.id) === String(cur.custom.id)) {
                    toast(T('rmRoomDeleted', 'قام المالك بحذف هذه الغرفة', 'The owner deleted this room'));
                    closeRoom();
                }
            });
        }
        cur.channel = ch.subscribe();
        startExpiryWatch();
        startPresence(opts.roomId);

        async function send() {
            const text = input.value.trim();
            if (!text) return;
            const now = Date.now();
            if (now - cur.lastSend < SEND_GAP_MS) {
                toast(T('rmSlow', 'مهلاً، أرسل ببطء قليلاً', 'Slow down a little'));
                return;
            }
            cur.lastSend = now;
            sendBtn.disabled = true;
            try {
                const { data, error } = await c.from('room_messages')
                    .insert([{ room_id: opts.roomId, user_id: me(), body: text.slice(0, MAX_LEN) }])
                    .select(MSG_COLS).single();
                if (error) throw error;
                input.value = '';
                addMessage(data, listEl);
            } catch (err) {
                console.error('[rooms] send failed:', err);
                toast(errText(err));
            } finally {
                sendBtn.disabled = false;
            }
        }
        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    }

    /* ---------------- غرف المباريات والأندية ---------------- */
    async function openMatchRoom(matchId) {
        const c = db();
        if (!c) return;
        try {
            const { data: m, error } = await c.from('matches')
                .select('id, team_a, team_b, match_date').eq('id', matchId).maybeSingle();
            if (error || !m) throw error || new Error('match not found');

            const st = roomState(m.match_date);
            if (st === 'soon') {
                const opensAt = new Date(new Date(m.match_date).getTime() - OPEN_BEFORE_MIN * 60000);
                toast(T('rmOpensAt', 'تفتح الغرفة الساعة {time}', 'Room opens at {time}', { time: fmtTime(opensAt) }));
                return;
            }
            if (st === 'ended') { toast(T('rmEnded', 'انتهت غرفة هذه المباراة', 'This match room has ended')); return; }

            openRoom({
                roomId: 'match_' + String(m.id).replace(/[^A-Za-z0-9_-]/g, '_'),
                title: `${m.team_a} 🆚 ${m.team_b}`,
                sub: '🟢 ' + T('rmLive', 'غرفة المباراة', 'Match room')
            });
        } catch (err) {
            console.error('[rooms] openMatchRoom failed:', err);
            toast(T('rmError', 'تعذر تنفيذ الإجراء', 'Action failed'));
        }
    }

    function allClubs() {
        const out = [];
        if (typeof allWorldCupCountriesClubs !== 'undefined') {
            Object.values(allWorldCupCountriesClubs).forEach(list => out.push(...list));
        }
        return out;
    }

    function openClubRoom(clubId) {
        const club = allClubs().find(x => String(x.id) === String(clubId));
        if (!club) return;
        openRoom({
            roomId: 'club_' + String(club.id).replace(/[^A-Za-z0-9_-]/g, '_'),
            title: (typeof getClubName === 'function' ? getClubName(club) : club.name),
            sub: '👥 ' + T('rmClubRoom', 'غرفة النادي', 'Club room')
        });
    }

    /* ---------------- غرف المستخدمين ---------------- */
    function openCustomRoom(room) {
        openRoom({
            roomId: 'custom_' + room.id,
            title: (room.emoji || '💬') + ' ' + room.name,
            sub: '🔑 ' + room.code,
            custom: { id: room.id, code: room.code, name: room.name, owner_id: room.owner_id, emoji: room.emoji, expires_at: room.expires_at }
        });
    }

    function roomLink(code) {
        const base = (window.env && window.env.APP_URL)
            || (/^https?:/.test(location.protocol) ? location.origin + location.pathname : '');
        return base ? base + '?room=' + encodeURIComponent(code) : '';
    }

    async function shareRoom(room) {
        const link = roomLink(room.code);
        const text = T('rmShareText',
            'انضم إلى غرفتي «{name}» في ZELO FC\nالرمز: {code}',
            'Join my room "{name}" on ZELO FC\nCode: {code}',
            { name: room.name, code: room.code }) + (link ? '\n' + link : '');
        if (navigator.share) {
            try { await navigator.share({ text }); return; }
            catch (e) { if (e && e.name === 'AbortError') return; }
        }
        copyText(text);
        toast(T('rmCopied', 'تم النسخ ✅', 'Copied ✅'));
    }

    async function createRoomFlow() {
        const c = db();
        if (!c || !me()) { toast(T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')); return; }
        const res = await askRoom();
        if (!res) return;
        const name = res.name;
        try {
            const { data, error } = await c.rpc('create_room', { p_name: name, p_emoji: res.emoji });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) throw new Error('no row');
            toast(T('rmCreated', 'تم إنشاء الغرفة ✅', 'Room created ✅'));
            openCustomRoom({ id: row.out_id, code: row.out_code, name: name.trim(), owner_id: me(), emoji: res.emoji, expires_at: row.out_expires });
        } catch (err) {
            console.error('[rooms] create failed:', err);
            toast(errText(err));
        }
    }

    async function joinRoomByCode(code) {
        const c = db();
        if (!c || !me()) { toast(T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')); return; }
        code = String(code || '').trim().toUpperCase();
        if (!code) return;
        try {
            const { data: id, error } = await c.rpc('join_room_by_code', { p_code: code });
            if (error) throw error;
            const { data: room, error: e2 } = await c.from('custom_rooms')
                .select(ROOM_COLS).eq('id', id).maybeSingle();
            if (e2 || !room) throw e2 || new Error('room not found');
            openCustomRoom(room);
        } catch (err) {
            console.error('[rooms] join failed:', err);
            toast(errText(err));
        }
    }

    async function joinFlow() {
        const code = await askText(T('rmJoinTitle', 'الانضمام إلى غرفة', 'Join a room'),
            T('rmJoinPh', 'أدخل رمز الغرفة', 'Enter the room code'), T('rmJoinBtn', 'انضمام', 'Join'), { max: 12, upper: true });
        if (code) joinRoomByCode(code);
    }

    function inviteDialog() {
        const room = cur.custom;
        const c = db();
        if (!room || !c) return;
        const el = document.createElement('div');
        el.className = 'rm-sheet';
        el.dir = isAr() ? 'rtl' : 'ltr';
        el.innerHTML = `<div>
            <h3 class="rm-mt">${T('rmInviteTitle', 'دعوة مستخدمين', 'Invite users')}</h3>
            <input class="rm-search" id="rm-inv-q" autocomplete="off" maxlength="30"
                   placeholder="${esc(T('rmInviteSearch', 'ابحث باسم المستخدم...', 'Search by username...'))}">
            <div id="rm-inv-res"></div>
            <button data-do="close">${T('rmClose', 'إغلاق', 'Close')}</button>
        </div>`;
        document.body.appendChild(el);
        const q = el.querySelector('#rm-inv-q');
        const res = el.querySelector('#rm-inv-res');
        let timer = null;

        el.addEventListener('click', async e => {
            if (e.target === el || e.target.closest('[data-do="close"]')) { el.remove(); return; }
            const b = e.target.closest('[data-invite]');
            if (!b) return;
            b.disabled = true;
            try {
                const { error } = await c.rpc('invite_to_room', { p_room: room.id, p_to: b.dataset.invite });
                if (error) throw error;
                b.textContent = '✅';
                toast(T('rmInvited', 'تم إرسال الدعوة', 'Invitation sent'));
            } catch (err) {
                console.error('[rooms] invite failed:', err);
                b.disabled = false;
                toast(errText(err));
            }
        });

        q.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const term = q.value.replace(/[%_\\,()]/g, '').trim();
                if (term.length < 2) { res.innerHTML = ''; return; }
                try {
                    const { data, error } = await c.from('public_profiles')
                        .select('user_id, username').ilike('username', term + '%').limit(8);
                    if (error) throw error;
                    const rows = (data || []).filter(u => String(u.user_id) !== me() && u.username);
                    res.innerHTML = rows.length
                        ? rows.map(u => `<div class="rm-urow"><span class="n">@${esc(u.username)}</span>
                              <button data-invite="${esc(u.user_id)}">${T('rmInviteBtn', 'دعوة', 'Invite')}</button></div>`).join('')
                        : `<div class="rm-empty">${T('rmNoClubs', 'لا نتائج', 'No results')}</div>`;
                } catch (err) {
                    console.error('[rooms] user search failed:', err);
                    res.innerHTML = `<div class="rm-empty">${T('rmLoadFail', 'تعذر التحميل', 'Could not load')}</div>`;
                }
            }, 300);
        });
        setTimeout(() => q.focus(), 60);
    }

    function openRoomMenu() {
        const room = cur.custom;
        if (!room) return;
        const isOwner = String(room.owner_id) === me();
        const list = [
            { label: '📤 ' + T('rmShare', 'مشاركة الرمز والرابط', 'Share code & link'), run: () => shareRoom(room) },
            { label: '👥 ' + T('rmInvite', 'دعوة مستخدمين', 'Invite users'), run: inviteDialog },
            { label: '📋 ' + T('rmCopyCode', 'نسخ الرمز', 'Copy code') + ' (' + room.code + ')',
                run: () => { copyText(room.code); toast(T('rmCopied', 'تم النسخ ✅', 'Copied ✅')); } }
        ];
        if (isOwner) {
            list.push({ label: '🗑 ' + T('rmDeleteRoom', 'حذف الغرفة', 'Delete room'), danger: true, run: async () => {
                const ok = await askConfirm(
                    T('rmDeleteRoomQ', 'سيتم حذف الغرفة وكل رسائلها نهائياً. متأكد؟', 'The room and all its messages will be deleted permanently. Sure?'),
                    T('rmDeleteRoom', 'حذف الغرفة', 'Delete room'), true);
                if (!ok) return;
                const c = db(); if (!c) return;
                const { error } = await c.from('custom_rooms').delete().eq('id', room.id);
                if (error) { console.error(error); toast(errText(error)); return; }
                toast(T('rmRoomDeletedOk', 'تم حذف الغرفة', 'Room deleted'));
                closeRoom();
            } });
        } else {
            list.push({ label: '🚪 ' + T('rmLeave', 'مغادرة الغرفة', 'Leave room'), danger: true, run: async () => {
                const ok = await askConfirm(T('rmLeaveQ', 'هل تريد مغادرة هذه الغرفة؟', 'Leave this room?'),
                    T('rmLeave', 'مغادرة الغرفة', 'Leave room'), true);
                if (!ok) return;
                const c = db(); if (!c) return;
                const { error } = await c.from('custom_room_members').delete().eq('room_id', room.id).eq('user_id', me());
                if (error) { console.error(error); toast(errText(error)); return; }
                closeRoom();
            } });
        }
        actionSheet(list);
    }

    /* ---------------- عدد الموجودين الآن (Presence) ---------------- */
    function startPresence(roomId) {
        const c = db();
        if (!c) return;
        stopPresence();
        const ch = c.channel('rpres-' + roomId, { config: { presence: { key: me() } } });
        const draw = () => {
            const el = cur.overlay && cur.overlay.querySelector('#rm-count');
            if (el) el.textContent = '👥 ' + Math.max(1, Object.keys(ch.presenceState()).length);
        };
        ch.on('presence', { event: 'sync' }, draw)
          .on('presence', { event: 'join' }, draw)
          .on('presence', { event: 'leave' }, draw)
          .subscribe(status => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }); });
        cur.pres = ch;
    }

    function stopPresence() {
        const ch = cur.pres;
        cur.pres = null;
        if (!ch || !db()) return;
        try { ch.untrack(); } catch (e) {}
        try { db().removeChannel(ch); } catch (e) {}
    }

    /* ---------------- غرفتي: الدرج الجانبي + الإنشاء من صفحة المباراة ---------------- */
    async function fetchMyRooms() {
        const c = db();
        if (!c || !me()) return [];
        const { data, error } = await c.from('custom_room_members')
            .select('joined_at, custom_rooms(' + ROOM_COLS + ')')
            .eq('user_id', me()).order('joined_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(r => r.custom_rooms)
            .filter(r => r && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()));
    }

    // إنشاء غرفة لمباراة (أو فتح غرفتك السابقة لنفس المباراة بدل تكرارها)
    async function createRoomForMatch(name, emoji) {
        const c = db();
        if (!c || !me()) { toast(T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')); return; }
        ensureCss();
        name = String(name || '').trim().slice(0, 40);
        try {
            const mine = await fetchMyRooms();
            const ex = mine.find(r => String(r.owner_id) === me() && r.name === name);
            if (ex) { openCustomRoom(ex); return; }
            const { data, error } = await c.rpc('create_room', { p_name: name, p_emoji: emoji || '⚽' });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) throw new Error('no row');
            toast(T('rmCreated', 'تم إنشاء الغرفة ✅', 'Room created ✅'));
            openCustomRoom({ id: row.out_id, code: row.out_code, name, owner_id: me(), emoji: emoji || '⚽', expires_at: row.out_expires });
        } catch (err) {
            console.error('[rooms] createRoomForMatch failed:', err);
            toast(errText(err));
        }
    }

    let drawerEl = null, drawerChans = [];

    function closeDrawer() {
        drawerChans.forEach(ch => { try { db().removeChannel(ch); } catch (e) {} });
        drawerChans = [];
        if (drawerEl) { drawerEl.remove(); drawerEl = null; }
    }

    async function openRoomsDrawer() {
        ensureCss();
        if (drawerEl) return;
        const ar = isAr();
        const el = document.createElement('div');
        el.className = 'rm-drawer-bg';
        el.dir = ar ? 'rtl' : 'ltr';
        el.innerHTML = `<div class="rm-drawer ${ar ? 'from-right' : 'from-left'}">
            <h3 class="rm-mt">💬 ${T('rmDrawerTitle', 'غرفي', 'My rooms')}</h3>
            <div id="rm-dr-list"><div class="rm-empty">${T('rmLoading', '⏳ جاري التحميل...', '⏳ Loading...')}</div></div>
            <button class="rm-dr-create" data-act="create">➕ ${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</button>
        </div>`;
        document.body.appendChild(el);
        drawerEl = el;

        const panel = el.querySelector('.rm-drawer');
        const list = el.querySelector('#rm-dr-list');

        el.addEventListener('click', e => {
            if (e.target === el) { closeDrawer(); return; }
            if (e.target.closest('[data-act="create"]')) { closeDrawer(); createRoomFlow(); return; }
            const card = e.target.closest('[data-room]');
            if (card) {
                try { const r = JSON.parse(card.dataset.room); closeDrawer(); openCustomRoom(r); }
                catch (err) { console.error(err); }
            }
        });
        // سحب الدرج نحو حافته لإغلاقه
        let sx = null;
        panel.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
        panel.addEventListener('touchend', e => {
            if (sx == null) return;
            const dx = e.changedTouches[0].clientX - sx;
            sx = null;
            if (ar ? dx > 60 : dx < -60) closeDrawer();
        }, { passive: true });

        try {
            const rooms = (await fetchMyRooms()).filter(r => String(r.owner_id) === me());
            if (drawerEl !== el) return;
            list.innerHTML = rooms.length ? rooms.map(r => `
                <div class="rm-card" data-room='${esc(JSON.stringify(r))}'>
                    <div class="logo">${esc(r.emoji || '💬')}</div>
                    <div class="info">
                        <div class="name">${esc(r.name)}</div>
                        <div class="sub">🔑 ${esc(r.code)} · ${esc(expLabel(r.expires_at))}</div>
                    </div>
                    <span class="rm-chip open" data-cnt="${esc(r.id)}">👥 0</span>
                </div>`).join('')
                : `<div class="rm-empty">🫥 ${T('rmNoRooms2', 'ليس لديك غرف بعد', 'You have no rooms yet')}</div>`;

            // عدد الموجودين داخل كل غرفة لحظياً (مراقبة فقط بدون الدخول)
            const c = db();
            rooms.forEach(r => {
                const ch = c.channel('rpres-custom_' + r.id);
                const draw = () => {
                    const chip = list.querySelector(`[data-cnt="${r.id}"]`);
                    if (chip) chip.textContent = '👥 ' + Object.keys(ch.presenceState()).length;
                };
                ch.on('presence', { event: 'sync' }, draw)
                  .on('presence', { event: 'join' }, draw)
                  .on('presence', { event: 'leave' }, draw)
                  .subscribe();
                drawerChans.push(ch);
            });
        } catch (err) {
            console.error('[rooms] drawer failed:', err);
            list.innerHTML = `<div class="rm-empty">${T('rmLoadFail', 'تعذر التحميل', 'Could not load')}</div>`;
        }
    }

    // أيقونة جانبية صغيرة + السحب من الحافة (يمين للعربية، يسار لغيرها)
    function attachRoomsHandle(parent) {
        ensureCss();
        parent = parent || document.body;
        if (parent.querySelector(':scope > .rm-handle')) return;
        const ar = isAr();
        const h = document.createElement('button');
        h.type = 'button';
        h.className = 'rm-handle ' + (ar ? 'right' : 'left');
        h.textContent = '💬';
        h.setAttribute('aria-label', T('rmDrawerTitle', 'غرفي', 'My rooms'));
        h.addEventListener('click', openRoomsDrawer);
        parent.appendChild(h);

        if (parent._rmSwipe) return;
        parent._rmSwipe = true;
        let sx = null, sy = 0;
        parent.addEventListener('touchstart', e => {
            const t = e.touches[0];
            const onEdge = ar ? t.clientX > window.innerWidth - 24 : t.clientX < 24;
            sx = onEdge ? t.clientX : null;
            sy = t.clientY;
        }, { passive: true });
        parent.addEventListener('touchend', e => {
            if (sx == null) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
            sx = null;
            if (dy < 60 && (ar ? dx < -50 : dx > 50)) openRoomsDrawer();
        }, { passive: true });
    }

    /* ---------------- مركز الغرف (تبويب الرسائل) ---------------- */
    let hubTab = 'matches';

    async function fillMatches(body) {
        const c = db();
        if (!c) { body.innerHTML = `<div class="rm-empty">${T('rmLoadFail', 'تعذر التحميل', 'Could not load')}</div>`; return; }
        body.innerHTML = `<div class="rm-empty">${T('rmLoading', '⏳ جاري التحميل...', '⏳ Loading...')}</div>`;
        try {
            const from = new Date(Date.now() - CLOSE_AFTER_MIN * 60000).toISOString();
            const to = new Date(Date.now() + 24 * 3600000).toISOString();
            const { data, error } = await c.from('matches')
                .select('id, team_a, team_b, match_date')
                .gte('match_date', from).lte('match_date', to)
                .order('match_date', { ascending: true }).limit(40);
            if (error) throw error;
            const html = (data || []).map(m => {
                const st = roomState(m.match_date);
                if (st === 'ended') return '';
                const chip = st === 'open'
                    ? `<span class="rm-chip open">🟢 ${T('rmOpenNow', 'مفتوحة', 'Open')}</span>`
                    : `<span class="rm-chip soon">🕒 ${T('rmSoon', 'قريباً', 'Soon')}</span>`;
                return `
                <div class="rm-card" data-match="${esc(m.id)}">
                    <div class="logo">⚽</div>
                    <div class="info">
                        <div class="name">${esc(m.team_a)} 🆚 ${esc(m.team_b)}</div>
                        <div class="sub">🕒 ${esc(fmtTime(m.match_date))}</div>
                    </div>${chip}
                </div>`;
            }).join('');
            body.innerHTML = html || `<div class="rm-empty">⚽ ${T('rmNoMatches', 'لا توجد مباريات قريبة الآن', 'No upcoming matches right now')}</div>`;
        } catch (err) {
            console.error('[rooms] matches failed:', err);
            body.innerHTML = `<div class="rm-empty">${T('rmLoadFail', 'تعذر التحميل', 'Could not load')}</div>`;
        }
    }

    function clubCard(club) {
        const name = typeof getClubName === 'function' ? getClubName(club) : club.name;
        return `
        <div class="rm-card" data-club="${esc(club.id)}">
            <div class="logo">${club.logo ? `<img src="${esc(club.logo)}" alt="" onerror="this.style.display='none'">` : '🛡️'}</div>
            <div class="info"><div class="name">${esc(name)}</div></div>
            <span class="rm-chip club">💬</span>
        </div>`;
    }

    function fillClubs(body) {
        const clubs = allClubs();
        const mineIds = ((window.userState && window.userState.selectedClubs) || []).map(String);
        const mine = clubs.filter(x => mineIds.includes(String(x.id)));

        body.innerHTML = `
            ${mine.length ? `<div class="rm-sec">⭐ ${T('rmMyClubs', 'أنديتي', 'My clubs')}</div>${mine.map(clubCard).join('')}` : ''}
            <div class="rm-sec">🔎 ${T('rmAllClubs', 'كل الأندية', 'All clubs')}</div>
            <input class="rm-search" id="rm-search" placeholder="${esc(T('rmSearch', 'ابحث عن نادٍ...', 'Search clubs...'))}">
            <div id="rm-club-results"></div>`;

        const res = body.querySelector('#rm-club-results');
        const draw = q => {
            q = q.trim().toLowerCase();
            const list = clubs.filter(x => {
                const n = (typeof getClubName === 'function' ? getClubName(x) : x.name) || '';
                return !q || String(n).toLowerCase().includes(q);
            }).slice(0, 40);
            res.innerHTML = list.length ? list.map(clubCard).join('')
                : `<div class="rm-empty">${T('rmNoClubs', 'لا نتائج', 'No results')}</div>`;
        };
        draw('');
        body.querySelector('#rm-search').addEventListener('input', e => draw(e.target.value));
    }

    async function fillMine(body) {
        const c = db();
        body.innerHTML = `
            <div class="rm-actions">
                <button data-act="create">➕ ${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</button>
                <button data-act="join">🔑 ${T('rmJoinTitle', 'الانضمام إلى غرفة', 'Join a room')}</button>
            </div>
            <div id="rm-mine-list"><div class="rm-empty">${T('rmLoading', '⏳ جاري التحميل...', '⏳ Loading...')}</div></div>`;
        const list = body.querySelector('#rm-mine-list');
        if (!c || !me()) { list.innerHTML = `<div class="rm-empty">${T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')}</div>`; return; }
        try {
            const { data, error } = await c.from('custom_room_members')
                .select('joined_at, custom_rooms(id, name, code, owner_id, emoji, expires_at)')
                .eq('user_id', me()).order('joined_at', { ascending: false });
            if (error) throw error;
            const rooms = (data || []).map(r => r.custom_rooms)
                .filter(r => r && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()));
            list.innerHTML = rooms.length ? rooms.map(r => `
                <div class="rm-card" data-room='${esc(JSON.stringify({ id: r.id, name: r.name, code: r.code, owner_id: r.owner_id, emoji: r.emoji, expires_at: r.expires_at }))}'>
                    <div class="logo">${esc(r.emoji || '💬')}</div>
                    <div class="info">
                        <div class="name">${esc(r.name)}</div>
                        <div class="sub">${String(r.owner_id) === me() ? '👑 ' : ''}🔑 ${esc(r.code)} · ${esc(expLabel(r.expires_at))}</div>
                    </div>
                    <span class="rm-chip club">${T('rmEnter', 'دخول', 'Enter')}</span>
                </div>`).join('')
                : `<div class="rm-empty">🫥 ${T('rmNoRooms', 'ليس لديك غرف بعد. أنشئ غرفتك أو انضم برمز.', 'No rooms yet. Create one or join with a code.')}</div>`;
        } catch (err) {
            console.error('[rooms] mine failed:', err);
            list.innerHTML = `<div class="rm-empty">${T('rmLoadFail', 'تعذر التحميل', 'Could not load')}</div>`;
        }
    }

    async function renderMessagesPage(container) {
        ensureCss();
        container = container || document.getElementById('main-content');
        if (!container) return;

        container.innerHTML = `
            <h2 class="rm-title">💬 ${T('rmTitle', 'الغرف', 'Rooms')}</h2>
            <div class="rm-tabs">
                <button class="rm-tab ${hubTab === 'matches' ? 'on' : ''}" data-tab="matches">⚽ ${T('rmTabMatches', 'المباريات', 'Matches')}</button>
                <button class="rm-tab ${hubTab === 'clubs' ? 'on' : ''}" data-tab="clubs">🛡️ ${T('rmTabClubs', 'الأندية', 'Clubs')}</button>
                <button class="rm-tab ${hubTab === 'mine' ? 'on' : ''}" data-tab="mine">🔑 ${T('rmTabMine', 'غرفي', 'My rooms')}</button>
            </div>
            <div id="rm-hub-body"></div>
            <div style="height:20px;"></div>`;

        const body = container.querySelector('#rm-hub-body');

        container.querySelector('.rm-tabs').addEventListener('click', e => {
            const b = e.target.closest('[data-tab]');
            if (!b || b.dataset.tab === hubTab) return;
            hubTab = b.dataset.tab;
            renderMessagesPage(container);
        });
        body.addEventListener('click', e => {
            const act = e.target.closest('[data-act]');
            if (act) { if (act.dataset.act === 'create') createRoomFlow(); else if (act.dataset.act === 'join') joinFlow(); return; }
            const m = e.target.closest('[data-match]');
            if (m) { openMatchRoom(m.dataset.match); return; }
            const k = e.target.closest('[data-club]');
            if (k) { openClubRoom(k.dataset.club); return; }
            const r = e.target.closest('[data-room]');
            if (r) { try { openCustomRoom(JSON.parse(r.dataset.room)); } catch (err) { console.error(err); } }
        });

        if (hubTab === 'matches') await fillMatches(body);
        else if (hubTab === 'clubs') fillClubs(body);
        else await fillMine(body);
    }

    /* ---------------- الانضمام عبر رابط ?room=CODE ---------------- */
    function readRoomParam() {
        try {
            const u = new URL(location.href);
            let code = u.searchParams.get('room');
            if (!code && u.hash) code = new URLSearchParams(u.hash.replace(/^#/, '')).get('room');
            return code ? code.trim().toUpperCase().slice(0, 12) : '';
        } catch (e) { return ''; }
    }

    function clearRoomParam() {
        try {
            const u = new URL(location.href);
            u.searchParams.delete('room');
            if (u.hash && /room=/.test(u.hash)) u.hash = '';
            history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
        } catch (e) {}
    }

    function watchInviteLink() {
        const code = readRoomParam();
        if (!code) return;
        let tries = 0;
        const iv = setInterval(async () => {
            tries++;
            if (tries > 120) { clearInterval(iv); return; }
            if (!(window.userState && window.userState.hasLoggedIn) || !db()) return;
            clearInterval(iv);
            clearRoomParam();
            ensureCss();
            const ok = await askConfirm(
                T('rmJoinLinkQ', 'تمت دعوتك إلى غرفة بالرمز {code}. هل تريد الانضمام؟', 'You were invited to a room with code {code}. Join?', { code }),
                T('rmJoinBtn', 'انضمام', 'Join'), false);
            if (ok) joinRoomByCode(code);
        }, 1000);
    }

    window.renderRoomsHub = renderMessagesPage;   // لا نربطها بتبويب الرسائل: الغرف تُدار من الشريط الجانبي في صفحة المباريات
    window.openMatchRoom = openMatchRoom;
    window.openClubRoom = openClubRoom;
    window.openCustomRoom = openCustomRoom;
    window.joinRoomByCode = joinRoomByCode;
    window.closeRoom = closeRoom;
    window.createRoomForMatch = createRoomForMatch;
    window.openRoomsDrawer = openRoomsDrawer;
    window.attachRoomsHandle = attachRoomsHandle;

    watchInviteLink();
})();
