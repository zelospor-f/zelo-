/* ============================================================
   notifications.js — صفحة الإشعارات + شارة الشريط السفلي
   ------------------------------------------------------------
   المصدر: جدول Supabase باسم `notifications` (إن وُجد)، ومعه
   إشعارات محلية في localStorage كاحتياط (تعمل بدون سيرفر).

   أعمدة الجدول المتوقعة:
     id (uuid/bigint), user_id (text), type (text),
     title_ar, title_en, body_ar, body_en (text),
     is_read (bool, default false), created_at (timestamptz)

   واجهة للملفات الأخرى:
     window.addNotification({type, title_ar, title_en, body_ar, body_en})
     window.refreshNotifBadge()
     window.renderNotificationsPage(container)
   ============================================================ */
(function () {
    'use strict';

    const LS_KEY = 'zelo_notifications';
    const MAX_ITEMS = 100;

    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    // ترجمة عبر i18n-helpers.js (tr) مع نص احتياطي لكل لغة
    const T = (key, ar, en, params) => (window.tr ? window.tr(key, ar, en, params) : String(isAr() ? ar : en).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined) ? params[k] : m));
    const uid = () => String((window.userState && window.userState.userId) || localStorage.getItem('zelo_user_id') || '');

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const TYPES = {
        reward:   { icon: '🪙', color: '#f5c35a' },
        match:    { icon: '⚽', color: '#14F195' },
        task:     { icon: '⚡', color: '#ffd98a' },
        social:   { icon: '👥', color: '#5a7de8' },
        rank:     { icon: '🏆', color: '#7f9bff' },
        wallet:   { icon: '🔖', color: '#14F195' },
        system:   { icon: '📢', color: '#9aa6d6' }
    };
    const typeInfo = t => TYPES[t] || TYPES.system;

    /* ---------- التخزين المحلي ---------- */
    function lsRead() {
        try { return JSON.parse(localStorage.getItem(LS_KEY + '_' + uid()) || '[]') || []; }
        catch (e) { return []; }
    }
    function lsWrite(list) {
        try { localStorage.setItem(LS_KEY + '_' + uid(), JSON.stringify(list.slice(0, MAX_ITEMS))); } catch (e) {}
    }

    const hasDb = () => typeof supabaseClient !== 'undefined' && supabaseClient !== null;

    /* ---------- الجلب والدمج ---------- */
    // رابط صورة صالح فقط (https أو صورة مضمّنة)، وإلا نعرض الأيقونة
    function validPhoto(url) {
        return typeof url === 'string' && /^(https?:\/\/|data:image\/)/.test(url.trim());
    }

    async function attachActorPhotos(list) {
        // الصورة المحفوظة في الإشعار نفسه لها الأولوية
        list.forEach(n => { if (validPhoto(n.actor_avatar)) n._photo = n.actor_avatar.trim(); });
        list = list.filter(n => !n._photo);
        // احتياط للإشعارات التي لا تحمل صورة: نأخذ صورة آخر منشور كتبه صاحب الإجراء
        try {
            const aids = [...new Set(list.map(n => n.actor_id).filter(Boolean).map(String))];
            if (aids.length) {
                const { data: ps } = await supabaseClient.from('posts')
                    .select('user_id, author_avatar, created_at').in('user_id', aids)
                    .order('created_at', { ascending: false }).limit(300);
                const pm = {};
                (ps || []).forEach(r => { const k = String(r.user_id); if (!pm[k] && validPhoto(r.author_avatar)) pm[k] = r.author_avatar.trim(); });
                list.forEach(n => { if (pm[String(n.actor_id)]) n._photo = pm[String(n.actor_id)]; });
                list = list.filter(n => !n._photo);
            }
        } catch (e) {}
        const ids = [...new Set(list.map(n => n.actor_id).filter(Boolean).map(String))];
        if (!ids.length) return;
        try {
            const { data, error } = await supabaseClient
                .from('users').select('user_id, photo_url').in('user_id', ids);
            if (error || !Array.isArray(data)) return;
            const map = {};
            data.forEach(u => { map[String(u.user_id)] = u.photo_url; });
            list.forEach(n => {
                const url = map[String(n.actor_id)];
                if (validPhoto(url)) n._photo = url;
            });
        } catch (e) { /* نكتفي بالأيقونة */ }
    }

    async function fetchAll() {
        const local = lsRead().map(n => ({ ...n, _local: true }));
        let remote = [];
        if (hasDb()) {
            try {
                const { data, error } = await supabaseClient
                    .from('notifications')
                    .select('id, type, title_ar, title_en, body_ar, body_en, is_read, created_at, action, actor_id, actor_avatar')
                    .eq('user_id', uid())
                    .order('created_at', { ascending: false })
                    .limit(MAX_ITEMS);
                if (!error && Array.isArray(data)) remote = data;
            } catch (e) { /* الجدول غير موجود أو لا اتصال: نكتفي بالمحلي */ }
            await attachActorPhotos(remote);
        }
        return remote.concat(local)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, MAX_ITEMS);
    }

    /* ---------- تنسيق الوقت ---------- */
    function timeAgo(iso) {
        const t = new Date(iso).getTime();
        if (!isFinite(t)) return '';
        const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
        if (s < 60) return T('notifJustNow', 'الآن', 'Just now');
        const m = Math.floor(s / 60);
        if (m < 60) return T('notifMinAgo', 'منذ {n} د', '{n}m ago', { n: m });
        const h = Math.floor(m / 60);
        if (h < 24) return T('notifHourAgo', 'منذ {n} س', '{n}h ago', { n: h });
        const d = Math.floor(h / 24);
        if (d < 7) return T('notifDayAgo', 'منذ {n} يوم', '{n}d ago', { n: d });
        return new Date(t).toLocaleDateString(isAr() ? 'ar' : 'en-US');
    }

    /* ---------- الشارة ---------- */
    function setBadge(count) {
        const el = document.getElementById('notif-badge');
        if (!el) return;
        el.textContent = count > 99 ? '99+' : String(count);
        el.style.display = count > 0 ? 'block' : 'none';
    }

    async function refreshNotifBadge() {
        try {
            const list = await fetchAll();
            setBadge(list.filter(n => !n.is_read).length);
        } catch (e) {}
    }

    /* ---------- إضافة إشعار محلي ---------- */
    function addNotification(n) {
        n = n || {};
        const item = {
            id: 'loc_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: n.type || 'system',
            title_ar: n.title_ar || n.title_en || '',
            title_en: n.title_en || n.title_ar || '',
            body_ar: n.body_ar || n.body_en || '',
            body_en: n.body_en || n.body_ar || '',
            is_read: false,
            created_at: new Date().toISOString()
        };
        const list = lsRead();
        list.unshift(item);
        lsWrite(list);
        refreshNotifBadge();
        return item;
    }

    /* ---------- تعليم كمقروء ---------- */
    async function markRead(id, local) {
        if (local) {
            lsWrite(lsRead().map(n => String(n.id) === String(id) ? { ...n, is_read: true } : n));
        } else if (hasDb()) {
            try { await supabaseClient.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', uid()); } catch (e) {}
        }
    }

    async function markAllRead() {
        lsWrite(lsRead().map(n => ({ ...n, is_read: true })));
        if (hasDb()) {
            try { await supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', uid()).eq('is_read', false); } catch (e) {}
        }
    }

    async function clearAll() {
        lsWrite([]);
        if (hasDb()) {
            try { await supabaseClient.from('notifications').delete().eq('user_id', uid()); } catch (e) {}
        }
    }

    /* ---------- التصيير ---------- */
    const CSS = `
        <style>
            .nt-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:16px; }
            .nt-title {
                margin:0; font-size:1.35rem; font-weight:900;
                background: linear-gradient(135deg, #f5c35a, #ffd98a);
                -webkit-background-clip:text; -webkit-text-fill-color:transparent;
            }
            .nt-actions { display:flex; gap:8px; }
            .nt-btn {
                background: rgba(44,75,181,0.25); color:#f5c35a;
                border:1px solid rgba(245,195,90,0.35);
                padding:7px 12px; border-radius:16px;
                font-weight:800; font-size:0.74rem; cursor:pointer;
            }
            .nt-btn.danger { color:#ff6b6b; border-color: rgba(255,77,77,0.3); }
            .nt-item {
                display:flex; gap:12px; align-items:flex-start;
                background: linear-gradient(135deg, rgba(17,26,74,0.95), rgba(10,16,51,0.95));
                border:1px solid rgba(245,195,90,0.12);
                border-radius:18px; padding:12px 14px; margin-bottom:10px;
                cursor:pointer; transition: transform .2s;
            }
            .nt-item:active { transform: scale(0.985); }
            .nt-item.unread {
                border-color: rgba(245,195,90,0.55);
                background: linear-gradient(135deg, rgba(44,75,181,0.30), rgba(245,195,90,0.08));
                box-shadow: 0 0 12px rgba(245,195,90,0.2);
            }
            .nt-ico {
                width:42px; height:42px; min-width:42px; border-radius:14px;
                display:flex; align-items:center; justify-content:center; font-size:1.3rem;
                background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
            }
            .nt-body { flex:1; min-width:0; text-align:start; }
            .nt-row { display:flex; justify-content:space-between; gap:8px; align-items:center; }
            .nt-name { color:#fff; font-weight:800; font-size:0.92rem; line-height:1.35; }
            .nt-dot { width:9px; height:9px; border-radius:50%; background:#fd1d1d; box-shadow:0 0 6px #fd1d1d; flex-shrink:0; }
            .nt-text { color:#9aa6d6; font-size:0.8rem; margin-top:3px; line-height:1.5; word-break:break-word; }
            .nt-time { color:#7782b0; font-size:0.7rem; margin-top:5px; font-weight:700; }
            .nt-empty {
                text-align:center; padding:40px 20px; color:#9aa6d6;
                background: rgba(17,26,74,0.8); border-radius:18px;
                border:1px solid rgba(245,195,90,0.15); font-weight:700; font-size:0.88rem;
            }
            .nt-empty .big { font-size:2.4rem; margin-bottom:8px; }
        </style>`;

    function itemHtml(n) {
        const ti = typeInfo(n.type);
        const title = isAr() ? (n.title_ar || n.title_en) : (n.title_en || n.title_ar);
        const body  = isAr() ? (n.body_ar  || n.body_en)  : (n.body_en  || n.body_ar);
        return `
        <div class="nt-item ${n.is_read ? '' : 'unread'}" data-id="${esc(n.id)}" data-local="${n._local ? '1' : '0'}" data-action="${esc(n.action || '')}">
            <div class="nt-ico" style="color:${ti.color}; border-color:${ti.color}33; ${n._photo ? 'padding:0; overflow:hidden;' : ''}">${n._photo
                ? `<img src="${esc(n._photo)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`
                : ti.icon}</div>
            <div class="nt-body">
                <div class="nt-row">
                    <div class="nt-name">${esc(title)}</div>
                    ${n.is_read ? '' : '<span class="nt-dot"></span>'}
                </div>
                ${body ? `<div class="nt-text">${esc(body)}</div>` : ''}
                <div class="nt-time">${esc(timeAgo(n.created_at))}</div>
            </div>
        </div>`;
    }

    async function renderNotificationsPage(container) {
        container = container || document.getElementById('main-content');
        if (!container) return;

        container.innerHTML = `<style>@keyframes ntPulse{0%,100%{opacity:1}50%{opacity:.5}}</style>
            <div style="text-align:center;padding:40px;color:#f5c35a;font-weight:800;animation:ntPulse 1.5s infinite;">
                ${T('notifLoading', '⏳ جاري تحميل الإشعارات...', '⏳ Loading notifications...')}
            </div>`;

        let list = [];
        try { list = await fetchAll(); } catch (e) { console.error('Notifications error:', e); }

        const unread = list.filter(n => !n.is_read).length;

        container.innerHTML = `${CSS}
            <div class="nt-head">
                <h2 class="nt-title">🔔 ${T('notifTitle', 'الإشعارات', 'Notifications')}</h2>
                <div class="nt-actions">
                    ${unread ? `<button class="nt-btn" id="nt-read-all">${T('notifMarkAllRead', 'قراءة الكل', 'Mark all read')}</button>` : ''}
                    ${list.length ? `<button class="nt-btn danger" id="nt-clear">${T('notifClear', 'مسح', 'Clear')}</button>` : ''}
                </div>
            </div>
            <div id="nt-list">
                ${list.length ? list.map(itemHtml).join('') : `
                    <div class="nt-empty">
                        <div class="big">🔕</div>
                        ${T('notifEmpty', 'لا توجد إشعارات حالياً', 'No notifications yet')}
                    </div>`}
            </div>
            <div style="height:20px;"></div>`;

        const listEl = container.querySelector('#nt-list');
        if (listEl) {
            listEl.addEventListener('click', async e => {
                const row = e.target.closest('.nt-item');
                if (!row) return;
                const act = row.dataset.action || '';
                if (act.startsWith('invite:')) {
                    showInviteChoice(row, act.slice(7));
                    return;
                }
                if (row.classList.contains('unread')) {
                    row.classList.remove('unread');
                    row.querySelector('.nt-dot')?.remove();
                    await markRead(row.dataset.id, row.dataset.local === '1');
                    refreshNotifBadge();
                }
                runAction(act);
            });
        }
        container.querySelector('#nt-read-all')?.addEventListener('click', async () => {
            await markAllRead();
            renderNotificationsPage(container);
        });
        container.querySelector('#nt-clear')?.addEventListener('click', async () => {
            if (!confirm(T('notifClearConfirm', 'مسح كل الإشعارات؟', 'Clear all notifications?'))) return;
            await clearAll();
            renderNotificationsPage(container);
        });

        // فتح صفحة الإشعارات = قراءتها (مثل X وفيسبوك)
        if (unread) await markAllRead();
        setBadge(0);
    }


    /* ---------- نافذة قبول/رفض الدعوة ---------- */
    function showInviteChoice(row, roomId) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        const btn = 'flex:1;padding:11px;border-radius:12px;font-weight:900;font-size:.9rem;cursor:pointer;border:1px solid;';
        ov.innerHTML = `
            <div style="width:100%;max-width:340px;background:#111a4a;border:1px solid rgba(245,195,90,.25);border-radius:16px;padding:18px;text-align:center;color:#fff;">
                <div style="font-weight:900;margin-bottom:14px;">${esc(T('notifInviteQ', 'هل تريد قبول الدعوة؟', 'Accept this invitation?'))}</div>
                <div style="display:flex;gap:10px;">
                    <button id="inv-no" style="${btn}background:rgba(255,77,77,.1);color:#ff6b6b;border-color:rgba(255,77,77,.3);">${esc(T('notifDecline', 'رفض', 'Decline'))}</button>
                    <button id="inv-yes" style="${btn}background:rgba(20,241,149,.12);color:#14F195;border-color:rgba(20,241,149,.4);">${esc(T('notifAccept', 'قبول', 'Accept'))}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', async e => {
            if (e.target === ov) { ov.remove(); return; }
            if (e.target.id !== 'inv-yes' && e.target.id !== 'inv-no') return;
            ov.remove();
            row.classList.remove('unread');
            row.querySelector('.nt-dot')?.remove();
            await markRead(row.dataset.id, row.dataset.local === '1');
            refreshNotifBadge();
            if (e.target.id === 'inv-yes' && window.acceptRoomInvite) window.acceptRoomInvite(roomId);
        });
    }

    /* ---------- تنفيذ إجراء الإشعار (room:CODE / match:ID) ---------- */
    function runAction(act) {
        if (!act) return;
        const i = act.indexOf(':');
        const kind = i < 0 ? act : act.slice(0, i);
        const arg = i < 0 ? '' : act.slice(i + 1);
        if (kind === 'room' && window.joinRoomByCode) window.joinRoomByCode(arg);
        else if (kind === 'match' && window.openMatchRoom) window.openMatchRoom(arg);
        else if (kind === 'user' && window.openUserProfile) window.openUserProfile(arg);
        else if (kind === 'post' && window.openPostPage) { const [pid, cid] = arg.split(':'); window.openPostPage(pid, cid); }
        else if (kind === 'followers' && window.openFollowers) window.openFollowers();
    }

    /* ---------- إشعار لحظي منبثق (مثل: بدأت المباراة الآن) ---------- */
    function popup(n) {
        const ti = typeInfo(n.type);
        const title = isAr() ? (n.title_ar || n.title_en) : (n.title_en || n.title_ar);
        const body = isAr() ? (n.body_ar || n.body_en) : (n.body_en || n.body_ar);
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:100030;width:92%;max-width:420px;'
            + 'box-sizing:border-box;padding:12px 14px;border-radius:16px;cursor:pointer;color:#fff;'
            + 'background:linear-gradient(135deg,rgba(17,26,74,.98),rgba(10,16,51,.98));border:1px solid ' + ti.color + ';'
            + 'box-shadow:0 8px 30px rgba(0,0,0,.6);text-align:start;direction:' + (isAr() ? 'rtl' : 'ltr');
        el.innerHTML = '<div style="font-weight:900;font-size:.95rem">' + esc(title) + '</div>'
            + (body ? '<div style="color:#9aa6d6;font-size:.8rem;margin-top:3px">' + esc(body) + '</div>' : '');
        el.addEventListener('click', () => { el.remove(); runAction(n.action); });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 7000);
    }

    let rtUid = '', rtChannel = null;
    function ensureRealtime() {
        const id = uid();
        if (!id || !hasDb() || rtUid === id) return;
        try {
            if (rtChannel) supabaseClient.removeChannel(rtChannel);
            rtUid = id;
            rtChannel = supabaseClient.channel('notif-' + id)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + id },
                    payload => { if (payload.new) { popup(payload.new); refreshNotifBadge(); } })
                .subscribe();
        } catch (e) { rtUid = ''; }
    }

    // الربط مع showPage يتم داخل app.js (case 'notifications')
    window.renderNotificationsPage = renderNotificationsPage;
    window.addNotification = addNotification;
    window.refreshNotifBadge = refreshNotifBadge;

    // تحديث دوري للشارة (يتجاهل الحالة قبل تسجيل الدخول)
    setInterval(() => { if (uid()) { refreshNotifBadge(); ensureRealtime(); } }, 60000);
    setTimeout(() => { if (uid()) ensureRealtime(); }, 4000);
})();
