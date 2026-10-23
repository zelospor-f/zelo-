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
            background: #121215;
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
            border-left: 1px solid rgba(252, 176, 69, 0.25);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.7);
        }
        .zdrawer.from-left {
            left: 0;
            transform: translateX(-100%);
            border-right: 1px solid rgba(252, 176, 69, 0.25);
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
            background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.6rem; font-weight: 900; color: #fff;
            margin-bottom: 12px; overflow: hidden;
        }
        .zdrawer-name { font-size: 1.1rem; font-weight: 900; margin-bottom: 4px; }
        .zdrawer-handle { font-size: 0.85rem; color: #888899; direction: ltr; text-align: start; }

        .zdrawer-section { padding: 8px 0; }
        .zdrawer-divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 6px 0; }

        .zdrawer-item {
            width: 100%; display: flex; align-items: center; gap: 14px;
            padding: 14px 20px;
            background: transparent; border: none; outline: none;
            color: #f8fafc; font-size: 1rem; font-weight: 700;
            cursor: pointer; text-align: start; font-family: inherit;
            -webkit-tap-highlight-color: transparent;
            transition: background 0.2s ease;
        }
        .zdrawer-item:active { background: rgba(131, 58, 180, 0.15); }
        .zdrawer-item .zdrawer-icon { width: 26px; text-align: center; font-size: 1.2rem; }
        .zdrawer-item .zdrawer-label { flex: 1; }
        .zdrawer-item.muted { color: #888899; font-weight: 600; }
        .zdrawer-item.highlight .zdrawer-label {
            background: linear-gradient(90deg, #fcb045, #fd1d1d);
            -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        .zdrawer-footer { margin-top: auto; padding: 10px 0 20px; }

        .zdrawer-toast {
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(28, 28, 34, 0.95); color: #fff;
            padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(252, 176, 69, 0.3);
            font-size: 0.85rem; z-index: 3000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zdrawer-toast.show { opacity: 1; }

        /* ===== صفحة الاشتراكات ===== */
        .zsub-overlay {
            position: fixed; inset: 0; z-index: 5000;
            background: #121215; color: #f8fafc;
            overflow-y: auto; padding: 16px 16px 40px;
            font-family: inherit;
        }
        .zsub-close {
            width: 40px; height: 40px; border-radius: 50%;
            background: rgba(255,255,255,0.08); color: #fff;
            font-size: 1.1rem; cursor: pointer; border: none;
        }
        .zsub-title { font-size: 1.5rem; font-weight: 900; margin: 14px 0 4px; }
        .zsub-sub { color: #9a9fb5; font-size: 0.88rem; margin-bottom: 16px; line-height: 1.6; }
        .zsub-active {
            background: rgba(20,241,149,0.12); border: 1px solid rgba(20,241,149,0.4);
            color: #14F195; border-radius: 12px; padding: 10px 12px;
            font-weight: 800; margin-bottom: 14px; display: none;
        }
        .zsub-benefits { list-style: none; margin: 0 0 18px; padding: 0; }
        .zsub-benefits li { padding: 9px 0; font-size: 0.95rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .zsub-benefits .soon { color: #888899; font-size: 0.78rem; margin-inline-start: 6px; }
        .zsub-plan {
            background: rgba(28,28,34,0.85); border: 1px solid rgba(252,176,69,0.3);
            border-radius: 16px; padding: 14px; margin-bottom: 12px;
        }
        .zsub-plan-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .zsub-plan-name { font-size: 1.05rem; font-weight: 900; }
        .zsub-plan-price { font-size: 1.25rem; font-weight: 900; color: #fcb045; direction: ltr; }
        .zsub-plan-price small { font-size: 0.75rem; color: #9a9fb5; font-weight: 700; }
        .zsub-plan-note { color: #14F195; font-size: 0.78rem; font-weight: 800; margin-top: 4px; }
        .zsub-buy {
            width: 100%; margin-top: 12px; padding: 12px; border-radius: 12px;
            font-weight: 900; font-size: 0.95rem; cursor: pointer; border: none;
            color: #000; background: linear-gradient(90deg, #fcb045, #fd1d1d);
        }
        .zsub-foot { color: #888899; font-size: 0.75rem; line-height: 1.6; margin-top: 14px; }

    `;

    // ===== خطط الاشتراك =====
    // تنبيه: هذه الأسعار مؤقتة للعرض فقط. عدّلها هنا، وعند ربط Google Play Billing
    // تُستبدل بالأسعار الحقيقية القادمة من المتجر.
    const PLANS = [
        { id: 'zelo_monthly', ar: 'شهري', en: 'Monthly', price: '$2.99', perAr: '/ شهرياً', perEn: '/ month' },
        { id: 'zelo_yearly',  ar: 'سنوي', en: 'Yearly',  price: '$24.99', perAr: '/ سنوياً', perEn: '/ year',
          noteAr: 'وفّر نحو 30٪', noteEn: 'Save about 30%' }
    ];

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

    function openSubscriptions() {
        document.getElementById('zsub-overlay')?.remove();
        const ar = isAr();
        const ov = document.createElement('div');
        ov.id = 'zsub-overlay';
        ov.className = 'zsub-overlay';
        ov.dir = ar ? 'rtl' : 'ltr';
        ov.innerHTML = `
            <button class="zsub-close" data-sub="close">✕</button>
            <div class="zsub-title">${esc(L('الاشتراكات', 'Subscriptions'))}</div>
            <div class="zsub-sub">${esc(L('وثّق حسابك بشعار ناديك المفضل واحصل على مزايا إضافية.', 'Verify your account with your favorite club badge and unlock extra perks.'))}</div>
            <div class="zsub-active" id="zsub-active">${esc(L('✅ اشتراكك فعّال', '✅ Your subscription is active'))}</div>
            <ul class="zsub-benefits">
                <li>🏅 ${esc(L('شعار ناديك المفضل بجانب اسمك', 'Your favorite club badge next to your name'))}</li>
                <li>✍️ ${esc(L('منشورات أطول حتى 1000 حرف', 'Longer posts, up to 1000 characters'))}</li>
                <li>🎙️ ${esc(L('رسائل صوتية داخل الغرف', 'Voice messages inside rooms'))}</li>
                <li>🎬 ${esc(L('فيديو حتى 45 ثانية', 'Videos up to 45 seconds'))}<span class="soon">${esc(L('قريباً', 'Coming soon'))}</span></li>
            </ul>
            ${PLANS.map(p => `
                <div class="zsub-plan">
                    <div class="zsub-plan-head">
                        <div class="zsub-plan-name">${esc(L(p.ar, p.en))}</div>
                        <div class="zsub-plan-price">${esc(p.price)} <small>${esc(L(p.perAr, p.perEn))}</small></div>
                    </div>
                    ${p.noteAr ? `<div class="zsub-plan-note">${esc(L(p.noteAr, p.noteEn))}</div>` : ''}
                    <button class="zsub-buy" data-sub="buy" data-plan="${esc(p.id)}">${esc(L('اشترك', 'Subscribe'))}</button>
                </div>`).join('')}
            <div class="zsub-foot">${esc(L('يتم الدفع عبر Google Play ويمكنك إلغاء الاشتراك في أي وقت من المتجر.', 'Payment is handled by Google Play and you can cancel anytime from the store.'))}</div>
        `;
        ov.addEventListener('click', e => {
            const b = e.target.closest('[data-sub]');
            if (!b) return;
            if (b.dataset.sub === 'close') { ov.remove(); return; }
            if (b.dataset.sub === 'buy') {
                if (window.ZeloPremium && typeof window.ZeloPremium.subscribe === 'function') {
                    window.ZeloPremium.subscribe(b.dataset.plan);
                } else {
                    toast(L('الدفع عبر Google Play قريباً', 'Payment via Google Play is coming soon'));
                }
            }
        });
        document.body.appendChild(ov);
        // إن كان مشتركاً نُظهر شارة "اشتراكك فعّال"
        if (window.ZeloPremium) {
            window.ZeloPremium.isPremium().then(ok => {
                const a = document.getElementById('zsub-active');
                if (a && ok) a.style.display = 'block';
            });
        }
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
        subscriptions: () => openSubscriptions(),
        // ترتيب الأندية (انتقل من الشريط السفلي إلى هنا)
        leaderboard: () => showPage('leaderboard'),
        community:  () => showPage('community'),
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
                { key: 'wallet',    icon: '🔖', ar: 'المحفظة',       en: 'Wallet' },
                { key: 'ads',       icon: '🎁', ar: 'اربح نقاط',     en: 'Earn Points', highlight: true },
                { key: 'nft',       icon: '👑', ar: 'سوق NFT',       en: 'NFT Market' },
                { key: 'leaderboard', icon: '📊', ar: 'الترتيب',      en: 'Rankings' },
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

    window.openSubscriptions = openSubscriptions;
    window.openSideDrawer = openSideDrawer;
    window.closeSideDrawer = closeSideDrawer;

    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
})();
