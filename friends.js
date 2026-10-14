window.generateReferralLink = function() {
    let cleanUserId = "";
    if (typeof userState !== 'undefined' && userState.userId) {
        cleanUserId = String(userState.userId).replace(/[^\w\d]/g, '');
    }
    if (!cleanUserId) cleanUserId = "user";
    return `https://t.me/Zelo_Sport_bot/app?startapp=ref_${cleanUserId}`;
};

window.fetchFriendsFromDB = async function(userId) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        return [];
    }

    try {
        const searchUserId = String(userId).trim();
        if (!searchUserId) return [];

        const { data: referrals, error: refError } = await supabaseClient
            .from('referrals')
            .select('referred_id, reward_points')
            .eq('referrer_id', searchUserId);

        if (refError || !referrals || referrals.length === 0) return [];

        const friendIds = referrals.map(r => String(r.referred_id));

        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('user_id, username, first_name')
            .in('user_id', friendIds);

        if (usersError) return [];

        const { data: subReferrals, error: subRefError } = await supabaseClient
            .from('referrals')
            .select('referrer_id')
            .in('referrer_id', friendIds);

        const inviteCounts = {};
        if (!subRefError && subReferrals) {
            subReferrals.forEach(r => {
                const refIdStr = String(r.referrer_id);
                inviteCounts[refIdStr] = (inviteCounts[refIdStr] || 0) + 1;
            });
        }

        return referrals.map(ref => {
            const friendInfo = users ? users.find(u => String(u.user_id) === String(ref.referred_id)) : null;
            let fallbackName = (typeof t === 'function' && t('newFriend') !== 'newFriend') ? t('newFriend') : "New Friend";
            let name = fallbackName;

            if (friendInfo) {
                name = friendInfo.first_name || friendInfo.username || fallbackName;
            }
            return {
                name: name,
                rewardPoints: ref.reward_points || 0,
                referralsCount: inviteCounts[String(ref.referred_id)] || 0
            };
        });

    } catch (error) {
        return [];
    }
};

