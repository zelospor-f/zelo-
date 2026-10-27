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
    const _tr = (k, a, e, p) => window.tr ? window.tr(k, a, e, p) : (isAr() ? a : e);

    /* ---------- إعدادات النشر: عند النشر على Google Play غيّر published إلى true ---------- */
    const PLAY = {
        packageName: 'com.zelosport.app',
        published: false,
        githubUrl: 'https://github.com/zelospor-f/zelo-/releases/latest'
    };
    const ASKED_KEY = 'zelo_ref_asked';
    const cleanCode = c => String(c || '').replace(/^ref_/i, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    function saveCode(c) {
        c = cleanCode(c);
        if (!c) return false;
        try { if (!localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, c); } catch (e) { return false; }
        return true;
    }

    /* ---------- 1) التقاط كود الإحالة (رابط التطبيق / Install Referrer) ---------- */
    (function captureReferralCode() {
        try { saveCode(new URLSearchParams(location.search).get('ref')); } catch (e) {}
        try {
            const cap = window.Capacitor, App = cap && cap.Plugins && cap.Plugins.App;
            const fromUrl = u => { try { saveCode(new URL(u).searchParams.get('ref')); } catch (e) {} };
            if (App && App.addListener) App.addListener('appUrlOpen', ev => ev && ev.url && fromUrl(ev.url));
            if (App && App.getLaunchUrl) App.getLaunchUrl().then(r => r && r.url && fromUrl(r.url)).catch(() => {});
            // Install Referrer: يعمل بعد النشر وبوجود إضافة Capacitor باسم InstallReferrer فيها getReferrer()
            const IR = cap && cap.Plugins && cap.Plugins.InstallReferrer;
            if (IR && IR.getReferrer && !localStorage.getItem('zelo_play_ref_done')) {
                IR.getReferrer().then(r => {
                    const raw = String((r && (r.referrer || r.installReferrer)) || '');
                    const m = raw.match(/(?:^|&)ref_([a-zA-Z0-9_]+)/) || raw.match(/^ref_([a-zA-Z0-9_]+)$/);
                    if (m) saveCode(m[1]);
                    localStorage.setItem('zelo_play_ref_done', '1');
                }).catch(() => {});
            }
        } catch (e) {}
    })();

    /* ---------- 2) رابط الدعوة (كود الإحالة = اسم المستخدم) ---------- */
    window.zeloReferralLink = function () {
        const u = cleanCode((typeof userState !== 'undefined' && userState.username) ? userState.username : '');
        if (!u) return '';
        if (PLAY.published) {
            return 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(PLAY.packageName)
                + '&referrer=' + encodeURIComponent('ref_' + u);
        }
        return PLAY.githubUrl + '?ref=' + encodeURIComponent(u);
    };

    /* نافذة "هل دعاك صديق؟" — استدعِها مرة واحدة في شاشة إنشاء الحساب */
    window.zeloAskInviter = function () {
        try {
            if (localStorage.getItem(REF_KEY) || localStorage.getItem(ASKED_KEY)) return;
            localStorage.setItem(ASKED_KEY, '1');
        } catch (e) { return; }
        const ar = isAr();
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;';
        ov.innerHTML = `
            <div dir="${ar ? 'rtl' : 'ltr'}" style="width:100%;max-width:340px;background:#0a1033;border:1px solid rgba(245,195,90,.3);border-radius:18px;padding:20px;color:#fff;font-family:inherit;">
                <div style="font-weight:900;font-size:1rem;margin-bottom:6px;">🤝 ${ar ? 'هل دعاك صديق؟' : 'Did a friend invite you?'}</div>
                <div style="font-size:.78rem;color:#9aa6d6;margin-bottom:12px;">${ar ? 'اكتب اسم مستخدم صديقك ليحصل على مكافأته' : "Enter your friend's username so they get their reward"}</div>
                <input id="zp-inviter" dir="ltr" maxlength="20" autocapitalize="off" style="width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1px solid rgba(44,75,181,.6);background:rgba(0,0,0,.4);color:#fff;font-size:.95rem;margin-bottom:12px;">
                <div style="display:flex;gap:8px;">
                    <button id="zp-ok" style="flex:1;padding:11px;border:none;border-radius:10px;background:#f5c35a;color:#0a1033;font-weight:900;font-family:inherit;">${ar ? 'تأكيد' : 'Confirm'}</button>
                    <button id="zp-skip" style="flex:1;padding:11px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:transparent;color:#cbd5e1;font-weight:700;font-family:inherit;">${ar ? 'تخطي' : 'Skip'}</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#zp-skip').onclick = () => ov.remove();
        ov.querySelector('#zp-ok').onclick = () => { saveCode(ov.querySelector('#zp-inviter').value.trim().replace(/^@/, '')); ov.remove(); };
    };

    window.copyReferralLink = async function () {
        const link = window.zeloReferralLink();
        if (!link) { alert(_tr('refFinishAccount', 'أكمل إنشاء حسابك أولاً', 'Finish creating your account first')); return; }
        try { await navigator.clipboard.writeText(link); }
        catch (e) { prompt(_tr('refCopyPrompt', 'انسخ الرابط:', 'Copy link:'), link); return; }
        alert(_tr('linkCopied', 'تم نسخ الرابط بنجاح! 📋', 'Link copied successfully! 📋'));
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
            const r = await c.from('referrals').select('status,reward_fixed').eq('referrer_id', id);
            if (r.error) return null;
            const rows = r.data || [];
            const done = rows.filter(x => x.status === 'rewarded');
            return {
                total: rows.length,
                done: done.length,
                pending: rows.length - done.length,
                earned: done.reduce((a, x) => a + (Number(x.reward_fixed) || 0), 0)
            };
        } catch (e) { return null; }
    };
})();
