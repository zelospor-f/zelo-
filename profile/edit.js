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
                    <button class="back-btn" onclick="window.closeEditProfile()">${tr('ui_text_2', '➔', '←')}</button>
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
