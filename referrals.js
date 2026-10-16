/* ============================================================
 * referrals.js — نظام الإحالات + مجمع النقاط (ملف واحد)
 * يُحمَّل بعد auth.js وقبل tasks.js و wallet-solana.js
 * كل الحساب والتحقق يتم داخل Supabase (referrals.sql)
 * ============================================================ */
(function () {
    const REF_KEY = 'zelo_ref_code';
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    const uid = () => (typeof userState !== 'undefined' && userState.userId) ? String(userState.userId) : '';
    const isAr = () => (typeof userState !== 'undefined' && userState.lang === 'ar');

    /* ---------- 1) التقاط كود الإحالة من الرابط أو تليجرام ---------- */
    (function captureReferralCode() {
        try {
            const q = new URLSearchParams(location.search);
            let code = q.get('ref') || q.get('startapp') || q.get('tgWebAppStartParam') || '';
            if (!code && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
                code = window.Telegram.WebApp.initDataUnsafe.start_param || '';
            }
            code = String(code).replace(/^ref_/i, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
            if (code && !localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, code);
        } catch (e) {}
    })();

    /* ---------- 2) رابط الدعوة (كود الإحالة = اسم المستخدم) ---------- */
    window.zeloReferralLink = function () {
        const u = (typeof userState !== 'undefined' && userState.username) ? userState.username : '';
        return u ? (location.origin + location.pathname + '?ref=' + encodeURIComponent(u)) : '';
    };

    window.copyReferralLink = async function () {
        const link = window.zeloReferralLink();
        if (!link) { alert(isAr() ? 'أكمل إنشاء حسابك أولاً' : 'Finish creating your account first'); return; }
        try { await navigator.clipboard.writeText(link); }
        catch (e) { prompt(isAr() ? 'انسخ الرابط:' : 'Copy link:', link); return; }
        alert(isAr() ? 'تم نسخ رابط الدعوة ✅' : 'Invite link copied ✅');
    };

    /* ---------- 3) تسجيل الإحالة عند إنشاء حساب المدعو (يُستدعى من auth.js) ---------- */
    window.zeloRegisterReferral = async function () {
        try {
            const code = localStorage.getItem(REF_KEY), c = db();
            if (!code || !c) return null;
            const { data, error } = await c.rpc('register_referral', { p_code: code });
            if (!error) localStorage.removeItem(REF_KEY);
            return data;
        } catch (e) { console.error('register referral error', e); return null; }
    };

    /* ---------- 4) صرف المكافأة بعد أول كسب للمدعو (يُستدعى من tasks.js و ranking.js) ---------- */
    let _busy = false;
    window.zeloClaimReferralReward = async function () {
        const c = db();
        if (_busy || !c) return null;
        _busy = true;
        try {
            const { data, error } = await c.rpc('process_referral_reward');
            if (error) { console.error('referral reward error', error); return null; }
            return data;
        } catch (e) { return null; }
        finally { _busy = false; }
    };

    /* ---------- 5) مجمع النقاط: مزامنة الرصيد من القاعدة ---------- */
    // يعيد { points, changed } ويحدّث userState والشريط العلوي
    window.zeloSyncPointsPool = async function () {
        const c = db(), id = uid();
        if (!c || !id) return null;
        try {
            const r = await c.from('users').select('points').eq('user_id', id).maybeSingle();
            if (r.error || !r.data) return null;
            const points = parseInt(r.data.points) || 0;
            const changed = points !== (Number(userState.points) || 0);
            userState.points = points;
            try { localStorage.setItem('user_coins', points); } catch (e) {}
            if (changed && typeof updateTopBar === 'function') updateTopBar();
            return { points, changed };
        } catch (e) { return null; }
    };

    /* ---------- 6) ملخص أرباح الإحالات (للمحفظة والملف الشخصي) ---------- */
    window.zeloReferralSummary = async function () {
        const c = db(), id = uid();
        if (!c || !id) return null;
        try {
            const r = await c.from('referrals').select('status,reward_fixed,reward_pct').eq('referrer_id', id);
            if (r.error) return null;
            const rows = r.data || [];
            const done = rows.filter(x => x.status === 'rewarded');
            return {
                total: rows.length,
                done: done.length,
                pending: rows.length - done.length,
                earned: done.reduce((a, x) => a + (Number(x.reward_fixed) || 0) + (Number(x.reward_pct) || 0), 0)
            };
        } catch (e) { return null; }
    };
})();
