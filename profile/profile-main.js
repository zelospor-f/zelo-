/* ###################################################################
 * profile-main.js = follow + share + edit + index (المتابعة والمشاركة والتعديل وصفحة الملف)
 * ################################################################### */
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
                ${window.zeloBackBtn('window.closeFollowList()')}
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

/* ============================================================
 * profile/share.js  —  مشاركة الملف الشخصي + شارة التوثيق + تسجيل الخروج
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, LS, esc, isAr, db, displayNameOf, avatarOf, clubLabel, openExternal } = P;

    // ===== نافذة المشاركة (مثل X) =====
    window.shareVia = function (kind) {
        const ar = isAr();
        const link = P.inviteLink();
        const name = displayNameOf(S.draft || P.loadProfile(), ar);
        const text = ar ? `${name} على Zelo Sport ⚽ انضم وشجّع فريقك` : `${name} on Zelo Sport ⚽ Join and support your team`;
        const u = encodeURIComponent(link), t = encodeURIComponent(text);
        document.getElementById('share-overlay')?.remove();
        if (kind === 'telegram') openExternal(`https://t.me/share/url?url=${u}&text=${t}`);
        else if (kind === 'whatsapp') openExternal(`https://wa.me/?text=${t}%20${u}`);
        else if (kind === 'x') openExternal(`https://twitter.com/intent/tweet?text=${t}&url=${u}`);
        else if (kind === 'messenger') openExternal(`fb-messenger://share?link=${u}`);
        else if (kind === 'copy') window.copyInvite();
        else if (navigator.share) navigator.share({ text, url: link }).catch(() => {});
        else window.copyInvite();
    };

    window.copyInvite = async function () {
        const l = P.inviteLink();
        try { await navigator.clipboard.writeText(l); }
        catch (e) { const t = document.createElement('textarea'); t.value = l; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
        alert(tr('ui_link_copied', 'تم نسخ الرابط ✅', 'Link copied ✅'));
    };

    window.openShareSheet = function () {
        const ar = isAr();
        const d = S.draft || P.loadProfile();
        const name = displayNameOf(d, ar);
        document.getElementById('share-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'share-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const ic = (kind, bg, glyph, label) => `
            <div onclick="window.shareVia('${kind}')" style="flex:0 0 auto;width:76px;text-align:center;cursor:pointer;">
                <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 6px auto;background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#fff;font-weight:900;">${glyph}</div>
                <div style="font-size:0.68rem;font-weight:700;color:#cbd5e1;">${label}</div>
            </div>`;
        ov.innerHTML = `
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${tr('ui_ltr', 'rtl', 'ltr')};background:#0a1033;border:1px solid rgba(245,195,90,0.3);border-radius:22px 22px 0 0;padding:10px 0 22px 0;color:#fff;">
                <div style="width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,0.25);margin:0 auto 14px auto;"></div>
                <div style="display:flex;align-items:center;gap:12px;padding:0 16px 14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <img src="${esc(avatarOf(d, name))}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">
                    <div style="min-width:0;">
                        <div style="font-weight:900;font-size:0.95rem;">${esc(name)}${window.zeloVerifiedBadge(d.badgeClub, 16)}</div>
                        <div style="font-size:0.74rem;color:#ffd98a;font-weight:700;direction:ltr;text-align:${tr('ui_left', 'right', 'left')};">${d.username ? '@' + esc(d.username) : ''}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;overflow-x:auto;padding:16px 12px 4px 12px;">
                    ${ic('telegram', '#2AABEE', '✈️', 'Telegram')}
                    ${ic('whatsapp', '#25D366', '💬', tr('ui_whatsapp', 'واتساب', 'WhatsApp'))}
                    ${ic('x', '#000', '𝕏', 'X')}
                    ${ic('messenger', '#0084ff', '🗨️', tr('ui_messenger', 'الدردشات', 'Messenger'))}
                    ${ic('copy', '#14206b', '🔗', tr('ui_copy_link', 'نسخ الرابط', 'Copy link'))}
                    ${ic('more', '#0a1033', '⋯', tr('ui_share_via', 'مشاركة عبر…', 'Share via…'))}
                </div>
            </div>`;
        document.body.appendChild(ov);
    };

    // ===== شارة التوثيق =====
    // الشارة تُفعَّل بالاشتراك عبر Google Play (premium.js) ويتحقق منها الخادم: غير المشترك يُحوَّل لصفحة الاشتراكات
    window.openBadgePicker = async function () {
        let pro = false;
        try { pro = !!(window.ZeloPremium && await window.ZeloPremium.isPremium()); } catch (e) {}
        if (!pro) {
            if (typeof window.openSubscriptions === 'function') window.openSubscriptions();
            return;
        }
        P.readInputsIntoDraft();
        const ar = isAr();
        const matched = P.getMatchedClubs(S.draft);
        if (!matched.length) {
            alert(tr('ui_select_a_club_first', 'اختر نادياً أولاً من شاشة اختيار الأندية', 'Select a club first'));
            return;
        }
        // نادٍ واحد فقط: تُعيَّن شارته تلقائياً بدون قائمة اختيار
        if (matched.length === 1) { window.applyBadge(String(matched[0].id)); return; }
        document.getElementById('badge-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'badge-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const opts = matched.map(c => `
            <div onclick="window.applyBadge('${esc(String(c.id))}')" style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;border-radius:14px;cursor:pointer;background:rgba(0,0,0,0.4);border:1px solid ${String(c.id) === S.draft.badgeClub ? '#f5c35a' : 'rgba(44,75,181,0.5)'};">
                <img src="${esc(c.logo)}" style="width:38px;height:38px;object-fit:contain;" onerror="this.style.display='none'">
                <span style="font-weight:800;font-size:0.9rem;color:#fff;">${esc(clubLabel(c))}</span>
            </div>`).join('');
        ov.innerHTML = `
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${tr('ui_ltr', 'rtl', 'ltr')};background:#0a1033;border:1px solid rgba(245,195,90,0.3);border-radius:20px 20px 0 0;padding:18px 16px 24px 16px;color:#fff;">
                <div style="font-weight:900;font-size:1rem;margin-bottom:4px;">✔️ ${tr('ui_verify_with_your_club', 'وثّق حسابك بشارة ناديك', 'Verify with your club badge')}</div>
                <div style="color:#9aa6d6;font-size:0.72rem;font-weight:700;margin-bottom:14px;">${tr('ui_choose_the_badge_shown', 'اختر الشارة التي تظهر بجانب اسمك في المنشورات', 'Choose the badge shown next to your name on posts')}</div>
                ${opts}
                <div onclick="window.applyBadge('')" style="text-align:center;padding:10px;color:#94a3b8;font-weight:800;font-size:0.8rem;cursor:pointer;">🚫 ${tr('ui_no_badge', 'بدون شارة', 'No badge')}</div>
            </div>`;
        document.body.appendChild(ov);
    };

    window.applyBadge = async function (id) {
        document.getElementById('badge-overlay')?.remove();
        P.readInputsIntoDraft();
        S.draft.badgeClub = String(id || '');
        LS.set('zelo_badge_club', S.draft.badgeClub);
        if (typeof userState !== 'undefined') userState.badgeClub = S.draft.badgeClub;
        const c = db();
        if (c && US().userId) {
            try {
                const { error } = await c.rpc('set_badge_club', { p_club: S.draft.badgeClub || '' });
                if (error) {
                    const m = /premium_required/.test(error.message) ? tr('ui_premium_required', 'الشارة متاحة للمشتركين فقط', 'Badge is for subscribers only') : error.message;
                    S.draft.badgeClub = ''; LS.set('zelo_badge_club', '');
                    if (typeof userState !== 'undefined') userState.badgeClub = '';
                    alert(m);
                }
            } catch (e) { console.error(e); }
        }
        P.redraw();
    };

    // ===== تسجيل الخروج =====
    window.logoutUser = async function () {
        const ar = isAr();
        if (!confirm(tr('ui_log_out', 'هل تريد تسجيل الخروج؟', 'Log out?'))) return;
        const c = db();
        try { if (c && c.auth) await c.auth.signOut(); } catch (e) {}
        try {
            const lang = localStorage.getItem('app_lang');
            Object.keys(localStorage).filter(k => k.startsWith('zelo_')).forEach(k => localStorage.removeItem(k));
            if (lang) localStorage.setItem('app_lang', lang);
        } catch (e) {}
        location.reload();
    };
})();

/* ============================================================
 * profile/edit.js  —  صفحة تعديل الملف الشخصي (مثل X) + الحفظ
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, LS, esc, isAr, db, displayNameOf, avatarOf, clubLabel } = P;

    P.drawEdit = function (target) {
        const ar = isAr();
        const d = S.draft;
        const matched = P.getMatchedClubs(d);
        const displayName = displayNameOf(d, ar);
        const avatarSrc = avatarOf(d, displayName);
        const badgeClub = matched.find(c => String(c.id) === d.badgeClub);

        target.innerHTML = P.styles(ar) + `
            <div class="profile-wrap">
                <div class="edit-top">
                    ${window.zeloBackBtn('window.closeEditProfile()')}
                    <div class="edit-title">${tr('ui_edit_profile', 'تعديل الملف الشخصي', 'Edit profile')}</div>
                    <button class="edit-save" onclick="window.saveProfileData()">${tr('ui_save', 'حفظ', 'Save')}</button>
                </div>

                <div class="card hero">
                    <div class="wall">${P.wallHtml(matched)}</div>
                    <div class="hero-body">
                        <div class="avatar-stage">
                            <div class="avatar-box">
                                <div class="avatar-ring"><div class="avatar-inner"><img src="${esc(avatarSrc)}" alt=""></div></div>
                                <button class="avatar-cam" onclick="window.openNftStore()" title="${tr('ui_upload_photo', 'تحميل صورة', 'Upload photo')}">📷</button>
                            </div>
                        </div>
                        ${d.photoUrl ? `<button class="small-btn" onclick="window.resetAvatar()">${tr('ui_remove_photo', 'إزالة الصورة', 'Remove photo')}</button>` : ''}
                        <div class="acc-note">${tr('ui_the_wall_follows_your', 'الحائط يتغير تلقائياً حسب ناديك. للصورة: اضغط 📷 لشراء بطاقة NFT.', 'The wall follows your club. Tap 📷 to buy an NFT card as your photo.')}</div>
                    </div>
                </div>

                <div class="x-field">
                    <label>${tr('ui_nickname', 'الاسم المستعار', 'Nickname')}</label>
                    <input id="input-nick" maxlength="30" value="${esc(d.nickname)}" placeholder="${tr('ui_your_display_name', 'اسمك الذي يظهر للآخرين', 'Your display name')}">
                </div>
                <div class="x-field">
                    <label>${tr('ui_bio', 'النبذة التعريفية', 'Bio')}</label>
                    <textarea id="input-bio" placeholder="${tr('ui_write_something_about_yourself', 'اكتب نبذة قصيرة عنك...', 'Write something about yourself...')}">${esc(d.bio)}</textarea>
                </div>
                <div class="x-field">
                    <label>${tr('ui_date_of_birth', 'تاريخ الميلاد', 'Date of Birth')}</label>
                    <input id="input-dob" type="date" value="${esc(d.dob)}">
                </div>
                <div class="x-field x-row" onclick="window.openBadgePicker()">
                    <div>
                        <label>${tr('ui_verified_badge', 'شارة التوثيق', 'Verified badge')}</label>
                        <div class="val">${badgeClub ? `<img src="${esc(badgeClub.logo)}" style="width:22px;height:22px;object-fit:contain;"> ${esc(clubLabel(badgeClub))}` : (tr('ui_no_badge', 'بدون شارة', 'No badge'))}</div>
                    </div>
                    <span class="arrow">${tr('ui_text_3', '‹', '›')}</span>
                </div>
                <div style="height:30px;"></div>
            </div>`;
    };

    // ===== التنقل بين العرض والتعديل =====
    window.openEditProfile = function () { S.mode = 'edit'; P.redraw(); window.scrollTo && window.scrollTo(0, 0); };

    window.closeEditProfile = function () {
        const inv = S.draft ? S.draft.invited : 0;
        S.draft = P.loadProfile();
        S.draft.invited = inv;
        S.mode = 'view';
        P.redraw();
    };

    window.openNftStore = function () {
        P.readInputsIntoDraft();
        if (typeof window.renderNftMarketPage === 'function') window.renderNftMarketPage(S.currentTarget);
        else alert(tr('ui_nft_page_is_not', 'صفحة NFT غير محمّلة', 'NFT page is not loaded'));
    };

    window.resetAvatar = function () {
        P.readInputsIntoDraft();
        S.draft.photoUrl = '';
        P.redraw();
    };

    // ===== حفظ التعديلات =====
    window.saveProfileData = async function () {
        P.readInputsIntoDraft();
        const ar = isAr();
        const draft = S.draft;

        const hasArabic = /[؀-ۿ]/.test(draft.nickname);
        const nickAr = hasArabic ? draft.nickname : '';
        const nickEn = hasArabic ? '' : draft.nickname;

        LS.set('zelo_nickname_ar', nickAr);
        LS.set('zelo_nickname_en', nickEn);
        LS.set('zelo_dob', draft.dob);
        LS.set('zelo_bio', draft.bio);
        LS.set('zelo_photo_url', draft.photoUrl);
        LS.set('zelo_badge_club', draft.badgeClub || '');

        if (typeof userState !== 'undefined') {
            Object.assign(userState, {
                nickname_ar: nickAr,
                nickname_en: nickEn,
                dob: draft.dob,
                bio: draft.bio,
                photoUrl: draft.photoUrl,
                badgeClub: draft.badgeClub || ''
            });
        }

        let dbOk = true, dbMsg = '';
        const c = db();
        if (c && US().userId) {
            const { error } = await c.from('users').upsert({
                user_id: String(US().userId),
                nickname_ar: nickAr || null,
                nickname_en: nickEn || null,
                bio: draft.bio || null,
                dob: draft.dob || null,
                photo_url: draft.photoUrl || null
            }, { onConflict: 'user_id' });
            if (error) { dbOk = false; dbMsg = error.message; console.error('profile save error', error); }
        }

        alert(dbOk
            ? (tr('ui_profile_saved_successfully', 'تم حفظ الملف الشخصي بنجاح ✅', 'Profile saved successfully ✅'))
            : ((tr('ui_saved_locally_database_rejected_2', 'تم الحفظ محلياً، لكن قاعدة البيانات رفضت: ', 'Saved locally, database rejected: ')) + dbMsg));
        S.mode = 'view';
        P.redraw();
    };
})();

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
        const V = !!S.viewUid; // عرض ملف شخص آخر بنفس التصميم
        const matched = P.getMatchedClubs(d);
        const displayName = displayNameOf(d, ar);
        const avatarSrc = avatarOf(d, displayName);

        target.innerHTML = P.styles(ar) + `
            <div class="profile-wrap">
                <div class="profile-top">
                    ${window.zeloBackBtn(V ? "window.closeUserProfile()" : "if(typeof window.showPage === 'function') window.showPage('home');")}
                </div>

                ${(!V && window.zeloBanNoteHtml) ? window.zeloBanNoteHtml() : ''}
                <div class="pp">
                    <div class="wall pp-wall">${P.wallHtml(matched)}</div>
                    <div class="pp-head">
                        <div class="pp-av"><div><img src="${esc(avatarSrc)}" alt=""></div></div>
                        <div class="pp-id">
                            <h4 class="pp-name"><span>${esc(displayName)}</span>${window.zeloVerifiedBadge(d.badgeClub, 20)}</h4>
                            <div class="pp-user">${d.username && (d.nickname || V) ? '\u200E@' + esc(d.username) : ''}</div>
                        </div>
                    </div>

                    <div class="pp-stats">
                        <div class="pp-stat${V ? '' : ' tap'}" ${V ? '' : `onclick="window.openFollowList('following')"`}><b><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5"/><path d="M16 11.5l2 2 3.5-3.5"/></svg>${d.following.toLocaleString('en-US')}</b><span>${tr('ui_following', 'يتابِع', 'Following')}</span></div>
                        <div class="pp-stat${V ? '' : ' tap'}" ${V ? '' : `onclick="window.openFollowList('followers')"`}><b><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5"/><path d="M18.5 8v6M15.5 11h6"/></svg><i id="pc-nfollowers" style="font-style:normal;">${d.followers.toLocaleString('en-US')}</i></b><span>${tr('ui_followers', 'متابِعون', 'Followers')}</span></div>
                        ${V ? `<div class="pp-stat"><b><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>${Number(d.posts || 0).toLocaleString('en-US')}</b><span>${tr('ui_posts_count', 'منشور', 'Posts')}</span></div>` : `<div class="pp-stat"><b><svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="2"/><path d="M12 9v11M3 13h18"/><path d="M12 9c-2.5 0-4-1-4-2.5S9.5 4 11 5c.8.6 1 2 1 4zM12 9c2.5 0 4-1 4-2.5S14.5 4 13 5c-.8.6-1 2-1 4z"/></svg><i id="stat-invited" style="font-style:normal;">${d.invited.toLocaleString('en-US')}</i></b><span>${tr('ui_invited', 'مدعوون', 'Invited')}</span></div>`}
                    </div>

                    ${d.bio ? `<div class="pp-bio">${esc(d.bio).replace(/\n/g, '<br>')}</div>` : ''}
                    ${(!V && d.dob) ? `<div class="pp-meta">🎂 ${esc(d.dob)}</div>` : ''}

                    ${V ? `<div class="pp-btns">
                        <button class="pp-btn" id="pc-msg"><svg viewBox="0 0 24 24"><path d="M21 11.5c0 4.14-3.8 7.5-8.5 7.5-.9 0-1.8-.12-2.6-.35L5 21l1.4-3.6C5.5 16.3 4.5 14.5 4.5 12.5 4.5 8.36 8.3 5 13 5s8 3.36 8 6.5z"/></svg>${tr('ui_message', 'رسالة', 'Message')}</button>
                        <button class="pp-btn" id="pc-follow"></button>
                    </div>` : `<div class="pp-btns">
                        <button class="pp-btn" onclick="window.openEditProfile()"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>${tr('ui_edit_profile', 'تعديل الملف الشخصي', 'Edit profile')}</button>
                        <button class="pp-btn" onclick="window.openShareSheet()"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>${tr('ui_share', 'مشاركة', 'Share')}</button>
                    </div>

                    <div class="pp-short">
                        <button class="pp-sc" onclick="window.openStorePage && window.openStorePage()"><svg viewBox="0 0 24 24"><path d="M4 9l1.5-5h13L20 9"/><path d="M5 9v11h14V9"/><path d="M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0"/></svg>${tr('pp_store', 'المتجر', 'Store')}</button>
                        <button class="pp-sc" onclick="(function(){var c=typeof supabaseClient!=='undefined'?supabaseClient:null;if(window.openWithdrawWallet&&c)window.openWithdrawWallet(c);})()"><svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.2"/></svg>${tr('pp_wallet', 'محفظتي', 'Wallet')}</button>
                        <button class="pp-sc" onclick="window.openSubscriptions && window.openSubscriptions()"><svg viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/></svg>${tr('pp_sub', 'الاشتراك', 'Premium')}</button>
                        <button class="pp-sc" onclick="window.openNftStore()"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 14l3-5 3 5-3 3-3-3z"/></svg>${tr('pp_nft', 'بطاقات NFT', 'NFT cards')}</button>
                    </div>

                    <div id="pp-verify-slot"></div>`}
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
        if (S.viewUid) wireOther(); else mountVerifyBtn();
    };

    // زر اختيار/تبديل شارة النادي: للمشتركين فقط (غير المشتركين يرون بطاقة الاشتراك أسفل الصفحة)
    async function mountVerifyBtn() {
        const slot = document.getElementById('pp-verify-slot');
        const d = S.draft;
        if (!slot || !d) return;
        const matched = P.getMatchedClubs(d);
        const html = label => `<button class="verify-btn" onclick="window.openBadgePicker()">${label}</button>`;
        if (d.badgeClub) {
            if (matched.length > 1) slot.innerHTML = html('🔄 ' + tr('ui_switch_badge', 'تبديل شارة النادي', 'Switch club badge'));
            return;
        }
        try {
            const pro = window.ZeloPremium && await window.ZeloPremium.isPremium();
            const s2 = document.getElementById('pp-verify-slot');
            if (pro && s2 && S.draft === d) s2.innerHTML = html('✔️ ' + tr('ui_verify_your_account_with', 'وثّق حسابك بشارة ناديك', 'Verify your account with your club badge'));
        } catch (e) {}
    }

    // ===== عرض ملف مستخدم آخر بنفس الملف الأساسي (بدل النسخة المبسطة) =====
    function wireOther() {
        const o = S.other; if (!o) return;
        const fb = document.getElementById('pc-follow'), mb = document.getElementById('pc-msg');
        const paint = f => {
            if (!fb) return;
            fb.textContent = f ? tr('ui_following_btn', 'متابَع', 'Following') : tr('ui_follow', 'متابعة', 'Follow');
            fb.style.cssText = f ? '' : 'background:#f5c35a;color:#0a1033;border-color:#f5c35a;';
        };
        paint(o.followed);
        if (fb) fb.onclick = async () => {
            const was = !!o.followed;
            const now = await o.onFollow();
            if (now === was) return;
            o.followed = now; paint(now);
            const el = document.getElementById('pc-nfollowers');
            if (el) el.textContent = Math.max(0, (parseInt(String(el.textContent).replace(/,/g, ''), 10) || 0) + (now ? 1 : -1)).toLocaleString('en-US');
        };
        if (mb) mb.onclick = () => o.onMessage();
    }

    P.showOther = function (container, o) {
        if (!S.otherSnap) {
            const snap = { draft: S.draft, target: S.currentTarget, mode: S.mode, tab: P.feed.tab, hadProfile: false };
            const t = S.currentTarget;
            // صفحة ملفي مفتوحة تحتها؟ نُفرغها مؤقتاً كي لا تتكرر المعرّفات، وتُعاد رسمها عند الإغلاق
            if (t && t !== container && t.querySelector && t.querySelector('.profile-wrap')) { snap.hadProfile = true; t.innerHTML = ''; }
            S.otherSnap = snap;
        }
        const r = o.row || {};
        S.viewUid = String(o.uid);
        S.other = o;
        S.mode = 'view';
        S.currentTarget = container;
        container.style.boxSizing = 'border-box'; container.style.overflowX = 'hidden';
        container.style.padding = 'calc(14px + env(safe-area-inset-top, 0px)) 15px 40px';
        S.draft = {
            nickname: r.nickname_ar || r.nickname_en || '',
            username: r.username || '',
            dob: '', bio: r.bio || '', photoUrl: r.photo_url || '',
            selectedClubs: (r.selected_clubs || []).map(String),
            points: 0, invited: 0, email: '', badgeClub: String(r.badge_club || ''),
            followers: Number(o.followers) || 0, following: Number(o.following) || 0, posts: Number(o.posts) || 0
        };
        P.feed.tab = 'posts';
        Object.keys(P.feed.cache).forEach(k => delete P.feed.cache[k]);
        P.drawProfile(container);
    };

    P.endOther = function () {
        const snap = S.otherSnap;
        if (!snap) return;
        S.otherSnap = null; S.viewUid = null; S.other = null;
        S.draft = snap.draft; S.currentTarget = snap.target; S.mode = snap.mode;
        P.feed.tab = snap.tab;
        Object.keys(P.feed.cache).forEach(k => delete P.feed.cache[k]);
        if (snap.hadProfile && snap.target && snap.draft) P.drawProfile(snap.target);
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
        S.viewUid = null; S.other = null; S.otherSnap = null;
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

