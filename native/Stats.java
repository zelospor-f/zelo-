package com.zelosport.app;

import android.view.Window;
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

abstract class Stats extends Settings {
    protected Dialog sxDlg;
    protected FrameLayout sxRoot;
    protected int sxDays = 7;
    protected JSONObject sxData;
    protected static final int SX_GREEN = 0xFF14F195;
    protected static final int SX_RED = 0xFFFF5A6E;

    protected void openStats() {
        if (sxDlg != null) { try { sxDlg.dismiss(); } catch (Exception ignore) {} }
        sxDlg = sheetDialog(true);
        sxDlg.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(sxDlg);
        sxRoot = new FrameLayout(this);
        sxDlg.setContentView(sxRoot);
        sxDlg.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface d) { sxDlg = null; } });
        sxDlg.show();
        sxDays = 7;
        sxLoad();
    }

    protected void sxLoad() {
        sxRoot.removeAllViews();
        TextView ld = txt(L("جارٍ التحميل...", "Loading..."), MUTED, 15, false);
        ld.setGravity(Gravity.CENTER);
        sxRoot.addView(ld, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final int days = sxDays;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject o = null;
                try { o = new JSONObject(rpc("my_stats", new JSONObject().put("p_days", days).toString())); } catch (Exception ignore) {}
                final JSONObject fo = o;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (sxDlg == null) return;
                    sxData = fo;
                    if (fo == null || fo.length() == 0) {
                        sxRoot.removeAllViews();
                        TextView e = txt(L("تعذّر تحميل الإحصائيات", "Could not load stats"), MUTED, 15, false);
                        e.setGravity(Gravity.CENTER);
                        e.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { sxLoad(); } });
                        sxRoot.addView(e, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                        return;
                    }
                    sxBuild();
                } });
            }
        });
    }

    protected String sxNum(double v) {
        long n = Math.round(v);
        if (n >= 1000000) return String.format(java.util.Locale.US, "%.1fM", n / 1000000.0);
        if (n >= 10000) return String.format(java.util.Locale.US, "%.1fK", n / 1000.0);
        return String.format(java.util.Locale.US, "%,d", n);
    }

    protected LinearLayout sxCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(rbg(0x14FFFFFF, 0x1AFFFFFF, 20));
        c.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(12));
        c.setLayoutParams(lp);
        return c;
    }

    protected View sxDelta(double cur, double prev) {
        double d = cur - prev;
        String s = d == 0 ? "" : ((d > 0 ? "\u25B2 " : "\u25BC ") + sxNum(Math.abs(d)));
        TextView t = txt(s, d >= 0 ? SX_GREEN : SX_RED, 12, true);
        if (sxDays <= 0) t.setText("");
        return t;
    }

    protected LinearLayout sxTile(String label, String value, int vcolor, View delta) {
        LinearLayout c = sxCard();
        c.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        c.addView(txt(label, MUTED, 12, true));
        c.addView(txt(value, vcolor, 26, true));
        if (delta != null) c.addView(delta);
        return c;
    }

    protected LinearLayout sxRow(View a, View b) {
        LinearLayout r = new LinearLayout(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, 0);
        r.setLayoutParams(lp);
        LinearLayout.LayoutParams a1 = (LinearLayout.LayoutParams) a.getLayoutParams(); a1.setMarginEnd(dp(6));
        LinearLayout.LayoutParams b1 = (LinearLayout.LayoutParams) b.getLayoutParams(); b1.setMarginStart(dp(6));
        r.addView(a); r.addView(b);
        return r;
    }

    protected LinearLayout sxHead(String icon, String title, String right, int rcolor) {
        LinearLayout h = new LinearLayout(this);
        h.setGravity(Gravity.CENTER_VERTICAL);
        h.addView(txt(icon + "  ", Color.WHITE, 20, false));
        TextView t = txt(title, Color.WHITE, 16, true);
        h.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        if (right != null) h.addView(txt(right, rcolor, 18, true));
        return h;
    }

    protected View sxBar(double frac) {
        FrameLayout f = new FrameLayout(this);
        f.setBackground(rbg(0x1AFFFFFF, 0x00000000, 6));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8));
        lp.setMargins(0, dp(10), 0, dp(6));
        f.setLayoutParams(lp);
        final double fr = Math.max(0.02, Math.min(1.0, frac));
        final View in = new View(this);
        in.setBackground(rbg(GOLD, 0x00000000, 6));
        f.addView(in, new FrameLayout.LayoutParams(1, ViewGroup.LayoutParams.MATCH_PARENT));
        final FrameLayout ff = f;
        f.post(new Runnable() { @Override public void run() {
            ViewGroup.LayoutParams p = in.getLayoutParams();
            p.width = (int) (ff.getWidth() * fr);
            in.setLayoutParams(p);
        } });
        return f;
    }

    protected View sxChart(JSONArray a) {
        final int n = a.length();
        final double[] v = new double[n];
        double mx = 1;
        for (int i = 0; i < n; i++) { v[i] = a.optDouble(i, 0); mx = Math.max(mx, v[i]); }
        final double fmx = mx;
        View c = new View(this) {
            @Override protected void onDraw(Canvas cv) {
                if (n < 2) return;
                int w = getWidth(), h = getHeight();
                float pad = dp(8);
                Path line = new Path(), fill = new Path();
                for (int i = 0; i < n; i++) {
                    float x = pad + (w - 2 * pad) * i / (n - 1f);
                    float y = (float) (h - pad - (h - 2 * pad) * (v[i] / fmx));
                    if (i == 0) { line.moveTo(x, y); fill.moveTo(x, h); fill.lineTo(x, y); } else { line.lineTo(x, y); fill.lineTo(x, y); }
                    if (i == n - 1) fill.lineTo(x, h);
                }
                fill.close();
                Paint pf = new Paint(Paint.ANTI_ALIAS_FLAG);
                pf.setColor(0x33F5C35A);
                cv.drawPath(fill, pf);
                Paint pl = new Paint(Paint.ANTI_ALIAS_FLAG);
                pl.setColor(GOLD); pl.setStyle(Paint.Style.STROKE); pl.setStrokeWidth(dp(3));
                pl.setStrokeCap(Paint.Cap.ROUND); pl.setStrokeJoin(Paint.Join.ROUND);
                cv.drawPath(line, pl);
                Paint pd = new Paint(Paint.ANTI_ALIAS_FLAG);
                pd.setColor(GOLD);
                float lx = w - pad;
                float ly = (float) (h - pad - (h - 2 * pad) * (v[n - 1] / fmx));
                cv.drawCircle(lx, ly, dp(5), pd);
            }
        };
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(90));
        lp.setMargins(0, dp(8), 0, 0);
        c.setLayoutParams(lp);
        // الرسم يُرسم من اليسار لليمين دائماً (التاريخ الأحدث في النهاية)
        c.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        return c;
    }

    protected void sxBuild() {
        final JSONObject d = sxData;
        LinearLayout p = new LinearLayout(this);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(0, statusH() + dp(6), 0, 0);
        LinearLayout h = new LinearLayout(this);
        h.setGravity(Gravity.CENTER_VERTICAL);
        h.setPadding(dp(16), dp(12), dp(16), dp(8));
        h.addView(backBtn(new Runnable() { @Override public void run() { if (sxDlg != null) sxDlg.dismiss(); } }));
        TextView ti = txt(L("إحصائياتي", "My stats"), GOLD, 18, true);
        ti.setPaddingRelative(dp(14), 0, 0, 0);
        h.addView(ti, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        p.addView(h);

        LinearLayout chips = new LinearLayout(this);
        chips.setPadding(dp(16), 0, dp(16), dp(8));
        final int[] ds = { 7, 30, 0 };
        String[] nm = { L("أسبوع", "Week"), L("شهر", "Month"), L("الكل", "All") };
        for (int i = 0; i < 3; i++) {
            final int dv = ds[i];
            boolean on = sxDays == dv;
            TextView c = txt(nm[i], on ? NAVY : MUTED, 14, true);
            c.setGravity(Gravity.CENTER);
            c.setPadding(dp(18), dp(8), dp(18), dp(8));
            c.setBackground(rbg(on ? GOLD : 0x00000000, on ? GOLD : 0xFF2A3258, 20));
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cl.setMarginEnd(dp(8));
            c.setLayoutParams(cl);
            c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { sxDays = dv; sxLoad(); } });
            chips.addView(c);
        }
        p.addView(chips);

        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(dp(16), dp(6), dp(16), navH() + dp(40));

        long rank = d.optLong("rank", 0);
        long fnew = d.optLong("foll_new"), fprev = d.optLong("foll_prev");
        long views = d.optLong("views"), vprev = d.optLong("views_prev");
        double sup = d.optDouble("sup_total"), sprev = d.optDouble("sup_prev");

        // بطاقة الترتيب
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable tg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFFC8902F, 0xFFF5C35A });
        tg.setCornerRadius(dp(22));
        top.setBackground(tg);
        LinearLayout tl = new LinearLayout(this);
        tl.setOrientation(LinearLayout.VERTICAL);
        tl.addView(txt(L("ترتيبك بين المشجعين", "Your rank among fans"), NAVY, 14, true));
        tl.addView(txt(sxNum(d.optLong("followers")) + " " + L("متابِع", "followers"), 0xCC0A1033, 13, false));
        top.addView(tl, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        top.addView(txt("#" + rank, NAVY, 30, true));
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tlp.setMargins(0, 0, 0, dp(12));
        b.addView(top, tlp);

        // الملخص
        b.addView(sxRow(sxTile(L("👥 متابعون جدد", "👥 New followers"), "\u200E+" + sxNum(fnew), Color.WHITE, sxDelta(fnew, fprev)),
                        sxTile(L("👁 مشاهدات منشوراتك", "👁 Post views"), sxNum(views), Color.WHITE, sxDelta(views, vprev))));
        LinearLayout sp = new LinearLayout(this); b.addView(sp, new LinearLayout.LayoutParams(1, dp(12)));
        b.addView(sxRow(sxTile(L("🎁 دعم وصلك", "🎁 Support received"), sxNum(sup), GOLD, sxDelta(sup, sprev)),
                        sxTile(L("🔗 دعوات نجحت", "🔗 Invites"), sxNum(d.optLong("ref_total")), Color.WHITE, null)));
        LinearLayout sp2 = new LinearLayout(this); b.addView(sp2, new LinearLayout.LayoutParams(1, dp(12)));

        // رسم المشاهدات
        LinearLayout cc = sxCard();
        LinearLayout ch = sxHead("📈", L("المشاهدات يومياً", "Daily views"), L("آخر 7 أيام", "Last 7 days"), MUTED);
        ((TextView) ch.getChildAt(2)).setTextSize(12);
        cc.addView(ch);
        cc.addView(sxChart(d.optJSONArray("daily") == null ? new JSONArray() : d.optJSONArray("daily")));
        b.addView(cc);

        // التعزيز
        LinearLayout bc = sxCard();
        bc.addView(sxHead("🚀", L("التعزيز", "Boost"), null, 0));
        LinearLayout br = new LinearLayout(this);
        br.setPadding(0, dp(10), 0, 0);
        String[][] bt = {
            { String.valueOf(d.optLong("boost_n")), L("منشور معزَّز", "Boosted posts"), "w" },
            { "\u200E+" + sxNum(d.optLong("boost_views")), L("مشاهدة إضافية", "Extra views"), "g" },
            { sxNum(d.optDouble("boost_spent")), L("نقطة صُرفت", "Points spent"), "y" } };
        for (int i = 0; i < 3; i++) {
            LinearLayout cell = new LinearLayout(this);
            cell.setOrientation(LinearLayout.VERTICAL);
            cell.setGravity(Gravity.CENTER);
            cell.addView(txt(bt[i][0], bt[i][2].equals("g") ? SX_GREEN : bt[i][2].equals("y") ? GOLD : Color.WHITE, 20, true));
            cell.addView(txt(bt[i][1], MUTED, 12, false));
            br.addView(cell, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        bc.addView(br);
        b.addView(bc);

        // التوقع
        long pt = d.optLong("pred_total"), pok = d.optLong("pred_ok");
        LinearLayout pc = sxCard();
        pc.addView(sxHead("🎯", L("التوقع", "Predictions"), pt > 0 ? (Math.round(100.0 * pok / pt) + "%") : "—", GOLD));
        pc.addView(sxBar(pt > 0 ? (double) pok / pt : 0));
        pc.addView(txt(pok + " " + L("صحيح من", "correct of") + " " + pt + "  ·  \uD83D\uDD25 " + L("أطول سلسلة", "best streak") + " " + d.optLong("pred_streak"), MUTED, 13, false));
        JSONArray pl = d.optJSONArray("pred_last");
        if (pl != null && pl.length() > 0) {
            LinearLayout dots = new LinearLayout(this);
            dots.setPadding(0, dp(10), 0, 0);
            for (int i = 0; i < pl.length(); i++) {
                TextView dt = txt("\u25CF ", "correct".equals(pl.optString(i)) ? SX_GREEN : SX_RED, 20, false);
                dots.addView(dt);
            }
            pc.addView(dots);
        }
        b.addView(pc);

        // الدعوات
        long rt = d.optLong("ref_total");
        long goalN = rt < 3 ? 3 : rt < 10 ? 10 : rt < 50 ? 50 : 100;
        LinearLayout rc = sxCard();
        rc.addView(sxHead("🔗", L("الدعوات", "Invites"), "\u200E" + rt + " / " + goalN + "\u200E", Color.WHITE));
        rc.addView(sxBar((double) rt / goalN));
        rc.addView(txt(L("باقي ", "") + (goalN - rt) + L(" دعوة للمرحلة التالية", " more for the next milestone"), MUTED, 13, false));
        long[] ms = { 3, 10, 50, 100 };
        String[] mn = { L("المشجع", "Fan"), L("المؤثر", "Influencer"), L("السفير", "Ambassador"), L("الأسطورة", "Legend") };
        for (int i = 0; i < ms.length; i++) {
            LinearLayout mr = new LinearLayout(this);
            mr.setGravity(Gravity.CENTER_VERTICAL);
            mr.setPadding(0, dp(10), 0, 0);
            boolean done = rt >= ms[i];
            mr.addView(txt(done ? "\u2705  " : "\uD83D\uDD12  ", Color.WHITE, 16, false));
            mr.addView(txt(ms[i] + " " + L("دعوة", "invites") + " \u00B7 " + mn[i], done ? SX_GREEN : MUTED, 14, true));
            rc.addView(mr);
        }
        JSONArray rl = d.optJSONArray("ref_list");
        if (rl != null && rl.length() > 0) {
            TextView rh = txt(L("آخر من دعوتهم", "Recently invited"), Color.WHITE, 14, true);
            rh.setPadding(0, dp(14), 0, 0);
            rc.addView(rh);
            for (int i = 0; i < rl.length(); i++) {
                JSONObject o = rl.optJSONObject(i);
                if (o == null) continue;
                TextView rr = txt("\u2022 " + o.optString("name", ""), MUTED, 14, false);
                rr.setPadding(0, dp(6), 0, 0);
                rc.addView(rr);
            }
        }
        rc.addView(txt("\uD83D\uDD17  " + L("ادعُ صديقاً", "Invite a friend"), GOLD, 14, true));
        ((TextView) rc.getChildAt(rc.getChildCount() - 1)).setPadding(0, dp(14), 0, 0);
        rc.getChildAt(rc.getChildCount() - 1).setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            try { Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, "ZELO Sport\n" + referralLink()); startActivity(Intent.createChooser(i, L("مشاركة", "Share"))); } catch (Exception ignore) {}
        } });
        b.addView(rc);

        // الداعمون
        JSONArray ts = d.optJSONArray("top_sup");
        LinearLayout sc2 = sxCard();
        sc2.addView(sxHead("🎁", L("الداعمون", "Supporters"), sxNum(d.optDouble("sup_all")), GOLD));
        if (ts != null && ts.length() > 0) {
            String[] medal = { "🥇", "🥈", "🥉" };
            for (int i = 0; i < ts.length(); i++) {
                JSONObject o = ts.optJSONObject(i);
                if (o == null) continue;
                LinearLayout r = new LinearLayout(this);
                r.setGravity(Gravity.CENTER_VERTICAL);
                r.setPadding(0, dp(10), 0, 0);
                r.addView(txt(medal[i] + "  ", Color.WHITE, 18, false));
                TextView nmT = txt(o.optString("name", ""), Color.WHITE, 15, true);
                nmT.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
                nmT.setGravity(Gravity.START);
                nmT.setSingleLine(true);
                nmT.setEllipsize(android.text.TextUtils.TruncateAt.END);
                r.addView(nmT, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                TextView amT = txt(sxNum(o.optDouble("amt")), GOLD, 15, true);
                amT.setPaddingRelative(dp(12), 0, 0, 0);
                r.addView(amT);
                sc2.addView(r);
            }
            sc2.addView(txt("👑 " + L("داعمك الأول: ", "Top supporter: ") + ts.optJSONObject(0).optString("name", "") + "  ·  " + d.optLong("sup_people") + " " + L("داعم", "supporters"), MUTED, 13, false));
        } else {
            sc2.addView(txt(L("لم يصلك دعم بعد", "No support yet"), MUTED, 13, false));
        }
        b.addView(sc2);

        // أفضل منشور
        JSONObject best = d.optJSONObject("best");
        if (best != null) {
            LinearLayout bp = sxCard();
            bp.addView(sxHead("🏆", L("أفضل منشور", "Best post"), sxNum(best.optLong("views")) + " 👁", Color.WHITE));
            TextView bc2 = txt(best.optString("content", ""), MUTED, 14, false);
            bc2.setPadding(0, dp(8), 0, dp(8));
            bp.addView(bc2);
            bp.addView(txt("♥ " + best.optLong("likes") + "   ↻ " + best.optLong("reposts") + "   🎁 " + sxNum(best.optDouble("support")), Color.WHITE, 14, true));
            b.addView(bp);
        }

        // مشاركة
        TextView sh = txt("📤  " + L("شارك إحصائياتي", "Share my stats"), NAVY, 16, true);
        sh.setGravity(Gravity.CENTER);
        GradientDrawable sg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { GOLD, 0xFFFDE9A8 });
        sg.setCornerRadius(dp(18));
        sh.setBackground(sg);
        sh.setPadding(0, dp(14), 0, dp(14));
        sh.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { sxShare(); } });
        b.addView(sh, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ScrollView s = new ScrollView(this);
        s.addView(b);
        p.addView(s, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        sxRoot.removeAllViews();
        sxRoot.addView(p, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    protected void sxShare() {
        final JSONObject d = sxData;
        toast(L("جارٍ تجهيز البطاقة...", "Preparing card..."));
        pool.execute(new Runnable() { @Override public void run() {
            try {
                Bitmap ball = fetchBitmap("https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png");
                Bitmap bmp = sxDrawCard(d, ball);
                java.io.File f = new java.io.File(getCacheDir(), "zelo_season.png");
                java.io.FileOutputStream fo = new java.io.FileOutputStream(f);
                bmp.compress(Bitmap.CompressFormat.PNG, 100, fo);
                fo.close();
                final java.io.File ff = f;
                runOnUiThread(new Runnable() { @Override public void run() { shareImageFile(ff); } });
            } catch (Exception e) {
                runOnUiThread(new Runnable() { @Override public void run() { toast(L("تعذّر إنشاء البطاقة", "Could not create card")); } });
            }
        } });
    }

    protected Bitmap sxDrawCard(JSONObject d, Bitmap ball) {
        int W = 1080, H = 1920;
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new android.graphics.LinearGradient(0, 0, W, H, new int[] { 0xFF24348F, 0xFF0A1033, 0xFF3A2408 }, null, android.graphics.Shader.TileMode.CLAMP));
        c.drawRect(0, 0, W, H, p);
        p.setShader(null);
        p.setTextAlign(Paint.Align.CENTER);
        p.setTypeface(Typeface.DEFAULT_BOLD);
        p.setColor(GOLD); p.setTextSize(52);
        c.drawText("ZELO SPORT", W / 2f, 150, p);
        if (ball != null) c.drawBitmap(ball, null, new RectF(W / 2f - 110, 230, W / 2f + 110, 450), p);
        long pt = d.optLong("pred_total"), pok = d.optLong("pred_ok");
        p.setColor(0xFF9AA6D8); p.setTextSize(44);
        c.drawText(L("دقة توقعاتك", "Prediction accuracy"), W / 2f, 600, p);
        p.setColor(GOLD); p.setTextSize(240);
        c.drawText(pt > 0 ? (Math.round(100.0 * pok / pt) + "%") : "\u2014", W / 2f, 830, p);
        String[][] t = {
            { "#" + d.optLong("rank"), L("ترتيبك", "Rank") },
            { String.valueOf(d.optLong("pred_streak")), L("أطول سلسلة 🔥", "Best streak") },
            { sxNum(d.optLong("followers")), L("متابِعون", "Followers") },
            { sxNum(d.optDouble("sup_all")), L("دعم وصلك", "Support") } };
        for (int i = 0; i < 4; i++) {
            float x = 70 + (i % 2) * 490, y = 960 + (i / 2) * 270;
            Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG);
            bp.setColor(0x22FFFFFF);
            c.drawRoundRect(new RectF(x, y, x + 450, y + 230), 40, 40, bp);
            p.setColor(Color.WHITE); p.setTextSize(88);
            c.drawText(t[i][0], x + 225, y + 120, p);
            p.setColor(0xFF9AA6D8); p.setTextSize(38);
            c.drawText(t[i][1], x + 225, y + 190, p);
        }
        Paint bp2 = new Paint(Paint.ANTI_ALIAS_FLAG);
        bp2.setShader(new android.graphics.LinearGradient(70, 0, 1010, 0, GOLD, 0xFFFDE9A8, android.graphics.Shader.TileMode.CLAMP));
        c.drawRoundRect(new RectF(70, 1640, 1010, 1780), 50, 50, bp2);
        p.setColor(NAVY); p.setTextSize(52);
        c.drawText(L("حمّل ZELO Sport وتحدّاني ⚽", "Download ZELO Sport & challenge me"), W / 2f, 1730, p);
        return bmp;
    }

    // ===== برنامج المبدعين / مكافآت المحتوى الأصلي =====
    protected Dialog crDlg;
    protected LinearLayout crBody;
    protected void crOpenWallet() {}
    protected double crSupVal = -1;
    protected double crRateVal = 200;

    protected void openCreator() {
        if (uid == null) return;
        if (crDlg != null) { try { crDlg.dismiss(); } catch (Exception ignore) {} }
        crDlg = sheetDialog(true);
        crDlg.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(crDlg);
        FrameLayout root = new FrameLayout(this);
        crDlg.setContentView(root);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(0, statusH(), 0, 0);
        root.addView(col, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(8), dp(8), dp(16), dp(8));
        top.addView(backBtn(new Runnable() { @Override public void run() { if (crDlg != null) crDlg.dismiss(); } }));
        TextView tt = txt(L("مكافآت المحتوى الأصلي", "Original content rewards"), Color.WHITE, 18, true);
        tt.setPadding(dp(12), 0, dp(12), 0);
        top.addView(tt, new LinearLayout.LayoutParams(0, -2, 1f));
        col.addView(top, new LinearLayout.LayoutParams(-1, -2));
        ScrollView sv = new ScrollView(this);
        crBody = new LinearLayout(this);
        crBody.setOrientation(LinearLayout.VERTICAL);
        crBody.setPadding(dp(16), dp(8), dp(16), dp(40) + navH());
        sv.addView(crBody, new ViewGroup.LayoutParams(-1, -2));
        col.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1f));
        crDlg.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface d) { crDlg = null; } });
        crDlg.show();
        crLoad();
    }

    protected void crLoad() {
        crBody.removeAllViews();
        TextView ld = txt(L("جارٍ التحميل...", "Loading..."), MUTED, 15, false);
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(60), 0, 0);
        crBody.addView(ld);
        pool.execute(new Runnable() { @Override public void run() {
            JSONObject o = null;
            try { o = new JSONObject(rpc("creator_status", "{}")); } catch (Exception ignore) {}
            crSupVal = -1;
            try { crSupVal = new JSONObject(rpc("my_stats", "{\"p_days\":30}")).optDouble("sup_total", 0); } catch (Exception ignore) {}
            try { JSONArray rc = new JSONArray(get("usdt_withdraw_config?select=diamonds_per_usdt&limit=1")); if (rc.length() > 0) crRateVal = Math.max(1, rc.getJSONObject(0).optDouble("diamonds_per_usdt", 200)); } catch (Exception ignore) {}
            final JSONObject fo = o;
            runOnUiThread(new Runnable() { @Override public void run() {
                if (crDlg == null) return;
                if (fo == null || fo.optJSONObject("check") == null) {
                    crBody.removeAllViews();
                    TextView e = txt(L("تعذّر التحميل، اضغط للمحاولة", "Could not load, tap to retry"), MUTED, 15, false);
                    e.setGravity(Gravity.CENTER);
                    e.setPadding(0, dp(60), 0, 0);
                    e.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { crLoad(); } });
                    crBody.addView(e);
                    return;
                }
                crBuild(fo);
            } });
        } });
    }

    protected String crN(double v) { return "‎" + String.format(java.util.Locale.US, "%,d", Math.round(v)); }
    protected String crUsd(double v) { return "‎$" + String.format(java.util.Locale.US, "%.2f", v); }

    protected View crReq(boolean ok, String label, String val, double frac, boolean bar, String note) {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.VERTICAL);
        r.setPadding(0, dp(8), 0, dp(8));
        LinearLayout h = new LinearLayout(this);
        h.setGravity(Gravity.CENTER_VERTICAL);
        h.addView(txt(ok ? "✅  " : "❌  ", Color.WHITE, 16, false));
        h.addView(txt(label, Color.WHITE, 15, true), new LinearLayout.LayoutParams(0, -2, 1f));
        h.addView(txt(val, ok ? SX_GREEN : GOLD, 14, true));
        r.addView(h);
        if (bar) r.addView(sxBar(frac));
        if (note != null) r.addView(txt(note, MUTED, 12, false));
        return r;
    }

    protected void crBuild(final JSONObject d) {
        crBody.removeAllViews();
        JSONObject c = d.optJSONObject("check");
        boolean elig = c.optBoolean("eligible");
        // الحالة
        LinearLayout hero = sxCard();
        hero.setGravity(Gravity.CENTER_HORIZONTAL);
        hero.addView(txt("💰", Color.WHITE, 36, false));
        if (elig) {
            hero.addView(txt(L("أنت ضمن البرنامج ✓", "You are in the program ✓"), SX_GREEN, 17, true));
            hero.addView(txt(L("أرباحك التقديرية هذا الشهر", "Your estimated earnings this month"), MUTED, 13, false));
            hero.addView(txt(crUsd(d.optDouble("est", 0)), GOLD, 34, true));
        } else {
            hero.addView(txt(L("لم تتأهل بعد", "Not eligible yet"), GOLD, 17, true));
            hero.addView(txt(L("أكمل الشروط التالية للانضمام", "Complete the requirements below to join"), MUTED, 13, false));
        }
        crBody.addView(hero);
        // دعم المشجعين (يعمل لكل المستخدمين دون تأهل)
        if (crSupVal >= 0) {
            LinearLayout sup = sxCard();
            sup.addView(sxHead("🎁", L("دعم المشجعين (آخر 30 يوماً)", "Fan support (last 30 days)"), crN(crSupVal) + L(" كورة", " Kora"), GOLD));
            sup.addView(txt(L("يعادل تقريباً ", "About ") + crUsd(crSupVal / crRateVal) + " USDT", MUTED, 13, false));
            TextView sl = txt(L("تفاصيل الداعمين في إحصائياتي ›", "Supporter details in My stats ›"), GOLD, 13, true);
            sl.setPadding(0, dp(8), 0, 0);
            sl.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openStats(); } });
            sup.addView(sl);
            crBody.addView(sup);
        }
        // الشروط
        LinearLayout rq = sxCard();
        rq.addView(txt(L("الشروط", "Requirements"), Color.WHITE, 16, true));
        double vfReq = c.optDouble("vf_req", 500), vwReq = c.optDouble("views_req", 20000);
        double vf = c.optDouble("vf", 0), vw = c.optDouble("views", 0);
        rq.addView(crReq(c.optBoolean("age_ok"), L("العمر ", "Age ") + crN(c.optDouble("age_req", 18)) + L(" فأكثر", "+"), c.optBoolean("age_ok") ? "" : crN(c.optDouble("age", 0)), 0, false, null));
        rq.addView(crReq(c.optBoolean("days_ok"), L("مدة الحساب (يوم)", "Account age (days)"), crN(c.optDouble("days", 0)) + " / " + crN(c.optDouble("days_req", 30)), 0, false, null));
        rq.addView(crReq(c.optBoolean("vf_ok"), L("متابعون موثّقون", "Verified followers"), crN(vf) + " / " + crN(vfReq), vf / Math.max(1, vfReq), true,
            L("المتابع الموثّق = مشترك باشتراك فعّال", "Verified follower = active subscriber")));
        rq.addView(crReq(c.optBoolean("views_ok"), L("مشاهدات آخر 90 يوماً", "Views, last 90 days"), crN(vw) + " / " + crN(vwReq), vw / Math.max(1, vwReq), true,
            L("لا يشمل الردود ولا مشاهداتك", "Excludes replies and your own views")));
        View wr = crReq(c.optBoolean("wallet_ok"), L("عنوان السحب", "Withdrawal address"), c.optBoolean("wallet_ok") ? "" : L("إضافة ›", "Add ›"), 0, false, null);
        if (!c.optBoolean("wallet_ok")) wr.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { crOpenWallet(); } });
        rq.addView(wr);
        crBody.addView(rq);
        if (elig) {
            JSONObject p = d.optJSONObject("pts");
            LinearLayout pc = sxCard();
            pc.addView(sxHead("📈", L("نقاط هذا الشهر", "This month's points"), crN(p == null ? 0 : p.optDouble("points")), GOLD));
            if (p != null) {
                pc.addView(txt(L("مشاهدات: ", "Views: ") + crN(p.optDouble("views")) + "   " + L("متابعون: ", "Follows: ") + crN(p.optDouble("follows")), MUTED, 13, false));
                pc.addView(txt(L("إعادة نشر: ", "Reposts: ") + crN(p.optDouble("reposts")) + "   " + L("إعجابات: ", "Likes: ") + crN(p.optDouble("likes")), MUTED, 13, false));
            }
            pc.addView(txt(L("ترتيبك: ", "Rank: ") + crN(d.optDouble("rank", 1)) + (d.isNull("pool") ? "" : "   " + L("مجموع الجائزة: ", "Pool: ") + crUsd(d.optDouble("pool"))), MUTED, 13, false));
            crBody.addView(pc);
            JSONArray h = d.optJSONArray("history");
            if (h != null && h.length() > 0) {
                LinearLayout hc = sxCard();
                hc.addView(txt(L("السجل", "History"), Color.WHITE, 16, true));
                for (int i = 0; i < h.length(); i++) {
                    JSONObject it = h.optJSONObject(i);
                    if (it == null) continue;
                    String st = it.optString("status");
                    String sl = "paid".equals(st) ? L("أُضيف للمحفظة", "Added to wallet") : "requested".equals(st) ? L("قيد الدفع", "Pending") : L("متراكم", "Accrued");
                    LinearLayout row = new LinearLayout(this);
                    row.setPadding(0, dp(6), 0, dp(6));
                    String m = it.optString("month");
                    row.addView(txt(m.length() >= 7 ? m.substring(0, 7) : m, Color.WHITE, 14, false), new LinearLayout.LayoutParams(0, -2, 1f));
                    row.addView(txt(sl + "  ", MUTED, 13, false));
                    row.addView(txt(crUsd(it.optDouble("amount_usd")), GOLD, 14, true));
                    hc.addView(row);
                }
                crBody.addView(hc);
            }
        }
        // كيف يعمل
        LinearLayout how = sxCard();
        how.addView(txt(L("كيف يعمل البرنامج؟", "How it works"), Color.WHITE, 16, true));
        TextView ht = txt(L("تُوزَّع نسبة من صافي إيرادات الاشتراكات كل شهر على المبدعين المؤهلين بحسب تفاعل الناس مع محتواهم الأصلي (مشاهدات، متابعون جدد، إعادة نشر، إعجابات). لا تُحتسب تفاعلاتك مع نفسك. الأرباح تقديرية وتتأكد بعد إغلاق الشهر ومراجعة الإدارة.",
            "A share of net subscription revenue is distributed monthly to eligible creators based on engagement with their original content. Self-interactions don't count. Estimates are confirmed after the month closes and admin review."), MUTED, 13, false);
        ht.setLineSpacing(dp(3), 1f);
        how.addView(ht);
        crBody.addView(how);
        // الأرباح تُضاف تلقائياً إلى المحفظة أول كل شهر
        LinearLayout au = sxCard();
        au.addView(txt(L("الدفع تلقائي", "Automatic payout"), Color.WHITE, 16, true));
        TextView at = txt(L("تُضاف أرباح الشهر تلقائياً إلى محفظتك (كورة) في أول الشهر التالي، وتسحبها من المحفظة بشروط السحب المعتادة.",
            "Your monthly earnings are added to your wallet (coins) on the 1st of next month, and you withdraw from the wallet under the usual rules."), MUTED, 13, false);
        at.setLineSpacing(dp(3), 1f);
        au.addView(at);
        crBody.addView(au);
        TextView btn = txt(L("فتح المحفظة", "Open wallet"), 0xFF1A1200, 15, true);
        btn.setGravity(Gravity.CENTER);
        btn.setPadding(0, dp(14), 0, dp(14));
        btn.setBackground(rbg(GOLD, 0x00000000, 24));
        btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { crOpenWallet(); } });
        crBody.addView(btn, new LinearLayout.LayoutParams(-1, -2));
    }

    // ================= صفحة «إحصائيات التعزيز» =================
    protected Dialog bsDlg;

    @Override
    protected void openBoostStats() {
        if (uid == null) return;
        bsDlg = sheetDialog(true);
        bsDlg.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(bsDlg);
        FrameLayout root = new FrameLayout(this);
        bsDlg.setContentView(root);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(0, statusH(), 0, 0);
        root.addView(col, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(8), dp(8), dp(16), dp(8));
        top.addView(backBtn(new Runnable() { @Override public void run() { if (bsDlg != null) bsDlg.dismiss(); } }));
        TextView ti = tv(Color.WHITE, 18, true);
        ti.setText("⚡ " + L("إحصائيات التعزيز", "Boost stats"));
        ti.setPadding(dp(8), 0, 0, 0);
        top.addView(ti);
        col.addView(top);
        ScrollView sv = new ScrollView(this);
        final LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), dp(8), dp(16), navH() + dp(20));
        sv.addView(body);
        col.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1f));
        TextView ld = tv(MUTED, 14, false);
        ld.setText(L("جارٍ التحميل…", "Loading…"));
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(30), 0, 0);
        body.addView(ld);
        bsDlg.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(rpc("my_boost_stats", "{}"));
                    myBoost.clear(); myBoostList.clear();
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject o = a.getJSONObject(i);
                        myBoostList.add(o);
                        String k = String.valueOf(o.optLong("post_id"));
                        if (!myBoost.containsKey(k)) myBoost.put(k, o);
                    }
                    everBoosted = myBoostList.size() > 0;
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { bsFill(body); } });
            }
        });
    }

    protected void bsFill(LinearLayout body) {
        body.removeAllViews();
        if (myBoostList.isEmpty()) {
            TextView e = tv(MUTED, 14, false);
            e.setText(L("لم تعزّز أي منشور بعد.", "You haven't boosted any post yet."));
            e.setGravity(Gravity.CENTER);
            e.setPadding(0, dp(30), 0, 0);
            body.addView(e);
            return;
        }
        long imp = 0, cm = 0, fl = 0, tp = 0;
        for (JSONObject b : myBoostList) {
            imp += b.optLong("impressions", 0); cm += b.optLong("comments", 0);
            fl += b.optLong("followers", 0); tp += b.optLong("tips_net", 0);
        }
        TextView h1 = tv(MUTED, 13, true);
        h1.setText(L("المجموع", "Totals"));
        h1.setPadding(0, dp(4), 0, dp(6));
        body.addView(h1);
        LinearLayout tot = new LinearLayout(this);
        bxChip(nfmt(imp), L("ظهور كلي", "Total reach"), tot);
        bxChip(nfmt(cm), L("تعليقات", "Comments"), tot);
        bxChip(nfmt(fl), L("متابعون جدد", "New followers"), tot);
        bxChip(nfmt(tp), L("دعم كورة", "Kora support"), tot);
        body.addView(tot);
        TextView h2 = tv(MUTED, 13, true);
        h2.setText(L("منشوراتك المعزَّزة", "Your boosted posts"));
        h2.setPadding(0, dp(16), 0, dp(6));
        body.addView(h2);
        for (final JSONObject b : myBoostList) {
            boolean live = "active".equals(b.optString("status"));
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(14), dp(12), dp(14), dp(12));
            card.setBackground(bxBg(0xFF111A4A, live ? 0x55F5C35A : 0x22FFFFFF, 14));
            LinearLayout hd = new LinearLayout(this);
            hd.setGravity(Gravity.CENTER_VERTICAL);
            TextView sn = tv(Color.WHITE, 14, true);
            String snip = b.optString("snippet", "").trim();
            sn.setText(snip.length() > 0 ? snip : L("منشور", "Post"));
            sn.setMaxLines(1);
            sn.setEllipsize(android.text.TextUtils.TruncateAt.END);
            hd.addView(sn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            TextView st = tv(live ? NAVY : MUTED, 11, true);
            st.setText(live ? "⚡ " + L("نشط", "Active") : L("منتهٍ", "Ended"));
            st.setPadding(dp(8), dp(2), dp(8), dp(2));
            st.setBackground(bxBg(live ? GOLD : 0x22FFFFFF, 0, 10));
            hd.addView(st);
            card.addView(hd);
            TextView lf = tv(MUTED, 12, false);
            lf.setText(bxLeft(b));
            lf.setPadding(0, dp(4), 0, dp(4));
            card.addView(lf);
            card.addView(bxBar(bxPct(b), live));
            TextView rc = tv(MUTED, 12, false);
            rc.setText(L("وصل إلى ", "Reached ") + nfmt(b.optLong("impressions", 0)) + L(" من ", " of ") + nfmt(b.optLong("target", 0)) + L(" ظهوراً", " impressions"));
            rc.setPadding(0, dp(4), 0, dp(8));
            card.addView(rc);
            LinearLayout chips = new LinearLayout(this);
            bxChips4(chips, b);
            card.addView(chips);
            View sp = bxSupport(b);
            sp.setPadding(0, dp(8), 0, 0);
            card.addView(sp);
            TextView sp2 = tv(MUTED, 11, false);
            sp2.setText(L("أُنفق ", "Spent ") + (b.optLong("spent_tenths", 0) / 10) + L(" من ", " of ") + nfmt(b.optLong("total_points", 0)) + L(" كورة", " Kora"));
            sp2.setPadding(0, dp(4), 0, 0);
            card.addView(sp2);
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT);
            cl.bottomMargin = dp(10);
            body.addView(card, cl);
        }
    }
}
