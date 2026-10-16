(function() {
    // 1. قائمة المهام الافتراضية
    window.defaultTasksData = [
        { id: "connect_x", textAr: "ربط حسابك في منصة X (مهمة خاصة)", textEn: "Connect X Account (VIP)", points: 1000, completed: false, url: "https://x.com/Zelo_Sport", platform: "X", color: "x" },
        { id: "pump_fun", textAr: "دعم وشراء عملة ZELO FC على Pump.fun", textEn: "Support & Buy ZELO FC on Pump.fun", points: 1500, completed: false, url: "https://pump.fun/coin/BBQmpKimKwAHBoJN2TyRG2CSEYRZhkxfksu1D1q9pump", platform: "PUMP.FUN", color: "pump" },
        { id: "x", textAr: "متابعة حساب Zelo Sport على X", textEn: "Follow Zelo Sport on X", points: 500, completed: false, url: "https://x.com/Zelo_Sport", platform: "X", color: "x" },
        { id: "tg_channel", textAr: "الانضمام لقناة تليجرام", textEn: "Join Telegram Channel", points: 400, completed: false, url: "https://t.me/ZeloSport", platform: "TELEGRAM", color: "tg" },
        { id: "youtube", textAr: "الاشتراك في اليوتيوب", textEn: "Subscribe on YouTube", points: 600, completed: false, url: "https://www.youtube.com/@Zelo_Sport", platform: "YOUTUBE", color: "yt" },
        { id: "tg_group_ar", textAr: "الانضمام للمجموعة العربية", textEn: "Join Arabic Group", points: 300, completed: false, url: "https://t.me/ZeloSport_Arab", platform: "TELEGRAM", color: "tg" },
        { id: "tg_group_en", textAr: "الانضمام للمجموعة الأجنبية", textEn: "Join Global Group", points: 300, completed: false, url: "https://t.me/ZeloSport_Global", platform: "TELEGRAM", color: "tg" }
    ];


    // نظام الإحالات في referrals.js (zeloClaimReferralReward)

    async function apiVerifyTask(taskId, points) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return { success: false, message: "No database connection" };

        try {
            const currentUserId = userState.userId;
            const { error: taskError } = await supabaseClient
                .from('user_tasks')
                .insert([{ user_id: currentUserId, task_id: taskId, reward_points: points }]);

            if (taskError) {
                if (taskError.code === '23505') return { success: true, alreadyDone: true };
                throw taskError;
            }

            let currentPoints = 0;
            const { data: userData, error: fetchError } = await supabaseClient
                .from('users')
                .select('points')
                .eq('user_id', currentUserId);

            if (!fetchError && userData && userData.length > 0) {
                currentPoints = parseInt(userData[0].points) || 0;
            }

            const pointsToAdd = parseInt(points) || 0;
            const newPoints = currentPoints + pointsToAdd;

            const { error: userUpsertError } = await supabaseClient
                .from('users')
                .upsert({ user_id: currentUserId, points: newPoints }, { onConflict: 'user_id' });

            if (userUpsertError) throw userUpsertError;

            const { data: clubData, error: clubFetchError } = await supabaseClient
                .from('club_fans_rankings')
                .select('total_fan_points')
                .eq('user_id', currentUserId);

            if (!clubFetchError && clubData && clubData.length > 0) {
                const { error: clubUpdateError } = await supabaseClient
                    .from('club_fans_rankings')
                    .update({ total_fan_points: newPoints })
                    .eq('user_id', currentUserId);

                if (clubUpdateError) console.error("Error updating club points:", clubUpdateError);
            }

            await window.zeloClaimReferralReward(); // أول كسب للمدعو => مكافأة المحيل
            return { success: true, alreadyDone: false };
        } catch (error) {
            console.error("Error verifying task and updating points:", error);
            return { success: false };
        }
    }

    window.claimDaily = async function() {
        const btnDaily = document.getElementById('btn-daily-claim');
        const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

        if (btnDaily) {
            btnDaily.disabled = true;
            btnDaily.innerHTML = isAr ? '⏳ جاري الاستلام...' : '⏳ Claiming...';
        }

        const result = await apiClaimDaily();
        if (result.success) {
            userState.dailyCheckInClaimed = true;
            userState.points = (userState.points || 0) + result.pointsAdded;

            if (typeof updateTopBar === "function") updateTopBar();
            alert(isAr ? `تم استلام مكافأة الحضور اليومي بنجاح (+${result.pointsAdded} عملة).` : `Daily reward claimed successfully (+${result.pointsAdded} Coins).`);
            renderTasksPage(document.getElementById("main-content"));
        } else {
            alert(isAr ? 'فشل استلام المكافأة اليومية، حاول لاحقاً.' : 'Failed to claim daily reward, try again later.');
            if (btnDaily) {
                btnDaily.disabled = false;
                btnDaily.innerHTML = isAr ? 'استلام ✨' : 'Claim ✨';
            }
        }
    };

    async function apiClaimDaily() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return { success: false };
        const dailyPoints = 200;

        try {
            const currentUserId = userState.userId;
            let currentPoints = 0;
            const { data: userData, error: fetchError } = await supabaseClient
                .from('users')
                .select('points')
                .eq('user_id', currentUserId);

            if (!fetchError && userData && userData.length > 0) {
                currentPoints = parseInt(userData[0].points) || 0;
            }

            const newPoints = currentPoints + dailyPoints;

            const { error: updateError } = await supabaseClient
                .from('users')
                .update({ points: newPoints, last_daily_claim: new Date().toISOString() })
                .eq('user_id', currentUserId);

            if (updateError) throw updateError;

            const { data: clubData, error: clubFetchError } = await supabaseClient
                .from('club_fans_rankings')
                .select('total_fan_points')
                .eq('user_id', currentUserId);

            if (!clubFetchError && clubData && clubData.length > 0) {
                await supabaseClient
                    .from('club_fans_rankings')
                    .update({ total_fan_points: newPoints })
                    .eq('user_id', currentUserId);
            }

            await window.zeloClaimReferralReward(); // أول كسب للمدعو => مكافأة المحيل
            return { success: true, pointsAdded: dailyPoints };
        } catch (error) {
            console.error("Error claiming daily reward:", error);
            return { success: false };
        }
    }

    async function syncTasksFromDB() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !userState.userId) return;

        if (!userState.tasks || userState.tasks.length === 0) {
            userState.tasks = window.defaultTasksData.map(t => ({...t}));
        }

        try {
            const currentUserId = userState.userId;
            const { data: tasksData } = await supabaseClient
                .from('user_tasks')
                .select('task_id')
                .eq('user_id', currentUserId);

            if (tasksData) {
                const completedIds = tasksData.map(t => t.task_id);
                userState.tasks.forEach(task => {
                    if (completedIds.includes(task.id)) task.completed = true;
                });
            }

            const { data: userData } = await supabaseClient
                .from('users')
                .select('last_daily_claim')
                .eq('user_id', currentUserId)
                .single();

            if (userData && userData.last_daily_claim) {
                const lastClaim = new Date(userData.last_daily_claim);
                const now = new Date();
                const diffHours = Math.abs(now.getTime() - lastClaim.getTime()) / 36e5;
                userState.dailyCheckInClaimed = (diffHours < 24);
            } else {
                userState.dailyCheckInClaimed = false;
            }
        } catch (error) {
            console.error("Error syncing task data:", error);
        }
    }

    // ألوان وأيقونات كل منصة
    const PLATFORM_STYLES = {
        x:    { icon: '𝕏',  bg: 'linear-gradient(135deg, #3a3a44, #111118)', glow: 'rgba(255,255,255,0.25)', text: '#fff' },
        tg:   { icon: '✈',  bg: 'linear-gradient(135deg, #2AABEE, #1E6FD9)', glow: 'rgba(42,171,238,0.45)', text: '#fff' },
        yt:   { icon: '▶',  bg: 'linear-gradient(135deg, #FF3B3B, #B91C1C)', glow: 'rgba(255,59,59,0.45)', text: '#fff' },
        pump: { icon: '💊', bg: 'linear-gradient(135deg, #14F195, #0E9F6E)', glow: 'rgba(20,241,149,0.45)', text: '#000' }
    };

    window.renderTasksPage = async function(container) {
        if (!userState.tasks || userState.tasks.length === 0) {
            userState.tasks = window.defaultTasksData.map(t => ({...t}));
        }

        const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');
        const borderSide = isAr ? 'border-right' : 'border-left';

        const styles = `
            <style>
                .zelo-daily-compact {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(16, 185, 129, 0.12));
                    border: 1px solid rgba(0, 255, 135, 0.3);
                    border-radius: 16px;
                    padding: 12px 16px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                    ${borderSide}: 4px solid #00FF87;
                }
                .tasks-head {
                    display: grid;
                    grid-template-columns: 1fr 90px 96px;
                    gap: 8px;
                    padding: 0 12px 8px 12px;
                    font-size: 0.68rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    color: #7a7f9a;
                    text-align: center;
                }
                .tasks-head .head-reward { color: #7CF7C4; }
                .task-row {
                    display: grid;
                    grid-template-columns: 1fr 90px 96px;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, rgba(20, 22, 48, 0.95), rgba(12, 14, 32, 0.95));
                    border: 1px solid rgba(90, 110, 255, 0.35);
                    border-radius: 16px;
                    padding: 10px 12px;
                    margin-bottom: 10px;
                    box-shadow: 0 0 12px rgba(80, 100, 255, 0.12), inset 0 0 10px rgba(0,0,0,0.3);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .task-row:active { transform: scale(0.985); }
                .task-row.done { border-color: rgba(0, 255, 135, 0.45); box-shadow: 0 0 12px rgba(0,255,135,0.15); }
                .task-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
                .task-icon {
                    width: 44px; height: 44px; min-width: 44px;
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; font-weight: 900;
                }
                .task-title { color: #fff; font-size: 0.82rem; font-weight: 800; line-height: 1.3; }
                .task-platform { color: #7a7f9a; font-size: 0.66rem; font-weight: 700; margin-top: 2px; letter-spacing: 0.4px; }
                .task-reward { text-align: center; }
                .reward-num {
                    font-size: 1rem; font-weight: 900;
                    background: linear-gradient(90deg, #2AABEE, #8B5CF6, #00FF87);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .reward-unit { color: #94a3b8; font-size: 0.6rem; font-weight: 700; }
                .task-action { display: flex; justify-content: center; }
                .btn-task-go {
                    background: linear-gradient(135deg, #00FF87, #14B8A6);
                    color: #04110B; border: none;
                    padding: 8px 10px; border-radius: 10px;
                    font-weight: 900; font-size: 0.72rem; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,255,135,0.3);
                    width: 100%;
                }
                .btn-task-done {
                    background: rgba(255,255,255,0.06); color: #64748b;
                    border: 1px solid rgba(255,255,255,0.08);
                    padding: 8px 10px; border-radius: 10px;
                    font-weight: 900; font-size: 0.72rem; cursor: not-allowed; width: 100%;
                }
                .daily-btn { width: auto; padding: 8px 14px; }
            </style>
        `;

        container.innerHTML = styles + `<div style="text-align:center; padding:50px; color: #00FF87; font-weight:bold;">⏳ ${isAr ? 'جاري تحميل المهام...' : 'Loading tasks...'}</div>`;

        await syncTasksFromDB();

        const tasksHtml = userState.tasks.map(task => {
            let style = PLATFORM_STYLES.tg;
            if (task.color === 'x') style = PLATFORM_STYLES.x;
            else if (task.color === 'yt') style = PLATFORM_STYLES.yt;
            else if (task.color === 'pump') style = PLATFORM_STYLES.pump;

            const btnClass = task.completed ? 'btn-task-done' : 'btn-task-go';
            const btnText = task.completed ? (isAr ? 'مكتمل ✅' : 'Done ✅') : (isAr ? 'انطلق 🚀' : 'Go 🚀');
            const btnState = task.completed ? 'disabled' : '';

            let buttonAction = `onclick="executeTask('${task.id}', '${task.url}', ${task.points})"`;
            if (task.id === 'connect_x') {
                buttonAction = `onclick="startXLogin('${task.id}', ${task.points})"`;
            }

            return `
                <div class="task-row ${task.completed ? 'done' : ''}">
                    <div class="task-main">
                        <div class="task-icon" style="background: ${style.bg}; color: ${style.text}; box-shadow: 0 0 14px ${style.glow};">
                            ${style.icon}
                        </div>
                        <div style="min-width: 0; text-align: ${isAr ? 'right' : 'left'};">
                            <div class="task-title">${isAr ? task.textAr : task.textEn}</div>
                            <div class="task-platform">${task.platform || ''}</div>
                        </div>
                    </div>

                    <div class="task-reward">
                        <div class="reward-num">+${task.points}</div>
                        <div class="reward-unit">ZELO</div>
                    </div>

                    <div class="task-action">
                        <button id="btn-task-${task.id}" class="${btnClass}" ${buttonAction} ${btnState}>
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = styles + `
            <div style="text-align: center; margin-bottom: 18px;">
                <h2 style="background: linear-gradient(135deg, #2AABEE, #00FF87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 4px 0; font-size: 1.3rem; font-weight: 900;">
                    ${isAr ? 'مركز المكافآت' : 'Rewards Center'}
                </h2>
                <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold;">
                    ${isAr ? 'أكمل المهام اليومية لزيادة ثروتك من نقاط زيلو!' : 'Complete tasks to boost your ZELO points!'}
                </p>
            </div>

            <div class="zelo-daily-compact">
                <div style="text-align: ${isAr ? 'right' : 'left'}; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.4rem;">🎁</span>
                    <div>
                        <h4 style="margin: 0; color: #fff; font-size: 0.9rem; font-weight: 900;">
                            ${isAr ? 'المكافأة اليومية' : 'Daily Reward'}
                        </h4>
                        <p style="margin: 0; font-size: 0.72rem; color: #00FF87; font-weight: bold;">
                            +200 ZELO <span style="color: #94a3b8; font-weight: normal;">(${isAr ? 'كل 24 ساعة' : 'Every 24h'})</span>
                        </p>
                    </div>
                </div>

                <button id="btn-daily-claim"
                        class="${userState.dailyCheckInClaimed ? 'btn-task-done' : 'btn-task-go'} daily-btn"
                        onclick="claimDaily()"
                        ${userState.dailyCheckInClaimed ? 'disabled' : ''}>
                    ${userState.dailyCheckInClaimed ? (isAr ? 'تم ✅' : 'Claimed ✅') : (isAr ? 'استلام ✨' : 'Claim ✨')}
                </button>
            </div>

            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 10px;">
                <span style="font-size:1rem;">📋</span>
                <h4 style="color: #fff; margin: 0; font-size: 0.95rem; font-weight: 800;">${isAr ? 'المهام المتاحة' : 'Available Tasks'}</h4>
            </div>

            <div class="tasks-head">
                <div>${isAr ? 'المهمة' : 'TASK'}</div>
                <div class="head-reward">${isAr ? 'المكافأة' : 'REWARD'}</div>
                <div>${isAr ? 'الحالة' : 'STATUS'}</div>
            </div>

            <div class="tasks-container">${tasksHtml}</div>

            <div style="height: 20px;"></div>
        `;
    };

    window.startXLogin = async function(taskId, points) {
        const task = userState.tasks.find(t => t.id === taskId);
        const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

        if (!task || task.completed || task.isProcessing) return;

        task.isProcessing = true;
        const xAuthUrl = task.url && task.url !== '#' ? task.url : "https://x.com/Zelo_Sport";

        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
                window.Telegram.WebApp.openLink(xAuthUrl);
            } else {
                window.open(xAuthUrl, '_blank');
            }
        } catch (e) {
            window.open(xAuthUrl, '_blank');
        }

        const btn = document.getElementById(`btn-task-${taskId}`);
        if (btn) {
            btn.innerHTML = isAr ? "⏳ تحقق..." : "⏳ Verifying...";
            btn.className = "btn-task-done";
            btn.disabled = true;
        }

        setTimeout(async () => {
            try {
                const response = await apiVerifyTask(taskId, points);
                task.isProcessing = false;

                if (response.success) {
                    task.completed = true;

                    if (!response.alreadyDone) {
                        userState.points = (userState.points || 0) + points;
                        alert(`🎉 ${isAr ? 'تم ربط الحساب وإضافة النقاط بنجاح:' : 'X Account connected successfully:'} +${points} ZELO.`);
                    }

                    if (typeof updateTopBar === "function") updateTopBar();
                    renderTasksPage(document.getElementById("main-content"));
                } else {
                    alert(isAr ? "حدث خطأ أثناء الاتصال بـ X." : "An error occurred with X verification.");
                    if (btn) {
                        btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                        btn.className = "btn-task-go";
                        btn.disabled = false;
                    }
                }
            } catch (error) {
                task.isProcessing = false;
                if (btn) {
                    btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                    btn.className = "btn-task-go";
                    btn.disabled = false;
                     }
        }
    }, 4000);
    };

    window.executeTask = async function(taskId, url, points) {
        const task = userState.tasks.find(t => t.id === taskId);
        const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

        if (!task || task.completed || task.isProcessing) return;

        task.isProcessing = true;

        try {
            const tg = window.Telegram && window.Telegram.WebApp;
            if (tg && url.includes("t.me") && tg.openTelegramLink) {
                tg.openTelegramLink(url);
            } else if (tg && tg.openLink) {
                tg.openLink(url);
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            window.open(url, '_blank');
        }

        const btn = document.getElementById(`btn-task-${taskId}`);
        if (btn) {
            btn.innerHTML = isAr ? "⏳ تحقق..." : "⏳ Verifying...";
            btn.className = "btn-task-done";
            btn.disabled = true;
        }

        setTimeout(async () => {
            try {
                const response = await apiVerifyTask(taskId, points);
                task.isProcessing = false;

                if (response.success) {
                    task.completed = true;
                    if (!response.alreadyDone) {
                        userState.points = (userState.points || 0) + points;
                        alert(`🎉 ${isAr ? 'تم إكمال المهمة وإضافة النقاط:' : 'Task completed:'} +${points} ZELO.`);
                    }
                    if (typeof updateTopBar === "function") updateTopBar();
                    renderTasksPage(document.getElementById("main-content"));
                } else {
                    alert(isAr ? "حدث خطأ أثناء التحقق من المهمة." : "An error occurred verifying the task.");
                    if (btn) {
                        btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                        btn.className = "btn-task-go";
                        btn.disabled = false;
                    }
                }
            } catch (error) {
                task.isProcessing = false;
                if (btn) {
                    btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                    btn.className = "btn-task-go";
                    btn.disabled = false;
                }
            }
        }, 4000);
    };

})();
