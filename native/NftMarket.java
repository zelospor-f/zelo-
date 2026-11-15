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
import android.graphics.LinearGradient;
import android.graphics.Shader;
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

abstract class NftMarket extends Messages {
    // ===== من nft-market.js: سوق بطاقات NFT =====
    protected static class Nft {
        String id, cat, ar, en, rarity, flag, c1, c2, until; int max, no; double price; boolean evolves;
        Nft(String id, String cat, String ar, String en, String rarity, int max, double price, String flag, int no, String c1, String c2, boolean evolves, String until) {
            this.id = id; this.cat = cat; this.ar = ar; this.en = en; this.rarity = rarity; this.max = max; this.price = price;
            this.flag = flag; this.no = no; this.c1 = c1; this.c2 = c2; this.evolves = evolves; this.until = until;
        }
    }
    protected static final String[][] NFT_CATS = {
        { "all", "الكل", "All" }, { "mythic", "خرافية ✨", "Mythic ✨" }, { "evolve", "متطورة 🧬", "Evolving 🧬" },
        { "limited", "محدودة ⏳", "Limited ⏳" }, { "arab", "عربي", "Arab" }, { "europe", "أوروبي", "European" },
        { "german", "ألماني", "German" }, { "world", "عالمي", "World" } };
    protected static final Nft[] NFTS = {
        new Nft("nft_ar_falcon", "arab", "الصقر الأخضر", "Green Falcon", "LEGENDARY", 25, 1.5, "🇸🇦", 10, "#0a7a3d", "#04210f", false, null),
        new Nft("nft_ar_pharaoh", "arab", "الفرعون", "The Pharaoh", "LEGENDARY", 25, 1.4, "🇪🇬", 11, "#b3121f", "#1a0407", false, null),
        new Nft("nft_ar_atlas", "arab", "أسد الأطلس", "Atlas Lion", "EPIC", 0, 1.0, "🇲🇦", 7, "#c1272d", "#0b3d1e", false, null),
        new Nft("nft_ar_desert", "arab", "نمر الصحراء", "Desert Tiger", "RARE", 0, 0.7, "🇩🇿", 9, "#0f7a3a", "#e8e8e8", false, null),
        new Nft("nft_ar_carthage", "arab", "نسر قرطاج", "Carthage Eagle", "RARE", 0, 0.7, "🇹🇳", 8, "#d11a2a", "#3a0509", false, null),
        new Nft("nft_ar_gulf", "arab", "عنابي الخليج", "Gulf Maroon", "EPIC", 0, 0.9, "🇶🇦", 19, "#8a1538", "#2b0511", false, null),
        new Nft("nft_eu_matador", "europe", "الماتادور", "The Matador", "LEGENDARY", 25, 1.5, "🇪🇸", 8, "#c60b1e", "#ffc400", false, null),
        new Nft("nft_eu_azzurri", "europe", "الأزرق الإيطالي", "Azzurri Wall", "EPIC", 0, 1.1, "🇮🇹", 1, "#0b4fb3", "#041a3d", false, null),
        new Nft("nft_eu_lion", "europe", "الأسد الإنجليزي", "Three Lions", "EPIC", 0, 1.1, "🏴󠁧󠁢󠁥󠁮󠁧󠁿", 9, "#ffffff", "#c8102e", false, null),
        new Nft("nft_eu_rooster", "europe", "الديك الفرنسي", "French Rooster", "LEGENDARY", 25, 1.3, "🇫🇷", 10, "#0055a4", "#ef4135", false, null),
        new Nft("nft_eu_orange", "europe", "البرتقالي", "Total Orange", "RARE", 0, 0.8, "🇳🇱", 14, "#ff6a00", "#2a1100", false, null),
        new Nft("nft_eu_seleccao", "europe", "ساحر البرتغال", "Seleção Magic", "LEGENDARY", 25, 1.4, "🇵🇹", 7, "#046a38", "#da291c", false, null),
        new Nft("nft_de_panzer", "german", "البانزر", "The Panzer", "EPIC", 0, 1.0, "🇩🇪", 13, "#111111", "#dd0000", false, null),
        new Nft("nft_de_kaiser", "german", "القيصر", "The Kaiser", "LEGENDARY", 25, 1.5, "🇩🇪", 5, "#ffce00", "#111111", false, null),
        new Nft("nft_de_keeper", "german", "الحارس الحديدي", "Iron Keeper", "RARE", 0, 0.8, "🇩🇪", 1, "#dd0000", "#1b1b1b", false, null),
        new Nft("nft_wd_goat", "world", "الأسطورة الزرقاء", "Sky Legend", "LEGENDARY", 25, 1.6, "🇦🇷", 10, "#75aadb", "#ffffff", false, null),
        new Nft("nft_wd_samba", "world", "ساحر السامبا", "Samba Wizard", "LEGENDARY", 25, 1.4, "🇧🇷", 10, "#ffdf00", "#009c3b", false, null),
        new Nft("nft_wd_samurai", "world", "الساموراي", "Blue Samurai", "RARE", 0, 0.7, "🇯🇵", 11, "#1c3f94", "#050b1f", false, null),
        new Nft("nft_my_phoenix", "world", "العنقاء الذهبية", "Golden Phoenix", "MYTHIC", 5, 3.0, "🔥", 1, "#ff9a00", "#3a0a00", false, null),
        new Nft("nft_my_nebula", "world", "سديم النجوم", "Star Nebula", "MYTHIC", 5, 3.5, "🌌", 99, "#7b2ff7", "#050014", false, null),
        new Nft("nft_my_aurora", "world", "الشفق الزمردي", "Emerald Aurora", "MYTHIC", 7, 2.8, "💎", 7, "#00ffa3", "#021a14", false, null),
        new Nft("nft_ev_riser", "world", "الصاعد", "The Riser", "EPIC", 0, 0.6, "⚡", 1, "#4a6cff", "#04101f", true, null),
        new Nft("nft_ev_captain", "arab", "القائد", "The Captain", "EPIC", 0, 0.8, "🛡️", 10, "#f5c35a", "#03170f", true, null),
        new Nft("nft_ss_winter", "world", "كأس الشتاء", "Winter Cup", "LEGENDARY", 20, 1.8, "🏆", 26, "#00c6ff", "#0a1b3d", false, "2026-12-31T23:59:59Z")
    };
    protected static final String[][] TIERS = {
        { "bronze", "0", "برونزي", "Bronze", "#cd7f32" }, { "silver", "100", "فضي", "Silver", "#c0c0c0" },
        { "gold", "500", "ذهبي", "Gold", "#f5c35a" }, { "diamond", "2000", "ألماسي", "Diamond", "#7df9ff" } };

