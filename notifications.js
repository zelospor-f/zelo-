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
    const T = (ar, en) => (isAr() ? ar : en);
    const uid = () => String((window.userState && window.userState.userId) || localStorage.getItem('zelo_user_id') || '');

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const TYPES = {
        reward:   { icon: '🪙', color: '#ffd700' },
        match:    { icon: '⚽', color: '#00FF87' },
        task:     { icon: '⚡', color: '#fcb045' },
        social:   { icon: '👥', color: '#2AABEE' },
        rank:     { icon: '🏆', color: '#8B5CF6' },
        wallet:   { icon: '🔖', color: '#14F195' },
        system:   { icon: '📢', color: '#94a3b8' }
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
    async function fetchAll() {
        const local = lsRead().map(n => ({ ...n, _local: true }));
        let remote = [];
        if (hasDb()) {
            try {
                const { data, error } = await supabaseClient
                    .from('notifications')
                    .select('id, type, title_ar, title_en, body_ar, body_en, is_read, created_at')
                    .eq('user_id', uid())
                    .order('created_at', { ascending: false })
                    .limit(MAX_ITEMS);
                if (!error && Array.isArray(data)) remote = data;
            } catch (e) { /* الجدول غير موجود أو لا اتصال: نكتفي بالمحلي */ }
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
        if (s < 60) return T('الآن', 'Just now');
        const m = Math.floor(s / 60);
        if (m < 60) return isAr() ? `منذ ${m} د` : `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return isAr() ? `منذ ${h} س` : `${h}h ago`;
        const d = Math.floor(h / 24);
        if (d < 7) return isAr() ? `منذ ${d} يوم` : `${d}d ago`;
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
                background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                -webkit-background-clip:text; -webkit-text-fill-color:transparent;
            }
            .nt-actions { display:flex; gap:8px; }
            .nt-btn {
                background: rgba(255,255,255,0.08); color:#00FF87;
                border:1px solid rgba(0,255,135,0.25);
                padding:7px 12px; border-radius:16px;
                font-weight:800; font-size:0.74rem; cursor:pointer;
            }
            .nt-btn.danger { color:#ff6b6b; border-color: rgba(255,77,77,0.3); }
            .nt-item {
                display:flex; gap:12px; align-items:flex-start;
                background: linear-gradient(135deg, rgba(20,22,48,0.95), rgba(12,14,32,0.95));
                border:1px solid rgba(90,110,255,0.25);
                border-radius:18px; padding:12px 14px; margin-bottom:10px;
                cursor:pointer; transition: transform .2s;
            }
            .nt-item:active { transform: scale(0.985); }
            .nt-item.unread {
                border-color: rgba(42,171,238,0.6);
                background: linear-gradient(135deg, rgba(42,171,238,0.18), rgba(139,92,246,0.12));
                box-shadow: 0 0 12px rgba(42,171,238,0.2);
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
            .nt-text { color:#b6bdd0; font-size:0.8rem; margin-top:3px; line-height:1.5; word-break:break-word; }
            .nt-time { color:#7b8296; font-size:0.7rem; margin-top:5px; font-weight:700; }
            .nt-empty {
                text-align:center; padding:40px 20px; color:#94a3b8;
                background: rgba(20,22,48,0.8); border-radius:18px;
                border:1px solid rgba(90,110,255,0.3); font-weight:700; font-size:0.88rem;
            }
            .nt-empty .big { font-size:2.4rem; margin-bottom:8px; }
        </style>`;

    function itemHtml(n) {
        const ti = typeInfo(n.type);
        const title = isAr() ? (n.title_ar || n.title_en) : (n.title_en || n.title_ar);
        const body  = isAr() ? (n.body_ar  || n.body_en)  : (n.body_en  || n.body_ar);
        return `
        <div class="nt-item ${n.is_read ? '' : 'unread'}" data-id="${esc(n.id)}" data-local="${n._local ? '1' : '0'}">
            <div class="nt-ico" style="color:${ti.color}; border-color:${ti.color}33;">${ti.icon}</div>
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
            <div style="text-align:center;padding:40px;color:#00FF87;font-weight:800;animation:ntPulse 1.5s infinite;">
                ${T('⏳ جاري تحميل الإشعارات...', '⏳ Loading notifications...')}
            </div>`;

        let list = [];
        try { list = await fetchAll(); } catch (e) { console.error('Notifications error:', e); }

        const unread = list.filter(n => !n.is_read).length;
        setBadge(unread);

        container.innerHTML = `${CSS}
            <div class="nt-head">
                <h2 class="nt-title">🔔 ${T('الإشعارات', 'Notifications')}</h2>
                <div class="nt-actions">
                    ${unread ? `<button class="nt-btn" id="nt-read-all">${T('قراءة الكل', 'Mark all read')}</button>` : ''}
                    ${list.length ? `<button class="nt-btn danger" id="nt-clear">${T('مسح', 'Clear')}</button>` : ''}
                </div>
            </div>
            <div id="nt-list">
                ${list.length ? list.map(itemHtml).join('') : `
                    <div class="nt-empty">
                        <div class="big">🔕</div>
                        ${T('لا توجد إشعارات حالياً', 'No notifications yet')}
                    </div>`}
            </div>
            <div style="height:20px;"></div>`;

        const listEl = container.querySelector('#nt-list');
        if (listEl) {
            listEl.addEventListener('click', async e => {
                const row = e.target.closest('.nt-item');
                if (!row || !row.classList.contains('unread')) return;
                row.classList.remove('unread');
                row.querySelector('.nt-dot')?.remove();
                await markRead(row.dataset.id, row.dataset.local === '1');
                refreshNotifBadge();
            });
        }
        container.querySelector('#nt-read-all')?.addEventListener('click', async () => {
            await markAllRead();
            renderNotificationsPage(container);
        });
        container.querySelector('#nt-clear')?.addEventListener('click', async () => {
            if (!confirm(T('مسح كل الإشعارات؟', 'Clear all notifications?'))) return;
            await clearAll();
            renderNotificationsPage(container);
        });
    }

    /* ---------- الربط مع showPage (app.js يُحمَّل بعد هذا الملف) ---------- */
    function setActiveNav() {
        document.querySelectorAll('#bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-notifications')?.classList.add('active');
    }

    function hookShowPage() {
        const orig = window.showPage;
        if (typeof orig !== 'function' || orig.__ntHooked) return;

        const wrapped = function (page) {
            if (page === 'notifications') {
                setActiveNav();
                renderNotificationsPage(document.getElementById('main-content'));
                window.scrollTo(0, 0);
                return;
            }
            return orig.apply(this, arguments);
        };
        wrapped.__ntHooked = true;
        window.showPage = wrapped;
    }

    window.renderNotificationsPage = renderNotificationsPage;
    window.addNotification = addNotification;
    window.refreshNotifBadge = refreshNotifBadge;

    window.addEventListener('load', () => {
        hookShowPage();
        refreshNotifBadge();
        setInterval(refreshNotifBadge, 60000);
    });
})();
