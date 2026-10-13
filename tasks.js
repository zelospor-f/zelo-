

(function() {
    // 1. Default tasks list
    window.defaultTasksData = [
        { id: "connect_x", textAr: "ربط حسابك في منصة X (مهمة خاصة)", textEn: "Connect X Account (VIP)", points: 1000, completed: false, url: "https://x.com/Zelo_Sport" },
        { id: "pump_fun", textAr: "دعم وشراء عملة ZELO FC على Pump.fun", textEn: "Support & Buy ZELO FC on Pump.fun", points: 1500, completed: false, url: "https://pump.fun/coin/BBQmpKimKwAHBoJN2TyRG2CSEYRZhkxfksu1D1q9pump" },
        { id: "x", textAr: "متابعة حساب Zelo Sport على X", textEn: "Follow Zelo Sport on X", points: 500, completed: false, url: "https://x.com/Zelo_Sport" },
        { id: "tg_channel", textAr: "الانضمام لقناة تليجرام", textEn: "Join Telegram Channel", points: 400, completed: false, url: "https://t.me/ZeloSport" },
        { id: "youtube", textAr: "الاشتراك في اليوتيوب", textEn: "Subscribe on YouTube", points: 600, completed: false, url: "https://www.youtube.com/@Zelo_Sport" },
        { id: "tg_group_ar", textAr: "الانضمام للمجموعة العربية", textEn: "Join Arabic Group", points: 300, completed: false, url: "https://t.me/ZeloSport_Arab" },
        { id: "tg_group_en", textAr: "الانضمام للمجموعة الأجنبية", textEn: "Join Global Group", points: 300, completed: false, url: "https://t.me/ZeloSport_Global" }
    ];


    async function apiVerifyTask(taskId, points) {
        if (!supabaseClient) return { success: false, message: "No database connection" };
        
        try {
            const { error: taskError } = await supabaseClient
                .from('user_tasks')
                .insert([{ telegram_id: userState.userId, task_id: taskId, reward_points: points }]);

            if (taskError) {
                if (taskError.code === '23505') return { success: true, alreadyDone: true }; 
                throw taskError;
            }

            let currentPoints = 0;
            const { data: userData, error: fetchError } = await supabaseClient
                .from('users')
                .select('points')
                .eq('telegram_id', userState.userId);

            if (!fetchError && userData && userData.length > 0) {
                currentPoints = parseInt(userData[0].points) || 0;
            }

            const pointsToAdd = parseInt(points) || 0;
            const newPoints = currentPoints + pointsToAdd;

            const { error: userUpsertError } = await supabaseClient
                .from('users')
                .upsert(
                    { telegram_id: userState.userId, points: newPoints },
                    { onConflict: 'telegram_id' }
                );

            if (userUpsertError) throw userUpsertError;

            const { data: clubData, error: clubFetchError } = await supabaseClient
                .from('club_fans_rankings')
                .select('total_fan_points')
                .eq('telegram_id', userState.userId);

            if (!clubFetchError && clubData && clubData.length > 0) {
                const { error: clubUpdateError } = await supabaseClient
                    .from('club_fans_rankings')
                    .update({ total_fan_points: newPoints })
                    .eq('telegram_id', userState.userId);

                if (clubUpdateError) console.error("Error updating club points:", clubUpdateError);
            }

            return { success: true, alreadyDone: false };
        } catch (error) {
            console.error("Error verifying task and updating points:", error);
            return { success: false };
        }
    }

    async function apiClaimDaily() {
        if (!supabaseClient) return { success: false };
        const dailyPoints = 200; 

        try {
            let currentPoints = 0;
            const { data: userData, error: fetchError } = await supabaseClient
                .from('users')
                .select('points')
                .eq('telegram_id', userState.userId);

            if (!fetchError && userData && userData.length > 0) {
                currentPoints = parseInt(userData[0].points) || 0;
            }

            const newPoints = currentPoints + dailyPoints;

            const { error: updateError } = await supabaseClient
                .from('users')
                .update({ 
                    points: newPoints,
                    last_daily_claim: new Date().toISOString() 
                })
                .eq('telegram_id', userState.userId);

            if (updateError) throw updateError;

            const { data: clubData, error: clubFetchError } = await supabaseClient
                .from('club_fans_rankings')
                .select('total_fan_points')
                .eq('telegram_id', userState.userId);

            if (!clubFetchError && clubData && clubData.length > 0) {
                await supabaseClient
                    .from('club_fans_rankings')
                    .update({ total_fan_points: newPoints })
                    .eq('telegram_id', userState.userId);
            }

            return { success: true, pointsAdded: dailyPoints };
        } catch (error) {
            console.error("Error claiming daily reward:", error);
            return { success: false };
        }
    }

    async function syncTasksFromDB() {
        if (!supabaseClient || !userState.userId) return;

        if (!userState.tasks || userState.tasks.length === 0) {
            userState.tasks = window.defaultTasksData.map(t => ({...t}));
        }

        try {
            const { data: tasksData } = await supabaseClient
                .from('user_tasks')
                .select('task_id')
                .eq('telegram_id', userState.userId);

            if (tasksData) {
                const completedIds = tasksData.map(t => t.task_id);
                userState.tasks.forEach(task => {
                    if (completedIds.includes(task.id)) task.completed = true;
                });
            }

            const { data: userData } = await supabaseClient
                .from('users')
                .select('last_daily_claim')
                .eq('telegram_id', userState.userId)
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
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    ${borderSide}: 4px solid #00FF87;
                }

                .task-premium-card {
                    background: rgba(20, 20, 28, 0.65);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 14px;
                    padding: 12px 14px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .task-premium-card:hover {
                    transform: translateY(-2px);
                    background: rgba(30, 30, 42, 0.8);
                    box-shadow: 0 6px 15px rgba(0,0,0,0.4);
                    border-color: rgba(0, 255, 135, 0.25);
                }

                .task-icon-box {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    flex-shrink: 0;
                }

                .icon-x { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.2); color: white; }
                .icon-tg { background: linear-gradient(135deg, rgba(42, 171, 238, 0.25), rgba(34, 158, 217, 0.1)); border: 1px solid rgba(42, 171, 238, 0.4); color: #2AABEE; }
                .icon-yt { background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.1)); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; }
                .icon-pump { background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(4, 120, 87, 0.1)); border: 1px solid rgba(0, 255, 135, 0.4); color: #00FF87; }

                .task-info {
                    flex-grow: 1;
                    padding: 0 12px;
                }

                .task-points-badge {
                    display: inline-block;
                    color: #00FF87;
                    font-size: 0.75rem;
                    font-weight: 800;
                    margin-top: 2px;
                    font-family: monospace;
                }

                .btn-task-go {
                    background: linear-gradient(135deg, #2AABEE, #8B5CF6);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 0.8rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(42, 171, 238, 0.25);
                    transition: all 0.2s ease;
                }

                .btn-task-go:hover {
                    box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
                    transform: scale(1.03);
                }

                .btn-task-done {
                    background: rgba(255, 255, 255, 0.06);
                    color: #64748b;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 0.8rem;
                    cursor: not-allowed;
                }
            </style>
        `;

        container.innerHTML = styles + `<div style="text-align:center; padding:50px; color: #00FF87; font-weight:bold;">⏳ ${isAr ? 'جاري تحميل المهام...' : 'Loading tasks...'}</div>`;

        await syncTasksFromDB();

        let tasksHtml = userState.tasks.map(task => {
            let iconClass = 'icon-tg';
            let iconSymbol = '✈️';
            
            if (task.id.startsWith('x') || task.id === 'connect_x') {
                iconClass = 'icon-x';
                iconSymbol = '𝕏';
            } else if (task.id === 'youtube') {
                iconClass = 'icon-yt';
                iconSymbol = '▶️';
            } else if (task.id === 'pump_fun') {
                iconClass = 'icon-pump';
                iconSymbol = '💊';
            }

            const btnClass = task.completed ? 'btn-task-done' : 'btn-task-go';
            const btnText = task.completed ? (isAr ? 'مكتمل ✅' : 'Done ✅') : (isAr ? 'انطلق 🚀' : 'Go 🚀');
            const btnState = task.completed ? 'disabled' : '';

            // استخدام الخيار الثاني للمهمة الخاصة بربط X
            let buttonAction = `onclick="executeTask('${task.id}', '${task.url}', ${task.points})"`;
            if (task.id === 'connect_x') {
                buttonAction = `onclick="startXLogin('${task.id}', ${task.points})"`;
            }

            return `
                <div class="task-premium-card" style="border-${isAr ? 'right' : 'left'}: 3px solid ${task.completed ? '#00FF87' : 'transparent'};">
                    <div class="task-icon-box ${iconClass}">
                        ${iconSymbol}
                    </div>
                    
                    <div class="task-info" style="text-align: ${isAr ? 'right' : 'left'};">
                        <h5 style="margin: 0; color: #fff; font-size: 0.9rem; font-weight: 800;">${isAr ? task.textAr : task.textEn}</h5>
                        <div class="task-points-badge">+${task.points} ZELO</div>
                    </div>
                    
                    <button id="btn-task-${task.id}" 
                            class="${btnClass}" 
                            ${buttonAction} 
                            ${btnState}>
                        ${btnText}
                    </button>
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

            <!-- Compact Daily Check-in Card -->
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
                        class="${userState.dailyCheckInClaimed ? 'btn-task-done' : 'btn-task-go'}" 
                        onclick="claimDaily()" 
                        ${userState.dailyCheckInClaimed ? 'disabled' : ''}>
                    ${userState.dailyCheckInClaimed ? (isAr ? 'تم ✅' : 'Claimed ✅') : (isAr ? 'استلام ✨' : 'Claim ✨')}
                </button>
            </div>

            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 12px;">
                <span style="font-size:1rem;">📋</span>
                <h4 style="color: #fff; margin: 0; font-size: 0.95rem; font-weight: 800;">${isAr ? 'المهام المتاحة' : 'Available Tasks'}</h4>
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
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
                window.Telegram.WebApp.openLink(xAuthUrl);
            } else {
                window.open(xAuthUrl, '_blank');
            }
        } catch (e) {
            console.error("Error opening X link:", e);
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
                console.error("Connection error:", error);
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
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
                if (url.includes("t.me")) {
                    window.Telegram.WebApp.openTelegramLink(url);
                } else {
                    window.Telegram.WebApp.openLink(url);
                }
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            console.error("Error opening link:", e);
            window.open(url, '_blank');
        }

        const btn = document.getElementById(`btn-task-${taskId}`);
        if (btn) {
            btn.innerHTML = isAr ? "⏳ تحقق..." : 
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
                            alert(`🎉 ${isAr ? 'تم إضافة النقاط بنجاح:' : 'Points added successfully:'} +${points} ZELO.`);
                        }

                        if (typeof updateTopBar === "function") updateTopBar();
                        renderTasksPage(document.getElementById("main-content")); 
                    } else {
                                            alert(isAr ? "حدث خطأ أثناء حفظ المهمة، يرجى المحاولة لاحقاً." : "An error occurred, please try again.");
                    if (btn) {
                        btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                        btn.className = "btn-task-go";
                        btn.disabled = false;
                    }
                }
            } catch (error) {
                console.error("Connection error:", error);
                task.isProcessing = false; 
                if (btn) {
                    btn.innerHTML = isAr ? 'انطلق 🚀' : 'Go 🚀';
                    btn.className = "btn-task-go";
                    btn.disabled = false;
                }
            }
        }, 4000); 
    };

    window.claimDaily = async function() {
        if (userState.dailyCheckInClaimed) return;
        const isAr = (typeof userState !== 'undefined' && userState.lang === 'ar');

        const btn = document.getElementById('btn-daily-claim');
        if (btn) {
            btn.innerHTML = "⏳ ...";
            btn.disabled = true;
        }

        const res = await apiClaimDaily();
        if (res.success) {
            userState.dailyCheckInClaimed = true;
            userState.points = (userState.points || 0) + res.pointsAdded;
            
            alert(`🎁 ${isAr ? 'تم استلام المكافأة اليومية:' : 'Daily reward claimed:'} +${res.pointsAdded} ZELO!`);
            
            if (typeof updateTopBar === "function") updateTopBar();
            renderTasksPage(document.getElementById("main-content"));
        } else {
            alert(isAr ? "فشل استلام المكافأة اليومية. حاول لاحقاً." : "Failed to claim daily reward.");
            if (btn) {
                btn.innerHTML = isAr ? 'استلام ✨' : 'Claim ✨';
                btn.disabled = false;
            }
        }
    };
})();
