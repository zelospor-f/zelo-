package PKG;

import android.widget.ProgressBar;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.PixelFormat;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.AbsListView;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Toast;
import android.widget.VideoView;
import android.widget.MediaController;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;


// ============================================================
// WeeklyMatchRankings.java — محوَّل من weekly_match_rankings.js
// شاشة «نقاطي» (openPointsPage) + ترتيب التحديات (openChallengesRanking: منصّة أفضل 3 وبطاقتي).
// زر «شارك إنجازك» يفتح openShareCard، وكل بطاقة «افتح» تفتح شاشتها الأصلية.
// ============================================================
abstract class WeeklyMatchRankings extends WalletWithdraw {
    protected static final int WM_STEP = 1000;
    protected Dialog wmSub;

    protected TextView wmChip(String s) {
        TextView c = txt(s, NAVY, 11, true);
        c.setPadding(dp(10), dp(3), dp(10), dp(3));
        c.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFE7AD, 0xFFF5C35A }) {{ setCornerRadius(dp(20)); }});
        return c;
    }
    protected GradientDrawable wmCard(int r) {
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xD91A2668, 0xD9111A4A });
        g.setCornerRadius(dp(r));
        g.setStroke(dp(1), 0x38F5C35A);
        return g;
    }
    protected String wmNum(long n) { return String.format(java.util.Locale.US, "%,d", n); }

    // ---------- شاشة «نقاطي» ----------
    protected void openPointsPage() {
        if (uid == null) return;
        final ScrollView sv = new ScrollView(this);
        final LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        sv.addView(body);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(0, statusH() + dp(6), 0, 0);
        TextView t = txt(L("نقاطي", "My Points"), Color.WHITE, 24, true);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(16), 0, dp(12));
        page.addView(t);
        View ln = new View(this);
        ln.setBackgroundColor(0x26F5C35A);
        page.addView(ln, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        body.setPadding(dp(16), dp(14), dp(16), dp(20));
        body.addView(txt(L("⏳ جاري جلب البيانات...", "⏳ Fetching data..."), 0xFF8FA0B8, 16, false), lpm(0, 40, 0, 0));
        page.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        pgOpen(page, -1);
        pool.execute(new Runnable() { @Override public void run() {
            long balance = 0, lifetime = -1;
            int correct = 0, wrong = 0, pending = 0;
            boolean ok = false;
            try {
                JSONArray b = new JSONArray(get("users?select=points&user_id=eq." + uid));
                if (b.length() > 0) balance = b.getJSONObject(0).optLong("points", 0);
                ok = true;
            } catch (Exception ignore) {}
            try { JSONObject s = rmRow(rpc("my_points_summary", "{}")); if (s != null && s.has("lifetime") && !s.isNull("lifetime")) lifetime = (long) s.optDouble("lifetime", -1); } catch (Exception ignore) {}
            try {
                JSONArray p = new JSONArray(get("match_predictions?select=prediction_status&user_id=eq." + uid));
                for (int i = 0; i < p.length(); i++) {
                    String st = p.getJSONObject(i).optString("prediction_status");
                    if (st.equals("correct")) correct++; else if (st.equals("wrong")) wrong++; else pending++;
                }
            } catch (Exception ignore) {}
            final long fb = balance, fl = lifetime;
            final int fc = correct, fw = wrong, fp = pending;
            final boolean fok = ok;
            runOnUiThread(new Runnable() { @Override public void run() {
                body.removeAllViews();
                if (!fok) { TextView e = txt(L("حدث خطأ في تحميل البيانات", "Error loading data"), 0xFFFF4D4D, 15, false); e.setGravity(Gravity.CENTER); body.addView(e, lpm(0, 20, 0, 0)); return; }
                wmBuildPoints(body, fb, fl, fc, fw, fp);
            } });
        } });
    }

    protected void wmBuildPoints(LinearLayout body, long balance, long lifetime, int correct, int wrong, int pending) {
        long base = Math.max(balance, lifetime < 0 ? 0 : lifetime);
        long level = base / WM_STEP + 1, into = base % WM_STEP;
        int pct = (int) Math.round(into * 100.0 / WM_STEP);
        String[] names = { L("برونزية", "Bronze"), L("فضية", "Silver"), L("ذهبية", "Gold"), L("بلاتينية", "Platinum"), L("الماسة", "Diamond") };
        String tier = level >= 10 ? names[4] : level >= 7 ? names[3] : level >= 5 ? names[2] : level >= 3 ? names[1] : names[0];
        // بطاقة الرصيد + المستوى
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(14), dp(16), dp(14), dp(16));
        top.setBackground(wmCard(18));
        LinearLayout left = new LinearLayout(this);
        left.setOrientation(LinearLayout.VERTICAL);
        left.setGravity(Gravity.CENTER_HORIZONTAL);
        left.addView(txt(L("كورة", "Kora"), GOLD, 17, true));
        LinearLayout nr = new LinearLayout(this);
        nr.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        nr.setGravity(Gravity.CENTER);
        nr.addView(txt(wmNum(balance), GOLD, wmNum(balance).length() > 6 ? 34 : 44, true));
        TextView ball = txt("⚽", GOLD, 28, false);
        ball.setPadding(dp(8), 0, 0, 0);
        nr.addView(ball);
        left.addView(nr);
        left.addView(txt(L("نقاطك الحالية", "Your current points"), 0x9EFFFFFF, 14, true));
        top.addView(left, lpw(1f));
        LinearLayout lv = new LinearLayout(this);
        lv.setGravity(Gravity.CENTER_VERTICAL);
        ImageView coin = lbCoin(70);
        lv.addView(coin, new LinearLayout.LayoutParams(dp(70), dp(70)));
        LinearLayout lc = new LinearLayout(this);
        lc.setOrientation(LinearLayout.VERTICAL);
        lc.setGravity(Gravity.CENTER_HORIZONTAL);
        lc.setPadding(dp(4), 0, 0, 0);
        TextView ld = txt(L("المتصدرون", "Leaders") + " " + (isRtlLang() ? "‹" : "›"), 0xFFFFD98A, 11, true);
        ld.setPadding(dp(9), dp(1), dp(9), dp(1));
        ld.setBackground(rbg(0x24F5C35A, GOLD, 20));
        lc.addView(ld);
        lc.addView(txt(String.valueOf(level), GOLD, 32, true));
        lc.addView(txt(tier, GOLD, 14, true));
        lv.addView(lc);
        lv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openLeaders("clubs"); } });
        top.addView(lv);
        body.addView(top);
        // شريط المستوى
        LinearLayout pr = new LinearLayout(this);
        pr.setOrientation(LinearLayout.VERTICAL);
        pr.setPadding(dp(4), dp(10), dp(4), 0);
        ProgressBar pb = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        pb.setMax(100); pb.setProgress(pct);
        pb.getProgressDrawable().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        pr.addView(pb, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)));
        LinearLayout pl = new LinearLayout(this);
        pl.addView(txt(L("النقاط التالية", "Next level"), 0x9EFFFFFF, 12, false), lpw(1f));
        TextView pn = txt(wmNum(into) + " / " + wmNum(WM_STEP), 0x9EFFFFFF, 12, false);
        pn.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        pl.addView(pn);
        pr.addView(pl, lpm(0, 5, 0, 0));
        body.addView(pr);
        // الإحصاءات
        LinearLayout st = new LinearLayout(this);
        String[] sl = { L("صحيح", "Correct"), L("أخطاء", "Wrong"), L("انتظار", "Pending") };
        int[] sn = { correct, wrong, pending };
        String[] si = { "✓", "✕", "🕒" };
        int[] sc = { 0xFF22B455, 0xFFE03535, 0x9EFFFFFF };
        for (int i = 0; i < 3; i++) {
            LinearLayout b = new LinearLayout(this);
            b.setOrientation(LinearLayout.VERTICAL);
            b.setPadding(dp(8), dp(12), dp(8), dp(10));
            b.setBackground(wmCard(14));
            LinearLayout h = new LinearLayout(this);
            h.setGravity(Gravity.CENTER_VERTICAL);
            TextView ic = txt(si[i], Color.WHITE, 12, true);
            ic.setGravity(Gravity.CENTER);
            ic.setBackground(oval(i == 2 ? 0x00000000 : sc[i], 0));
            h.addView(ic, new LinearLayout.LayoutParams(dp(24), dp(24)));
            TextView lb = txt(sl[i], 0x9EFFFFFF, 13, true);
            lb.setPadding(dp(6), 0, 0, 0);
            h.addView(lb);
            b.addView(h);
            TextView n = txt(String.valueOf(sn[i]), Color.WHITE, 34, true);
            n.setGravity(Gravity.CENTER);
            b.addView(n);
            LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            bp.setMargins(dp(4), 0, dp(4), 0);
            st.addView(b, bp);
        }
        body.addView(st, lpm(0, 12, 0, 4));
        // كيف تكسب
        body.addView(txt(L("كيف تكسب المزيد؟", "How to earn more?"), Color.WHITE, 20, true), lpm(4, 16, 4, 8));
        LinearLayout rows = new LinearLayout(this);
        rows.setOrientation(LinearLayout.VERTICAL);
        rows.setBackground(wmCard(18));
        rows.addView(wmRow("⚽", L("تنبّأ بنتائج المباريات", "Predict match results"), L("احصل على نقاط لكل توقع صحيح", "Earn points for each correct pick"), L("حتى 3 كورة", "Up to 3 Kora"), false, new Runnable() { @Override public void run() { openPredictList(); } }));
        rows.addView(wmRow("🎯", L("شاهد إعلانًا", "Watch an ad"), L("نقاط مكافأة بعد كل إعلان", "Bonus points after each ad"), L("مكافأة", "Bonus"), false, new Runnable() { @Override public void run() { openAdsPage(); } }));
        rows.addView(wmRow("❓", L("خمّن اللاعب", "Guess the player"), L("لغز جديد كل يوم واكسب نقاطاً", "A new puzzle every day"), L("كل يوم", "Daily"), false, new Runnable() { @Override public void run() { openGuessPlayer(); } }));
        rows.addView(wmRow("👥", L("ادعُ أصدقاءك", "Invite friends"), L("لكل صديق ينضم ويتنبأ، احصل على نقاط", "Earn points for each friend who joins"), L("لكل صديق", "Per friend"), false, new Runnable() { @Override public void run() { drInvite(); } }));
        rows.addView(wmRow("⭐", L("انشر واستقبل الدعم", "Post and receive support"), L("فيديوهاتك ومنشوراتك يدعمها المتابعون بالنقاط", "Followers support your posts with points"), L("من المتابعين", "From followers"), true, new Runnable() { @Override public void run() { pgClose(); } }));
        body.addView(rows);
        // استخدم نقاطك
        LinearLayout uh = new LinearLayout(this);
        uh.setOrientation(LinearLayout.VERTICAL);
        uh.addView(txt(L("استخدم نقاطك", "Use your points"), Color.WHITE, 20, true));
        uh.addView(txt(L("استبدل نقاطك بمكافآت رائعة", "Spend your points on great rewards"), 0x9EFFFFFF, 13, false));
        body.addView(uh, lpm(4, 16, 4, 8));
        LinearLayout uc = new LinearLayout(this);
        uc.addView(wmUse("🃏", L("سوق NFT", "NFT market"), L("بطاقات اللاعبين", "Player cards"), new Runnable() { @Override public void run() { openNftMarket(); } }), wmUseLp(0));
        uc.addView(wmUse("🎁", L("المتجر", "Store"), L("عناصر ومزايا", "Items & perks"), new Runnable() { @Override public void run() { openStorePage(); } }), wmUseLp(1));
        uc.addView(wmUse("🏆", L("المحفظة", "Wallet"), L("الرصيد والسحب", "Balance & cashout"), new Runnable() { @Override public void run() { openWithdrawWallet(); } }), wmUseLp(2));
        body.addView(uc, lpm(0, 0, 0, navH() > 0 ? 10 : 10));
    }

    protected LinearLayout.LayoutParams wmUseLp(int i) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        p.setMargins(dp(4), 0, dp(4), 0);
        return p;
    }

    protected View wmRow(String icon, String title, String sub, String chip, boolean last, final Runnable go) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(14), dp(13), dp(14), dp(13));
        TextView ic = txt(icon, GOLD, 22, false);
        ic.setGravity(Gravity.CENTER);
        ic.setBackground(rbg(0x1AF5C35A, 0x59F5C35A, 23));
        r.addView(ic, new LinearLayout.LayoutParams(dp(46), dp(46)));
        LinearLayout tx = new LinearLayout(this);
        tx.setOrientation(LinearLayout.VERTICAL);
        tx.setPadding(dp(12), 0, dp(12), 0);
        tx.addView(txt(title, Color.WHITE, 16, true));
        tx.addView(txt(sub, 0x9EFFFFFF, 12, false));
        r.addView(tx, lpw(1f));
        LinearLayout rt = new LinearLayout(this);
        rt.setOrientation(LinearLayout.VERTICAL);
        rt.setGravity(Gravity.END);
        rt.addView(wmChip(chip));
        TextView cv = txt(isRtlLang() ? "‹" : "›", GOLD, 20, true);
        rt.addView(cv);
        r.addView(rt);
        r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { go.run(); } });
        LinearLayout w = new LinearLayout(this);
        w.setOrientation(LinearLayout.VERTICAL);
        w.addView(r);
        if (!last) { View l = new View(this); l.setBackgroundColor(0x24F5C35A); w.addView(l, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))); }
        return w;
    }

    protected View wmUse(String emoji, String title, String sub, final Runnable go) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        c.setPadding(dp(6), dp(12), dp(6), dp(12));
        c.setBackground(wmCard(18));
        TextView e = txt(emoji, Color.WHITE, 36, false);
        e.setGravity(Gravity.CENTER);
        c.addView(e);
        TextView t = txt(title, Color.WHITE, 14, true);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(4), 0, 0);
        c.addView(t);
        TextView s = txt(sub, 0x9EFFFFFF, 11, false);
        s.setGravity(Gravity.CENTER);
        s.setPadding(0, dp(2), 0, dp(8));
        c.addView(s);
        TextView b = txt(L("افتح", "Open"), NAVY, 14, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(6), dp(6), dp(6), dp(6));
        b.setBackground(rbg(GOLD, 0, 20));
        b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { go.run(); } });
        c.addView(b, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return c;
    }

    // ---------- ترتيب التحديات (المنصّة + بطاقتي + مشاركة) ----------
    protected void openChallengesRanking() {
        if (wmSub != null) { try { wmSub.dismiss(); } catch (Exception ignore) {} }
        final Dialog d = sheetDialog(true);
        wmSub = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), statusH() + dp(6), dp(20), 0);
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        TextView ti = txt("🏆 " + L("ترتيب التحديات", "Challenges Ranking"), GOLD, 20, true);
        ti.setPadding(dp(10), 0, 0, 0);
        head.addView(ti, lpw(1f));
        root.addView(head, lpm(0, 0, 0, 12));
        final LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, 0, 0, navH() + dp(16));
        box.addView(txt(L("⏳ جاري جلب البيانات...", "⏳ Fetching data..."), 0xFF8FA0B8, 15, false), lpm(0, 40, 0, 0));
        ScrollView sv = new ScrollView(this);
        sv.addView(box);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (wmSub == d) wmSub = null; } });
        d.show();
        pool.execute(new Runnable() { @Override public void run() {
            JSONArray rk = new JSONArray();
            final Map<String, String> ph = new HashMap<String, String>();
            long bal = 0; String rank = "-";
            boolean fail = false;
            try {
                rk = new JSONArray(get("weekly_match_rankings?select=user_id,username,photo_url,points_earned&is_eliminated=eq.false&category=eq.weekly&order=points_earned.desc&limit=50"));
            } catch (Exception e) { fail = true; }
            try {
                StringBuilder ids = new StringBuilder();
                for (int i = 0; i < Math.min(3, rk.length()); i++) ids.append(i > 0 ? "," : "").append(rk.getJSONObject(i).optString("user_id"));
                if (ids.length() > 0) {
                    JSONArray pp = new JSONArray(get("public_profiles?select=user_id,photo_url&user_id=in.(" + ids + ")"));
                    for (int i = 0; i < pp.length(); i++) { JSONObject o = pp.getJSONObject(i); if (!o.isNull("photo_url") && o.optString("photo_url").length() > 0) ph.put(o.optString("user_id"), o.optString("photo_url")); }
                }
            } catch (Exception ignore) {}
            try { JSONArray b = new JSONArray(get("users?select=points&user_id=eq." + uid)); if (b.length() > 0) bal = b.getJSONObject(0).optLong("points", 0); } catch (Exception ignore) {}
            try { String r = rpc("get_user_rank", new JSONObject().put("p_user_id", uid).put("p_category", "weekly").toString()).trim().replace("\"", ""); if (r.length() > 0 && !r.equals("null")) rank = r; } catch (Exception ignore) {}
            final JSONArray frk = rk;
            final long fbal = bal;
            final String frank = rank;
            final boolean ffail = fail;
            runOnUiThread(new Runnable() { @Override public void run() {
                if (wmSub != d) return;
                box.removeAllViews();
                if (ffail) { TextView e = txt(L("حدث خطأ في تحميل البيانات", "Error loading ranking data"), 0xFFFF4D4D, 15, false); e.setGravity(Gravity.CENTER); box.addView(e, lpm(0, 20, 0, 0)); return; }
                if (frk.length() == 0) { TextView e = txt(L("لا توجد بيانات ترتيب حالياً", "No ranking data available"), 0xFF888888, 15, false); e.setGravity(Gravity.CENTER); box.addView(e, lpm(0, 5, 0, 10)); }
                String[] medals = { "🏆", "🥈", "🥉" };
                int[] cols = { GOLD, 0xFFC0C0C0, 0xFFCD7F32 };
                int[] sizes = { 40, 36, 36 };
                for (int i = 0; i < Math.min(3, frk.length()); i++) {
                    JSONObject o = frk.optJSONObject(i);
                    if (o == null) continue;
                    String nm = o.optString("username", "");
                    if (nm.length() == 0 || nm.equals("null")) nm = L("مستخدم", "User");
                    String photo = ph.containsKey(o.optString("user_id")) ? ph.get(o.optString("user_id")) : (o.isNull("photo_url") ? "" : o.optString("photo_url"));
                    LinearLayout pc = new LinearLayout(WeeklyMatchRankings.this);
                    pc.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
                    pc.setGravity(Gravity.CENTER_VERTICAL);
                    pc.setPadding(dp(12), dp(8), dp(12), dp(8));
                    GradientDrawable pg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xF2111A4A, 0xF20A1033 });
                    pg.setCornerRadius(dp(12));
                    pg.setStroke(dp(1), i == 0 ? 0x80F5C35A : i == 1 ? 0x66C0C0C0 : 0x66CD7F32);
                    pc.setBackground(pg);
                    pc.addView(lbAvatar(photo, initial(nm), sizes[i], GOLD, false, 2), new LinearLayout.LayoutParams(dp(sizes[i]), dp(sizes[i])));
                    TextView n = txt(medals[i] + " " + nm, Color.WHITE, 14, true);
                    n.setPadding(dp(10), 0, 0, 0);
                    pc.addView(n, lpw(1f));
                    LinearLayout c1 = new LinearLayout(WeeklyMatchRankings.this);
                    c1.setOrientation(LinearLayout.VERTICAL);
                    c1.setGravity(Gravity.CENTER_HORIZONTAL);
                    c1.addView(txt(L("النقاط", "Pts"), 0x80FFFFFF, 10, true));
                    TextView pp = txt(String.valueOf(o.optLong("points_earned")), cols[i], 14, true);
                    pp.setPadding(dp(8), dp(2), dp(8), dp(2));
                    pp.setBackground(rbg(0x66000000, 0, 6));
                    c1.addView(pp);
                    pc.addView(c1);
                    LinearLayout c2 = new LinearLayout(WeeklyMatchRankings.this);
                    c2.setOrientation(LinearLayout.VERTICAL);
                    c2.setGravity(Gravity.CENTER_HORIZONTAL);
                    c2.setPadding(dp(12), 0, 0, 0);
                    c2.addView(txt(L("الترتيب", "Rank"), 0x80FFFFFF, 10, true));
                    c2.addView(txt(i == 0 ? "👑" : medals[i], Color.WHITE, 20, false));
                    pc.addView(c2);
                    box.addView(pc, lpm(0, 0, 0, 8));
                }
                // بطاقتي
                boolean topR = false;
                try { topR = Integer.parseInt(frank) <= 3; } catch (Exception ignore) {}
                FrameLayout me = new FrameLayout(WeeklyMatchRankings.this);
                LinearLayout mc = new LinearLayout(WeeklyMatchRankings.this);
                mc.setOrientation(LinearLayout.VERTICAL);
                mc.setGravity(Gravity.CENTER_HORIZONTAL);
                mc.setPadding(dp(20), dp(22), dp(20), dp(25));
                mc.setBackground(rbg(0xCC111A4A, 0x1FF5C35A, 25));
                String un = uname == null || uname.length() == 0 ? L("مستخدم", "User") : uname;
                mc.addView(lbAvatar(uavatar == null ? "" : uavatar, initial(un), 50, GOLD, false, 2), new LinearLayout.LayoutParams(dp(50), dp(50)));
                LinearLayout ir = new LinearLayout(WeeklyMatchRankings.this);
                ir.setGravity(Gravity.CENTER);
                ir.addView(txt(un, Color.WHITE, 16, true));
                TextView pt = txt("🪙 " + wmNum(fbal) + " " + L("كورة", "Kora"), GOLD, 14, true);
                pt.setPadding(dp(8), dp(3), dp(8), dp(3));
                pt.setBackground(rbg(0x66000000, 0x4DF5C35A, 10));
                LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                pl.setMargins(dp(8), 0, 0, 0);
                ir.addView(pt, pl);
                mc.addView(ir, lpm(0, 8, 0, 0));
                me.addView(mc, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                TextView bd = txt("#" + frank, topR ? NAVY : Color.WHITE, 16, true);
                bd.setPadding(dp(12), dp(5), dp(12), dp(5));
                GradientDrawable bgd = new GradientDrawable();
                bgd.setColor(topR ? GOLD : 0xFF2C4BB5);
                bgd.setCornerRadius(dp(12));
                bgd.setStroke(dp(3), 0xE6FFFFFF);
                bd.setBackground(bgd);
                bd.setRotation(isRtlLang() ? 8 : -8);
                me.addView(bd, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | (isRtlLang() ? Gravity.END : Gravity.START)));
                box.addView(me, lpm(0, 12, 0, 15));
                // مشاركة
                TextView sh = txt(L("📤 شارك إنجازك", "📤 Share your win"), Color.WHITE, 16, true);
                sh.setGravity(Gravity.CENTER);
                sh.setPadding(dp(12), dp(12), dp(12), dp(12));
                sh.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF14206B, 0xFF2C4BB5, 0xFFF5C35A }) {{ setCornerRadius(dp(12)); }});
                sh.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openShareCard(uid); } });
                box.addView(sh, lpm(0, 0, 0, 0));
            } });
        } });
    }
}
