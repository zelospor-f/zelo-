package PKG;

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


abstract class Base extends Activity {
    // --- أساسيات مشتركة: إعلان دوال تُنفَّذ في طبقات لاحقة ---
    protected abstract void loadBalance();
    protected abstract void openProfile(String targetIn);

    // ===== من app.js: التنقل بين الصفحات (showPage) وتحديث الشريط العلوي (updateTopBar) =====
    // الصفحة الأصلية تفتح أصليًا، وما لم يُحوَّل بعد يفتح من الويب
    protected void showPage(String pageId) {
        if ("home".equals(pageId)) return;
        if ("videos".equals(pageId)) { openVideosTab(); return; }
        if ("profile".equals(pageId)) { openProfile(null); return; }
        if ("points".equals(pageId) || "notifications".equals(pageId)) { goWeb(pageId); return; }
        goWeb("nav:" + pageId);
    }

    protected void updateTopBar() { loadBalance(); }

    protected abstract void goWeb(String action);
    protected abstract void openVideosTab();
    protected abstract View makeRow();
    protected abstract void toggleFollowUser(final String target);
    protected abstract void bindPost(View cv, int i);
    protected abstract View navItem(int icon, String label, final String action, boolean active);

    // يضبطها هذا الشاشة عند الرجوع إلى صفحة من صفحات الويب (يقرؤها NativeFeedPlugin)
    public static String pendingAction = null;
    // إشعارات تنتظر الرجوع إلى الويب لإرسالها: {kind, target, postId, text, amount}
    public static final List<String[]> pendingNotify = new ArrayList<String[]>();
    protected void queueNotify(String kind, String target, String postId, String text, String amount) {
        if (target == null || target.length() == 0 || target.equals(uid)) return;
        synchronized (pendingNotify) { pendingNotify.add(new String[] { kind, target, postId, text == null ? "" : text, amount == null ? "" : amount }); }
    }
    protected final Map<String, long[]> sup = new HashMap<String, long[]>(); // {net, supporters}

    protected static final int GOLD = 0xFFF5C35A;
    protected static final int NAVY = 0xFF0A1033;
    protected static final int CARD = 0xFF111A4A;
    protected static final int MUTED = 0xFF9AA6D8;
    protected static final int PAGE = 20;

    protected final List<JSONObject> homeItems = new ArrayList<JSONObject>();
    protected List<JSONObject> items = homeItems;
    protected String profShown = null;
    protected final Map<String, int[]> stats = new HashMap<String, int[]>();
    protected final Map<String, String> unames = new HashMap<String, String>();
    protected final Map<String, String> photos = new HashMap<String, String>();
    protected final Set<String> liked = new HashSet<String>();
    protected final ExecutorService pool = Executors.newFixedThreadPool(4);
    protected final LruCache<String, Bitmap> cache = new LruCache<String, Bitmap>(24 * 1024 * 1024) {
        @Override protected int sizeOf(String k, Bitmap v) { return v.getByteCount(); }
    };
    protected final Set<String> reposted = new HashSet<String>();
    protected final Set<String> saved = new HashSet<String>();
    protected final Set<String> viewedMine = new HashSet<String>();
    protected final Set<String> viewedSession = new HashSet<String>();
    protected final Set<String> followSet = new HashSet<String>();
    protected final Set<String> muteSet = new HashSet<String>();
    protected final Set<String> blockSet = new HashSet<String>();
    protected final Set<String> hiddenSet = new HashSet<String>();
    protected final Map<String, JSONObject> preds = new HashMap<String, JSONObject>();
    protected final Map<String, long[]> ropes = new HashMap<String, long[]>(); // {n0, n1, mine}
    protected boolean metaLoaded = false;
    protected static final Map<String, String[]> TOPICS = new HashMap<String, String[]>();
    static {
        TOPICS.put("player", new String[] { "لاعب", "يستحق", "لا يستحق" });
        TOPICS.put("coach", new String[] { "مدرب", "أبقوه", "أقيلوه" });
        TOPICS.put("referee", new String[] { "حكم", "قرار صحيح", "قرار خاطئ" });
        TOPICS.put("club", new String[] { "نادٍ", "أفخر به", "أنتقده" });
        TOPICS.put("league", new String[] { "دوري", "قوي", "مبالغ فيه" });
        TOPICS.put("national", new String[] { "منتخب", "جاهز", "غير جاهز" });
        TOPICS.put("match", new String[] { "مباراة", "عادلة", "ظالمة" });
        TOPICS.put("transfer", new String[] { "صفقة", "ناجحة", "فاشلة" });
        TOPICS.put("compare", new String[] { "مقارنة", "", "" });
        TOPICS.put("prediction", new String[] { "توقع", "سيحدث", "لن يحدث" });
    }
    protected BaseAdapter adapter;
    protected TextView status, balance;
    protected String url, key, token, uid, uname, uavatar, linkTpl;
    protected boolean loading = false, endReached = false;
    protected int offset = 0;
    protected long t0;