    protected Map<String, Integer> nftSupply = new HashMap<String, Integer>();
    protected Map<String, Integer> nftPrice = new HashMap<String, Integer>();
    protected Map<String, Integer> nftSerial = new HashMap<String, Integer>();
    protected Set<String> nftOwned = new HashSet<String>();
    protected String nftCat = "all", nftPhoto = "";
    protected long nftScore = 0;
    protected boolean nftBuying = false;
    protected final Map<String, TextView> nftTimers = new HashMap<String, TextView>();
    protected Dialog nftDlg;
    protected LinearLayout nftGrid, nftChips;
    protected ScrollView nftScroll;

    protected int colorOf(String hex) { return Color.parseColor(hex); }
    protected int tierIdx() {
        int t = 0;
        for (int i = 0; i < TIERS.length; i++) if (nftScore >= Long.parseLong(TIERS[i][1])) t = i;
        return t;
    }
    protected int nftPoints(Nft n) { Integer p = nftPrice.get(n.id); return p != null ? p : (int) Math.round(n.price * 100); }
    protected long nftLeftMs(Nft n) { return n.until == null ? Long.MAX_VALUE : isoMs(n.until) - System.currentTimeMillis(); }
    protected boolean nftExpired(Nft n) { return n.until != null && nftLeftMs(n) <= 0; }
    protected int nftRemaining(Nft n) { Integer s = nftSupply.get(n.id); return Math.max(0, n.max - (s == null ? 0 : s)); }
    protected String fmtLeft(long ms) {
        long s = Math.max(0, ms / 1000), d = s / 86400, h = s % 86400 / 3600, m = s % 3600 / 60, sec = s % 60;
        if (d > 0) return isAr() ? d + "ي " + h + "س " + m + "د" : d + "d " + h + "h " + m + "m";
        return isAr() ? h + "س " + m + "د " + sec + L("ث", "s") : h + "h " + m + "m " + sec + "s";
    }
    protected String nftErr(String code) {
        String c = code == null ? "" : code;
        String[][] M = {
            { "already_owned", L("تملك هذه البطاقة بالفعل", "You already own this card"), "You already own this card" }, { "sold_out", "نفدت الكمية", "Sold out" },
            { "ended", "انتهى العرض", "Offer ended" }, { "unauthorized", "سجّل الدخول أولاً", "Please sign in first" },
            { "unknown_nft", L("البطاقة غير متاحة", "Card unavailable"), "Card not available" }, { "insufficient_points", L("رصيدك من الكورة غير كافٍ", "Your ball balance is not enough"), "Not enough Kora" },
            { "user_not_found", L("تعذّر العثور على حسابك", "Could not find your account"), "Account not found" } };
        for (String[] m : M) if (c.indexOf(m[0]) >= 0) return L(m[1], m[2]);
        return L("تعذّر تنفيذ الطلب", "Could not complete the request") + (c.length() > 0 ? " [" + c + "]" : "");
    }

