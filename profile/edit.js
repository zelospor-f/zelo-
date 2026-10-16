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
                    <button class="back-btn" onclick="window.closeEditProfile()">${ar ? '➔' : '←'}</button>
                    <div class="edit-title">${ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</div>
                    <button class="edit-save" onclick="window.saveProfileData()">${ar ? 'حفظ' : 'Save'}</button>
                </div>

                <div class="card hero">
                    <div class="wall">${P.wallHtml(matched)}</div>
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
                    <label>${ar ? 'الاسم المستعار' : 'Nickname'}</label>
                    <input id="input-nick" maxlength="30" value="${esc(d.nickname)}" placeholder="${ar ? 'اسمك الذي يظهر للآخرين' : 'Your display name'}">
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
        else alert(isAr() ? 'صفحة NFT غير محمّلة' : 'NFT page is not loaded');
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
                photo_url: draft.photoUrl || null,
                badge_club: draft.badgeClub || null
            }, { onConflict: 'user_id' });
            if (error) { dbOk = false; dbMsg = error.message; console.error('profile save error', error); }
        }

        alert(dbOk
            ? (ar ? 'تم حفظ الملف الشخصي بنجاح ✅' : 'Profile saved successfully ✅')
            : ((ar ? 'تم الحفظ محلياً، لكن قاعدة البيانات رفضت: ' : 'Saved locally, database rejected: ') + dbMsg));
        S.mode = 'view';
        P.redraw();
    };
})();
