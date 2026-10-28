// support.js — دعم المنشورات بالنقاط (ملف منفصل ومستقل)
(function () {
    'use strict';

    // ===================== الإعدادات (عدّل القيم هنا فقط) =====================
    // يجب أن تطابق القيم نفسها في دالة support_post في support_schema.sql
    const CONFIG = {
        MIN_AMOUNT: 1,                              // الحد الأدنى للدعم بالنقاط
        DAILY_LIMIT: 5000,                          // الحد اليومي لكل مستخدم
        FEE_PERCENT: 10,                            // عمولة المنصة %
        QUICK_AMOUNTS: [10, 50, 100, 500, 1000],    // المبالغ الجاهزة
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
        if (m.includes('insufficient_balance')) return L('رصيدك لا يكفي', 'Your balance is not enough');
        if (m.includes('daily_limit')) return L('وصلت إلى حد الدعم اليومي', 'You reached your daily support limit');
        if (m.includes('own_post')) return L('لا يمكنك دعم منشورك', 'You cannot support your own post');
        if (m.includes('post_not_found')) return L('المنشور غير موجود', 'Post not found');
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

    // ===================== نافذة الدعم =====================
    const sup = { postId: null, ownerId: null, amount: CONFIG.QUICK_AMOUNTS[0], balance: 0, busy: false };

    function buildSheet() {
        $('zsup-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'zsup-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = sheetBase(4500);

        const chips = CONFIG.QUICK_AMOUNTS.map(a =>
            `<button type="button" class="zsup-chip" data-amt="${a}" style="padding:12px 0;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:${THEME.card};color:${THEME.text};font-weight:800;font-size:.92rem;cursor:pointer;transition:all .15s;font-variant-numeric:tabular-nums;">${fmt(a)}</button>`
        ).join('');

        ov.innerHTML = `
            <div style="${sheetPanel()}">
                ${grabber}
                ${headerRow(`${coin('1.2em')}<span>${L('ادعم هذا المنشور', 'Support this post')}</span>`, 'zsup-x')}

                <p style="color:${THEME.muted};font-size:.84rem;margin:0 0 16px;line-height:1.7;text-align:center;">
                    ${L(`يصل ${100 - CONFIG.FEE_PERCENT}% من المبلغ لصاحب المنشور`, `${100 - CONFIG.FEE_PERCENT}% of the amount goes to the author`)}
                </p>

                <div style="display:grid;grid-template-columns:repeat(${CONFIG.QUICK_AMOUNTS.length},1fr);gap:8px;margin-bottom:12px;">${chips}</div>

                <div style="margin-bottom:18px;">
                    <input id="zsup-custom" type="number" min="${CONFIG.MIN_AMOUNT}" step="1" inputmode="numeric" placeholder="${L('مبلغ مخصص', 'Custom amount')}"
                           style="width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:${THEME.card};color:${THEME.text};font-size:1rem;font-weight:800;outline:none;font-variant-numeric:tabular-nums;">
                </div>

                <div style="background:${THEME.card};border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:6px 16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05);">
                        <span style="color:${THEME.muted};font-size:.86rem;">${L('المبلغ', 'Amount')}</span>
                        <span id="zsup-amt" style="font-weight:800;font-variant-numeric:tabular-nums;"></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05);">
                        <span style="color:${THEME.muted};font-size:.86rem;">${L(`عمولة المنصة ${CONFIG.FEE_PERCENT}%`, `Platform fee ${CONFIG.FEE_PERCENT}%`)}</span>
                        <span id="zsup-fee" style="font-weight:700;color:${THEME.muted};font-variant-numeric:tabular-nums;"></span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
                        <span style="color:${THEME.text};font-size:.9rem;font-weight:800;">${L('يصل للكاتب', 'Author receives')}</span>
                        <span id="zsup-net" style="font-weight:900;color:${THEME.gold};font-size:1rem;font-variant-numeric:tabular-nums;"></span>
                    </div>
                </div>

                <div id="zsup-balance" style="margin-top:14px;font-size:.84rem;color:${THEME.muted};text-align:center;"></div>
                <p id="zsup-msg" style="color:#ff6b6b;font-size:.82rem;margin:8px 0 0;min-height:18px;text-align:center;"></p>

                <button id="zsup-submit" type="button" style="margin-top:10px;width:100%;padding:16px;border:none;border-radius:16px;background:linear-gradient(135deg,#ffd978 0%,${THEME.goldDeep} 100%);color:#121215;font-size:1rem;font-weight:900;cursor:pointer;box-shadow:0 10px 28px rgba(245,166,35,.35);transition:opacity .2s;"></button>
            </div>`;
        document.body.appendChild(ov);

        ov.addEventListener('click', e => { if (e.target === ov) closeAll(); });
        $('zsup-x').onclick = closeAll;
        ov.querySelectorAll('.zsup-chip').forEach(b => {
            b.onclick = () => { sup.amount = Number(b.dataset.amt); $('zsup-custom').value = ''; update(); };
        });
        $('zsup-custom').oninput = () => {
            const v = Math.floor(Number($('zsup-custom').value));
            sup.amount = v >= CONFIG.MIN_AMOUNT ? v : 0;
            update();
        };
        $('zsup-submit').onclick = submit;
    }

    function update() {
        if (!$('zsup-overlay')) return;
        const a = sup.amount;
        const valid = a >= CONFIG.MIN_AMOUNT;
        const fee = valid ? Math.floor(a * CONFIG.FEE_PERCENT / 100) : 0;
        const net = valid ? a - fee : 0;
        const enough = valid && sup.balance >= a;
        const customActive = !!$('zsup-custom').value;

        document.querySelectorAll('.zsup-chip').forEach(b => {
            const on = Number(b.dataset.amt) === a && !customActive;
            b.style.background = on ? 'linear-gradient(135deg,rgba(255,217,120,.22),rgba(245,166,35,.14))' : THEME.card;
            b.style.borderColor = on ? THEME.gold : 'rgba(255,255,255,.08)';
            b.style.color = on ? THEME.gold : THEME.text;
        });

        $('zsup-amt').innerHTML = valid ? `${fmt(a)} ${coin('1em')}` : '—';
        $('zsup-fee').innerHTML = valid ? `${fmt(fee)} ${coin('.9em')}` : '—';
        $('zsup-net').innerHTML = valid ? `${fmt(net)} ${coin('1em')}` : '—';
        $('zsup-balance').innerHTML = L(`رصيدك الحالي: ${fmt(sup.balance)} ${coin('.95em')}`, `Your balance: ${fmt(sup.balance)} ${coin('.95em')}`);
        $('zsup-msg').textContent = !valid
            ? L(`أدخل مبلغاً لا يقل عن ${CONFIG.MIN_AMOUNT}`, `Enter at least ${CONFIG.MIN_AMOUNT}`)
            : (!enough ? L('رصيدك لا يكفي لهذا المبلغ', 'Your balance is not enough for this amount') : '');

        const btn = $('zsup-submit');
        btn.innerHTML = valid
            ? `${L('ادعم بـ', 'Support with')} ${fmt(a)} ${coin('1em')}`
            : L('ادعم', 'Support');
        btn.disabled = !enough || sup.busy;
        btn.style.opacity = btn.disabled ? '0.45' : '1';
        btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
    }

    async function submit() {
        if (sup.busy) return;
        const c = db();
        const u = me();
        if (!c || !u.id) { toast(L('سجّل الدخول أولاً.', 'Please sign in first.')); return; }

        sup.busy = true;
        update();
        try {
            const { data, error } = await c.rpc('support_post', {
                p_from_user_id: String(u.id),
                p_from_name: String(u.name || ''),
                p_post_id: Number(sup.postId),
                p_amount: sup.amount
            });
            if (error) throw error;

            closeAll();
            toast(L('تم الدعم بنجاح ✅', 'Support sent successfully ✅'));

            // إشعار صاحب المنشور بصافي ما وصله
            const net = data?.net ?? Math.floor(sup.amount * (100 - CONFIG.FEE_PERCENT) / 100);
            if (typeof window.notifyUser === 'function') window.notifyUser(sup.ownerId, 'support', { amount: net });

            // تحديث الرصيد في الشريط العلوي
            const b = await fetchBalance();
            if (window.userState) window.userState.points = b;
            if (typeof window.updateTopPoints === 'function') window.updateTopPoints();

            // تحديث شريط الدعم لهذا المنشور فقط
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
        sup.amount = CONFIG.QUICK_AMOUNTS[0];
        sup.busy = false;
        sup.balance = 0;

        buildSheet();
        update();
        sup.balance = await fetchBalance();
        update();
    };

    // يستدعيها ملف الخلاصة بعد رسم المنشورات
    window.zeloFillSupportBars = fillBars;
})();