    // ---------- رسم البطاقة (بدل SVG) ----------
    protected class NftView extends View {
        final Nft n; final boolean own; final int tier;
        final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        NftView(Nft n, boolean own, int tier) { super(NftMarket.this); this.n = n; this.own = own; this.tier = tier; }
        @Override protected void onMeasure(int w, int h) { int s = MeasureSpec.getSize(w); setMeasuredDimension(s, s); }
        @Override protected void onDraw(Canvas c) {
            float s = getWidth() / 256f;
            c.save(); c.scale(s, s);
            boolean dark = n.c1.equals("#ffffff") || n.c1.equals("#ffce00") || n.c1.equals("#ffdf00") || n.c1.equals("#75aadb");
            int fg = dark ? 0xFF0A0A0A : 0xFFFFFFFF;
            RectF r = new RectF(0, 0, 256, 256);
            p.setStyle(Paint.Style.FILL);
            p.setShader(new LinearGradient(0, 0, 256, 256, colorOf(n.c1), colorOf(n.c2), Shader.TileMode.CLAMP));
            c.drawRoundRect(r, 28, 28, p);
            p.setShader(null);
            p.setColor(0x2E000000);
            c.drawCircle(128, 116, 78, p);
            p.setTextAlign(Paint.Align.CENTER);
            p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            p.setColor(fg); p.setAlpha(235); p.setTextSize(110);
            c.drawText(String.valueOf(n.no), 128, 150 + 0, p);
            p.setAlpha(255); p.setTextSize(38); p.setTextAlign(Paint.Align.LEFT);
            c.drawText(n.flag, 22, 56, p);
            p.setTextAlign(Paint.Align.CENTER); p.setColor(fg); p.setAlpha(215); p.setTextSize(22);
            c.drawText("ZELO  SPORT", 128, 228, p);
            p.setAlpha(255);
            p.setStyle(Paint.Style.STROKE);
            if ("MYTHIC".equals(n.rarity)) {
                float ph = (System.currentTimeMillis() % 4000) / 4000f;
                int[] cs = { 0xFFFF2E97, 0xFFF5C35A, 0xFF4A6CFF };
                p.setStrokeWidth(4);
                p.setColor(cs[(int) (ph * 3) % 3]);
                c.drawRoundRect(new RectF(3, 3, 253, 253), 26, 26, p);
                p.setStrokeWidth(3); p.setColor(0xFFFFFFFF);
                p.setAlpha((int) (40 + 140 * Math.abs(Math.sin(ph * Math.PI * 2))));
                c.drawCircle(128, 116, 80 + 12 * (float) Math.abs(Math.sin(ph * Math.PI * 2)), p);
                p.setAlpha(255); p.setStyle(Paint.Style.FILL);
                for (int i = 0; i < 6; i++) {
                    float t = ((ph * 4000 / 1000f + i * 0.6f) % (3f + i * 0.5f)) / (3f + i * 0.5f);
                    p.setAlpha((int) (255 * Math.sin(Math.PI * t)));
                    c.drawCircle(40 + i * 35, 250 - 230 * t, 2 + i % 3, p);
                }
                p.setAlpha(255);
                p.setTextAlign(Paint.Align.RIGHT); p.setTextSize(15); p.setColor(fg);
                c.drawText("MYTHIC", 226, 48, p);
                postInvalidateDelayed(60);
            } else if (n.evolves) {
                String[] t = TIERS[own ? tier : 0];
                p.setStrokeWidth("bronze".equals(t[0]) ? 5 : 8);
                p.setColor(colorOf(t[4]));
                c.drawRoundRect(new RectF(4, 4, 252, 252), 26, 26, p);
                p.setStyle(Paint.Style.FILL);
                p.setTextAlign(Paint.Align.RIGHT); p.setTextSize(15);
                c.drawText(t[3].toUpperCase(), 226, 48, p);
            }
            c.restore();
        }
    }

