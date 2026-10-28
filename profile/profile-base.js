/* ###################################################################
 * profile-base.js = core + styles + feed + post-actions (الأساس والتصميم والمنشورات)
 * ################################################################### */
/* ============================================================
 * profile/core.js  —  الأساس المشترك (يُحمَّل أولاً)
 * - ينشئ window.ZeloProfile (P) الذي تشترك فيه كل الملفات
 * - الأدوات المساعدة + تحميل بيانات الملف + الحالة المشتركة
 * ============================================================ */
(function () {
    const P = window.ZeloProfile = window.ZeloProfile || {};

    // الحالة المشتركة: كل الملفات تقرأ وتكتب هنا
    P.state = { draft: null, currentTarget: null, mode: 'view' }; // mode: 'view' | 'edit'

    P.US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    P.LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    P.esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    P.isAr = () => String(P.US().lang || P.LS.get('app_lang') || 'ar').startsWith('ar');
    P.db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

    const { US, LS, esc } = P;

    P.loadProfile = function () {
        const u = US();
        const rawUser = u.username || LS.get('zelo_username') || '';
        return {
            nickname: u.nickname_ar || u.nickname_en || LS.get('zelo_nickname_ar') || LS.get('zelo_nickname_en') || String(u.email || LS.get('zelo_email') || '').split('@')[0],
            username: rawUser === 'Android Player' ? (LS.get('zelo_username') || '') : rawUser,
            dob: u.dob || LS.get('zelo_dob') || '',
            bio: u.bio || LS.get('zelo_bio') || '',
            photoUrl: u.photoUrl || LS.get('zelo_photo_url') || '',
            selectedClubs: (u.selectedClubs || []).map(String),
            points: Number(u.points || 0),
            invited: Number(u.referrals_count ?? u.invited_count ?? 0) || 0,
            followers: Number(u.followers_count ?? u.followers ?? 0) || 0,
            following: Number(u.following_count ?? u.following ?? 0) || 0,
            email: u.email || LS.get('zelo_email') || '',
            badgeClub: String(u.badgeClub || u.badge_club || LS.get('zelo_badge_club') || '')
        };
    };

    P.readInputsIntoDraft = function () {
        const draft = P.state.draft;
        if (!draft) return;
        const g = id => document.getElementById(id);
        if (g('input-nick')) draft.nickname = g('input-nick').value.trim();
        if (g('input-dob')) draft.dob = g('input-dob').value;
        if (g('input-bio')) draft.bio = g('input-bio').value;
        if (g('input-email')) draft.emailInput = g('input-email').value.trim();
    };

    P.getMatchedClubs = function (d) {
        const matched = [];
        if (d.selectedClubs.length && typeof allWorldCupCountriesClubs !== 'undefined') {
            const all = [];
            for (const key in allWorldCupCountriesClubs) (allWorldCupCountriesClubs[key] || []).forEach(c => all.push(c));
            d.selectedClubs.forEach(id => {
                const club = all.find(c => String(c.id) === String(id));
                if (club) matched.push(club);
            });
        }
        return matched;
    };

    P.clubLabel = c => typeof getClubName === 'function' ? getClubName(c) : c.name;

    // شارة التوثيق = شعار النادي الذي اختاره المستخدم (badge_club)
    // window.zeloVerifiedBadge(user.badge_club, 16) -> HTML أو '' إن لم يختر شارة
    window.zeloVerifiedBadge = function (badgeClubId, size) {
        if (!badgeClubId || typeof allWorldCupCountriesClubs === 'undefined') return '';
        let club = null;
        for (const key in allWorldCupCountriesClubs) {
            club = (allWorldCupCountriesClubs[key] || []).find(c => String(c.id) === String(badgeClubId));
            if (club) break;
        }
        if (!club || !club.logo) return '';
        const px = size || 16;
        return `<img src="${esc(club.logo)}" onerror="this.style.display='none'" alt="" style="width:${px}px;height:${px}px;object-fit:contain;vertical-align:middle;margin:0 4px;">`;
    };

    // رابط الدعوة: مصدره الوحيد referrals.js (زيلو يعتمد على اسم المستخدم وبدون أي بوت)
    P.inviteLink = function () {
        return typeof window.zeloReferralLink === 'function' ? window.zeloReferralLink() : '';
    };

    P.displayNameOf = (d, ar) => d.nickname || d.username || (tr('ui_new_player', 'لاعب جديد', 'New Player'));
    P.avatarOf = (d, name) => d.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0a1033&color=f5c35a&size=128&bold=true`;

    P.timeAgo = function (iso, ar) {
        const t = new Date(iso).getTime();
        if (!t) return '';
        const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
        const m = Math.floor(s / 60), h = Math.floor(m / 60), dd = Math.floor(h / 24);
        if (s < 60) return tr('ui_now', 'الآن', 'now');
        if (m < 60) return ar ? m + ' د' : m + 'm';
        if (h < 24) return ar ? h + ' س' : h + 'h';
        if (dd < 7) return ar ? dd + ' ي' : dd + 'd';
        return new Date(t).toLocaleDateString(ar ? 'ar' : 'en', { day: 'numeric', month: 'short' });
    };

    P.openExternal = function (url) {
        try {
            const tg = window.Telegram && Telegram.WebApp;
            if (tg && /^https:\/\/t\.me\//.test(url) && tg.openTelegramLink) return tg.openTelegramLink(url);
            if (tg && tg.openLink && /^https?:/.test(url)) return tg.openLink(url);
        } catch (e) {}
        window.open(url, '_blank');
    };

    // إعادة رسم الصفحة الحالية (تعتمد على P.drawProfile من index.js)
    P.redraw = function () {
        const S = P.state;
        if (S.currentTarget && S.draft) P.drawProfile(S.currentTarget);
    };
})();

/* ============================================================
 * profile/styles.js  —  كل الـ CSS في مكان واحد
 * P.styles(ar) يرجع وسم <style> جاهزاً للحقن
 * الألوان: كحلي #0a1033 · أزرق ملكي #2c4bb5 · ذهبي #f5c35a
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;

    P.styles = function (ar) {
        const dir = tr('ui_ltr', 'rtl', 'ltr');
        const align = tr('ui_left', 'right', 'left');
        return `
        <style>
            .profile-wrap { width: 100%; box-sizing: border-box; padding: 4px 0 20px 0; direction: ${dir}; color: #fff; text-align: ${align}; }
            .profile-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
            .back-btn { background: rgba(245,195,90,0.08); color: #f5c35a; border: 1px solid rgba(245,195,90,0.35); padding: 8px 14px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
            .page-title { margin: 0; font-size: 1.05rem; font-weight: 900; background: linear-gradient(135deg, #ffd98a, #f5c35a, #6b8cff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: linear-gradient(135deg, rgba(17,26,74,0.95), rgba(10,16,51,0.95)); border: 1px solid rgba(245,195,90,0.25); border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: 0 0 14px rgba(44,75,181,0.25); }
            .card-title { color: #fff; font-size: 0.9rem; font-weight: 900; margin: 0 0 12px 0; }
            .hero { padding: 0; overflow: hidden; }
            .wall { position: relative; height: 120px; overflow: hidden; background: #0a1033; }
            .wall-bg { position: absolute; top: 0; bottom: 0; background-size: cover; background-position: center; filter: blur(14px) saturate(1.3) brightness(0.8); transform: scale(1.3); }
            .wall-full { left: 0; right: 0; }
            .wall-left { left: 0; width: 50%; }
            .wall-right { right: 0; width: 50%; }
            .wall-empty { background: linear-gradient(135deg, #14206b, #0a1033 60%, #2c4bb5); filter: none; transform: none; }
            .wall-mark { position: absolute; top: 12px; height: 76px; width: 76px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55)); z-index: 1; }
            .wall-mark-center { left: 50%; margin-left: -38px; height: 90px; width: 90px; top: 6px; }
            .wall-mark-left { left: 16%; }
            .wall-mark-right { right: 16%; }
            .hero-body { padding: 0 14px 14px 14px; }
            .avatar-stage { position: relative; z-index: 3; margin-top: -44px; margin-bottom: 8px; display: flex; justify-content: flex-start; }
            .avatar-box { position: relative; width: 88px; height: 88px; }
            .avatar-ring { width: 100%; height: 100%; border-radius: 50%; padding: 3px; box-sizing: border-box; background: linear-gradient(135deg, #2c4bb5, #f5c35a, #14206b); box-shadow: 0 0 18px rgba(245,195,90,0.35); }
            .avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0a1033; border: 2px solid #0a1033; }
            .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
            .avatar-cam { position: absolute; inset: 3px; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; border: none; color: #fff; }
            .hero-name { font-size: 1.1rem; font-weight: 900; margin: 0; }
            .hero-user { font-size: 0.78rem; color: #ffd98a; font-weight: 700; margin-top: 3px; direction: ltr; text-align: ${align}; }
            .hero-bio { font-size: 0.84rem; color: #e2e8f0; line-height: 1.6; margin-top: 10px; word-break: break-word; }
            .hero-meta { font-size: 0.72rem; color: #9aa6d6; font-weight: 700; margin-top: 8px; }
            .stats { display: flex; gap: 22px; margin-top: 12px; }
            .stat-num { font-size: 0.98rem; font-weight: 900; color: #fff; display: inline; }
            .stat-lbl { font-size: 0.74rem; font-weight: 700; color: #9aa6d6; display: inline; margin: 0 4px; }
            .hero-balance { display: inline-block; margin-top: 12px; font-size: 0.8rem; font-weight: 900; background: linear-gradient(90deg, #6b8cff, #f5c35a, #ffd98a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .x-btns { display: flex; gap: 10px; margin-top: 14px; }
            .x-btn { flex: 1; cursor: pointer; background: transparent; color: #fff; font-weight: 900; font-size: 0.86rem; padding: 10px; border-radius: 22px; border: 1px solid rgba(245,195,90,0.4); }
            .x-btn:active { background: rgba(245,195,90,0.12); }
            .verify-btn { margin-top: 10px; cursor: pointer; border: 1px solid rgba(245,195,90,0.55); background: rgba(245,195,90,0.1); color: #f5c35a; font-weight: 900; font-size: 0.76rem; padding: 7px 14px; border-radius: 20px; }
            .small-btn { margin-top: 8px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; background: rgba(44,75,181,0.2); color: #cbd5e1; font-size: 0.72rem; font-weight: 800; padding: 5px 12px; border-radius: 10px; }
            .club-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; background: rgba(0,0,0,0.35); border: 1px solid rgba(44,75,181,0.4); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; }
            .club-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .club-logo-box { width: 40px; height: 40px; min-width: 40px; border-radius: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,195,90,0.15); display: flex; align-items: center; justify-content: center; }
            .club-name { color: #fff; font-weight: 800; font-size: 0.84rem; }
            .club-sub { color: #9aa6d6; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
            .chip { font-size: 0.66rem; font-weight: 900; color: #0a1033; background: linear-gradient(135deg, #f5c35a, #ffd98a); padding: 5px 9px; border-radius: 8px; white-space: nowrap; }
            .empty-box { text-align: center; padding: 14px; color: #94a3b8; font-size: 0.8rem; font-weight: 700; border: 1px dashed rgba(245,195,90,0.35); border-radius: 12px; }
            .input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45); border: 1px solid rgba(44,75,181,0.5); border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 0.86rem; font-weight: 700; outline: none; }
            .acc-row { display: flex; gap: 8px; align-items: center; }
            .acc-btn { border: none; cursor: pointer; white-space: nowrap; font-weight: 900; font-size: 0.78rem; padding: 11px 14px; border-radius: 12px; color: #0a1033; background: linear-gradient(135deg, #f5c35a, #ffd98a); }
            .acc-note { font-size: 0.68rem; font-weight: 700; margin-top: 6px; color: #9aa6d6; }
            .linked-ok { color: #f5c35a; }
            .label { display: block; font-size: 0.7rem; font-weight: 800; color: #9aa6d6; margin-bottom: 6px; }
            .group { margin-bottom: 12px; }
            .logout-btn { width: 100%; margin-top: 4px; cursor: pointer; font-weight: 900; font-size: 0.88rem; padding: 12px; border-radius: 14px; color: #ff6b6b; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.35); }
            /* صفحة التعديل (مثل X) */
            .edit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
            .edit-title { font-size: 1rem; font-weight: 900; }
            .edit-save { border: none; cursor: pointer; background: linear-gradient(135deg, #f5c35a, #ffd98a); color: #0a1033; font-weight: 900; font-size: 0.82rem; padding: 8px 18px; border-radius: 20px; }
            .x-field { border-bottom: 1px solid rgba(245,195,90,0.18); padding: 12px 2px; }
            .x-field label { display: block; font-size: 0.72rem; font-weight: 800; color: #9aa6d6; margin-bottom: 4px; }
            .x-field input, .x-field textarea { width: 100%; box-sizing: border-box; background: transparent; border: none; outline: none; color: #fff; font-size: 0.96rem; font-weight: 600; padding: 4px 0; font-family: inherit; }
            .x-field textarea { resize: none; height: 78px; }
            .x-field:focus-within { border-bottom-color: #f5c35a; }
            .x-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
            .x-row .val { color: #fff; font-size: 0.92rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
            .x-row .arrow { color: #9aa6d6; }
            /* نافذة المتابعين / المتابَعين */
            .fl-page { position: fixed; inset: 0; z-index: 2600; background: #0a1033; display: flex; flex-direction: column; color: #fff; animation: fadeUp 0.2s ease-out; }
            .fl-top { display: flex; align-items: center; gap: 16px; padding: 14px 16px 8px; }
            .fl-back { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; padding: 2px 6px; }
            .fl-head-name { font-size: 1.1rem; font-weight: 900; }
            .fl-head-sub { font-size: 0.74rem; color: #9aa6d6; font-weight: 700; margin-top: 2px; }
            .fl-tabs { display: flex; border-bottom: 1px solid rgba(245,195,90,0.18); }
            .fl-tab { flex: 1; text-align: center; padding: 13px 4px; font-size: 0.9rem; font-weight: 800; color: #9aa6d6; cursor: pointer; position: relative; background: none; border: none; }
            .fl-tab.active { color: #fff; }
            .fl-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 25%; right: 25%; height: 4px; border-radius: 2px; background: #f5c35a; }
            .fl-list { flex: 1; overflow-y: auto; padding-bottom: 30px; }
            .fl-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(245,195,90,0.1); }
            .fl-av { width: 48px; height: 48px; min-width: 48px; border-radius: 50%; object-fit: cover; background: #0a1033; }
            .fl-main { flex: 1; min-width: 0; }
            .fl-tag { color: #9aa6d6; font-size: 0.72rem; font-weight: 800; margin-bottom: 2px; }
            .fl-name { font-weight: 900; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .fl-user { color: #9aa6d6; font-size: 0.8rem; font-weight: 700; direction: ltr; unicode-bidi: plaintext; text-align: start; }
            .fl-bio { color: #e2e8f0; font-size: 0.84rem; margin-top: 4px; line-height: 1.5; word-break: break-word; }
            .fl-btn { border: none; cursor: pointer; background: #f5c35a; color: #0a1033; font-weight: 900; font-size: 0.8rem; padding: 8px 16px; border-radius: 999px; white-space: nowrap; }
            .fl-btn.on { background: transparent; color: #fff; border: 1px solid rgba(245,195,90,0.45); }
            /* تبويبات المنشورات (مثل X) */
            .feed-tabs { display: flex; border-bottom: 1px solid rgba(245,195,90,0.18); margin-bottom: 4px; }
            .feed-tab { flex: 1; text-align: center; padding: 12px 4px; font-size: 0.84rem; font-weight: 800; color: #9aa6d6; cursor: pointer; position: relative; background: none; border: none; }
            .feed-tab.active { color: #fff; }
            .feed-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 25%; right: 25%; height: 4px; border-radius: 2px; background: #f5c35a; }
            .feed-item { display: flex; gap: 10px; padding: 12px 2px; border-bottom: 1px solid rgba(245,195,90,0.1); }
            .feed-av { width: 40px; height: 40px; min-width: 40px; border-radius: 50%; object-fit: cover; background: #0a1033; }
            .feed-main { flex: 1; min-width: 0; }
            .feed-ctx { font-size: 0.7rem; font-weight: 800; color: #9aa6d6; margin-bottom: 4px; }
            .feed-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.84rem; }
            .feed-head b { font-weight: 900; color: #fff; }
            .feed-head span { color: #9aa6d6; font-size: 0.74rem; font-weight: 600; direction: ltr; }
            .feed-text { font-size: 0.88rem; line-height: 1.6; color: #e2e8f0; margin-top: 4px; word-break: break-word; white-space: pre-wrap; }
            .feed-img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 14px; margin-top: 8px; border: 1px solid rgba(245,195,90,0.15); }
            .feed-quote { margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(245,195,90,0.2); border-radius: 12px; font-size: 0.78rem; color: #cbd5e1; }
            .feed-stats { display: flex; gap: 22px; margin-top: 8px; font-size: 0.74rem; font-weight: 700; color: #9aa6d6; }
            .feed-empty { text-align: center; padding: 36px 12px; color: #9aa6d6; font-weight: 700; font-size: 0.86rem; }
            .feed-stats { justify-content: space-between; gap: 6px; }
            .feed-stats .act { cursor: pointer; }
            .feed-head .feed-more { margin-inline-start: auto; cursor: pointer; padding: 0 8px; font-size: 1.3rem; color: #9aa6d6; font-weight: 900; line-height: 1; direction: ltr; }
        </style>`;
    };
})();

/* ============================================================
 * profile/feed.js  —  المنشورات / الردود / إعادة النشر (مثل X)
 * يعرض تبويبات الملف الشخصي. إجراءات المنشور (تثبيت، حذف...) في post-actions.js
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const { US, esc, isAr, db, displayNameOf, avatarOf, timeAgo } = P;

    // أسماء الجداول الافتراضية — غيّرها عبر window.ZELO_FEED_TABLES إن اختلفت لديك
    P.FT = () => Object.assign({ posts: 'posts', comments: 'post_comments', reposts: 'post_reposts' }, window.ZELO_FEED_TABLES || {});
    const FT = P.FT;

    // ===== شكل أزرار المنشور (نفس شكل الصفحة الرئيسية) =====
    const svgIcon = (d, filled = false) =>
        `<svg viewBox="0 0 24 24" width="19" height="19" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC = {
        reply:  svgIcon('<path d="M21 11.5c0 4.14-3.8 7.5-8.5 7.5-.9 0-1.8-.12-2.6-.35L5 21l1.4-3.6C5.5 16.3 4.5 14.5 4.5 12.5 4.5 8.36 8.3 5 13 5s8 3.36 8 6.5z"/>'),
        repost: svgIcon('<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
        heart:  on => svgIcon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1.1a5.5 5.5 0 0 0 0-7.7z"/>', on),
        views:  svgIcon('<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>'),
        save:   on => svgIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', on),
        share:  svgIcon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>')
    };
    P.postIcons = IC; // يستخدمها post-actions.js
    if (!document.getElementById('pf-actions-css')) {
        const st = document.createElement('style');
        st.id = 'pf-actions-css';
        st.textContent = `
            #feed-box .feed-item { display:block !important; }
            .pf-row { display:flex; gap:10px; align-items:flex-start; }
            .pf-row .feed-main { flex:1; min-width:0; }
            .pf-actions { display:flex; justify-content:space-between; align-items:center; padding:6px 2px 0; }
            .pf-act { display:flex; align-items:center; gap:4px; padding:6px 5px; border-radius:999px; color:#9aa6d6; font-size:0.8rem; font-weight:700; cursor:default; }
            .pf-act .ic { display:inline-flex; align-items:center; justify-content:center; }
            .pf-act .ic svg { display:block; }
            .pf-act[onclick] { cursor:pointer; }
            .pf-save { opacity:0.6; }
            .pf-save.saved { opacity:1; color:#f5c35a; background:rgba(245,195,90,0.12); }
        `;
        document.head.appendChild(st);
    }

    // حالة المنشورات المشتركة مع post-actions.js
    P.feed = { tab: 'posts', cache: {} };
    const F = P.feed;

    // عند إغلاق صفحة المنشور أو تغيّر شيء فيها: حدّث المنشورات بصمت
    window.addEventListener('zelo-post-changed', () => {
        Object.keys(F.cache).forEach(k => delete F.cache[k]);
        if (document.getElementById('feed-box')) P.loadFeed(true, true);
    });

    // يجلب العناصر ثم يضيف العدّادات (إعجابات/ردود/إعادة نشر) وسياق الرد
    async function fetchFeed(tab) {
        const rows = await fetchFeedRaw(tab);
        const c = db();
        if (!c || !rows.length) return rows;
        const T = FT();
        const pid = e => String(e.kind === 'reply' ? e.item.post_id : e.item.id);
        const ids = [...new Set(rows.map(pid))].map(x => isNaN(x) ? x : Number(x));
        const count = async (table) => {
            const m = {};
            try {
                const r = await c.from(table).select('post_id').in('post_id', ids);
                (r.data || []).forEach(x => { const k = String(x.post_id); m[k] = (m[k] || 0) + 1; });
            } catch (e) {}
            return m;
        };
        const [likes, comments, reposts, views] = await Promise.all([count('post_likes'), count(T.comments), count(T.reposts), count('post_views')]);
        const marks = {};
        try {
            const br = await c.from('post_bookmarks').select('post_id').eq('user_id', String(US().userId)).in('post_id', ids);
            (br.data || []).forEach(x => marks[String(x.post_id)] = 1);
        } catch (e) {}
        let parents = {};
        if (tab === 'replies') {
            try {
                const pr = await c.from(T.posts).select('id,content,author_name').in('id', ids);
                (pr.data || []).forEach(p => parents[String(p.id)] = p);
            } catch (e) {}
        }
        rows.forEach(e => {
            const k = pid(e);
            e.counts = { likes: likes[k] || 0, replies: comments[k] || 0, reposts: reposts[k] || 0, views: views[k] || 0 };
            e.saved = !!marks[k];
            if (e.kind === 'reply') e.parent = parents[k] || null;
        });
        // المنشور المثبّت أولاً (الترتيب الباقي يبقى كما هو)
        if (tab === 'posts') rows.sort((a, b) => (b.item.pinned_at ? 1 : 0) - (a.item.pinned_at ? 1 : 0));
        return rows;
    }

    async function fetchFeedRaw(tab) {
        const c = db(), uid = US().userId;
        if (!c || !uid) return [];
        const T = FT();
        const own = { user_id: String(uid) };
        if (tab === 'posts') {
            const r = await c.from(T.posts).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
            if (r.error) throw r.error;
            return (r.data || []).map(p => ({ kind: 'post', item: p, author: null }));
        }
        if (tab === 'replies') {
            const r = await c.from(T.comments).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
            if (r.error) throw r.error;
            return (r.data || []).map(p => ({ kind: 'reply', item: p, author: null }));
        }
        // reposts
        const r = await c.from(T.reposts).select('*').eq('user_id', own.user_id).order('created_at', { ascending: false }).limit(40);
        if (r.error) throw r.error;
        const rows = r.data || [];
        const ids = [...new Set(rows.map(x => x.post_id).filter(Boolean))];
        let posts = {}, authors = {};
        if (ids.length) {
            const pr = await c.from(T.posts).select('*').in('id', ids);
            (pr.data || []).forEach(p => posts[String(p.id)] = p);
            const uids = [...new Set(Object.values(posts).map(p => p.user_id).filter(Boolean).map(String))];
            if (uids.length) {
                const ur = await c.from('users').select('user_id,nickname_ar,nickname_en,username,photo_url,badge_club').in('user_id', uids);
                (ur.data || []).forEach(u => authors[String(u.user_id)] = u);
            }
        }
        return rows.map(x => {
            const p = posts[String(x.post_id)];
            return p ? { kind: 'repost', item: p, repostAt: x.created_at, author: authors[String(p.user_id)] || null } : null;
        }).filter(Boolean);
    }

    function feedItemHtml(e, d, ar) {
        const p = e.item;
        const a = e.author;
        const isRepost = e.kind === 'repost';
        const name = isRepost
            ? ((a && (a.nickname_ar || a.nickname_en || a.username)) || p.author_name || '')
            : displayNameOf(d, ar);
        const user = isRepost ? (a ? a.username : '') : d.username;
        const photo = isRepost
            ? ((a && a.photo_url) || p.author_avatar || avatarOf({ photoUrl: '' }, name || '?'))
            : avatarOf(d, displayNameOf(d, ar));
        const badge = window.zeloVerifiedBadge(a ? a.badge_club : d.badgeClub, 14);
        const text = p.content ?? p.text ?? p.body ?? '';
        const img = p.image_url || p.media_url || p.image || '';
        const when = timeAgo(e.repostAt || p.created_at, ar);
        const ctx = e.kind === 'repost' ? `<div class="feed-ctx">🔁 ${tr('ui_you_reposted', 'أعدتَ النشر', 'You reposted')}</div>`
            : e.kind === 'reply' ? `<div class="feed-ctx">💬 ${tr('ui_replying_to', 'رددتَ على', 'Replying to')} ${esc((e.parent && e.parent.author_name) || (tr('ui_a_post', 'منشور', 'a post')))}</div>` : '';
        const quote = (e.kind === 'reply' && e.parent && e.parent.content)
            ? `<div class="feed-quote">${esc(String(e.parent.content).slice(0, 140))}</div>` : '';
        const cn = e.counts || {};
        const sid = esc(String(e.kind === 'reply' ? p.post_id : p.id));
        const pinnedHtml = (e.kind === 'post' && p.pinned_at) ? `<div class="feed-ctx">📌 ${tr('ui_pinned', 'مثبّت', 'Pinned')}</div>` : '';
        const menuBtn = e.kind === 'post' ? `<span class="feed-more" onclick="event.stopPropagation();window.pfOpenPostMenu('${sid}')">⋯</span>` : '';
        const n = v => Number(v || 0).toLocaleString('en-US');
        return `
            <div class="feed-item" style="cursor:pointer;" onclick="window.openPostPage && window.openPostPage('${sid}')">
                <div class="pf-row">
                <img class="feed-av" src="${esc(photo)}" onerror="this.style.visibility='hidden'" alt="">
                <div class="feed-main">
                    ${pinnedHtml}${ctx}
                    <div class="feed-head"><b>${esc(name)}</b>${badge}${user ? `<span>@${esc(user)}</span>` : ''}<span>· ${esc(when)}</span>${menuBtn}</div>
                    ${text ? `<div class="feed-text">${esc(text)}</div>` : ''}
                    ${img ? `<img class="feed-img" src="${esc(img)}" onerror="this.style.display='none'" alt="">` : ''}
                    ${quote}
                </div>
                </div>
                <div class="pf-actions">
                        <span class="pf-act"><span class="ic">${IC.reply}</span><span class="cnt">${n(cn.replies)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.repost}</span><span class="cnt">${n(cn.reposts)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.heart(false)}</span><span class="cnt">${n(cn.likes)}</span></span>
                        <span class="pf-act"><span class="ic">${IC.views}</span><span class="cnt">${n(cn.views)}</span></span>
                        <span class="pf-act pf-save ${e.saved ? 'saved' : ''}" data-on="${e.saved ? 1 : 0}" onclick="event.stopPropagation();window.pfToggleBookmark('${sid}', this)"><span class="ic">${IC.save(!!e.saved)}</span></span>
                        <span class="pf-act" onclick="event.stopPropagation();window.pfSharePost('${sid}')"><span class="ic">${IC.share}</span></span>
                    </div>
            </div>`;
    }

    P.loadFeed = async function (force, silent) {
        const box = document.getElementById('feed-box');
        if (!box) return;
        const ar = isAr();
        const tab = F.tab;
        if (!force && F.cache[tab]) { renderFeed(F.cache[tab], box, ar); return; }
        if (!silent) box.innerHTML = `<div class="feed-empty">${tr('ui_loading', 'جارٍ التحميل…', 'Loading…')}</div>`;
        try {
            const rows = await fetchFeed(tab);
            F.cache[tab] = rows;
            if (tab === F.tab) renderFeed(rows, document.getElementById('feed-box'), ar);
        } catch (err) {
            console.error('feed error', err);
            const b = document.getElementById('feed-box');
            if (b) b.innerHTML = `<div class="feed-empty">${tr('ui_could_not_load_content', 'تعذّر تحميل المحتوى', 'Could not load content')}<br><small style="direction:ltr;display:block;margin-top:6px;">${esc(err.message || '')}</small></div>`;
        }
    };

    function renderFeed(rows, box, ar) {
        if (!box) return;
        if (!rows.length) {
            const msg = { posts: ['لا توجد منشورات بعد', 'No posts yet'], replies: ['لا توجد ردود بعد', 'No replies yet'], reposts: ['لا توجد إعادة نشر بعد', 'No reposts yet'] }[F.tab];
            box.innerHTML = `<div class="feed-empty">${ar ? msg[0] : msg[1]}</div>`;
            return;
        }
        box.innerHTML = rows.map(e => feedItemHtml(e, P.state.draft, ar)).join('');
    }

    window.switchProfileTab = function (tab) {
        F.tab = tab;
        document.querySelectorAll('.feed-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        P.loadFeed(false);
    };

    P.feedSectionHtml = function (ar) {
        const tabs = [['posts', tr('ui_posts', 'المنشورات', 'Posts')], ['replies', tr('ui_replies', 'الردود', 'Replies')], ['reposts', tr('ui_reposts', 'إعادة النشر', 'Reposts')]];
        // بطاقة "وثّق حسابك" (تظهر لغير المشتركين فقط، وتُملأ من premium.js)
        setTimeout(() => window.ZeloPremium && window.ZeloPremium.mountPromo && window.ZeloPremium.mountPromo(), 80);
        setTimeout(() => window.ZeloPremium && window.ZeloPremium.mountPromo && window.ZeloPremium.mountPromo(), 500);
        return `
            <div id="verify-promo"></div>
            <div class="feed-tabs">
                ${tabs.map(t => `<button class="feed-tab ${t[0] === F.tab ? 'active' : ''}" data-tab="${t[0]}" onclick="window.switchProfileTab('${t[0]}')">${t[1]}</button>`).join('')}
            </div>
            <div id="feed-box"></div>`;
    };

    // استدعِها من صفحة المنشورات الرئيسية عند ظهور منشور لمستخدم آخر لتسجيل مشاهدة (مرة لكل مستخدم)
    window.zeloRecordView = async function (postId) {
        const c = db(), uid = US().userId;
        if (!c || !uid || !postId) return;
        try { await c.from('post_views').upsert({ post_id: postId, user_id: String(uid) }, { onConflict: 'post_id,user_id', ignoreDuplicates: true }); } catch (e) {}
    };
})();

/* ============================================================
 * profile/post-actions.js  —  إجراءات المنشور (قائمة ⋯ والنوافذ السفلية)
 * تثبيت، حذف، تفاعلات، ردود مخفية، حفظ، مشاركة المنشور
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const { US, esc, isAr, db, timeAgo, openExternal } = P;
    const F = P.feed;
    const FT = P.FT;

    // ===== نوافذ سفلية =====
    function openSheet(html) {
        document.getElementById('post-sheet')?.remove();
        const ar = isAr();
        const ov = document.createElement('div');
        ov.id = 'post-sheet';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        ov.innerHTML = `<div style="width:100%;max-width:500px;max-height:80vh;overflow-y:auto;box-sizing:border-box;direction:${ar ? 'rtl' : 'ltr'};background:#0a1033;border:1px solid rgba(245,195,90,0.3);border-radius:22px 22px 0 0;padding:10px 0 22px 0;color:#fff;"><div style="width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,0.25);margin:0 auto 10px auto;"></div>${html}</div>`;
        document.body.appendChild(ov);
    }
    const closeSheet = () => document.getElementById('post-sheet')?.remove();
    const sheetRow = (icon, label, fn, danger) => `<div onclick="${fn}" style="display:flex;align-items:center;gap:14px;padding:15px 20px;cursor:pointer;font-weight:800;font-size:0.92rem;color:${danger ? '#ff6b6b' : '#fff'};"><span style="font-size:1.2rem;width:26px;text-align:center;">${icon}</span>${label}</div>`;
    const sheetNote = t => `<div style="padding:22px 20px;text-align:center;color:#94a3b8;font-weight:700;font-size:0.85rem;line-height:1.7;">${t}</div>`;

    const findPost = id => { const r = (F.cache.posts || []).find(e => String(e.item.id) === String(id)); return r ? r.item : null; };
    const anyPost = id => findPost(id) || (() => { for (const k in F.cache) { const r = (F.cache[k] || []).find(e => e.kind !== 'reply' && String(e.item.id) === String(id)); if (r) return r.item; } return null; })();

    async function profilesFor(uids) {
        const c = db(), map = {};
        if (!c || !uids.length) return map;
        const fill = rows => (rows || []).forEach(u => { map[String(u.user_id)] = u.nickname_ar || u.nickname_en || u.username || u.display_name || u.author_name || ''; });
        try { const r = await c.from('public_profiles').select('*').in('user_id', uids); if (!r.error && r.data && r.data.length) { fill(r.data); return map; } } catch (e) {}
        try { const r = await c.from('users').select('user_id,nickname_ar,nickname_en,username').in('user_id', uids); if (!r.error) fill(r.data); } catch (e) {}
        return map;
    }

    window.pfOpenPostMenu = function (id) {
        const ar = isAr();
        const p = findPost(id);
        if (!p) return;
        const sid = esc(String(id));
        openSheet(
            (p.pinned_at
                ? sheetRow('📍', ar ? 'إلغاء التثبيت من الملف الشخصي' : 'Unpin from profile', `window.pfPinPost('${sid}',false)`)
                : sheetRow('📌', ar ? 'تثبيت المنشور في الملف الشخصي' : 'Pin to your profile', `window.pfPinPost('${sid}',true)`)) +
            sheetRow('🗑️', ar ? 'حذف المنشور' : 'Delete post', `window.pfDeletePost('${sid}')`, true) +
            '<div style="height:1px;background:rgba(255,255,255,0.1);margin:4px 16px;"></div>' +
            sheetRow('📊', ar ? 'عرض التفاعلات مع المنشور' : 'View post interactions', `window.pfShowInteractions('${sid}')`) +
            sheetRow('🙈', ar ? 'عرض الردود المخفية' : 'View hidden replies', `window.pfShowHiddenReplies('${sid}')`)
        );
    };

    window.pfPinPost = async function (id, pin) {
        const ar = isAr(), c = db(), uid = US().userId, T = FT();
        closeSheet();
        if (!c || !uid) return;
        if (pin) await c.from(T.posts).update({ pinned_at: null }).eq('user_id', String(uid)).not('pinned_at', 'is', null);
        const { error } = await c.from(T.posts).update({ pinned_at: pin ? new Date().toISOString() : null }).eq('id', id).eq('user_id', String(uid));
        if (error) { alert((ar ? 'تعذّر التنفيذ: ' : 'Failed: ') + error.message + (/pinned_at/.test(error.message) ? (ar ? '\nشغّل ملف SQL الإضافي أولاً.' : '\nRun the extra SQL first.') : '')); return; }
        delete F.cache.posts;
        P.loadFeed(true);
    };

    window.pfDeletePost = async function (id) {
        const ar = isAr(), c = db(), uid = US().userId, T = FT();
        closeSheet();
        if (!confirm(ar ? 'حذف هذا المنشور نهائياً؟' : 'Delete this post permanently?')) return;
        if (!c || !uid) return;
        const { error } = await c.from(T.posts).delete().eq('id', id).eq('user_id', String(uid));
        if (error) { alert((ar ? 'تعذّر الحذف: ' : 'Delete failed: ') + error.message); return; }
        Object.keys(F.cache).forEach(k => delete F.cache[k]);
        P.loadFeed(true);
    };

    window.pfShowInteractions = async function (id) {
        const ar = isAr(), c = db(), T = FT();
        openSheet(sheetNote(ar ? 'جارٍ التحميل…' : 'Loading…'));
        try {
            const [lk, rp, cm, vw] = await Promise.all([
                c.from('post_likes').select('user_id').eq('post_id', id),
                c.from(T.reposts).select('user_id').eq('post_id', id),
                c.from(T.comments).select('user_id,author_name').eq('post_id', id),
                c.from('post_views').select('post_id', { count: 'exact', head: true }).eq('post_id', id)
            ]);
            const likeIds = (lk.data || []).map(x => String(x.user_id));
            const repIds = (rp.data || []).map(x => String(x.user_id));
            const names = await profilesFor([...new Set([...likeIds, ...repIds])]);
            const list = (ids, fallback) => ids.length
                ? ids.slice(0, 40).map(u => `<div style="padding:6px 0;font-size:0.84rem;font-weight:700;color:#e2e8f0;">${esc(names[u] || fallback)}</div>`).join('')
                : `<div style="font-size:0.8rem;color:#9aa6d6;font-weight:700;">${ar ? 'لا أحد بعد' : 'Nobody yet'}</div>`;
            const sec = (icon, title, count, body) => `<div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.08);"><div style="font-weight:900;font-size:0.9rem;margin-bottom:6px;">${icon} ${title} <span style="color:#9aa6d6;">(${count})</span></div>${body}</div>`;
            const cmNames = [...new Set((cm.data || []).map(x => x.author_name || names[String(x.user_id)] || '').filter(Boolean))];
            openSheet(
                `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">📊 ${ar ? 'التفاعلات مع المنشور' : 'Post interactions'}</div>` +
                sec('👁', ar ? 'المشاهدات' : 'Views', (vw.count || 0).toLocaleString('en-US'), '') +
                sec('❤️', ar ? 'الإعجابات' : 'Likes', likeIds.length, list(likeIds, ar ? 'مستخدم' : 'User')) +
                sec('🔁', ar ? 'إعادة النشر' : 'Reposts', repIds.length, list(repIds, ar ? 'مستخدم' : 'User')) +
                sec('💬', ar ? 'الردود' : 'Replies', (cm.data || []).length, cmNames.length ? cmNames.slice(0, 40).map(n => `<div style="padding:6px 0;font-size:0.84rem;font-weight:700;color:#e2e8f0;">${esc(n)}</div>`).join('') : `<div style="font-size:0.8rem;color:#9aa6d6;font-weight:700;">${ar ? 'لا أحد بعد' : 'Nobody yet'}</div>`)
            );
        } catch (err) {
            openSheet(sheetNote((ar ? 'تعذّر التحميل: ' : 'Failed: ') + esc(err.message || '')));
        }
    };

    window.pfShowHiddenReplies = async function (id) {
        const ar = isAr(), c = db(), T = FT();
        openSheet(sheetNote(ar ? 'جارٍ التحميل…' : 'Loading…'));
        const r = await c.from(T.comments).select('id,content,author_name,created_at').eq('post_id', id).eq('hidden', true).order('created_at', { ascending: false });
        if (r.error) { openSheet(sheetNote((ar ? 'تعذّر التحميل. شغّل ملف SQL الإضافي أولاً.<br>' : 'Failed. Run the extra SQL first.<br>') + esc(r.error.message))); return; }
        const rows = r.data || [];
        const title = `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">🙈 ${ar ? 'الردود المخفية' : 'Hidden replies'}</div>`;
        if (!rows.length) { openSheet(title + sheetNote(ar ? 'لا توجد ردود مخفية' : 'No hidden replies')); return; }
        openSheet(title + rows.map(x => `
            <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-weight:900;font-size:0.84rem;">${esc(x.author_name || (ar ? 'مستخدم' : 'User'))} <span style="color:#9aa6d6;font-weight:600;">· ${esc(timeAgo(x.created_at, ar))}</span></div>
                <div style="font-size:0.86rem;color:#e2e8f0;margin:4px 0 8px;white-space:pre-wrap;word-break:break-word;">${esc(x.content || '')}</div>
                <button class="small-btn" onclick="window.pfUnhideReply('${esc(String(x.id))}','${esc(String(id))}')">${ar ? 'إظهار الرد' : 'Unhide'}</button>
            </div>`).join(''));
    };

    window.pfUnhideReply = async function (cid, pid) {
        const c = db();
        const { error } = await c.rpc('set_comment_hidden', { p_comment_id: Number(cid), p_hidden: false });
        if (error) { alert(error.message); return; }
        window.pfShowHiddenReplies(pid);
    };

    window.pfToggleBookmark = async function (id, el) {
        const ar = isAr(), c = db(), uid = US().userId;
        if (!c || !uid) return;
        const was = el.dataset.on === '1';
        const paint = on => {
            el.dataset.on = on ? '1' : '0';
            el.classList.toggle('saved', on);
            const ic = el.querySelector('.ic');
            if (ic && P.postIcons) ic.innerHTML = P.postIcons.save(on);
        };
        paint(!was);
        const q = was
            ? c.from('post_bookmarks').delete().eq('post_id', id).eq('user_id', String(uid))
            : c.from('post_bookmarks').insert({ post_id: id, user_id: String(uid) });
        const { error } = await q;
        if (error) {
            paint(was);
            alert((ar ? 'تعذّر الحفظ: ' : 'Failed: ') + error.message);
            return;
        }
        for (const k in F.cache) (F.cache[k] || []).forEach(e => { if (String(e.kind === 'reply' ? e.item.post_id : e.item.id) === String(id)) e.saved = !was; });
    };

    function postLink(id) { return (window.zeloPostLink && window.zeloPostLink(id)) || ''; }

    window.pfSharePost = function (id) {
        const ar = isAr(), sid = esc(String(id));
        openSheet(
            `<div style="padding:4px 20px 10px;font-weight:900;font-size:1rem;">📤 ${ar ? 'مشاركة المنشور' : 'Share post'}</div>` +
            sheetRow('✈️', 'Telegram', `window.pfSharePostVia('telegram','${sid}')`) +
            sheetRow('💬', ar ? 'واتساب' : 'WhatsApp', `window.pfSharePostVia('whatsapp','${sid}')`) +
            sheetRow('𝕏', 'X', `window.pfSharePostVia('x','${sid}')`) +
            sheetRow('🔗', ar ? 'نسخ الرابط' : 'Copy link', `window.pfSharePostVia('copy','${sid}')`) +
            sheetRow('⋯', ar ? 'مشاركة عبر…' : 'Share via…', `window.pfSharePostVia('more','${sid}')`)
        );
    };

    window.pfSharePostVia = async function (kind, id) {
        const ar = isAr();
        const link = postLink(id);
        const p = anyPost(id);
        const snippet = p && (p.content || p.text) ? String(p.content || p.text).slice(0, 100) : 'Zelo Sport ⚽';
        const u = encodeURIComponent(link), t = encodeURIComponent(snippet);
        closeSheet();
        if (kind === 'telegram') openExternal(`https://t.me/share/url?url=${u}&text=${t}`);
        else if (kind === 'whatsapp') openExternal(`https://wa.me/?text=${t}%20${u}`);
        else if (kind === 'x') openExternal(`https://twitter.com/intent/tweet?text=${t}&url=${u}`);
        else if (kind === 'more' && navigator.share) navigator.share({ text: snippet, url: link }).catch(() => {});
        else {
            try { await navigator.clipboard.writeText(link); }
            catch (e) { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) {} ta.remove(); }
            alert(ar ? 'تم نسخ الرابط ✅' : 'Link copied ✅');
        }
    };
})();

