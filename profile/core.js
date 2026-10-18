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

    // رابط الدعوة/الملف: عرّف window.getReferralLink() لديك إن كانت الصيغة مختلفة
    P.inviteLink = function () {
        try { if (typeof window.getReferralLink === 'function') { const l = window.getReferralLink(); if (l) return l; } } catch (e) {}
        return 'https://t.me/Zelo_Sport_bot?start=' + encodeURIComponent(String(US().userId || ''));
    };

    P.displayNameOf = (d, ar) => d.nickname || d.username || (tr('ui_new_player', 'لاعب جديد', 'New Player'));
    P.avatarOf = (d, name) => d.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c0e20&color=00FF87&size=128&bold=true`;

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
                              
