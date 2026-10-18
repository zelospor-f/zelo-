const supabaseUrl = window.env?.SUPABASE_URL;
const supabaseKey = window.env?.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase && supabaseUrl && supabaseKey
    ? window.supabase.createClient(supabaseUrl, supabaseKey, { db: { schema: 'public' } })
    : null;

if (!supabaseClient) {
    console.warn("[ZELO] Supabase غير مُهيّأ: تحقق من env.js وتحميل مكتبة Supabase.");
}

let userState = {
    username: "Android Player",
    userParam: "",
    userId: "",
    photoUrl: null,
    points: 0,
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
    // تُهيّأ لاحقاً داخل onReady بعد التأكد من تحميل data.js
    tasks: []
};

// نجعل userState متاحة عبر window ليستخدمها side-drawer.js وباقي الملفات
window.userState = userState;

// دالة مساعدة للحصول على قيمة الترجمة مع قيمة احتياطية
function safeT(key, fallback) {
    try {
        if (typeof window.t === 'function') {
            const res = window.t(key);
            if (res && res !== key) return res;
        }
    } catch (e) {
        console.warn(`[ZELO] فشل تنفيذ الترجمة للمفتاح "${key}":`, e);
    }
    return fallback;
}

function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
}

onReady(() => {
    // تهيئة المهام بعد التأكد من أن data.js قد حُمّل
    if (typeof window.defaultTasksData !== "undefined" && Array.isArray(window.defaultTasksData)) {
        userState.tasks = window.defaultTasksData.map(task => ({ ...task }));
    }

    // الهوية تأتي من Supabase Auth: يضبط auth.js الـ userId بعد نجاح تسجيل الدخول
    userState.username = "";
    userState.userId = "";
    userState.userParam = "";

    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            if (session && session.user) {
                userState.userId = String(session.user.id);
                userState.userParam = userState.userId;
            }
        });
    }

    const savedLang = localStorage.getItem('app_lang') || localStorage.getItem('lang') || 'ar';
    userState.lang = savedLang.startsWith('ar') ? 'ar' : 'en';

    if (typeof applyLanguageSettings === 'function') applyLanguageSettings();

    // نقطة الدخول: auth.js يفحص الجلسة ثم يعرض تسجيل الدخول أو التطبيق
    if (typeof window.zeloStartAuth === 'function') {
        window.zeloStartAuth().catch(err => {
            console.error("[ZELO] خطأ غير متوقع أثناء تسجيل الدخول:", err);
            if (typeof window.renderAuthScreen === 'function') window.renderAuthScreen();
        });
    } else {
        console.error("[ZELO] auth.js غير محمّل");
        triggerLoginScreen();
    }
});

async function fetchDataAndRoute() {
    if (!supabaseClient) {
        triggerLoginScreen();
        return;
    }

    // لا يوجد مستخدم مسجّل بعد: نبدأ من تسجيل الدخول
    if (!userState.userId) {
        if (typeof window.zeloStartAuth === 'function') await window.zeloStartAuth();
        else triggerLoginScreen();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('user_id', userState.userId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            userState.points = Number(data.points) || 0;
            userState.selectedClubs = Array.isArray(data.selected_clubs) ? data.selected_clubs : [];
            userState.lang = data.lang || userState.lang;

            // جلب صورة المستخدم إن وُجدت في الجدول
            if (data.photo_url) {
                userState.photoUrl = data.photo_url;
            }

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
        console.error("[ZELO] فشل جلب بيانات المستخدم:", error);
        userState.hasLoggedIn = false;
    }

    if (!userState.hasLoggedIn || userState.selectedClubs.length === 0) {
        triggerLoginScreen();
    } else {
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
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: red;">
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

    // الرصيد الموحد: نقرأه من جدول users (نفس المصدر الذي تكتب فيه المهام والتوقعات)
    if (supabaseClient && userState.userId) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('points')
                .eq('user_id', String(userState.userId))
                .maybeSingle();

            if (error) throw error;

            if (data && data.points != null) {
                userState.points = Number(data.points) || 0;
            }
        } catch (error) {
            console.error("[ZELO] فشل جلب الرصيد:", error);
        }
    }

    if (pointsEl) {
        const displayPoints = Number(userState.points || 0);
        const localeLang = userState.lang === 'ar' ? 'ar-EG' : 'en-US';
        pointsEl.innerText = `🪙 ${displayPoints.toLocaleString(localeLang)} ZELOFC`;
    }

    if (clubEl && userState.selectedClubs.length > 0) {
        const logos = userState.selectedClubs.map(id => {
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
            return foundClub
                ? `<img src="${foundClub.logo}" alt="" style="height: 20px; vertical-align: middle; margin: 0 4px; object-fit: contain;">`
                : '';
        }).join('');

        const labelText = userState.lang === 'ar' ? 'أنديتك:' : 'Clubs:';
        clubEl.innerHTML = `<span style="color:#aaa;">${labelText}</span> ${logos}`;
    }

    // تحديث صورة الهيدر بعد جلب بيانات المستخدم
    if (typeof window.updateHeaderAvatar === 'function') window.updateHeaderAvatar();

    // تحديث رقم ZELO في الشريط العلوي فوراً
    if (typeof window.updateTopPoints === 'function') window.updateTopPoints();

    // تحديث شارة الإشعارات غير المقروءة بعد معرفة المستخدم
    if (typeof window.refreshNotifBadge === 'function') window.refreshNotifBadge();
}

