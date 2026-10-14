window.renderProfilePage = function(container) {
    let target = container || document.getElementById('app') || document.getElementById('main-content') || document.body;
    if (!target) return;

    try {
        const currentLang = localStorage.getItem('app_lang') || 'ar';
        const isRtl = currentLang.startsWith('ar');
        const dir = isRtl ? 'rtl' : 'ltr';
        const textAlign = isRtl ? 'right' : 'left';

        // جلب بيانات المستخدم وتحديد الأندية المختارة من النظام أو التخزين
        const state = (typeof userState !== 'undefined' && userState) ? userState : {
            username: localStorage.getItem('zelo_username') || 'android_player',
            nickname: localStorage.getItem('zelo_nickname') || 'البطل الرياضي',
            bio: localStorage.getItem('zelo_bio') || 'عاشق لكرة القدم وتحديات Web3 ⚽🔥',
            dob: localStorage.getItem('zelo_dob') || '2000-01-01',
            selectedClubs: window.tempSelectedClubs || [],
            photoUrl: localStorage.getItem('zelo_photo_url') || ''
        };

        const username = state.username || 'android_player';
        const nickname = state.nickname || 'لاعب جديد';
        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=1c1c22&color=14F195&size=128&bold=true`;
        const avatarSrc = state.photoUrl ? state.photoUrl : fallbackAvatar;

        // دمج ومعالجة الأندية المختارة (نادي أو ناديين) لعرضها بشكل أنيق في البروفايل
        let selectedClubsHtml = '';
        const userClubs = state.selectedClubs || (userState && userState.selectedClubs) || [];

        if (userClubs.length > 0 && typeof allWorldCupCountriesClubs !== 'undefined') {
            // البحث عن تفاصيل الأندية المختارة عبر مصفوفة الدولة والنادي
            let matchedClubs = [];
            for (const countryKey in allWorldCupCountriesClubs) {
                const clubs = allWorldCupCountriesClubs[countryKey];
                clubs.forEach(club => {
                    if (userClubs.map(String).includes(String(club.id))) {
                        matchedClubs.push(club);
                    }
                });
            }

            if (matchedClubs.length > 0) {
                selectedClubsHtml = matchedClubs.map(club => {
                    const clubName = typeof getClubName === 'function' ? getClubName(club) : club.name;
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="background: rgba(0,0,0,0.4); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                    <img src="${club.logo}" onerror="this.style.display='none'" style="width: 28px; height: 28px; object-fit: contain;">
                                </div>
                                <div>
                                    <div style="color: #fff; font-weight: 800; font-size: 0.85rem;">${clubName}</div>
                                    <div style="color: #94a3b8; font-size: 0.65rem;">${club.countryFlag || ''} Fan Base</div>
                                </div>
                            </div>
                            <span style="font-size: 0.7rem; color: #00FF87; font-weight: 800; background: rgba(0, 255, 135, 0.1); padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(0, 255, 135, 0.2);">
                                ${isRtl ? 'مدعوم' : 'Supported'}
                            </span>
                        </div>
                    `;
                }).join('');
            }
        }

        if (!selectedClubsHtml) {
            selectedClubsHtml = `
                <div style="text-align: center; color: #94a3b8; font-size: 0.78rem; padding: 10px;">
                    ${isRtl ? 'لم يتم تحديد أندية بعد' : 'No clubs selected yet'}
                </div>
            `;
        }

        target.innerHTML = `
            <style>
                .profile-scroll-wrapper {
                    width: 100%;
                    max-height: calc(100vh - 80px);
                    overflow-y: auto;
                    padding: 16px 16px 90px 16px;
                    box-sizing: border-box;
                    background: radial-gradient(circle at 50% 0%, rgba(153, 69, 255, 0.18) 0%, transparent 50%),
                                radial-gradient(circle at 90% 90%, rgba(20, 241, 149, 0.12) 0%, transparent 40%),
                                #08090C;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    direction: ${dir};
                }
                .profile-scroll-wrapper::-webkit-scrollbar { display: none; }

                .profile-top-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .back-btn {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                    padding: 8px 14px;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.85rem;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                }

                .profile-avatar-header {
                    text-align: center;
                    margin-bottom: 24px;
                    position: relative;
                }
                .profile-avatar-ring {
                    width: 90px;
                    height: 90px;
                    margin: 0 auto 12px auto;
                    border-radius: 50%;
                    padding: 3px;
                    background: linear-gradient(135deg, #9945FF, #14F195);
                    box-shadow: 0 0 20px rgba(20, 241, 149, 0.25);
                }
                .profile-avatar-inner {
                    width: 100%; height: 100%;
                    border-radius: 50%; overflow: hidden;
                    background: #111; border: 2px solid #08090C;
                }
                .profile-avatar-inner img { width: 100%; height: 100%; object-fit: cover; }

                .nft-avatar-hint {
                    font-size: 0.68rem;
                    color: #14F195;
                    background: rgba(20, 241, 149, 0.1);
                    border: 1px solid rgba(20, 241, 149, 0.25);
                    padding: 4px 12px;
                    border-radius: 12px;
                    display: inline-block;
                    margin-top: 4px;
                    font-weight: 700;
                }

                .profile-card-box {
                    background: rgba(18, 18, 24, 0.75);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    padding: 16px;
                    margin-bottom: 14px;
                    backdrop-filter: blur(15px);
                }

                .input-group {
                    margin-bottom: 14px;
                    text-align: ${textAlign};
                }
                .input-group:last-child { margin-bottom: 0; }

                .input-label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #94a3b8;
                    margin-bottom: 6px;
                }

                .profile-input {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 12px;
                    padding: 10px 12px;
                    color: #fff;
                    font-size: 0.88rem;
                    font-weight: 700;
                    box-sizing: border-box;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .profile-input:focus { border-color: #14F195; }

                .profile-textarea {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 12px;
                    padding: 10px 12px;
                    color: #fff;
                    font-size: 0.85rem;
                    box-sizing: border-box;
                    outline: none;
                    resize: none;
                    height: 70px;
                }
                .profile-textarea:focus { border-color: #14F195; }

                .save-profile-btn {
                    width: 100%;
                    background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
                    color: #000;
                    font-weight: 900;
                    border: none;
                    padding: 12px;
                    border-radius: 14px;
                    font-size: 0.95rem;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(20, 241, 149, 0.2);
                    margin-top: 10px;
                    transition: transform 0.2s;
                }
                .save-profile-btn:active { transform: scale(0.97); }
            </style>

            <div class="profile-scroll-wrapper">
                <!-- 1. شريط التنقل العلوي -->
                <div class="profile-top-bar">
                    <button class="back-btn" onclick="if(typeof window.renderHomePage === 'function') window.renderHomePage();">
                        ${isRtl ? '➔ العودة للرئيسية' : '➔ Back'}
                    </button>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #fff;">
                        ${isRtl ? 'الملف الشخصي' : 'Profile'}
                    </h3>
                    <div style="width: 40px;"></div>
                </div>

                <!-- 2. الصورة الشخصية الدائرية -->
                <div class="profile-avatar-header">
                    <div class="profile-avatar-ring">
                        <div class="profile-avatar-inner">
                            <img id="profile-avatar-img" src="${avatarSrc}" alt="Avatar">
                        </div>
                    </div>
                    <div class="nft-avatar-hint">
                        🏷️ ${isRtl ? 'تتغير الصورة عند اقتناء NFT لاعب' : 'NFT Player Avatar'}
                    </div>
                </div>

                <!-- 3. بيانات الحساب الأساسية -->
                <div class="profile-card-box">
                    <div class="input-group">
                        <label class="input-label">${isRtl ? 'الاسم المستعار (عربي / إنجليزي)' : 'Display Nickname'}</label>
                        <input type="text" id="input-nickname" class="profile-input" value="${nickname}" placeholder="${isRtl ? 'أدخل اسمك المستعار' : 'Enter nickname'}">
                    </div>

                    <div class="input-group">
                        <label class="input-label">${isRtl ? 'اسم المستخدم (حصراً باللغة الإنجليزية)' : 'Username (English only)'}</label>
                        <input type="text" id="input-username" class="profile-input" value="${username}" dir="ltr" placeholder="username_123" oninput="this.value = this.value.replace(/[^a-zA-Z0-9_]/g, '');">
                    </div>

                    <div class="input-group">
                        <label class="input-label">${isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                        <input type="date" id="input-dob" class="profile-input" value="${state.dob}">
                    </div>
                </div>

                <!-- 4. الأندية المختارّة (مربوطة مع شاشة تسجيل الدخول) -->
                <div class="profile-card-box">
                    <label class="input-label" style="margin-bottom: 8px;">${isRtl ? 'أنديتك المفضلة (تم اختيارها عند الدخول)' : 'Your Selected Clubs'}</label>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${selectedClubsHtml}
                    </div>
                </div>

                <!-- 5. النبذة الشخصية (Bio) -->
                <div class="profile-card-box">
                    <div class="input-group">
                        <label class="input-label">${isRtl ? 'نبذة عنك (Bio)' : 'Bio'}</label>
                        <textarea id="input-bio" class="profile-textarea" placeholder="${isRtl ? 'اكتب نبذة قصيرة عنك...' : 'Write something about yourself...'}">${state.bio}</textarea>
                    </div>
                </div>

                <!-- 6. زر حفظ التغييرات -->
                <button class="save-profile-btn" onclick="window.saveProfileData()">
                    💾 ${isRtl ? 'حفظ التعديلات' : 'Save Profile'}
                </button>
            </div>
        `;

        // دالة حفظ التغييرات محلياً وتحديث كائن الحالة
        window.saveProfileData = function() {
            const newNickname = document.getElementById('input-nickname').value || nickname;
            const newUsername = document.getElementById('input-username').value || username;
            const newDob = document.getElementById('input-dob').value || state.dob;
            const newBio = document.getElementById('input-bio').value || state.bio;

            localStorage.setItem('zelo_nickname', newNickname);
            localStorage.setItem('zelo_username', newUsername);
            localStorage.setItem('zelo_dob', newDob);
            localStorage.setItem('zelo_bio', newBio);

            if (typeof userState !== 'undefined') {
                userState.nickname = newNickname;
                userState.username = newUsername;
                userState.dob = newDob;
                userState.bio = newBio;
            }

            alert(isRtl ? 'تم حفظ بيانات الملف الشخصي بنجاح! ✅' : 'Profile updated successfully! ✅');
        };

    } catch (err) {
        console.error("خطأ في عرض صفحة الملف الشخصي:", err);
    }
};
                                  
