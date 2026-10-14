(function() {
    const US = () => (typeof userState !== 'undefined' && userState) ? userState : {};
    const LS = {
        get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    const isAr = () => String(US().lang || LS.get('app_lang') || 'ar').startsWith('ar');
    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;

    // صور NFT المتاحة (تُفتح فقط إذا كانت مملوكة للمستخدم)
    const NFT_LIST = [
        { id: 'nft_gold',   nameAr: 'نجم الذهب',    nameEn: 'Golden Star',  color: 'FCB045' },
        { id: 'nft_neon',   nameAr: 'نيون الهداف',  nameEn: 'Neon Striker', color: '14F195' },
        { id: 'nft_fire',   nameAr: 'لهيب الملعب',  nameEn: 'Pitch Flame',  color: 'FD1D1D' },
        { id: 'nft_ice',    nameAr: 'جليد الحارس',  nameEn: 'Ice Keeper',   color: '2AABEE' },
        { id: 'nft_royal',  nameAr: 'الملك البنفسجي', nameEn: 'Purple King', color: '833AB4' },
        { id: 'nft_legend', nameAr: 'أسطورة',       nameEn: 'Legend',       color: 'FFFFFF' }
    ];
    const nftImg = n => `https://ui-avatars.com/api/?name=${encodeURIComponent(n.nameEn)}&background=${n.color}&color=000000&size=128&bold=true`;

    function ownedNfts() {
        if (Array.isArray(US().ownedNfts)) return US().ownedNfts;
        try { return JSON.parse(LS.get('zelo_owned_nfts') || '[]'); } catch (e) { return []; }
    }

    function loadProfile() {
        const u = US();
        const rawUser = u.username || LS.get('zelo_username') || '';
        return {
            nickname_ar: u.nickname_ar || LS.get('zelo_nickname_ar') || '',
            nickname_en: u.nickname_en || LS.get('zelo_nickname_en') || '',
            // app.js يضع قيمة افتراضية "Android Player"، نتجاهلها
            username: rawUser === 'Android Player' ? (LS.get('zelo_username') || '') : rawUser,
            dob: u.dob || LS.get('zelo_dob') || '',
            bio: u.bio || LS.get('zelo_bio') || '',
            photoUrl: u.photoUrl || LS.get('zelo_photo_url') || '',
            selectedClubs: (u.selectedClubs || []).map(String),
            points: Number(u.points || 0)
        };
    }

    let draft = null;
    let currentTarget = null;

    // نسخ ما كتبه المستخدم في الحقول قبل إعادة الرسم
    function readInputsIntoDraft() {
        if (!draft) return;
        const g = id => document.getElementById(id);
        if (g('input-nick-ar')) draft.nickname_ar = g('input-nick-ar').value.trim();
        if (g('input-nick-en')) draft.nickname_en = g('input-nick-en').value.trim();
        if (g('input-username')) draft.username = g('input-username').value.trim();
        if (g('input-dob')) draft.dob = g('input-dob').value;
        if (g('input-bio')) draft.bio = g('input-bio').value;
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

        // الأندية المختارة عند التسجيل
        const matched = [];
        if (d.selectedClubs.length && typeof allWorldCupCountriesClubs !== 'undefined') {
            for (const key in allWorldCupCountriesClubs) {
                (allWorldCupCountriesClubs[key] || []).forEach(club => {
                    if (d.selectedClubs.includes(String(club.id))) matched.push(club);
                });
            }
        }
        const clubsHtml = matched.length
            ? matched.map(club => {
                const name = typeof getClubName === 'function' ? getClubName(club) : club.name;
                return `
                    <div class="club-row">
                        <div class="club-main">
                            <div class="club-logo-box">
                                <img src="${club.logo}" onerror="this.style.display='none'" style="width:28px;height:28px;object-fit:contain;">
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

        // صور NFT
        const owned = ownedNfts();
        const nftHtml = NFT_LIST.map(n => {
            const isOwned = owned.includes(n.id);
            const isSelected = d.photoUrl === nftImg(n);
            return `
                <div class="nft-card ${isSelected ? 'nft-selected' : ''} ${isOwned ? '' : 'nft-locked'}"
                     onclick="window.selectNft('${n.id}')">
                    <img src="${nftImg(n)}" alt="">
                    <div class="nft-name">${ar ? n.nameAr : n.nameEn}</div>
                    <div class="nft-state">${isOwned ? (isSelected ? '✅' : '🟢') : '🔒'}</div>
                </div>`;
        }).join('');

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
                .hero { text-align: center; }
                .avatar-ring {
                    width: 92px; height: 92px; margin: 0 auto 10px auto; border-radius: 50%; padding: 3px;
                    background: linear-gradient(135deg, #2AABEE, #8B5CF6, #00FF87);
                    box-shadow: 0 0 18px rgba(42, 171, 238, 0.4);
                }
                .avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0c0e20; border: 2px solid #0c0e20; }
                .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
                .hero-name { font-size: 1rem; font-weight: 900; margin: 0; }
                .hero-user { font-size: 0.76rem; color: #7CF7C4; font-weight: 700; margin-top: 3px; direction: ltr; }
                .hero-balance {
                    display: inline-block; margin-top: 10px; font-size: 0.8rem; font-weight: 900;
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
                .empty-box {
                    text-align: center; padding: 14px; color: #94a3b8; font-size: 0.8rem; font-weight: 700;
                    border: 1px dashed rgba(90,110,255,0.4); border-radius: 12px;
                }
                .nft-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .nft-card {
                    background: rgba(0,0,0,0.35); border: 1px solid rgba(90,110,255,0.3);
                    border-radius: 14px; padding: 8px 6px; text-align: center; cursor: pointer;
                }
                .nft-card img { width: 56px; height: 56px; border-radius: 12px; }
                .nft-name { color: #fff; font-size: 0.66rem; font-weight: 800; margin-top: 6px; }
                .nft-state { font-size: 0.7rem; margin-top: 3px; }
                .nft-locked { opacity: 0.5; }
                .nft-selected { border-color: #00FF87; box-shadow: 0 0 12px rgba(0,255,135,0.35); }
                .nft-hint { color: #7a7f9a; font-size: 0.7rem; font-weight: 700; margin-top: 10px; text-align: center; }
                .chip-gray {
                    font-size: 0.66rem; font-weight: 900; color: #cbd5e1;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
                    padding: 5px 9px; border-radius: 8px;
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
                    <div class="avatar-ring"><div class="avatar-inner"><img src="${avatarSrc}" alt=""></div></div>
                    <h4 class="hero-name">${esc(displayName)}</h4>
                    <div class="hero-user">${d.username ? '@' + esc(d.username) : ''}</div>
                    <div class="hero-balance">${d.points.toLocaleString('en-US')} 🏆 ZELOFC</div>
                    <br>
                    <button class="small-btn" onclick="window.resetAvatar()">${ar ? 'إزالة صورة NFT' : 'Remove NFT avatar'}</button>
                </div>

                <div class="card">
                    <div class="card-title">🖼️ ${ar ? 'صورة الملف الشخصي (NFT)' : 'Profile Picture (NFT)'}</div>
                    <div class="nft-grid">${nftHtml}</div>
                    <div class="nft-hint">${ar ? 'الصور المقفلة تُفتح عند اقتناء NFT من السوق' : 'Locked images unlock when you own the NFT'}</div>
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
    };

    window.selectNft = function(id) {
        const n = NFT_LIST.find(x => x.id === id);
        if (!n) return;
        if (!ownedNfts().includes(id)) {
            alert(isAr() ? 'هذه الصورة مقفلة. اقتنِ NFT من السوق أولاً.' : 'This avatar is locked. Buy the NFT from the market first.');
            return;
        }
        readInputsIntoDraft();
        draft.photoUrl = nftImg(n);
        drawProfile(currentTarget);
    };

    window.resetAvatar = function() {
        readInputsIntoDraft();
        draft.photoUrl = '';
        drawProfile(currentTarget);
    };

    window.saveProfileData = async function() {
        readInputsIntoDraft();
        const ar = isAr();

        if (draft.username && !/^[a-zA-Z0-9_]{3,20}$/.test(draft.username)) {
            alert(ar ? 'اسم المستخدم يجب أن يكون بين 3 و20 حرفاً إنجليزياً أو أرقاماً أو _' : 'Username must be 3-20 English letters, numbers or _');
            return;
        }

        // الحفظ محلياً أولاً
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

        // ثم الحفظ في قاعدة البيانات
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
