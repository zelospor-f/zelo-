package PKG;

import android.graphics.RadialGradient;
import android.graphics.SweepGradient;
import android.graphics.LinearGradient;
import android.graphics.Shader;
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

abstract class ShareCard extends Search {
    // ===== من share-card.js: بطاقة مشاركة التوقع الصحيح (1080×1920) =====
    protected Bitmap fetchBitmap(String u) {
        try {
            if (u == null || u.length() == 0) return null;
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
            c.setConnectTimeout(4000); c.setReadTimeout(4000);
            return BitmapFactory.decodeStream(c.getInputStream());
        } catch (Exception e) { return null; }
    }

    protected void openShareCard(String userId) {
        final String id = userId == null || userId.length() == 0 ? uid : userId;
        if (id == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        toast(L("جارٍ تجهيز البطاقة…", "Preparing card…"));
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("match_predictions?select=predicted_home,predicted_away,matches(team_a,team_b,home_score,away_score)&user_id=eq." + id + "&prediction_status=eq.correct&order=created_at.desc&limit=1"));
                    if (a.length() == 0 || a.getJSONObject(0).isNull("matches")) { runOnUiThread(new Runnable() { @Override public void run() { toast(L("لا يوجد توقع صحيح بعد", "No correct prediction yet")); } }); return; }
                    JSONObject row = a.getJSONObject(0), m = row.getJSONObject("matches");
                    final String ta = m.optString("team_a"), tb = m.optString("team_b");
                    Bitmap ca = null, cb = null;
                    try {
                        JSONArray cs = new JSONArray(get("standings?select=team_name,crest&team_name=in.(" + java.net.URLEncoder.encode("\"" + ta + "\",\"" + tb + "\"", "UTF-8") + ")"));
                        for (int i = 0; i < cs.length(); i++) {
                            JSONObject c = cs.getJSONObject(i);
                            if (c.isNull("crest")) continue;
                            if (c.optString("team_name").equalsIgnoreCase(ta) && ca == null) ca = fetchBitmap(c.optString("crest"));
                            if (c.optString("team_name").equalsIgnoreCase(tb) && cb == null) cb = fetchBitmap(c.optString("crest"));
                        }
                    } catch (Exception ignore) {}
                    Bitmap ball = fetchBitmap("https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png");
                    String name = "", handle = uname == null ? "" : uname;
                    long bal = 0;
                    try {
                        JSONArray u = new JSONArray(get("users?select=nickname_ar,nickname_en,username,points&user_id=eq." + id));
                        if (u.length() > 0) {
                            JSONObject o = u.getJSONObject(0);
                            name = isAr() ? (o.isNull("nickname_ar") || o.optString("nickname_ar").length() == 0 ? o.optString("nickname_en") : o.optString("nickname_ar")) : (o.isNull("nickname_en") || o.optString("nickname_en").length() == 0 ? o.optString("nickname_ar") : o.optString("nickname_en"));
                            if ("null".equals(name)) name = "";
                            if (!o.isNull("username")) handle = o.optString("username");
                            bal = o.optLong("points");
                        }
                    } catch (Exception ignore) {}
                    if (name.length() == 0) name = handle.length() > 0 ? handle : L("مستخدم", "User");
                    final Bitmap bmp = drawShareCard(ta, tb, row.optInt("predicted_home"), row.optInt("predicted_away"), m.optString("home_score"), m.optString("away_score"), name, handle, String.format(java.util.Locale.US, "%,d", bal), ca, cb, ball);
                    java.io.File f = new java.io.File(getCacheDir(), "zelo-prediction.png");
                    java.io.FileOutputStream fo = new java.io.FileOutputStream(f);
                    bmp.compress(Bitmap.CompressFormat.PNG, 100, fo);
                    fo.close();
                    final java.io.File ff = f;
                    runOnUiThread(new Runnable() { @Override public void run() { shareImageFile(ff); } });
                } catch (Exception e) { final String m = String.valueOf(e.getMessage()); runOnUiThread(new Runnable() { @Override public void run() { toast(m); } }); }
            }
        });
    }

    // يفتح قائمة المشاركة الأصلية (FileProvider الذي تعرّفه Capacitor، مستدعى بالانعكاس)
    protected void shareImageFile(java.io.File f) {
        try {
            Class<?> fp = Class.forName("androidx.core.content.FileProvider");
            android.net.Uri uri = (android.net.Uri) fp.getMethod("getUriForFile", Context.class, String.class, java.io.File.class).invoke(null, this, getPackageName() + ".fileprovider", f);
            Intent it = new Intent(Intent.ACTION_SEND);
            it.setType("image/png");
            it.putExtra(Intent.EXTRA_STREAM, uri);
            it.putExtra(Intent.EXTRA_TITLE, "ZELO SPORT");
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(it, "ZELO SPORT"));
        } catch (Throwable e) { toast(L("تعذّرت المشاركة", "Could not share")); }
    }

    protected void scCenterText(Canvas c, Paint p, String s, float cx, float cy, float maxW) {
        float w = p.measureText(s);
        if (maxW > 0 && w > maxW) { float old = p.getTextSize(); p.setTextSize(old * maxW / w); }
        Paint.FontMetrics fm = p.getFontMetrics();
        c.drawText(s, cx, cy - (fm.ascent + fm.descent) / 2, p);
    }
    protected void scBall(Canvas c, Bitmap img, float cx, float cy, float r) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        if (img != null) { c.drawBitmap(img, null, new RectF(cx - r, cy - r, cx + r, cy + r), p); return; }
        p.setColor(Color.WHITE); c.drawCircle(cx, cy, r, p);
        p.setColor(0xFF0A1033); c.drawCircle(cx, cy, r * 0.38f, p);
    }
    protected void scCrest(Canvas c, Bitmap img, String letter, float cx, float cy, float r, int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(0xFF0A1033); c.drawCircle(cx, cy, r, p);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(6); p.setColor(color); c.drawCircle(cx, cy, r, p);
        p.setStyle(Paint.Style.FILL);
        if (img != null) {
            c.save();
            Path clip = new Path(); clip.addCircle(cx, cy, r - 8, Path.Direction.CW); c.clipPath(clip);
            float k = Math.min(r * 1.5f / img.getWidth(), r * 1.5f / img.getHeight());
            float w = img.getWidth() * k, h = img.getHeight() * k;
            c.drawBitmap(img, null, new RectF(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), p);
            c.restore();
        } else {
            p.setColor(color); p.setTextAlign(Paint.Align.CENTER); p.setTypeface(Typeface.DEFAULT_BOLD); p.setTextSize(84);
            scCenterText(c, p, letter, cx, cy, 0);
        }
    }
    protected Bitmap drawShareCard(String teamA, String teamB, int pH, int pA, String rH, String rA, String name, String handle, String balance, Bitmap ca, Bitmap cb, Bitmap ball) {
        final int W = 1080, H = 1920, GD = 0xFFF5C35A;
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        c.drawColor(0xFF0A1033);
        p.setShader(new RadialGradient(W * 0.85f, -60, 1250, new int[] { 0xFF2C4BB5, 0xFF14206B, 0x000A1033 }, new float[] { 0, 0.38f, 1 }, Shader.TileMode.CLAMP));
        c.drawRect(0, 0, W, H, p);
        p.setShader(null);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(3); p.setColor(0x29F5C35A);
        c.drawCircle(-60, H + 60, 480, p); c.drawCircle(-60, H + 60, 780, p);
        p.setStyle(Paint.Style.FILL);
        p.setTextAlign(Paint.Align.CENTER); p.setTypeface(Typeface.DEFAULT_BOLD);
        // الشعار
        p.setTextSize(60);
        float bw = p.measureText("ZELO SPORT"), sx = W / 2f - (bw + 90) / 2;
        scBall(c, ball, sx + 36, 130, 36);
        p.setColor(GD); p.setTextAlign(Paint.Align.LEFT);
        Paint.FontMetrics fm = p.getFontMetrics();
        c.drawText("ZELO SPORT", sx + 90, 132 - (fm.ascent + fm.descent) / 2, p);
        p.setTextAlign(Paint.Align.CENTER);
        // الشارة
        String badge = "✓ " + L("توقّعتُ بدقة!", "Correct prediction!");
        p.setTextSize(52);
        float bgw = p.measureText(badge) + 120;
        Paint g = new Paint(Paint.ANTI_ALIAS_FLAG);
        g.setShader(new LinearGradient(W / 2f - bgw / 2, 0, W / 2f + bgw / 2, 0, 0xFFFFE7AD, GD, Shader.TileMode.CLAMP));
        c.drawRoundRect(new RectF(W / 2f - bgw / 2, 260, W / 2f + bgw / 2, 360), 50, 50, g);
        p.setColor(0xFF0A1033);
        scCenterText(c, p, badge, W / 2f, 312, 0);
        // بطاقة المباراة
        Paint f = new Paint(Paint.ANTI_ALIAS_FLAG);
        f.setColor(0x0FFFFFFF);
        c.drawRoundRect(new RectF(80, 440, W - 80, 1320), 78, 78, f);
        f.setStyle(Paint.Style.STROKE); f.setStrokeWidth(3); f.setColor(0x66F5C35A);
        c.drawRoundRect(new RectF(80, 440, W - 80, 1320), 78, 78, f);
        float cxA = 300, cxB = W - 300, cy = 640;
        scCrest(c, ca, teamA.length() > 0 ? teamA.substring(0, 1).toUpperCase() : "?", cxA, cy, 118, GD);
        scCrest(c, cb, teamB.length() > 0 ? teamB.substring(0, 1).toUpperCase() : "?", cxB, cy, 118, 0xFFFF8A95);
        p.setColor(0xFF9AA6D6); p.setTextSize(44);
        scCenterText(c, p, "VS", W / 2f, cy, 0);
        p.setColor(Color.WHITE); p.setTextSize(44);
        scCenterText(c, p, teamA, cxA, cy + 190, 360);
        p.setTextSize(44);
        scCenterText(c, p, teamB, cxB, cy + 190, 360);
        p.setColor(0xFF9AA6D6); p.setTextSize(40);
        scCenterText(c, p, L("توقّعي", "My prediction"), W / 2f, 930, 0);
        p.setColor(GD); p.setTextSize(200); p.setShadowLayer(60, 0, 0, 0x73F5C35A);
        scCenterText(c, p, pH + " - " + pA, W / 2f, 1060, 0);
        p.clearShadowLayer();
        // النتيجة الفعلية
        String finL = L("النتيجة النهائية", "Final score"), finS = rH + " - " + rA;
        p.setTextSize(40);
        float wL = p.measureText(finL), wS = p.measureText(finS), fw = wL + wS + 40 + 90;
        Paint fp = new Paint(Paint.ANTI_ALIAS_FLAG);
        fp.setColor(0x1F14F195);
        c.drawRoundRect(new RectF(W / 2f - fw / 2, 1180, W / 2f + fw / 2, 1268), 44, 44, fp);
        fp.setStyle(Paint.Style.STROKE); fp.setStrokeWidth(3); fp.setColor(0x8014F195);
        c.drawRoundRect(new RectF(W / 2f - fw / 2, 1180, W / 2f + fw / 2, 1268), 44, 44, fp);
        p.setColor(0xFF14F195); p.setTextAlign(Paint.Align.LEFT);
        float x0 = W / 2f - fw / 2 + 45;
        boolean rtl = isAr();
        Paint.FontMetrics fm2 = p.getFontMetrics();
        float by = 1224 - (fm2.ascent + fm2.descent) / 2;
        c.drawText(rtl ? finS : finL, x0, by, p);
        c.drawText(rtl ? finL : finS, x0 + (rtl ? wS : wL) + 40, by, p);
        p.setTextAlign(Paint.Align.CENTER);
        // شريط المستخدم
        f.setStyle(Paint.Style.FILL); f.setColor(0x0FFFFFFF);
        c.drawRoundRect(new RectF(80, 1440, W - 80, 1630), 60, 60, f);
        f.setStyle(Paint.Style.STROKE); f.setColor(0x1AFFFFFF);
        c.drawRoundRect(new RectF(80, 1440, W - 80, 1630), 60, 60, f);
        float ax = W - 80 - 40 - 66, ay = 1535;
        Paint ag = new Paint(Paint.ANTI_ALIAS_FLAG);
        ag.setShader(new SweepGradient(ax, ay, new int[] { 0xFFFFE7AD, GD, 0xFF2C4BB5, 0xFFFFE7AD }, null));
        c.drawCircle(ax, ay, 66, ag);
        Paint dk = new Paint(Paint.ANTI_ALIAS_FLAG); dk.setColor(0xFF0A1033);
        c.drawCircle(ax, ay, 58, dk);
        p.setColor(GD); p.setTextSize(64);
        scCenterText(c, p, (name.length() > 0 ? name.substring(0, 1) : "Z").toUpperCase(), ax, ay + 3, 0);
        p.setTextAlign(Paint.Align.RIGHT); p.setColor(Color.WHITE); p.setTextSize(50);
        Paint.FontMetrics fm3 = p.getFontMetrics();
        float sz = p.getTextSize(); float nw = p.measureText(name); if (nw > 330) p.setTextSize(sz * 330 / nw);
        c.drawText(name, ax - 90, 1510 - (fm3.ascent + fm3.descent) / 2, p);
        if (handle.length() > 0) { p.setTextSize(40); p.setColor(0xFFCFD8FF); p.setTypeface(Typeface.DEFAULT); c.drawText("@" + handle, ax - 90, 1566 - (fm3.ascent + fm3.descent) / 2, p); p.setTypeface(Typeface.DEFAULT_BOLD); }
        // الرصيد
        p.setTextSize(50); p.setColor(Color.WHITE); p.setTextAlign(Paint.Align.LEFT);
        float pw = p.measureText(balance) + 130, px = 80 + 36;
        Paint pb = new Paint(Paint.ANTI_ALIAS_FLAG); pb.setColor(0x4D000000);
        c.drawRoundRect(new RectF(px, 1535 - 48, px + pw, 1535 + 48), 48, 48, pb);
        pb.setStyle(Paint.Style.STROKE); pb.setStrokeWidth(3); pb.setColor(0x66F5C35A);
        c.drawRoundRect(new RectF(px, 1535 - 48, px + pw, 1535 + 48), 48, 48, pb);
        scBall(c, ball, px + 52, 1535, 30);
        Paint.FontMetrics fm4 = p.getFontMetrics();
        c.drawText(balance, px + 96, 1537 - (fm4.ascent + fm4.descent) / 2, p);
        p.setTextAlign(Paint.Align.CENTER); p.setColor(0xFF9AA6D6); p.setTextSize(38);
        scCenterText(c, p, L("تحدَّ توقعاتك على ZELO SPORT", "Challenge your predictions on ZELO SPORT"), W / 2f, 1780, W - 120);
        return bmp;
    }
}
