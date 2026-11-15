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


abstract class Badges extends AdminReports {
    // ===== من badges.js: شارات وسلاسل التوقعات الصحيحة =====
    protected static final String[][] BADGES = {
        { "first", "1", "أول توقع صحيح", "🎯" },
        { "analyst", "3", "محلل", "📊" },
        { "expert", "5", "خبير", "🧠" },
        { "king", "10", "ملك التوقعات", "👑" }
    };

    // يحسب السلسلة من التوقعات المنتهية فقط (correct / wrong) بترتيب تاريخ المباراة
    // التوقعات المعلقة لا تكسر السلسلة ولا تُحتسب. النتيجة: {الحالية، الأفضل، الصحيحة، المجموع}
    protected int[] computeStreaks(JSONArray preds) {
        final List<String[]> fin = new ArrayList<String[]>(); // {date, status}
        for (int i = 0; i < preds.length(); i++) {
            JSONObject p = preds.optJSONObject(i);
            if (p == null) continue;
            String st = p.optString("prediction_status", "");
            if (!"correct".equals(st) && !"wrong".equals(st)) continue;
            JSONObject m = p.optJSONObject("matches");
            fin.add(new String[] { m == null ? "" : m.optString("match_date", ""), st });
        }
        java.util.Collections.sort(fin, new java.util.Comparator<String[]>() {
            @Override public int compare(String[] a, String[] b) { return a[0].compareTo(b[0]); }
        });
        int best = 0, run = 0, correct = 0;
        for (String[] f : fin) {
            if ("correct".equals(f[1])) { run++; correct++; if (run > best) best = run; }
            else run = 0;
        }
        int cur = 0;
        for (int i = fin.size() - 1; i >= 0; i--) {
            if ("correct".equals(fin.get(i)[1])) cur++; else break;
        }
        return new int[] { cur, best, correct, fin.size() };
    }

    // يملأ الحاوية ببطاقة الشارات للمستخدم (يجلب البيانات في الخلفية)
    protected void renderBadges(final String userId, final LinearLayout into) {
        final String target = (userId == null || userId.length() == 0) ? uid : userId;
        if (target == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray preds = new JSONArray();
                try { preds = new JSONArray(get("match_predictions?select=prediction_status,matches(match_date)&user_id=eq." + target)); } catch (Exception ignore) {}
                final int[] s = computeStreaks(preds);
                runOnUiThread(new Runnable() {
                    @Override public void run() { into.removeAllViews(); into.addView(badgesCard(s)); }
                });
            }
        });
    }

    protected View badgesCard(int[] s) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable g = new GradientDrawable();
        g.setColor(0xCC16161E);
        g.setCornerRadius(dp(16));
        g.setStroke(dp(1), 0x14FFFFFF);
        c.setBackground(g);
        LinearLayout top = new LinearLayout(this);
        top.addView(streakCell(L("🔥 السلسلة الحالية", "🔥 Current streak"), String.valueOf(s[0])), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        top.addView(streakCell(L("🏅 أفضل سلسلة", "🏅 Best streak"), String.valueOf(s[1])), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        c.addView(top);
        LinearLayout row = new LinearLayout(this);
        row.setPadding(0, dp(12), 0, 0);
        boolean any = false;
        String[] next = null;
        for (String[] b : BADGES) {
            int min = Integer.parseInt(b[1]);
            if (s[1] >= min) {
                any = true;
                TextView t = tv(Color.WHITE, 13, true);
                t.setText(b[3] + "  " + b[2]);
                GradientDrawable bg = new GradientDrawable();
                bg.setColor(0x66000000);
                bg.setCornerRadius(dp(12));
                bg.setStroke(dp(1), 0x66FCB045);
                t.setBackground(bg);
                t.setPadding(dp(10), dp(6), dp(10), dp(6));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.setMargins(0, 0, dp(8), 0);
                row.addView(t, lp);
            } else if (next == null) next = b;
        }
        if (!any) {
            TextView n = tv(0xFF888888, 13, false);
            n.setText(L("لا توجد شارات بعد", "No badges yet"));
            row.addView(n);
        }
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        hs.addView(row);
        c.addView(hs);
        if (next != null) {
            TextView nx = tv(0xFF888888, 12, false);
            nx.setPadding(0, dp(8), 0, 0);
            nx.setText(L("التالي: ", "Next: ") + next[2] + " (" + next[1] + L(" توقعات صحيحة متتالية)", " correct predictions in a row)"));
            c.addView(nx);
        }
        return c;
    }

    protected View streakCell(String label, String value) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER);
        TextView l = tv(0xFF888888, 12, false);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        c.addView(l);
        TextView v = tv(0xFFFCB045, 21, true);
        v.setText(value);
        v.setGravity(Gravity.CENTER);
        c.addView(v);
        return c;
    }
}
