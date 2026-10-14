const supabaseUrl = window.env?.SUPABASE_URL;
const supabaseKey = window.env?.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase && supabaseUrl && supabaseKey ? window.supabase.createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' }
}) : null;

let userState = {
    username: "Android Player",
    userParam: "",
    userId: "",
    photoUrl: null,
    points: 0,
    coins: 0,
    selectedClubs: [],
    walletConnected: false,
    walletAddress: null,
    solanaWallet: "",
    walletBalance: "0.00",
    hasLoggedIn: false,
    lang: "ar",
    referrals: [],
    dailyCheckInClaimed: false,
    pendingReferrer: null,
    tasks: typeof window.defaultTasksData !== "undefined" ? window.defaultTasksData.map(task => ({...task})) : []
};

function safeT(key, fallback) {
    try {
        if (typeof window.t === 'function') {
            const res = window.t(key);
            if (res && res !== key) return res;
        }
    } catch (e) {
    }
    return fallback;
}

document.addEventListener("DOMContentLoaded", () => {
    // توليد معرّف رقمي فريد ومحلي لتطبيق الأندرويد
    const numericFallbackId = Math.floor(100000000 + Math.random() * 900000000).toString();
    const localFallbackId = localStorage.getItem('zelo_user_id') || numericFallbackId;
    localStorage.setItem('zelo_user_id', localFallbackId);

    userState.username = "Android Player";
    userState.userId = localFallbackId;
    userState.userParam = localFallbackId;

    var savedLang = localStorage.getItem('app_lang') || localStorage.getItem('lang') || 'ar';
    userState.lang = savedLang.startsWith('ar') ? 'ar' : 'en';

    if (typeof applyLanguageSettings === 'function') applyLanguageSettings();
    fetchDataAndRoute();
});

async function fetchDataAndRoute() {
    if (!supabaseClient) {
        triggerLoginScreen();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('user_id', userState.userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data) {
            userState.points = data.points || 0;
            userState.coins = data.points || 0;
            userState.selectedClubs = data.selected_clubs || [];

            userState.lang = data.lang || userState.lang;
            if (typeof applyLanguageSettings === 'function') applyLanguageSettings();

            userState.hasLoggedIn = true;

            if (data.wallet_address) {
                userState.walletAddress = data.wallet_address;
                userState.walletConnected = true;
            }

            if (userState.pendingReferrer && typeof window.apiProcessReferral === "function") {
                window.apiProcessReferral(userState.pendingReferrer, userState.userId);
                userState.pendingReferrer = null;
            }

        } else {
            userState.hasLoggedIn = false;
        }
    } catch (error) {
        userState.hasLoggedIn = false;
    }

    if (!userState.hasLoggedIn || !userState.selectedClubs || userState.selectedClubs.length === 0) {
        triggerLoginScreen();
    } else {
        userState.hasLoggedIn = true;
        await updateTopBar();
        showPage('home');
    }
}