    protected int navH() {
        int id = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        int h = id > 0 ? getResources().getDimensionPixelSize(id) : dp(48);
        return h + dp(8);
    }

    protected Runnable vRefresh = null;
    protected void refreshUi() {
        if (adapter != null) adapter.notifyDataSetChanged();
        if (vRefresh != null) vRefresh.run();
    }

    protected int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

    // أيقونات مرسومة بنفس أشكال الصفحة القديمة (0 تعليق، 1 تمريرة، 2 هدف، 3 مشاهدات، 4 حفظ، 5 مشاركة)
    protected static class Ic extends Drawable {
        final int type, color, px;
        final boolean on;
        final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Ic(int type, int color, boolean on, int px) { this.type = type; this.color = color; this.on = on; this.px = px; }
        @Override public int getIntrinsicWidth() { return px; }
        @Override public int getIntrinsicHeight() { return px; }
        @Override public void setAlpha(int a) {}
        @Override public void setColorFilter(ColorFilter f) {}
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
        @Override public void draw(Canvas c) {
            c.save();
            c.translate(getBounds().left, getBounds().top);
            float sc = px / 24f;
            c.scale(sc, sc);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(type == 2 ? 1.7f : 1.8f);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeJoin(Paint.Join.ROUND);
            p.setColor(color);
            Path a = new Path();
            if (type == 0) {
                a.moveTo(21, 11.5f); a.cubicTo(21, 15.64f, 17.2f, 19, 12.5f, 19);
                a.cubicTo(11.6f, 19, 10.7f, 18.88f, 9.9f, 18.65f); a.lineTo(5, 21); a.lineTo(6.4f, 17.4f);
                a.cubicTo(5.5f, 16.3f, 4.5f, 14.5f, 4.5f, 12.5f); a.cubicTo(4.5f, 8.36f, 8.3f, 5, 13, 5);
                a.cubicTo(17.7f, 5, 21, 8.36f, 21, 11.5f); a.close();
                c.drawPath(a, p);
            } else if (type == 1) {
                RectF ov = new RectF(4, 4, 20, 20);
                a.arcTo(ov, 180, 133.5f);
                c.drawPath(a, p);
                Path h1 = new Path();
                h1.moveTo(18, 3); h1.lineTo(18, 7); h1.lineTo(14, 7);
                c.drawPath(h1, p);
                c.drawCircle(12, 12, 2.6f, p);
                Path a2 = new Path();
                a2.arcTo(ov, 0, 133.5f);
                c.drawPath(a2, p);
                Path h2 = new Path();
                h2.moveTo(6, 21); h2.lineTo(6, 17); h2.lineTo(10, 17);
                c.drawPath(h2, p);
            } else if (type == 2) {
                if (on) { p.setStyle(Paint.Style.FILL_AND_STROKE); }
                c.drawCircle(12, 12, 9, p);
                p.setStyle(Paint.Style.STROKE);
                p.setColor(on ? 0xFF0A1033 : color);
                a.moveTo(12, 8.2f); a.lineTo(15.2f, 10.5f); a.lineTo(14, 14.2f); a.lineTo(10, 14.2f); a.lineTo(8.8f, 10.5f); a.close();
                c.drawPath(a, p);
                c.drawLine(12, 8.2f, 12, 3.2f, p); c.drawLine(15.2f, 10.5f, 19.8f, 9, p);
                c.drawLine(14, 14.2f, 16.8f, 18.1f, p); c.drawLine(10, 14.2f, 7.2f, 18.1f, p);
                c.drawLine(8.8f, 10.5f, 4.2f, 9, p);
            } else if (type == 3) {
                c.drawLine(18, 20, 18, 10, p); c.drawLine(12, 20, 12, 4, p); c.drawLine(6, 20, 6, 14, p);
            } else if (type == 4) {
                a.moveTo(19, 21); a.lineTo(12, 16); a.lineTo(5, 21); a.lineTo(5, 5); a.quadTo(5, 3, 7, 3);
                a.lineTo(17, 3); a.quadTo(19, 3, 19, 5); a.close();
                if (on) p.setStyle(Paint.Style.FILL_AND_STROKE);
                c.drawPath(a, p);
            } else if (type == 6) {
                a.moveTo(3, 10.5f); a.lineTo(12, 3); a.lineTo(21, 10.5f); a.lineTo(21, 20); a.quadTo(21, 21, 20, 21);
                a.lineTo(15, 21); a.lineTo(15, 15); a.lineTo(9, 15); a.lineTo(9, 21); a.lineTo(4, 21); a.quadTo(3, 21, 3, 20); a.close();
                c.drawPath(a, p);
            } else if (type == 7) {
                c.drawCircle(12, 12, 9, p);
                a.moveTo(12, 8.2f); a.lineTo(15.2f, 10.5f); a.lineTo(14, 14.2f); a.lineTo(10, 14.2f); a.lineTo(8.8f, 10.5f); a.close();
                c.drawPath(a, p);
                c.drawLine(12, 8.2f, 12, 3.2f, p); c.drawLine(15.2f, 10.5f, 19.8f, 9, p);
                c.drawLine(14, 14.2f, 16.8f, 18.1f, p); c.drawLine(10, 14.2f, 7.2f, 18.1f, p);
                c.drawLine(8.8f, 10.5f, 4.2f, 9, p);
            } else if (type == 8) {
                c.drawRoundRect(new RectF(3, 5, 21, 19), 4, 4, p);
                a.moveTo(10.2f, 9.4f); a.lineTo(10.2f, 14.6f); a.lineTo(14.6f, 12); a.close();
                c.drawPath(a, p);
            } else if (type == 9) {
                c.drawRoundRect(new RectF(3, 5, 21, 19), 2.5f, 2.5f, p);
                a.moveTo(3.8f, 7.2f); a.lineTo(12, 13.5f); a.lineTo(20.2f, 7.2f);
                c.drawPath(a, p);
            } else if (type == 10) {
                c.drawCircle(12, 8, 3.6f, p);
                a.moveTo(4.5f, 20); a.cubicTo(5.1f, 16, 8.1f, 14, 12, 14); a.cubicTo(15.9f, 14, 18.9f, 16, 19.5f, 20); a.close();
                c.drawPath(a, p);
            } else if (type == 11) {
                p.setStyle(Paint.Style.FILL);
                a.moveTo(7, 4); a.lineTo(17, 4); a.lineTo(21.5f, 9.2f); a.lineTo(12, 20.5f); a.lineTo(2.5f, 9.2f); a.close();
                c.drawPath(a, p);
            } else if (type == 14) {
                a.moveTo(4, 20); a.lineTo(8, 19); a.lineTo(19, 8); a.lineTo(16, 5); a.lineTo(5, 16); a.close();
                c.drawPath(a, p);
                c.drawLine(14, 7, 17, 10, p);
            } else if (type == 15) {
                c.drawLine(4, 7, 20, 7, p);
                a.moveTo(6, 7); a.lineTo(7, 20); a.lineTo(17, 20); a.lineTo(18, 7);
                c.drawPath(a, p);
                Path hd = new Path();
                hd.moveTo(9, 7); hd.lineTo(9, 4); hd.lineTo(15, 4); hd.lineTo(15, 7);
                c.drawPath(hd, p);
                c.drawLine(10, 11, 10, 16, p); c.drawLine(14, 11, 14, 16, p);
            } else if (type == 16) {
                c.drawLine(5, 21, 5, 4, p);
                a.moveTo(5, 4); a.lineTo(18, 4); a.lineTo(15, 8); a.lineTo(18, 12); a.lineTo(5, 12);
                c.drawPath(a, p);
            } else if (type == 17) {
                a.moveTo(13, 2); a.lineTo(5, 13); a.lineTo(11, 13); a.lineTo(10, 22); a.lineTo(19, 10); a.lineTo(13, 10); a.close();
                c.drawPath(a, p);
            } else if (type == 18 || type == 19) {
                c.drawCircle(9, 8, 3.5f, p);
                a.moveTo(3, 20); a.cubicTo(3.5f, 16, 6, 14, 9, 14); a.cubicTo(12, 14, 14.5f, 16, 15, 20);
                c.drawPath(a, p);
                c.drawLine(16, 10, 22, 10, p);
                if (type == 18) c.drawLine(19, 7, 19, 13, p);
            } else if (type == 20) {
                a.moveTo(4, 9); a.lineTo(8, 9); a.lineTo(13, 5); a.lineTo(13, 19); a.lineTo(8, 15); a.lineTo(4, 15); a.close();
                c.drawPath(a, p);
                c.drawLine(17, 9, 22, 15, p); c.drawLine(22, 9, 17, 15, p);
            } else if (type == 21) {
                c.drawCircle(12, 12, 9, p);
                c.drawLine(5.6f, 5.6f, 18.4f, 18.4f, p);
            } else if (type == 22) {
                c.drawCircle(12, 12, 9, p);
                c.drawLine(9, 9, 15, 15, p); c.drawLine(15, 9, 9, 15, p);
            } else if (type == 23) {
                a.moveTo(5, 8); a.lineTo(19, 8); a.lineTo(18, 20); a.lineTo(6, 20); a.close();
                c.drawPath(a, p);
                Path b2 = new Path(); b2.moveTo(9, 8); b2.lineTo(9, 7); b2.cubicTo(9, 3.5f, 15, 3.5f, 15, 7); b2.lineTo(15, 8);
                c.drawPath(b2, p);
            } else if (type == 24) {
                c.drawRoundRect(new RectF(3, 7, 21, 19), 3, 3, p);
                a.moveTo(3, 10); a.lineTo(3, 8); a.quadTo(3, 6, 5, 6); a.lineTo(16, 6);
                c.drawPath(a, p);
                p.setStyle(Paint.Style.FILL); c.drawCircle(16.5f, 13, 1.4f, p);
            } else if (type == 25) {
                a.moveTo(12, 3); a.lineTo(14.6f, 8.6f); a.lineTo(20.6f, 9.3f); a.lineTo(16.1f, 13.4f);
                a.lineTo(17.3f, 19.4f); a.lineTo(12, 16.4f); a.lineTo(6.7f, 19.4f); a.lineTo(7.9f, 13.4f);
                a.lineTo(3.4f, 9.3f); a.lineTo(9.4f, 8.6f); a.close();
                c.drawPath(a, p);
            } else if (type == 26) {
                c.drawRoundRect(new RectF(5, 3, 19, 21), 3, 3, p);
                p.setStyle(Paint.Style.FILL); c.drawCircle(12, 12, 2.4f, p);
            } else if (type == 12) {
                p.setStyle(Paint.Style.FILL);
                c.drawRoundRect(new RectF(6, 4, 10, 20), 1, 1, p);
                c.drawRoundRect(new RectF(14, 4, 18, 20), 1, 1, p);
            } else if (type == 13) {
                p.setStyle(Paint.Style.FILL);
                a.moveTo(7, 4); a.lineTo(20, 12); a.lineTo(7, 20); a.close();
                c.drawPath(a, p);
            } else {
                a.moveTo(4, 12); a.lineTo(4, 20); a.quadTo(4, 22, 6, 22); a.lineTo(18, 22); a.quadTo(20, 22, 20, 20); a.lineTo(20, 12);
                c.drawPath(a, p);
                Path b = new Path();
                b.moveTo(16, 6); b.lineTo(12, 2); b.lineTo(8, 6);
                c.drawPath(b, p);
                c.drawLine(12, 2, 12, 15, p);
            }
            c.restore();
        }
    }

