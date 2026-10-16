/* ============================================================
 * profile/follow.js  —  المتابعون / المتابَعون (مثل X)
 * (هنا سنضيف تبويب "المدعوون" في المرحلة التالية)
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, esc, isAr, db, displayNameOf, avatarOf } = P;

    const FL = { tab: 'followers', followers: null, following: null, myFollowing: new Set(), myFollowers: new Set(), profiles: {}, error: '' };

    async function loadFollowData() {
        const c = db(), uid = String(US().userId || '');
        FL.error = '';
        if (!c || !uid) { FL.error = isAr() ? 'لا يوجد اتصال بقاعدة البيانات' : 'No database connection'; return; }
        const [a, b] = await Promise.all([
            c.from('user_follows').select('follower_id,created_at').eq('following_id', uid).order('created_at', { ascending: false }).limit(200),
            c.from('user_follows').select('following_id,created_at').eq('follower_id', uid).order('created_at', { ascending: false }).limit(200)
        ]);
        if (a.error || b.error) { FL.error = (a.error || b.error).message; return; }
        FL.followers = (a.data || []).map(r => String(r.follower_id));
        FL.following = (b.data || []).map(r => String(r.following_id));
        FL.myFollowers = new Set(FL.followers);
        FL.myFollowing = new Set(FL.following);
        const ids = [...new Set([...FL.followers, ...FL.following])];
        if (ids.length) {
            try {
                const r = await c.from('public_profiles').select('*').in('user_id', ids);
                (r.data || []).forEach(u => FL.profiles[String(u.user_id)] = u);
            } catch (e) {}
        }
    }

    function flRowHtml(uid, ar) {
        const u = FL.profiles[uid] || {};
        const name = u.nickname_ar || u.nickname_en || u.display_name || u.username || (ar ? 'لاعب' : 'Player');
        const photo = u.photo_url || avatarOf({ photoUrl: '' }, name);
        const followed = FL.myFollowing.has(uid);
        const followsMe = FL.myFollowers.has(uid);
        const label = followed ? (ar ? 'مُتابَع' : 'Following') : (followsMe ? (ar ? 'ردّ المتابعة' : 'Follow back') : (ar ? 'تابِع' : 'Follow'));
        return `
            <div class="fl-row">
                <img class="fl-av" src="${esc(photo)}" onerror="this.style.visibility='hidden'" alt="">
                <div class="fl-main">
                    ${followsMe ? `<div class="fl-tag">👤 ${ar ? 'يتابعك' : 'Follows you'}</div>` : ''}
                    <div class="fl-name">${esc(name)}${window.zeloVerifiedBadge(u.badge_club, 16)}</div>
                    ${u.username ? `<div class="fl-user">@${esc(u.username)}</div>` : ''}
                    ${u.bio ? `<div class="fl-bio">${esc(String(u.bio).slice(0, 120))}</div>` : ''}
                </div>
                <button class="fl-btn ${followed ? 'on' : ''}" onclick="window.toggleFollowRow('${esc(uid)}')">${label}</button>
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
        if (FL.error) { list.innerHTML = `<div class="feed-empty">${ar ? 'تعذّر التحميل' : 'Could not load'}<br><small style="direction:ltr;display:block;margin-top:6px;">${esc(FL.error)}</small></div>`; return; }
        const arr = FL[FL.tab] || [];
        if (sub) sub.textContent = FL.tab === 'followers'
            ? `${(FL.followers || []).length} ${ar ? 'متابِعًا' : 'followers'}`
            : `${FL.myFollowing.size} ${ar ? 'متابَعًا' : 'following'}`;
        if (!arr.length) {
            list.innerHTML = `<div class="feed-empty">${FL.tab === 'followers' ? (ar ? 'لا يوجد متابعون بعد' : 'No followers yet') : (ar ? 'لا تتابع أحداً بعد' : 'Not following anyone yet')}</div>`;
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
        FL.tab = tab === 'following' ? 'following' : 'followers';
        const name = displayNameOf(S.draft || P.loadProfile(), ar);
        const ov = document.createElement('div');
        ov.id = 'follow-page';
        ov.className = 'fl-page';
        ov.dir = ar ? 'rtl' : 'ltr';
        ov.innerHTML = `
            <div class="fl-top">
                <button class="fl-back" onclick="window.closeFollowList()">${ar ? '→' : '←'}</button>
                <div><div class="fl-head-name">${esc(name)}</div><div class="fl-head-sub" id="fl-sub"></div></div>
            </div>
            <div class="fl-tabs">
                <button class="fl-tab" data-t="followers" onclick="window.switchFollowTab('followers')">${ar ? 'متابعون' : 'Followers'}</button>
                <button class="fl-tab" data-t="following" onclick="window.switchFollowTab('following')">${ar ? 'متابَعة' : 'Following'}</button>
            </div>
            <div class="fl-list" id="fl-list"><div class="feed-empty">${ar ? 'جارٍ التحميل…' : 'Loading…'}</div></div>`;
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
