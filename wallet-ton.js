
function t(key, fallback = '', params = {}) {
    let text = fallback || key;
    
    if (typeof window.getT === 'function') {
        const res = window.getT(key);
        if (res && res !== key) text = res;
    } else if (window.i18n && typeof window.i18n.t === 'function') {
        const res = window.i18n.t(key);
        if (res && res !== key) text = res;
    }
    
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(p => {
            text = text.replace(new RegExp(`{${p}}`, 'g'), params[p]);
        });
    }
    return text;
}

(function injectWalletStyles() {
    if (document.getElementById('wallet-core-styles')) return;
    const style = document.createElement('style');
    style.id = 'wallet-core-styles';
    style.innerHTML = `
        
        .btn-glass-ton, .btn-action-sm, .btn-danger-sm {
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            outline: none;
            font-family: inherit;
        }

        .wallet-glass-card {
            background: linear-gradient(135deg, rgba(28, 28, 34, 0.85), rgba(18, 18, 22, 0.95));
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 18px;
            padding: 16px;
            text-align: center;
            box-shadow: 0 8px 25px rgba(0,0,0,0.5);
            margin-bottom: 14px;
            color: #ffffff;
        }

        .wallet-header-flex {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            direction: rtl;
        }

        .wallet-logo-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            color: #ffffff;
        }

        .wallet-logo-sm {
            width: 32px; 
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            display: flex; 
            align-items: center; 
            justify-content: center;
            border: 1px solid rgba(255, 255, 255, 0.15);
            font-size: 1.1rem;
        }

        .address-box-sm {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 10px 12px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 0.85rem;
            color: #fcb045;
            margin-bottom: 12px;
            word-break: break-all;
            direction: ltr !important;
        }

        .btn-glass-ton {
            background: linear-gradient(135deg, #0098ea, #005580) !important;
            color: #ffffff !important; 
            border: none !important; 
            border-radius: 12px !important;
            padding: 12px 16px !important; 
            font-weight: bold !important; 
            font-size: 0.9rem !important;
            cursor: pointer !important; 
            width: 100% !important; 
            display: flex !important; 
            align-items: center !important; 
            justify-content: center !important; 
            gap: 8px !important;
            box-shadow: 0 4px 15px rgba(0, 152, 234, 0.3) !important;
            transition: transform 0.2s, background 0.2s;
        }

        .btn-glass-ton:active {
            transform: scale(0.97);
            background: linear-gradient(135deg, #0088cc, #004466) !important;
        }

        .btn-action-sm {
            background: rgba(255, 255, 255, 0.12) !important; 
            color: #ffffff !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important; 
            border-radius: 10px !important;
            padding: 8px 16px !important; 
            font-size: 0.85rem !important; 
            font-weight: bold !important; 
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        }

        .btn-action-sm:active {
            background: rgba(252, 176, 69, 0.25) !important;
            border-color: #fcb045 !important;
            transform: scale(0.95);
        }

        .btn-danger-sm {
            background: rgba(253, 29, 29, 0.2) !important; 
            color: #ff6b6b !important;
            border: 1px solid rgba(253, 29, 29, 0.4) !important; 
            border-radius: 10px !important;
            padding: 8px 16px !important; 
            font-size: 0.85rem !important; 
            font-weight: bold !important; 
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        }

        .btn-danger-sm:active {
            background: rgba(253, 29, 29, 0.4) !important;
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
})();

let isTonInitializing = false;

function initTonConnectUI() {
    if (window.tonConnectUI || isTonInitializing) return;
    
    if (typeof TON_CONNECT_UI !== 'undefined') {
        try {
            isTonInitializing = true;
            const currentLang = (typeof userState !== 'undefined' && userState?.lang) ? userState.lang : 'en';

            window.tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
                manifestUrl: 'https://starlingcoin.github.io/starling-app/tonconnect-manifest.json?v=9.0',
                twaReturnUrl: 'https://t.me/zelosportbot/app',
                buttonRootId: null,
                uiPreferences: {
                    language: currentLang === 'ar' ? 'ar' : 'en'
                }
            });

            let lastAddress = localStorage.getItem('ton_wallet_address') || '';
            
            window.tonConnectUI.onStatusChange((wallet) => {
                let newAddress = '';
                if (wallet && wallet.account) {
                    newAddress = wallet.account.address;
                    if (typeof userState !== 'undefined') {
                        userState.walletAddress = newAddress;
                        userState.tonWallet = newAddress;
                        userState.walletConnected = true;
                    }
                    localStorage.setItem('ton_wallet_address', newAddress);
                } else {
                    if (typeof userState !== 'undefined') {
                        userState.walletAddress = '';
                        userState.tonWallet = '';
                        userState.walletConnected = false;
                    }
                    localStorage.removeItem('ton_wallet_address');
                }

                if (newAddress !== lastAddress) {
                    lastAddress = newAddress;
                    const walletContainer = document.getElementById('main-content');
                    if (typeof renderWalletPage === 'function' && walletContainer) {
                        renderWalletPage(walletContainer);
                    }
                }
            });
        } catch (e) {
            console.error("TON Connect UI Init Error:", e);
        } finally {
            isTonInitializing = false;
        }
    }
}

if (!window.TON_CONNECT_UI && !document.getElementById('ton-connect-script')) {
    const script = document.createElement('script');
    script.id = 'ton-connect-script';
    script.src = 'https://cdn.jsdelivr.net/npm/@tonconnect/ui@latest/dist/tonconnect-ui.min.js';
    script.onload = () => { initTonConnectUI(); };
    document.head.appendChild(script);
} else {
    initTonConnectUI();
}


window.triggerConnect = async function() {
    if (window.tonConnectUI) {
        try {
            await window.tonConnectUI.openModal();
        } catch (e) {
            console.error("Open TON Modal Error:", e);
            alert(t('msgTonConnectError', '⚠️ تعذر فتح نافذة الاتصال بمحفظة TON.'));
        }
    } else {
        initTonConnectUI();
        setTimeout(() => {
            if (window.tonConnectUI) {
                window.tonConnectUI.openModal();
            } else {
                alert(t('msgTonScriptLoading', '⏳ جاري تحميل مكتبة المحفظة، يرجى المحاولة بعد لحظات.'));
            }
        }, 500);
    }
};

window.triggerDisconnect = async function() {
    if (window.tonConnectUI && window.tonConnectUI.connected) {
        try {
            await window.tonConnectUI.disconnect();
        } catch (e) {
            console.error("Disconnect Error:", e);
        }
    }
    localStorage.removeItem('ton_wallet_address');
    if (typeof userState !== 'undefined') {
        userState.walletAddress = '';
        userState.tonWallet = '';
        userState.walletConnected = false;
    }
    const walletContainer = document.getElementById('main-content');
    if (typeof renderWalletPage === 'function' && walletContainer) {
        renderWalletPage(walletContainer);
    }
};

window.copyWalletAddress = function(address) {
    const targetAddress = address || userState?.walletAddress || userState?.solanaWallet;
    if (!targetAddress) {
        alert(t('msgNoAddressToCopy', '⚠️ لا يوجد عنوان محفظة لنسخه.'));
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(targetAddress).then(() => {
            alert(t('msgAddressCopied', '📋 تم نسخ عنوان المحفظة بنجاح!'));
        }).catch(() => {
            fallbackCopyText(targetAddress);
        });
    } else {
        fallbackCopyText(targetAddress);
    }
};

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert(t('msgAddressCopied', '📋 تم نسخ عنوان المحفظة بنجاح!'));
    } catch (err) {
        alert(t('msgCopyFailed', '❌ تعذر نسخ العنوان تلقائياً.'));
    }
    document.body.removeChild(textArea);
}
