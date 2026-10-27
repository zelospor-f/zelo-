(function () {
    'use strict';

    const CSS = `
        .zdrawer-overlay {
            position: fixed; inset: 0;
            background: rgba(0, 0, 0, 0.6);
            opacity: 0; pointer-events: none;
            visibility: hidden;
            transition: opacity 0.25s ease, visibility 0s linear 0.25s;
            z-index: 2000;
        }
        .zdrawer-overlay.open {
            opacity: 1; pointer-events: auto;
            visibility: visible;
            transition: opacity 0.25s ease, visibility 0s;
        }

        .zdrawer {
            position: fixed; top: 0; bottom: 0;
            width: min(82%, 320px);
            background: #0a1033;
            color: #f8fafc;
            z-index: 2001;
            display: flex; flex-direction: column;
            overflow-y: auto;
            visibility: hidden;
            pointer-events: none;
            transition: transform 0.3s ease, visibility 0s linear 0.3s;
        }
        .zdrawer.open {
            visibility: visible;
            pointer-events: auto;
            transition: transform 0.3s ease, visibility 0s;
        }
        .zdrawer.from-right {
            right: 0;
            transform: translateX(100%);
            border-left: 1px solid rgba(245,195,90, 0.25);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.7);
        }
        .zdrawer.from-left {
            left: 0;
            transform: translateX(-100%);
            border-right: 1px solid rgba(245,195,90, 0.25);
            box-shadow: 10px 0 30px rgba(0, 0, 0, 0.7);
        }
        .zdrawer.from-right.open,
        .zdrawer.from-left.open { transform: translateX(0); }

        .zdrawer-header {
            padding: 28px 20px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .zdrawer-avatar {
            width: 64px; height: 64px; border-radius: 50%;
            background: linear-gradient(135deg, #2c4bb5, #14206b, #f5c35a);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.6rem; font-weight: 900; color: #fff;
            margin-bottom: 12px; overflow: hidden;
        }
        .zdrawer-name { font-size: 1.1rem; font-weight: 900; margin-bottom: 4px; }
        .zdrawer-handle { font-size: 0.85rem; color: #9aa6d6; direction: ltr; text-align: start; }

        .zdrawer-section { padding: 8px 0; }
        .zdrawer-divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 6px 0; }

        .zdrawer-item {
            width: 100%; display: flex; align-items: center; gap: 14px;
            padding: 14px 20px;
            background: transparent; border: none; outline: none;
            color: #f5c35a; font-size: 1rem; font-weight: 700;
            cursor: pointer; text-align: start; font-family: inherit;
            -webkit-tap-highlight-color: transparent;
            transition: background 0.2s ease;
        }
        .zdrawer-item:active { background: rgba(44,75,181, 0.15); }
        .zdrawer-item .zdrawer-icon { width: 26px; text-align: center; font-size: 1.2rem; }
        .zdrawer-item .zdrawer-label { flex: 1; }
        .zdrawer-item.muted { color: #f5c35a; font-weight: 600; }
        .zdrawer-item.highlight .zdrawer-label { color: #f5c35a; }

        .zdrawer-footer { margin-top: auto; padding: 10px 0 20px; }

        .zdrawer-toast {
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(17,26,74, 0.95); color: #fff;
            padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(245,195,90, 0.3);
            font-size: 0.85rem; z-index: 3000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zdrawer-toast.show { opacity: 1; }
    `;

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg) {
        let el = document.getElementById('zdrawer-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zdrawer-toast';
            el.className = 'zdrawer-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2000);
    }

    // الاسم المستعار المعروض في رأس القائمة (كود الإعدادات نفسه في ملف settings.js)
    function currentNick() {
        const u = window.userState || {};
        let ls = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
        return u.nickname_ar || u.nickname_en
            || ls('zelo_nickname_ar') || ls('zelo_nickname_en')
            || String(u.email || ls('zelo_email') || '').split('@')[0];
    }

    const ACTIONS = {
        profile:     () => showPage('profile'),
        // صفحة الاشتراكات والأسعار صارت في premium.js
        subscriptions: () => (typeof window.openSubscriptions === 'function' ? window.openSubscriptions() : toast(L('ملف الاشتراكات غير محمّل', 'Subscriptions file not loaded'))),
        // صفحة المتجر (معرّفة في ملف store.js)
        store:       () => (typeof window.openStorePage === 'function' ? window.openStorePage() : toast(L('ملف المتجر غير محمّل', 'Store file not loaded'))),
        // ترتيب الأندية (انتقل من الشريط السفلي إلى هنا)
        leaderboard: () => showPage('leaderboard'),
        community:  () => showPage('community'),
        tasks:       () => showPage('tasks'),
        wallet:      () => showPage('wallet'),
        // صفحة إعلان المكافأة اليدوي (معرّفة في ملف ads.js)
        ads:         () => (typeof window.openAdsPage === 'function' ? window.openAdsPage() : toast(L('ملف الإعلانات غير محمّل', 'Ads file not loaded'))),
        // سوق بطاقات NFT (معرّف في ملف nft-market.js)
        nft:         () => (typeof window.renderNftMarketPage === 'function' ? window.renderNftMarketPage() : toast(L('ملف سوق NFT غير محمّل', 'NFT market file not loaded'))),
        website:     () => window.openOfficialWebsite && window.openOfficialWebsite(),
        // شاشة "أبطال اليوم" (الترتيب) المعرّفة في ملف الترتيب
        champions:   () => window.openLegendaryRankingScreen && window.openLegendaryRankingScreen(),
        // كود الإعدادات في ملف منفصل: settings.js
        settings:    () => (typeof window.openSettings === 'function' ? window.openSettings() : toast(L('ملف الإعدادات غير محمّل', 'Settings file not loaded'))),
        help:        () => toast(L('مركز المساعدة قريباً', 'Help center coming soon')),
        lang: async () => {
            const next = isAr() ? 'en' : 'ar';
            localStorage.setItem('app_lang', next);
            if (window.userState) window.userState.lang = next;
            // حفظ اللغة في قاعدة البيانات حتى لا تُستبدل بالقيمة القديمة عند إعادة التحميل
            try {
                const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
                const uid = window.userState?.userId;
                if (c && uid) {
                    await c.from('users').update({ lang: next }).eq('user_id', String(uid));
                }
            } catch (e) {
                console.warn('[ZELO] فشل حفظ اللغة في قاعدة البيانات:', e);
            }
            location.reload();
        }
    };

    function getItems() {
        return {
            main: [
                { key: 'profile',   icon: '👤', ar: 'الملف الشخصي',  en: 'Profile' },
                { key: 'subscriptions', icon: '💎', ar: 'الاشتراكات', en: 'Subscriptions', highlight: true },
                { key: 'store',     icon: '<img src="zelo-coin.png" alt="" width="24" height="24" style="display:block;margin:0 auto;border-radius:50%;">', ar: 'المتجر', en: 'Store', highlight: true },
                { key: 'tasks',     icon: '⚡', ar: 'المهام',        en: 'Tasks', highlight: true },
                { key: 'ads',       icon: '🎁', ar: 'اربح نقاط',     en: 'Earn Points', highlight: true },
                { key: 'nft',       icon: '👑', ar: 'سوق NFT',       en: 'NFT Market' },
                { key: 'champions', icon: '🏆', ar: 'أبطال اليوم',   en: "Today's Champions", highlight: true },
                { key: 'website',   icon: '🌐', ar: 'الموقع الرسمي', en: 'Official Website' },
                { key: 'community', icon: '👥', ar: 'المجتمعات',     en: 'Community' },
                { key: 'settings',  icon: '⚙️', ar: 'الإعدادات',     en: 'Settings' }
            ],
            footer: [
                { key: 'lang', icon: '🈯', ar: 'تغيير اللغة',   en: 'Change language' },
                { key: 'help', icon: '❓', ar: 'مركز المساعدة', en: 'Help center', muted: true }
            ]
        };
    }

    function renderItem(item) {
        const cls = ['zdrawer-item', item.muted ? 'muted' : '', item.highlight ? 'highlight' : '']
            .filter(Boolean).join(' ');
        return `
            <button class="${cls}" data-action="${item.key}">
                <span class="zdrawer-icon">${item.icon}</span>
                <span class="zdrawer-label">${esc(L(item.ar, item.en))}</span>
            </button>`;
    }

    function avatarHtml(name) {
        const photo = window.userState?.photoUrl;
        if (photo) {
            return `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
        return esc(name.charAt(0).toUpperCase());
    }

    function render() {
        const drawer = document.getElementById('zdrawer');
        if (!drawer) return;

        const username = window.userState?.username || '';
        const name = currentNick() || username || 'Android Player';
        const handle = username || window.userState?.userId || '';
        const items = getItems();

        drawer.innerHTML = `
            <div class="zdrawer-header">
                <div class="zdrawer-avatar">${avatarHtml(name)}</div>
                <div class="zdrawer-name">${esc(name)}</div>
                <div class="zdrawer-handle">@${esc(handle)}</div>
            </div>

            <div class="zdrawer-section">
                ${items.main.map(renderItem).join('')}
            </div>

            <div class="zdrawer-divider"></div>

            <div class="zdrawer-footer">
                ${items.footer.map(renderItem).join('')}
            </div>
        `;
    }

    // عرض صورة المستخدم في زر الهيدر (أو الرمز الافتراضي إن لم تتوفر صورة)
    function updateHeaderAvatar() {
        const btn = document.getElementById('profile-header-btn');
        if (!btn) return;

        const photo = window.userState?.photoUrl;
        btn.innerHTML = photo
            ? `<img src="${esc(photo)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
            : '👤';
    }

    // تحديد جهة الفتح حسب اللغة: عربي = يمين، غير ذلك = يسار
    function applySide() {
        const drawer = document.getElementById('zdrawer');
        if (!drawer) return;
        const ar = isAr();
        drawer.classList.toggle('from-right', ar);
        drawer.classList.toggle('from-left', !ar);
        drawer.dir = ar ? 'rtl' : 'ltr';
    }

    function build() {
        if (document.getElementById('zdrawer')) return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'zdrawer-overlay';
        overlay.className = 'zdrawer-overlay';
        overlay.addEventListener('click', closeSideDrawer);

        const drawer = document.createElement('aside');
        drawer.id = 'zdrawer';
        drawer.className = 'zdrawer';
        drawer.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = ACTIONS[btn.dataset.action];
            closeSideDrawer();
            if (typeof action === 'function') action();
        });

        document.body.append(overlay, drawer);

        // ضبط الجهة فوراً حتى تبدأ القائمة مخفية خارج الشاشة
        applySide();
        updateHeaderAvatar();
    }

    function openSideDrawer() {
        build();
        updateHeaderAvatar();
        applySide();
        render();
        // إجبار المتصفح على احتساب الحالة المغلقة قبل بدء حركة الفتح
        void document.getElementById('zdrawer').offsetWidth;
        document.getElementById('zdrawer-overlay').classList.add('open');
        document.getElementById('zdrawer').classList.add('open');
    }

    function closeSideDrawer() {
        document.getElementById('zdrawer-overlay')?.classList.remove('open');
        document.getElementById('zdrawer')?.classList.remove('open');
    }

    window.openSideDrawer = openSideDrawer;
    window.closeSideDrawer = closeSideDrawer;

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
})();