    // SVG مطابق للويب (يُحفظ كصورة شخصية ليظهر في الويب بنفس الشكل)
    protected String nftSvg(Nft n, boolean own) {
        boolean dark = n.c1.equals("#ffffff") || n.c1.equals("#ffce00") || n.c1.equals("#ffdf00") || n.c1.equals("#75aadb");
        String fg = dark ? "#0a0a0a" : "#ffffff";
        String extras = "";
        if ("MYTHIC".equals(n.rarity)) {
            StringBuilder sp = new StringBuilder();
            int[] xs = { 40, 85, 130, 175, 215, 110 };
            for (int i = 0; i < xs.length; i++) {
                double dur = 3 + i * 0.5;
                sp.append("<circle cx=\"" + xs[i] + "\" cy=\"240\" r=\"" + (2 + i % 3) + "\" fill=\"#fff\"><animate attributeName=\"cy\" from=\"250\" to=\"20\" dur=\"" + dur + "s\" begin=\"" + (i * 0.6) + "s\" repeatCount=\"indefinite\"/><animate attributeName=\"opacity\" values=\"0;1;0\" dur=\"" + dur + "s\" begin=\"" + (i * 0.6) + "s\" repeatCount=\"indefinite\"/></circle>");
            }
            extras = "<defs><linearGradient id=\"sh\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\"0.5\" stop-color=\"#fff\" stop-opacity=\"0.5\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><clipPath id=\"cp\"><rect width=\"256\" height=\"256\" rx=\"28\"/></clipPath></defs>"
                + "<g clip-path=\"url(#cp)\"><g transform=\"skewX(-20)\"><rect x=\"-200\" y=\"-20\" width=\"70\" height=\"300\" fill=\"url(#sh)\"><animate attributeName=\"x\" from=\"-200\" to=\"360\" dur=\"3.2s\" repeatCount=\"indefinite\"/></rect></g></g>"
                + "<circle cx=\"128\" cy=\"116\" r=\"86\" fill=\"none\" stroke=\"#fff\" stroke-width=\"3\"><animate attributeName=\"r\" values=\"80;92;80\" dur=\"2.4s\" repeatCount=\"indefinite\"/><animate attributeName=\"stroke-opacity\" values=\"0.15;0.7;0.15\" dur=\"2.4s\" repeatCount=\"indefinite\"/></circle>"
                + sp
                + "<rect x=\"3\" y=\"3\" width=\"250\" height=\"250\" rx=\"26\" fill=\"none\" stroke-width=\"4\"><animate attributeName=\"stroke\" values=\"#ff2e97;#f5c35a;#f5c35a;#4a6cff;#ff2e97\" dur=\"4s\" repeatCount=\"indefinite\"/></rect>"
                + "<text x=\"226\" y=\"48\" font-family=\"Arial,sans-serif\" font-size=\"15\" font-weight=\"900\" text-anchor=\"end\" fill=\"" + fg + "\" letter-spacing=\"2\">MYTHIC</text>";
        } else if (n.evolves) {
            String[] t = TIERS[own ? tierIdx() : 0];
            String shine = ("gold".equals(t[0]) || "diamond".equals(t[0])) ? "<animate attributeName=\"stroke-opacity\" values=\"0.6;1;0.6\" dur=\"2s\" repeatCount=\"indefinite\"/>" : "";
            extras = "<rect x=\"4\" y=\"4\" width=\"248\" height=\"248\" rx=\"26\" fill=\"none\" stroke=\"" + t[4] + "\" stroke-width=\"" + ("bronze".equals(t[0]) ? 5 : 8) + "\">" + shine + "</rect>"
                + "<text x=\"226\" y=\"48\" font-family=\"Arial,sans-serif\" font-size=\"15\" font-weight=\"900\" text-anchor=\"end\" fill=\"" + t[4] + "\" letter-spacing=\"2\">" + t[3].toUpperCase() + "</text>";
        }
        String svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\"><defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"" + n.c1 + "\"/><stop offset=\"1\" stop-color=\"" + n.c2 + "\"/></linearGradient></defs>"
            + "<rect width=\"256\" height=\"256\" rx=\"28\" fill=\"url(#g)\"/><circle cx=\"128\" cy=\"116\" r=\"78\" fill=\"rgba(0,0,0,0.18)\"/>"
            + "<text x=\"128\" y=\"150\" font-family=\"Arial Black,Arial,sans-serif\" font-size=\"110\" font-weight=\"900\" text-anchor=\"middle\" fill=\"" + fg + "\" fill-opacity=\"0.92\">" + n.no + "</text>"
            + "<text x=\"30\" y=\"52\" font-size=\"38\">" + n.flag + "</text>"
            + "<text x=\"128\" y=\"228\" font-family=\"Arial,sans-serif\" font-size=\"22\" font-weight=\"900\" text-anchor=\"middle\" fill=\"" + fg + "\" fill-opacity=\"0.85\" letter-spacing=\"3\">ZELO SPORT</text>"
            + extras + "</svg>";
        try { return "data:image/svg+xml;charset=utf-8," + java.net.URLEncoder.encode(svg, "UTF-8").replace("+", "%20"); } catch (Exception e) { return ""; }
    }

