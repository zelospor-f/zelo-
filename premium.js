/* ============================================================
 * premium.js — حالة الاشتراك + بطاقة "وثّق حسابك" + صفحة الاشتراكات
 * طريقة الدفع الوحيدة: الشراء داخل التطبيق عبر Google Play Billing
 * دالة Supabase المطلوبة: google-verify  (body: { product_id, purchase_token } → { ok: true })
 * يعتمد على دالتين في Supabase (premium.sql): is_premium و premium_among
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- الإعدادات: الأسعار والمزايا (عدّلها من هنا فقط) ---------- */
    const PLANS = [
        // id = معرّف الاشتراك في Google Play Console (يجب أن يطابقه حرفياً)، period = monthly | yearly
        // price = للعرض الاحتياطي فقط؛ السعر الحقيقي يُجلب من Google Play ويظهر بعملة المستخدم
        { id: 'zelo_monthly', period: 'monthly', price: 1.99,  months: 1  },
        { id: 'zelo_yearly',  period: 'yearly',  price: 16.99, months: 12 }   // التوفير يُحسب تلقائياً
    ];

    const FEATURES = [
        { icon: '🚫', ar: 'خالي من الإعلانات', en: 'Ad-free experience' },
        { icon: '🏅', ar: 'شعار ناديك المفضل بجانب اسمك', en: 'Your favorite club badge next to your name' },
        { icon: '✍️', ar: 'منشورات أطول حتى 1000 حرف',     en: 'Longer posts up to 1000 characters' },
        { icon: '🎙️', ar: 'رسائل صوتية داخل الغرف',        en: 'Voice messages inside rooms' },
        { icon: '✨', ar: 'استخدام الذكاء الاصطناعي (مساعد المباراة)', en: 'AI assistant (match assistant)' },
        { icon: '🎬', ar: 'فيديو حتى 45 ثانية',            en: 'Videos up to 45 seconds' }
    ];

    /* ---------- ألوان متناسقة مع التطبيق ---------- */
    const C = {
        bg:       'var(--bg-dark, #0a1033)',
        card:     'var(--bg-card, #111a4a)',
        line:     'rgba(255,255,255,0.07)',
        gold:     'var(--accent-gold, #f5c35a)',
        goldLine: 'var(--gold-line, rgba(245,195,90,0.45))',
        main:     'var(--gradient-primary, linear-gradient(135deg,#2c4bb5,#14206b,#f5c35a))',
        mainGlow: '0 8px 24px var(--glow-primary, rgba(44,75,181,0.25))',
        green:    'var(--accent-green, #f5c35a)',
        muted:    'var(--text-muted, #9aa6d6)'
    };

    const TTL = 5 * 60 * 1000;                       // نحفظ النتيجة 5 دقائق
    const known = new Map();                         // user_id -> { pro, t }
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const me = () => String((window.userState && window.userState.userId) || '');
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const money = n => '$' + n.toFixed(2);

    // نسبة التوفير للخطة السنوية مقارنة بالشهرية
    function savingPercent() {
        const m = PLANS.find(p => p.period === 'monthly');
        const y = PLANS.find(p => p.period === 'yearly');
        if (!m || !y) return 0;
        return Math.round((1 - y.price / (m.price * y.months)) * 100);
    }

    // يسأل السيرفر عن قائمة مستخدمين ويحفظ النتيجة
    async function ensure(ids, force) {
        const now = Date.now();
        const need = [...new Set((ids || []).map(String).filter(Boolean))]
            .filter(id => force || !known.has(id) || now - known.get(id).t > TTL);
        if (!need.length) return;
        const c = db();
        if (!c) return;
        try {
            const { data, error } = await c.rpc('premium_among', { p_ids: need });
            if (error) throw error;
            const pro = new Set((data || []).map(x => String(typeof x === 'string' ? x : (x.premium_among || x.user_id || ''))));
            need.forEach(id => known.set(id, { pro: pro.has(id), t: now }));
        } catch (e) {
            console.warn('[premium] check failed', e);
        }
    }

    async function isPremium(force) {
        const uid = me();
        if (!uid) return false;
        await ensure([uid], force);
        return !!(known.get(uid) || {}).pro;
    }

    /* ---------- أنماط الصفحة (تُحقن مرة واحدة) ---------- */
    function injectStyle() {
        if (document.getElementById('zp-style')) return;
        const s = document.createElement('style');
        s.id = 'zp-style';
        s.textContent = `
        #zp-overlay{position:fixed;inset:0;z-index:99999;background:${C.bg};overflow:hidden;
            padding:10px 14px;box-sizing:border-box;display:flex;flex-direction:column;
            font-family:inherit;animation:zpIn .25s ease}
        @keyframes zpIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        #zp-overlay>*{flex-shrink:0}
        #zp-overlay .zp-close{width:40px;height:40px;border-radius:50%;border:none;background:#14206b;
            color:#fff;font-size:1.2rem;cursor:pointer;align-self:flex-start}
        #zp-overlay h2{color:#fff;font-size:1.4rem;font-weight:900;margin:6px 0 2px}
        #zp-overlay .zp-sub{color:${C.muted};font-size:.8rem;margin-bottom:6px}
        #zp-overlay .zp-active{display:none;margin-bottom:6px;padding:6px 10px;border-radius:10px;
            background:rgba(245,195,90,.12);border:1px solid rgba(245,195,90,.4);color:${C.green};font-weight:800;font-size:.8rem}
        #zp-overlay .zp-feat{display:flex;align-items:center;gap:8px;padding:6px 2px;
            border-bottom:1px solid ${C.line};color:#fff;font-size:.85rem}
        #zp-overlay .zp-soon{color:${C.muted};font-size:.7rem}
        #zp-overlay .zp-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
        #zp-overlay .zp-plan{position:relative;margin-top:6px;padding:12px 10px 10px;border-radius:16px;
            background:${C.card};border:1px solid ${C.goldLine}}
        #zp-overlay .zp-plan.best{border:1.5px solid transparent;
            background:linear-gradient(${C.card},${C.card}) padding-box,${C.main} border-box;
            box-shadow:${C.mainGlow}}
        #zp-overlay .zp-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
        #zp-overlay .zp-name{color:#fff;font-size:1rem;font-weight:900}
        #zp-overlay .zp-price{display:block;color:${C.gold};font-size:1.35rem;font-weight:900}
        #zp-overlay .zp-per{color:${C.muted};font-size:.7rem;margin-inline-start:2px}
        #zp-overlay .zp-save{color:${C.green};font-size:.72rem;font-weight:700;margin-top:2px}
        #zp-overlay .zp-tag{position:absolute;top:-9px;inset-inline-start:10px;padding:2px 8px;
            border-radius:20px;background:${C.main};color:#fff;font-size:.62rem;font-weight:800}
        #zp-overlay .zp-btn{width:100%;margin-top:8px;padding:9px;border-radius:12px;
            font-size:.9rem;font-weight:900;cursor:pointer;transition:transform .15s,opacity .15s}
        #zp-overlay .zp-btn:active{transform:scale(.97)}
        #zp-overlay .zp-btn[disabled]{opacity:.6}
        #zp-overlay .zp-btn.main{border:none;color:#fff;background:${C.main};box-shadow:${C.mainGlow}}
        #zp-overlay .zp-btn.ghost{color:${C.gold};background:transparent;border:1.5px solid ${C.goldLine}}
        #zp-overlay .zp-note{color:${C.muted};font-size:.66rem;line-height:1.5;margin-top:8px}
        #zp-promo-btn{width:100%;margin-top:0;padding:13px;border:none;border-radius:16px;
            font-size:1rem;font-weight:900;color:#fff;cursor:pointer;background:${C.main};box-shadow:${C.mainGlow}}
        #zp-promo-btn:active{transform:scale(.98)}`;
        document.head.appendChild(s);
    }

    function toast(msg) {
        if (typeof window.showToast === 'function') return window.showToast(msg);
        let el = document.getElementById('zp-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zp-toast';
            el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:100000;' +
                'background:rgba(17,26,74,.95);color:#fff;padding:10px 18px;border-radius:12px;font-size:.85rem;' +
                'border:1px solid rgba(245,195,90,.3);transition:opacity .25s;pointer-events:none';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 2000);
    }

    /* ---------- صفحة الاشتراكات ---------- */
    function openSubscriptions() {
        injectStyle();
        closeSubscriptions();
        const ar = isAr();
        const dir = ar ? 'rtl' : 'ltr';
        const save = savingPercent();

        const feats = FEATURES.map(f => `
            <div class="zp-feat"><span>${f.icon}</span>
                <span>${ar ? f.ar : f.en}</span>
                ${f.soon ? `<span class="zp-soon">${ar ? 'قريباً' : 'soon'}</span>` : ''}
            </div>`).join('');

        const plans = PLANS.map(p => {
            const yearly = p.period === 'yearly';
            return `
            <div class="zp-plan ${yearly ? 'best' : ''}">
                ${yearly ? `<div class="zp-tag">${ar ? 'الأفضل قيمة' : 'Best value'}</div>` : ''}
                <div class="zp-row">
                    <div class="zp-name">${yearly ? (ar ? 'سنوي' : 'Yearly') : (ar ? 'شهري' : 'Monthly')}</div>
                    <div>
                        <span class="zp-price">${money(p.price)}</span>
                        <span class="zp-per">/ ${yearly ? (ar ? 'سنوياً' : 'year') : (ar ? 'شهرياً' : 'month')}</span>
                    </div>
                </div>
                ${yearly && save > 0 ? `<div class="zp-save">${ar ? `وفّر نحو ${save}٪` : `Save about ${save}%`}</div>` : ''}
                <button class="zp-btn ${yearly ? 'main' : 'ghost'}" data-plan="${p.id}">
                    ${ar ? 'اشترك' : 'Subscribe'}
                </button>
            </div>`;
        }).join('');

        const wrap = document.createElement('div');
        wrap.id = 'zp-overlay';
        wrap.dir = dir;
        wrap.innerHTML = `
            <button class="zp-close" aria-label="close">✕</button>
            <h2>${ar ? 'الاشتراكات' : 'Subscriptions'}</h2>
            <div class="zp-sub">${ar ? 'شارك ناديك المفضل واحصل على مزايا إضافية.' : 'Show your favorite club and unlock extra perks.'}</div>
            <div class="zp-active" id="zp-active">${ar ? '✅ اشتراكك فعّال' : '✅ Your subscription is active'}</div>
            ${feats}
            <div class="zp-plans">${plans}</div>
            <div class="zp-note">${ar ? 'الدفع عبر Google Play. يتجدد الاشتراك تلقائياً ويمكنك إلغاؤه في أي وقت من إعدادات الاشتراكات في Google Play.'
                                      : 'Billed through Google Play. The subscription renews automatically and you can cancel anytime in Google Play subscription settings.'}</div>
            <button class="zp-btn ghost" id="zp-restore" style="margin-top:8px">${ar ? 'استعادة مشترياتي' : 'Restore purchases'}</button>`;
        document.body.appendChild(wrap);

        wrap.querySelector('.zp-close').onclick = closeSubscriptions;
        isPremium().then(ok => {
            const a = document.getElementById('zp-active');
            if (a && ok) a.style.display = 'block';
        });
        wrap.querySelectorAll('[data-plan]').forEach(b => {
            b.onclick = () => startPay(b.dataset.plan, b);
        });
        wrap.querySelector('#zp-restore').onclick = restorePurchases;
        // الأسعار الحقيقية من Google Play (بعملة المستخدم)
        loadPrices().then(m => wrap.querySelectorAll('[data-plan]').forEach(b => {
            const el = b.closest('.zp-plan') && b.closest('.zp-plan').querySelector('.zp-price');
            if (el && m[b.dataset.plan]) el.textContent = m[b.dataset.plan];
        }));
    }

    function closeSubscriptions() {
        const el = document.getElementById('zp-overlay');
        if (el) el.remove();
    }

    /* ---------- أدوات صغيرة ---------- */
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- الشراء عبر Google Play Billing ----------
     * يدعم طريقتين، وتُختار تلقائياً حسب نوع التطبيق:
     *  1) Digital Goods API  → تطبيق TWA (Trusted Web Activity)
     *  2) إضافة cordova-plugin-purchase (CdvPurchase) → Capacitor / Cordova
     * في الحالتين: التحقق والتفعيل يتمان في السيرفر (google-verify). */
    const PLAY_BILLING = 'https://play.google.com/billing';
    let dgService = null;
    let storeReady = false;

    const hasPlugin = () => !!(window.CdvPurchase && window.CdvPurchase.store);

    async function getDG() {
        if (dgService) return dgService;
        if (typeof window.getDigitalGoodsService !== 'function') return null;
        try { dgService = await window.getDigitalGoodsService(PLAY_BILLING); } catch (e) { dgService = null; }
        return dgService;
    }

    // بصمة الحساب: تربط الشراء بحساب المستخدم لدى Google ويتحقق منها الخادم (google-verify)
    let acct = '';
    async function ensureAcct() {
        const uid = me();
        if (!uid) return '';
        if (!acct) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zelo:' + uid));
            acct = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return acct;
    }

    // يرسل رمز الشراء للسيرفر: يتحقق لدى Google، يؤكّد الشراء (acknowledge)، ثم يفعّل الاشتراك
    async function verifyOnServer(productId, token) {
        const c = db();
        if (!c) return { ok: false, msg: 'no_client' };
        try {
            const { data, error } = await c.functions.invoke('google-verify',
                { body: { product_id: productId, purchase_token: token } });
            if (error) {
                let msg = error.message || 'error';
                try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
                return { ok: false, msg };
            }
            return (data && data.ok) ? { ok: true } : { ok: false, msg: (data && data.error) || 'verify_failed' };
        } catch (e) {
            return { ok: false, msg: String((e && e.message) || e) };
        }
    }

    async function onPaid() {
        await isPremium(true);
        closeSubscriptions();
        mountPromo();
        toast(isAr() ? '✅ تم تفعيل اشتراكك' : '✅ Subscription activated');
    }

    // --- المسار 1: Digital Goods API ---
    async function buyWithDigitalGoods(planId) {
        const req = new PaymentRequest(
            [{ supportedMethods: PLAY_BILLING, data: { sku: planId } }],
            { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }
        );
        const res = await req.show();
        const token = res.details && res.details.purchaseToken;
        const v = token ? await verifyOnServer(planId, token) : { ok: false, msg: 'no_token' };
        try { await res.complete(v.ok ? 'success' : 'fail'); } catch (e) {}
        return v;
    }

    // --- المسار 2: إضافة الشراء (Capacitor / Cordova) ---
    function setupPlugin() {
        if (storeReady || !hasPlugin()) return;
        const { store, ProductType, Platform } = window.CdvPurchase;
        store.register(PLANS.map(p => ({ id: p.id, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY })));
        store.applicationUsername = () => acct || undefined;   // يصل إلى Google كمعرّف الحساب
        // أي عملية شراء معتمدة (حتى المعلّقة من جلسة سابقة) تُرسل للسيرفر ثم تُنهى
        store.when().approved(async tx => {
            const token = tx.nativePurchase && tx.nativePurchase.purchaseToken;
            const prod = tx.products && tx.products[0] && tx.products[0].id;
            if (!token || !prod) return;
            if (!PLANS.some(x => x.id === prod)) return;   // مشتريات النقاط يعالجها store.js
            const v = await verifyOnServer(prod, token);
            if (v.ok) { try { await tx.finish(); } catch (e) {} onPaid(); }
            else toast((isAr() ? 'تعذّر تفعيل الاشتراك: ' : 'Could not activate: ') + v.msg);
        });
        store.initialize([Platform.GOOGLE_PLAY]);
        storeReady = true;
    }
    document.addEventListener('deviceready', () => { try { setupPlugin(); } catch (e) {} });

    // يعيد إرسال الاشتراكات القائمة للخادم مرة واحدة في الجلسة: يمدّد التجديد التلقائي ويحدّث الانتهاء
    let revalidated = false;
    async function revalidateOwned() {
        if (revalidated || !hasPlugin() || !me()) return;
        revalidated = true;
        try {
            await ensureAcct();
            setupPlugin();
            const { store, Platform } = window.CdvPurchase;
            const txs = (store.localTransactions || []).filter(t => t.platform === Platform.GOOGLE_PLAY);
            let n = 0;
            for (const tx of txs) {
                const prod = tx.products && tx.products[0] && tx.products[0].id;
                const token = tx.nativePurchase && tx.nativePurchase.purchaseToken;
                if (!token || !PLANS.some(p => p.id === prod) || n++ >= 3) continue;
                const v = await verifyOnServer(prod, token);
                if (v.ok) { await isPremium(true); break; }
            }
        } catch (e) { console.warn('[premium] revalidate failed', e); }
    }

    async function buyWithPlugin(planId) {
        if (!(await ensureAcct())) return { ok: false, msg: 'not_signed_in' };
        setupPlugin();
        const { store, Platform, ErrorCode } = window.CdvPurchase;
        const product = store.get(planId, Platform.GOOGLE_PLAY);
        const offer = product && product.getOffer();
        if (!offer) return { ok: false, msg: 'product_not_found' };
        const err = await store.order(offer);
        if (err) return { ok: false, msg: (ErrorCode && err.code === ErrorCode.PAYMENT_CANCELLED) ? 'cancelled' : (err.message || 'order_failed') };
        return { ok: true, pending: true };   // التفعيل يتم داخل approved
    }

    // أسعار Google Play الحقيقية (بعملة المستخدم المحلية)
    async function loadPrices() {
        const map = {};
        try {
            const dg = await getDG();
            if (dg) {
                const details = await dg.getDetails(PLANS.map(p => p.id));
                (details || []).forEach(d => {
                    map[d.itemId] = new Intl.NumberFormat(isAr() ? 'ar' : 'en',
                        { style: 'currency', currency: d.price.currency }).format(Number(d.price.value));
                });
            } else if (hasPlugin()) {
                setupPlugin();
                const { store, Platform } = window.CdvPurchase;
                PLANS.forEach(p => {
                    const pr = store.get(p.id, Platform.GOOGLE_PLAY);
                    const o = pr && pr.getOffer();
                    const ph = o && o.pricingPhases && o.pricingPhases[0];
                    if (ph && ph.price) map[p.id] = ph.price;
                });
            }
        } catch (e) { console.warn('[premium] prices failed', e); }
        return map;
    }

    /* ---------- بدء الشراء ---------- */
    async function startPay(planId, btn) {
        const ar = isAr();
        if (!PLANS.some(p => p.id === planId)) return;
        try {
            if (btn) btn.disabled = true;
            let r;
            if (await getDG()) r = await buyWithDigitalGoods(planId);
            else if (hasPlugin()) r = await buyWithPlugin(planId);
            else return toast(ar ? 'الشراء متاح داخل تطبيق Google Play فقط' : 'Purchases are available in the Google Play app only');
            if (r.ok && !r.pending) return onPaid();
            if (!r.ok && r.msg !== 'cancelled') toast((ar ? 'تعذّر إتمام الشراء: ' : 'Purchase failed: ') + r.msg);
        } catch (e) {
            if (e && e.name === 'AbortError') return;      // المستخدم أغلق نافذة الدفع
            console.warn('[premium] purchase failed', e);
            toast(ar ? 'تعذّر إتمام الشراء، حاول مرة أخرى' : 'Purchase failed, try again');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // استعادة المشتريات (مثلاً بعد إعادة تثبيت التطبيق)
    async function restorePurchases() {
        const ar = isAr();
        try {
            const dg = await getDG();
            if (dg) {
                const list = await dg.listPurchases();
                for (const p of (list || [])) {
                    if (!PLANS.some(x => x.id === p.itemId)) continue;
                    const v = await verifyOnServer(p.itemId, p.purchaseToken);
                    if (v.ok) return onPaid();
                }
            } else if (hasPlugin()) {
                setupPlugin();
                await window.CdvPurchase.store.restorePurchases();
                return toast(ar ? 'جارٍ البحث عن مشترياتك…' : 'Looking for your purchases…');
            } else {
                return toast(ar ? 'الشراء متاح داخل تطبيق Google Play فقط' : 'Purchases are available in the Google Play app only');
            }
            toast(ar ? 'لا توجد مشتريات لاستعادتها' : 'No purchases to restore');
        } catch (e) {
            console.warn('[premium] restore failed', e);
            toast(ar ? 'تعذّرت الاستعادة' : 'Restore failed');
        }
    }

    /* ---------- بطاقة "وثّق حسابك" في الملف الشخصي (لغير المشتركين) ---------- */
    async function mountPromo() {
        revalidateOwned();
        const box = document.getElementById('verify-promo');
        if (!box) return;
        injectStyle();
        const pro = await isPremium();
        if (pro) { box.innerHTML = ''; return; }
        const ar = isAr();
        box.innerHTML = `
            <div style="margin:14px 0; padding:18px; border-radius:20px; direction:${ar ? 'rtl' : 'ltr'};
                        background:rgba(17,26,74,0.6); border:1px solid ${C.goldLine};">
                <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:6px;">
                    ${ar ? 'وثّق حسابك بشعار ناديك المفضل' : 'Verify your account with your favorite club badge'}
                </div>
                <div style="font-size:0.82rem; color:${C.muted}; line-height:1.6; margin-bottom:12px;">
                    ${ar ? 'اشترك لتظهر بجانب اسمك شارة ناديك، مع منشورات أطول ورسائل صوتية في الغرف.'
                         : 'Subscribe to show your club badge next to your name, with longer posts and voice messages in rooms.'}
                </div>
                <button id="zp-promo-btn" onclick="window.openSubscriptions()">
                    ${ar ? 'عرض الاشتراكات' : 'View subscriptions'}
                </button>
            </div>`;
    }

    window.openSubscriptions = openSubscriptions;
    window.closeSubscriptions = closeSubscriptions;

    window.ZeloPremium = {
        PLANS,                      // الأسعار متاحة لباقي الملفات
        ensure,
        isPremium,
        mountPromo,
        openSubscriptions,
        closeSubscriptions,
        subscribe: planId => startPay(planId),
        restore: restorePurchases,
        has: uid => !!(known.get(String(uid)) || {}).pro,
        refresh: () => isPremium(true),
        revalidate: revalidateOwned
    };
})();
