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
    const ROOM_COLS = 'id, name, code, owner_id, emoji, expires_at, is_public, requires_code';
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

    /* ---------------- أيقونات خطية حديثة (SVG) بدل الإيموجي ---------------- */
    const ICONS = {
        globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/>',
        crown: '<path d="M3 8l4 4 5-6 5 6 4-4-2 11H5z"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6.5"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
        share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
        more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
        trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
        chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>',
        send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
        back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
        enter: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
        list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
        ball: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.2 2.3-1.2 3.7h-4L8.8 10.3z"/><path d="M12 3v5M20.6 9.8l-4.8.3M17.9 19.2l-2.9-3.6M6.1 19.2l2.9-3.6M3.4 9.8l4.8.3"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
        fire: '<path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 4-4 8a6 6 0 0 0 6 6z"/>',
        headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
        shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
        ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
        spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>'
    };
    const ROOM_ICONS = ['ball', 'trophy', 'fire', 'headphones', 'chat', 'shield'];
    const ic = (n, s) => {
        const z = s || 18;
        return `<svg class="rm-ico" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
    };
    // أيقونة الغرفة: القيمة "icon:<name>" أو نص قديم (إيموجي)
    const avatar = (v, s) => (String(v || '').startsWith('icon:')
        ? `<span class="rm-av-ic">${ic(String(v).slice(5), s || 22)}</span>`
        : esc(v || '💬'));

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
            ['wrong_code',     T('rmErrWrongCode', 'الرمز غير صحيح', 'Wrong code')],
            ['banned',         T('rmBanned', 'تم حظرك من هذه الغرفة', 'You are banned from this room')],
            ['room_expired',   T('rmErrExpired', 'انتهت مدة هذه الغرفة', 'This room has expired')],
            ['room_limit',     T('rmErrLimit', 'وصلت للحد الأقصى: 5 غرف', 'You reached the limit: 5 rooms')],
            ['bad_name',       T('rmErrName', 'اسم الغرفة يجب أن يكون بين 2 و40 حرفاً', 'Room name must be 2–40 characters')],
            ['room_not_found', T('rmErrNotFound', 'لا توجد غرفة بهذا الرمز', 'No room with this code')],
            ['room_full',      T('rmErrFull', 'الغرفة ممتلئة', 'The room is full')],
            ['user_not_found', T('rmErrUser', 'المستخدم غير موجود', 'User not found')],
            ['not_member',     T('rmErrMember', 'لست عضواً في هذه الغرفة', 'You are not a member of this room')],
            ['slow_down',      T('rmSlow', 'مهلاً، أرسل ببطء قليلاً', 'Slow down a little')],
            ['room_closed',    T('rmClosed', 'هذه الغرفة مغلقة حالياً', 'This room is closed right now')],
            ['premium_required', T('rmPremiumOnly', 'الرسائل الصوتية للمشتركين فقط', 'Voice messages are for subscribers only')],
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
            color:var(--accent-gold, #fcb045); background:rgba(252,176,69,.08); border:1px solid var(--gold-line, rgba(252,176,69,.45)); }
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

        .rm-ai-bar { display:flex; flex-direction:column; gap:8px; padding:8px 12px; flex-shrink:0; background:rgba(139,92,246,.08);
            border-top:1px solid rgba(139,92,246,.3); }
        .rm-ai-row { display:flex; gap:8px; align-items:center; }
        .rm-ai-input { flex:1; min-width:0; box-sizing:border-box; padding:10px 12px; border-radius:12px; font-size:16px; outline:none;
            background:#12142a; color:#fff; border:1px solid rgba(139,92,246,.45); -webkit-user-select:text; user-select:text; }
        .rm-ai-chips { display:flex; gap:6px; }
        .rm-ai-chips button { flex:1; padding:8px 4px; border-radius:12px; font-weight:800; font-size:.74rem; cursor:pointer;
            color:#c4b5fd; background:rgba(139,92,246,.14); border:1px solid rgba(139,92,246,.4); }
        .rm-ai-q { font-size:.72rem; color:#a8a3c7; margin-bottom:6px; }
        .rm-ai-msg { margin:4px 0 12px; padding:10px 12px; border-radius:14px; font-size:.85rem; line-height:1.6;
            white-space:pre-wrap; color:#e9e5ff; background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.35); }
        .rm-ai-msg b { display:flex; align-items:center; gap:6px; font-size:.74rem; color:#c4b5fd; margin-bottom:4px; }
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
        .rm-play { width:38px; height:38px; border-radius:50%; flex-shrink:0; font-size:1rem; cursor:pointer; color:#fff; border:none;
            background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)); }
        .rm-bar { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; }
        .rm-bar i { display:block; height:100%; width:0; background:#00FF87; transition:width .2s linear; }
        .rm-dur { font-size:.74rem; color:#b6bdd0; font-weight:700; font-variant-numeric:tabular-nums; min-width:34px; text-align:end; }
        .rm-exp { color:#7b8296; font-size:.64rem; font-weight:700; margin-top:2px; }

        .rm-compose { display:flex; align-items:center; gap:8px; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); flex-shrink:0;
            background:rgba(18,18,22,.95); border-top:1px solid rgba(255,255,255,.08); }
        .rm-input { flex:1; min-width:0; padding:12px 14px; border-radius:22px; font-size:16px; outline:none;
            background:#12142a; color:#fff; border:1px solid rgba(255,255,255,.14);
            -webkit-user-select:text; user-select:text; }
        .rm-send, .rm-mic { width:46px; height:46px; border-radius:50%; font-size:1.2rem; cursor:pointer; flex-shrink:0; color:#fff; border:none;
            background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)); box-shadow:var(--shadow-primary, 0 8px 24px rgba(253,29,29,.25)); }
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
        .rm-sheet button.primary { background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)); border:none; }
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
        .rm-handle { position:fixed; top:50%; transform:translateY(-50%); width:26px; height:72px; z-index:100000; padding:0;
            cursor:pointer; color:#fff; border:1px solid rgba(255,255,255,.16); display:flex; align-items:center; justify-content:center;
            background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045));
            box-shadow:0 10px 28px rgba(253,29,29,.3), inset 0 1px 0 rgba(255,255,255,.25);
            transition:transform .2s ease, box-shadow .2s ease; -webkit-tap-highlight-color:transparent; }
        .rm-handle:active { transform:translateY(-50%) scale(.94); }
        .rm-handle svg { width:16px; height:16px; }
        .rm-handle.right { right:0; border-radius:16px 0 0 16px; }
        .rm-handle.left { left:0; border-radius:0 16px 16px 0; }
        .rm-handle.right svg, .rm-handle.left svg { transition:transform .25s; }
        .rm-drawer-bg { position:fixed; inset:0; z-index:100005; background:rgba(0,0,0,.55); }
        .rm-drawer { position:absolute; top:0; bottom:0; width:min(82vw,320px); box-sizing:border-box; overflow-y:auto; color:#f8fafc;
            padding:16px 14px calc(16px + env(safe-area-inset-bottom)); background:#17171d; border:1px solid rgba(252,176,69,.25); }
        .rm-drawer.from-right { right:0; border-radius:20px 0 0 20px; animation:rmInR .22s ease-out; }
        .rm-drawer.from-left { left:0; border-radius:0 20px 20px 0; animation:rmInL .22s ease-out; }
        @keyframes rmInR { from { transform:translateX(100%); } to { transform:none; } }
        @keyframes rmInL { from { transform:translateX(-100%); } to { transform:none; } }
        .rm-dr-create { display:block; width:100%; padding:13px; margin-top:10px; border-radius:14px; font-weight:800; font-size:.95rem;
            cursor:pointer; color:#fff; border:none; background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)); box-shadow:var(--shadow-primary, 0 8px 24px rgba(253,29,29,.25)); }
        .rm-toast.show { opacity:1; }
        .rm-codebar { display:flex; align-items:center; gap:8px; margin:0 12px 10px; padding:10px 12px; border-radius:16px;
            background:linear-gradient(135deg,rgba(252,176,69,.12),rgba(139,92,246,.1)); border:1px solid rgba(252,176,69,.35); }
        .rm-codebar-t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; font-size:.7rem; color:#fcb045; font-weight:800; }
        .rm-codebar-t b { font-size:1.05rem; color:#fff; letter-spacing:3px; font-variant-numeric:tabular-nums; }
        .rm-codebar button { padding:8px 12px; border-radius:12px; font-size:.78rem; font-weight:800; cursor:pointer; color:#fff;
            background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); }
        .rm-codebar button:first-of-type { color:#00FF87; border-color:rgba(0,255,135,.4); background:rgba(0,255,135,.1); }
        .rm-section { margin-top:6px; }
        .rm-sec-head { font-size:1.02rem; font-weight:900; margin:18px 2px 10px; color:#f8fafc; }
        .rm-section .rm-actions button { display:flex; align-items:center; justify-content:center; gap:6px; }
        .rm-card { transition:transform .12s ease, border-color .2s; }
        .rm-card:hover { border-color:rgba(139,92,246,.6); }
        .rm-card.owner { border-color:rgba(252,176,69,.4); background:linear-gradient(135deg,rgba(40,30,20,.95),rgba(14,14,28,.95)); }
        .rm-card .logo { border-radius:14px; background:rgba(255,255,255,.05); }
        .rm-chip.open { box-shadow:0 0 12px rgba(0,255,135,.15); }
        .rm-chip.club { box-shadow:0 0 12px rgba(42,171,238,.15); }
        .rm-sec-list .rm-card:last-child { margin-bottom:24px; }
        .rm-ico { display:inline-block; flex-shrink:0; vertical-align:middle; }
        [dir=rtl] .rm-head [data-act="back"] .rm-ico { transform:scaleX(-1); }
        .rm-head .rm-hbtn { display:flex; align-items:center; justify-content:center; color:#e2e8f0; }
        .rm-count { display:inline-flex; align-items:center; gap:5px; }
        .rm-codebar { align-items:center; flex-wrap:wrap; }
        .rm-codebar-t { flex-direction:row !important; align-items:center; gap:6px; flex-wrap:wrap; }
        .rm-codebar-t span { font-size:.7rem; color:#fcb045; font-weight:800; }
        .rm-cb-ic { display:inline-flex; }
        .rm-codebar button { display:inline-flex; align-items:center; gap:6px; }
        .rm-sec-head { display:flex; align-items:center; gap:8px; font-size:1.02rem; font-weight:900; color:#f8fafc; margin:18px 2px 10px; }
        .rm-sec-head .rm-ico { color:#8B5CF6; }
        .rm-sub-head { display:flex; align-items:center; gap:6px; color:#94a3b8; font-size:.78rem; font-weight:800; margin:14px 4px 8px; }
        .rm-sub-head .rm-ico { color:#2AABEE; }
        .rm-actions button { display:flex; align-items:center; justify-content:center; gap:6px; }
        .rm-btn-main { background:var(--gradient-primary, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)) !important; box-shadow:var(--shadow-primary, 0 8px 24px rgba(253,29,29,.25)); color:#fff !important; border-color:transparent !important; }
        .rm-av-box { display:flex; align-items:center; justify-content:center; width:46px; height:46px; min-width:46px; border-radius:15px; color:#7CF7C4;
            background:linear-gradient(135deg,rgba(42,171,238,.16),rgba(139,92,246,.16)); border:1px solid rgba(139,92,246,.3); }
        .rm-card.owner .rm-av-box { color:#fcb045; border-color:rgba(252,176,69,.4);
            background:linear-gradient(135deg,rgba(252,176,69,.16),rgba(139,92,246,.1)); }
        .rm-av-ic { display:inline-flex; align-items:center; justify-content:center; }
        .rm-card .sub { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; }
        .rm-sub-i { display:inline-flex; align-items:center; gap:4px; }
        .rm-sub-i b { font-weight:800; color:#e2e8f0; letter-spacing:1px; }
        .rm-chip { display:inline-flex; align-items:center; gap:5px; }
        .rm-chip.owner { color:#fcb045; background:rgba(252,176,69,.12); border:1px solid rgba(252,176,69,.4); }
        .rm-seg { display:flex; gap:6px; padding:4px; margin-bottom:12px; border-radius:14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); }
        .rm-seg button { flex:1; margin:0; width:auto; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 6px; border:none; border-radius:11px;
            background:transparent; color:#94a3b8; font-weight:800; font-size:.85rem; cursor:pointer; }
        .rm-seg button.on { background:rgba(255,255,255,.12); color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.35); }
        .rm-lbl { font-size:.74rem; font-weight:800; color:#94a3b8; margin:2px 2px 6px; }
        .rm-hint { display:flex; align-items:flex-start; gap:6px; font-size:.74rem; color:#94a3b8; margin:-4px 2px 12px; line-height:1.5; }
        .rm-hint .rm-ico { margin-top:2px; }
        .rm-pick button { display:flex !important; align-items:center; justify-content:center; height:46px; color:#cbd5e1; }
        .rm-pick button.on { color:#00FF87; border-color:#00FF87; }
        .rm-hero { display:flex; justify-content:center; margin-bottom:10px; }
        .rm-hero .rm-av-ic { width:64px; height:64px; border-radius:20px; color:#7CF7C4; background:rgba(124,247,196,.08); border:1px solid rgba(124,247,196,.25); }
        .rm-mp { display:flex; align-items:center; justify-content:center; gap:6px; }
        .rm-err { color:#ff6b6b; font-size:.82rem; font-weight:800; text-align:center; margin:-4px 0 10px; }
        .rm-code { text-align:center; font-size:1.25rem; letter-spacing:5px; font-weight:900; text-transform:uppercase; direction:ltr; }
        .rm-code.bad { border-color:#ff6b6b !important; }
        .rm-empty { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .rm-empty .rm-ico { opacity:.6; }
        .rm-sheet button { display:flex; align-items:center; justify-content:center; gap:8px; }
        .rm-sheet button.primary { box-shadow:var(--shadow-primary, 0 8px 24px rgba(253,29,29,.25)); }
        .rm-handle { display:flex; align-items:center; justify-content:center; color:#fff; }
        .rm-section .rm-card { margin-bottom:10px; }
        .rm-section .rm-card:last-child { margin-bottom:12px; }
        .rm-av { overflow:hidden; }
        .rm-av img { width:100%; height:100%; object-fit:cover; display:block; }
        .rm-user { cursor:pointer; -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
        /* ---- تصميم مصغّر لبطاقات الغرف ---- */
        .rm-section { padding:0 2px; }
        .rm-section .rm-actions { gap:8px; margin-bottom:6px; }
        .rm-section .rm-actions button { padding:10px 6px; font-size:.8rem; border-radius:13px; }
        .rm-sub-head { margin:16px 4px 8px; font-size:.74rem; letter-spacing:.2px; }
        .rm-card.rm-room { gap:10px; padding:8px 10px; margin-bottom:7px; border-radius:15px;
            border-inline-start:3px solid transparent; }
        .rm-card.rm-room.is-open { border-inline-start-color:#00FF87; }
        .rm-card.rm-room.is-locked { border-inline-start-color:#fb7185; }
        .rm-card.rm-room.owner { border-inline-start-color:#fcb045; }
        .rm-card.rm-room .rm-av-box { width:38px; height:38px; min-width:38px; border-radius:12px; }
        .rm-card.rm-room .name { font-size:.88rem; line-height:1.25; }
        .rm-card.rm-room .sub { margin-top:3px; gap:3px 9px; font-size:.7rem; }
        .rm-card.rm-room .sub b { color:#e2e8f0; font-weight:800; }
        .rm-card.rm-room .rm-chip { font-size:.66rem; padding:2px 8px; }
        .rm-st { display:inline-flex; align-items:center; gap:4px; font-size:.68rem; font-weight:900; }
        .rm-st.open { color:#00FF87; }
        .rm-st.locked { color:#fb7185; }
        .rm-dot { width:7px; height:7px; border-radius:50%; background:#00FF87; box-shadow:0 0 8px #00FF87; display:inline-block; }
        .rm-exp { opacity:.75; }
        .rm-section .rm-card.rm-room { margin-bottom:7px; }
        .rm-section .rm-card.rm-room:last-child { margin-bottom:10px; }`;
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
            const st = { icon: ROOM_ICONS[0], pub: true };
            const el = document.createElement('div');
            el.className = 'rm-sheet center';
            el.dir = isAr() ? 'rtl' : 'ltr';
            el.innerHTML = `<div>
                <h3 class="rm-mt">${ic('plus', 18)} ${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</h3>
                <div class="rm-lbl">${T('rmIconLbl', 'أيقونة الغرفة', 'Room icon')}</div>
                <div class="rm-pick">${ROOM_ICONS.map(k => `<button type="button" data-icon="${k}" aria-label="${k}">${ic(k, 22)}</button>`).join('')}</div>
                <input class="rm-search" id="rm-ask" maxlength="40" autocomplete="off"
                       placeholder="${esc(T('rmCreatePh', 'اسم الغرفة', 'Room name'))}">
                <div class="rm-lbl">${T('rmVisLbl', 'نوع الغرفة', 'Room type')}</div>
                <div class="rm-seg">
                    <button type="button" data-vis="public">${ic('globe', 16)}<span>${T('rmPublicOpen', 'عامة (مفتوحة)', 'Public (open)')}</span></button>
                    <button type="button" data-vis="private">${ic('lock', 16)}<span>${T('rmPrivateLocked', 'خاصة (برمز)', 'Private (code)')}</span></button>
                </div>
                <p class="rm-hint" id="rm-hint"></p>
                <p class="rm-hint">${ic('clock', 14)}<span>${T('rmTtlNote', 'تُحذف الغرفة تلقائياً بعد 6 ساعات من إنشائها', 'The room is deleted automatically 6 hours after it is created')}</span></p>
                <button class="primary" data-do="ok">${ic('plus', 18)}<span>${T('rmCreateBtn', 'إنشاء', 'Create')}</span></button>
                <button data-do="cancel">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
            </div>`;
            document.body.appendChild(el);
            const inp = el.querySelector('#rm-ask');

            const draw = () => {
                el.querySelectorAll('[data-icon]').forEach(b => b.classList.toggle('on', b.dataset.icon === st.icon));
                el.querySelectorAll('[data-vis]').forEach(b => b.classList.toggle('on', (b.dataset.vis === 'public') === st.pub));
                el.querySelector('#rm-hint').innerHTML = st.pub
                    ? `${ic('globe', 14)}<span>${T('rmHintPubOpen', 'مفتوحة: تظهر للجميع ويدخلها أي شخص مباشرة بدون رمز', 'Open: listed for everyone, anyone can join with no code')}</span>`
                    : `${ic('lock', 14)}<span>${T('rmHintPrivLocked', 'مقفلة: لا تظهر في القائمة، ويُطلب رمز الغرفة للدخول', 'Locked: not listed, a code is required to join')}</span>`;
            };

            const done = v => { el.remove(); resolve(v); };
            const submit = () => {
                const name = inp.value.trim();
                if (!name) { inp.focus(); return; }
                done({ name, emoji: 'icon:' + st.icon, pub: st.pub, requiresCode: !st.pub });
            };

            el.addEventListener('click', e => {
                if (e.target === el) return done(null);
                const ib = e.target.closest('[data-icon]');
                if (ib) { st.icon = ib.dataset.icon; draw(); return; }
                const vb = e.target.closest('[data-vis]');
                if (vb) { st.pub = vb.dataset.vis === 'public'; draw(); return; }
                const b = e.target.closest('[data-do]');
                if (!b) return;
                if (b.dataset.do === 'ok') submit(); else done(null);
            });
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
            draw();
            setTimeout(() => inp.focus(), 60);
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
            ${buttons.map((b, i) => `<button class="${b.danger ? 'danger' : ''}" data-i="${i}">${b.icon ? ic(b.icon, 18) : ''}<span>${esc(b.label)}</span></button>`).join('')}
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
        const tot = Math.ceil(ms / 60000);
        const h = Math.floor(tot / 60);
        const m = tot % 60;
        const t = h > 0 ? (isAr() ? `${h}س ${m}د` : `${h}h ${m}m`) : (isAr() ? `${m}د` : `${m}m`);
        return T('rmExpires', '⏳ تُحذف خلال {t}', '⏳ Deleted in {t}', { t });
    }

    /* ---------------- صور المستخدمين + حظر وطرد (المالك) ---------------- */
    const avCache = new Map();   // user_id -> Promise<url | null>
    function fetchAvatar(uid) {
        const key = String(uid);
        if (!avCache.has(key)) {
            avCache.set(key, (async () => {
                try {
                    const c = db();
                    if (!c) return null;
                    const { data, error } = await c.from('public_profiles')
                        .select('avatar_url').eq('user_id', key).maybeSingle();
                    if (error) return null;
                    return (data && data.avatar_url) || null;
                } catch (e) { return null; }
            })());
        }
        return avCache.get(key);
    }
    function applyAvatar(uid, root) {
        fetchAvatar(uid).then(url => {
            if (!url || !root) return;
            root.querySelectorAll(`.rm-av[data-av="${String(uid).replace(/"/g, '')}"]`).forEach(el => {
                el.innerHTML = `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
            });
        });
    }

    function openKickSheet(uid, uname) {
        actionSheet([{
            icon: 'ban', danger: true, label: T('rmBanKick', 'حظر وطرد', 'Ban & kick'),
            run: () => banAndKick(uid, uname)
        }]);
    }

    async function banAndKick(uid, uname) {
        const c = db();
        const room = cur.custom;
        if (!c || !room || String(room.owner_id) !== me()) return;
        const ok = await askConfirm(
            T('rmBanQ', 'سيُطرد {name} من الغرفة ولن يستطيع الدخول إليها مرة أخرى. متأكد؟',
              '{name} will be removed and cannot join this room again. Sure?', { name: uname }),
            T('rmBanKick', 'حظر وطرد', 'Ban & kick'), true);
        if (!ok) return;
        try {
            const { error } = await c.rpc('ban_room_member', { p_room: String(room.id), p_user: String(uid), p_actor: me() });
            if (error) throw error;
        } catch (err) {
            console.error('[rooms] ban failed:', err);
            toast(errText(err));
            return;
        }
        cur.blocked.add(String(uid));
        cur.overlay?.querySelectorAll('.rm-msg').forEach(el => { if (el.dataset.uid === String(uid)) el.remove(); });
        toast(T('rmBanned2', 'تم حظر {name} وطرده', '{name} was banned and removed', { name: uname }));
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
            <div class="rm-av" data-av="${esc(m.user_id)}">${esc(String(name).charAt(0).toUpperCase())}</div>
            <div class="rm-bub">
                <div class="rm-meta">
                    <span class="rm-user" data-uname="${esc(m.user_id)}">@${esc(name)}</span>
                    <span class="rm-time">${esc(fmtTime(m.created_at))}</span>
                    <button class="rm-more" data-act="menu">${ic('more', 18)}</button>
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
        applyAvatar(m.user_id, listEl);
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
            list.push({ icon: 'trash', label: (mine ? T('rmDelete', 'حذف رسالتي', 'Delete my message') : T('rmDeleteMod', 'حذف الرسالة (المالك)', 'Delete message (owner)')), danger: true,
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
            if (sub) sub.textContent = (String(cur.custom.owner_id) === me()
                ? T('rmYourRoom', 'غرفتك', 'Your room')
                : T('rmMemberRoom', 'عضو في الغرفة', 'Member')) + ' · ' + expLabel(cur.custom.expires_at);
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
        document.dispatchEvent(new Event('rooms:changed'));
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
        const owner = isCustom && String(cur.custom.owner_id) === me();
        const ov = document.createElement('div');
        ov.className = 'rm-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.innerHTML = `
            <div class="rm-head">
                <button class="rm-hbtn" data-act="back">${ic('back', 18)}</button>
                <div class="t"><b>${esc(opts.title)}</b><span id="rm-sub">${esc(opts.sub || '')}</span></div>
                <span class="rm-count" id="rm-count">${ic('users', 14)} 1</span>
                ${isCustom ? `${owner ? '<button class="rm-hbtn" data-act="share" title="' + esc(T('rmShare', 'مشاركة', 'Share')) + '">' + ic('share', 18) + '</button>' : ''}<button class="rm-hbtn" data-act="room-menu">${ic('more', 18)}</button>` : ''}
            </div>
            ${owner && cur.custom.requires_code ? `<div class="rm-codebar">
                <div class="rm-codebar-t"><span class="rm-cb-ic">${ic('key', 16)}</span><span>${esc(T('rmCodeLabel', 'رمز الغرفة', 'Room code'))}</span>
                    <b dir="ltr">${esc(cur.custom.code)}</b></div>
                <button id="rm-copycode">${ic('copy', 16)} ${esc(T('rmCopy', 'نسخ', 'Copy'))}</button>
                <button id="rm-invite2">${ic('users', 16)} ${esc(T('rmInvite', 'دعوة', 'Invite'))}</button>
            </div>` : ''}
            <div class="rm-list" id="rm-list">
                <div class="rm-note">${T('rmRules', 'كن محترماً. الإساءة والروابط المشبوهة تؤدي للحظر.', 'Be respectful. Abuse and suspicious links get you blocked.')}</div>
            </div>
            ${isCustom ? `<div class="rm-quick" id="rm-quick" style="display:none">${QUICK_EMOJIS.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>` : ''}
            <div class="rm-ai-bar" id="rm-aibar" style="display:none">
                <div class="rm-ai-row">
                    <input class="rm-ai-input" id="rm-ai-input" maxlength="300" autocomplete="off"
                           placeholder="${esc(T('rmAiPh', 'اسأل المساعد أي شيء عن كرة القدم...', 'Ask the assistant about football...'))}">
                    <button class="rm-send" id="rm-ai-send">${ic('send', 20)}</button>
                </div>
                <div class="rm-ai-chips">
                    <button data-ai="explain">${esc(T('rmAiExplain', 'اشرح لي', 'Explain'))}</button>
                    <button data-ai="recap">${esc(T('rmAiRecap', 'ما فاتني', 'Catch me up'))}</button>
                    <button data-ai="why">${esc(T('rmAiWhy', 'لماذا هذا التوقع؟', 'Why this pick?'))}</button>
                </div>
            </div>
            <div class="rm-compose" id="rm-compose">
                ${isCustom ? '<button class="rm-mic" id="rm-mic">' + ic('mic', 20) + '</button>' : ''}
                <button class="rm-mic" id="rm-ai">${ic('spark', 20)}</button>
                <button class="rm-mic" id="rm-emo">${ic('smile', 20)}</button>
                <input class="rm-input" id="rm-input" maxlength="${MAX_LEN}" autocomplete="off"
                       placeholder="${esc(T('rmPlaceholder', 'اكتب رسالة...', 'Write a message...'))}">
                <button class="rm-send" id="rm-send">${ic('send', 20)}</button>
                <div class="rm-recbar">
                    <button class="rm-rc-cancel" id="rm-rc-cancel">${ic('trash', 20)}</button>
                    <div class="rm-rec-info"><span class="rm-rec-dot">●</span><span id="rm-rec-time">0:00</span></div>
                    <button class="rm-send" id="rm-rc-send">${ic('send', 20)}</button>
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
        ov.querySelector('#rm-copycode')?.addEventListener('click', () => {
            if (!cur.custom) return;
            copyText(cur.custom.code);
            toast(T('rmCopied', 'تم النسخ ✅', 'Copied ✅'));
        });
        ov.querySelector('#rm-invite2')?.addEventListener('click', () => inviteDialog());
        const quick = ov.querySelector('#rm-quick');
        ov.querySelector('#rm-emo')?.addEventListener('click', () => {
            if (!quick) return;
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
        {
            const aiBar = ov.querySelector('#rm-aibar');
            const aiInput = ov.querySelector('#rm-ai-input');
            const aiCtx = opts.match || { room_name: opts.title };
            let aiBusy = false;
            let aiLast = 0;
            async function askAi(mode, question) {
                if (aiBusy) return;
                if (Date.now() - aiLast < 6000) { toast(T('rmSlow', 'مهلاً، أرسل ببطء قليلاً', 'Slow down a little')); return; }
                aiBusy = true;
                aiLast = Date.now();
                const chat = Array.from(listEl.querySelectorAll('.rm-msg')).slice(-40).map(n => {
                    const t = n.querySelector('.rm-text');
                    return t ? (n.querySelector('.rm-user')?.textContent || '') + ': ' + t.textContent.trim() : '';
                }).filter(Boolean);
                const box = document.createElement('div');
                box.className = 'rm-ai-msg';
                box.textContent = '…';
                listEl.appendChild(box);
                listEl.scrollTop = listEl.scrollHeight;
                try {
                    const { data, error } = await c.functions.invoke('match-assistant', {
                        body: { mode, match: aiCtx, question, chat }
                    });
                    if (error) throw error;
                    const txt = String((data && data.text) || '').replace(/\*\*/g, '');
                    box.innerHTML = '<b>' + ic('spark', 14) + ' ' + esc(T('rmAiName', 'مساعد المباراة', 'Match assistant')) + '</b>'
                        + (question ? '<div class="rm-ai-q" dir="auto">' + esc(question) + '</div>' : '')
                        + '<div dir="auto">' + esc(txt) + '</div>';
                } catch (err) {
                    console.error('[rooms] assistant failed:', err);
                    box.remove();
                    toast(T('rmAiFail', 'تعذر الحصول على إجابة المساعد', 'Assistant unavailable'));
                } finally {
                    aiBusy = false;
                    listEl.scrollTop = listEl.scrollHeight;
                }
            }
            const sendAsk = () => {
                const q = aiInput.value.trim();
                if (!q) return;
                aiInput.value = '';
                askAi('ask', q);
            };
            ov.querySelector('#rm-ai').addEventListener('click', () => {
                const open = aiBar.style.display === 'none';
                aiBar.style.display = open ? 'flex' : 'none';
                if (open) aiInput.focus();
            });
            ov.querySelector('#rm-ai-send').addEventListener('click', sendAsk);
            aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendAsk(); } });
            aiBar.addEventListener('click', e => {
                const b = e.target.closest('[data-ai]');
                if (b) askAi(b.dataset.ai, '');
            });
        }
        listEl.addEventListener('click', e => {
            const more = e.target.closest('[data-act="menu"]');
            if (more) { openMsgMenu(more.closest('.rm-msg')); return; }
            const play = e.target.closest('[data-act="play"]');
            if (play) playVoice(play);
        });

        // ضغط مطوّل على اسم الكاتب: للمالك فقط يظهر خيار "حظر وطرد"
        let pressTimer = null;
        const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
        listEl.addEventListener('pointerdown', e => {
            const nm = e.target.closest('.rm-user');
            if (!nm || !cur.custom || String(cur.custom.owner_id) !== me()) return;
            const uid = nm.dataset.uname;
            if (!uid || String(uid) === me()) return;
            const uname = nm.textContent.replace(/^@/, '');
            cancelPress();
            pressTimer = setTimeout(() => { pressTimer = null; openKickSheet(uid, uname); }, 500);
        });
        ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev => listEl.addEventListener(ev, cancelPress));
        listEl.addEventListener('contextmenu', e => { if (e.target.closest('.rm-user')) e.preventDefault(); });

        if (isCustom) {
            const micBtn = ov.querySelector('#rm-mic');
            // غير المشترك: الزر باهت، والضغط عليه يفتح صفحة الاشتراكات
            if (window.ZeloPremium) window.ZeloPremium.isPremium().then(ok => { if (!ok) micBtn.style.opacity = '0.45'; });
            micBtn.addEventListener('click', async () => {
                const ok = window.ZeloPremium ? await window.ZeloPremium.isPremium() : false;
                if (!ok) {
                    toast(T('rmPremiumOnly', 'الرسائل الصوتية للمشتركين فقط', 'Voice messages are for subscribers only'));
                    if (window.openSubscriptions) window.openSubscriptions();
                    return;
                }
                startRecording();
            });
            ov.querySelector('#rm-rc-cancel').addEventListener('click', () => finishRecording(false));
            ov.querySelector('#rm-rc-send').addEventListener('click', () => finishRecording(true));
        }

        await loadBlocked();
        if (isCustom) {
            try {
                const { data: bans } = await c.from('room_bans').select('user_id').eq('room_key', opts.roomId);
                (bans || []).forEach(b => cur.blocked.add(String(b.user_id)));
            } catch (e) { /* لا نوقف فتح الغرفة */ }
        }

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
                sub: '🟢 ' + T('rmLive', 'غرفة المباراة', 'Match room'),
                match: { team_a: m.team_a, team_b: m.team_b, match_date: m.match_date }
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
            title: room.name,
            sub: String(room.owner_id) === me()
                ? T('rmYourRoom', 'غرفتك', 'Your room')
                : T('rmMemberRoom', 'عضو في الغرفة', 'Member'),
            custom: { id: room.id, code: room.code, name: room.name, owner_id: room.owner_id, emoji: room.emoji, expires_at: room.expires_at, requires_code: !!room.requires_code }
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
        try {
            const { data, error } = await c.rpc('create_room_v2', {
                p_name: res.name,
                p_emoji: res.emoji,
                p_public: res.pub,
                p_requires_code: res.requiresCode
            });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) throw new Error('no row');
            toast(T('rmCreated', 'تم إنشاء الغرفة ✅', 'Room created ✅'));
            openCustomRoom({ id: row.out_id, code: row.out_code, name: res.name, owner_id: me(), emoji: res.emoji, expires_at: row.out_expires, requires_code: !!res.requiresCode });
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
            const { data: id, error } = await c.rpc('join_room_checked', { p_code: code, p_actor: me() });
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
                b.innerHTML = ic('check', 16);
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
        const list = isOwner ? [
            { icon: 'share', label: T('rmShare', 'مشاركة الرمز والرابط', 'Share code & link'), run: () => shareRoom(room) },
            { icon: 'users', label: T('rmInvite', 'دعوة مستخدمين', 'Invite users'), run: inviteDialog },
            { icon: 'copy', label: T('rmCopyCode', 'نسخ الرمز', 'Copy code') + ' (' + room.code + ')',
                run: () => { copyText(room.code); toast(T('rmCopied', 'تم النسخ ✅', 'Copied ✅')); } }
        ] : [];
        if (isOwner) {
            list.push({ icon: 'trash', label: T('rmDeleteRoom', 'حذف الغرفة', 'Delete room'), danger: true, run: async () => {
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
            list.push({ icon: 'logout', label: T('rmLeave', 'مغادرة الغرفة', 'Leave room'), danger: true, run: async () => {
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
            if (el) el.innerHTML = ic('users', 14) + ' ' + Math.max(1, Object.keys(ch.presenceState()).length);
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
            const { data, error } = await c.rpc('create_room', { p_name: name, p_emoji: emoji || 'icon:ball' });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) throw new Error('no row');
            toast(T('rmCreated', 'تم إنشاء الغرفة ✅', 'Room created ✅'));
            openCustomRoom({ id: row.out_id, code: row.out_code, name, owner_id: me(), emoji: emoji || 'icon:ball', expires_at: row.out_expires, requires_code: true });
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
            <h3 class="rm-mt">${T('rmDrawerTitle', 'غرفي', 'My rooms')}</h3>
            <div id="rm-dr-list"><div class="rm-empty">${T('rmLoading', 'جاري التحميل...', 'Loading...')}</div></div>
            <button class="rm-dr-create" data-act="create">${ic('plus', 18)} ${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</button>
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
                    <div class="logo">${avatar(r.emoji)}</div>
                    <div class="info">
                        <div class="name">${esc(r.name)}</div>
                        <div class="sub">${r.requires_code ? ic('key', 12) + ' ' + esc(r.code) + ' · ' : ''}${esc(expLabel(r.expires_at))}</div>
                    </div>
                    <span class="rm-chip open" data-cnt="${esc(r.id)}">0</span>
                </div>`).join('')
                : `<div class="rm-empty">${T('rmNoRooms2', 'ليس لديك غرف بعد', 'You have no rooms yet')}</div>`;

            // عدد الموجودين داخل كل غرفة لحظياً (مراقبة فقط بدون الدخول)
            const c = db();
            rooms.forEach(r => {
                const ch = c.channel('rpres-custom_' + r.id);
                const draw = () => {
                    const chip = list.querySelector(`[data-cnt="${r.id}"]`);
                    if (chip) chip.textContent = Object.keys(ch.presenceState()).length;
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
        // سهم أنيق: يشير إلى داخل الشاشة (عربي = من اليمين، غير ذلك = من اليسار)
        const chev = ar ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
        h.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${chev}"/></svg>`;
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
        body.innerHTML = `<div class="rm-empty">${T('rmLoading', 'جاري التحميل...', 'Loading...')}</div>`;
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
                <button data-act="create">${ic('plus', 18)} ${T('rmCreateTitle', 'إنشاء غرفة', 'Create a room')}</button>
                <button data-act="join">🔑 ${T('rmJoinTitle', 'الانضمام إلى غرفة', 'Join a room')}</button>
            </div>
            <div id="rm-mine-list"><div class="rm-empty">${T('rmLoading', 'جاري التحميل...', 'Loading...')}</div></div>`;
        const list = body.querySelector('#rm-mine-list');
        if (!c || !me()) { list.innerHTML = `<div class="rm-empty">${T('rmNeedLogin', 'سجّل الدخول أولاً', 'Please sign in first')}</div>`; return; }
        try {
            const { data, error } = await c.from('custom_room_members')
                .select('joined_at, custom_rooms(id, name, code, owner_id, emoji, expires_at, requires_code)')
                .eq('user_id', me()).order('joined_at', { ascending: false });
            if (error) throw error;
            const rooms = (data || []).map(r => r.custom_rooms)
                .filter(r => r && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()));
            list.innerHTML = rooms.length ? rooms.map(r => `
                <div class="rm-card" data-room='${esc(JSON.stringify({ id: r.id, name: r.name, code: r.code, owner_id: r.owner_id, emoji: r.emoji, expires_at: r.expires_at, requires_code: !!r.requires_code }))}'>
                    <div class="logo">${avatar(r.emoji)}</div>
                    <div class="info">
                        <div class="name">${esc(r.name)}</div>
                        <div class="sub">${String(r.owner_id) === me() ? ic('crown', 12) + ' ' + (r.requires_code ? ic('key', 12) + ' ' + esc(r.code) + ' · ' : '') : ''}${esc(expLabel(r.expires_at))}</div>
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

    /* ---------------- الغرف العامة + غرفي داخل صفحة المباريات ---------------- */
    // غرفي: الغرف التي أنشأها المستخدم أو انضم إليها (بدون تكرار)
    async function loadMyRooms() {
        const c = db();
        if (!c || !me()) throw new Error('not_logged');
        const [mem, own] = await Promise.all([
            c.from('custom_room_members').select('custom_rooms(' + ROOM_COLS + ')').eq('user_id', me()),
            c.from('custom_rooms').select(ROOM_COLS).eq('owner_id', me())
        ]);
        if (mem.error) throw mem.error;
        if (own.error) console.warn('[rooms] owned rooms query:', own.error);
        const map = new Map();
        (own.data || []).forEach(r => { if (r) map.set(String(r.id), r); });
        (mem.data || []).forEach(x => { const r = x.custom_rooms; if (r) map.set(String(r.id), r); });
        const list = [...map.values()]
            .filter(r => !r.expires_at || new Date(r.expires_at).getTime() > Date.now())
            .sort((a, b) => (String(b.owner_id) === me()) - (String(a.owner_id) === me()));
        try {
            const { data: cnt } = await c.rpc('room_member_counts', { p_ids: list.map(r => r.id) });
            const cm = new Map((cnt || []).map(x => [String(x.room_id), Number(x.members) || 0]));
            list.forEach(r => { r.members = cm.get(String(r.id)) || 1; });
        } catch (e) { /* العدد اختياري */ }
        return list;
    }

    // الغرف العامة من عرض public_rooms (لا يحوي الرمز)
    async function loadPublicRooms() {
        const c = db();
        if (!c) throw new Error('no_db');
        const { data, error } = await c.from('public_rooms')
            .select('id, name, emoji, owner_id, expires_at, requires_code, members')
            .order('members', { ascending: false }).limit(100);
        if (error) throw error;
        return data || [];
    }

    const emptyBox = (icon, txt) => `<div class="rm-empty">${ic(icon, 26)}<span>${txt}</span></div>`;

    function roomCardHtml(r, pub) {
        const owner = String(r.owner_id) === me();
        const member = owner || !pub;   // غرفي: أنا مالكها أو عضو فيها
        const locked = !!r.requires_code;
        const data = {
            id: r.id, name: r.name, owner_id: r.owner_id, emoji: r.emoji, expires_at: r.expires_at,
            code: owner ? r.code : null, requires_code: locked, pub: !!pub, member
        };
        const status = locked
            ? `<span class="rm-st locked">${ic('lock', 12)}${T('rmLockedTag', 'مقفل', 'Locked')}</span>`
            : `<span class="rm-st open"><i class="rm-dot"></i>${T('rmOpenTag', 'مفتوح', 'Open')}</span>`;
        const exp = expLabel(r.expires_at);
        const sub = `<span class="rm-sub-i">${ic('users', 13)}<b>${Number(r.members) || 0}</b></span>${status}`
            + (exp ? `<span class="rm-sub-i rm-exp">${esc(exp)}</span>` : '');

        let chip;
        if (owner) chip = `<span class="rm-chip owner">${ic('crown', 12)}${T('rmOwnerTag', 'مالك', 'Owner')}</span>`;
        else if (!pub) chip = `<span class="rm-chip open">${ic('check', 12)}${T('rmMemberTag', 'عضو', 'Joined')}</span>`;
        else chip = `<span class="rm-chip club">${ic(locked ? 'key' : 'enter', 12)}${locked ? T('rmNeedCode', 'برمز', 'Code') : T('rmJoin', 'انضمام', 'Join')}</span>`;

        return `
        <div class="rm-card rm-room ${owner ? 'owner' : ''} ${locked ? 'is-locked' : 'is-open'}" data-room='${esc(JSON.stringify(data))}'>
            <div class="rm-av-box">${avatar(r.emoji, 20)}</div>
            <div class="info">
                <div class="name">${esc(r.name)}</div>
                <div class="sub">${sub}</div>
            </div>
            ${chip}
        </div>`;
    }

    async function joinPublic(room, code) {
        const c = db();
        if (!c) throw new Error('no_db');
        const { error } = await c.rpc('join_public_room', { p_room: String(room.id), p_code: code || '', p_actor: me() });
        if (error) throw error;
    }

    // نافذة إدخال الرمز لغرفة عامة: تعرض الخطأ داخلها ولا تُغلق إلا عند النجاح
    function roomCodeSheet(room) {
        return new Promise(resolve => {
            const el = document.createElement('div');
            el.className = 'rm-sheet center';
            el.dir = isAr() ? 'rtl' : 'ltr';
            el.innerHTML = `<div>
                <div class="rm-hero">${avatar(room.emoji, 34)}</div>
                <h3 class="rm-mt">${esc(room.name)}</h3>
                <p class="rm-mp">${ic('lock', 15)}<span>${T('rmCodeAsk', 'أدخل رمز الغرفة للانضمام', 'Enter the room code to join')}</span></p>
                <input class="rm-search rm-code" id="rm-code" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false"
                       placeholder="${esc(T('rmJoinPh', 'أدخل رمز الغرفة', 'Enter the room code'))}">
                <p class="rm-err" id="rm-err" hidden></p>
                <button class="primary" data-do="ok">${ic('enter', 18)}<span>${T('rmEnterBtn', 'دخول', 'Enter')}</span></button>
                <button data-do="cancel">${T('rmCancel', 'إلغاء', 'Cancel')}</button>
            </div>`;
            document.body.appendChild(el);
            const inp = el.querySelector('#rm-code');
            const err = el.querySelector('#rm-err');
            let busy = false;
            const done = v => { el.remove(); resolve(v); };
            const showErr = msg => { err.textContent = msg; err.hidden = false; inp.classList.add('bad'); };
            const submit = async () => {
                if (busy) return;
                const code = inp.value.trim().toUpperCase();
                if (!code) { showErr(T('rmCodeEmpty', 'أدخل الرمز أولاً', 'Enter the code first')); return; }
                busy = true;
                try {
                    await joinPublic(room, code);
                    busy = false;
                    done(true);
                } catch (e) {
                    busy = false;
                    console.error('[rooms] code join failed:', e);
                    showErr(errText(e));
                }
            };
            el.addEventListener('click', e => {
                if (e.target === el) return done(false);
                const b = e.target.closest('[data-do]');
                if (!b) return;
                if (b.dataset.do === 'ok') submit(); else done(false);
            });
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
            inp.addEventListener('input', () => { err.hidden = true; inp.classList.remove('bad'); });
            setTimeout(() => inp.focus(), 60);
        });
    }

    async function enterPublicRoom(room) {
        if (room.requires_code) {
            const ok = await roomCodeSheet(room);
            if (ok) openCustomRoom(room);
            return;
        }
        try {
            await joinPublic(room, '');
            openCustomRoom(room);
        } catch (err) {
            console.error('[rooms] public join failed:', err);
            toast(errText(err));
        }
    }

    async function renderRoomsSection(container) {
        if (!container) return;
        ensureCss();
        const wrap = document.createElement('div');
        wrap.className = 'rm-section';
        const loading = emptyBox('alert', T('rmLoading', 'جاري التحميل...', 'Loading...'));
        wrap.innerHTML = `
            <div class="rm-sec-head">${ic('chat', 20)}<span>${T('rmTitle', 'الغرف', 'Rooms')}</span></div>
            <div class="rm-actions">
                <button data-act="create" class="rm-btn-main">${ic('plus', 18)}<span>${T('rmCreateTitle', 'إنشاء غرفة', 'Create room')}</span></button>
                <button data-act="join">${ic('key', 18)}<span>${T('rmJoinTitle', 'الانضمام بالرمز', 'Join with code')}</span></button>
            </div>
            <div class="rm-sub-head">${ic('list', 16)}<span>${T('rmMyRoomsH', 'غرفي', 'My rooms')}</span></div>
            <div class="rm-mine">${loading}</div>
            <div class="rm-sub-head">${ic('globe', 16)}<span>${T('rmPublicH', 'الغرف العامة', 'Public rooms')}</span></div>
            <div class="rm-pub">${loading}</div>`;
        container.appendChild(wrap);
        const mineEl = wrap.querySelector('.rm-mine');
        const pubEl = wrap.querySelector('.rm-pub');

        const load = async () => {
            let mineIds = new Set();
            try {
                const mine = await loadMyRooms();
                mineIds = new Set(mine.map(r => String(r.id)));
                mineEl.innerHTML = mine.length
                    ? mine.map(r => roomCardHtml(r, false)).join('')
                    : emptyBox('chat', T('rmNoRooms', 'ليس لديك غرف بعد. أنشئ غرفة أو انضم برمز.', 'No rooms yet. Create one or join with a code.'));
            } catch (err) {
                console.error('[rooms] my rooms failed:', err);
                mineEl.innerHTML = emptyBox('alert', T('rmLoadFail', 'تعذر التحميل', 'Could not load'));
            }
            try {
                const pub = (await loadPublicRooms()).filter(r => !mineIds.has(String(r.id)));
                pubEl.innerHTML = pub.length
                    ? pub.map(r => roomCardHtml(r, true)).join('')
                    : emptyBox('globe', T('rmNoPublic', 'لا توجد غرف عامة الآن', 'No public rooms right now'));
            } catch (err) {
                console.error('[rooms] public rooms failed:', err);
                pubEl.innerHTML = emptyBox('alert', T('rmLoadFail', 'تعذر التحميل', 'Could not load'));
            }
        };

        wrap.addEventListener('click', e => {
            const act = e.target.closest('[data-act]');
            if (act) {
                if (act.dataset.act === 'create') createRoomFlow(); else joinFlow();
                return;
            }
            const card = e.target.closest('[data-room]');
            if (!card) return;
            let room;
            try { room = JSON.parse(card.dataset.room); } catch (err) { return; }
            if (room.member || !room.pub) openCustomRoom(room);   // عضو سابقاً: دخول مباشر بلا رمز
            else enterPublicRoom(room);
        });

        // تحديث القائمتين عند إنشاء/انضمام/مغادرة/حذف غرفة
        const refresh = () => {
            if (!wrap.isConnected) { document.removeEventListener('rooms:changed', refresh); return; }
            load();
        };
        document.addEventListener('rooms:changed', refresh);
        load();
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

    window.renderRoomsSection = renderRoomsSection;
    window.renderRoomsHub = renderMessagesPage;   // لا نربطها بتبويب الرسائل: الغرف تُدار من الشريط الجانبي في صفحة المباريات
    window.openMatchRoom = openMatchRoom;
    window.openClubRoom = openClubRoom;
    window.openCustomRoom = openCustomRoom;
    window.joinRoomByCode = joinRoomByCode;
    window.closeRoom = closeRoom;
    window.createRoomForMatch = createRoomForMatch;
    window.openRoomsDrawer = openRoomsDrawer;
    window.attachRoomsHandle = attachRoomsHandle;

    // قبول دعوة داخلية من الإشعار (بدون رمز)
    window.acceptRoomInvite = async function (roomId) {
        const c = db();
        if (!c || !me()) return;
        try {
            const { error } = await c.rpc('accept_room_invite', { p_room: String(roomId), p_actor: me() });
            if (error) throw error;
            const { data: room, error: e2 } = await c.from('custom_rooms')
                .select(ROOM_COLS).eq('id', roomId).maybeSingle();
            if (e2 || !room) throw e2 || new Error('room not found');
            openCustomRoom(room);
        } catch (err) {
            console.error('[rooms] accept invite failed:', err);
            toast(errText(err));
        }
    };

    watchInviteLink();
})();