window.renderFriendsPage = async function(container) {
    if (window.initReferralCheck) {
        await window.initReferralCheck();
    }

    const referralLink = window.generateReferralLink();
    const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

    const getTranslation = (key, defaultText) => {
        if (typeof t === 'function') {
            const val = t(key);
            if (val && val !== key) return val;
        }
        return defaultText;
    };

    const commissionTitle = getTranslation('commissionTitle', isAr ? '🎁 نظام الأرباح والعمولة المستمرة (10%)' : '🎁 10% Continuous Commission');
    const commissionDesc = getTranslation('commissionDesc', isAr
        ? 'شارك رابط الإحالة الخاص بك، وستحصل تلقائياً وبشكل مستمر على عمولة بنسبة <b style="color:#00FF87;">10%</b> من رصيد النقاط التي يجمعونها أثناء لعبهم!'
        : 'Share your link and earn a lifetime <b style="color:#00FF87;">10%</b> commission from all points collected by your invited friends!');

    const borderSide = isAr ? 'border-right' : 'border-left';

    container.innerHTML = `
        <style>
            .ref-head {
                display: grid;
                grid-template-columns: 1fr 90px 74px;
                gap: 8px;
                padding: 0 12px 8px 12px;
                font-size: 0.68rem;
                font-weight: 800;
                letter-spacing: 0.5px;
                color: #7a7f9a;
                text-align: center;
            }
            .ref-head .head-reward { color: #7CF7C4; }

            .info-card {
                background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                border: 1px solid rgba(90, 110, 255, 0.35);
                border-radius: 16px;
                padding: 14px 16px;
                margin-bottom: 16px;
                box-shadow: 0 0 12px rgba(80, 100, 255, 0.12);
                ${borderSide}: 4px solid #00FF87;
            }

            .link-card {
                background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                border: 1px solid rgba(90, 110, 255, 0.35);
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 20px;
                box-shadow: 0 0 14px rgba(80, 100, 255, 0.15);
                text-align: center;
            }

            .link-text-box {
                background: rgba(0, 0, 0, 0.45);
                color: #00FF87;
                font-size: 0.82rem;
                font-weight: 800;
                padding: 12px 14px;
                border-radius: 12px;
                border: 1px solid rgba(0, 255, 135, 0.25);
                margin-bottom: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: background 0.3s;
            }

            .action-buttons-wrapper { display: flex; gap: 10px; justify-content: center; }

            .btn-sleek {
                padding: 11px 14px;
                border-radius: 12px;
                font-weight: 900;
                font-size: 0.84rem;
                cursor: pointer;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                border: none;
                transition: transform 0.2s ease;
            }
            .btn-sleek:active { transform: scale(0.96); }

            .btn-copy-sleek {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .btn-share-vibrant {
                background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                color: #fff;
                box-shadow: 0 4px 14px rgba(42, 171, 238, 0.35);
            }

            .friend-row {
                display: grid;
                grid-template-columns: 1fr 90px 74px;
                align-items: center;
                gap: 8px;
                background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                border: 1px solid rgba(90, 110, 255, 0.35);
                border-radius: 16px;
                padding: 10px 12px;
                margin-bottom: 10px;
                box-shadow: 0 0 12px rgba(80, 100, 255, 0.12), inset 0 0 10px rgba(0,0,0,0.3);
                transition: transform 0.2s;
            }
            .friend-row:active { transform: scale(0.985); }

            .friend-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .friend-icon {
                width: 44px; height: 44px; min-width: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                display: flex; align-items: center; justify-content: center;
                font-size: 1.2rem;
                box-shadow: 0 0 14px rgba(42, 171, 238, 0.35);
            }
            .friend-name { color: #fff; font-weight: 800; font-size: 0.82rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .friend-invites {
                display: inline-block; margin-top: 3px;
                color: #7CF7C4; font-size: 0.66rem; font-weight: 700;
                background: rgba(0, 255, 135, 0.1);
                border: 1px solid rgba(0, 255, 135, 0.25);
                padding: 1px 6px; border-radius: 6px;
            }

            .reward-col { text-align: center; }
            .reward-num {
                font-size: 1rem; font-weight: 900;
                background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            }
            .reward-unit { color: #94a3b8; font-size: 0.6rem; font-weight: 700; }

            .commission-chip {
                width: 100%; text-align: center;
                background: linear-gradient(135deg, #00FF87, #14B8A6);
                color: #04110B; font-size: 0.62rem; font-weight: 900;
                padding: 7px 4px; border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,255,135,0.3);
            }

            .empty-state-glass {
                text-align: center; padding: 30px 15px;
                background: rgba(20, 22, 48, 0.8);
                border-radius: 16px;
                border: 1px dashed rgba(90, 110, 255, 0.4);
            }
        </style>

        <div style="text-align: center; margin-bottom: 18px;">
            <h2 style="background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 5px 0; font-size: 1.3rem; font-weight: 900;">
                🤝 ${getTranslation('referralTitle', isAr ? 'نظام الدعوات' : 'Referral System')}
            </h2>
            <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold;">
                ${getTranslation('referralSub', isAr ? 'انشر رابطك وابدأ في جني الأرباح حية!' : 'Share your link and earn live rewards!')}
            </p>
        </div>

        <div class="info-card" style="text-align: ${isAr ? 'right' : 'left'};">
            <h4 style="margin: 0 0 6px 0; color: #fff; font-size: 0.92rem; font-weight: 900;">${commissionTitle}</h4>
            <p style="margin: 0; color: #cbd5e1; font-size: 0.74rem; line-height: 1.6;">${commissionDesc}</p>
        </div>

        <div class="link-card">
            <div class="link-text-box" id="ref-link-box">
                ⚡ <span>${isAr ? 'ادعُ أصدقاءك وانمُ بفريقك اليوم!' : 'Invite your friends & grow your team today!'}</span>
            </div>
            <div class="action-buttons-wrapper">
                <button class="btn-sleek btn-copy-sleek" onclick="window.copyToClipboard('${referralLink}')">
                    📋 ${getTranslation('btnCopy', isAr ? 'نسخ الرابط' : 'Copy Link')}
                </button>
                <button class="btn-sleek btn-share-vibrant" onclick="window.shareOnTelegram('${referralLink}')">
                    🚀 ${getTranslation('btnShare', isAr ? 'مشاركة' : 'Share')}
                </button>
            </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
            <span style="font-size: 1rem;">👥</span>
            <h4 style="color: #fff; margin: 0; font-size: 0.98rem; font-weight: 800;" id="friends-count-title">
                ${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء المنضمين' : 'Joined Friends List')} (⏳)
            </h4>
        </div>

        <div class="ref-head">
            <div>${isAr ? 'الصديق' : 'FRIEND'}</div>
            <div class="head-reward">${isAr ? 'العمولة' : 'COMMISSION'}</div>
            <div>${isAr ? 'الدعوات' : 'INVITES'}</div>
        </div>

        <div id="friends-list-container" style="padding-bottom: 30px;">
            <div style="padding: 30px; text-align: center; color: #00FF87; font-size: 0.85rem; font-weight: bold;">
                ${getTranslation('fetchingFriends', isAr ? '⏳ جاري جلب الأبطال...' : '⏳ Fetching friends...')}
            </div>
        </div>
    `;

    const friendsListContainer = document.getElementById('friends-list-container');
    const friendsCountTitle = document.getElementById('friends-count-title');

    try {
        const currentId = (typeof userState !== 'undefined' && userState.userId) ? userState.userId : null;
        const realFriends = currentId ? await window.fetchFriendsFromDB(currentId) : [];

        friendsCountTitle.innerText = `${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء' : 'Joined Friends')} (${realFriends.length})`;

        if (realFriends.length > 0) {
            friendsListContainer.innerHTML = realFriends.map(friend => `
                <div class="friend-row">
                    <div class="friend-main">
                        <div class="friend-icon">👤</div>
                        <div style="min-width: 0; text-align: ${isAr ? 'right' : 'left'};">
                            <div class="friend-name">${friend.name}</div>
                            <span class="friend-invites">${getTranslation('invites', isAr ? 'قام بدعوة:' : 'Invited:')} ${friend.referralsCount}</span>
                        </div>
                    </div>
                    <div class="reward-col">
                        <div class="reward-num">+${(friend.rewardPoints || 0).toLocaleString()}</div>
                        <div class="reward-unit">🏆 ZELO</div>
                    </div>
                    <div>
                        <div class="commission-chip">${getTranslation('commission', isAr ? 'عمولة' : 'Commission')}</div>
                    </div>
                </div>
            `).join('');
        } else {
            friendsListContainer.innerHTML = `
                <div class="empty-state-glass">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.7;">🤝</span>
                    <p style="color: #94a3b8; margin: 0; font-size: 0.85rem; line-height: 1.5; font-weight: bold;">
                        ${getTranslation('emptyFriendsState', isAr ? 'لم تقم بدعوة أي أصدقاء حتى الآن.<br>انشر رابطك لتفعيل عمولتك المستمرة!' : "You haven't invited any friends yet.<br>Share your link to activate your continuous commission!")}
                    </p>
                </div>
            `;
        }
    } catch (error) {
        friendsCountTitle.innerText = `${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء المنضمين' : 'Joined Friends List')} (0)`;
        friendsListContainer.innerHTML = `<div class="empty-state-glass"><span style="color: #ef4444; font-size: 0.85rem; font-weight: bold;">${getTranslation('dbConnectionError', isAr ? '❌ فشل الاتصال. يرجى المحاولة لاحقاً.' : "❌ Connection failed. Please try again.")}</span></div>`;
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        let isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');
        let alertMsg = (typeof t === 'function' && t('alertCopied') !== 'alertCopied') ? t('alertCopied') : (isAr ? 'تم نسخ الرابط بنجاح! 🔗' : 'Link copied successfully! 🔗');

        const linkBox = document.getElementById('ref-link-box');
        if (linkBox) {
            linkBox.style.background = 'rgba(0, 255, 135, 0.2)';
            setTimeout(() => { linkBox.style.background = 'rgba(0, 0, 0, 0.45)'; }, 300);
        }

        alert(alertMsg);
    });
};