function triggerLoginScreen() {
    const topBar = document.getElementById('top-bar');
    const bottomNav = document.getElementById('bottom-nav');
    if (topBar) topBar.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';

    if (typeof renderLoginScreen === 'function') {
        renderLoginScreen();
    } else {
        const contentDiv = document.getElementById("main-content");
        if (contentDiv) {
            contentDiv.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">
                <h3>System Error</h3>
                <p>Login screen is missing. Please check login.js</p>
            </div>`;
        }
    }
}

async function updateTopBar() {
    const topBar = document.getElementById("top-bar");
    const bottomNav = document.getElementById("bottom-nav");
    if (topBar) topBar.style.display = "flex";
    if (bottomNav) bottomNav.style.display = "flex";

    const pointsEl = document.getElementById("points");
    const clubEl = document.getElementById("club");

    if (typeof supabaseClient !== 'undefined' && supabaseClient !== null && userState.userId) {
        try {
            const { data } = await supabaseClient
                .from('club_fans_rankings')
                .select('total_fan_points')
                .eq('user_id', userState.userId)
                .maybeSingle();

            if (data && data.total_fan_points !== undefined && data.total_fan_points !== null) {
                if (!userState.points) {
                    userState.points = data.total_fan_points;
                    userState.coins = data.total_fan_points;
                }
            }
        } catch (error) {
        }
    }

    if (pointsEl) {
        const displayPoints = Number(userState.points || 0);
        const localeLang = (userState.lang === 'ar') ? 'ar-EG' : 'en-US';
        pointsEl.innerText = `🪙 ${displayPoints.toLocaleString(localeLang)} ZELOFC`;
    }

    if (clubEl && userState.selectedClubs && userState.selectedClubs.length > 0) {
        let logos = userState.selectedClubs.map(id => {
            let foundClub = null;
            if (typeof allWorldCupCountriesClubs !== 'undefined') {
                for (const country in allWorldCupCountriesClubs) {
                    const club = allWorldCupCountriesClubs[country].find(c => String(c.id) === String(id));
                    if (club) {
                        foundClub = club;
                        break;
                    }
                }
            }
            return foundClub ? `<img src="${foundClub.logo}" style="height: 20px; vertical-align: middle; margin: 0 4px; object-fit: contain;">` : '';
        }).join('');

        const labelText = (userState.lang === 'ar') ? 'أنديتك:' : 'Clubs:';
        clubEl.innerHTML = `<span style="color:#aaa;">${labelText}</span> ${logos}`;
    }
}

function showPage(pageId) {
    if (!userState.hasLoggedIn) return;
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const activeNav = Array.from(document.querySelectorAll(".nav-item")).find(el => el.getAttribute("onclick")?.includes(pageId));
    if (activeNav) activeNav.classList.add("active");

    const contentDiv = document.getElementById("main-content");
    if (!contentDiv) return;
    contentDiv.innerHTML = "";

    switch (pageId) {
        case 'home':
            if (typeof renderHomePage === "function") renderHomePage(contentDiv);
            break;
        case 'tasks':
            if (typeof renderTasksPage === "function") renderTasksPage(contentDiv);
            break;
        case 'friends':
            if (typeof renderFriendsPage === "function") renderFriendsPage(contentDiv);
            break;
        case 'leaderboard':
            if (typeof renderLeaderboardPage === "function") renderLeaderboardPage(contentDiv);
            break;
        case 'wallet':
            if (typeof renderWalletPage === "function") {
                renderWalletPage(contentDiv);
            } else {
                contentDiv.innerHTML = `<div style="color:white; text-align:center; padding:30px;">Loading Wallet...</div>`;
                setTimeout(() => {
                    if (typeof renderWalletPage === "function") {
                        renderWalletPage(contentDiv);
                    } else {
                        contentDiv.innerHTML = `<div style="color:#ff4d4d; text-align:center; padding:30px;">Error: Wallet module failed to load. Please refresh.</div>`;
                    }
                }, 200);
            }
            break;
    }
}

if (typeof window.openChallengesScreen !== 'function') {
    window.openChallengesScreen = function() {
        const contentDiv = document.getElementById("main-content");
        if (contentDiv) {
            if (typeof renderChallengesScreen === "function") {
                renderChallengesScreen(contentDiv);
            } else {
                contentDiv.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center; color: white;">
                        <h2 style="font-size: 2rem; margin-bottom: 15px;">⚽ ${userState.lang === 'ar' ? 'تحديات الأسبوع' : 'Weekly Challenges'}</h2>
                        <p style="color: #ccc; margin-bottom: 25px;">${userState.lang === 'ar' ? 'قريباً سيتم عرض التحديات هنا...' : 'Challenges coming soon...'}</p>
                        <button onclick="showPage('home')" class="btn-action" style="margin-top: 20px;">
                            ${userState.lang === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
                        </button>
                    </div>
                `;
            }
        }
    };
}