    // ---------- تحميل البيانات ----------
    protected void nftLoad(final Runnable done) {
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray s = new JSONArray(get("nft_supply?select=nft_id,sold"));
                    Map<String, Integer> sm = new HashMap<String, Integer>();
                    for (int i = 0; i < s.length(); i++) sm.put(s.getJSONObject(i).optString("nft_id"), s.getJSONObject(i).optInt("sold"));
                    nftSupply = sm;
                } catch (Exception ignore) {}
                try {
                    JSONArray c = new JSONArray(get("nft_points_prices?select=nft_id,price_points"));
                    Map<String, Integer> pm = new HashMap<String, Integer>();
                    for (int i = 0; i < c.length(); i++) pm.put(c.getJSONObject(i).optString("nft_id"), (int) c.getJSONObject(i).optLong("price_points"));
                    nftPrice = pm;
                } catch (Exception ignore) {}
                try {
                    JSONArray o = new JSONArray(get("user_nfts?select=nft_id,serial"));
                    Set<String> os = new HashSet<String>();
                    Map<String, Integer> sr = new HashMap<String, Integer>();
                    for (int i = 0; i < o.length(); i++) { os.add(o.getJSONObject(i).optString("nft_id")); sr.put(o.getJSONObject(i).optString("nft_id"), o.getJSONObject(i).optInt("serial")); }
                    nftOwned = os; nftSerial = sr;
                } catch (Exception ignore) {}
                try {
                    JSONArray u = new JSONArray(get("users?select=photo_url,points&user_id=eq." + uid));
                    if (u.length() > 0) nftPhoto = u.getJSONObject(0).isNull("photo_url") ? "" : u.getJSONObject(0).optString("photo_url");
                    if (u.length() > 0) nftScore = u.getJSONObject(0).optLong("points");
                } catch (Exception ignore) {}
                runOnUiThread(done);
            }
        });
    }

    // ---------- الواجهة ----------
    protected void openNftMarket() {
        if (nftDlg != null) { try { nftDlg.dismiss(); } catch (Exception ignore) {} }
        final Dialog d = sheetDialog(true);
        nftDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xFF0A1033));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12), statusH() + dp(6), dp(12), 0);
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        TextView ti = txt("👑 " + L("سوق بطاقات NFT", "NFT Market"), GOLD, 16, true);
        ti.setGravity(Gravity.CENTER);
        top.addView(ti, lpw(1f));
        top.addView(new View(this), new LinearLayout.LayoutParams(dp(64), 1));
        root.addView(top, lpm(0, 0, 0, 12));
        LinearLayout banner = new LinearLayout(this);
        banner.setOrientation(LinearLayout.VERTICAL);
        banner.setGravity(Gravity.CENTER);
        banner.setPadding(dp(14), dp(12), dp(14), dp(12));
        banner.setBackground(rbg(0x1F2C4BB5, 0x4D2C4BB5, 16));
        banner.addView(txt(L("اقتنِ بطاقتك واجعلها صورة ملفك الشخصي", "Collect a card and use it as your avatar"), Color.WHITE, 14, true));
        banner.addView(txt(L("اشترِ البطاقات بنقاطك", "Buy cards with your points"), 0xFF94A3B8, 12, false));
        root.addView(banner, lpm(0, 0, 0, 10));
        nftChips = new LinearLayout(this);
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        hs.addView(nftChips);
        root.addView(hs, lpm(0, 0, 0, 8));
        nftGrid = new LinearLayout(this);
        nftGrid.setOrientation(LinearLayout.VERTICAL);
        nftGrid.setPadding(0, 0, 0, navH() + dp(30));
        nftScroll = new ScrollView(this);
        nftScroll.addView(nftGrid);
        root.addView(nftScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { nftDlg = null; timerH.removeCallbacks(nftTick); }
        });
        d.show();
        renderNft();
        nftLoad(new Runnable() { @Override public void run() { if (nftDlg != null) renderNft(); } });
        timerH.removeCallbacks(nftTick);
        timerH.postDelayed(nftTick, 1000);
    }

    protected final Runnable nftTick = new Runnable() {
        @Override public void run() {
            if (nftDlg == null || nftGrid == null) return;
            boolean ended = false;
            for (int i = 0; i < nftGrid.getChildCount(); i++) {
                View row = nftGrid.getChildAt(i);
                if (!(row instanceof LinearLayout)) continue;
                LinearLayout rl = (LinearLayout) row;
                for (int j = 0; j < rl.getChildCount(); j++) {
                    View card = rl.getChildAt(j);
                    Object tg = card.getTag();
                    if (tg instanceof Nft) {
                        Nft n = (Nft) tg;
                        TextView tm = nftTimers.get(n.id);
                        long left = nftLeftMs(n);
                        if (left <= 0) ended = true;
                        else if (tm != null) tm.setText("⏳ " + fmtLeft(left));
                    }
                }
            }
            if (ended) renderNft();
            timerH.postDelayed(this, 1000);
        }
    };

    protected void renderNft() {
        if (nftGrid == null) return;
        nftChips.removeAllViews();
        for (final String[] c : NFT_CATS) {
            boolean on = c[0].equals(nftCat);
            TextView ch = txt(isAr() ? c[1] : c[2], on ? 0xFF04110B : 0xFFCBD5E1, 13, true);
            ch.setPadding(dp(16), dp(7), dp(16), dp(7));
            if (on) {
                GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF4A6CFF, GOLD });
                g.setCornerRadius(dp(20));
                ch.setBackground(g);
            } else ch.setBackground(rbg(0x0FFFFFFF, 0x1FFFFFFF, 20));
            ch.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { nftCat = c[0]; renderNft(); } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.setMargins(0, 0, dp(8), 0);
            nftChips.addView(ch, lp);
        }
        final int scrollY = nftScroll.getScrollY();
        nftGrid.removeAllViews();
        nftTimers.clear();
        List<Nft> list = new ArrayList<Nft>();
        for (Nft n : NFTS) {
            boolean ok = nftCat.equals("all") || (nftCat.equals("mythic") && n.rarity.equals("MYTHIC")) || (nftCat.equals("evolve") && n.evolves)
                || (nftCat.equals("limited") && (n.max > 0 || n.until != null)) || nftCat.equals(n.cat);
            if (ok) list.add(n);
        }
        for (int i = 0; i < list.size(); i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setWeightSum(2);
            for (int j = 0; j < 2; j++) {
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                lp.setMargins(dp(j == 0 ? 0 : 6), 0, dp(j == 0 ? 6 : 0), dp(12));
                if (i + j < list.size()) row.addView(nftCard(list.get(i + j)), lp);
                else row.addView(new View(this), lp);
            }
            nftGrid.addView(row);
        }
        nftScroll.post(new Runnable() { @Override public void run() { nftScroll.scrollTo(0, scrollY); } });
    }

    protected View nftCard(final Nft n) {
        final boolean owned = nftOwned.contains(n.id);
        final boolean mythic = n.rarity.equals("MYTHIC");
        final String svg = nftSvg(n, owned);
        final boolean inUse = owned && nftPhoto.equals(svg);
        final boolean expired = nftExpired(n);
        final int rem = n.max > 0 ? nftRemaining(n) : -1;
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(10), dp(10), dp(10), dp(10));
        GradientDrawable bg = rbg(0xCC0A1033, mythic ? 0xFFFF2E97 : 0x402C4BB5, 18);
        card.setBackground(bg);
        card.setTag(n);
        FrameLayout fr = new FrameLayout(this);
        fr.addView(new NftView(n, owned, tierIdx()), new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView rb = txt(n.rarity, 0xFF000000, 9, true);
        rb.setPadding(dp(6), dp(2), dp(6), dp(2));
        int rc = mythic ? 0xFFFF2E97 : n.rarity.equals("LEGENDARY") ? GOLD : n.rarity.equals("EPIC") ? 0xFFA855F7 : 0xFF4A6CFF;
        rb.setBackground(rbg(rc, 0, 6));
        FrameLayout.LayoutParams rl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | (isRtlLang() ? Gravity.LEFT : Gravity.RIGHT));
        rl.setMargins(dp(4), dp(4), dp(4), 0);
        fr.addView(rb, rl);
        card.addView(fr);
        TextView nm = txt(isAr() ? n.ar : n.en, Color.WHITE, 13, true);
        nm.setGravity(Gravity.CENTER);
        card.addView(nm, lpm(0, 8, 0, 0));
        Integer sn = nftSerial.get(n.id);
        if (owned && sn != null && sn > 0) { TextView s = txt("#" + sn + (n.max > 0 ? " / " + n.max : ""), GOLD, 11, true); s.setGravity(Gravity.CENTER); card.addView(s); }
        TextView pr = txt("🪙 " + String.format(java.util.Locale.US, "%,d", nftPoints(n)), GOLD, 13, true);
        pr.setGravity(Gravity.CENTER);
        card.addView(pr, lpm(0, 3, 0, 0));
        if (n.max > 0) {
            int sold = nftSupply.get(n.id) == null ? 0 : nftSupply.get(n.id);
            TextView sp = txt(L("المتبقي ", "Left ") + rem + " / " + n.max, 0xFF94A3B8, 11, true);
            sp.setGravity(Gravity.CENTER);
            card.addView(sp, lpm(0, 6, 0, 0));
            card.addView(bar(Math.min(100, Math.round(sold * 100f / n.max)), GOLD));
        }
        if (n.until != null && !expired) {
            TextView tm = txt("⏳ " + fmtLeft(nftLeftMs(n)), 0xFFFF6B6B, 11, true);
            tm.setGravity(Gravity.CENTER);
            card.addView(tm, lpm(0, 6, 0, 0));
            nftTimers.put(n.id, tm);
        }
        if (n.evolves) {
            if (owned) {
                int ti = tierIdx();
                TextView t = txt("🧬 " + (isAr() ? TIERS[ti][2] : TIERS[ti][3]), colorOf(TIERS[ti][4]), 11, true);
                t.setGravity(Gravity.CENTER);
                card.addView(t, lpm(0, 6, 0, 0));
                int pct = 100;
                if (ti + 1 < TIERS.length) { long a = Long.parseLong(TIERS[ti][1]), b = Long.parseLong(TIERS[ti + 1][1]); pct = (int) Math.max(0, Math.min(100, (nftScore - a) * 100 / (b - a))); }
                card.addView(bar(pct, colorOf(TIERS[ti][4])));
            } else {
                TextView t = txt("🧬 " + L("تتطور مع نشاطك", "Evolves with your activity"), 0xFF94A3B8, 11, true);
                t.setGravity(Gravity.CENTER);
                card.addView(t, lpm(0, 6, 0, 0));
            }
        }
        TextView btn;
        if (inUse) btn = nftBtn("✅ " + L("قيد الاستخدام", "In use"), 0);
        else if (owned) { btn = nftBtn("🖼️ " + L("اجعلها صورتي", "Use as avatar"), 2); btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { nftUse(n); } }); }
        else if (expired) btn = nftBtn("⌛ " + L("انتهى العرض", "Ended"), 0);
        else if (n.max > 0 && rem == 0) btn = nftBtn("🚫 " + L("نفدت الكمية", "Sold out"), 0);
        else { btn = nftBtn("🛒 " + L("شراء بالكورة", "Buy with Kora"), 1); btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { nftBuy(n); } }); }
        card.addView(btn, lpm(0, 8, 0, 0));
        return card;
    }
    protected View bar(int pct, int color) {
        FrameLayout f = new FrameLayout(this);
        f.setBackground(rbg(0x1AFFFFFF, 0, 4));
        View i = new View(this);
        i.setBackground(rbg(color, 0, 4));
        final int w = pct;
        f.addView(i, new FrameLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT));
        f.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override public void onLayoutChange(View v, int l, int t, int r, int b, int ol, int ot, int or, int ob) {
                View c = ((FrameLayout) v).getChildAt(0);
                int nw = (r - l) * w / 100;
                if (c.getLayoutParams().width != nw) { c.getLayoutParams().width = nw; c.requestLayout(); }
            }
        });
        f.setLayoutParams(lpm(0, 4, 0, 0));
        f.setMinimumHeight(dp(5));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(5));
        lp.setMargins(0, dp(4), 0, 0);
        f.setLayoutParams(lp);
        return f;
    }
    protected TextView nftBtn(String s, int kind) {   // 0 رمادي، 1 ذهبي/أخضر، 2 أزرق/ذهبي
        TextView b = txt(s, kind == 0 ? 0xFFCBD5E1 : 0xFF000000, 12, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(4), dp(9), dp(4), dp(9));
        if (kind == 0) b.setBackground(rbg(0x14FFFFFF, 0, 10));
        else {
            GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, kind == 1 ? new int[] { GOLD, 0xFF00BC70 } : new int[] { 0xFF4A6CFF, GOLD });
            g.setCornerRadius(dp(10));
            b.setBackground(g);
        }
        return b;
    }

    // ---------- اجعلها صورتي ----------
    protected void onAvatarChanged(String photo) {}
    protected void nftUse(final Nft n) {
        if (!nftOwned.contains(n.id)) return;
        final String svg = nftSvg(n, true);
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try { upsertUser(new JSONObject().put("user_id", uid).put("photo_url", svg)); } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fe != null) { toast(fe); return; }
                        nftPhoto = svg;
                        onAvatarChanged(svg);
                        if (nftDlg != null) nftDlg.dismiss();
                    }
                });
            }
        });
    }

    // ---------- الشراء بالنقاط (عملية ذرية داخل Supabase) ----------
    protected void nftBuy(final Nft n) {
        if (nftBuying || nftOwned.contains(n.id)) return;
        final String name = isAr() ? n.ar : n.en;
        final String pts = String.format(java.util.Locale.US, "%,d", nftPoints(n));
        new AlertDialog.Builder(this)
            .setMessage(isAr() ? L("شراء «", "Buy \"") + name + L("» مقابل ", "\" for ") + pts + L(" كورة؟", " balls?") : "Buy \"" + name + "\" for " + pts + " points?")
            .setPositiveButton(L("شراء", "Buy"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface di, int w) {
                    nftBuying = true;
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            String msg = null;
                            try {
                                JSONObject r = new JSONObject(rpc("buy_nft_with_points", new JSONObject().put("p_nft_id", n.id).toString()));
                                if (!r.optBoolean("ok")) msg = nftErr(r.optString("error"));
                                else { final long bal = r.optLong("balance"); runOnUiThread(new Runnable() { @Override public void run() { if (balance != null) balance.setText(String.format(java.util.Locale.US, "%,d", bal)); } }); }
                            } catch (Exception e) { msg = nftErr(String.valueOf(e.getMessage())); }
                            final String fm = msg;
                            nftLoad(new Runnable() {
                                @Override public void run() {
                                    nftBuying = false;
                                    toast(fm != null ? fm : L("✅ تم الشراء بنجاح!", "✅ Purchase complete!"));
                                    if (nftDlg != null) renderNft();
                                }
                            });
                        }
                    });
                }
            }).setNegativeButton(L("إلغاء", "Cancel"), null).show();
    }
}
