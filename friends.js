Window.generateReferralLink = function() {
    Let cleanUserId = "";
    If (typeof userState !== 'undefined' && userState.userId) {
        CleanUserId = String(userState.userId).replace(/[^\w\d]/g, '');
    }
    If (!cleanUserId) cleanUserId = "user";
    Return `https://t.me/Zelo_Sport_bot/app?startapp=ref_${cleanUserId}`;
};

Window.fetchFriendsFromDB = async function(userId) {
    If (typeof supabaseClient === 'undefined' || !supabaseClient) {
        Return [];
    }

    Try {
        Const searchUserId = String(userId).trim();
        If (!searchUserId) return [];

        Const { data: referrals, error: refError } = await supabaseClient
            .from('referrals')
            .select('referred_id, reward_points') 
            .eq('referrer_id', searchUserId);

        If (refError || !referrals || referrals.length === 0) return [];

        Const friendIds = referrals.map(r => String(r.referred_id));

        Const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('telegram_id, username, first_name')
            .in('telegram_id', friendIds);

        If (usersError) return [];

        Const { data: subReferrals, error: subRefError } = await supabaseClient
            .from('referrals')
            .select('referrer_id')
            .in('referrer_id', friendIds);

        Const inviteCounts = {};
        If (!subRefError && subReferrals) {
            SubReferrals.forEach(r => {
                Const refIdStr = String(r.referrer_id);
                InviteCounts[refIdStr] = (inviteCounts[refIdStr] || 0) + 1;
            });
        }

        Return referrals.map(ref => {
            Const friendInfo = users ? Users.find(u => String(u.telegram_id) === String(ref.referred_id)) : null;
            Let fallbackName = (typeof t === 'function' && t('newFriend') !== 'newFriend') ? T('newFriend') : "New Friend";
            Let name = fallbackName;
            
            If (friendInfo) {
                Name = friendInfo.first_name || friendInfo.username || fallbackName;
            }
            Return {
                Name: name,
                RewardPoints: ref.reward_points || 0, 
                ReferralsCount: inviteCounts[String(ref.referred_id)] || 0 
            };
        });

    } catch (error) {
        Return [];
    }
};

