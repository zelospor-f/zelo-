/* ZELO FC — صفحة المتجر (Zelo Coin)
 * تُفتح من القائمة الجانبية عبر window.openStorePage()
 * الدفع: عرّف الدالة window.zeloStorePay(pkg, method) لربطها بـ PayTR أو SOL
 *   pkg    = { id, coins, price, ... }
 *   method = 'card' | 'sol'
 */
(function () {
    'use strict';

    // صورة العملة (مقتطعة من الشعار). ضعها بجانب index.html أو غيّر المسار
    const COIN_SRC = 'zelo-coin.png';

    // الباقات: عدّل الأرقام والأسعار من هنا فقط
    const PACKAGES = [
        { id: 'starter',  tier: 1, coins: 100,  price: 1,  ar: 'باقة المبتدئ', en: 'Starter' },
        { id: 'pro',      tier: 2, coins: 500,  price: 5,  ar: 'باقة المحترف', en: 'Pro',
          badge: { ar: 'الأكثر طلباً', en: 'Most popular' } },
        { id: 'elite',    tier: 3, coins: 1000, price: 10, ar: 'باقة النجم',   en: 'Elite' },
        { id: 'ultimate', tier: 4, coins: 2000, price: 20, ar: 'باقة الأسطورة', en: 'Ultimate',
          badge: { ar: 'الأكبر', en: 'Biggest' } }
    ];

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

        /* نافذة اختيار الدفع */
        .zs-ov {
            position: absolute; inset: 0; background: rgba(0,0,0,0.6);
            opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
        }
        .zs-ov.open { opacity: 1; pointer-events: auto; }
        .zs-sheet {
            position: absolute; left: 0; right: 0; bottom: 0;
            background: #0d1540; border-top: 1px solid rgba(245,195,90,0.3);
            border-radius: 24px 24px 0 0;
            padding: 12px 18px calc(20px + env(safe-area-inset-bottom, 0px));
            transform: translateY(105%); transition: transform 0.28s ease;
        }
        .zs-sheet.open { transform: none; }
        .zs-grab { width: 42px; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.2); margin: 0 auto 16px; }
        .zs-sum { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .zs-sum-t { flex: 1; font-weight: 900; font-size: 1.1rem; direction: ltr; text-align: start; font-variant-numeric: tabular-nums; }
        .zs-sum-t small { display: block; font-size: 0.78rem; color: #f5c35a; font-weight: 700; direction: inherit; }
        .zs-sum-p { font-weight: 900; font-size: 1.2rem; color: #f5c35a; direction: ltr; }
        .zs-ask { margin: 0 0 10px; font-size: 0.85rem; color: #9aa6d6; font-weight: 600; }
        .zs-method {
            width: 100%; display: flex; align-items: center; gap: 12px;
            padding: 14px 16px; margin-bottom: 10px; border-radius: 16px; cursor: pointer;
            background: #111a4a; border: 1px solid rgba(255,255,255,0.1);
            color: #f8fafc; font-size: 1rem; font-weight: 800; text-align: start;
        }
        .zs-method:active { background: #17226a; }
        .zs-method svg { color: #f5c35a; flex: none; }
        .zs-method span { flex: 1; }
        .zs-method small { display: block; font-size: 0.75rem; font-weight: 600; color: #9aa6d6; }
        .zs-cancel {
            width: 100%; padding: 12px; border: none; background: transparent; cursor: pointer;
            color: #9aa6d6; font-size: 0.95rem; font-weight: 700;
        }

        .zs-toast {
            position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
            background: rgba(17,26,74,0.97); color: #fff; padding: 10px 18px; border-radius: 12px;
            border: 1px solid rgba(245,195,90,0.3); font-size: 0.85rem; z-index: 4000;
            opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
        }
        .zs-toast.show { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
            .zs.open, .zs.open .zs-hero-coin .zs-coin { animation: none; }
            .zs-sheet, .zs-ov, .zs-pack { transition: none; }
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
    const ICON_CARD = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg>';
    const ICON_SOL = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M7 4.5h13.5L17.8 8H4.3zM4.3 10.2h13.5l2.7 3.5H7zM7 15.9h13.5L17.8 19.5H4.3z"/></svg>';

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
                <span class="zs-price">$${p.price}</span>
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
            <div class="zs-ov" id="zs-ov" data-act="sheet-close"></div>
            <div class="zs-sheet" id="zs-sheet" role="dialog" aria-modal="true"></div>
        `;
    }

    function openSheet(p) {
        const sheet = document.getElementById('zs-sheet');
        sheet.innerHTML = `
            <div class="zs-grab"></div>
            <div class="zs-sum">
                ${coin(46)}
                <div class="zs-sum-t">${fmt(p.coins)} Zelo Coin<small>${esc(L(p.ar, p.en))}</small></div>
                <div class="zs-sum-p">$${p.price}</div>
            </div>
            <p class="zs-ask">${esc(L('اختر طريقة الدفع', 'Choose how to pay'))}</p>
            <button class="zs-method" data-method="card" data-pack="${p.id}">
                ${ICON_CARD}<span>${esc(L('بطاقة بنكية', 'Bank card'))}<small>${esc(L('دفع آمن عبر PayTR', 'Secure payment via PayTR'))}</small></span>
            </button>
            <button class="zs-method" data-method="sol" data-pack="${p.id}">
                ${ICON_SOL}<span>${esc(L('عملة SOL', 'SOL'))}<small>${esc(L('من محفظة سولانا', 'From your Solana wallet'))}</small></span>
            </button>
            <button class="zs-cancel" data-act="sheet-close">${esc(L('إلغاء', 'Cancel'))}</button>
        `;
        void sheet.offsetWidth;
        document.getElementById('zs-ov').classList.add('open');
        sheet.classList.add('open');
    }

    function closeSheet() {
        document.getElementById('zs-ov')?.classList.remove('open');
        document.getElementById('zs-sheet')?.classList.remove('open');
    }

    function pay(p, method) {
        closeSheet();
        if (typeof window.zeloStorePay === 'function') {
            window.zeloStorePay({ ...p }, method);
        } else {
            toast(L('الدفع سيتوفر قريباً', 'Payments are coming soon'));
        }
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
            const method = e.target.closest('[data-method]');
            if (method) {
                const p = PACKAGES.find(x => x.id === method.dataset.pack);
                if (p) pay(p, method.dataset.method);
                return;
            }
            const act = e.target.closest('[data-act]');
            if (act) {
                if (act.dataset.act === 'close') closeStorePage();
                if (act.dataset.act === 'sheet-close') closeSheet();
                return;
            }
            const pack = e.target.closest('[data-pack]');
            if (pack) {
                const p = PACKAGES.find(x => x.id === pack.dataset.pack);
                if (p) openSheet(p);
            }
        });
        document.body.appendChild(root);

        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !root.classList.contains('open')) return;
            if (document.getElementById('zs-sheet')?.classList.contains('open')) closeSheet();
            else closeStorePage();
        });
    }

    function openStorePage() {
        build();
        render();
        document.getElementById('zs').classList.add('open');
    }

    function closeStorePage() {
        closeSheet();
        document.getElementById('zs')?.classList.remove('open');
    }

    // استدعها بعد نجاح الدفع لتحديث الرقم المعروض
    function refreshStoreBalance() {
        const el = document.getElementById('zs-bal');
        if (el) el.textContent = fmt(balance());
    }

    window.openStorePage = openStorePage;
    window.closeStorePage = closeStorePage;
    window.refreshStoreBalance = refreshStoreBalance;
})();