    protected void setIc(TextView t, int type, int color, boolean on) {
        t.setCompoundDrawablesRelativeWithIntrinsicBounds(new Ic(type, color, on, dp(19)), null, null, null);
        t.setCompoundDrawablePadding(dp(5));
        t.setTextColor(color);
    }

    protected static class Holder {
        TextView avatar, name, time, body, video, heart, cm, rp, vw, sv, sh, more;
        LinearLayout rope, pred, supbar;
        ImageView avImg, img;
    }

    protected static class Wrap extends FrameLayout {
        final Holder h = new Holder();
        Wrap(Context c) { super(c); }
    }

    protected TextView tv(int color, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setTextColor(color);
        t.setTextSize(size);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    protected GradientDrawable oval(int fill, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(fill);
        if (stroke != 0) g.setStroke(dp(2), stroke);
        return g;
    }

    protected void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_SHORT).show(); }

    protected String ago(String iso) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso.substring(0, 19));
            long s = (System.currentTimeMillis() - d.getTime()) / 1000;
            if (s < 60) return "الآن";
            if (s < 3600) return "منذ " + (s / 60) + " د";
            if (s < 86400) return "منذ " + (s / 3600) + " س";
            return "منذ " + (s / 86400) + " يوم";
        } catch (Exception e) {
            return "";
        }
    }

    // ---------------- الشبكة ----------------
    protected String get(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/" + path).openConnection();
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        int code = c.getResponseCode();
        BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String ln;
        while ((ln = r.readLine()) != null) sb.append(ln);
        r.close();
        if (code >= 400) throw new Exception("HTTP " + code + " " + sb);
        return sb.toString();
    }

    protected void send(String method, String path, String body) throws Exception {
        sendUrl(method, url + "/rest/v1/" + path, body, "return=minimal");
    }

    protected void sendUrl(String method, String full, String body) throws Exception {
        sendUrl(method, full, body, "return=minimal");
    }

    // يرسل طلبًا ويعيد نص الرد (لاستدعاء دوال القاعدة rpc)
    protected String rpc(String fn, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/rpc/" + fn).openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", "application/json");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.getOutputStream().write(body.getBytes("UTF-8"));
        int code = c.getResponseCode();
        BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String ln;
        while ((ln = r.readLine()) != null) sb.append(ln);
        r.close();
        if (code >= 400) throw new Exception(sb.toString().length() > 0 ? sb.toString() : ("HTTP " + code));
        return sb.toString();
    }

    protected void sendUrl(String method, String full, String body, String prefer) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(full).openConnection();
        c.setRequestMethod(method);
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Prefer", prefer);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        if (body != null) {
            c.setDoOutput(true);
            c.getOutputStream().write(body.getBytes("UTF-8"));
        }
        int code = c.getResponseCode();
        if (code >= 300) {
            String msg = "";
            try {
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getErrorStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String ln;
                while ((ln = r.readLine()) != null) sb.append(ln);
                msg = sb.toString();
            } catch (Exception ignore) {}
            throw new Exception("HTTP " + code + " " + msg);
        }
    }

    protected void count(String table, String ids, int slot) {
        try {
            JSONArray a = new JSONArray(get(table + "?select=post_id&post_id=in.(" + ids + ")"));
            for (int i = 0; i < a.length(); i++) {
                String k = String.valueOf(a.getJSONObject(i).optLong("post_id"));
                int[] s = stats.get(k);
                if (s != null) s[slot]++;
            }
        } catch (Exception ignore) {}
    }

    // ---------------- الصور ----------------
    protected void loadImage(final String u, final ImageView iv) {
        iv.setTag(u);
        Bitmap hit = cache.get(u);
        if (hit != null) { iv.setImageBitmap(hit); return; }
        iv.setImageDrawable(new ColorDrawable(0xFF1B2766));
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    InputStream in = c.getInputStream();
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                    in.close();
                    byte[] bytes = bo.toByteArray();
                    BitmapFactory.Options o = new BitmapFactory.Options();
                    o.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o);
                    int ss = 1;
                    while (o.outWidth / (ss * 2) >= 1080) ss *= 2;
                    BitmapFactory.Options o2 = new BitmapFactory.Options();
                    o2.inSampleSize = ss;
                    final Bitmap bm = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, o2);
                    if (bm == null) return;
                    cache.put(u, bm);
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (u.equals(iv.getTag())) iv.setImageBitmap(bm);
                        }
                    });
                } catch (Exception ignore) {}
            }
        });
    }

    protected void showImage(String u) {
        Bitmap b = cache.get(u);
        if (b == null) return;
        final Dialog d = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        ImageView iv = new ImageView(this);
        iv.setBackgroundColor(Color.BLACK);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        iv.setImageBitmap(b);
        iv.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { d.dismiss(); }
        });
        d.setContentView(iv);
        d.show();
    }

    protected void playVideo(String u) {
        if (u == null || u.length() < 5) return;
        final Dialog d = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        FrameLayout fl = new FrameLayout(this);
        fl.setBackgroundColor(Color.BLACK);
        final VideoView vv = new VideoView(this);
        fl.addView(vv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
        vv.setMediaController(new MediaController(this));
        vv.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener() {
            @Override public void onPrepared(android.media.MediaPlayer mp) { mp.setLooping(true); vv.start(); }
        });
        vv.setVideoURI(android.net.Uri.parse(u));
        TextView x = tv(Color.WHITE, 26, false);
        x.setText("✕");
        x.setPadding(dp(18), dp(36), dp(18), dp(18));
        x.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { d.dismiss(); }
        });
        fl.addView(x, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END));
        d.setContentView(fl);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { vv.stopPlayback(); }
        });
        d.show();
    }


    protected Dialog sheetDialog(boolean full) {
        Dialog d = new Dialog(this, android.R.style.Theme_Material_NoActionBar);
        d.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, full ? ViewGroup.LayoutParams.MATCH_PARENT : ViewGroup.LayoutParams.WRAP_CONTENT);
        d.getWindow().setGravity(full ? Gravity.TOP : Gravity.BOTTOM);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(full ? NAVY : 0xCC000000));
        d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        return d;
    }

    protected TextView pill(String text, int fg, int bgc, int stroke) {
        TextView b = tv(fg, 15, true);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setColor(bgc);
        g.setCornerRadius(dp(14));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        b.setBackground(g);
        b.setPadding(dp(12), dp(12), dp(12), dp(12));
        return b;
    }

}
