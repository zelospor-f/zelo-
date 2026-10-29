// support.js — دعم المنشورات بالنقاط (ملف منفصل ومستقل)
(function () {
    'use strict';

    // ===================== الإعدادات (عدّل القيم هنا فقط) =====================
    // يجب أن تطابق القيم نفسها في دالة support_post في support_schema.sql
    const CONFIG = {
        MIN_AMOUNT: 1,                              // الحد الأدنى للدعم بالنقاط
        DAILY_LIMIT: 5000,                          // الحد اليومي لكل مستخدم
        FEE_PERCENT: 10,                            // عمولة المنصة %
        COMBO_RESET_MS: 4000,                       // مدة انتظار الكومبو قبل أن يُصفَّر
        // الهدايا: السعر = عدد النقاط التي تُخصم (يجب أن يطابق حدود الدالة في القاعدة)
        // emoji: أيقونة جاهزة | shirt + num: قميص برقم عام (لا أسماء لاعبين حقيقيين)
        GIFTS: [
            { id: 'ball',    price: 1,    name: { ar: 'كرة',          en: 'Ball' },      emoji: '⚽', bg: 'rgba(255,255,255,.12)' },
            { id: 'boot',    price: 10,   name: { ar: 'حذاء ذهبي',    en: 'Golden boot' }, emoji: '👟', bg: 'linear-gradient(135deg,#ffe29a,#f5a623)' },
            { id: 'cup',     price: 500,  name: { ar: 'كأس',          en: 'Cup' },       emoji: '🏆', bg: 'linear-gradient(135deg,#eef1f6,#aab3c2)' },
            { id: 'goldcup', price: 1000, name: { ar: 'كأس البطولة',  en: 'Champions cup' }, emoji: '🏆', bg: 'linear-gradient(135deg,#ffe29a,#f5a623)' }
        ],
        // قمصان المراكز: أرقام عامة بلا أسماء لاعبين أو شعارات أندية
        SHIRTS: [
            { num: '1',  pos: { ar: 'حارس المرمى', en: 'Goalkeeper' },  price: 20,  color: '#2e7d32' },
            { num: '4',  pos: { ar: 'مدافع',       en: 'Defender' },    price: 20,  color: '#546e7a' },
            { num: '5',  pos: { ar: 'مدافع',       en: 'Defender' },    price: 20,  color: '#455a64' },
            { num: '6',  pos: { ar: 'وسط',         en: 'Midfielder' },  price: 50,  color: '#6a1b9a' },
            { num: '8',  pos: { ar: 'وسط',         en: 'Midfielder' },  price: 50,  color: '#00838f' },
            { num: '7',  pos: { ar: 'جناح',        en: 'Winger' },      price: 100, color: '#c0392b' },
            { num: '11', pos: { ar: 'جناح',        en: 'Winger' },      price: 100, color: '#ef6c00' },
            { num: '9',  pos: { ar: 'مهاجم',       en: 'Striker' },     price: 150, color: '#2c4bb5' },
            { num: '10', pos: { ar: 'صانع ألعاب',  en: 'Playmaker' },   price: 200, color: '#b7791f' }
        ],
        // قميص المرسل: رقم يختاره (1-99) واسم حسابه هو فقط، دون كتابة أي اسم آخر
        CUSTOM_SHIRT: { price: 100, color: '#c0392b' },
        SUPPORTERS_LIMIT: 50,                       // عدد الداعمين المعروضين في القائمة
        // صورة العملة (رابط مباشر raw من GitHub، ويجب أن يكون المستودع عاماً)
        COIN_URL: 'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png'
    };

    // ===================== الألوان (لتغيير الشكل من مكان واحد) =====================
    const THEME = {
        gold: '#f5c35a',
        goldDeep: '#f5a623',
        surface: '#121215',
        card: '#1a1a20',
        border: 'rgba(245,195,90,.18)',
        text: '#f8fafc',
        muted: '#8b92a3'
    };

    // ===================== أدوات مساعدة =====================
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : (window.userState || {});
    const isAr = () => (US().lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const coin = (size = '1em') =>
        `<img src="${CONFIG.COIN_URL}" alt="ZELO" style="width:${size};height:${size};vertical-align:middle;display:inline-block;flex-shrink:0;">`;

    // المستخدم الحالي: يُفضّل استخدام دالة التطبيق لأنها تعرف الاسم
    const me = () => (typeof window.zeloMe === 'function')
        ? window.zeloMe()
        : { id: String(US().userId || ''), name: '' };

    function toast(msg) {
        let el = $('zsup-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zsup-toast';
            el.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:${THEME.card};color:${THEME.text};padding:12px 20px;border-radius:14px;border:1px solid ${THEME.border};box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:.88rem;font-weight:700;z-index:5200;transition:opacity .25s;pointer-events:none;max-width:85%;text-align:center;`;
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 2800);
    }

    function errText(e) {
        const m = String(e?.message || '');
        if (m.includes('forbidden')) return L('سجّل الدخول من جديد', 'Please sign in again');
        if (m.includes('insufficient_balance')) return L('رصيدك لا يكفي', 'Your balance is not enough');
        if (m.includes('daily_limit')) return L('وصلت إلى حد الدعم اليومي', 'You reached your daily support limit');
        if (m.includes('own_post')) return L('لا يمكنك دعم منشورك', 'You cannot support your own post');
        if (m.includes('post_not_found')) return L('المنشور غير موجود', 'Post not found');
        if (m.includes('invalid_gift')) return L('هذه الهدية غير متاحة، حدّث التطبيق', 'This gift is unavailable, please update the app');
        if (m.includes('invalid_amount')) return L('المبلغ غير صالح', 'Invalid amount');
        return L('تعذّر الدعم، حاول لاحقاً', 'Could not support, try again later');
    }

    async function fetchBalance() {
        const c = db();
        const uid = US().userId;
        if (!c || !uid) return 0;
        const { data } = await c.from('users').select('points').eq('user_id', String(uid)).maybeSingle();
        return Number(data?.points) || 0;
    }

    function closeAll() {
        flushNotify();
        $('zsup-overlay')?.remove();
        $('zsup-list-overlay')?.remove();
    }

    // أساس الواجهة: خلفية ضبابية، وورقة سفلية بحواف ناعمة
    const sheetBase = z => `
        position:fixed;inset:0;background:rgba(3,4,8,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
        display:flex;align-items:flex-end;justify-content:center;z-index:${z};`;
    const sheetPanel = (maxH = '90vh') => `
        background:linear-gradient(180deg,#16161c 0%,${THEME.surface} 100%);
        border:1px solid ${THEME.border};border-bottom:none;border-radius:28px 28px 0 0;
        padding:10px 20px calc(22px + env(safe-area-inset-bottom,0px));
        width:100%;max-width:520px;max-height:${maxH};overflow-y:auto;color:${THEME.text};box-sizing:border-box;
        box-shadow:0 -20px 60px rgba(0,0,0,.5);`;
    const grabber = `<div style="width:42px;height:4px;border-radius:4px;background:rgba(255,255,255,.15);margin:0 auto 14px;"></div>`;
    const headerRow = (titleHtml, closeId) => `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <button id="${closeId}" type="button" aria-label="close" style="width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:${THEME.text};font-size:1rem;cursor:pointer;">✕</button>
            <div style="display:flex;align-items:center;gap:8px;font-size:1.05rem;font-weight:900;">${titleHtml}</div>
            <span style="width:34px;"></span>
        </div>`;

    // ===================== نافذة الهدايا =====================
    const sup = { postId: null, ownerId: null, tab: 'gifts', gift: 0, customNum: '10', balance: 0, busy: false, combo: 0, comboNet: 0, timer: null };

    // أيقونة هدية دائرية (إيموجي أو قميص برقم)
    function giftIcon(g, size) {
        const inner = g.shirt
            ? `<svg viewBox="0 0 48 48" width="${Math.round(size * 0.72)}" height="${Math.round(size * 0.72)}" aria-hidden="true"><path d="M16 6L6 12L10 22L15 20L15 42L33 42L33 20L38 22L42 12L32 6C30 10 18 10 16 6Z" fill="${g.shirt}" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linejoin="round"/><text x="24" y="32" text-anchor="middle" font-size="${String(g.num).length > 1 ? 14 : 17}" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">${esc(g.num)}</text></svg>`
            : `<span style="font-size:${Math.round(size * 0.5)}px;line-height:1;">${g.emoji}</span>`;
        return `<span style="width:${size}px;height:${size}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:${g.bg};border:1px solid rgba(255,255,255,.14);">${inner}</span>`;
    }

    const myName = () => String(me().name || '').trim().slice(0, 12);

    function shirtItems() {
        const nm = myName();
        const custom = {
            id: 'custom', price: CONFIG.CUSTOM_SHIRT.price,
            name: { ar: 'قميصك', en: 'Your shirt' },
            sub: nm || L('باسمك', 'With your name'),
            shirt: CONFIG.CUSTOM_SHIRT.color, num: sup.customNum, bg: 'rgba(245,195,90,.18)', tag: nm
        };
        return [custom].concat(CONFIG.SHIRTS.map(x => ({
            id: 's' + x.num, price: x.price,
            name: { ar: 'قميص ' + x.num, en: 'Shirt ' + x.num },
            sub: L(x.pos.ar, x.pos.en), shirt: x.color, num: x.num, bg: 'rgba(255,255,255,.08)'
        })));
    }
    const items = () => (sup.tab === 'shirts' ? shirtItems() : CONFIG.GIFTS);
    function curGift() { const l = items(); return l[sup.gift] || l[0]; }

    function drawGrid() {
        const box = $('zsup-grid');
        if (!box) return;
        box.innerHTML = items().map((g, i) =>
            `<button type="button" class="zsup-gift" data-i="${i}" style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 4px 10px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:${THEME.card};color:${THEME.text};cursor:pointer;transition:all .15s;font-family:inherit;min-width:0;">
                ${giftIcon(g, 54)}
                <span style="font-size:.8rem;font-weight:800;">${esc(L(g.name.ar, g.name.en))}</span>
                ${g.sub ? `<span style="font-size:.68rem;color:${THEME.muted};max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(g.sub)}</span>` : ''}
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:.78rem;color:${THEME.gold};font-weight:900;font-variant-numeric:tabular-nums;">${fmt(g.price)} ${coin('.9em')}</span>
            </button>`).join('');
        box.querySelectorAll('.zsup-gift').forEach(b => {
            b.onclick = () => { flushNotify(); sup.gift = Number(b.dataset.i); update(); };
        });
    }

    function setTab(t) {
        if (sup.tab === t) return;
        flushNotify();
        sup.tab = t;
        sup.gift = 0;
        drawGrid();
        update();
    }

    function buildSheet() {
        $('zsup-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'zsup-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = sheetBase(4500);

        const tabBtn = (id, label) =>
            `<button type="button" id="zsup-tab-${id}" style="flex:1;padding:10px 0;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:${THEME.card};color:${THEME.text};font-weight:800;font-size:.9rem;cursor:pointer;font-family:inherit;">${label}</button>`;

        ov.innerHTML = `
            <div style="${sheetPanel()}">
                ${grabber}
                ${headerRow(`${coin('1.2em')}<span>${L('أرسل هدية للكاتب', 'Send the author a gift')}</span>`, 'zsup-x')}

                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    ${tabBtn('gifts', L('الهدايا', 'Gifts'))}
                    ${tabBtn('shirts', L('القمصان', 'Shirts'))}
                </div>

                <div id="zsup-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px;"></div>

                <div id="zsup-custom-row" style="display:none;align-items:center;gap:10px;margin-bottom:12px;background:${THEME.card};border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:10px 14px;">
                    <span style="color:${THEME.muted};font-size:.84rem;flex:1;">${L('رقم قميصك (1 - 99)', 'Your shirt number (1 - 99)')}</span>
                    <input id="zsup-num" type="number" min="1" max="99" step="1" inputmode="numeric" value="${esc(sup.customNum)}"
                           style="width:76px;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:${THEME.surface};color:${THEME.text};font-size:1rem;font-weight:900;text-align:center;outline:none;">
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;background:${THEME.card};border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px 16px;">
                    <span style="color:${THEME.muted};font-size:.84rem;">${L(`يصل للكاتب (بعد عمولة ${CONFIG.FEE_PERCENT}%)`, `Author receives (after ${CONFIG.FEE_PERCENT}% fee)`)}</span>
                    <span id="zsup-net" style="font-weight:900;color:${THEME.gold};font-variant-numeric:tabular-nums;"></span>
                </div>

                <div id="zsup-balance" style="margin-top:12px;font-size:.84rem;color:${THEME.muted};text-align:center;"></div>
                <p id="zsup-msg" style="font-size:.82rem;margin:6px 0 0;min-height:18px;text-align:center;"></p>

                <button id="zsup-submit" type="button" style="margin-top:8px;width:100%;padding:16px;border:none;border-radius:16px;background:linear-gradient(135deg,#ffd978 0%,${THEME.goldDeep} 100%);color:#121215;font-size:1rem;font-weight:900;cursor:pointer;box-shadow:0 10px 28px rgba(245,166,35,.35);transition:opacity .2s;font-family:inherit;"></button>
            </div>`;
        document.body.appendChild(ov);

        ov.addEventListener('click', e => { if (e.target === ov) closeAll(); });
        $('zsup-x').onclick = closeAll;
        $('zsup-tab-gifts').onclick = () => setTab('gifts');
        $('zsup-tab-shirts').onclick = () => setTab('shirts');
        $('zsup-num').oninput = () => {
            const v = $('zsup-num').value.replace(/\D/g, '').slice(0, 2);
            sup.customNum = (v && Number(v) > 0) ? String(Number(v)) : '1';
            drawGrid();
            update();
        };
        $('zsup-submit').onclick = submit;
        drawGrid();
    }

    function update() {
        if (!$('zsup-overlay')) return;
        const g = curGift();
        const a = g.price;
        const net = a - Math.floor(a * CONFIG.FEE_PERCENT / 100);
        const enough = sup.balance >= a;

        ['gifts', 'shirts'].forEach(t => {
            const b = $('zsup-tab-' + t);
            if (!b) return;
            const on = sup.tab === t;
            b.style.borderColor = on ? THEME.gold : 'rgba(255,255,255,.08)';
            b.style.color = on ? THEME.gold : THEME.text;
        });
        $('zsup-custom-row').style.display = (sup.tab === 'shirts' && g.id === 'custom') ? 'flex' : 'none';

        document.querySelectorAll('.zsup-gift').forEach(b => {
            const on = Number(b.dataset.i) === sup.gift;
            b.style.borderColor = on ? THEME.gold : 'rgba(255,255,255,.08)';
            b.style.background = on ? 'linear-gradient(135deg,rgba(255,217,120,.18),rgba(245,166,35,.10))' : THEME.card;
        });

        $('zsup-net').innerHTML = `${fmt(net)} ${coin('1em')}`;
        $('zsup-balance').innerHTML = L(`رصيدك الحالي: ${fmt(sup.balance)} ${coin('.95em')}`, `Your balance: ${fmt(sup.balance)} ${coin('.95em')}`);
        $('zsup-msg').textContent = enough ? (sup.combo > 1 ? '' : L('اضغط أكثر من مرة لتكرار الهدية', 'Tap again to send more')) : L('رصيدك لا يكفي لهذه الهدية', 'Your balance is not enough for this gift');
        $('zsup-msg').style.color = enough ? THEME.muted : '#ff6b6b';

        const btn = $('zsup-submit');
        btn.innerHTML = `${L('أرسل', 'Send')} ${esc(L(g.name.ar, g.name.en))}${g.id === 'custom' ? ' ' + esc(g.num) : ''}${sup.combo > 1 ? ' ×' + sup.combo : ''} · ${fmt(a)} ${coin('1em')}`;
        btn.disabled = !enough || sup.busy;
        btn.style.opacity = btn.disabled ? '0.45' : '1';
        btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
    }

    // حركة الهدية: تطير فوق الشاشة وتختفي
    function flyGift(g) {
        if (!$('zsup-anim')) {
            const st = document.createElement('style');
            st.id = 'zsup-anim';
            st.textContent = '@keyframes zsupFly{0%{transform:translate(-50%,0) scale(.5);opacity:0}15%{opacity:1}100%{transform:translate(-50%,-300px) scale(1.5);opacity:0}}';
            document.head.appendChild(st);
        }
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:${30 + Math.random() * 40}%;bottom:42%;z-index:6000;pointer-events:none;animation:zsupFly 1.4s ease-out forwards;text-align:center;`;
        el.innerHTML = giftIcon(g, 76)
            + (g.tag ? `<div style="margin-top:4px;font-weight:900;font-size:.85rem;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);">${esc(g.tag)}</div>` : '')
            + (sup.combo > 1 ? `<div style="margin-top:2px;font-weight:900;font-size:1.1rem;color:${THEME.gold};text-shadow:0 2px 8px rgba(0,0,0,.6);">×${sup.combo}</div>` : '');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
        try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    }

    // إشعار صاحب المنشور مرة واحدة بمجموع الكومبو (بدل إشعار لكل ضغطة)
    function flushNotify() {
        clearTimeout(sup.timer);
        sup.timer = null;
        if (sup.comboNet > 0 && typeof window.notifyUser === 'function') {
            window.notifyUser(sup.ownerId, 'support', { amount: sup.comboNet });
        }
        sup.comboNet = 0;
        sup.combo = 0;
    }

    async function submit() {
        if (sup.busy) return;
        const c = db();
        const u = me();
        if (!c || !u.id) { toast(L('سجّل الدخول أولاً.', 'Please sign in first.')); return; }
        const g = curGift();

        sup.busy = true;
        update();
        try {
            const { data: authData } = await c.auth.getUser();
            const fromId = String((authData && authData.user && authData.user.id) || u.id);
            const { data, error } = await c.rpc('support_post', {
                p_from_user_id: fromId,
                p_from_name: String(u.name || ''),
                p_post_id: Number(sup.postId),
                p_amount: g.price,
                p_gift_id: g.id
            });
            if (error) throw error;

            sup.combo++;
            sup.comboNet += (data && data.net != null) ? Number(data.net) : Math.floor(g.price * (100 - CONFIG.FEE_PERCENT) / 100);
            flyGift(g);
            clearTimeout(sup.timer);
            sup.timer = setTimeout(flushNotify, CONFIG.COMBO_RESET_MS);

            sup.balance = await fetchBalance();
            if (window.userState) window.userState.points = sup.balance;
            if (typeof window.updateTopPoints === 'function') window.updateTopPoints();
            fillBars([sup.postId]);
        } catch (e) {
            console.error('[ZELO] support_post:', e);
            toast(errText(e));
        } finally {
            sup.busy = false;
            update();
        }
    }

    // ===================== قائمة الداعمين =====================
    const RANK_COLORS = ['#ffd978', '#d9dee7', '#d9975b'];

    window.zeloOpenSupporters = async function (postId) {
        $('zsup-list-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'zsup-list-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = sheetBase(4600);
        ov.innerHTML = `
            <div style="${sheetPanel('78vh')}">
                ${grabber}
                ${headerRow(`<span>${L('الداعمون', 'Supporters')}</span>`, 'zsup-list-x')}
                <div id="zsup-list-body" style="color:${THEME.muted};text-align:center;padding:30px 0;font-size:.9rem;">${L('جارٍ التحميل...', 'Loading...')}</div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        $('zsup-list-x').onclick = () => ov.remove();

        const c = db();
        if (!c) return;
        const { data, error } = await c.rpc('support_supporters', { p_post_id: Number(postId), p_limit: CONFIG.SUPPORTERS_LIMIT });
        const body = $('zsup-list-body');
        if (!body) return;
        if (error) { body.textContent = L('تعذّر التحميل', 'Could not load'); return; }
        if (!data || !data.length) {
            body.innerHTML = `
                <div style="font-size:2.2rem;margin-bottom:8px;">💎</div>
                <div style="font-weight:800;color:${THEME.text};margin-bottom:4px;">${L('لا يوجد داعمون بعد', 'No supporters yet')}</div>
                <div style="font-size:.84rem;">${L('كن أول من يدعم هذا المنشور', 'Be the first to support this post')}</div>`;
            return;
        }

        body.style.cssText = 'padding:0;text-align:start;';
        body.innerHTML = data.map((s, i) => {
            const name = esc(s.from_name || L('مستخدم', 'User'));
            const initial = esc((s.from_name || '?').trim().charAt(0).toUpperCase());
            const rankColor = RANK_COLORS[i] || 'rgba(255,255,255,.12)';
            const rankText = i < 3 ? '#121215' : THEME.muted;
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid rgba(255,255,255,.05);">
                <div style="width:22px;height:22px;border-radius:50%;background:${rankColor};color:${rankText};font-size:.72rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-variant-numeric:tabular-nums;">${i + 1}</div>
                <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2a2a36,#1a1a22);border:1px solid ${THEME.border};display:flex;align-items:center;justify-content:center;font-weight:900;color:${THEME.gold};flex-shrink:0;">${initial}</div>
                <div style="min-width:0;flex:1;">
                    <div style="font-weight:800;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                    <div style="color:${THEME.muted};font-size:.76rem;margin-top:2px;">${L(`دعم ${fmt(s.times)} مرة`, `${fmt(s.times)} support(s)`)}</div>
                </div>
                <div style="display:inline-flex;align-items:center;gap:5px;color:${THEME.gold};font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums;">${fmt(s.total_amount)} ${coin('1em')}</div>
            </div>`;
        }).join('');
    };

    // ===================== شريط الدعم داخل كل بطاقة منشور =====================
    // العنصر المطلوب في الخلاصة: <div class="zsup" data-pid data-owner></div>
    function renderBar(el, stats, uid) {
        const pid = el.dataset.pid;
        const owner = el.dataset.owner;
        const isOwner = String(owner) === String(uid);
        const total = Number(stats?.total_net || 0);
        const count = Number(stats?.supporters || 0);
        const hasSupport = count > 0;

        const summary = hasSupport
            ? `<span style="display:inline-flex;align-items:center;gap:6px;">
                    ${coin('1.05em')}
                    <span dir="ltr" style="font-weight:900;color:${THEME.gold};font-variant-numeric:tabular-nums;">${fmt(total)} ZELO</span>
               </span>
               <span style="color:${THEME.muted};font-size:.78rem;">·</span>
               <span style="color:${THEME.muted};font-size:.8rem;font-weight:700;">${fmt(count)} ${L(count === 1 ? 'داعم' : 'داعمين', count === 1 ? 'supporter' : 'supporters')}</span>`
            : `<span style="color:${THEME.muted};font-size:.82rem;font-weight:700;">${L(isOwner ? 'لا يوجد دعم بعد' : 'كن أول من يدعم', isOwner ? 'No support yet' : 'Be the first to support')}</span>`;

        const supportBtn = isOwner ? '' : `
            <button type="button" class="zsup-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:999px;background:linear-gradient(135deg,#ffd978 0%,${THEME.goldDeep} 100%);color:#121215;font-weight:900;font-size:.82rem;cursor:pointer;box-shadow:0 6px 16px rgba(245,166,35,.3);white-space:nowrap;">
                ${coin('1em')} ${L('ادعم', 'Support')}
            </button>`;

        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:10px 14px;border-radius:16px;background:linear-gradient(135deg,rgba(245,195,90,.08),rgba(255,255,255,.02));border:1px solid ${THEME.border};">
                <button type="button" class="zsup-total" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:none;border:none;padding:0;cursor:pointer;color:inherit;text-align:start;min-width:0;">
                    ${summary}
                    ${hasSupport ? `<span style="color:${THEME.muted};font-size:.78rem;margin-inline-start:2px;">›</span>` : ''}
                </button>
                ${supportBtn}
            </div>`;

        const totalEl = el.querySelector('.zsup-total');
        if (hasSupport) totalEl.onclick = e => { e.stopPropagation(); window.zeloOpenSupporters(pid); };
        else totalEl.onclick = e => e.stopPropagation();

        const btn = el.querySelector('.zsup-btn');
        if (btn) btn.onclick = e => { e.stopPropagation(); window.zeloOpenSupport(pid, owner); };
    }

    async function fillBars(postIds) {
        const c = db();
        const uid = US().userId;
        const ids = (postIds || []).map(Number).filter(Boolean);
        if (!c || !ids.length) return;

        const { data, error } = await c.rpc('support_stats', { p_post_ids: ids });
        if (error) { console.error('[ZELO] support_stats:', error); return; }

        const byPost = new Map((data || []).map(r => [String(r.post_id), r]));
        document.querySelectorAll('.zsup[data-pid]').forEach(el => {
            if (!ids.map(String).includes(el.dataset.pid)) return;
            renderBar(el, byPost.get(el.dataset.pid), uid);
        });
    }

    // ===================== نقطة الدخول =====================
    window.zeloOpenSupport = async function (postId, ownerId) {
        const uid = US().userId ? String(US().userId) : String(me().id || '');
        if (!uid) { toast(L('سجّل الدخول أولاً.', 'Please sign in first.')); return; }
        if (String(ownerId) === uid) { toast(L('لا يمكنك دعم منشورك', 'You cannot support your own post')); return; }

        sup.postId = postId;
        sup.ownerId = ownerId;
        sup.tab = 'gifts';
        sup.gift = 0;
        sup.busy = false;
        sup.balance = 0;
        sup.combo = 0;
        sup.comboNet = 0;

        buildSheet();
        update();
        sup.balance = await fetchBalance();
        update();
    };

    // يستدعيها ملف الخلاصة بعد رسم المنشورات
    window.zeloFillSupportBars = fillBars;
})();
