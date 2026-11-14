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

abstract class I18nHelpers extends Billing {
    // ===== من i18n-helpers.js: نظام الترجمة (ملف لكل لغة في locales/<lang>.json على موقع الويب) =====
    protected static final String WEB_BASE = "https://zelospor-f.github.io/zelo-/";
    // الرمز، العلم، الاسم، RTL
    protected static final String[][] LANGS = {
        { "ar", "🇸🇦", "العربية", "1" }, { "en", "🇬🇧", "English", "0" }, { "tr", "🇹🇷", "Türkçe", "0" },
        { "es", "🇪🇸", "Español", "0" }, { "fr", "🇫🇷", "Français", "0" }, { "pt", "🇧🇷", "Português", "0" },
        { "ru", "🇷🇺", "Русский", "0" }, { "hi", "🇮🇳", "हिन्दी", "0" }, { "id", "🇮🇩", "Bahasa Indonesia", "0" },
        { "fa", "🇮🇷", "فارسی", "1" }
    };
    protected static final Map<String, JSONObject> i18n = new HashMap<String, JSONObject>();
    protected static List<String> readyLangs = new ArrayList<String>();
    static { readyLangs.add("ar"); readyLangs.add("en"); }

    protected interface LangPick { void on(String code); }

    // يحوّل أي رمز لغة (fa, en-US, ar-EG ...) إلى لغة مدعومة أو null
    protected String normalizeLang(String l) {
        if (l == null || l.length() == 0) return null;
        String s = l.toLowerCase(java.util.Locale.US);
        if (s.length() > 2) s = s.substring(0, 2);
        for (String[] x : LANGS) if (x[0].equals(s)) return s;
        return null;
    }

    protected String getCurrentLang() {
        String s = normalizeLang(getSharedPreferences("zelo_lang", MODE_PRIVATE).getString("app_lang", null));
        return s == null ? "ar" : s;
    }

    protected boolean isAr() { return "ar".equals(getCurrentLang()); }
    protected String L(String ar, String en) { return isAr() ? ar : en; }
    protected boolean isRtlLang() { return langMeta(getCurrentLang())[3].equals("1"); }

    protected String[] langMeta(String code) {
        for (String[] x : LANGS) if (x[0].equals(code)) return x;
        return LANGS[0];
    }

