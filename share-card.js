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

    // شعارات الفرق من جدول standings (بالاسم) — تُحمَّل بصلاحية CORS وإلا نرسم حرفاً
    async function fetchCrests(a, b) {
        const out = {};
        try {
            const names = [a, b].filter(Boolean);
            const r = await supabaseClient.from('standings').select('team_name,crest').in('team_name', names);
            (r.data || []).forEach(x => { if (x.crest) out[String(x.team_name).toLowerCase()] = x.crest; });
        } catch (e) {}
        return out;
    }
    function loadImg(src) {
        return new Promise(res => {
            if (!src) return res(null);
            const im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = () => res(im);
            im.onerror = () => res(null);
            setTimeout(() => res(null), 4000);
            im.src = src;
        });
    }
    const ballSrc = () => (typeof LB_COIN_IMG !== 'undefined' && LB_COIN_IMG) ? LB_COIN_IMG : 'zelo-coin.png';

    function drawBall(ctx, img, cx, cy, r) {
        if (img) { ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); return; }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a1033';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); ctx.fill();
    }

    function drawCrest(ctx, img, letter, cx, cy, r, color) {
        ctx.fillStyle = '#0a1033';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 6;
        ctx.stroke();
        if (img) {
            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, r - 8, 0, Math.PI * 2); ctx.clip();
            const k = Math.min((r * 1.5) / img.width, (r * 1.5) / img.height);
            ctx.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
            ctx.restore();
        } else {
            ctx.fillStyle = color;
            ctx.font = 'bold 84px sans-serif';
            ctx.fillText(letter, cx, cy + 4);
        }
    }

    // تصميم بصيغة القصة (1080 × 1920) — ألوان ZELO (أزرق + ذهبي)
    function drawCard(canvas, d, imgs) {
        const W = 1080, H = 1920, GOLD = '#f5c35a';
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // الخلفية
        ctx.fillStyle = '#0a1033';
        ctx.fillRect(0, 0, W, H);
        const rg = ctx.createRadialGradient(W * 0.85, -60, 0, W * 0.85, -60, 1250);
        rg.addColorStop(0, '#2c4bb5'); rg.addColorStop(0.38, '#14206b'); rg.addColorStop(1, 'rgba(10,16,51,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(245,195,90,0.16)'; ctx.lineWidth = 3;
        [[-60, H + 60, 480], [-60, H + 60, 780]].forEach(c => { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.stroke(); });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // الشعار
        ctx.font = 'bold 60px sans-serif';
        const bw = ctx.measureText('ZELO SPORT').width;
        const startX = W / 2 - (bw + 90) / 2;
        drawBall(ctx, imgs.ball, startX + 36, 130, 36);
        ctx.fillStyle = GOLD;
        ctx.textAlign = 'left';
        ctx.fillText('ZELO SPORT', startX + 90, 132);
        ctx.textAlign = 'center';

        // الشارة
        const badge = '✓ ' + tr('shareTitle', 'توقّعتُ بدقة!', 'Correct prediction!');
        ctx.font = '900 52px sans-serif';
        const bgw = ctx.measureText(badge).width + 120;
        const bg = ctx.createLinearGradient(W / 2 - bgw / 2, 0, W / 2 + bgw / 2, 0);
        bg.addColorStop(0, '#ffe7ad'); bg.addColorStop(1, GOLD);
        ctx.fillStyle = bg;
        roundRect(ctx, W / 2 - bgw / 2, 260, bgw, 100, 50);
        ctx.fill();
        ctx.fillStyle = '#0a1033';
        ctx.fillText(badge, W / 2, 312);

        // بطاقة المباراة
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(ctx, 80, 440, W - 160, 880, 78);
        ctx.fill();
        ctx.strokeStyle = 'rgba(245,195,90,0.4)'; ctx.lineWidth = 3;
        ctx.stroke();

        const cxA = 300, cxB = W - 300, cy = 640;
        drawCrest(ctx, imgs.a, (d.teamA || '?').charAt(0).toUpperCase(), cxA, cy, 118, GOLD);
        drawCrest(ctx, imgs.b, (d.teamB || '?').charAt(0).toUpperCase(), cxB, cy, 118, '#ff8a95');
        ctx.fillStyle = '#9aa6d6';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('VS', W / 2, cy);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 44px sans-serif';
        ctx.fillText(d.teamA, cxA, cy + 190, 360);
        ctx.fillText(d.teamB, cxB, cy + 190, 360);

        // توقعه
        ctx.fillStyle = '#9aa6d6';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(tr('sharePrediction', 'توقّعي', 'My prediction'), W / 2, 930);
        ctx.save();
        ctx.shadowColor = 'rgba(245,195,90,0.45)'; ctx.shadowBlur = 60;
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 200px sans-serif';
        ctx.fillText(`${d.predHome} - ${d.predAway}`, W / 2, 1060);
        ctx.restore();

        // النتيجة الفعلية (النص العربي والرقم يُرسمان منفصلين لتفادي انعكاس الأرقام)
        const finL = tr('shareFinal2', 'النتيجة النهائية', 'Final score');
        const finS = `${d.realHome} - ${d.realAway}`;
        ctx.font = '900 40px sans-serif';
        const wL = ctx.measureText(finL).width, wS = ctx.measureText(finS).width;
        const fw = wL + wS + 40 + 90;
        ctx.fillStyle = 'rgba(20,241,149,0.12)';
        roundRect(ctx, W / 2 - fw / 2, 1180, fw, 88, 44);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,241,149,0.5)'; ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#14f195';
        ctx.textAlign = 'left';
        const x0 = W / 2 - fw / 2 + 45;
        const rtl = isAr();
        ctx.fillText(rtl ? finS : finL, x0, 1224);
        ctx.fillText(rtl ? finL : finS, x0 + (rtl ? wS : wL) + 40, 1224);
        ctx.textAlign = 'center';

        // شريط المستخدم
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(ctx, 80, 1440, W - 160, 190, 60);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3;
        ctx.stroke();
        const ax = W - 80 - 40 - 66, ay = 1535;
        const ag = ctx.createConicGradient ? ctx.createConicGradient(0, ax, ay) : null;
        if (ag) { ag.addColorStop(0, '#ffe7ad'); ag.addColorStop(0.33, GOLD); ag.addColorStop(0.66, '#2c4bb5'); ag.addColorStop(1, '#ffe7ad'); }
        ctx.fillStyle = ag || GOLD;
        ctx.beginPath(); ctx.arc(ax, ay, 66, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a1033';
        ctx.beginPath(); ctx.arc(ax, ay, 58, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText((d.name || 'Z').charAt(0).toUpperCase(), ax, ay + 3);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 50px sans-serif';
        ctx.fillText(d.name, ax - 90, 1510, 330);
        if (d.handle) {
            ctx.fillStyle = '#cfd8ff';
            ctx.font = '40px sans-serif';
            ctx.fillText('@' + d.handle, ax - 90, 1566, 330);
        }
        // الرصيد
        const bal = String(d.balance);
        ctx.font = 'bold 50px sans-serif';
        const pw = ctx.measureText(bal).width + 130;
        const px = 80 + 36;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, px, 1535 - 48, pw, 96, 48);
        ctx.fill();
        ctx.strokeStyle = 'rgba(245,195,90,0.4)'; ctx.lineWidth = 3;
        ctx.stroke();
        drawBall(ctx, imgs.ball, px + 52, 1535, 30);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(bal, px + 96, 1537);
        ctx.textAlign = 'center';

        ctx.fillStyle = '#9aa6d6';
        ctx.font = 'bold 38px sans-serif';
        ctx.fillText(tr('shareFooter', 'تحدَّ توقعاتك على ZELO SPORT', 'Challenge your predictions on ZELO SPORT'), W / 2, 1780);
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
            name: (typeof userState !== 'undefined' && (userState.nickname_ar || userState.nickname_en || userState.username)) || tr('userDefault', 'مستخدم', 'User'),
            handle: (typeof userState !== 'undefined' && userState.username) || '',
            balance: (typeof userState !== 'undefined' ? Number(userState.points || 0) : 0).toLocaleString('en-US')
        };

        const crests = await fetchCrests(d.teamA, d.teamB);
        const imgs = {
            ball: await loadImg(ballSrc()),
            a: await loadImg(crests[String(d.teamA || '').toLowerCase()]),
            b: await loadImg(crests[String(d.teamB || '').toLowerCase()])
        };
        const canvas = document.createElement('canvas');
        drawCard(canvas, d, imgs);

        canvas.toBlob(async function (blob) {
            if (!blob) return;
            const file = new File([blob], 'zelo-prediction.png', { type: 'image/png' });

            // تطبيق أندرويد (Capacitor): نحفظ الصورة مؤقتاً ثم نفتح قائمة المشاركة الأصلية
            try {
                const P = window.Capacitor && window.Capacitor.Plugins;
                if (P && P.Filesystem && P.Share) {
                    const b64 = await new Promise((res, rej) => {
                        const fr = new FileReader();
                        fr.onload = () => res(String(fr.result).split(',')[1]);
                        fr.onerror = rej;
                        fr.readAsDataURL(blob);
                    });
                    const saved = await P.Filesystem.writeFile({ path: 'zelo-prediction.png', data: b64, directory: 'CACHE' });
                    await P.Share.share({ title: 'ZELO SPORT', files: [saved.uri] });
                    return;
                }
            } catch (e) {
                if (e && /cancel/i.test(String(e.message || e))) return;
            }

            // المشاركة الأصلية في المتصفح
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