window.shareOnTelegram = function(link) {
    let isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');
    const defaultShareText = isAr
        ? 'توقع نتائج أهم المباريات واجمع المكافآت والعملات الرقمية معي مجاناً في Zelo Sport! 🏆'
        : 'Predict match results and earn crypto rewards with me on Zelo Sport! 🏆';

    const text = encodeURIComponent(((typeof t === 'function' && t('shareText') !== 'shareText') ? t('shareText') : defaultShareText));

    if (navigator.share) {
        navigator.share({
            title: 'ZELO FC',
            text: decodeURIComponent(text),
            url: link
        }).catch(() => {});
    } else {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    }
};

window.apiProcessReferral = async function(referrerId, newUserId) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        return { success: false, message: "No database connection" };
    }

    const cleanReferrer = String(referrerId).trim();
    const cleanNewUser = String(newUserId).trim();

    if (!cleanReferrer || !cleanNewUser) {
        return { success: false, message: "Invalid ID format" };
    }

    if (cleanReferrer === cleanNewUser) {
        return { success: false, message: "Self referral not allowed" };
    }

    try {
        const { data, error: refError } = await supabaseClient
            .from('referrals')
            .insert([{
                referrer_id: cleanReferrer,
                referred_id: cleanNewUser,
                reward_points: 0,
                total_commission: 0
            }]);

        if (refError) {
            if (refError.code === '23505') {
                localStorage.removeItem('pending_referrer_id');
                return { success: true, alreadyProcessed: true };
            }
            return { success: false, error: refError };
        }

        localStorage.removeItem('pending_referrer_id');
        return { success: true, message: "Referral recorded successfully" };

    } catch (error) {
        return { success: false };
    }
};

window.initReferralCheck = async function() {
    try {
        let referrerId = null;
        let currentUserId = null;

        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
            if (initDataUnsafe.start_param) {
                referrerId = initDataUnsafe.start_param;
            }
            if (initDataUnsafe.user && initDataUnsafe.user.id) {
                currentUserId = initDataUnsafe.user.id;
            }
        }

        if (!referrerId) {
            const urlParams = new URLSearchParams(window.location.search);
            referrerId = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('ref');
        }

        if (referrerId && typeof referrerId === 'string') {
            referrerId = referrerId.replace(/^(rref_|ref_)/, '').trim();
            if (referrerId) {
                localStorage.setItem('pending_referrer_id', referrerId);
            }
        } else {
            referrerId = localStorage.getItem('pending_referrer_id');
        }

        if (!currentUserId && typeof userState !== 'undefined' && userState.userId) {
            currentUserId = userState.userId;
        }

        if (!currentUserId) {
            setTimeout(window.initReferralCheck, 600);
            return;
        }

        if (referrerId && String(referrerId) !== String(currentUserId)) {
            await window.apiProcessReferral(referrerId, currentUserId);
        }
    } catch (err) {}
};

(function() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.initReferralCheck();
    } else {
        document.addEventListener('DOMContentLoaded', () => window.initReferralCheck());
    }
})();
