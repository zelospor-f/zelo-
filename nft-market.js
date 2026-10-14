window.renderNftMarketPage = function(container) {
    let target = container || document.getElementById('app') || document.getElementById('main-content') || document.body;
    if (!target) return;

    try {
        const currentLang = localStorage.getItem('app_lang') || 'ar';
        const isRtl = currentLang.startsWith('ar');
        const dir = isRtl ? 'rtl' : 'ltr';
        const textAlign = isRtl ? 'right' : 'left';

        // قائمة بطاقات الـ NFTs المتاحة للاعبين الأساطير
        const nftItems = [
            {
                id: 'nft_messi',
                name: 'Messi GOAT Edition',
                category: isRtl ? 'أسطورة الأرجنتين وبرشلونة' : 'Legendary GOAT',
                price: '1.5 SOL',
                rarity: 'LEGENDARY',
                icon: '🐐',
                boost: '+25% Fan Points Multiplier'
            },
            {
                id: 'nft_cr7',
                name: 'CR7 Prime Century',
                category: isRtl ? 'ماكينة الأهداف التاريخية' : 'Prime Striker',
                price: '1.2 SOL',
                rarity: 'RARE',
                icon: '⚡',
                boost: '+20% Fan Points Multiplier'
            },
            {
                id: 'nft_zidane',
                name: 'Zidane Maestro Icon',
                category: isRtl ? 'سحر خط الوسط' : 'Midfield Maestro',
                price: '0.9 SOL',
                rarity: 'EPIC',
                icon: '👑',
                boost: '+15% Fan Points Multiplier'
            },
            {
                id: 'nft_ronaldinho',
                name: 'Ronaldinho Joga Bonito',
                category: isRtl ? 'متعة كرة القدم وسحرها' : 'Skill Icon',
                price: '0.8 SOL',
                rarity: 'RARE',
                icon: '🪄',
                boost: '+12% Fan Points Multiplier'
            }
        ];

        target.innerHTML = `
            <style>
                .nft-market-wrapper {
                    width: 100%;
                    max-height: calc(100vh - 80px);
                    overflow-y: auto;
                    padding: 16px 16px 90px 16px;
                    box-sizing: border-box;
                    background: radial-gradient(circle at 10% 10%, rgba(153, 69, 255, 0.15) 0%, transparent 40%),
                                radial-gradient(circle at 90% 90%, rgba(20, 241, 149, 0.12) 0%, transparent 40%),
                                #08090C;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    direction: ${dir};
                }
                .nft-market-wrapper::-webkit-scrollbar { display: none; }

                /* شريط التنقل العلوي */
                .nft-top-bar {
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

                /* شبكة بطاقات الـ NFTs */
                .nft-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .nft-item-card {
                    background: rgba(18, 18, 24, 0.75);
                    border: 1px solid rgba(153, 69, 255, 0.25);
                    border-radius: 18px;
                    padding: 14px 12px;
                    text-align: center;
                    backdrop-filter: blur(12px);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    transition: transform 0.2s;
                }
                .nft-item-card:active { transform: scale(0.97); }

                .nft-rarity-badge {
                    position: absolute; top: 10px; right: 10px;
                    background: linear-gradient(90deg, #9945FF, #14F195);
                    font-size: 0.55rem; font-weight: 900; color: #000;
                    padding: 2px 6px; border-radius: 6px;
                }

                .nft-icon-circle {
                    width: 65px; height: 65px; margin: 10px auto;
                    border-radius: 50%; background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 2rem; border: 2px solid rgba(20, 241, 149, 0.3);
                    box-shadow: 0 0 15px rgba(20, 241, 149, 0.15);
                }

                .nft-buy-btn {
                    width: 100%;
                    background: linear-gradient(135deg, #14F195 0%, #00bc70 100%);
                    color: #000;
                    font-weight: 900;
                    border: none;
                    padding: 8px;
                    border-radius: 10px;
                    font-size: 0.78rem;
                    cursor: pointer;
                    margin-top: 10px;
                    box-shadow: 0 3px 10px rgba(20, 241, 149, 0.25);
                }
                .nft-buy-btn:active { transform: scale(0.95); }
            </style>

            <div class="nft-market-wrapper">
                <!-- 1. شريط العودة والعنوان -->
                <div class="nft-top-bar">
                    <button class="back-btn" onclick="if(typeof window.renderHomePage === 'function') window.renderHomePage();">
                        ${isRtl ? '➔ العودة للرئيسية' : '➔ Back'}
                    </button>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: #14F195;">
                        👑 ${isRtl ? 'سوق بطاقات اللاعبين (NFTs)' : 'Player NFTs Market'}
                    </h3>
                    <div style="width: 40px;"></div>
                </div>

                <!-- 2. بانر ترحيبي تفاعلي -->
                <div style="background: rgba(153,69,255,0.12); border: 1px solid rgba(153,69,255,0.3); border-radius: 16px; padding: 12px 16px; margin-bottom: 16px; text-align: center;">
                    <div style="font-size: 0.85rem; font-weight: 900; color: #fff; margin-bottom: 2px;">
                        ${isRtl ? 'اقتنِ بطاقات الأساطير واربح مكاسب حقيقية' : 'Collect Legends & Earn Real Rewards'}
                    </div>
                    <div style="font-size: 0.72rem; color: #94a3b8;">
                        ${isRtl ? 'تملك بطاقات اللاعبين لتعزيز نقاطك اليومية واستخدامها كصور بروفايل مميزة.' : 'Own player cards to boost your daily points and use as profile avatars.'}
                    </div>
                </div>

                <!-- 3. قائمة البطاقات المعروضة -->
                <div class="nft-grid">
                    ${nftItems.map(item => `
                        <div class="nft-item-card">
                            <span class="nft-rarity-badge">${item.rarity}</span>
                            <div>
                                <div class="nft-icon-circle">${item.icon}</div>
                                <div style="font-size: 0.85rem; font-weight: 900; color: #fff; margin-top: 4px;">${item.name}</div>
                                <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">${item.category}</div>
                            </div>
                            <div style="margin-top: 10px;">
                                <div style="font-size: 0.82rem; font-weight: 900; color: #14F195; font-family: monospace;">${item.price}</div>
                                <button class="nft-buy-btn" onclick="window.buyPlayerNft('${item.id}', '${item.name}', '${item.price}')">
                                    🛒 ${isRtl ? 'شراء البطاقة' : 'Buy Card'}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // دالة محاكاة الشراء واختيار البطاقة كبروفايل
        window.buyPlayerNft = function(nftId, nftName, price) {
            const confirmMsg = isRtl 
                ? `هل تريد تأكيد شراء بطاقة (${nftName}) بقيمة ${price} عبر شبكة Solana؟` 
                : `Confirm purchase of (${nftName}) for ${price} on Solana?`;
            
            if (confirm(confirmMsg)) {
                alert(isRtl ? 'تم شراء البطاقة بنجاح وإضافتها إلى ملفك الشخصي! 🎉' : 'NFT purchased successfully and added to your profile! 🎉');
            }
        };

    } catch (e) {
        console.error("خطأ في عرض سوق الـ NFTs:", e);
    }
};
