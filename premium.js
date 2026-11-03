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
        // m / y = معرّف المنتج في Google Play Console (يجب أن يطابقه حرفياً) + السعر الاحتياطي للعرض (السعر الحقيقي يُجلب من Google)
        { tier: 1, ar: 'الأساسية', en: 'Basic', m: { id: 'zelo_t1_m', price: 0.99 }, y: { id: 'zelo_t1_y', price: 8.49 } },
        { tier: 2, ar: 'المميّزة',  en: 'Plus',  m: { id: 'zelo_t2_m', price: 1.99 }, y: { id: 'zelo_t2_y', price: 16.99 } },
        { tier: 3, ar: 'الكاملة',   en: 'Pro',   m: { id: 'zelo_t3_m', price: 4.99 }, y: { id: 'zelo_t3_y', price: 41.99 }, best: true }
    ];
    const SKUS = PLANS.reduce((a, p) => a.concat([p.m.id, p.y.id]), []);
    const planOfSku = id => PLANS.find(p => p.m.id === id || p.y.id === id);
    const savePct = p => Math.round((1 - p.y.price / (p.m.price * 12)) * 100);

    // المزايا الجديدة في كل درجة (الدرجة الأعلى تشمل ما قبلها)
    const TIER_FEATURES = {
        1: [
            { icon: '🏅', ar: 'توثيق الحساب وشعار ناديك بجانب اسمك', en: 'Verified account with your club badge' },
            { icon: '✍️', ar: 'منشورات أطول حتى 1000 حرف', en: 'Longer posts up to 1000 characters' }
        ],
        2: [
            { icon: '🖼️', ar: 'نشر الصور في المنشورات والردود', en: 'Post images in posts and replies' },
            { icon: '🎬', ar: 'نشر الفيديو', en: 'Video posts' },
            { icon: '✨', ar: 'استخدام الذكاء الاصطناعي (مساعد المباراة)', en: 'AI assistant (match assistant)' }
        ],
        3: [
            { icon: '🧩', ar: 'نوع المنشور (لاعب، مدرب، حكم، مقارنة...)', en: 'Post types (player, coach, referee, compare...)' },
            { icon: '⚽', ar: 'توقّع المباريات داخل المنشور', en: 'Match predictions inside posts' }
        ]
    };
    // جدول المزايا: لكل ميزة أقل درجة تفتحها (label = كلمة صغيرة بجانب العلامة حسب الدرجة)
    const MATRIX = [
        { min: 1, ar: 'توثيق الحساب وشعار النادي', en: 'Verified account and club badge' },
        { min: 1, ar: 'منشور أطول (حتى 1000 حرف)', en: 'Longer posts (up to 1000 characters)' },
        { min: 2, ar: 'نشر الصور', en: 'Post images' },
        { min: 2, ar: 'نشر الفيديو', en: 'Post videos' },
        { min: 2, ar: 'الذكاء الاصطناعي', en: 'AI assistant' },
        { min: 3, ar: 'نوع المنشور', en: 'Post types' },
        { min: 3, ar: 'توقّع المباريات', en: 'Match predictions' }
    ];
    const FEATURES = [];

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
    const known = new Map();                         // user_id -> { pro, tier, t }
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const me = () => String((window.userState && window.userState.userId) || '');
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const money = n => '$' + n.toFixed(2);

    // يسأل السيرفر عن قائمة مستخدمين ويحفظ النتيجة
    async function ensure(ids, force) {
        const now = Date.now();
        const need = [...new Set((ids || []).map(String).filter(Boolean))]
            .filter(id => force || !known.has(id) || now - known.get(id).t > TTL);
        if (!need.length) return;
        const c = db();
        if (!c) return;
        try {
            const { data, error } = await c.rpc('tier_among', { p_ids: need });
            if (error) throw error;
            const tiers = {};
            (data || []).forEach(x => { tiers[String(x.user_id)] = Number(x.tier) || 0; });
            need.forEach(id => known.set(id, { pro: (tiers[id] || 0) > 0, tier: tiers[id] || 0, t: now }));
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

    // درجة المستخدم الحالي: 0 مجاني، 1..3
    async function myTier(force) {
        const uid = me();
        if (!uid) return 0;
        await ensure([uid], force);
        return Number((known.get(uid) || {}).tier) || 0;
    }

    /* ---------- أنماط الصفحة (تُحقن مرة واحدة) ---------- */
    function injectStyle() {
        if (document.getElementById('zp-style')) return;
        const s = document.createElement('style');
        s.id = 'zp-style';
        s.textContent = `
        #zp-overlay{position:fixed;inset:0;z-index:99999;background:${C.bg};overflow-y:auto;
            padding:10px 14px;box-sizing:border-box;display:flex;flex-direction:column;
            font-family:inherit;animation:zpIn .25s ease}
        @keyframes zpIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        #zp-overlay>*{flex-shrink:0}
        #zp-overlay .zp-close{align-self:flex-start}
        #zp-overlay h2{color:#fff;font-size:1.4rem;font-weight:900;margin:6px 0 2px}
        #zp-overlay .zp-sub{color:${C.muted};font-size:.8rem;margin-bottom:6px}
        #zp-overlay .zp-active{display:none;margin-bottom:6px;padding:6px 10px;border-radius:10px;
            background:rgba(245,195,90,.12);border:1px solid rgba(245,195,90,.4);color:${C.green};font-weight:800;font-size:.8rem}
        #zp-overlay .zp-feat{display:flex;align-items:center;gap:8px;padding:6px 2px;
            border-bottom:1px solid ${C.line};color:#fff;font-size:.85rem}
        #zp-overlay .zp-soon{color:${C.muted};font-size:.7rem}
        #zp-overlay .zp-plans{display:flex;gap:12px;margin-top:14px;overflow-x:auto;scroll-snap-type:x mandatory;
            -webkit-overflow-scrolling:touch;scrollbar-width:none;padding:6px 2px 4px}
        #zp-overlay .zp-plans::-webkit-scrollbar{display:none}
        #zp-overlay .zp-plans .zp-plan{flex:0 0 82%;scroll-snap-align:center;margin-top:0}
        #zp-overlay .zp-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}
        #zp-overlay .zp-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25);transition:all .2s}
        #zp-overlay .zp-dots i.on{background:${C.gold};width:18px;border-radius:6px}
        #zp-overlay .zp-rw{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;
            border-top:1px solid ${C.line};color:#fff;font-size:.82rem}
        #zp-overlay .zp-rw.off{color:#6f7aa8}
        #zp-overlay .zp-rw b{font-size:1rem;font-weight:900}
        #zp-overlay .zp-rw .y{color:#2de2c4}#zp-overlay .zp-rw .n{color:#ff6b86}
        #zp-overlay .zp-lb{font-size:.68rem;color:${C.muted};margin-inline-start:6px}
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

        const plans = PLANS.map(p => {
            const rows = MATRIX.map(f => {
                const on = p.tier >= f.min;
                const lb = on && f.label && f.label[p.tier] ? `<span class="zp-lb">${ar ? f.label[p.tier][0] : f.label[p.tier][1]}</span>` : '';
                return `<div class="zp-rw ${on ? '' : 'off'}"><span>${ar ? f.ar : f.en}${lb}</span><b class="${on ? 'y' : 'n'}">${on ? '✓' : '✗'}</b></div>`;
            }).join('');
            return `
            <div class="zp-plan ${p.best ? 'best' : ''}" data-tier="${p.tier}">
                ${p.best ? `<div class="zp-tag">${ar ? 'الأفضل قيمة' : 'Best value'}</div>` : ''}
                <div class="zp-row" style="flex-direction:row;justify-content:space-between;align-items:baseline;width:100%;margin-bottom:6px">
                    <div class="zp-name">${ar ? p.ar : p.en}</div>
                    <div><span class="zp-price">${money(p.m.price)}</span><span class="zp-per">/ ${ar ? 'شهرياً' : 'month'}</span></div>
                </div>
                ${rows}
                <button class="zp-btn ${p.best ? 'main' : 'ghost'}" data-tier="${p.tier}">${ar ? 'اشترك' : 'Subscribe'}</button>
            </div>`;
        }).join('');
        const feats = '';

        const wrap = document.createElement('div');
        wrap.id = 'zp-overlay';
        wrap.dir = dir;
        wrap.innerHTML = `
            ${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn('window.closeSubscriptions()', ar, 'zp-close') : '<button class="zp-close" aria-label="back" style="width:40px;height:40px;border-radius:12px;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.2);color:#f5c35a;font-size:20px;cursor:pointer">' + (ar ? '›' : '‹') + '</button>'}
            <h2>${ar ? 'الاشتراكات' : 'Subscriptions'}</h2>
            <div class="zp-sub">${ar ? 'شارك ناديك المفضل واحصل على مزايا إضافية.' : 'Show your favorite club and unlock extra perks.'}</div>
            <div class="zp-active" id="zp-active">${ar ? '✅ اشتراكك فعّال' : '✅ Your subscription is active'}</div>
            ${feats}
            <div class="zp-plans" id="zp-plans">${plans}</div>
            <div class="zp-dots" id="zp-dots">${PLANS.map((p, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
            <div class="zp-note">${ar ? 'الدفع عبر Google Play. يتجدد الاشتراك تلقائياً ويمكنك إلغاؤه في أي وقت من إعدادات الاشتراكات في Google Play.'
                                      : 'Billed through Google Play. The subscription renews automatically and you can cancel anytime in Google Play subscription settings.'}</div>
            <div class="zp-note" style="color:#ffb4a8">${ar ? 'تحذير: أي تلاعب في الكورة أو المكافآت أو الإعلانات يعرّض الحساب للحذف وخسارة كل شيء، بما في ذلك الاشتراك والرصيد، دون تعويض.' : 'Warning: any manipulation of Kora, rewards or ads may lead to account deletion and loss of everything, including your subscription and balance, with no refund.'}</div>
            <button class="zp-btn ghost" id="zp-restore" style="margin-top:8px">${ar ? 'استعادة مشترياتي' : 'Restore purchases'}</button>`;
        document.body.appendChild(wrap);

        wrap.querySelector('.zp-close').addEventListener('click', function (e) { e.preventDefault(); closeSubscriptions(); });
        myTier().then(t => {
            const a = document.getElementById('zp-active');
            if (a && t > 0) {
                const pl = PLANS.find(p => p.tier === t);
                a.textContent = (isAr() ? '✅ اشتراكك فعّال: ' : '✅ Active: ') + (pl ? (isAr() ? pl.ar : pl.en) : '');
                a.style.display = 'block';
            }
        });
        let curTier = 0;
        const refreshBtns = () => wrap.querySelectorAll('.zp-btn[data-tier]').forEach(b => {
            const t = Number(b.dataset.tier);
            b.textContent = curTier === 0 ? (ar ? 'اشترك' : 'Subscribe')
                : t > curTier ? (ar ? 'ترقية' : 'Upgrade')
                : t === curTier ? (ar ? 'باقتك الحالية' : 'Your current plan')
                : (ar ? 'باقتك أعلى من هذه' : 'Your plan is higher');
            b.style.opacity = t <= curTier && curTier > 0 ? '.55' : '1';
        });
        myTier().then(t => { curTier = t; refreshBtns(); });
        wrap.querySelectorAll('.zp-btn[data-tier]').forEach(b => {
            b.onclick = () => {
                const t = Number(b.dataset.tier);
                if (curTier > 0 && t === curTier) return toast(ar ? 'هذه باقتك الحالية' : 'This is your current plan');
                if (curTier > 0 && t < curTier) return toast(ar ? 'لا يمكن النزول إلى باقة أقل أثناء اشتراكك الحالي' : 'You cannot move to a lower plan while subscribed');
                openChooser(PLANS.find(p => p.tier === t), curTier > 0);
            };
        });
        wrap.querySelector('#zp-restore').onclick = restorePurchases;
        const strip = wrap.querySelector('#zp-plans'), dots = wrap.querySelectorAll('#zp-dots i');
        const setDots = () => {
            const cards = [...strip.children];
            const mid = strip.getBoundingClientRect().left + strip.clientWidth / 2;
            let best = 0, d = 1e9;
            cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const x = Math.abs(r.left + r.width / 2 - mid); if (x < d) { d = x; best = i; } });
            dots.forEach((el, i) => el.classList.toggle('on', i === best));
        };
        strip.addEventListener('scroll', () => requestAnimationFrame(setDots));
        setTimeout(() => { const first = strip.firstElementChild; if (first) first.scrollIntoView({ inline: 'center', block: 'nearest' }); setDots(); }, 60);
        // الأسعار الحقيقية من Google Play (بعملة المستخدم)
        loadPrices().then(m => {
            realPrices = m || {};
            wrap.querySelectorAll('.zp-plan').forEach(card => {
                const p = PLANS.find(x => x.tier === Number(card.dataset.tier));
                const el = card.querySelector('.zp-price');
                if (p && el && realPrices[p.m.id]) el.textContent = realPrices[p.m.id];
            });
        });
    }

    let realPrices = {};
    function openChooser(p, isUpgrade) {
        const ar = isAr();
        const ov = document.getElementById('zp-overlay');
        if (!ov || !p) return;
        const old = document.getElementById('zp-choose');
        if (old) old.remove();
        const pm = realPrices[p.m.id] || money(p.m.price), py = realPrices[p.y.id] || money(p.y.price);
        const box = document.createElement('div');
        box.id = 'zp-choose';
        box.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;direction:' + (ar ? 'rtl' : 'ltr');
        box.innerHTML = `
            <div style="width:100%;background:#111a4a;border-radius:20px 20px 0 0;padding:16px 16px calc(24px + env(safe-area-inset-bottom,0px));box-sizing:border-box;border-top:1px solid ${C.goldLine}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <div style="color:#fff;font-size:1.05rem;font-weight:900">${isUpgrade ? (ar ? 'ترقية إلى ' : 'Upgrade to ') : ''}${ar ? p.ar : p.en}</div>
                    <button id="zp-ch-x" aria-label="close" style="background:none;border:none;color:${C.muted};font-size:1.3rem;cursor:pointer">✕</button>
                </div>
                <button class="zp-btn ghost" data-sku="${p.m.id}" style="margin-top:0;display:flex;justify-content:space-between;align-items:center">
                    <span>${ar ? 'شهري' : 'Monthly'}</span><span>${esc(pm)} / ${ar ? 'شهر' : 'mo'}</span>
                </button>
                <button class="zp-btn main" data-sku="${p.y.id}" style="display:flex;justify-content:space-between;align-items:center;position:relative">
                    <span>${ar ? 'سنوي' : 'Yearly'} <span style="background:#0a1033;color:${C.gold};font-size:.68rem;padding:2px 8px;border-radius:20px;margin-inline-start:6px">${ar ? 'وفّر ' + savePct(p) + '٪' : 'Save ' + savePct(p) + '%'}</span></span>
                    <span>${esc(py)} / ${ar ? 'سنة' : 'yr'}</span>
                </button>
                ${isUpgrade ? `<div class="zp-note">${ar ? 'الترقية فورية. تُحسب لك المدة المتبقية من باقتك الحالية.' : 'Upgrades apply immediately. Your remaining time is credited.'}</div>` : ''}
            </div>`;
        ov.appendChild(box);
        box.querySelector('#zp-ch-x').onclick = () => box.remove();
        box.addEventListener('click', e => { if (e.target === box) box.remove(); });
        box.querySelectorAll('[data-sku]').forEach(b => {
            b.onclick = async () => { await startPay(b.dataset.sku, b, isUpgrade); box.remove(); };
        });
    }

    function closeSubscriptions() {
        const c = document.getElementById('zp-choose'); if (c) c.remove();
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
        if (storeReady || !hasPlugin() || !window.zeloBilling) return;
        window.zeloBilling.init();
        storeReady = true;
    }
    // نتيجة التحقق من السيرفر (تأتي من google-verify.js)
    document.addEventListener('zelo-purchase', e => {
        const d = e.detail || {};
        if (d.kind !== 'sub') return;
        if (d.ok) onPaid();
        else toast((isAr() ? 'تعذّر تفعيل الاشتراك: ' : 'Could not activate: ') + d.msg);
    });
    document.addEventListener('deviceready', () => { try { setupPlugin(); } catch (e) {} });

    async function buyWithPlugin(planId, upgrade) {
        setupPlugin();
        const { store, Platform, ErrorCode } = window.CdvPurchase;
        const product = store.get(planId, Platform.GOOGLE_PLAY);
        const offer = product && product.getOffer();
        if (!offer) return { ok: false, msg: 'product_not_found' };
        if (window.zeloBilling) await window.zeloBilling.prepare();
        let extra;
        if (upgrade) {
            // ترقية: نستبدل الاشتراك الحالي (الرمز القديم من الخادم)
            try {
                const { data } = await db().rpc('my_active_sub');
                const row = Array.isArray(data) ? data[0] : data;
                if (row && row.purchase_token) {
                    const RM = window.CdvPurchase.GooglePlay && window.CdvPurchase.GooglePlay.ReplacementMode;
                    const samePeriod = String(row.product_id || '').slice(-2) === String(planId).slice(-2);
                    extra = { googlePlay: { oldPurchaseToken: row.purchase_token,
                        replacementMode: RM ? (samePeriod ? RM.CHARGE_PRORATED_PRICE : RM.CHARGE_FULL_PRICE) : undefined } };
                }
            } catch (e) { console.warn('[premium] upgrade token failed', e); }
        }
        const err = extra ? await store.order(offer, extra) : await store.order(offer);
        if (err) return { ok: false, msg: (ErrorCode && err.code === ErrorCode.PAYMENT_CANCELLED) ? 'cancelled' : (err.message || 'order_failed') };
        return { ok: true, pending: true };   // التفعيل يتم داخل approved
    }

    // أسعار Google Play الحقيقية (بعملة المستخدم المحلية)
    async function loadPrices() {
        const map = {};
        try {
            const dg = await getDG();
            if (dg) {
                const details = await dg.getDetails(SKUS);
                (details || []).forEach(d => {
                    map[d.itemId] = new Intl.NumberFormat(isAr() ? 'ar' : 'en',
                        { style: 'currency', currency: d.price.currency }).format(Number(d.price.value));
                });
            } else if (hasPlugin()) {
                setupPlugin();
                const { store, Platform } = window.CdvPurchase;
                SKUS.forEach(sku => {
                    const pr = store.get(sku, Platform.GOOGLE_PLAY);
                    const o = pr && pr.getOffer();
                    const ph = o && o.pricingPhases && o.pricingPhases[0];
                    if (ph && ph.price) map[sku] = ph.price;
                });
            }
        } catch (e) { console.warn('[premium] prices failed', e); }
        return map;
    }

    /* ---------- بدء الشراء ---------- */
    async function startPay(planId, btn, upgrade) {
        const ar = isAr();
        if (!SKUS.includes(planId)) return;
        try {
            if (btn) btn.disabled = true;
            let r;
            if (await getDG()) r = await buyWithDigitalGoods(planId);
            else if (hasPlugin()) r = await buyWithPlugin(planId, upgrade);
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
                    if (!SKUS.includes(p.itemId)) continue;
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
        const box = document.getElementById('verify-promo');
        if (!box || box.dataset.closed === '1') return; // أغلقها المستخدم في هذه الزيارة
        injectStyle();
        const pro = await isPremium();
        if (pro) { box.innerHTML = ''; return; }
        const ar = isAr();
        box.innerHTML = `
            <div style="position:relative; margin:14px 0; padding:18px; border-radius:20px; direction:${ar ? 'rtl' : 'ltr'};
                        background:rgba(17,26,74,0.6); border:1px solid ${C.goldLine};">
                <button id="zp-promo-x" aria-label="${ar ? 'إغلاق' : 'Close'}"
                        style="position:absolute; top:8px; inset-inline-end:8px; width:30px; height:30px; padding:0; border-radius:50%; border:none; background:rgba(255,255,255,0.08); color:#9aa6d6; font-size:18px; line-height:1; cursor:pointer;">✕</button>
                <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:6px;">
                    ${ar ? 'وثّق حسابك بشعار ناديك المفضل' : 'Verify your account with your favorite club badge'}
                </div>
                <div style="font-size:0.82rem; color:${C.muted}; line-height:1.6; margin-bottom:12px;">
                    ${ar ? 'اشترك لتظهر بجانب اسمك شارة ناديك، مع منشورات أطول وصور، وباقات أعلى للفيديو والتوقّعات.'
                         : 'Subscribe to show your club badge next to your name, with longer posts and images, and higher plans for video and predictions.'}
                </div>
                <button id="zp-promo-btn" onclick="window.openSubscriptions()">
                    ${ar ? 'عرض الاشتراكات' : 'View subscriptions'}
                </button>
            </div>`;
        const x = document.getElementById('zp-promo-x');
        if (x) x.onclick = () => { box.dataset.closed = '1'; box.innerHTML = ''; }; // تظهر من جديد عند الدخول للملف في المرة القادمة
    }

    window.openSubscriptions = openSubscriptions;
    window.closeSubscriptions = closeSubscriptions;

    window.ZeloPremium = {
        PLANS,                      // الأسعار متاحة لباقي الملفات
        ensure,
        isPremium,
        myTier,
        tierOf: uid => Number((known.get(String(uid)) || {}).tier) || 0,
        mountPromo,
        openSubscriptions,
        closeSubscriptions,
        subscribe: planId => startPay(planId),
        SKUS,
        restore: restorePurchases,
        has: uid => !!(known.get(String(uid)) || {}).pro,
        refresh: () => isPremium(true)
    };
})();
