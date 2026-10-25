/* ============================================================
 * premium.js — حالة الاشتراك + بطاقة "وثّق حسابك" + صفحة الاشتراكات
 * طرق الدفع: USDT (Solana) / SOL / حوالة بنكية TRY
 * دوال Supabase: usdt-create/usdt-verify ، sol-create/sol-verify ، bank-create
 * يعتمد على دالتين في Supabase (premium.sql): is_premium و premium_among
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- الإعدادات: الأسعار والمزايا (عدّلها من هنا فقط) ---------- */
    const PLANS = [
        // id = معرّف الخطة (يطابق sol-create.ts)، period = monthly | yearly
        // price = بالدولار ، try = بالليرة (للعرض فقط؛ المبلغ الفعلي يحدده السيرفر)
        { id: 'zelo_monthly', period: 'monthly', price: 1.99,  try: 100, months: 1  },
        { id: 'zelo_yearly',  period: 'yearly',  price: 16.99, try: 840, months: 12 }   // التوفير يُحسب تلقائياً
    ];

    const FEATURES = [
        { icon: '🏅', ar: 'شعار ناديك المفضل بجانب اسمك', en: 'Your favorite club badge next to your name' },
        { icon: '✍️', ar: 'منشورات أطول حتى 1000 حرف',     en: 'Longer posts up to 1000 characters' },
        { icon: '🎙️', ar: 'رسائل صوتية داخل الغرف',        en: 'Voice messages inside rooms' },
        { icon: '🎬', ar: 'فيديو حتى 45 ثانية',            en: 'Videos up to 45 seconds', soon: true }
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
        return Math.round((1 - y.try / (m.try * y.months)) * 100);
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
        #zp-overlay .zp-try{display:block;color:${C.muted};font-size:.78rem;font-weight:700}
        #zp-overlay .zp-copyrow{display:flex;align-items:center;justify-content:space-between;gap:10px;
            padding:10px 12px;border-radius:12px;background:${C.card};border:1px solid ${C.line}}
        #zp-overlay .zp-cl{color:${C.muted};font-size:.7rem}
        #zp-overlay .zp-cv{color:#fff;font-size:.9rem;font-weight:800;word-break:break-all}
        #zp-overlay .zp-cp{flex-shrink:0;padding:6px 12px;border-radius:10px;border:1px solid ${C.goldLine};
            background:transparent;color:${C.gold};font-weight:800;font-size:.75rem;cursor:pointer}
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
                    <div class="zp-try">${p.try} ₺</div>
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
            <div class="zp-note">${ar ? 'الدفع بـ USDT أو SOL أو حوالة بنكية. يُفعَّل الاشتراك لمدة الخطة المختارة، ويمكنك التجديد قبل انتهائه.'
                                      : 'Pay with USDT, SOL or bank transfer. Your subscription runs for the chosen period and you can renew before it ends.'}</div>`;
        document.body.appendChild(wrap);

        wrap.querySelector('.zp-close').onclick = closeSubscriptions;
        isPremium().then(ok => {
            const a = document.getElementById('zp-active');
            if (a && ok) a.style.display = 'block';
        });
        wrap.querySelectorAll('[data-plan]').forEach(b => {
            b.onclick = () => showMethods(b.dataset.plan);
        });
    }

    function closeSubscriptions() {
        stopPolling();
        const el = document.getElementById('zp-overlay');
        if (el) el.remove();
    }

    /* ---------- أدوات صغيرة ---------- */
    let payTimer = null;
    function stopPolling() {
        if (payTimer) { clearInterval(payTimer); payTimer = null; }
    }

    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function fallbackCopy(t) {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        ta.remove();
        return ok;
    }
    function copyText(t) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(t).then(() => true).catch(() => fallbackCopy(t));
            }
        } catch (e) {}
        return Promise.resolve(fallbackCopy(t));
    }

    // يفتح لوحة فوق صفحة الاشتراكات (نفس المعرّف لتُستبدل اللوحة السابقة)
    function openBox(inner) {
        const wrap = document.getElementById('zp-overlay');
        if (!wrap) return null;
        stopPolling();
        const old = document.getElementById('zp-paybox');
        if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'zp-paybox';
        box.style.cssText = 'position:absolute;inset:0;z-index:2;background:' + C.bg +
            ';padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto';
        box.innerHTML = inner;
        wrap.appendChild(box);
        const back = box.querySelector('[data-back]');
        if (back) back.onclick = () => { stopPolling(); box.remove(); };
        box.querySelectorAll('[data-copy]').forEach(b => {
            b.onclick = async () => {
                await copyText(b.dataset.copy);
                toast(isAr() ? 'تم النسخ' : 'Copied');
            };
        });
        return box;
    }

    /* ---------- التحقق من الدفعة (SOL / USDT) ---------- */
    // يسأل السيرفر هل وصلت الدفعة. يرجع { ok, msg } حيث msg هو الرد الحقيقي من السيرفر
    async function checkOrder(orderId, fn) {
        const c = db();
        if (!c) return { ok: false, msg: 'no_client' };
        try {
            const { data, error } = await c.functions.invoke(fn, { body: { order_id: orderId } });
            if (error) {
                let msg = error.message || 'error';
                try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
                return { ok: false, msg };
            }
            if (data && data.ok) return { ok: true };
            return { ok: false, msg: (data && data.error) || 'not_found_yet' };
        } catch (e) {
            return { ok: false, msg: String((e && e.message) || e) };
        }
    }

    async function onPaid() {
        stopPolling();
        await isPremium(true);
        closeSubscriptions();
        mountPromo();
        toast(isAr() ? '✅ تم تفعيل اشتراكك' : '✅ Subscription activated');
    }

    // لوحة الدفع بالعملات الرقمية. cfg = { fn, title, amount, note }
    function showPayBox(order, cfg) {
        const ar = isAr();
        const box = openBox(`
            <button class="zp-close" data-back aria-label="back">✕</button>
            <h2 style="color:#fff;margin:4px 0 0">${esc(cfg.title)}</h2>
            <div style="color:${C.gold};font-size:1.6rem;font-weight:900">${esc(cfg.amount)}</div>
            <div style="color:${C.muted};font-size:.75rem">
                ${ar ? 'السعر مثبّت لهذا الطلب لمدة ساعة.' : 'Price is locked for this order for one hour.'}
            </div>
            <button class="zp-btn main" id="zp-open-wallet">${ar ? 'افتح محفظتي للدفع' : 'Open my wallet to pay'}</button>
            <div id="zp-pay-status" style="color:${C.muted};font-size:.8rem;margin-top:4px">
                ${ar ? '⏳ بانتظار وصول الدفعة…' : '⏳ Waiting for payment…'}
            </div>
            <button class="zp-btn ghost" id="zp-check-now">${ar ? 'دفعتُ، تحقق الآن' : "I've paid, check now"}</button>
            <div class="zp-note">${esc(cfg.note)}</div>`);
        if (!box) return;

        const status = box.querySelector('#zp-pay-status');
        box.querySelector('#zp-open-wallet').onclick = () => { window.location.href = order.pay_url; };
        box.querySelector('#zp-check-now').onclick = async () => {
            status.textContent = ar ? '🔎 جارٍ التحقق…' : '🔎 Checking…';
            const r = await checkOrder(order.order_id, cfg.fn);
            if (r.ok) return onPaid();
            status.textContent = (ar ? '⏳ لم تصل الدفعة بعد' : '⏳ Payment not seen yet') + ' [' + r.msg + ']';
        };

        // تحقق تلقائي كل 4 ثوانٍ لمدة 10 دقائق
        const until = Date.now() + 10 * 60 * 1000;
        payTimer = setInterval(async () => {
            if (!document.getElementById('zp-paybox') || Date.now() > until) return stopPolling();
            const r = await checkOrder(order.order_id, cfg.fn);
            if (r.ok) onPaid();
            else if (r.msg !== 'not_found_yet') status.textContent = '⚠️ ' + r.msg;
        }, 4000);
    }

    /* ---------- لوحة الحوالة البنكية ---------- */
    function showBankBox(o) {
        const ar = isAr();
        const row = (label, val, copyVal) => `
            <div class="zp-copyrow">
                <div><div class="zp-cl">${label}</div><div class="zp-cv">${esc(val)}</div></div>
                <button class="zp-cp" data-copy="${esc(copyVal == null ? val : copyVal)}">${ar ? 'نسخ' : 'Copy'}</button>
            </div>`;
        const box = openBox(`
            <button class="zp-close" data-back aria-label="back">✕</button>
            <h2 style="color:#fff;margin:4px 0 0">${ar ? '🏦 حوالة بنكية' : '🏦 Bank transfer'}</h2>
            <div style="color:${C.gold};font-size:1.6rem;font-weight:900">${esc(o.amount_try)} ₺</div>
            ${row(ar ? 'اسم صاحب الحساب' : 'Account holder', o.holder)}
            ${row('IBAN', o.iban, String(o.iban).replace(/\s+/g, ''))}
            ${row(ar ? 'رمز طلبك: اكتبه في وصف الحوالة (Açıklama)' : 'Your order code: put it in the transfer description (Açıklama)', o.code)}
            <div class="zp-note">${ar
                ? 'حوّل المبلغ كاملاً، واكتب الرمز أعلاه في خانة الوصف، فبه نعرف أن الحوالة منك. يُفعَّل اشتراكك بعد وصول الحوالة ومراجعتها. لا تُغيّر الرمز ولا تشاركه مع غيرك.'
                : 'Send the full amount and write the code above in the description field so we can match the transfer to you. Your subscription is activated after the transfer arrives and is reviewed. Do not change or share the code.'}</div>
            <button class="zp-btn main" id="zp-bank-done">${ar ? 'تم التحويل' : "I've sent the transfer"}</button>`);
        if (!box) return;
        box.querySelector('#zp-bank-done').onclick = () => {
            closeSubscriptions();
            toast(ar ? 'سنفعّل اشتراكك بعد وصول الحوالة' : 'We will activate your subscription once the transfer arrives');
        };
    }

    /* ---------- اختيار طريقة الدفع ---------- */
    function showMethods(planId) {
        const ar = isAr();
        const plan = PLANS.find(p => p.id === planId);
        if (!plan) return;
        const yearly = plan.period === 'yearly';
        const box = openBox(`
            <button class="zp-close" data-back aria-label="back">✕</button>
            <h2 style="color:#fff;margin:4px 0 0">${ar ? 'اختر طريقة الدفع' : 'Choose payment method'}</h2>
            <div style="color:${C.muted};font-size:.85rem">
                ${yearly ? (ar ? 'سنوي' : 'Yearly') : (ar ? 'شهري' : 'Monthly')} — ${money(plan.price)} / ${plan.try} ₺
            </div>
            <button class="zp-btn main" data-m="usdt">💵 USDT (Solana) — ${money(plan.price)}</button>
            <button class="zp-btn ghost" data-m="sol">◎ SOL</button>
            <button class="zp-btn ghost" data-m="bank">🏦 ${ar ? 'حوالة بنكية' : 'Bank transfer'} — ${plan.try} ₺</button>`);
        if (!box) return;
        box.querySelectorAll('[data-m]').forEach(b => {
            b.onclick = () => startPay(planId, b.dataset.m, b);
        });
    }

    // يُستدعى عند اختيار طريقة الدفع
    async function startPay(planId, method, btn) {
        const ar = isAr();
        const c = db();
        if (!c) return toast(ar ? 'تعذّر الاتصال بالخادم' : 'Server unavailable');
        const fn = { usdt: 'usdt-create', sol: 'sol-create', bank: 'bank-create' }[method];
        if (!fn) return;
        try {
            if (btn) btn.disabled = true;
            const { data, error } = await c.functions.invoke(fn, { body: { package_id: planId } });
            if (error || !data || !data.order_id) throw (error || new Error('create failed'));

            if (method === 'bank') return showBankBox(data);
            if (method === 'usdt') {
                return showPayBox(data, {
                    fn: 'usdt-verify',
                    title: ar ? 'الدفع بعملة USDT' : 'Pay with USDT',
                    amount: data.amount_usdt + ' USDT',
                    note: ar
                        ? 'الشبكة: Solana وعملة USDT فقط. ادفع من محفظتك عبر الزر أعلاه (يحمل رمز طلبك)، وأرسل المبلغ كاملاً. بعد تأكيد الشبكة يُفعَّل الاشتراك تلقائياً.'
                        : 'Network: Solana, USDT only. Pay from your wallet using the button above (it carries your order reference) and send the full amount. Your subscription activates automatically after confirmation.'
                });
            }
            return showPayBox(data, {
                fn: 'sol-verify',
                title: ar ? 'الدفع بعملة SOL' : 'Pay with SOL',
                amount: data.amount_sol + ' SOL',
                note: ar
                    ? 'بعد تأكيد الشبكة (عادة أقل من دقيقة) يُفعَّل الاشتراك تلقائياً. ادفع من محفظتك عبر الزر أعلاه وأرسل المبلغ المطلوب كاملاً.'
                    : 'Once the network confirms (usually under a minute) your subscription activates automatically. Pay from your wallet using the button above and send the full amount.'
            });
        } catch (e) {
            console.warn('[premium] create order failed', e);
            toast(ar ? 'تعذّر إنشاء الطلب، حاول مرة أخرى' : 'Could not create the order, try again');
        } finally {
            if (btn) btn.disabled = false;
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
        subscribe: showMethods,
        has: uid => !!(known.get(String(uid)) || {}).pro,
        refresh: () => isPremium(true)
    };
})();