Window.renderFriendsPage = async function(container) {
    If (window.initReferralCheck) {
        Await window.initReferralCheck();
    }

    Const referralLink = window.generateReferralLink();
    Const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

    Const getTranslation = (key, defaultText) => {
        If (typeof t === 'function') {
            Const val = t(key);
            If (val && val !== key) return val;
        }
        Return defaultText;
    };

    Const commissionTitle = getTranslation('commissionTitle', isAr ? '🎁 نظام الأرباح والعمولة المستمرة (10%)' : '🎁 10% Continuous Commission');
    Const commissionDesc = getTranslation('commissionDesc', isAr 
        ? 'شارك رابط الإحالة الخاص بك، وستحصل تلقائياً وبشكل مستمر على عمولة بنسبة <b style="color:#00FF87;">10%</b> من رصيد النقاط التي يجمعونها أثناء لعبهم!' 
        : 'Share your link and earn a lifetime <b style="color:#00FF87;">10%</b> commission from all points collected by your invited friends!');

    Const borderSide = isAr ? 'border-right' : 'border-left';

    Container.innerHTML = `
        <style>
            .zelo-info-card {
                Background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(16, 185, 129, 0.08));
                Backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                Border: 1px solid rgba(0, 255, 135, 0.25);
                Border-radius: 16px;
                Padding: 16px;
                Margin-bottom: 20px;
                Box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                ${borderSide}: 4px solid #00FF87;
            }

            .zelo-link-card {
                Background: rgba(20, 20, 28, 0.75);
                Backdrop-filter: blur(16px);
                Border: 1px solid rgba(255, 255, 255, 0.08);
                Border-radius: 16px;
                Padding: 18px 16px;
                Margin-bottom: 25px;
                Box-shadow: 0 8px 25px rgba(0,0,0,0.6);
                Text-align: center;
            }

            .link-text-box {
                Background: rgba(10, 10, 15, 0.8);
                Color: #00FF87;
                Font-size: 0.85rem;
                Font-weight: bold;
                Padding: 12px 14px;
                Border-radius: 12px;
                Border: 1px solid rgba(0, 255, 135, 0.2);
                Margin-bottom: 16px;
                Box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
                Display: flex;
                Align-items: center;
                Justify-content: center;
                Gap: 8px;
            }

            .action-buttons-wrapper {
                Display: flex; 
                Gap: 10px; 
                Justify-content: center;
            }

            .btn-sleek {
                Padding: 12px 16px;
                Border-radius: 12px;
                Font-weight: bold;
                Font-size: 0.88rem;
                Cursor: pointer;
                Flex: 1;
                Display: flex;
                Align-items: center;
                Justify-content: center;
                Gap: 6px;
                Border: none;
                Transition: all 0.2s ease;
            }

            .btn-copy-sleek {
                Background: rgba(255, 255, 255, 0.08);
                Color: #fff;
                Border: 1px solid rgba(255, 255, 255, 0.2);
                Backdrop-filter: blur(10px);
            }
            .btn-copy-sleek:hover { background: rgba(255, 255, 255, 0.15); }
            .btn-copy-sleek:active { transform: scale(0.95); }

            .btn-share-vibrant {
                Background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                Color: #fff;
                Box-shadow: 0 4px 15px rgba(42, 171, 238, 0.35);
            }
            .btn-share-vibrant:hover {
                Box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
                Transform: translateY(-2px);
            }
            .btn-share-vibrant:active { transform: scale(0.95); }

            .zelo-friend-row {
                Display: flex; justify-content: space-between; align-items: center;
                Background: rgba(25, 25, 35, 0.6);
                Backdrop-filter: blur(12px);
                Padding: 12px 16px; margin-bottom: 10px;
                Border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);
            }

            .empty-state-glass {
                Text-align: center; padding: 30px 15px;
                Background: rgba(255,255,255,0.02);
                Border-radius: 16px; border: 1px dashed rgba(255,255,255,0.15);
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

    Const friendsListContainer = document.getElementById('friends-list-container');
    Const friendsCountTitle = document.getElementById('friends-count-title');

    Try {
        Const currentId = (typeof userState !== 'undefined' && userState.userId) ? UserState.userId : null;
        Const realFriends = currentId ? Await window.fetchFriendsFromDB(currentId) : [];
        
        FriendsCountTitle.innerText = `${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء' : 'Joined Friends')} (${realFriends.length})`;

        If (realFriends.length > 0) {
            FriendsListContainer.style.textAlign = isAr ? 'right' : 'left';
            
            FriendsListContainer.innerHTML = realFriends.map(friend => `
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
            FriendsListContainer.innerHTML = `
                <div class="empty-state-glass">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.7;">🤝</span>
                    <p style="color: #aaa; margin: 0; font-size: 0.85rem; line-height: 1.5; font-weight: bold;">
                        ${getTranslation('emptyFriendsState', isAr ? 'لم تقم بدعوة أي أصدقاء حتى الآن.<br>انشر رابطك لتفعيل عمولتك المستمرة!' : "You haven't invited any friends yet.<br>Share your link to activate your continuous commission!")}
                    </p>
                </div>
            `;
        }
    } catch (error) {
        FriendsCountTitle.innerText = `${getTranslation('friendsList', isAr ? 'قائمة الأصدقاء المنضمين' : 'Joined Friends List')} (0)`;
        FriendsListContainer.innerHTML = `<div class="empty-state-glass"><span style="color: #ef4444; font-size: 0.85rem; font-weight: bold;">${getTranslation('dbConnectionError', isAr ? '❌ فشل الاتصال. يرجى المحاولة لاحقاً.' : "❌ Connection failed. Please try again.")}</span></div>`;
    }
};

Window.copyToClipboard = function(text) {
    Navigator.clipboard.writeText(text).then(() => {
        Let isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');
        Let alertMsg = (typeof t === 'function' && t('alertCopied') !== 'alertCopied') ? T('alertCopied') : (isAr ? 'تم نسخ الرابط بنجاح! 🔗' : 'Link copied successfully! 🔗');
        
        Const linkBox = document.getElementById('ref-link-box');
        If(linkBox) {
            LinkBox.style.background = 'rgba(0, 255, 135, 0.2)';
            SetTimeout(() => { linkBox.style.background = 'rgba(10, 10, 15, 0.8)'; }, 300);
        }
        
        Alert(alertMsg);
    });
};

Window.shareOnTelegram = function(link) {
    Let isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');
    Const defaultShareText = isAr 
        ? 'توقع نتائج أهم المباريات واجمع المكافآت والعملات الرقمية معي مجاناً في Zelo Sport! 🏆' 
        : 'Predict match results and earn crypto rewards with me on Zelo Sport! 🏆';
    
    Const text = encodeURIComponent(((typeof t === 'function' && t('shareText') !== 'shareText') ? T('shareText') : defaultShareText));
    
    If (navigator.share) {
        Navigator.share({
            Title: 'ZELO FC',
            Text: decodeURIComponent(text),
            Url: link
        }).catch(() => {});
    } else {
        Const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
        If (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
            Window.Telegram.WebApp.openTelegramLink(shareUrl); 
        } else {
            Window.open(shareUrl, '_blank');
        }
    }
};

Window.apiProcessReferral = async function(referrerId, newUserId) {
    If (typeof supabaseClient === 'undefined' || !supabaseClient) {
        Return { success: false, message: "No database connection" };
    }

    Const cleanReferrer = String(referrerId).trim();
    Const cleanNewUser = String(newUserId).trim();

    If (!cleanReferrer || !cleanNewUser) {
        Return { success: false, message: "Invalid ID format" };
    }

    If (cleanReferrer === cleanNewUser) {
        Return { success: false, message: "Self referral not allowed" };
    }

    Try {
        Const { data, error: refError } = await supabaseClient
            .from('referrals')
            .insert([{ 
                Referrer_id: cleanReferrer, 
                Referred_id: cleanNewUser, 
                Reward_points: 0,
                Total_commission: 0
            }]);

        If (refError) {
            If (refError.code === '23505') {
                LocalStorage.removeItem('pending_referrer_id');
                Return { success: true, alreadyProcessed: true };
            } 
            Return { success: false, error: refError };
        }

        LocalStorage.removeItem('pending_referrer_id');
        Return { success: true, message: "Referral recorded successfully" };

    } catch (error) {
        Return { success: false };
    }
};

Window.initReferralCheck = async function() {
    Try {
        Let referrerId = null;
        Let currentUserId = null;

        If (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
            Const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
            If (initDataUnsafe.start_param) {
                ReferrerId = initDataUnsafe.start_param;
            }
            If (initDataUnsafe.user && initDataUnsafe.user.id) {
                CurrentUserId = initDataUnsafe.user.id;
            }
        }

        If (!referrerId) {
            Const urlParams = new URLSearchParams(window.location.search);
            ReferrerId = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('ref');
        }

        If (referrerId && typeof referrerId === 'string') {
            ReferrerId = referrerId.replace(/^(rref_|ref_)/, '').trim();
            If (referrerId) {
                LocalStorage.setItem('pending_referrer_id', referrerId);
            }
        } else {
            ReferrerId = localStorage.getItem('pending_referrer_id');
        }

        If (!currentUserId && typeof userState !== 'undefined' && userState.userId) {
            CurrentUserId = userState.userId;
        }

        If (!currentUserId) {
            SetTimeout(window.initReferralCheck, 600);
            Return;
        }

        If (referrerId && String(referrerId) !== String(currentUserId)) {
            Await window.apiProcessReferral(referrerId, currentUserId);
        }
    } catch (err) {}
};

(function() {
    If (document.readyState === 'complete' || document.readyState === 'interactive') {
        Window.initReferralCheck();
    } else {
        Document.addEventListener('DOMContentLoaded', () => window.initReferralCheck());
    }
})();
    
