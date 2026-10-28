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
        SUPPORTERS_LIMIT: 50                        // عدد الداعمين المعروضين في القائمة
    };

    // ===================== أدوات مساعدة =====================
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : (window.userState || {});
    const isAr = () => (US().lang || 'ar').startsWith('ar');
    const L = (ar, en) => (isAr() ? ar : en);
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // المستخدم الحالي: يُفضّل استخدام دالة التطبيق لأنها تعرف الاسم
    const me = () => (typeof window.zeloMe === 'function')
        ? window.zeloMe()
        : { id: String(US().userId || ''), name: '' };

    function toast(msg) {
        let el = $('zsup-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zsup-toast';
            el.style.cssText = 'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(28,28,34,.97);color:#fff;padding:10px 18px;border-radius:12px;border:1px solid rgba(245,195,90,.3);font-size:.85rem;z-index:5200;transition:opacity .25s;pointer-events:none;max-width:85%;text-align:center;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
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

    // نافذة الدعم
    const sup = { postId: null, ownerId: null, amount: CONFIG.QUICK_AMOUNTS[0], balance: 0, busy: false };

    function buildSheet() {
        $('zsup-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'zsup-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:4500;';
        const chips = CONFIG.QUICK_AMOUNTS.map(a =>
            `<button type="button" class="zsup-chip" data-amt="${a}" style="flex:1;min-width:0;padding:10px 4px;border-radius:12px;border:1px solid rgba(245,195,90,.3);background:#1a1a20;color:#f8fafc;font-weight:800;font-size:.85rem;cursor:pointer;">${fmt(a)}</button>`
        ).join('');
        ov.innerHTML = `
            <div style="background:#121215;border:1px solid rgba(245,195,90,.25);border-radius:24px 24px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;max-height:92vh;overflow-y:auto;color:#f8fafc;box-sizing:border-box;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="zsup-x" type="button" style="background:none;border:none;color:#f8fafc;font-size:1.3rem;cursor:pointer;">✕</button>
                    <h3 style="margin:0;font-size:1.05rem;font-weight:900;">💎 ${L('ادعم هذا المنشور', 'Support this post')}</h3>
                    <span style="width:28px;"></span>
                </div>

                <p style="color:#94a3b8;font-size:.85rem;margin:0 0 14px;line-height:1.6;">
                    ${L(`يصل ${100 - CONFIG.FEE_PERCENT}% من المبلغ لصاحب المنشور، و${CONFIG.FEE_PERCENT}% عمولة للمنصة.`,
                        `${100 - CONFIG.FEE_PERCENT}% goes to the author, ${CONFIG.FEE_PERCENT}% is the platform fee.`)}
                </p>

                <div style="display:flex;gap:6px;margin-bottom:12px;">${chips}</div>

                <label style="display:block;color:#94a3b8;font-size:.85rem;margin-bottom:6px;">${L('مبلغ مخصص', 'Custom amount')}</label>
                <input id="zsup-custom" type="number" min="${CONFIG.MIN_AMOUNT}" step="1" inputmode="numeric"
                       style="width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#1a1a20;color:#f8fafc;font-size:1rem;font-weight:800;">

                <div style="margin-top:16px;background:#1a1a20;border-radius:14px;padding:12px 14px;font-size:.88rem;line-height:2;">
                    <div style="display:flex;justify-content:space-between;"><span id="zsup-amt"></span><span style="color:#94a3b8;">${L('المبلغ', 'Amount')}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span id="zsup-fee"></span><span style="color:#94a3b8;">${L('العمولة', 'Fee')}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span id="zsup-net"></span><span style="color:#94a3b8;">${L('يصل للكاتب', 'Author receives')}</span></div>
                </div>

                <div id="zsup-balance" style="margin-top:12px;font-size:.85rem;color:#94a3b8;"></div>
                <p id="zsup-msg" style="color:#ff6b6b;font-size:.82rem;margin:10px 0 0;min-height:18px;"></p>

                <button id="zsup-submit" type="button" class="btn-action" style="margin-top:12px;"></button>
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

        document.querySelectorAll('.zsup-chip').forEach(b => {
            const on = Number(b.dataset.amt) === a;
            b.style.background = on ? 'rgba(245,195,90,.18)' : '#1a1a20';
            b.style.borderColor = on ? '#f5c35a' : 'rgba(245,195,90,.3)';
        });

        $('zsup-amt').textContent = valid ? fmt(a) + ' ZELO' : '—';
        $('zsup-fee').textContent = valid ? fmt(fee) + ' ZELO' : '—';
        $('zsup-net').textContent = valid ? fmt(net) + ' ZELO' : '—';
        $('zsup-balance').textContent = L(`رصيدك: ${fmt(sup.balance)} ZELO`, `Your balance: ${fmt(sup.balance)} ZELO`);
        $('zsup-msg').textContent = !valid
            ? L(`أدخل مبلغاً لا يقل عن ${CONFIG.MIN_AMOUNT}.`, `Enter at least ${CONFIG.MIN_AMOUNT}.`)
            : (!enough ? L('رصيدك لا يكفي لهذا المبلغ.', 'Your balance is not enough for this amount.') : '');

        const btn = $('zsup-submit');
        btn.textContent = valid ? L(`💎 ادعم بـ ${fmt(a)} ZELO`, `💎 Support with ${fmt(a)} ZELO`) : L('ادعم', 'Support');
        btn.disabled = !enough || sup.busy;
        btn.style.opacity = btn.disabled ? '0.5' : '1';
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
            toast(L('تم الدعم 💎', 'Supported 💎'));

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

    // قائمة الداعمين
    window.zeloOpenSupporters = async function (postId) {
        $('zsup-list-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'zsup-list-overlay';
        ov.dir = isAr() ? 'rtl' : 'ltr';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:4600;';
        ov.innerHTML = `
            <div style="background:#121215;border:1px solid rgba(245,195,90,.25);border-radius:24px 24px 0 0;padding:18px;width:100%;max-width:520px;max-height:80vh;overflow-y:auto;color:#f8fafc;box-sizing:border-box;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="zsup-list-x" type="button" style="background:none;border:none;color:#f8fafc;font-size:1.3rem;cursor:pointer;">✕</button>
                    <h3 style="margin:0;font-size:1.05rem;font-weight:900;">${L('الداعمون', 'Supporters')}</h3>
                    <span style="width:28px;"></span>
                </div>
                <div id="zsup-list-body" style="color:#94a3b8;text-align:center;padding:20px 0;">${L('جارٍ التحميل...', 'Loading...')}</div>
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
        if (!data || !data.length) { body.textContent = L('لا يوجد داعمون بعد', 'No supporters yet'); return; }

        body.style.cssText = 'padding:0;text-align:start;';
        body.innerHTML = data.map((s, i) => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 4px;border-bottom:1px solid rgba(255,255,255,.06);">
                <div style="min-width:0;">
                    <div style="font-weight:800;font-size:.95rem;">${i + 1}. ${esc(s.from_name || L('مستخدم', 'User'))}</div>
                    <div style="color:#94a3b8;font-size:.78rem;">${L(`دعم ${fmt(s.times)} مرة`, `${fmt(s.times)} support(s)`)}</div>
                </div>
                <div style="color:#f5c35a;font-weight:900;white-space:nowrap;">💎 ${fmt(s.total_amount)}</div>
            </div>`).join('');
    };

    // شريط الدعم داخل كل بطاقة منشور: <div class="zsup" data-pid data-owner></div>
    function renderBar(el, stats, uid) {
        const pid = el.dataset.pid;
        const owner = el.dataset.owner;
        const isOwner = String(owner) === String(uid);
        const total = Number(stats?.total_net || 0);
        const count = Number(stats?.supporters || 0);

        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px 12px;border-radius:12px;background:rgba(245,195,90,.07);border:1px solid rgba(245,195,90,.15);font-size:.82rem;font-weight:800;color:#f5c35a;">
                <span class="zsup-total" style="cursor:pointer;">💎 ${fmt(total)} ZELO · ${fmt(count)} ${L('داعم', 'supporters')}</span>
                ${isOwner ? '' : `<button type="button" class="zsup-btn" style="background:#f5c35a;color:#121215;border:none;border-radius:10px;padding:6px 14px;font-weight:900;cursor:pointer;">${L('ادعم', 'Support')}</button>`}
            </div>`;

        const totalEl = el.querySelector('.zsup-total');
        totalEl.onclick = e => { e.stopPropagation(); window.zeloOpenSupporters(pid); };

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

    // فتح نافذة الدعم لمنشور
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
