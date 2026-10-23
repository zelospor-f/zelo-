/* ============================================================
 * premium.js — حالة الاشتراك + بطاقة "وثّق حسابك"
 * يعتمد على دالتين في Supabase (premium.sql): is_premium و premium_among
 * ============================================================ */
(function () {
    'use strict';
    const TTL = 5 * 60 * 1000;                       // نحفظ النتيجة 5 دقائق
    const known = new Map();                         // user_id -> { pro, t }
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const me = () => String((window.userState && window.userState.userId) || '');
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');

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

    // بطاقة "وثّق حسابك بشعار ناديك المفضل" في أعلى منشورات ملفك الشخصي (لغير المشتركين فقط)
    async function mountPromo() {
        const box = document.getElementById('verify-promo');
        if (!box) return;
        const pro = await isPremium();
        if (pro) { box.innerHTML = ''; return; }
        const ar = isAr();
        box.innerHTML = `
            <div style="margin:12px 0; padding:14px; border-radius:16px; direction:${ar ? 'rtl' : 'ltr'};
                        background:rgba(28,28,34,0.85); border:1px solid rgba(252,176,69,0.35);">
                <div style="font-size:1.05rem; font-weight:900; color:#fff; margin-bottom:6px;">
                    ${ar ? 'وثّق حسابك بشعار ناديك المفضل' : 'Verify your account with your favorite club badge'}
                </div>
                <div style="font-size:0.82rem; color:#9a9fb5; line-height:1.6; margin-bottom:12px;">
                    ${ar ? 'اشترك لتظهر بجانب اسمك شارة ناديك، مع منشورات أطول ورسائل صوتية في الغرف.'
                         : 'Subscribe to show your club badge next to your name, with longer posts and voice messages in rooms.'}
                </div>
                <button onclick="window.openSubscriptions && window.openSubscriptions()"
                        style="width:100%; padding:12px; border-radius:12px; font-weight:900; font-size:0.95rem; cursor:pointer;
                               color:#000; background:linear-gradient(90deg,#fcb045,#fd1d1d);">
                    ${ar ? 'عرض الاشتراكات' : 'View subscriptions'}
                </button>
            </div>`;
    }

    window.ZeloPremium = {
        ensure,
        isPremium,
        mountPromo,
        has: uid => !!(known.get(String(uid)) || {}).pro,
        refresh: () => isPremium(true)
        // subscribe(planId) سيُضاف عند ربط Google Play Billing
    };
})();
