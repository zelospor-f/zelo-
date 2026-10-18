/* ========= شارات وسلاسل التوقعات الصحيحة ========= */
(function () {
    const BADGES = [
        { id: 'first',   minStreak: 1,  ar: 'أول توقع صحيح', en: 'First Correct',   icon: '🎯' },
        { id: 'analyst', minStreak: 3,  ar: 'محلل',           en: 'Analyst',         icon: '📊' },
        { id: 'expert',  minStreak: 5,  ar: 'خبير',           en: 'Expert',          icon: '🧠' },
        { id: 'king',    minStreak: 10, ar: 'ملك التوقعات',   en: 'Prediction King', icon: '👑' }
    ];

    const isAr = () => (typeof userState !== 'undefined' && userState?.lang === 'ar');

    // يحسب السلسلة من التوقعات المنتهية فقط (correct / wrong) بترتيب تاريخ المباراة
    // التوقعات المعلقة (pending) لا تكسر السلسلة ولا تُحتسب
    function computeStreaks(predictions) {
        const finished = (predictions || [])
            .filter(p => p.prediction_status === 'correct' || p.prediction_status === 'wrong')
            .sort((a, b) => new Date(a.matches?.match_date || 0) - new Date(b.matches?.match_date || 0));

        let best = 0, run = 0;
        for (const p of finished) {
            if (p.prediction_status === 'correct') {
                run++;
                if (run > best) best = run;
            } else {
                run = 0;
            }
        }

        let current = 0;
        for (let i = finished.length - 1; i >= 0; i--) {
            if (finished[i].prediction_status === 'correct') current++;
            else break;
        }

        return {
            current,
            best,
            correct: finished.filter(p => p.prediction_status === 'correct').length,
            total: finished.length
        };
    }

    async function fetchPredictions(userId) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !userId) return [];
        const { data, error } = await supabaseClient
            .from('match_predictions')
            .select('prediction_status, matches(match_date)')
            .eq('user_id', String(userId));
        if (error) {
            console.warn('badges: fetch error', error);
            return [];
        }
        return data || [];
    }

    async function renderBadges(container, userId) {
        if (!container) return;
        const uid = userId || (typeof userState !== 'undefined' ? userState.userId : null);
        const ar = isAr();

        const preds = await fetchPredictions(uid);
        const s = computeStreaks(preds);
        const earned = BADGES.filter(b => s.best >= b.minStreak);
        const next = BADGES.find(b => s.best < b.minStreak);

        const badgesHtml = earned.length
            ? earned.map(b => `
                <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(252,176,69,0.4); border-radius: 12px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: bold; color: #fff;">
                    <span>${b.icon}</span><span>${tr('badge_' + b.id, b.ar, b.en)}</span>
                </div>`).join('')
            : `<div style="color: #888; font-size: 0.85rem;">${tr('badgeNone', 'لا توجد شارات بعد', 'No badges yet')}</div>`;

        const nextHtml = next
            ? `<div style="color: #888; font-size: 0.8rem; margin-top: 8px;">
                ${tr('badgeNext', 'التالي', 'Next')}: ${tr('badgeNextInfo', '{badge} ({n} توقعات صحيحة متتالية)', '{badge} ({n} correct in a row)', { badge: tr('badge_' + next.id, next.ar, next.en), n: next.minStreak })}
               </div>`
            : '';

        container.innerHTML = `
            <div style="background: rgba(22,22,30,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px; color: #fff; direction: ${ar ? 'rtl' : 'ltr'};">
                <div style="display: flex; justify-content: space-around; margin-bottom: 12px; text-align: center;">
                    <div>
                        <div style="color: #888; font-size: 0.75rem;">🔥 ${tr('badgeCurrentStreak', 'السلسلة الحالية', 'Current streak')}</div>
                        <div style="color: var(--accent-gold, #fcb045); font-weight: 900; font-size: 1.3rem;">${s.current}</div>
                    </div>
                    <div>
                        <div style="color: #888; font-size: 0.75rem;">🏅 ${tr('badgeBestStreak', 'أفضل سلسلة', 'Best streak')}</div>
                        <div style="color: var(--accent-gold, #fcb045); font-weight: 900; font-size: 1.3rem;">${s.best}</div>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">${badgesHtml}</div>
                ${nextHtml}
            </div>`;
    }

    window.computeStreaks = computeStreaks;
    window.renderBadges = renderBadges;
})();
