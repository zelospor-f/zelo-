// boost.js — منطق تعزيز المنشور (ملف منفصل)
(function () {
    'use strict';

    // ===================== الإعدادات (عدّل القيم هنا فقط) =====================
    // يجب أن تطابق القيم نفسها في دالة create_boost و record_boost_impression في SQL
    const CONFIG = {
        MIN_DAILY_POINTS: 1000,
        MAX_DAILY_POINTS: 500000,
        STEP_POINTS: 1000,
        MIN_DAYS: 1,
        MAX_DAYS: 30,
        MAX_TOTAL_POINTS: 15000000,         // 500,000 × 30
        POINTS_PER_1000_IMPRESSIONS: 100,   // سعر الألف ظهور بالنقاط
        MAX_VIEWS_PER_USER_PER_DAY: 3       // سقف ظهور المنشور لكل شخص يومياً
    };

    const IMPRESSIONS_PER_POINT = 1000 / CONFIG.POINTS_PER_1000_IMPRESSIONS; // 10

    const US = () => (typeof userState !== 'undefined' && userState) ? userState : (window.userState || {});
    const isAr = () => (US().lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
    const $ = id => document.getElementById(id);

    const state = {
        postId: null,
        daily: CONFIG.MIN_DAILY_POINTS,
        days: CONFIG.MIN_DAYS,
        balance: 0,
        audience: null,   // null = لم يُحسب بعد
        busy: false
    };

    const sliderToDaily = v => Number(v) * CONFIG.STEP_POINTS;
    const dailyToSlider = d => Math.round(d / CONFIG.STEP_POINTS);

    // الوصول اليومي التقديري = min(ظهورات الميزانية، الجمهور × سقف الظهور لكل شخص)
    function reachPerDay(daily) {
        if (state.audience === null) return null;
        const budgetImpressions = daily * IMPRESSIONS_PER_POINT;
        const cap = state.audience * CONFIG.MAX_VIEWS_PER_USER_PER_DAY;
        return Math.min(budgetImpressions, cap);
    }

    function toast(msg) {
        let el = $('zboost-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zboost-toast';
            el.style.cssText = 'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(28,28,34,.97);color:#fff;padding:10px 18px;border-radius:12px;border:1px solid rgba(245,195,90,.3);font-size:.85rem;z-index:5000;transition:opacity .25s;pointer-events:none;max-width:85%;text-align:center;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    function errText(e) {
        const m = String(e?.message || '');
        if (m.includes('premium_required')) return L('التعزيز للمشتركين فقط', 'Boosting is for subscribers only');
        if (m.includes('insufficient_balance')) return L('رصيدك لا يكفي', 'Your balance is not enough');
        if (m.includes('already_active')) return L('هذا المنشور معزّز حالياً', 'This post is already boosted');
        if (m.includes('not_owner')) return L('لا يمكنك تعزيز منشور ليس لك', 'You can only boost your own posts');
        return L('تعذّر التعزيز، حاول لاحقاً', 'Could not boost, try again later');
    }

    async function fetchBalance() {
        const c = db();
        const uid = US().userId;
        if (!c || !uid) return 0;
        const { data } = await c.from('users').select('points').eq('user_id', String(uid)).maybeSingle();
        return Number(data?.points) || 0;
    }

    async function fetchAudience() {
        const c = db();
        if (!c) return null;
        const { data, error } = await c.rpc('boost_audience_size');
        if (error) { console.error('[ZELO] boost_audience_size:', error); return null; }
        return Number(data) || 0;
    }

    function close() {
        $('zboost-overlay')?.remove();
    }

    function build() {
        close();
        const maxSlider = CONFIG.MAX_DAILY_POINTS / CONFIG.STEP_POINTS;
        const ov = document.createElement('div');
        ov.id = 'zboost-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:4500;';
        ov.innerHTML = `
            <div style="background:#121215;border:1px solid rgba(245,195,90,.25);border-radius:24px 24px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;max-height:92vh;overflow-y:auto;color:#f8fafc;box-sizing:border-box;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="zboost-x" type="button" style="background:none;border:none;color:#f8fafc;font-size:1.3rem;cursor:pointer;">✕</button>
                    <h3 style="margin:0;font-size:1.05rem;font-weight:900;">${L('تعزيز المنشور', 'Boost post')}</h3>
                    <span style="width:28px;"></span>
                </div>

                <p style="color:#94a3b8;font-size:.85rem;margin:0 0 18px;line-height:1.6;">
                    ${L('اختر الميزانية اليومية والمدة. تُخصم النقاط حسب الظهور الفعلي فقط.', 'Choose a daily budget and duration. Points are deducted only for actual views.')}
                </p>

                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                    <span id="zboost-daily-val" style="font-weight:900;"></span>
                    <span style="color:#94a3b8;font-size:.85rem;">${L('الميزانية اليومية', 'Daily budget')}</span>
                </div>
                <input id="zboost-daily" type="range" min="1" max="${maxSlider}" step="1" value="${dailyToSlider(state.daily)}" style="width:100%;accent-color:#f5c35a;">

                <div style="display:flex;justify-content:space-between;align-items:baseline;margin:18px 0 6px;">
                    <span id="zboost-days-val" style="font-weight:900;"></span>
                    <span style="color:#94a3b8;font-size:.85rem;">${L('المدة', 'Duration')}</span>
                </div>
                <input id="zboost-days" type="range" min="${CONFIG.MIN_DAYS}" max="${CONFIG.MAX_DAYS}" step="1" value="${state.days}" style="width:100%;accent-color:#f5c35a;">

                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;gap:8px;">
                    <span id="zboost-total" style="font-weight:900;"></span>
                    <span style="color:#94a3b8;font-size:.85rem;">${L('الإجمالي', 'Total')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;">
                    <span id="zboost-reach" style="font-weight:700;font-size:.9rem;"></span>
                    <span style="color:#94a3b8;font-size:.85rem;">${L('الوصول اليومي المتوقع', 'Expected daily reach')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;">
                    <span id="zboost-balance" style="font-size:.85rem;"></span>
                </div>

                <p id="zboost-msg" style="color:#ff6b6b;font-size:.82rem;margin:12px 0 0;min-height:18px;"></p>

                <button id="zboost-submit" type="button" class="btn-action" style="margin-top:14px;">
                    ${L('تعزيز المنشور', 'Boost post')}
                </button>
            </div>`;
        document.body.appendChild(ov);

        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        $('zboost-x').onclick = close;
        $('zboost-daily').oninput = update;
        $('zboost-days').oninput = update;
        $('zboost-submit').onclick = submit;
    }

    function update() {
        if (!$('zboost-overlay')) return;

        state.daily = sliderToDaily($('zboost-daily').value);
        state.days = Number($('zboost-days').value);

        const total = state.daily * state.days;
        const reach = reachPerDay(state.daily);
        const enough = state.balance >= state.daily;

        $('zboost-daily-val').textContent = fmt(state.daily) + ' ZELO';
        $('zboost-days-val').textContent = L(`${state.days} يوماً`, `${state.days} day(s)`);
        $('zboost-total').textContent = fmt(total) + ' ZELO';
        $('zboost-reach').textContent = reach === null
            ? '—'
            : L(`حتى ${fmt(reach)} ظهور يومياً (تقديري)`, `Up to ${fmt(reach)} views per day (estimate)`);
        $('zboost-balance').textContent = L(`رصيدك: ${fmt(state.balance)} ZELO`, `Your balance: ${fmt(state.balance)} ZELO`);
        $('zboost-msg').textContent = enough
            ? ''
            : L('رصيدك لا يكفي لميزانية يوم واحد. اربح نقاطاً أولاً.', 'Your balance is not enough for one day. Earn points first.');

        const btn = $('zboost-submit');
        btn.disabled = !enough || state.busy;
        btn.style.opacity = btn.disabled ? '0.5' : '1';
    }

    async function submit() {
        if (state.busy) return;
        const c = db();
        const uid = US().userId;
        if (!c || !uid) { toast(L('سجّل الدخول أولاً.', 'Please sign in first.')); return; }

        state.busy = true;
        update();
        try {
            const { error } = await c.rpc('create_boost', {
                p_user_id: String(uid),
                p_post_id: Number(state.postId),
                p_daily_points: state.daily,
                p_days: state.days
            });
            if (error) throw error;

            close();
            toast(L('تم تعزيز المنشور ✅', 'Post boosted ✅'));

            const b = await fetchBalance();
            if (window.userState) window.userState.points = b;
            if (typeof window.updateTopPoints === 'function') window.updateTopPoints();
        } catch (e) {
            console.error('[ZELO] create_boost:', e);
            toast(errText(e));
        } finally {
            state.busy = false;
            update();
        }
    }

    // نقطة الدخول: يستدعيها زر "تعزيز المنشور" في ملف الخلاصة
    window.zeloOpenBoost = async function (postId) {
        const uid = US().userId;
        if (!uid) { toast(L('سجّل الدخول أولاً.', 'Please sign in first.')); return; }

        // التحقق من الاشتراك من الخادم مباشرة (وليس من الذاكرة المؤقتة)
        const isPro = window.ZeloPremium && await window.ZeloPremium.isPremium();
        if (!isPro) {
            if (typeof window.openSubscriptions === 'function') window.openSubscriptions();
            else toast(L('التعزيز متاح للمشتركين فقط', 'Boosting is for subscribers only'));
            return;
        }

        state.postId = postId;
        state.daily = CONFIG.MIN_DAILY_POINTS;
        state.days = CONFIG.MIN_DAYS;
        state.busy = false;
        state.audience = null;

        build();
        update();

        const [balance, audience] = await Promise.all([fetchBalance(), fetchAudience()]);
        state.balance = balance;
        state.audience = audience;
        update();
    };
})();
