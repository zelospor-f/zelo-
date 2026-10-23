/* ============================================================
 * premium.js — حالة الاشتراك + بطاقة "وثّق حسابك" + صفحة الاشتراكات
 * يعتمد على دالتين في Supabase (premium.sql): is_premium و premium_among
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- الإعدادات: الأسعار والمزايا (عدّلها من هنا فقط) ---------- */
    const PLANS = [
        // id = معرّف المنتج (يطابق Google Play لاحقاً)، period = monthly | yearly
        { id: 'zelo_monthly', period: 'monthly', price: 2.99,  months: 1  },
        { id: 'zelo_yearly',  period: 'yearly',  price: 24.99, months: 12 }   // التوفير يُحسب تلقائياً
    ];

    const FEATURES = [
        { icon: '🏅', ar: 'شعار ناديك المفضل بجانب اسمك', en: 'Your favorite club badge next to your name' },
        { icon: '✍️', ar: 'منشورات أطول حتى 1000 حرف',     en: 'Longer posts up to 1000 characters' },
        { icon: '🎙️', ar: 'رسائل صوتية داخل الغرف',        en: 'Voice messages inside rooms' },
        { icon: '🎬', ar: 'فيديو حتى 45 ثانية',            en: 'Videos up to 45 seconds', soon: true }
    ];

    /* ---------- ألوان متناسقة مع التطبيق ---------- */
    const C = {
        bg:       '#111114',
        card:     '#1a1a20',
        line:     'rgba(255,255,255,0.07)',
        gold:     '#f5c542',                                   // لون عملة ZELO
        goldLine: 'rgba(245,197,66,0.45)',
        main:     'linear-gradient(90deg,#ff3b2f 0%,#c62f63 55%,#9b34a0 100%)', // نفس زر "شاهد الإعلان"
        mainGlow: '0 8px 24px rgba(220,50,90,0.35)',
        green:    '#22e07a',
        muted:    '#9a9fb5'
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
        #zp-overlay{position:fixed;inset:0;z-index:99999;background:${C.bg};overflow-y:auto;
            padding:20px 18px 40px;font-family:inherit;animation:zpIn .25s ease}
        @keyframes zpIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        #zp-overlay .zp-close{width:48px;height:48px;border-radius:50%;border:none;background:#24242b;
            color:#fff;font-size:1.4rem;cursor:pointer}
        #zp-overlay h2{color:#fff;font-size:1.7rem;font-weight:900;margin:18px 0 6px}
        #zp-overlay .zp-sub{color:${C.muted};font-size:.9rem;margin-bottom:14px}
        #zp-overlay .zp-active{display:none;margin-bottom:14px;padding:10px 12px;border-radius:12px;
            background:rgba(34,224,122,.12);border:1px solid rgba(34,224,122,.4);color:${C.green};font-weight:800}
        #zp-overlay .zp-feat{display:flex;align-items:center;gap:10px;padding:14px 2px;
            border-bottom:1px solid ${C.line};color:#fff;font-size:1rem}
        #zp-overlay .zp-soon{color:${C.muted};font-size:.78rem}
        #zp-overlay .zp-plan{position:relative;margin-top:16px;padding:18px;border-radius:22px;
            background:${C.card};border:1px solid ${C.goldLine}}
        #zp-overlay .zp-plan.best{border:1.5px solid transparent;
            background:linear-gradient(${C.card},${C.card}) padding-box,${C.main} border-box;
            box-shadow:${C.mainGlow}}
        #zp-overlay .zp-row{display:flex;justify-content:space-between;align-items:baseline}
        #zp-overlay .zp-name{color:#fff;font-size:1.3rem;font-weight:900}
        #zp-overlay .zp-price{color:${C.gold};font-size:2rem;font-weight:900}
        #zp-overlay .zp-per{color:${C.muted};font-size:.85rem;margin:0 6px}
        #zp-overlay .zp-save{color:${C.green};font-size:.95rem;font-weight:700;margin-top:4px}
        #zp-overlay .zp-tag{position:absolute;top:-11px;inset-inline-start:18px;padding:3px 12px;
            border-radius:20px;background:${C.main};color:#fff;font-size:.72rem;font-weight:800}
        #zp-overlay .zp-btn{width:100%;margin-top:14px;padding:15px;border-radius:16px;
            font-size:1.05rem;font-weight:900;cursor:pointer;transition:transform .15s,opacity .15s}
        #zp-overlay .zp-btn:active{transform:scale(.97)}
        #zp-overlay .zp-btn[disabled]{opacity:.6}
        #zp-overlay .zp-btn.main{border:none;color:#fff;background:${C.main};box-shadow:${C.mainGlow}}
        #zp-overlay .zp-btn.ghost{color:${C.gold};background:transparent;border:1.5px solid ${C.goldLine}}
        #zp-overlay .zp-note{color:${C.muted};font-size:.8rem;line-height:1.7;margin-top:20px}
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
                'background:rgba(28,28,34,.95);color:#fff;padding:10px 18px;border-radius:12px;font-size:.85rem;' +
                'border:1px solid rgba(245,197,66,.3);transition:opacity .25s;pointer-events:none';
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
            ${plans}
            <div class="zp-note">${ar ? 'يتم الدفع عبر Google Play ويمكنك إلغاء الاشتراك في أي وقت من المتجر.'
                                      : 'Billed via Google Play. Cancel anytime from the store.'}</div>`;
        document.body.appendChild(wrap);

        wrap.querySelector('.zp-close').onclick = closeSubscriptions;
        isPremium().then(ok => {
            const a = document.getElementById('zp-active');
            if (a && ok) a.style.display = 'block';
        });
        wrap.querySelectorAll('[data-plan]').forEach(b => {
            b.onclick = () => subscribe(b.dataset.plan, b);
        });
    }

    function closeSubscriptions() {
        const el = document.getElementById('zp-overlay');
        if (el) el.remove();
    }

    // يُستدعى عند الضغط على "اشترك" — اربطه بـ Google Play Billing لاحقاً
    async function subscribe(planId, btn) {
        const ar = isAr();
        if (typeof window.ZeloBilling === 'object' && window.ZeloBilling.purchase) {
            try {
                if (btn) btn.disabled = true;
                await window.ZeloBilling.purchase(planId);
                await isPremium(true);
                closeSubscriptions();
                mountPromo();
            } catch (e) {
                console.warn('[premium] purchase failed', e);
            } finally {
                if (btn) btn.disabled = false;
            }
        } else {
            toast(ar ? 'الدفع عبر Google Play قريباً' : 'Payment via Google Play is coming soon');
        }
    }

    /* ---------- بطاقة "وثّق حسابك" في الملف الشخصي (لغير المشتركين) ---------- */
    async function mountPromo() {
        const box = document.getElementById('verify-promo');
        if (!box) return;
        injectStyle();
        const pro = await isPremium();
        if (pro) { box.innerHTML = ''; return; }
        const ar = isAr();
        box.innerHTML = `
            <div style="margin:14px 0; padding:18px; border-radius:20px; direction:${ar ? 'rtl' : 'ltr'};
                        background:rgba(28,28,34,0.6); border:1px solid ${C.goldLine};">
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
        subscribe,
        has: uid => !!(known.get(String(uid)) || {}).pro,
        refresh: () => isPremium(true)
    };
})();
