(function() {
    const lsGet = key => { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } };
    const esc = str => String(str ?? '').replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t));

    // قراءة الحالة من userState أولاً، ثم من التخزين المحلي كاحتياط
    function getProfileState() {
        const us = (typeof userState !== 'undefined' && userState) ? userState : {};
        return {
            username: us.username || lsGet('zelo_username') || 'android_player',
            nickname: us.nickname || lsGet('zelo_nickname') || 'البطل الرياضي',
            bio: us.bio || lsGet('zelo_bio') || 'عاشق لكرة القدم وتحديات Web3 ⚽🔥',
            dob: us.dob || lsGet('zelo_dob') || '2000-01-01',
            photoUrl: us.photoUrl || lsGet('zelo_photo_url') || '',
            points: Number(us.points || 0),
            selectedClubs: (us.selectedClubs && us.selectedClubs.length) ? us.selectedClubs : (window.tempSelectedClubs || [])
        };
    }

    // حفظ التعديلات في userState والتخزين المحلي
    window.saveProfileData = function() {
        const nickEl = document.getElementById('input-nickname');
        const userEl = document.getElementById('input-username');
        const dobEl = document.getElementById('input-dob');
        const bioEl = document.getElementById('input-bio');
        if (!nickEl || !userEl || !dobEl || !bioEl) return;

        const current = getProfileState();
        const newNickname = nickEl.value.trim() || current.nickname;
        const newUsername = userEl.value.trim() || current.username;
        const newDob = dobEl.value || current.dob;
        const newBio = bioEl.value;
        const isRtl = (lsGet('app_lang') || 'ar').startsWith('ar');

        try {
            localStorage.setItem('zelo_nickname', newNickname);
            localStorage.setItem('zelo_username', newUsername);
            localStorage.setItem('zelo_dob', newDob);
            localStorage.setItem('zelo_bio', newBio);
        } catch (e) {}

        if (typeof userState !== 'undefined') {
            userState.nickname = newNickname;
            userState.username = newUsername;
            userState.dob = newDob;
            userState.bio = newBio;
        }

        alert(isRtl ? 'تم حفظ بيانات الملف الشخصي بنجاح! ✅' : 'Profile updated successfully! ✅');
    };

    window.renderProfilePage = function(container) {
        const target = container || document.getElementById('main-content') || document.body;
        if (!target) return;

        try {
            const lang = lsGet('app_lang') || (typeof userState !== 'undefined' ? userState.lang : 'ar') || 'ar';
            const isRtl = String(lang).startsWith('ar');
            const dir = isRtl ? 'rtl' : 'ltr';
            const textAlign = isRtl ? 'right' : 'left';
            const state = getProfileState();

            const nickname = state.nickname;
            const username = state.username;
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=0c0e20&color=00FF87&size=128&bold=true`;
            const avatarSrc = state.photoUrl || fallbackAvatar;

            // الأندية المختارة
            let matchedClubs = [];
            if (state.selectedClubs.length && typeof allWorldCupCountriesClubs !== 'undefined') {
                const ids = state.selectedClubs.map(String);
                for (const countryKey in allWorldCupCountriesClubs) {
                    (allWorldCupCountriesClubs[countryKey] || []).forEach(club => {
                        if (ids.includes(String(club.id))) matchedClubs.push(club);
                    });
                }
            }

            const clubsHtml = matchedClubs.length
                ? matchedClubs.map(club => {
                    const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;
                    return `
                        <div class="club-row">
                            <div class="club-main">
                                <div class="club-logo-box">
                                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 28px; height: 28px; object-fit: contain;">
                                </div>
                                <div style="min-width: 0; text-align: ${textAlign};">
                                    <div class="club-name">${esc(clubName)}</div>
                                    <div class="club-sub">${esc(club.countryFlag || '')} ${isRtl ? 'قاعدة مشجعين' : 'Fan Base'}</div>
                                </div>
                            </div>
                            <span class="supported-chip">${isRtl ? 'مدعوم' : 'Supported'}</span>
                        </div>`;
                }).join('')
                : `<div class="empty-box">${isRtl ? 'لم يتم تحديد أندية بعد' : 'No clubs selected yet'}</div>`;

            target.innerHTML = `
                <style>
                    .profile-wrap {
                        width: 100%; box-sizing: border-box; padding: 4px 0 20px 0;
                        direction: ${dir}; color: #fff;
                    }
                    .profile-top {
                        display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;
                    }
                    .back-btn {
                        background: rgba(255,255,255,0.08); color: #00FF87;
                        border: 1px solid rgba(0,255,135,0.25);
                        padding: 8px 14px; border-radius: 20px;
                        font-weight: 800; font-size: 0.8rem; cursor: pointer;
                    }
                    .back-btn:active { transform: scale(0.96); }
                    .page-title {
                        margin: 0; font-size: 1.05rem; font-weight: 900;
                        background: linear-gradient(135deg, #2AABEE, #00FF87);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    }

                    .hero-card {
                        background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                        border: 1px solid rgba(90, 110, 255, 0.35); border-radius: 18px;
                        padding: 18px 14px; margin-bottom: 14px; text-align: center;
                        box-shadow: 0 0 14px rgba(80, 100, 255, 0.15);
                    }
                    .avatar-ring {
                        width: 92px; height: 92px; margin: 0 auto 10px auto;
                        border-radius: 50%; padding: 3px;
                        background: linear-gradient(135deg, #2AABEE, #8B5CF6, #00FF87);
                        box-shadow: 0 0 18px rgba(42, 171, 238, 0.4);
                    }
                    .avatar-inner {
                        width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
                        background: #0c0e20; border: 2px solid #0c0e20;
                    }
                    .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
                    .hero-name { font-size: 1rem; font-weight: 900; color: #fff; margin: 0; }
                    .hero-user { font-size: 0.74rem; color: #7CF7C4; font-weight: 700; margin-top: 3px; direction: ltr; }
                    .hint-chip {
                        display: inline-block; margin-top: 10px;
                        font-size: 0.66rem; color: #7CF7C4; font-weight: 700;
                        background: rgba(0,255,135,0.1); border: 1px solid rgba(0,255,135,0.25);
                        padding: 3px 10px; border-radius: 8px;
                    }

                    .stats-grid {
                        display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;
                    }
                    .stat-box {
                        background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                        border: 1px solid rgba(90, 110, 255, 0.35); border-radius: 14px;
                        padding: 12px; text-align: center;
                        box-shadow: 0 0 10px rgba(80, 100, 255, 0.1);
                    }
                    .stat-label { color: #7a7f9a; font-size: 0.64rem; font-weight: 800; letter-spacing: 0.5px; }
                    .stat-value {
                        font-size: 1rem; font-weight: 900; margin-top: 4px;
                        background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    }

                    .section-card {
                        background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                        border: 1px solid rgba(90, 110, 255, 0.35); border-radius: 16px;
                        padding: 14px; margin-bottom: 14px;
                        box-shadow: 0 0 12px rgba(80, 100, 255, 0.12);
                    }
                    .section-title {
                        display: flex; align-items: center; gap: 6px;
                        color: #fff; font-size: 0.9rem; font-weight: 900; margin: 0 0 12px 0;
                    }

                    .input-group { margin-bottom: 12px; text-align: ${textAlign}; }
                    .input-group:last-child { margin-bottom: 0; }
                    .input-label {
                        display: block; font-size: 0.7rem; font-weight: 800;
                        color: #7a7f9a; margin-bottom: 6px; letter-spacing: 0.3px;
                    }
                    .profile-input, .profile-textarea {
                        width: 100%; box-sizing: border-box;
                        background: rgba(0, 0, 0, 0.45);
                        border: 1px solid rgba(90, 110, 255, 0.3);
                        border-radius: 12px; padding: 10px 12px;
                        color: #fff; font-size: 0.86rem; font-weight: 700;
                        outline: none; transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .profile-textarea { resize: none; height: 70px; font-weight: 500; }
                    .profile-input:focus, .profile-textarea:focus {
                        border-color: #00FF87; box-shadow: 0 0 10px rgba(0,255,135,0.25);
                    }

                    .club-row {
                        display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px;
                        background: rgba(0, 0, 0, 0.35);
                        border: 1px solid rgba(90, 110, 255, 0.25);
                        border-radius: 14px; padding: 10px 12px; margin-bottom: 8px;
                    }
                    .club-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
                    .club-logo-box {
                        width: 40px; height: 40px; min-width: 40px; border-radius: 10px;
                        background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
                        display: flex; align-items: center; justify-content: center;
                    }
                    .club-name { color: #fff; font-weight: 800; font-size: 0.84rem; line-height: 1.3; }
                    .club-sub { color: #7a7f9a; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
                    .supported-chip {
                        font-size: 0.66rem; font-weight: 900; color: #04110B;
                        background: linear-gradient(135deg, #00FF87, #14B8A6);
                        padding: 5px 9px; border-radius: 8px; white-space: nowrap;
                        box-shadow: 0 4px 12px rgba(0,255,135,0.3);
                    }
                    .empty-box {
                        text-align: center; padding: 16px; color: #94a3b8; font-size: 0.8rem; font-weight: 700;
                        border: 1px dashed rgba(90,110,255,0.4); border-radius: 12px;
                    }

                    .save-btn {
                        width: 100%; border: none; cursor: pointer;
                        background: linear-gradient(135deg, #2AABEE, #00FF87);
                        color: #04110B; font-weight: 900; font-size: 0.95rem;
                        padding: 13px; border-radius: 14px;
                        box-shadow: 0 4px 18px rgba(0, 255, 135, 0.3);
                        transition: transform 0.2s;
                    }
                    .save-btn:active { transform: scale(0.97); }
                </style>

                <div class="profile-wrap">
                    <div class="profile-top">
                        <button class="back-btn" onclick="if(typeof window.showPage === 'function') window.showPage('home');">
                            ${isRtl ? '➔ العودة للرئيسية' : '➔ Back'}
                        </button>
                        <h3 class="page-title">${isRtl ? 'الملف الشخصي' : 'Profile'}</h3>
                        <div style="width: 40px;"></div>
                    </div>

                    <div class="hero-card">
                        <div class="avatar-ring">
                            <div class="avatar-inner">
                                <img id="profile-avatar-img" src="${avatarSrc}" alt="Avatar">
                            </div>
                        </div>
                        <h4 class="hero-name">${esc(nickname)}</h4>
                        <div class="hero-user">@${esc(username)}</div>
                        <div class="hint-chip">🏷️ ${isRtl ? 'تتغير الصورة عند اقتناء NFT لاعب' : 'NFT Player Avatar'}</div>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-label">${isRtl ? 'الرصيد' : 'BALANCE'}</div>
                            <div class="stat-value">${state.points.toLocaleString('en-US')} 🏆</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-label">${isRtl ? 'الأندية' : 'CLUBS'}</div>
                            <div class="stat-value">${matchedClubs.length} ⚽</div>
                        </div>
                    </div>

                    <div class="section-card">
                        <div class="input-group">
                            <label class="input-label">${isRtl ? 'الاسم المستعار' : 'Display Nickname'}</label>
                            <input type="text" id="input-nickname" class="profile-input" value="${esc(nickname)}" placeholder="${isRtl ? 'أدخل اسمك المستعار' : 'Enter nickname'}">
                        </div>
                        <div class="input-group">
                            <label class="input-label">${isRtl ? 'اسم المستخدم (إنجليزي فقط)' : 'Username (English only)'}</label>
                            <input type="text" id="input-username" class="profile-input" value="${esc(username)}" dir="ltr" placeholder="username_123" oninput="this.value = this.value.replace(/[^a-zA-Z0-9_]/g, '');">
                        </div>
                        <div class="input-group">
                            <label class="input-label">${isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                            <input type="date" id="input-dob" class="profile-input" value="${esc(state.dob)}">
                        </div>
                    </div>

                    <div class="section-card">
                        <div class="section-title">⚽ ${isRtl ? 'أنديتك المفضلة' : 'Your Selected Clubs'}</div>
                        ${clubsHtml}
                    </div>

                    <div class="section-card">
                        <div class="input-group">
                            <label class="input-label">${isRtl ? 'نبذة عنك' : 'Bio'}</label>
                            <textarea id="input-bio" class="profile-textarea" placeholder="${isRtl ? 'اكتب نبذة قصيرة عنك...' : 'Write something about yourself...'}">${esc(state.bio)}</textarea>
                        </div>
                    </div>

                    <button class="save-btn" onclick="window.saveProfileData()">
                        💾 ${isRtl ? 'حفظ التعديلات' : 'Save Profile'}
                    </button>
                    <div style="height: 20px;"></div>
                </div>
            `;
        } catch (err) {
            console.error("خطأ في عرض صفحة الملف الشخصي:", err);
        }
    };
})();
