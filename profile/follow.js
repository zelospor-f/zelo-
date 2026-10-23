/* ============================================================
 * profile/follow.js  —  المتابعون / المتابَعون (مثل X)
 * (يتضمن تبويب "المدعوون" المرتبط بنظام الإحالات)
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, esc, isAr, db, displayNameOf, avatarOf } = P;
    const _tr = (k, a, e, p) => window.tr ? window.tr(k, a, e, p) : (isAr() ? a : e);

    const FL = { tab: 'followers', followers: null, following: null, myFollowing: new Set(), myFollowers: new Set(), profiles: {}, error: '', invitees: [], invError: '' };

    async function loadFollowData() {
        const c = db(), uid = String(US().userId || '');
        FL.error = '';
        if (!c || !uid) { FL.error = tr('ui_no_database_connection', 'لا يوجد اتصال بقاعدة البيانات', 'No database connection'); return; }
        const [a, b, inv] = await Promise.all([
            c.from('user_follows').select('follower_id,created_at').eq('following_id', uid).order('created_at', { ascending: false }).limit(200),
            c.from('user_follows').select('following_id,created_at').eq('follower_id', uid).order('created_at', { ascending: false }).limit(200),
            c.from('referrals').select('referred_id,status,reward_fixed,reward_pct,created_at,rewarded_at').eq('referrer_id', uid).order('created_at', { ascending: false }).limit(200)
        ]);
        FL.invError = inv.error ? inv.error.message : '';
        FL.invitees = inv.error ? [] : (inv.data || []).map(r => ({ ...r, referred_id: String(r.referred_id) }));
        if (a.error || b.error) { FL.error = (a.error || b.error).message; return; }
        FL.followers = (a.data || []).map(r => String(r.follower_id));
        FL.following = (b.data || []).map(r => String(r.following_id));
        FL.myFollowers = new Set(FL.followers);
        FL.myFollowing = new Set(FL.following);
        const ids = [...new Set([...FL.followers, ...FL.following, ...FL.invitees.map(i => i.referred_id)])];
        if (ids.length) {
            try {
                const r = await c.from('public_profiles').select('*').in('user_id', ids);
                (r.data || []).forEach(u => FL.profiles[String(u.user_id)] = u);
            } catch (e) {}
        }
    }

    function flRowHtml(uid, ar) {
        const u = FL.profiles[uid] || {};
        const name = u.nickname_ar || u.nickname_en || u.display_name || u.username || (tr('ui_player', 'لاعب', 'Player'));
        const photo = u.photo_url || avatarOf({ photoUrl: '' }, name);
        const followed = FL.myFollowing.has(uid);
        const followsMe = FL.myFollowers.has(uid);
        const label = followed ? (tr('ui_following_2', 'مُتابَع', 'Following')) : (followsMe ? (tr('ui_follow_back', 'ردّ المتابعة', 'Follow back')) : (tr('ui_follow', 'تابِع', 'Follow')));
        return `
            <div class="fl-row">
                <img class="fl-av" src="${esc(photo)}" onerror="this.style.visibility='hidden'" alt="">
                <div class="fl-main">
                    ${followsMe ? `<div class="fl-tag">👤 ${tr('ui_follows_you', 'يتابعك', 'Follows you')}</div>` : ''}
                    <div class="fl-name">${esc(name)}${window.zeloVerifiedBadge(u.badge_club, 16)}</div>
                    ${u.username ? `<div class="fl-user">@${esc(u.username)}</div>` : ''}
                    ${u.bio ? `<div class="fl-bio">${esc(String(u.bio).slice(0, 120))}</div>` : ''}
                </div>
                <button class="fl-btn ${followed ? 'on' : ''}" onclick="window.toggleFollowRow('${esc(uid)}')">${label}</button>
            </div>`;
    }

    function inviteeRowHtml(inv, ar) {
        const u = FL.profiles[inv.referred_id] || {};
        const name = u.nickname_ar || u.nickname_en || u.display_name || u.username || _tr('playerDefault', 'لاعب', 'Player');
        const photo = u.photo_url || avatarOf({ photoUrl: '' }, name);
        const done = inv.status === 'rewarded';
        const total = (Number(inv.reward_fixed) || 0) + (Number(inv.reward_pct) || 0);
        const badge = done
            ? `<span style="color:#f5c35a;font-weight:900;font-size:0.78rem;">+${total.toLocaleString('en-US')} ✅</span>`
            : `<span style="color:#f5c35a;font-weight:800;font-size:0.72rem;">${_tr('refAwaiting', 'بانتظار أول كسب ⏳', 'Awaiting first earning ⏳')}</span>`;
        return `
            <div class="fl-row">
                <img class="fl-av" src="${esc(photo)}" onerror="this.style.visibility='hidden'" alt="">
                <div class="fl-main">
                    <div class="fl-name">${esc(name)}</div>
                    ${u.username ? `<div class="fl-user">@${esc(u.username)}</div>` : ''}
                </div>
                <div style="flex-shrink:0;text-align:center;">${badge}</div>
            </div>`;
    }

    function paintFollowTabs() {
        document.querySelectorAll('.fl-tab').forEach(b => b.classList.toggle('active', b.dataset.t === FL.tab));
    }

    function renderFollowList() {
        const ar = isAr();
        const list = document.getElementById('fl-list');
        const sub = document.getElementById('fl-sub');
        if (!list) return;
        if (FL.error) { list.innerHTML = `<div class="feed-empty">${tr('ui_could_not_load', 'تعذّر التحميل', 'Could not load')}<br><small style="direction:ltr;display:block;margin-top:6px;">${esc(FL.error)}</small></div>`; return; }
        if (FL.tab === 'invitees') {
            const rewarded = FL.invitees.filter(i => i.status === 'rewarded').length;
            if (sub) sub.textContent = _tr('refInviteesCount', '{n} مدعواً · {done} مكتملة', '{n} invited · {done} completed', { n: FL.invitees.length, done: rewarded });
            const head = `
                <div style="padding:12px;margin-bottom:10px;border-radius:14px;border:1px solid rgba(245,195,90,0.3);background:rgba(245,195,90,0.08);text-align:center;">
                    <div style="font-size:0.78rem;font-weight:800;color:#fff;margin-bottom:4px;">${_tr('refRewardInfo', '🎁 لكل صديق يبدأ بجمع النقاط: 1000 عملة + 10% من رصيده', '🎁 For each friend who starts earning: 1,000 coins + 10% of their balance')}</div>
                    <button class="fl-btn on" style="margin-top:6px;" onclick="window.copyReferralLink()">${_tr('refCopyBtn', 'نسخ رابط الدعوة 🔗', 'Copy invite link 🔗')}</button>
                </div>`;
            list.innerHTML = head + (FL.invitees.length
                ? FL.invitees.map(i => inviteeRowHtml(i, ar)).join('')
                : `<div class="feed-empty">${_tr('refNoInvitees', 'لم تدعُ أحداً بعد', 'You haven\'t invited anyone yet')}</div>`);
            return;
        }
        const arr = FL[FL.tab] || [];
        if (sub) sub.textContent = FL.tab === 'followers'
            ? `${(FL.followers || []).length} ${tr('ui_followers_2', 'متابِعًا', 'followers')}`
            : `${FL.myFollowing.size} ${tr('ui_following_3', 'متابَعًا', 'following')}`;
        if (!arr.length) {
            list.innerHTML = `<div class="feed-empty">${FL.tab === 'followers' ? (tr('ui_no_followers_yet', 'لا يوجد متابعون بعد', 'No followers yet')) : (tr('ui_not_following_anyone_yet', 'لا تتابع أحداً بعد', 'Not following anyone yet'))}</div>`;
            return;
        }
        list.innerHTML = arr.map(uid => flRowHtml(uid, ar)).join('');
    }

    window.switchFollowTab = function (tab) {
        FL.tab = tab;
        paintFollowTabs();
        renderFollowList();
    };

    window.toggleFollowRow = async function (uid) {
        const c = db(), mine = String(US().userId || '');
        uid = String(uid);
        if (!c || !mine || uid === mine) return;
        if (FL.myFollowing.has(uid)) {
            const { error } = await c.from('user_follows').delete().eq('follower_id', mine).eq('following_id', uid);
            if (error) { alert(error.message); return; }
            FL.myFollowing.delete(uid);
        } else {
            const { error } = await c.from('user_follows').insert([{ follower_id: mine, following_id: uid }]);
            if (error && error.code !== '23505') { alert(error.message); return; }
            FL.myFollowing.add(uid);
            if (!FL.following.includes(uid)) FL.following.unshift(uid);
        }
        renderFollowList();
    };

    window.openFollowList = async function (tab) {
        if (document.getElementById('follow-page')) return;
        const ar = isAr();
        FL.tab = ['following', 'invitees'].includes(tab) ? tab : 'followers';
        const name = displayNameOf(S.draft || P.loadProfile(), ar);
        const ov = document.createElement('div');
        ov.id = 'follow-page';
        ov.className = 'fl-page';
        ov.dir = tr('ui_ltr', 'rtl', 'ltr');
        ov.innerHTML = `
            <div class="fl-top">
                <button class="fl-back" onclick="window.closeFollowList()">${tr('ui_text', '→', '←')}</button>
                <div><div class="fl-head-name">${esc(name)}</div><div class="fl-head-sub" id="fl-sub"></div></div>
            </div>
            <div class="fl-tabs">
                <button class="fl-tab" data-t="followers" onclick="window.switchFollowTab('followers')">${tr('ui_followers_3', 'متابعون', 'Followers')}</button>
                <button class="fl-tab" data-t="following" onclick="window.switchFollowTab('following')">${tr('ui_following_4', 'متابَعة', 'Following')}</button>
                <button class="fl-tab" data-t="invitees" onclick="window.switchFollowTab('invitees')">${_tr('refInviteesTab', 'المدعوون', 'Invitees')}</button>
            </div>
            <div class="fl-list" id="fl-list"><div class="feed-empty">${tr('ui_loading', 'جارٍ التحميل…', 'Loading…')}</div></div>`;
        document.body.appendChild(ov);
        paintFollowTabs();
        await loadFollowData();
        renderFollowList();
    };

    window.closeFollowList = function () {
        document.getElementById('follow-page')?.remove();
        // حدّث العدّادين في الملف الشخصي بالأرقام الحقيقية
        if (FL.followers !== null && S.draft) {
            S.draft.followers = FL.followers.length;
            S.draft.following = FL.myFollowing.size;
            if (typeof userState !== 'undefined') { userState.followers_count = S.draft.followers; userState.following_count = S.draft.following; }
        }
        if (S.mode === 'view') P.redraw();
    };
})();
