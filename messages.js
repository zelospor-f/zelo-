/* =====================================================================
   messages.js — صفحة الرسائل (الدردشة) على طريقة X
   ---------------------------------------------------------------------
   شغّل هذا SQL مرة واحدة في Supabase (SQL Editor):

   create table if not exists dm_messages (
     id bigint generated always as identity primary key,
     sender_id text not null,
     receiver_id text not null,
     content text not null,
     created_at timestamptz default now(),
     read_at timestamptz
   );
   create index if not exists dm_pair_idx on dm_messages (sender_id, receiver_id, created_at desc);
   create table if not exists dm_prefs (
     user_id text not null,
     other_id text not null,
     pinned boolean default false,
     muted boolean default false,
     unread_mark boolean default false,
     deleted_at timestamptz,
     primary key (user_id, other_id)
   );
   alter table dm_messages enable row level security;
   alter table dm_prefs enable row level security;
   create policy "dm_all" on dm_messages for all using (true) with check (true);
   create policy "dmp_all" on dm_prefs for all using (true) with check (true);
   ===================================================================== */
(function () {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const isAr = () => US().lang === 'ar';
    const T = (ar, en) => isAr() ? ar : en;
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const me = () => ({ id: String(US().userId || '') });
    const avatarUrl = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'P')}&background=0c0e20&color=00FF87&size=96&bold=true`;

    // ===== حالة =====
    const profCache = {};           // uid -> {name, avatar, username, badge}
    let prefs = {};                 // other_id -> صف dm_prefs
    let blockedByMe = new Set();
    let convs = [];
    let listEl = null, listTimer = null, filterText = '';
    let chat = null;                // {uid, timer, lastSig}

    // ===== أدوات =====
    const pickName = r => r.display_name || r.nickname || r.name || r.full_name ||
        (isAr() ? (r.nickname_ar || r.nickname_en) : (r.nickname_en || r.nickname_ar)) || '';
    const pickPhoto = r => r.photo_url || r.photoUrl || r.avatar_url || r.avatar || r.photo || '';
    const badgeHtml = (uid, size = 15) => {
        const p = profCache[uid];
        return (p && p.badge && typeof window.zeloVerifiedBadge === 'function') ? window.zeloVerifiedBadge(p.badge, size) : '';
    };
    const nameOf = uid => (profCache[uid] && (profCache[uid].name || profCache[uid].username)) || T('مستخدم', 'User');

    function ago(iso) {
        const s = (Date.now() - new Date(iso).getTime()) / 1000;
        if (s < 60) return T('الآن', 'now');
        const m = Math.floor(s / 60); if (m < 60) return m + T('د', 'm');
        const h = Math.floor(m / 60); if (h < 24) return h + T('س', 'h');
        const d = Math.floor(h / 24); if (d < 7) return d + T('ي', 'd');
        return new Date(iso).toLocaleDateString();
    }
    function clock(iso) {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function loadProfiles(ids) {
        const c = db();
        ids = [...new Set(ids.map(String))].filter(id => id && !profCache[id]);
        if (!c || !ids.length) return;
        ids.forEach(id => { profCache[id] = { name: '', avatar: '', username: '', badge: '' }; });
        try {
            const { data } = await c.from('public_profiles').select('*').in('user_id', ids);
            (data || []).forEach(r => {
                profCache[String(r.user_id)] = {
                    name: pickName(r), avatar: pickPhoto(r),
                    username: r.username || '', badge: r.badge_club ? String(r.badge_club) : ''
                };
            });
            // ما لم نجد له اسمًا أو صورة نأخذه من منشوراته
            const missing = ids.filter(id => !profCache[id].name || !profCache[id].avatar);
            if (missing.length) {
                const { data: ps } = await c.from('posts').select('user_id,author_name,author_avatar')
                    .in('user_id', missing).order('created_at', { ascending: false }).limit(200);
                (ps || []).forEach(p => {
                    const o = profCache[String(p.user_id)];
                    if (!o) return;
                    if (!o.name) o.name = p.author_name || '';
                    if (!o.avatar) o.avatar = p.author_avatar || '';
                });
            }
        } catch (e) { console.error('[ZELO] dm loadProfiles:', e); }
    }

    function openProfile(uid) {
        if (typeof window.openUserProfile === 'function') window.openUserProfile(uid);
    }

    // ===== القائمة السفلية (للضغط المطوّل وللنقاط الثلاث) =====
    function openSheet(items, title) {
        const ov = document.createElement('div');
        ov.className = 'dm-sheet-ov';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const sh = document.createElement('div');
        sh.className = 'dm-sheet';
        if (title) { const t = document.createElement('div'); t.className = 'dm-sheet-t'; t.textContent = title; sh.appendChild(t); }
        items.forEach(it => {
            const b = document.createElement('button');
            b.className = 'dm-sheet-i' + (it.danger ? ' danger' : '');
            b.innerHTML = `<span>${it.icon}</span><span>${esc(it.label)}</span>`;
            b.onclick = () => { ov.remove(); it.action(); };
            sh.appendChild(b);
        });
        ov.appendChild(sh);
        document.body.appendChild(ov);
    }

    // ===== التفضيلات: تثبيت / كتم / غير مقروءة / حذف =====
    async function setPref(uid, patch) {
        const c = db(); const mine = me().id;
        if (!c || !mine) return;
        const row = Object.assign({ user_id: mine, other_id: uid }, prefs[uid] || {}, patch);
        prefs[uid] = row;
        const { error } = await c.from('dm_prefs').upsert([row], { onConflict: 'user_id,other_id' });
        if (error) alert(error.message);
        renderList();
    }

    function convMenu(uid) {
        const p = prefs[uid] || {};
        const cv = convs.find(x => x.uid === uid);
        const isUnread = p.unread_mark || (cv && cv.unread > 0);
        openSheet([
            {
                icon: '💬', label: isUnread ? T('تحديد كمقروءة', 'Mark as read') : T('تحديد كغير مقروءة', 'Mark as unread'),
                action: async () => {
                    if (isUnread) {
                        await db().from('dm_messages').update({ read_at: new Date().toISOString() })
                            .eq('receiver_id', me().id).eq('sender_id', uid).is('read_at', null);
                        await setPref(uid, { unread_mark: false });
                        loadList();
                    } else setPref(uid, { unread_mark: true });
                }
            },
            { icon: p.muted ? '🔔' : '🔕', label: p.muted ? T('إلغاء كتم المحادثة', 'Unmute conversation') : T('كتم المحادثة', 'Mute conversation'), action: () => setPref(uid, { muted: !p.muted }) },
            { icon: '📌', label: p.pinned ? T('إلغاء تثبيت المحادثة', 'Unpin conversation') : T('تثبيت المحادثة', 'Pin conversation'), action: () => setPref(uid, { pinned: !p.pinned }) },
            {
                icon: '🗑️', label: T('حذف المحادثة', 'Delete conversation'), danger: true,
                action: () => { if (confirm(T('حذف هذه المحادثة؟', 'Delete this conversation?'))) setPref(uid, { deleted_at: new Date().toISOString(), pinned: false }); }
            }
        ], nameOf(uid));
    }

    // ===== قائمة المحادثات =====
    async function loadList() {
        const c = db(); const mine = me().id;
        if (!c || !mine || !listEl) return;
        try {
            const [m, p, b] = await Promise.all([
                c.from('dm_messages').select('*').or(`sender_id.eq.${mine},receiver_id.eq.${mine}`)
                    .order('created_at', { ascending: false }).limit(500),
                c.from('dm_prefs').select('*').eq('user_id', mine),
                c.from('user_blocks').select('blocked_id').eq('user_id', mine)
            ]);
            if (m.error) { listEl.innerHTML = `<div class="dm-empty">❌ ${esc(m.error.message)}</div>`; return; }
            prefs = {}; (p.data || []).forEach(r => { prefs[String(r.other_id)] = r; });
            blockedByMe = new Set((b.data || []).map(r => String(r.blocked_id)));

            const map = {};
            (m.data || []).forEach(x => {
                const other = String(x.sender_id) === mine ? String(x.receiver_id) : String(x.sender_id);
                const del = prefs[other] && prefs[other].deleted_at;
                if (del && new Date(x.created_at) <= new Date(del)) return;
                if (!map[other]) map[other] = { uid: other, last: x, unread: 0 };
                if (String(x.receiver_id) === mine && !x.read_at) map[other].unread++;
            });
            convs = Object.values(map).sort((a, b2) => {
                const pa = prefs[a.uid] && prefs[a.uid].pinned ? 1 : 0;
                const pb = prefs[b2.uid] && prefs[b2.uid].pinned ? 1 : 0;
                if (pa !== pb) return pb - pa;
                return new Date(b2.last.created_at) - new Date(a.last.created_at);
            });
            await loadProfiles(convs.map(x => x.uid));
            renderList();
        } catch (e) { console.error('[ZELO] dm loadList:', e); }
    }

    function renderList() {
        if (!listEl) return;
        const q = filterText.trim().toLowerCase();
        const rows = convs.filter(cv => !q || nameOf(cv.uid).toLowerCase().includes(q) ||
            ((profCache[cv.uid] || {}).username || '').toLowerCase().includes(q));
        if (!rows.length) {
            listEl.innerHTML = `<div class="dm-empty">${T('لا توجد محادثات بعد', 'No conversations yet')}</div>`;
            return;
        }
        listEl.innerHTML = rows.map(cv => {
            const pr = profCache[cv.uid] || {};
            const pf = prefs[cv.uid] || {};
            const unread = cv.unread > 0 || pf.unread_mark;
            const mineLast = String(cv.last.sender_id) === me().id;
            return `
            <div class="dm-item" data-uid="${esc(cv.uid)}">
                <img class="dm-av" src="${esc(avatarUrl(pr.name, pr.avatar))}" onerror="this.style.display='none'">
                <div class="dm-body">
                    <div class="dm-row1">
                        <span class="dm-name">${esc(nameOf(cv.uid))}${badgeHtml(cv.uid)}</span>
                        ${pf.pinned ? '<span class="dm-ic">📌</span>' : ''}${pf.muted ? '<span class="dm-ic">🔕</span>' : ''}
                        <span class="dm-time">${esc(ago(cv.last.created_at))}</span>
                    </div>
                    <div class="dm-row2 ${unread ? 'unread' : ''}">
                        <span class="dm-last">${mineLast ? T('أنت: ', 'You: ') : ''}${esc(cv.last.content)}</span>
                        ${unread ? `<span class="dm-dot">${cv.unread > 0 ? cv.unread : ''}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // ضغط مطوّل + نقرة (تفويض أحداث)
    function bindListEvents() {
        let timer = null, long = false, sx = 0, sy = 0;
        const clear = () => { clearTimeout(timer); timer = null; };
        listEl.addEventListener('touchstart', e => {
            const it = e.target.closest('.dm-item'); if (!it) return;
            long = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
            timer = setTimeout(() => { long = true; if (navigator.vibrate) navigator.vibrate(15); convMenu(it.dataset.uid); }, 500);
        }, { passive: true });
        listEl.addEventListener('touchmove', e => {
            if (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10) clear();
        }, { passive: true });
        listEl.addEventListener('touchend', clear);
        listEl.addEventListener('touchcancel', clear);
        listEl.addEventListener('contextmenu', e => {
            const it = e.target.closest('.dm-item');
            if (it) { e.preventDefault(); convMenu(it.dataset.uid); }
        });
        listEl.addEventListener('click', e => {
            if (long) { long = false; return; }
            const it = e.target.closest('.dm-item'); if (!it) return;
            if (e.target.closest('.dm-av')) { openProfile(it.dataset.uid); return; }
            window.openChat(it.dataset.uid);
        });
    }

    // ===== محادثة جديدة (بحث باسم المستخدم) =====
    function newChatSheet() {
        const ov = document.createElement('div');
        ov.className = 'dm-sheet-ov';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        ov.innerHTML = `<div class="dm-sheet">
            <div class="dm-sheet-t">${T('محادثة جديدة', 'New message')}</div>
            <input class="dm-search" id="dm-new-q" placeholder="${T('ابحث باسم المستخدم', 'Search by username')}" style="margin:6px 12px;width:calc(100% - 24px)">
            <div id="dm-new-res" style="max-height:50vh;overflow-y:auto"></div></div>`;
        document.body.appendChild(ov);
        const inp = ov.querySelector('#dm-new-q'), res = ov.querySelector('#dm-new-res');
        let t = null;
        inp.oninput = () => {
            clearTimeout(t);
            t = setTimeout(async () => {
                const q = inp.value.trim().replace(/^@/, '');
                if (q.length < 2) { res.innerHTML = ''; return; }
                const { data } = await db().from('public_profiles').select('*').ilike('username', `%${q}%`).limit(15);
                const rows = (data || []).filter(r => String(r.user_id) !== me().id);
                rows.forEach(r => {
                    profCache[String(r.user_id)] = {
                        name: pickName(r), avatar: pickPhoto(r), username: r.username || '',
                        badge: r.badge_club ? String(r.badge_club) : ''
                    };
                });
                res.innerHTML = rows.length ? rows.map(r => {
                    const id = String(r.user_id), p = profCache[id];
                    return `<button class="dm-sheet-i" data-uid="${esc(id)}">
                        <img src="${esc(avatarUrl(p.name || p.username, p.avatar))}" style="width:34px;height:34px;border-radius:50%;object-fit:cover">
                        <span>${esc(p.name || p.username)} <small style="color:#7a7f9a;direction:ltr;display:inline-block">@${esc(p.username)}</small></span></button>`;
                }).join('') : `<div class="dm-empty">${T('لا نتائج', 'No results')}</div>`;
            }, 300);
        };
        res.onclick = e => {
            const b = e.target.closest('[data-uid]'); if (!b) return;
            ov.remove(); window.openChat(b.dataset.uid);
        };
        setTimeout(() => inp.focus(), 50);
    }

    // ===== شاشة المحادثة =====
    window.openChat = async function (uid, name, avatar) {
        uid = String(uid || '');
        if (!uid || uid === me().id || !db()) return;
        closeChat();
        await loadProfiles([uid]);
        const p = profCache[uid];
        if (name && !p.name) p.name = name;
        if (avatar && !p.avatar) p.avatar = avatar;

        const ov = document.createElement('div');
        ov.id = 'dm-chat';
        ov.className = 'dm-chat';
        ov.innerHTML = `
            <div class="dm-head">
                <button class="dm-hbtn" id="dm-back">${isAr() ? '→' : '←'}</button>
                <img class="dm-hav" id="dm-hav" src="${esc(avatarUrl(p.name, p.avatar))}" onerror="this.style.display='none'">
                <div class="dm-hname" id="dm-hname">${esc(nameOf(uid))}${badgeHtml(uid, 16)}</div>
                <button class="dm-hbtn" id="dm-more">⋮</button>
            </div>
            <div class="dm-msgs" id="dm-msgs"></div>
            <div class="dm-notice" id="dm-notice" style="display:none"></div>
            <div class="dm-inputbar" id="dm-inputbar">
                <input class="dm-input" id="dm-input" placeholder="${T('رسالة', 'Message')}" autocomplete="off">
                <button class="dm-send" id="dm-send">➤</button>
            </div>`;
        document.body.appendChild(ov);
        chat = { uid, timer: null, sig: '' };

        ov.querySelector('#dm-back').onclick = closeChat;
        ov.querySelector('#dm-hav').onclick = () => openProfile(uid);
        ov.querySelector('#dm-hname').onclick = () => openProfile(uid);
        ov.querySelector('#dm-more').onclick = () => chatMenu(uid);
        ov.querySelector('#dm-send').onclick = sendMsg;
        ov.querySelector('#dm-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });

        await refreshChat(true);
        chat.timer = setInterval(() => refreshChat(false), 3000);
    };

    function closeChat() {
        if (chat && chat.timer) clearInterval(chat.timer);
        chat = null;
        const o = document.getElementById('dm-chat');
        if (o) o.remove();
        loadList();
    }

    function chatMenu(uid) {
        const blocked = blockedByMe.has(uid);
        openSheet([
            { icon: '👤', label: T('عرض الملف الشخصي', 'View profile'), action: () => openProfile(uid) },
            {
                icon: '🚫', label: blocked ? T('إلغاء الحظر', 'Unblock') : T('حظر', 'Block'), danger: !blocked,
                action: async () => {
                    const c = db(), mine = me().id;
                    if (!blocked) {
                        if (!confirm(T('حظر هذا المستخدم؟ لن يستطيع مراسلتك ولن تستطيع مراسلته.', 'Block this user?'))) return;
                        const { error } = await c.from('user_blocks').insert([{ user_id: mine, blocked_id: uid }]);
                        if (error && error.code !== '23505') { alert(error.message); return; }
                        await c.from('user_follows').delete().eq('follower_id', mine).eq('following_id', uid);
                        blockedByMe.add(uid);
                    } else {
                        const { error } = await c.from('user_blocks').delete().eq('user_id', mine).eq('blocked_id', uid);
                        if (error) { alert(error.message); return; }
                        blockedByMe.delete(uid);
                    }
                    applyBlockState();
                }
            }
        ], nameOf(uid));
    }

    function applyBlockState() {
        if (!chat) return;
        const n = document.getElementById('dm-notice'), bar = document.getElementById('dm-inputbar');
        if (!n || !bar) return;
        const b = blockedByMe.has(chat.uid);
        n.style.display = b ? 'block' : 'none';
        n.textContent = T('لقد حظرت هذا المستخدم. ألغِ الحظر لإرسال الرسائل.', 'You blocked this user. Unblock to send messages.');
        bar.style.display = b ? 'none' : 'flex';
    }

    async function refreshChat(first) {
        const c = db(), mine = me().id;
        if (!chat || !c) return;
        const uid = chat.uid;
        if (first) {
            const { data } = await c.from('user_blocks').select('blocked_id').eq('user_id', mine);
            blockedByMe = new Set((data || []).map(r => String(r.blocked_id)));
            applyBlockState();
        }
        const { data, error } = await c.from('dm_messages').select('*')
            .or(`and(sender_id.eq.${mine},receiver_id.eq.${uid}),and(sender_id.eq.${uid},receiver_id.eq.${mine})`)
            .order('created_at', { ascending: true }).limit(300);
        if (!chat || chat.uid !== uid) return;
        if (error) { const b = document.getElementById('dm-msgs'); if (b) b.innerHTML = `<div class="dm-empty">❌ ${esc(error.message)}</div>`; return; }

        const del = prefs[uid] && prefs[uid].deleted_at;
        const msgs = (data || []).filter(x => !del || new Date(x.created_at) > new Date(del));
        const sig = msgs.map(x => x.id + ':' + (x.read_at ? 1 : 0)).join(',');
        if (sig !== chat.sig || first) {
            chat.sig = sig;
            renderMsgs(msgs);
        }
        // تعليم الواردة كمقروءة
        if (msgs.some(x => String(x.receiver_id) === mine && !x.read_at)) {
            await c.from('dm_messages').update({ read_at: new Date().toISOString() })
                .eq('receiver_id', mine).eq('sender_id', uid).is('read_at', null);
        }
        if (first && prefs[uid] && prefs[uid].unread_mark) setPref(uid, { unread_mark: false });
    }

    function renderMsgs(msgs) {
        const box = document.getElementById('dm-msgs');
        if (!box) return;
        const mine = me().id;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        const lastMine = [...msgs].reverse().find(x => String(x.sender_id) === mine);
        box.innerHTML = msgs.length ? msgs.map(x => {
            const isMine = String(x.sender_id) === mine;
            return `<div class="dm-b ${isMine ? 'me' : 'them'}" dir="auto">${esc(x.content)}
                <div class="dm-bt">${esc(clock(x.created_at))}</div></div>
                ${isMine && lastMine && lastMine.id === x.id && x.read_at ? `<div class="dm-seen">${T('تمت المشاهدة', 'Seen')}</div>` : ''}`;
        }).join('') : `<div class="dm-empty">${T('ابدأ المحادثة', 'Say hi 👋')}</div>`;
        if (nearBottom || !box.dataset.init) { box.scrollTop = box.scrollHeight; box.dataset.init = '1'; }
    }

    async function sendMsg() {
        const c = db(), mine = me().id;
        const inp = document.getElementById('dm-input');
        if (!chat || !c || !inp) return;
        const text = inp.value.trim();
        if (!text) return;
        const uid = chat.uid;
        if (blockedByMe.has(uid)) return;
        // هل حظرني الطرف الآخر؟
        const { data: bl } = await c.from('user_blocks').select('blocked_id').eq('user_id', uid).eq('blocked_id', mine).limit(1);
        if (bl && bl.length) { alert(T('لا يمكنك مراسلة هذا المستخدم.', 'You cannot message this user.')); return; }
        inp.value = '';
        const { error } = await c.from('dm_messages').insert([{ sender_id: mine, receiver_id: uid, content: text }]);
        if (error) { alert(error.message); inp.value = text; return; }
        if (prefs[uid] && prefs[uid].deleted_at) { /* الرسالة الجديدة أحدث من وقت الحذف فتظهر تلقائيًا */ }
        refreshChat(false);
    }

    // ===== رسم الصفحة =====
    const STYLES = `
    .dm-wrap { padding: 8px 12px 90px; }
    .dm-title { color:#fff; font-weight:900; font-size:1.15rem; text-align:center; padding:10px 0; }
    .dm-search { width:100%; box-sizing:border-box; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:999px; padding:10px 16px; font-size:0.9rem; outline:none; }
    .dm-item { display:flex; gap:12px; align-items:center; padding:12px 4px; cursor:pointer; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
    .dm-item:active { background:rgba(255,255,255,0.05); }
    .dm-av { width:52px; height:52px; min-width:52px; border-radius:50%; object-fit:cover; }
    .dm-body { flex:1; min-width:0; }
    .dm-row1,.dm-row2 { display:flex; align-items:center; gap:6px; }
    .dm-name { color:#fff; font-weight:900; font-size:0.92rem; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:3px; }
    .dm-time { color:#7a7f9a; font-size:0.72rem; }
    .dm-ic { font-size:0.7rem; }
    .dm-last { color:#94a3b8; font-size:0.84rem; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .dm-row2.unread .dm-last { color:#fff; font-weight:800; }
    .dm-dot { background:#1d9bf0; color:#fff; min-width:10px; height:10px; border-radius:999px; font-size:0.65rem; font-weight:900; padding:0 5px; display:flex; align-items:center; justify-content:center; }
    .dm-dot:not(:empty) { height:auto; min-width:18px; padding:1px 5px; }
    .dm-empty { color:#7a7f9a; text-align:center; padding:40px 16px; font-weight:700; }
    .dm-fab { position:fixed; bottom:92px; inset-inline-start:18px; width:56px; height:56px; border-radius:50%; border:none; background:#1d9bf0; color:#fff; font-size:1.5rem; z-index:1500; box-shadow:0 6px 20px rgba(29,155,240,0.5); cursor:pointer; }

    .dm-sheet-ov { position:fixed; inset:0; z-index:4000; background:rgba(0,0,0,0.55); display:flex; align-items:flex-end; justify-content:center; }
    .dm-sheet { width:100%; max-width:520px; background:#1a1d2e; border-radius:18px 18px 0 0; padding:8px 0 18px; max-height:80vh; overflow-y:auto; }
    .dm-sheet-t { color:#7a7f9a; font-weight:800; text-align:center; padding:8px; font-size:0.85rem; }
    .dm-sheet-i { display:flex; align-items:center; gap:14px; width:100%; background:none; border:none; color:#fff; padding:14px 20px; font-size:0.95rem; font-weight:800; cursor:pointer; text-align:start; }
    .dm-sheet-i:active { background:rgba(255,255,255,0.06); }
    .dm-sheet-i.danger { color:#f4212e; }

    .dm-chat { position:fixed; inset:0; z-index:3500; background:#121215; display:flex; flex-direction:column; }
    .dm-head { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08); }
    .dm-hbtn { background:none; border:none; color:#fff; font-size:1.4rem; width:38px; height:38px; cursor:pointer; }
    .dm-hav { width:38px; height:38px; border-radius:50%; object-fit:cover; cursor:pointer; }
    .dm-hname { flex:1; min-width:0; color:#fff; font-weight:900; display:flex; align-items:center; gap:4px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer; }
    .dm-msgs { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:6px; direction:ltr; }
    .dm-b { max-width:78%; padding:9px 13px; border-radius:18px; font-size:0.92rem; line-height:1.5; word-break:break-word; white-space:pre-wrap; unicode-bidi:plaintext; }
    .dm-b.me { align-self:flex-end; background:#1d9bf0; color:#fff; border-bottom-right-radius:4px; }
    .dm-b.them { align-self:flex-start; background:#2a2d3d; color:#fff; border-bottom-left-radius:4px; }
    .dm-bt { font-size:0.62rem; opacity:0.65; margin-top:3px; text-align:end; }
    .dm-seen { align-self:flex-end; color:#7a7f9a; font-size:0.7rem; padding:0 4px; }
    .dm-notice { text-align:center; color:#94a3b8; padding:12px; font-size:0.85rem; font-weight:700; border-top:1px solid rgba(255,255,255,0.08); }
    .dm-inputbar { display:flex; gap:8px; padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px)); border-top:1px solid rgba(255,255,255,0.08); }
    .dm-input { flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:999px; padding:11px 16px; font-size:0.95rem; outline:none; }
    .dm-send { width:44px; height:44px; border-radius:50%; border:none; background:#1d9bf0; color:#fff; font-size:1.1rem; cursor:pointer; }`;

    window.renderMessagesPage = function (container) {
        if (!container) return;
        if (!document.getElementById('dm-styles')) {
            const st = document.createElement('style');
            st.id = 'dm-styles';
            st.textContent = STYLES;
            document.head.appendChild(st);
        }
        container.innerHTML = `
            <div class="dm-wrap">
                <div class="dm-title">${T('الدردشة', 'Messages')}</div>
                <input class="dm-search" id="dm-filter" placeholder="${T('بحث', 'Search')}">
                <div id="dm-list"><div class="dm-empty">${T('جارٍ التحميل...', 'Loading...')}</div></div>
            </div>
            <button class="dm-fab" id="dm-fab">✉️</button>`;
        listEl = container.querySelector('#dm-list');
        filterText = '';
        container.querySelector('#dm-filter').oninput = e => { filterText = e.target.value; renderList(); };
        container.querySelector('#dm-fab').onclick = newChatSheet;
        bindListEvents();
        loadList();

        if (listTimer) clearInterval(listTimer);
        listTimer = setInterval(() => {
            if (!document.body.contains(listEl)) {          // غادر المستخدم الصفحة
                clearInterval(listTimer); listTimer = null;
                const f = document.getElementById('dm-fab'); if (f) f.remove();
                return;
            }
            if (!chat) loadList();
        }, 10000);
    };
})();
