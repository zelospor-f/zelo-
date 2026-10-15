(function() {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const isAr = () => String(US().lang || LS.get('app_lang') || 'ar').startsWith('ar');
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

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
            followers: Number(u.followers_count ?? u.followers ?? 0) || 0,
            following: Number(u.following_count ?? u.following ?? 0) || 0,
            email: u.email || LS.get('zelo_email') || ''
        };
    }

    let draft = null;
    let currentTarget = null;

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

    function drawProfile(target) {
        const ar = isAr();
        const dir = ar ? 'rtl' : 'ltr';
        const align = ar ? 'right' : 'left';
        const d = draft;

        const displayName = ar
            ? (d.nickname_ar || d.nickname_en || 'لاعب جديد')
            : (d.nickname_en || d.nickname_ar || 'New Player');
        const avatarSrc = d.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0c0e20&color=00FF87&size=128&bold=true`;

        const matched = getMatchedClubs(d);

        // حائط الملف (مثل منصة X): نادٍ واحد = علمه/شعاره في الوسط، ناديان = واحد يمين وواحد يسار
        const bannerOf = c => c.banner || c.flag || c.logo || '';
        const bgOf = (c, side) => `<div class="wall-bg wall-${side}" style="background-image:url('${esc(bannerOf(c))}')"></div>`;
        const markOf = (c, side) => `<img class="wall-mark wall-mark-${side}" src="${esc(bannerOf(c))}" onerror="this.style.display='none'" alt="">`;
        let wallHtml = '<div class="wall-bg wall-full wall-empty"></div>';
        if (matched.length === 1) {
            wallHtml = bgOf(matched[0], 'full') + markOf(matched[0], 'center');
        } else if (matched.length >= 2) {
            wallHtml = bgOf(matched[0], 'left') + bgOf(matched[1], 'right') + markOf(matched[0], 'left') + markOf(matched[1], 'right');
        }

        const clubsHtml = matched.length
            ? matched.map(club => {
                const name = typeof getClubName === 'function' ? getClubName(club) : club.name;
                return `
                    <div class="club-row">
                        <div class="club-main">
                            <div class="club-logo-box">
                                <img src="${esc(club.logo)}" onerror="this.style.display='none'" style="width:28px;height:28px;object-fit:contain;">
                            </div>
                            <div style="min-width:0; text-align:${align};">
                                <div class="club-name">${esc(name)}</div>
                                <div class="club-sub">${esc(club.countryFlag || '')} ${ar ? 'قاعدة مشجعين' : 'Fan Base'}</div>
                            </div>
                        </div>
                        <span class="chip">${ar ? 'مدعوم' : 'Supported'}</span>
                    </div>`;
            }).join('')
            : `<div class="empty-box">${ar ? 'لم يتم تحديد أندية بعد' : 'No clubs selected yet'}</div>`;

        const emailLinked = !!d.email;

        target.innerHTML = `
            <style>
                .profile-wrap { width: 100%; box-sizing: border-box; padding: 4px 0 20px 0; direction: ${dir}; color: #fff; }
                .profile-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
                .back-btn {
                    background: rgba(255,255,255,0.08); color: #00FF87; border: 1px solid rgba(0,255,135,0.25);
                    padding: 8px 14px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; cursor: pointer;
                }
                .page-title {
                    margin: 0; font-size: 1.05rem; font-weight: 900;
                    background: linear-gradient(135deg, #2AABEE, #00FF87);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .card {
                    background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                    border: 1px solid rgba(90, 110, 255, 0.35); border-radius: 16px;
                    padding: 14px; margin-bottom: 14px; box-shadow: 0 0 12px rgba(80, 100, 255, 0.12);
                }
                .card-title { color: #fff; font-size: 0.9rem; font-weight: 900; margin: 0 0 12px 0; }
                .hero { text-align: center; padding: 0; overflow: hidden; }
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
                .avatar-stage { position: relative; z-index: 3; margin-top: -48px; margin-bottom: 10px; display: flex; justify-content: center; }
                .avatar-box { position: relative; z-index: 2; width: 96px; height: 96px; }
                .avatar-ring {
                    width: 100%; height: 100%; border-radius: 50%; padding: 3px; box-sizing: border-box;
                    background: linear-gradient(135deg, #2AABEE, #8B5CF6, #00FF87);
                    box-shadow: 0 0 18px rgba(42, 171, 238, 0.4);
                }
                .avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0c0e20; border: 2px solid #0c0e20; }
                .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
                .upload-btn {
                    position: absolute; bottom: -2px; right: -2px; width: 32px; height: 32px; border-radius: 50%;
                    border: 2px solid #0c0e20; cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 0;
                    background: linear-gradient(135deg, #2AABEE, #00FF87); color: #04110B;
                    display: flex; align-items: center; justify-content: center; z-index: 3;
                }
                .hero-name { font-size: 1rem; font-weight: 900; margin: 0; }
                .hero-user { font-size: 0.76rem; color: #7CF7C4; font-weight: 700; margin-top: 3px; direction: ltr; }
                .stats { display: flex; justify-content: center; gap: 28px; margin-top: 12px; }
                .stat-num { font-size: 1rem; font-weight: 900; color: #fff; }
                .stat-lbl { font-size: 0.68rem; font-weight: 700; color: #7a7f9a; margin-top: 2px; }
                .hero-balance {
                    display: inline-block; margin-top: 12px; font-size: 0.8rem; font-weight: 900;
                    background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .small-btn {
                    margin-top: 8px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;
                    background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 0.72rem; font-weight: 800;
                    padding: 5px 12px; border-radius: 10px;
                }
                .label { display: block; font-size: 0.7rem; font-weight: 800; color: #7a7f9a; margin-bottom: 6px; }
                .group { margin-bottom: 12px; text-align: ${align}; }
                .group:last-child { margin-bottom: 0; }
                .input, .textarea {
                    width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45);
                    border: 1px solid rgba(90,110,255,0.3); border-radius: 12px; padding: 10px 12px;
                    color: #fff; font-size: 0.86rem; font-weight: 700; outline: none;
                }
                .input:focus, .textarea:focus { border-color: #00FF87; box-shadow: 0 0 10px rgba(0,255,135,0.25); }
                .textarea { resize: none; height: 70px; font-weight: 500; }
                .input-wrap { display: flex; align-items: center; background: rgba(0,0,0,0.45); border: 1px solid rgba(90,110,255,0.3); border-radius: 12px; }
                .input-wrap .prefix { color: #00FF87; font-weight: 900; padding: 0 0 0 12px; }
                .input-wrap .input { border: none; background: transparent; }
                .club-row {
                    display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px;
                    background: rgba(0,0,0,0.35); border: 1px solid rgba(90,110,255,0.25);
                    border-radius: 14px; padding: 10px 12px; margin-bottom: 8px;
                }
                .club-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
                .club-logo-box {
                    width: 40px; height: 40px; min-width: 40px; border-radius: 10px;
                    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                }
                .club-name { color: #fff; font-weight: 800; font-size: 0.84rem; }
                .club-sub { color: #7a7f9a; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
                .chip {
                    font-size: 0.66rem; font-weight: 900; color: #04110B;
                    background: linear-gradient(135deg, #00FF87, #14B8A6);
                    padding: 5px 9px; border-radius: 8px; white-space: nowrap;
                }
                .chip-gray {
                    font-size: 0.66rem; font-weight: 900; color: #cbd5e1;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
                    padding: 5px 9px; border-radius: 8px;
                }
                .empty-box {
                    text-align: center; padding: 14px; color: #94a3b8; font-size: 0.8rem; font-weight: 700;
                    border: 1px dashed rgba(90,110,255,0.4); border-radius: 12px;
                }
                .acc-row { display: flex; gap: 8px; align-items: center; }
                .acc-btn {
                    border: none; cursor: pointer; white-space: nowrap; font-weight: 900; font-size: 0.78rem;
                    padding: 11px 14px; border-radius: 12px; color: #04110B;
                    background: linear-gradient(135deg, #2AABEE, #00FF87);
                }
                .acc-note { font-size: 0.68rem; font-weight: 700; margin-top: 6px; color: #7a7f9a; }
                .linked-ok { color: #00FF87; }
                .logout-btn {
                    width: 100%; margin-top: 4px; cursor: pointer; font-weight: 900; font-size: 0.88rem;
                    padding: 12px; border-radius: 14px; color: #ff6b6b;
                    background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.35);
                }
                .save-btn {
                    width: 100%; border: none; cursor: pointer;
                    background: linear-gradient(135deg, #2AABEE, #00FF87);
                    color: #04110B; font-weight: 900; font-size: 0.95rem;
                    padding: 13px; border-radius: 14px; box-shadow: 0 4px 18px rgba(0,255,135,0.3);
                }
                .save-btn:active { transform: scale(0.97); }
            </style>

            <div class="profile-wrap">
                <div class="profile-top">
                    <button class="back-btn" onclick="if(typeof window.showPage === 'function') window.showPage('home');">
                        ${ar ? '➔ الرئيسية' : '➔ Home'}
                    </button>
                    <h3 class="page-title">${ar ? 'الملف الشخصي' : 'Profile'}</h3>
                    <div style="width:64px;"></div>
                </div>

                <div class="card hero">
                    <div class="wall">${wallHtml}</div>
                    <div class="hero-body">
                    <div class="avatar-stage">
                        <div class="avatar-box">
                            <div class="avatar-ring"><div class="avatar-inner"><img src="${esc(avatarSrc)}" alt=""></div></div>
                            <button class="upload-btn" onclick="window.openNftStore()" title="${ar ? 'تحميل صورة' : 'Upload photo'}">📷</button>
                        </div>
                    </div>
                    <h4 class="hero-name">${esc(displayName)}</h4>
                    <div class="hero-user">${d.username ? '@' + esc(d.username) : ''}</div>

                    <div class="stats">
                        <div>
                            <div class="stat-num">${d.followers.toLocaleString('en-US')}</div>
                            <div class="stat-lbl">${ar ? 'متابِعون' : 'Followers'}</div>
                        </div>
                        <div>
                            <div class="stat-num">${d.following.toLocaleString('en-US')}</div>
                            <div class="stat-lbl">${ar ? 'يتابِع' : 'Following'}</div>
                        </div>
                    </div>

                    <div class="hero-balance">${d.points.toLocaleString('en-US')} 🏆 ZELOFC</div>
                    ${d.photoUrl ? `<br><button class="small-btn" onclick="window.resetAvatar()">${ar ? 'إزالة الصورة' : 'Remove photo'}</button>` : ''}
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">👤 ${ar ? 'البيانات الأساسية' : 'Basic Info'}</div>
                    <div class="group">
                        <label class="label">${ar ? 'الاسم المستعار (عربي)' : 'Nickname (Arabic)'}</label>
                        <input id="input-nick-ar" class="input" value="${esc(d.nickname_ar)}" placeholder="${ar ? 'مثال: البطل الرياضي' : 'e.g. البطل'}">
                    </div>
                    <div class="group">
                        <label class="label">${ar ? 'الاسم المستعار (إنجليزي)' : 'Nickname (English)'}</label>
                        <input id="input-nick-en" class="input" value="${esc(d.nickname_en)}" placeholder="e.g. Sports Hero">
                    </div>
                    <div class="group">
                        <label class="label">${ar ? 'اسم المستخدم (إنجليزي فقط، أرقام و_)' : 'Username (English only, numbers and _)'}</label>
                        <div class="input-wrap">
                            <span class="prefix">@</span>
                            <input id="input-username" class="input" dir="ltr" value="${esc(d.username)}" placeholder="username_123"
                                oninput="this.value = this.value.replace(/[^a-zA-Z0-9_]/g, '');">
                        </div>
                    </div>
                    <div class="group">
                        <label class="label">${ar ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                        <input id="input-dob" type="date" class="input" value="${esc(d.dob)}">
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">⚽ ${ar ? 'أنديتك المختارة' : 'Your Selected Clubs'}</div>
                    ${clubsHtml}
                </div>

                <div class="card">
                    <div class="group">
                        <label class="label">${ar ? 'نبذة عنك' : 'Bio'}</label>
                        <textarea id="input-bio" class="textarea" placeholder="${ar ? 'اكتب نبذة قصيرة عنك...' : 'Write something about yourself...'}">${esc(d.bio)}</textarea>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">🔐 ${ar ? 'الحساب' : 'Account'}</div>
                    <div class="group">
                        <label class="label">${ar ? 'البريد الإلكتروني' : 'Email'}</label>
                        <div class="acc-row">
                            <input id="input-email" type="email" class="input" dir="ltr"
                                value="${esc(d.emailInput !== undefined ? d.emailInput : d.email)}" placeholder="name@example.com">
                            <button class="acc-btn" onclick="window.linkEmail()">${emailLinked ? (ar ? 'تغيير' : 'Change') : (ar ? 'ربط' : 'Link')}</button>
                        </div>
                        <div class="acc-note ${emailLinked ? 'linked-ok' : ''}">
                            ${emailLinked ? (ar ? '✅ مربوط بالبريد' : '✅ Email linked') : (ar ? 'لم يتم ربط بريد إلكتروني بعد' : 'No email linked yet')}
                        </div>
                    </div>
                    <button class="logout-btn" onclick="window.logoutUser()">🚪 ${ar ? 'تسجيل الخروج' : 'Log out'}</button>
                </div>

                <button class="save-btn" onclick="window.saveProfileData()">💾 ${ar ? 'حفظ التعديلات' : 'Save Profile'}</button>
                <div style="height:20px;"></div>
            </div>
        `;
    }

    window.renderProfilePage = function(container) {
        currentTarget = container || document.getElementById('main-content') || document.body;
        if (!currentTarget) return;
        draft = loadProfile();
        drawProfile(currentTarget);

        // جلب البريد المربوط من Supabase Auth إن وُجد
        const c = db();
        if (c && c.auth && typeof c.auth.getUser === 'function' && !draft.email) {
            c.auth.getUser().then(res => {
                const em = res && res.data && res.data.user && res.data.user.email;
                if (em && draft) {
                    draft.email = em;
                    LS.set('zelo_email', em);
                    readInputsIntoDraft();
                    draft.emailInput = undefined;
                    drawProfile(currentTarget);
                }
            }).catch(() => {});
        }
    };

    // زر تحميل الصورة => يفتح صفحة NFT (الشراء بعملة SOL)
    window.openNftStore = function() {
        readInputsIntoDraft();
        if (typeof window.renderNftMarketPage === 'function') {
            window.renderNftMarketPage(currentTarget);
        } else {
            alert(isAr() ? 'صفحة NFT غير محمّلة' : 'NFT page is not loaded');
        }
    };

    window.resetAvatar = function() {
        readInputsIntoDraft();
        draft.photoUrl = '';
        drawProfile(currentTarget);
    };

    window.linkEmail = async function() {
        readInputsIntoDraft();
        const ar = isAr();
        const email = (draft.emailInput || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert(ar ? 'اكتب بريداً إلكترونياً صحيحاً' : 'Enter a valid email');
            return;
        }
        const c = db();
        let ok = true, msg = '';
        if (c && c.auth && typeof c.auth.updateUser === 'function') {
            const { error } = await c.auth.updateUser({ email });
            if (error) { ok = false; msg = error.message; }
        }
        if (!ok) {
            alert((ar ? 'تعذر ربط البريد: ' : 'Could not link email: ') + msg);
            return;
        }
        if (c && US().userId) {
            try { await c.from('users').upsert({ user_id: String(US().userId), email }, { onConflict: 'user_id' }); } catch (e) {}
        }
        draft.email = email;
        draft.emailInput = undefined;
        LS.set('zelo_email', email);
        if (typeof userState !== 'undefined') userState.email = email;
        alert(ar ? 'تم إرسال رابط التأكيد إلى بريدك ✅ افتحه لإتمام الربط' : 'Confirmation link sent to your email ✅');
        drawProfile(currentTarget);
    };

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

        if (typeof userState !== 'undefined') {
            Object.assign(userState, {
                nickname_ar: draft.nickname_ar,
                nickname_en: draft.nickname_en,
                username: draft.username,
                dob: draft.dob,
                bio: draft.bio,
                photoUrl: draft.photoUrl
            });
        }

        let dbOk = true;
        let dbMsg = '';
        const c = db();
        if (c && US().userId) {
            const { error } = await c.from('users').upsert({
                user_id: String(US().userId),
                username: draft.username || null,
                nickname_ar: draft.nickname_ar || null,
                nickname_en: draft.nickname_en || null,
                bio: draft.bio || null,
                dob: draft.dob || null,
                photo_url: draft.photoUrl || null
            }, { onConflict: 'user_id' });
            if (error) { dbOk = false; dbMsg = error.message; console.error('profile save error', error); }
        }

        if (dbOk) {
            alert(ar ? 'تم حفظ الملف الشخصي بنجاح ✅' : 'Profile saved successfully ✅');
        } else {
            alert((ar ? 'تم الحفظ محلياً، لكن قاعدة البيانات رفضت: ' : 'Saved locally, database rejected: ') + dbMsg);
        }
        drawProfile(currentTarget);
    };
})();