    // تحميل ملف لغة (يُستدعى خارج خيط الواجهة)
    protected void loadLanguageFile(String lang) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(WEB_BASE + "locales/" + lang + ".json?v=" + System.currentTimeMillis()).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            if (c.getResponseCode() >= 400) return;
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String ln;
            while ((ln = r.readLine()) != null) sb.append(ln);
            r.close();
            synchronized (i18n) { i18n.put(lang, new JSONObject(sb.toString())); }
        } catch (Exception ignore) {}
    }

    // اللغات الجاهزة: locales/index.json → { "ready": ["ar","en",...] }
    protected void loadReadyLangs() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(WEB_BASE + "locales/index.json?v=" + System.currentTimeMillis()).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            if (c.getResponseCode() >= 400) return;
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String ln;
            while ((ln = r.readLine()) != null) sb.append(ln);
            r.close();
            JSONArray a = new JSONObject(sb.toString()).optJSONArray("ready");
            if (a == null) return;
            List<String> l = new ArrayList<String>();
            for (int i = 0; i < a.length(); i++) l.add(a.getString(i));
            readyLangs = l;
        } catch (Exception ignore) {}
    }

    // يحمّل العربية والإنجليزية واللغة الحالية ثم ينفّذ done في خيط الواجهة (= window.i18nReady)
    protected void loadLanguages(final Runnable done) {
        pool.execute(new Runnable() {
            @Override public void run() {
                String cur = getCurrentLang();
                loadLanguageFile("ar");
                loadLanguageFile("en");
                if (!cur.equals("ar") && !cur.equals("en")) loadLanguageFile(cur);
                loadReadyLangs();
                if (done != null) runOnUiThread(done);
            }
        });
    }

    protected String param(String text, Map<String, String> params) {
        if (params == null) return text;
        for (Map.Entry<String, String> e : params.entrySet()) text = text.replace("{" + e.getKey() + "}", e.getValue());
        return text;
    }

    protected String dictGet(String lang, String key) {
        JSONObject d;
        synchronized (i18n) { d = i18n.get(lang); }
        if (d == null || !d.has(key)) return null;
        return d.optString(key, null);
    }

    // t(key, fallback, params)
    protected String t(String key, String fallback, Map<String, String> params) {
        String lang = getCurrentLang();
        String other = lang.equals("ar") ? "en" : "ar";
        String text = dictGet(lang, key);
        if (text == null && !lang.equals("ar")) text = dictGet("en", key);
        if (text == null) text = dictGet(other, key);
        if (text == null) text = (fallback != null && fallback.length() > 0) ? fallback : key;
        return param(text, params);
    }
    protected String t(String key) { return t(key, null, null); }

    // zT(ar, en): النص المكتوب داخل الأكواد → اللغة الحالية (غير ar/en من قسم __pairs)
    protected String zT(String ar, String en) {
        String lang = getCurrentLang();
        if (lang.equals("ar")) return ar;
        if (lang.equals("en") || en == null) return en;
        JSONObject dict;
        synchronized (i18n) { dict = i18n.get(lang); }
        JSONObject pairs = dict == null ? null : dict.optJSONObject("__pairs");
        if (pairs == null) return en;
        final List<String> nums = new ArrayList<String>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+(?:[.,]\\d+)*").matcher(en);
        StringBuffer kb = new StringBuffer();
        while (m.find()) { nums.add(m.group()); m.appendReplacement(kb, "{n}"); }
        m.appendTail(kb);
        String out = pairs.optString(kb.toString(), null);
        if (out == null) return en;
        StringBuilder sb = new StringBuilder();
        int i = 0, from = 0, p;
        while ((p = out.indexOf("{n}", from)) >= 0) {
            sb.append(out, from, p);
            sb.append(i < nums.size() ? nums.get(i) : "{n}");
            i++;
            from = p + 3;
        }
        sb.append(out.substring(from));
        return sb.toString();
    }

    // zA(a, b): قيمة للعربية فقط وأخرى لغيرها
    protected String zA(String a, String b) { return isAr() ? a : b; }

    // tr(key, ar, en, params)
    protected String tr(String key, String ar, String en, Map<String, String> params) {
        String text = dictGet(getCurrentLang(), key);
        if (text == null) text = zT(ar, en);
        if (text == null) text = key;
        return param(text, params);
    }
    protected String tr(String key, String ar, String en) { return tr(key, ar, en, null); }

    // اسم النادي حسب اللغة (الصف من ClubsData: [2]=عربي، [3]=إنجليزي)
    protected String getClubName(String[] club) {
        if (club == null) return "";
        boolean ar = isAr();
        String a = club.length > 2 ? club[2] : "", e = club.length > 3 ? club[3] : "";
        String r = ar ? (a.length() > 0 ? a : e) : (e.length() > 0 ? e : a);
        return r == null ? "" : r;
    }

    // اسم مهمة: كائن JSON فيه titleKey أو نصوص عربية/إنجليزية
    protected String getTaskName(JSONObject task) {
        if (task == null) return "";
        if (task.optString("titleKey", "").length() > 0) return t(task.optString("titleKey"));
        String[] ar = { "textAr", "text_ar", "titleAr", "title_ar", "textEn", "text_en", "title" };
        String[] en = { "textEn", "text_en", "titleEn", "title_en", "textAr", "text_ar", "titleAr", "title_ar", "title" };
        String[] order = isAr() ? ar : en;
        for (String k : order) { String v = task.optString(k, ""); if (v.length() > 0) return v; }
        return "";
    }

    // zeloSetLang: يحفظ اللغة (الجهاز + قاعدة البيانات) ثم يعيد بناء الشاشة
    protected void zeloSetLang(String code) {
        final String c = normalizeLang(code) == null ? "ar" : normalizeLang(code);
        getSharedPreferences("zelo_lang", MODE_PRIVATE).edit().putString("app_lang", c).apply();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (uid != null && token != null) send("PATCH", "users?user_id=eq." + uid, new JSONObject().put("lang", c).toString());
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { recreate(); } });
            }
        });
    }

    // zeloOpenLangPicker: نافذة من أسفل الشاشة بكل اللغات الجاهزة
    protected void openLangPicker(final LangPick onPick) {
        final String cur = getCurrentLang();
        final Dialog d = sheetDialog(false);
        d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(18), dp(16), navH() + dp(14));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF0F1A5C);
        pbg.setCornerRadii(new float[] { dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0 });
        pbg.setStroke(dp(1), 0x4DF5C35A);
        box.setBackground(pbg);
        TextView title = tv(Color.WHITE, 17, true);
        title.setText("🌐 Language · اللغة");
        title.setPadding(dp(4), 0, dp(4), dp(12));
        box.addView(title);
        for (final String[] l : LANGS) {
            if (!readyLangs.contains(l[0])) continue;
            boolean on = l[0].equals(cur);
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(14), dp(13), dp(14), dp(13));
            GradientDrawable g = new GradientDrawable();
            g.setCornerRadius(dp(14));
            g.setColor(on ? 0x24F5C35A : 0x0DFFFFFF);
            g.setStroke(dp(1), on ? GOLD : 0x1AFFFFFF);
            row.setBackground(g);
            TextView fl = tv(Color.WHITE, 22, false);
            fl.setText(l[1]);
            row.addView(fl);
            TextView nm = tv(Color.WHITE, 16, true);
            nm.setText(l[2]);
            nm.setPadding(dp(12), 0, dp(12), 0);
            row.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            TextView ck = tv(GOLD, 16, true);
            ck.setText(on ? "✓" : "");
            row.addView(ck);
            row.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    d.dismiss();
                    if (l[0].equals(cur)) return;
                    if (onPick != null) onPick.on(l[0]); else zeloSetLang(l[0]);
                }
            });
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rlp.setMargins(0, 0, 0, dp(8));
            box.addView(row, rlp);
        }
        sc.addView(box);
        d.setContentView(sc);
        d.show();
    }
}
