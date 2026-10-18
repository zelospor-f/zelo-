/* ========= بطاقة مشاركة التوقع الصحيح ========= */
(function () {
    const isAr = () => (typeof userState !== 'undefined' && userState?.lang === 'ar');

    // آخر توقع صحيح للمستخدم مع بيانات المباراة
    async function fetchLastCorrect(uid) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
        const { data, error } = await supabaseClient
            .from('match_predictions')
            .select('predicted_home, predicted_away, matches(team_a, team_b, home_score, away_score)')
            .eq('user_id', String(uid))
            .eq('prediction_status', 'correct')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            console.warn('share-card: fetch error', error);
            return null;
        }
        return data;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // تصميم بصيغة القصة (1080 × 1920)
    function drawCard(canvas, d) {
        const W = 1080, H = 1920;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const ar = isAr();

        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#1a0b2e');
        g.addColorStop(0.5, '#0d0d12');
        g.addColorStop(1, '#2a0a0a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#fcb045';
        ctx.font = 'bold 72px sans-serif';
        ctx.fillText('ZELO SPORT', W / 2, 180);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px sans-serif';
        ctx.fillText(tr('shareTitle', 'توقعت بدقة!', 'Correct prediction!'), W / 2, 300);

        // بطاقة المباراة
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(ctx, 80, 400, W - 160, 820, 40);
        ctx.fill();
        ctx.strokeStyle = 'rgba(252,176,69,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 52px sans-serif';
        ctx.fillText(d.teamA, W / 2, 530, W - 260);
        ctx.fillStyle = '#fcb045';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('VS', W / 2, 620);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 52px sans-serif';
        ctx.fillText(d.teamB, W / 2, 710, W - 260);

        // توقعه
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '40px sans-serif';
        ctx.fillText(tr('sharePrediction', 'توقعه', 'Prediction'), W / 2, 830);
        ctx.fillStyle = '#fcb045';
        ctx.font = 'bold 150px sans-serif';
        ctx.fillText(`${d.predHome} - ${d.predAway}`, W / 2, 960);

        // النتيجة الفعلية
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '36px sans-serif';
        ctx.fillText(tr('shareFinal', 'النتيجة النهائية {home} - {away}', 'Final {home} - {away}', { home: d.realHome, away: d.realAway }), W / 2, 1080);

        // اسم المستخدم والرصيد
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px sans-serif';
        ctx.fillText(d.name, W / 2, 1360, W - 160);
        ctx.fillStyle = '#fcb045';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText(`🪙 ${d.balance} ZELO`, W / 2, 1460);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '36px sans-serif';
        ctx.fillText(tr('shareFooter', 'تحدّ توقعاتك على ZELO SPORT', 'Challenge your predictions on ZELO SPORT'), W / 2, 1800);
    }

    async function openShareCard(userId) {
        const uid = userId || (typeof userState !== 'undefined' ? userState.userId : null);
        if (!uid) {
            alert(tr('shareSignIn', 'سجّل الدخول أولاً', 'Please sign in first'));
            return;
        }
        const row = await fetchLastCorrect(uid);
        if (!row || !row.matches) {
            alert(tr('shareNoCorrect', 'لا يوجد توقع صحيح بعد', 'No correct prediction yet'));
            return;
        }

        const d = {
            teamA: row.matches.team_a,
            teamB: row.matches.team_b,
            predHome: row.predicted_home,
            predAway: row.predicted_away,
            realHome: row.matches.home_score,
            realAway: row.matches.away_score,
            name: (typeof userState !== 'undefined' && userState.username) ? userState.username : tr('userDefault', 'مستخدم', 'User'),
            balance: (typeof userState !== 'undefined' ? Number(userState.points || 0) : 0).toLocaleString('en-US')
        };

        const canvas = document.createElement('canvas');
        drawCard(canvas, d);

        canvas.toBlob(async function (blob) {
            if (!blob) return;
            const file = new File([blob], 'zelo-prediction.png', { type: 'image/png' });

            // المشاركة الأصلية في الهاتف
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: 'ZELO SPORT' });
                    return;
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                }
            }

            // بديل: تنزيل الصورة
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'zelo-prediction.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/png');
    }

    window.openShareCard = openShareCard;
})();
