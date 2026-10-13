window.generateReferralLink = function() {
    let cleanUserId = "";
    if (typeof userState !== 'undefined' && userState.userId) {
        cleanUserId = String(userState.userId).replace(/[^\d]/g, '');
    }
    if (!cleanUserId) cleanUserId = "user";
    return `https://t.me/Zelo_Sport_bot/app?startapp=ref_${cleanUserId}`;
};

window.fetchFriendsFromDB = async function(userId) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        return [];
    }

    try {
        const numericUserId = parseInt(String(userId).replace(/[^\d]/g, ''), 10);
        if (isNaN(numericUserId)) return [];

        const { data: referrals, error: refError } = await supabaseClient
            .from('referrals')
            .select('referred_id, reward_points') 
            .eq('referrer_id', numericUserId);

        if (refError || !referrals || referrals.length === 0) return [];

        const friendIds = referrals.map(r => parseInt(String(r.referred_id).replace(/[^\d]/g, ''), 10)).filter(id => !isNaN(id));

        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('telegram_id, username, first_name')
            .in('telegram_id', friendIds);

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
            const friendInfo = users ? users.find(u => String(u.telegram_id) === String(ref.referred_id)) : null;
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
            .zelo-info-card {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(16, 185, 129, 0.08));
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(0, 255, 135, 0.25);
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 20px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                ${borderSide}: 4px solid #00FF87;
            }

            .zelo-link-card {
                background: rgba(20, 20, 28, 0.75);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 18px 16px;
                margin-bottom: 25px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.6);
                text-align: center;
            }

            .link-text-box {
                background: rgba(10, 10, 15, 0.8);
                color: #00FF87;
                font-size: 0.85rem;
                font-weight: bold;
                padding: 12px 14px;
                border-radius: 12px;
                border: 1px solid rgba(0, 255, 135, 0.2);
                margin-bottom: 16px;
                box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .action-buttons-wrapper {
                display: flex; 
                gap: 10px; 
                justify-content: center;
            }

            .btn-sleek {
                padding: 12px 16px;
                border-radius: 12px;
                font-weight: bold;
                font-size: 0.88rem;
                cursor: pointer;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                border: none;
                transition: all 0.2s ease;
            }

            .btn-copy-sleek {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
            }
            .btn-copy-sleek:hover { background: rgba(255, 255, 255, 0.15); }
            .btn-copy-sleek:active { transform: scale(0.95); }

            .btn-share-vibrant {
                background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                color: #fff;
                box-shadow: 0 4px 15px rgba(42, 171, 238, 0.35);
            }
            .btn-share-vibrant:hover {
                box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
                transform: translateY(-2px);
            }
            .btn-share-vibrant:active { transform: scale(0.95); }

            .zelo-friend-row {
                display: flex; justify-content: space-between; align-items: center;
                background: rgba(25, 25, 35, 0.6);
                backdrop-filter: blur(12px);
                padding: 12px 16px; margin-bottom: 10px;
                border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);
            }

            .empty-state-glass {
                text-align: center; padding: 30px 15px;
                background: rgba(255,255,255,0.02);
                border-radius: 16px; border: 1px dashed rgba(255,255,255,0.15);
            }
        </style>

        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 5px 0; font-size: 1.3rem; font-weight: 900;">
                🤝 ${getTranslation('referralTitle', isAr ? 'نظام الدعوات' : 'Referral System')}
            </h2>
            <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold;">
                ${getTranslation('referralSub', isAr ? 'انشر رابطك وابدأ في جني الأرباح حية!' : 'Share your link and earn live rewards!')}
            </p>
        </div>
        
        <div class="zelo-info-card" style="text-align: ${isAr ? 'right' : 'left'};">
            <h4 style="margin: 0 0 6px 0; color: #fff; font-size: 0.95rem; font-weight: 900;">${commissionTitle}</h4>
            <p style="margin: 0; color: #cbd5e1; font-size: 0.75rem; line-height: 1.6;">${commissionDesc}</p>
        </div>

        <div class="zelo-link-card">
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

        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
            <span style="font-size: 1rem;">👥</span>
            <h4 style="color: #fff; margin: 0; font-size: 1rem; font-weight: 800;" id="friends-count-title">
                ${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء المنضمين' : 'Joined Friends List')} (⏳)
            </h4>
        </div>
        
        <div id="friends-list-container" style="text-align: center; padding-bottom: 30px;">
            <div style="padding: 30px; color: #00FF87; font-size: 0.85rem; font-weight: bold;">
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
            friendsListContainer.style.textAlign = isAr ? 'right' : 'left';
            
            friendsListContainer.innerHTML = realFriends.map(friend => `
                <div class="zelo-friend-row">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: linear-gradient(135deg, rgba(42, 171, 238, 0.2), rgba(139, 92, 246, 0.2)); width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid rgba(0, 255, 135, 0.2);">
                            👤
                        </div>
                        <div>
                            <div style="color: #fff; font-weight: 800; font-size: 0.9rem;">${friend.name}</div>
                            <div style="color: #94a3b8; font-size: 0.7rem; font-weight: bold; margin-top: 2px;">
                                ${getTranslation('invites', isAr ? 'قام بدعوة:' : 'Invited:')} <span style="color:#00FF87;">${friend.referralsCount}</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: ${isAr ? 'left' : 'right'};">
                        <div style="color: #00FF87; font-size: 0.95rem; font-weight: 900; font-family: monospace; text-shadow: 0 0 8px rgba(0, 255, 135, 0.4);">
                            +${(friend.rewardPoints || 0).toLocaleString()} 🏆
                        </div>
                        <div style="color: #8B5CF6; font-size: 0.65rem; font-weight: bold; margin-top: 2px;">
                            ${getTranslation('commission', isAr ? 'عمولة مكتسبة' : 'Commission')}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            friendsListContainer.innerHTML = `
                <div class="empty-state-glass">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.7;">🤝</span>
                    <p style="color: #aaa; margin: 0; font-size: 0.85rem; line-height: 1.5; font-weight: bold;">
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
        if(linkBox) {
            linkBox.style.background = 'rgba(0, 255, 135, 0.2)';
            setTimeout(() => { linkBox.style.background = 'rgba(10, 10, 15, 0.8)'; }, 300);
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
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
    
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(shareUrl); 
    } else {
        window.open(shareUrl, '_blank');
    }
};

window.apiProcessReferral = async function(referrerId, newUserId) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        return { success: false, message: "No database connection" };
    }

    const cleanReferrer = String(referrerId).replace(/[^\d]/g, '');
    const cleanNewUser = String(newUserId).replace(/[^\d]/g, '');

    const numReferrerId = parseInt(cleanReferrer, 10);
    const numNewUserId = parseInt(cleanNewUser, 10);

    if (isNaN(numReferrerId) || isNaN(numNewUserId)) {
        return { success: false, message: "Invalid ID format" };
    }

    if (numReferrerId === numNewUserId) {
        return { success: false, message: "Self referral not allowed" };
    }

    try {
        const { data, error: refError } = await supabaseClient
            .from('referrals')
            .insert([{ 
                referrer_id: numReferrerId, 
                referred_id: numNewUserId, 
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

        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            webApp.ready();

            const initDataUnsafe = webApp.initDataUnsafe;
            if (initDataUnsafe) {
                if (initDataUnsafe.start_param) {
                    referrerId = initDataUnsafe.start_param;
                }
                if (initDataUnsafe.user && initDataUnsafe.user.id) {
                    currentUserId = initDataUnsafe.user.id;
                }
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
    