function showPage(pageId) {
    if (!userState.hasLoggedIn) return;

    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const activeNav = Array.from(document.querySelectorAll(".nav-item"))
        .find(el => el.getAttribute("onclick")?.includes(`'${pageId}'`));
    if (activeNav) activeNav.classList.add("active");

    const contentDiv = document.getElementById("main-content");
    if (!contentDiv) return;
    contentDiv.innerHTML = "";

    // يستدعي أول دالة موجودة من القائمة، وإلا يعرض رسالة خطأ بدل صفحة فارغة
    const run = (...names) => {
        for (const name of names) {
            if (typeof window[name] === "function") {
                try {
                    window[name](contentDiv);
                } catch (e) {
                    console.error(`[ZELO] خطأ داخل ${name}:`, e);
                    contentDiv.innerHTML = `<div style="color:#ff4d4d; text-align:center; padding:30px;">Error in ${name}: ${e.message}</div>`;
                }
                return;
            }
        }
        console.error(`[ZELO] لا توجد دالة عرض للصفحة "${pageId}" (جُرّب: ${names.join(', ')})`);
        contentDiv.innerHTML = `<div style="color:#ff4d4d; text-align:center; padding:30px;">Page "${pageId}" failed to load.</div>`;
    };

    switch (pageId) {
        case 'home':        run('renderHomePage'); break;
        case 'matches':     run('renderMatchesPage', 'renderMatches', 'renderMatchPage'); break;
        case 'tasks':       run('renderTasksPage'); break;
        case 'friends':     run('renderFriendsPage'); break;
        case 'leaderboard': run('renderLeaderboardPage'); break;
        case 'wallet':      run('renderWalletPage'); break;
        case 'notifications': run('renderNotificationsPage'); break;
        case 'messages':
            if (typeof window.renderMessagesPage === 'function') {
                run('renderMessagesPage');
            } else {
                contentDiv.innerHTML = `<div style="text-align:center; padding:60px 20px; color:#94a3b8; font-weight:700;">
                    <div style="font-size:2.5rem; margin-bottom:10px;">💬</div>
                    ${userState.lang === 'ar' ? 'الرسائل — قريباً' : 'Messages — coming soon'}
                </div>`;
            }
            break;
        case 'news':
        case 'community':   run('renderCommunityPage', 'renderNewsPage'); break;
        case 'profile':     run('renderProfilePage'); break;
    }
}

// تعريف شاشة التحديات مرة واحدة فقط إذا لم تكن معرّفة في ملف آخر
if (typeof window.openChallengesScreen !== 'function') {
    window.openChallengesScreen = function () {
        const contentDiv = document.getElementById("main-content");
        if (!contentDiv) return;

        if (typeof renderChallengesScreen === "function") {
            renderChallengesScreen(contentDiv);
            return;
        }

        const isAr = userState.lang === 'ar';
        contentDiv.innerHTML = `
            <div style="padding: 30px 20px; text-align: center; color: white;">
                <h2 style="font-size: 2rem; margin-bottom: 15px;">⚽ ${isAr ? 'تحديات الأسبوع' : 'Weekly Challenges'}</h2>
                <p style="color: #ccc; margin-bottom: 25px;">${isAr ? 'قريباً سيتم عرض التحديات هنا...' : 'Challenges coming soon...'}</p>
                <button onclick="showPage('home')" class="btn-action" style="margin-top: 20px;">
                    ${isAr ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
            </div>
        `;
    };
                }
            
