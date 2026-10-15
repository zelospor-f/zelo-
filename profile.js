(function() {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const isAr = () => String(US().lang || LS.get('app_lang') || 'ar').startsWith('ar');
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

    let draft = null;
    let currentTarget = null;
    let mode = 'view'; // 'view' | 'edit'

    function loadProfile() {
        const u = US();
        const rawUser = u.username || LS.get('zelo_username') || '';
        return {
            nickname_ar: u.nickname_ar || LS.get('zelo_nickname_ar') || '',
            nickname_en: u.nickname_en || LS.get('zelo_nickname_en') || '',
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
    }

    function readInputsIntoDraft() {
        if (!draft) return;
        const g = id => document.getElementById(id);
        if (g('input-nick-ar')) draft.nickname_ar = g('input-nick-ar').value.trim();
        if (g('input-nick-en')) draft.nickname_en = g('input-nick-en').value.trim();
        if (g('input-username')) draft.username = g('input-username').value.trim();
        if (g('input-dob')) draft.dob = g('input-dob').value;
        if (g('input-bio')) draft.bio = g('input-bio').value;
        if (g('input-email')) draft.emailInput = g('input-email').value.trim();
    }

    function getMatchedClubs(d) {
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
    }

    const clubLabel = c => typeof getClubName === 'function' ? getClubName(c) : c.name;

    // شارة التوثيق = شعار النادي الذي اختاره المستخدم (badge_club)
    // window.zeloVerifiedBadge(user.badge_club, 16) -> HTML أو '' إن لم يختر شارة
    window.zeloVerifiedBadge = function(badgeClubId, size) {
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
    function inviteLink() {
        try { if (typeof window.getReferralLink === 'function') { const l = window.getReferralLink(); if (l) return l; } } catch (e) {}
        return 'https://t.me/Zelo_Sport_bot?start=' + encodeURIComponent(String(US().userId || ''));
    }

    function displayNameOf(d, ar) {
        return ar ? (d.nickname_ar || d.nickname_en || 'لاعب جديد') : (d.nickname_en || d.nickname_ar || 'New Player');
    }
    function avatarOf(d, name) {
        return d.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0c0e20&color=00FF87&size=128&bold=true`;
    }

    // حائط الملف (مثل X): شعار نادٍ في الوسط، أو ناديان يمين ويسار
    function wallHtml(matched) {
        const src = c => c.banner || c.flag || c.logo || '';
        const bg = (c, side) => `<div class="wall-bg wall-${side}" style="background-image:url('${esc(src(c))}')"></div>`;
        const mark = (c, side) => `<img class="wall-mark wall-mark-${side}" src="${esc(src(c))}" onerror="this.style.display='none'" alt="">`;
        if (matched.length === 1) return bg(matched[0], 'full') + mark(matched[0], 'center');
        if (matched.length >= 2) return bg(matched[0], 'left') + bg(matched[1], 'right') + mark(matched[0], 'left') + mark(matched[1], 'right');
        return '<div class="wall-bg wall-full wall-empty"></div>';
    }

    function styles(ar) {
        const dir = ar ? 'rtl' : 'ltr';
        const align = ar ? 'right' : 'left';
        return `
        <style>
            .profile-wrap { width: 100%; box-sizing: border-box; padding: 4px 0 20px 0; direction: ${dir}; color: #fff; text-align: ${align}; }
            .profile-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
            .back-btn { background: rgba(255,255,255,0.08); color: #00FF87; border: 1px solid rgba(0,255,135,0.25); padding: 8px 14px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
            .page-title { margin: 0; font-size: 1.05rem; font-weight: 900; background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: linear-gradient(135deg, rgba(20,22,48,0.95), rgba(12,14,32,0.95)); border: 1px solid rgba(90,110,255,0.35); border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: 0 0 12px rgba(80,100,255,0.12); }
            .card-title { color: #fff; font-size: 0.9rem; font-weight: 900; margin: 0 0 12px 0; }
            .hero { padding: 0; overflow: hidden; }
            .wall { position: relative; height: 120px; overflow: hidden; background: #0c0e20; }
            .wall-bg { position: absolute; top: 0; bottom: 0; background-size: cover; background-position: center; filter: blur(14px) saturate(1.3) brightness(0.8); transform: scale(1.3); }
            .wall-full { left: 0; right: 0; }
            .wall-left { left: 0; width: 50%; }
            .wall-right { right: 0; width: 50%; }
            .wall-empty { background: linear-gradient(135deg, #1b2a6b, #0c0e20 60%, #0b3d2e); filter: none; transform: none; }
            .wall-mark { position: absolute; top: 12px; height: 76px; width: 76px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55)); z-index: 1; }
            .wall-mark-center { left: 50%; margin-left: -38px; height: 90px; width: 90px; top: 6px; }
            .wall-mark-left { left: 16%; }
            .wall-mark-right { right: 16%; }
            .hero-body { padding: 0 14px 14px 14px; }
            .avatar-stage { position: relative; z-index: 3; margin-top: -44px; margin-bottom: 8px; display: flex; justify-content: flex-start; }
            .avatar-box { position: relative; width: 88px; height: 88px; }
            .avatar-ring { width: 100%; height: 100%; border-radius: 50%; padding: 3px; box-sizing: border-box; background: linear-gradient(135deg, #2AABEE, #8B5CF6, #00FF87); box-shadow: 0 0 18px rgba(42,171,238,0.4); }
            .avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0c0e20; border: 2px solid #0c0e20; }
            .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
            .avatar-cam { position: absolute; inset: 3px; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; border: none; color: #fff; }
            .hero-name { font-size: 1.1rem; font-weight: 900; margin: 0; }
            .hero-user { font-size: 0.78rem; color: #7CF7C4; font-weight: 700; margin-top: 3px; direction: ltr; text-align: ${align}; }
            .hero-bio { font-size: 0.84rem; color: #e2e8f0; line-height: 1.6; margin-top: 10px; word-break: break-word; }
            .hero-meta { font-size: 0.72rem; color: #7a7f9a; font-weight: 700; margin-top: 8px; }
            .stats { display: flex; gap: 22px; margin-top: 12px; }
            .stat-num { font-size: 0.98rem; font-weight: 900; color: #fff; display: inline; }
            .stat-lbl { font-size: 0.74rem; font-weight: 700; color: #7a7f9a; display: inline; margin: 0 4px; }
            .hero-balance { display: inline-block; margin-top: 12px; font-size: 0.8rem; font-weight: 900; background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .x-btns { display: flex; gap: 10px; margin-top: 14px; }
            .x-btn { flex: 1; cursor: pointer; background: transparent; color: #fff; font-weight: 900; font-size: 0.86rem; padding: 10px; border-radius: 22px; border: 1px solid rgba(255,255,255,0.3); }
            .x-btn:active { background: rgba(255,255,255,0.08); }
            .verify-btn { margin-top: 10px; cursor: pointer; border: 1px solid rgba(0,255,135,0.45); background: rgba(0,255,135,0.1); color: #00FF87; font-weight: 900; font-size: 0.76rem; padding: 7px 14px; border-radius: 20px; }
            .small-btn { margin-top: 8px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 0.72rem; font-weight: 800; padding: 5px 12px; border-radius: 10px; }
            .club-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; background: rgba(0,0,0,0.35); border: 1px solid rgba(90,110,255,0.25); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; }
            .club-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .club-logo-box { width: 40px; height: 40px; min-width: 40px; border-radius: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; }
            .club-name { color: #fff; font-weight: 800; font-size: 0.84rem; }
            .club-sub { color: #7a7f9a; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
            .chip { font-size: 0.66rem; font-weight: 900; color: #04110B; background: linear-gradient(135deg, #00FF87, #14B8A6); padding: 5px 9px; border-radius: 8px; white-space: nowrap; }
            .empty-box { text-align: center; padding: 14px; color: #94a3b8; font-size: 0.8rem; font-weight: 700; border: 1px dashed rgba(90,110,255,0.4); border-radius: 12px; }
            .input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45); border: 1px solid rgba(90,110,255,0.3); border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 0.86rem; font-weight: 700; outline: none; }
            .acc-row { display: flex; gap: 8px; align-items: center; }
            .acc-btn { border: none; cursor: pointer; white-space: nowrap; font-weight: 900; font-size: 0.78rem; padding: 11px 14px; border-radius: 12px; color: #04110B; background: linear-gradient(135deg, #2AABEE, #00FF87); }
            .acc-note { font-size: 0.68rem; font-weight: 700; margin-top: 6px; color: #7a7f9a; }
            .linked-ok { color: #00FF87; }
            .label { display: block; font-size: 0.7rem; font-weight: 800; color: #7a7f9a; margin-bottom: 6px; }
            .group { margin-bottom: 12px; }
            .logout-btn { width: 100%; margin-top: 4px; cursor: pointer; font-weight: 900; font-size: 0.88rem; padding: 12px; border-radius: 14px; color: #ff6b6b; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.35); }
            /* صفحة التعديل (مثل X) */
            .edit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
            .edit-title { font-size: 1rem; font-weight: 900; }
            .edit-save { border: none; cursor: pointer; background: #fff; color: #000; font-weight: 900; font-size: 0.82rem; padding: 8px 18px; border-radius: 20px; }
            .x-field { border-bottom: 1px solid rgba(255,255,255,0.14); padding: 12px 2px; }
            .x-field label { display: block; font-size: 0.72rem; font-weight: 800; color: #7a7f9a; margin-bottom: 4px; }
            .x-field input, .x-field textarea { width: 100%; box-sizing: border-box; background: transparent; border: none; outline: none; color: #fff; font-size: 0.96rem; font-weight: 600; padding: 4px 0; font-family: inherit; }
            .x-field textarea { resize: none; height: 78px; }
            .x-field:focus-within { border-bottom-color: #00FF87; }
            .x-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
            .x-row .val { color: #fff; font-size: 0.92rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
            .x-row .arrow { color: #7a7f9a; }
        </style>`;
    }

    function drawProfile(target) {
        if (mode === 'edit') return drawEdit(target);
        const ar = isAr();
        const d = draft;
        const matched = getMatchedClubs(d);
        const displayName = displayNameOf(d, ar);
        const avatarSrc = avatarOf(d, displayName);

        const clubsHtml = matched.length
            ? matched.map(club => `
                <div class="club-row">
                    <div class="club-main">
                        <div class="club-logo-box"><img src="${esc(club.logo)}" onerror="this.style.display='none'" style="width:28px;height:28px;object-fit:contain;"></div>
                        <div style="min-width:0;">
                            <div class="club-name">${esc(clubLabel(club))}</div>
                            <div class="club-sub">${esc(club.countryFlag || '')} ${ar ? 'قاعدة مشجعين' : 'Fan Base'}</div>
                        </div>
                    </div>
                    <span class="chip">${ar ? 'مدعوم' : 'Supported'}</span>
                </div>`).join('')
            : `<div class="empty-box">${ar ? 'لم يتم تحديد أندية بعد' : 'No clubs selected yet'}</div>`;

        const emailLinked = !!d.email;

        target.innerHTML = styles(ar) + `
            <div class="profile-wrap">
                <div class="profile-top">
                    <button class="back-btn" onclick="if(typeof window.showPage === 'function') window.showPage('home');">${ar ? '➔ الرئيسية' : '➔ Home'}</button>
                    <h3 class="page-title">${ar ? 'الملف الشخصي' : 'Profile'}</h3>
                    <div style="width:64px;"></div>
                </div>

                <div class="card hero">
                    <div class="wall">${wallHtml(matched)}</div>
                    <div class="hero-body">
                        <div class="avatar-stage">
                            <div class="avatar-box"><div class="avatar-ring"><div class="avatar-inner"><img src="${esc(avatarSrc)}" alt=""></div></div></div>
                        </div>
                        <h4 class="hero-name">${esc(displayName)}${window.zeloVerifiedBadge(d.badgeClub, 20)}</h4>
                        <div class="hero-user">${d.username ? '@' + esc(d.username) : ''}</div>
                        ${d.bio ? `<div class="hero-bio">${esc(d.bio).replace(/\n/g, '<br>')}</div>` : ''}
                        ${d.dob ? `<div class="hero-meta">🎂 ${esc(d.dob)}</div>` : ''}

                        <div class="stats">
                            <div><span class="stat-num" id="stat-invited">${d.invited.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'مدعوون' : 'Invited'}</span></div>
                            <div><span class="stat-num">${d.followers.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'متابِعون' : 'Followers'}</span></div>
                            <div><span class="stat-num">${d.following.toLocaleString('en-US')}</span><span class="stat-lbl">${ar ? 'يتابِع' : 'Following'}</span></div>
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

                <div class="card">
                    <div class="card-title">⚽ ${ar ? 'أنديتك المختارة' : 'Your Selected Clubs'}</div>
                    ${clubsHtml}
                </div>

                <div class="card">
                    <div class="card-title">🔗 ${ar ? 'رابط الدعوة' : 'Invite Link'}</div>
                    <div class="input" dir="ltr" style="font-size:0.74rem;word-break:break-all;margin-bottom:10px;">${esc(inviteLink())}</div>
                    <div class="acc-row">
                        <button class="acc-btn" style="flex:1;" onclick="window.copyInvite()">📋 ${ar ? 'نسخ' : 'Copy'}</button>
                        <button class="acc-btn" style="flex:1;" onclick="window.openShareSheet()">📤 ${ar ? 'مشاركة' : 'Share'}</button>
                    </div>
                    <div class="acc-note">${ar ? 'كل صديق يسجّل عبر رابطك يُحتسب ضمن المدعوين' : 'Every friend who joins via your link counts as invited'}</div>
                </div>

                <div class="card">
                    <div class="card-title">🔐 ${ar ? 'الحساب' : 'Account'}</div>
                    <div class="group">
                        <label class="label">${ar ? 'البريد الإلكتروني' : 'Email'}</label>
                        <div class="input" dir="ltr" style="font-size:0.84rem;">${esc(d.email || '—')}</div>
                        <div class="acc-note ${d.email ? 'linked-ok' : ''}">${d.email ? (ar ? '✅ مسجَّل الدخول بهذا البريد' : '✅ Signed in with this email') : ''}</div>
                    </div>
                    <button class="logout-btn" onclick="window.logoutUser()">🚪 ${ar ? 'تسجيل الخروج' : 'Log out'}</button>
                </div>
                <div style="height:20px;"></div>
            </div>`;
    }

    // ===== صفحة تعديل الملف الشخصي (مثل X) =====
    function drawEdit(target) {
        const ar = isAr();
        const d = draft;
        const matched = getMatchedClubs(d);
        const displayName = displayNameOf(d, ar);
        const avatarSrc = avatarOf(d, displayName);
        const badgeClub = matched.find(c => String(c.id) === d.badgeClub);

        target.innerHTML = styles(ar) + `
            <div class="profile-wrap">
                <div class="edit-top">
                    <button class="back-btn" onclick="window.closeEditProfile()">${ar ? '➔' : '←'}</button>
                    <div class="edit-title">${ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</div>
                    <button class="edit-save" onclick="window.saveProfileData()">${ar ? 'حفظ' : 'Save'}</button>
                </div>

                <div class="card hero">
                    <div class="wall">${wallHtml(matched)}</div>
                    <div class="hero-body">
                        <div class="avatar-stage">
                            <div class="avatar-box">
                                <div class="avatar-ring"><div class="avatar-inner"><img src="${esc(avatarSrc)}" alt=""></div></div>
                                <button class="avatar-cam" onclick="window.openNftStore()" title="${ar ? 'تحميل صورة' : 'Upload photo'}">📷</button>
                            </div>
                        </div>
                        ${d.photoUrl ? `<button class="small-btn" onclick="window.resetAvatar()">${ar ? 'إزالة الصورة' : 'Remove photo'}</button>` : ''}
                        <div class="acc-note">${ar ? 'الحائط يتغير تلقائياً حسب ناديك. للصورة: اضغط 📷 لشراء بطاقة NFT.' : 'The wall follows your club. Tap 📷 to buy an NFT card as your photo.'}</div>
                    </div>
                </div>

                <div class="x-field">
                    <label>${ar ? 'الاسم المستعار (عربي)' : 'Nickname (Arabic)'}</label>
                    <input id="input-nick-ar" value="${esc(d.nickname_ar)}" placeholder="${ar ? 'مثال: البطل الرياضي' : 'e.g. البطل'}">
                </div>
                <div class="x-field">
                    <label>${ar ? 'الاسم المستعار (إنجليزي)' : 'Nickname (English)'}</label>
                    <input id="input-nick-en" value="${esc(d.nickname_en)}" placeholder="e.g. Sports Hero">
                </div>
                <div class="x-field">
                    <label>${ar ? 'اسم المستخدم (إنجليزي فقط، أرقام و_)' : 'Username (English only, numbers and _)'}</label>
                    <input id="input-username" dir="ltr" value="${esc(d.username)}" placeholder="username_123" oninput="this.value = this.value.replace(/[^a-zA-Z0-9_]/g, '');">
                </div>
                <div class="x-field">
                    <label>${ar ? 'النبذة التعريفية' : 'Bio'}</label>
                    <textarea id="input-bio" placeholder="${ar ? 'اكتب نبذة قصيرة عنك...' : 'Write something about yourself...'}">${esc(d.bio)}</textarea>
                </div>
                <div class="x-field">
                    <label>${ar ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                    <input id="input-dob" type="date" value="${esc(d.dob)}">
                </div>
                <div class="x-field x-row" onclick="window.openBadgePicker()">
                    <div>
                        <label>${ar ? 'شارة التوثيق' : 'Verified badge'}</label>
                        <div class="val">${badgeClub ? `<img src="${esc(badgeClub.logo)}" style="width:22px;height:22px;object-fit:contain;"> ${esc(clubLabel(badgeClub))}` : (ar ? 'بدون شارة' : 'No badge')}</div>
                    </div>
                    <span class="arrow">${ar ? '‹' : '›'}</span>
                </div>
                <div style="height:30px;"></div>
            </div>`;
    }

    function redraw() { if (currentTarget && draft) drawProfile(currentTarget); }

    window.renderProfilePage = function(container) {
        currentTarget = container || document.getElementById('main-content') || document.body;
        if (!currentTarget) return;
        mode = 'view';
        draft = loadProfile();
        drawProfile(currentTarget);
        loadCounts();

        const c = db();
        if (c && c.auth && typeof c.auth.getUser === 'function' && !draft.email) {
            c.auth.getUser().then(res => {
                const em = res && res.data && res.data.user && res.data.user.email;
                if (em && draft && mode === 'view') {
                    draft.email = em;
                    LS.set('zelo_email', em);
                    drawProfile(currentTarget);
                }
            }).catch(() => {});
        }
    };

    async function loadCounts() {
        const c = db();
        const uid = US().userId;
        if (!c || !uid || !draft) return;
        try {
            const rr = await c.from('club_fans_rankings').select('referrals_count').eq('user_id', String(uid));
            if (!rr.error && rr.data) {
                const total = rr.data.reduce((a, r) => Math.max(a, Number(r.referrals_count) || 0), 0);
                draft.invited = total;
                const el = document.getElementById('stat-invited'); if (el) el.textContent = total.toLocaleString('en-US');
            }
        } catch (e) {}
    }

    // ===== التنقل بين العرض والتعديل =====
    window.openEditProfile = function() { mode = 'edit'; redraw(); window.scrollTo && window.scrollTo(0, 0); };
    window.closeEditProfile = function() {
        const inv = draft ? draft.invited : 0;
        draft = loadProfile();
        draft.invited = inv;
        mode = 'view';
        redraw();
    };

    window.openNftStore = function() {
        readInputsIntoDraft();
        if (typeof window.renderNftMarketPage === 'function') window.renderNftMarketPage(currentTarget);
        else alert(isAr() ? 'صفحة NFT غير محمّلة' : 'NFT page is not loaded');
    };

    window.resetAvatar = function() {
        readInputsIntoDraft();
        draft.photoUrl = '';
        redraw();
    };

    // ===== نافذة المشاركة (مثل X) =====
    function openExternal(url) {
        try {
            const tg = window.Telegram && Telegram.WebApp;
            if (tg && /^https:\/\/t\.me\//.test(url) && tg.openTelegramLink) return tg.openTelegramLink(url);
            if (tg && tg.openLink && /^https?:/.test(url)) return tg.openLink(url);
        } catch (e) {}
        window.open(url, '_blank');
    }
    window.shareVia = function(kind) {
        const ar = isAr();
        const link = inviteLink();
        const name = displayNameOf(draft || loadProfile(), ar);
        const text = ar ? `${name} على Zelo Sport ⚽ انضم واربح مكافآت $ZELOFC` : `${name} on Zelo Sport ⚽ Join and earn $ZELOFC rewards`;
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
    window.copyInvite = async function() {
        const l = inviteLink();
        try { await navigator.clipboard.writeText(l); }
        catch (e) { const t = document.createElement('textarea'); t.value = l; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
        alert(isAr() ? 'تم نسخ الرابط ✅' : 'Link copied ✅');
    };
    window.openShareSheet = function() {
        const ar = isAr();
        const d = draft || loadProfile();
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
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${ar ? 'rtl' : 'ltr'};background:#0f1126;border:1px solid rgba(90,110,255,0.35);border-radius:22px 22px 0 0;padding:10px 0 22px 0;color:#fff;">
                <div style="width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,0.25);margin:0 auto 14px auto;"></div>
                <div style="display:flex;align-items:center;gap:12px;padding:0 16px 14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <img src="${esc(avatarOf(d, name))}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">
                    <div style="min-width:0;">
                        <div style="font-weight:900;font-size:0.95rem;">${esc(name)}${window.zeloVerifiedBadge(d.badgeClub, 16)}</div>
                        <div style="font-size:0.74rem;color:#7CF7C4;font-weight:700;direction:ltr;text-align:${ar ? 'right' : 'left'};">${d.username ? '@' + esc(d.username) : ''}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;overflow-x:auto;padding:16px 12px 4px 12px;">
                    ${ic('telegram', '#2AABEE', '✈️', 'Telegram')}
                    ${ic('whatsapp', '#25D366', '💬', ar ? 'واتساب' : 'WhatsApp')}
                    ${ic('x', '#000', '𝕏', 'X')}
                    ${ic('messenger', '#0084ff', '🗨️', ar ? 'الدردشات' : 'Messenger')}
                    ${ic('copy', '#1f2937', '🔗', ar ? 'نسخ الرابط' : 'Copy link')}
                    ${ic('more', '#111827', '⋯', ar ? 'مشاركة عبر…' : 'Share via…')}
                </div>
            </div>`;
        document.body.appendChild(ov);
    };

    // ===== شارة التوثيق =====
    window.openBadgePicker = function() {
        readInputsIntoDraft();
        const ar = isAr();
        const matched = getMatchedClubs(draft);
        if (!matched.length) {
            alert(ar ? 'اختر نادياً أولاً من شاشة اختيار الأندية' : 'Select a club first');
            return;
        }
        document.getElementById('badge-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'badge-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const opts = matched.map(c => `
            <div onclick="window.applyBadge('${esc(String(c.id))}')" style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;border-radius:14px;cursor:pointer;background:rgba(0,0,0,0.4);border:1px solid ${String(c.id) === draft.badgeClub ? '#00FF87' : 'rgba(90,110,255,0.3)'};">
                <img src="${esc(c.logo)}" style="width:38px;height:38px;object-fit:contain;" onerror="this.style.display='none'">
                <span style="font-weight:800;font-size:0.9rem;color:#fff;">${esc(clubLabel(c))}</span>
            </div>`).join('');
        ov.innerHTML = `
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${ar ? 'rtl' : 'ltr'};background:#0f1126;border:1px solid rgba(90,110,255,0.35);border-radius:20px 20px 0 0;padding:18px 16px 24px 16px;color:#fff;">
                <div style="font-weight:900;font-size:1rem;margin-bottom:4px;">✔️ ${ar ? 'وثّق حسابك بشارة ناديك' : 'Verify with your club badge'}</div>
                <div style="color:#7a7f9a;font-size:0.72rem;font-weight:700;margin-bottom:14px;">${ar ? 'اختر الشارة التي تظهر بجانب اسمك في المنشورات' : 'Choose the badge shown next to your name on posts'}</div>
                ${opts}
                <div onclick="window.applyBadge('')" style="text-align:center;padding:10px;color:#94a3b8;font-weight:800;font-size:0.8rem;cursor:pointer;">🚫 ${ar ? 'بدون شارة' : 'No badge'}</div>
            </div>`;
        document.body.appendChild(ov);
    };

    window.applyBadge = async function(id) {
        document.getElementById('badge-overlay')?.remove();
        readInputsIntoDraft();
        draft.badgeClub = String(id || '');
        LS.set('zelo_badge_club', draft.badgeClub);
        if (typeof userState !== 'undefined') userState.badgeClub = draft.badgeClub;
        const c = db();
        if (c && US().userId) {
            try {
                const { error } = await c.from('users').upsert(
                    { user_id: String(US().userId), badge_club: draft.badgeClub || null },
                    { onConflict: 'user_id' });
                if (error) alert((isAr() ? 'تم الحفظ محلياً، لكن القاعدة رفضت: ' : 'Saved locally, database rejected: ') + error.message);
            } catch (e) { console.error(e); }
        }
        redraw();
    };

    // ===== الحساب =====
    window.logoutUser = async function() {
        const ar = isAr();
        if (!confirm(ar ? 'هل تريد تسجيل الخروج؟' : 'Log out?')) return;
        const c = db();
        try { if (c && c.auth) await c.auth.signOut(); } catch (e) {}
        try {
            const lang = localStorage.getItem('app_lang');
            Object.keys(localStorage).filter(k => k.startsWith('zelo_')).forEach(k => localStorage.removeItem(k));
            if (lang) localStorage.setItem('app_lang', lang);
        } catch (e) {}
        location.reload();
    };

    // ===== حفظ التعديلات =====
    window.saveProfileData = async function() {
        readInputsIntoDraft();
        const ar = isAr();

        if (draft.username && !/^[a-zA-Z0-9_]{3,20}$/.test(draft.username)) {
            alert(ar ? 'اسم المستخدم يجب أن يكون بين 3 و20 حرفاً إنجليزياً أو أرقاماً أو _' : 'Username must be 3-20 English letters, numbers or _');
            return;
        }

        LS.set('zelo_nickname_ar', draft.nickname_ar);
        LS.set('zelo_nickname_en', draft.nickname_en);
        LS.set('zelo_username', draft.username);
        LS.set('zelo_dob', draft.dob);
        LS.set('zelo_bio', draft.bio);
        LS.set('zelo_photo_url', draft.photoUrl);
        LS.set('zelo_badge_club', draft.badgeClub || '');

        if (typeof userState !== 'undefined') {
            Object.assign(userState, {
                nickname_ar: draft.nickname_ar,
                nickname_en: draft.nickname_en,
                username: draft.username,
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
                username: draft.username || null,
                nickname_ar: draft.nickname_ar || null,
                nickname_en: draft.nickname_en || null,
                bio: draft.bio || null,
                dob: draft.dob || null,
                photo_url: draft.photoUrl || null,
                badge_club: draft.badgeClub || null
            }, { onConflict: 'user_id' });
            if (error) { dbOk = false; dbMsg = error.message; console.error('profile save error', error); }
        }

        alert(dbOk
            ? (ar ? 'تم حفظ الملف الشخصي بنجاح ✅' : 'Profile saved successfully ✅')
            : ((ar ? 'تم الحفظ محلياً، لكن قاعدة البيانات رفضت: ' : 'Saved locally, database rejected: ') + dbMsg));
        mode = 'view';
        redraw();
    };
})();
