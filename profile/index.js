/* ============================================================
 * profile/index.js  —  الصفحة الرئيسية للملف (نقطة الدخول، يُحمَّل أخيراً)
 * يرسم الملف ويضيف تبويبات المنشورات، ويعرّف window.renderProfilePage
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, LS, esc, isAr, db, displayNameOf, avatarOf, clubLabel } = P;

    // حائط الملف (مثل X): شعار نادٍ في الوسط، أو ناديان يمين ويسار
    P.wallHtml = function (matched) {
        const src = c => c.banner || c.flag || c.logo || '';
        const bg = (c, side) => `<div class="wall-bg wall-${side}" style="background-image:url('${esc(src(c))}')"></div>`;
        const mark = (c, side) => `<img class="wall-mark wall-mark-${side}" src="${esc(src(c))}" onerror="this.style.display='none'" alt="">`;
        if (matched.length === 1) return bg(matched[0], 'full') + mark(matched[0], 'center');
        if (matched.length >= 2) return bg(matched[0], 'left') + bg(matched[1], 'right') + mark(matched[0], 'left') + mark(matched[1], 'right');
        return '<div class="wall-bg wall-full wall-empty"></div>';
    };

    function drawProfileBase(target) {
        if (S.mode === 'edit') return P.drawEdit(target);
        const ar = isAr();
        const d = S.draft;
        const matched = P.getMatchedClubs(d);
        const displayName = displayNameOf(d, ar);
        const avatarSrc = avatarOf(d, displayName);

        target.innerHTML = P.styles(ar) + `
            <div class="profile-wrap">
                <div class="profile-top">
                    <button class="back-btn" onclick="if(typeof window.showPage === 'function') window.showPage('home');">${ar ? '➔ الرئيسية' : '➔ Home'}</button>
                    <h3 class="page-title">${ar ? 'الملف الشخصي' : 'Profile'}</h3>
                    <div style="width:64px;"></div>
                </div>

                <div class="card hero">
                    <div class="wall">${P.wallHtml(matched)}</div>
                    <div class="hero-body">
                        <div class="avatar-stage">
                            <div class="avatar-box"><div class="avatar-ring"><div class="avatar-inner"><img src="${esc(avatarSrc)}" alt=""></div></div></div>
                        </div>
                        <h4 class="hero-name">${esc(displayName)}${window.zeloVerifiedBadge(d.badgeClub, 20)}</h4>
                        <div class="hero-user">${d.username && d.nickname ? '@' + esc(d.username) : ''}</div>
                        ${d.bio ? `<div class="hero-bio">${esc(d.bio).replace(/\n/g, '<br>')}</div>` : ''}
                        ${d.dob ? `<div class="hero-meta">🎂 ${esc(d.dob)}</div>` : ''}

                        <div class="stats">
                            <div><span class="stat-num" id="stat-invited">${d.invited.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'مدعوون' : 'Invited'}</span></div>
                            <div style="cursor:pointer;" onclick="window.openFollowList('followers')"><span class="stat-num">${d.followers.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'متابِعون' : 'Followers'}</span></div>
                            <div style="cursor:pointer;" onclick="window.openFollowList('following')"><span class="stat-num">${d.following.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'يتابِع' : 'Following'}</span></div>
                        </div>

                        <div class="hero-balance">${d.points.toLocaleString('en-US')} 🏆 ZELOFC</div>

                        <div class="x-btns">
                            <button class="x-btn" onclick="window.openEditProfile()">${ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</button>
                            <button class="x-btn" onclick="window.openShareSheet()">${ar ? 'مشاركة' : 'Share'}</button>
                        </div>
                        <button class="verify-btn" onclick="window.openBadgePicker()">
                            ${d.badgeClub ? '🔄 ' + (ar ? 'تغيير شارة التوثيق' : 'Change verified badge') : '✔️ ' + (ar ? 'وثّق حسابك بشارة ناديك' : 'Verify your account with your club badge')}
                        </button>
                    </div>
                </div>

            </div>`;
    }

    // غلاف: يرسم الملف ثم يضيف تبويبات المنشورات أسفله
    P.drawProfile = function (target) {
        drawProfileBase(target);
        if (S.mode !== 'view') return;
        const wrap = target.querySelector('.profile-wrap');
        if (wrap) wrap.insertAdjacentHTML('beforeend', P.feedSectionHtml(isAr()));
        P.loadFeed(false);
    };

    async function loadCounts() {
        const c = db();
        const uid = US().userId;
        if (!c || !uid || !S.draft) return;
        try {
            const rr = await c.from('club_fans_rankings').select('referrals_count').eq('user_id', String(uid));
            if (!rr.error && rr.data) {
                const total = rr.data.reduce((a, r) => Math.max(a, Number(r.referrals_count) || 0), 0);
                S.draft.invited = total;
                const el = document.getElementById('stat-invited'); if (el) el.textContent = total.toLocaleString('en-US');
            }
        } catch (e) {}
    }

    window.renderProfilePage = function (container) {
        S.currentTarget = container || document.getElementById('main-content') || document.body;
        Object.keys(P.feed.cache).forEach(k => delete P.feed.cache[k]); // تحديث المحتوى عند كل فتح للملف
        if (!S.currentTarget) return;
        S.mode = 'view';
        S.draft = P.loadProfile();
        P.drawProfile(S.currentTarget);
        loadCounts();

        const c = db();
        if (c && c.auth && typeof c.auth.getUser === 'function' && !S.draft.email) {
            c.auth.getUser().then(res => {
                const em = res && res.data && res.data.user && res.data.user.email;
                if (em && S.draft && S.mode === 'view') {
                    S.draft.email = em;
                    LS.set('zelo_email', em);
                    P.drawProfile(S.currentTarget);
                }
            }).catch(() => {});
        }
    };
})();
