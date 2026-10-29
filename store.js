/* ZELO FC — صفحة المتجر (Zelo Coin)
 * تُفتح من القائمة الجانبية عبر window.openStorePage()
 * الدفع: Google Play Billing فقط (تطبيق Capacitor على أندرويد عبر cordova-plugin-purchase).
 * تُعرض الأسعار المحلية من Google ويبدأ الشراء مباشرة عند الضغط على الباقة. بعد الشراء تُستدعى:
 *   window.zeloVerifyGooglePurchase({ pkg, productId, purchaseToken })
 * يجب أن ترجع Promise<boolean>: true بعد أن يتحقق السيرفر من الرمز عبر Google Play Developer API
 * ويضيف الرصيد. عندها فقط يُستهلك المنتج. إن لم ترجع true يبقى الشراء معلّقاً ويُعاد التحقق عند فتح التطبيق.
 *
 * التثبيت:  npm i cordova-plugin-purchase && npx cap sync android
 * وأنشئ في Play Console منتجات استهلاكية (In-app products) بنفس قيم gid أدناه.
 */
(function () {
    'use strict';

    // صورة العملة (مقتطعة من الشعار). ضعها بجانب index.html أو غيّر المسار
    const COIN_SRC = 'zelo-coin.png';

    // الباقات: عدّل الأرقام والأسعار من هنا فقط
    // gid = معرّف المنتج في Google Play Console
    const PACKAGES = [
        { id: 'starter',  tier: 1, coins: 100,  price: 1,  gid: 'zelo_coin_100',  ar: 'باقة المبتدئ', en: 'Starter' },
        { id: 'pro',      tier: 2, coins: 500,  price: 5,  gid: 'zelo_coin_500',  ar: 'باقة المحترف', en: 'Pro',
          badge: { ar: 'الأكثر طلباً', en: 'Most popular' } },
        { id: 'elite',    tier: 3, coins: 1000, price: 10, gid: 'zelo_coin_1000', ar: 'باقة النجم',   en: 'Elite' },
        { id: 'ultimate', tier: 4, coins: 2000, price: 20, gid: 'zelo_coin_2000', ar: 'باقة الأسطورة', en: 'Ultimate',
          badge: { ar: 'الأكبر', en: 'Biggest' } }
    ];

    // ---------- بصمة الحساب: تربط الشراء بحساب المستخدم لدى Google ويتحقق منها الخادم ----------
    let acct = '';
    async function accountHash(uid) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zelo:' + uid));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const currentUid = () => String((window.userState && window.userState.userId) || '');

    // التحقق من الشراء في الخادم (google-verify). الخادم يحدد عدد النقاط بنفسه من معرّف المنتج.
    // يرجع true عند النجاح (ويشمل «تم تسجيله سابقاً») حتى يُنهي التطبيق العملية.
    if (typeof window.zeloVerifyGooglePurchase !== 'function') {
        window.zeloVerifyGooglePurchase = async ({ productId, purchaseToken }) => {
            const c = (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
            if (!c) return false;
            try {
                const { data, error } = await c.functions.invoke('google-verify',
                    { body: { product_id: productId, purchase_token: purchaseToken } });
                if (error) { console.warn('[store] verify error', error.message); return false; }
                return !!(data && data.ok);
            } catch (e) { console.warn('[store] verify failed', e); return false; }
        };
    }

    // ---------- Google Play Billing (cordova-plugin-purchase داخل Capacitor) ----------
    let billingReady = false;
    let billingInit = null;
    let buying = false;

    const lib = () => window.CdvPurchase;
    const isNativeAndroid = () => {
        const c = window.Capacitor;
        return !!(c && c.isNativePlatform && c.isNativePlatform() && c.getPlatform && c.getPlatform() === 'android');
    };
    const gProduct = p => {
        const L_ = lib();
        return L_ ? L_.store.get(p.gid, L_.Platform.GOOGLE_PLAY) : null;
    };

    function localPrice(p) {
        const prod = gProduct(p);
        if (!prod) return '';
        const offer = prod.getOffer && prod.getOffer();
        return offer?.pricingPhases?.[0]?.price || prod.pricing?.price || '';
    }

    const hasPlay = () => billingReady;
    const priceLabel = p => (billingReady && localPrice(p)) || ('$' + p.price);

    function initPlayBilling() {
        if (billingInit) return billingInit;
        if (!isNativeAndroid() || !lib()) return Promise.resolve();
        const { store, ProductType, Platform } = lib();

        store.register(PACKAGES.map(p => ({
            id: p.gid, type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY
        })));

        // عند الموافقة على الشراء (وعند إعادة فتح التطبيق لمشتريات معلّقة) تحقّق من السيرفر ثم أنهِ العملية
        store.when().approved(async transaction => {
            const native = transaction.nativePurchase || {};
            const token = native.purchaseToken;
            const productId = transaction.products?.[0]?.id || native.productId;
            const p = PACKAGES.find(x => x.gid === productId);
            if (!p || !token || typeof window.zeloVerifyGooglePurchase !== 'function') return;
            let ok = false;
            try {
                ok = !!(await window.zeloVerifyGooglePurchase({ pkg: { ...p }, productId, purchaseToken: token }));
            } catch (_) { ok = false; }
            if (ok) {
                transaction.finish();          // يستهلك المنتج ويؤكد الشراء لدى Google
                refreshStoreBalance();
                toast(L('تمت إضافة الرصيد بنجاح', 'Coins added successfully'));
            } else {
                toast(L('تعذّر التحقق من الشراء', 'Could not verify the purchase'));
            }
        });

        billingInit = (async () => {
            try {
                const uid = currentUid();
                if (uid) acct = await accountHash(uid);
                store.applicationUsername = () => acct || undefined;   // يصل إلى Google كمعرّف الحساب
                await store.initialize([Platform.GOOGLE_PLAY]);
                billingReady = PACKAGES.some(p => !!gProduct(p));
            } catch (err) {
                console.warn('Play Billing unavailable:', err);
                billingReady = false;
            }
        })();
        return billingInit;
    }

    async function buyWithGoogle(p) {
        if (buying) return;
        const prod = gProduct(p);
        const offer = prod && prod.getOffer && prod.getOffer();
        if (!offer) { toast(L('المنتج غير متاح حالياً', 'Product unavailable right now')); return; }
        if (!currentUid()) { toast(L('سجّل الدخول أولاً', 'Please sign in first')); return; }
        if (!acct) acct = await accountHash(currentUid());
        buying = true;
        try {
            const err = await lib().store.order(offer);
            // إلغاء المستخدم لا يُعدّ خطأً
            if (err && err.code !== lib().ErrorCode.PAYMENT_CANCELLED) {
                toast(L('تعذّر إتمام الشراء', 'Purchase failed'));
            }
        } catch (_) {
            toast(L('تعذّر إتمام الشراء', 'Purchase failed'));
        } finally {
            buying = false;
        }
    }

    const CSS = `
        .zs {
            position: fixed; inset: 0; z-index: 1800;
            background: #070c2a;
            color: #f8fafc;
            display: none; flex-direction: column;
            padding-top: env(safe-area-inset-top, 0px);
            font-family: inherit;
        }
        .zs.open { display: flex; animation: zs-in 0.28s ease both; }
        @keyframes zs-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

        .zs button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
        .zs button:focus-visible { outline: 2px solid #f5c35a; outline-offset: 3px; }

        .zs-top {
            display: grid; grid-template-columns: 44px 1fr 44px; align-items: center;
            padding: 10px 14px;
        }
        .zs-back {
            width: 44px; height: 44px; border-radius: 50%;
            background: rgba(255,255,255,0.06); border: none; color: #f5c35a;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .zs[dir="ltr"] .zs-back svg { transform: scaleX(-1); }
        .zs-title { margin: 0; text-align: center; font-size: 1.15rem; font-weight: 900; letter-spacing: 0.2px; }

        .zs-scroll { flex: 1; overflow-y: auto; padding: 4px 16px calc(28px + env(safe-area-inset-bottom, 0px)); }

        /* الرصيد */
        .zs-hero { text-align: center; padding: 18px 0 26px; position: relative; }
        .zs-hero::before {
            content: ''; position: absolute; left: 50%; top: 6px; width: 220px; height: 220px;
            transform: translateX(-50%);
            background: radial-gradient(circle, rgba(245,195,90,0.22), rgba(245,195,90,0) 68%);
            pointer-events: none;
        }
        .zs-hero-coin { position: relative; display: inline-block; perspective: 600px; }
        .zs.open .zs-hero-coin .zs-coin { animation: zs-flip 1s cubic-bezier(.3,.7,.2,1) 0.15s both; }
        @keyframes zs-flip { from { transform: rotateY(-360deg); } to { transform: rotateY(0); } }
        .zs-hero-label { position: relative; margin-top: 12px; font-size: 0.85rem; color: #9aa6d6; font-weight: 600; }
        .zs-hero-bal {
            position: relative; margin-top: 2px; direction: ltr;
            font-size: 2.6rem; line-height: 1.1; font-weight: 900; color: #f5c35a;
            font-variant-numeric: tabular-nums;
        }
        .zs-hero-bal small { font-size: 0.9rem; font-weight: 700; color: #9aa6d6; margin-inline-start: 8px; }

        .zs-sub { margin: 0 4px 14px; font-size: 1rem; font-weight: 800; color: #f8fafc; }

        .zs-coin {
            display: block; border-radius: 50%; background: #f5c35a; object-fit: cover;
            box-shadow: 0 0 0 2px #f5c35a, 0 4px 10px rgba(0,0,0,0.55);
        }

        /* الباقات */
        .zs-list { display: flex; flex-direction: column; gap: 16px; }
        .zs-pack {
            position: relative; width: 100%;
            display: flex; align-items: center; gap: 14px;
            padding: 18px 16px; border-radius: 20px; cursor: pointer;
            text-align: start; color: inherit;
            background: #101847; border: 1px solid rgba(255,255,255,0.09);
            transition: transform 0.15s ease;
        }
        .zs-pack:active { transform: scale(0.98); }
        .zs-pack.t2 { border-color: #2c4bb5; box-shadow: 0 0 0 1px rgba(44,75,181,0.5), 0 10px 26px rgba(44,75,181,0.22); }
        .zs-pack.t3 { border-color: rgba(245,195,90,0.55); box-shadow: 0 10px 26px rgba(245,195,90,0.10); }
        .zs-pack.t4 {
            background: linear-gradient(135deg, #f8d27a 0%, #f5c35a 45%, #c98a2b 100%);
            border-color: transparent; color: #0a1033;
            box-shadow: 0 14px 34px rgba(245,195,90,0.28);
            padding-block: 24px;
        }

        .zs-stack { position: relative; width: 96px; height: 44px; flex: none; }
        .zs-st { position: absolute; top: 3px; inset-inline-start: calc(var(--i) * 18px); z-index: calc(var(--i) + 1); }
        .zs-pack.t4 .zs-coin { box-shadow: 0 0 0 2px #0a1033, 0 4px 10px rgba(0,0,0,0.4); }

        .zs-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .zs-name { font-size: 0.85rem; font-weight: 700; color: #f5c35a; }
        .zs-pack.t4 .zs-name { color: #0a1033; opacity: 0.8; }
        .zs-amt {
            font-size: 1.6rem; line-height: 1.1; font-weight: 900; direction: ltr; text-align: start;
            font-variant-numeric: tabular-nums;
        }
        .zs-amt small { font-size: 0.72rem; font-weight: 700; margin-inline-start: 6px; opacity: 0.7; }

        .zs-price {
            flex: none; min-width: 64px; text-align: center; direction: ltr;
            padding: 10px 14px; border-radius: 14px;
            background: linear-gradient(180deg, #f8d27a, #f5c35a); color: #0a1033;
            font-size: 1rem; font-weight: 900;
        }
        .zs-pack.t4 .zs-price { background: #0a1033; color: #f5c35a; }

        .zs-badge {
            position: absolute; top: -10px; inset-inline-end: 18px;
            padding: 3px 12px; border-radius: 999px;
            background: #2c4bb5; color: #fff; font-size: 0.72rem; font-weight: 800;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        }
        .zs-pack.t4 .zs-badge { background: #0a1033; color: #f5c35a; }

        .zs-note { margin: 22px 8px 0; text-align: center; font-size: 0.78rem; color: #7f8bbd; line-height: 1.6; }

        .zs-toast {
            position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
            background: rgba(17,26,74,0.97); color: #fff; padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(245,195,90,0.3); font-size: 0.85rem; z-index: 4000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zs-toast.show { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
            .zs.open, .zs.open .zs-hero-coin .zs-coin { animation: none; }
            .zs-pack { transition: none; }
        }
    `;

    const isAr = () => (window.userState?.lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);
    const fmt = n => Number(n || 0).toLocaleString('en-US');

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg) {
        let el = document.getElementById('zs-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zs-toast';
            el.className = 'zs-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 2200);
    }

    const ICON_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    const coin = size => `<img class="zs-coin" src="${COIN_SRC}" alt="" width="${size}" height="${size}" draggable="false">`;

    function balance() {
        const u = window.userState || {};
        return u.points ?? u.coins ?? 0;
    }

    function packRow(p) {
        const stack = Array.from({ length: p.tier }, (_, i) =>
            `<span class="zs-st" style="--i:${i}">${coin(38)}</span>`).join('');
        return `
            <button class="zs-pack t${p.tier}" data-pack="${p.id}">
                ${p.badge ? `<span class="zs-badge">${esc(L(p.badge.ar, p.badge.en))}</span>` : ''}
                <span class="zs-stack">${stack}</span>
                <span class="zs-info">
                    <span class="zs-name">${esc(L(p.ar, p.en))}</span>
                    <span class="zs-amt">${fmt(p.coins)}<small>Zelo Coin</small></span>
                </span>
                <span class="zs-price" data-price="${p.id}">${esc(priceLabel(p))}</span>
            </button>`;
    }

    function render() {
        const root = document.getElementById('zs');
        if (!root) return;
        root.dir = isAr() ? 'rtl' : 'ltr';
        root.innerHTML = `
            <header class="zs-top">
                <button class="zs-back" data-act="close" aria-label="${esc(L('رجوع', 'Back'))}">${ICON_BACK}</button>
                <h1 class="zs-title">${esc(L('المتجر', 'Store'))}</h1>
                <span></span>
            </header>
            <div class="zs-scroll">
                <section class="zs-hero">
                    <div class="zs-hero-coin">${coin(88)}</div>
                    <div class="zs-hero-label">${esc(L('رصيدك الحالي', 'Your balance'))}</div>
                    <div class="zs-hero-bal"><span id="zs-bal">${fmt(balance())}</span><small>Zelo Coin</small></div>
                </section>
                <h2 class="zs-sub">${esc(L('اختر باقتك', 'Choose a pack'))}</h2>
                <div class="zs-list">${PACKAGES.map(packRow).join('')}</div>
                <p class="zs-note">${esc(L('تُضاف النقاط إلى رصيدك بعد تأكيد الدفع.', 'Coins are added to your balance once payment is confirmed.'))}</p>
            </div>
        `;
    }

    function build() {
        if (document.getElementById('zs')) return;
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.id = 'zs';
        root.className = 'zs';
        root.addEventListener('click', e => {
            const act = e.target.closest('[data-act]');
            if (act) {
                if (act.dataset.act === 'close') closeStorePage();
                return;
            }
            const pack = e.target.closest('[data-pack]');
            if (!pack) return;
            const p = PACKAGES.find(x => x.id === pack.dataset.pack);
            if (!p) return;
            if (hasPlay()) buyWithGoogle(p);
            else toast(L('الشراء متاح داخل التطبيق فقط', 'Purchases are available in the app only'));
        });
        document.body.appendChild(root);

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && root.classList.contains('open')) closeStorePage();
        });
    }

    function openStorePage() {
        build();
        render();
        document.getElementById('zs').classList.add('open');
        // حمّل أسعار Google المحلية ثم أعد الرسم (والصفحة مفتوحة)
        if (!billingReady && isNativeAndroid()) {
            initPlayBilling().then(() => {
                if (billingReady && document.getElementById('zs')?.classList.contains('open')) render();
            });
        }
    }

    function closeStorePage() {
        document.getElementById('zs')?.classList.remove('open');
    }

    // استدعها بعد نجاح الدفع لتحديث الرقم المعروض
    async function refreshStoreBalance() {
        try { if (typeof window.zeloSyncPointsPool === 'function') await window.zeloSyncPointsPool(); } catch (_) {}
        const el = document.getElementById('zs-bal');
        if (el) el.textContent = fmt(balance());
    }

    window.openStorePage = openStorePage;
    window.closeStorePage = closeStorePage;
    window.refreshStoreBalance = refreshStoreBalance;
})();
