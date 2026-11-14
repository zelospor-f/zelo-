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


// ============================================================
// Store.java — محوَّل من store.js (متجر Zelo Coin)
// الواجهة والباقات كما هي. الشراء عبر Google Play Billing يُربط في آخر مرحلة:
// دالة buyCoinPack(gid) هي نقطة الربط، وحالياً تفتح المتجر القديم لإتمام الشراء.
// الأسعار المحلية تأتي من Google Play (bpPrice) وإلا تظهر بالدولار.
// ============================================================
abstract class Store extends Rooms {
    // { id, tier, coins, price, gid, عربي, English, شارة عربي, شارة English }
    protected static final String[][] ST_PACKS = {
        { "starter", "1", "100", "1", "zelo_coin_100", "باقة المبتدئ", "Starter", "", "" },
        { "pro", "2", "500", "5", "zelo_coin_500", "باقة المحترف", "Pro", "الأكثر طلباً", "Most popular" },
        { "elite", "3", "1000", "10", "zelo_coin_1000", "باقة النجم", "Elite", "اربح 250 إضافية", "Get 250 extra" },
        { "ultimate", "4", "2000", "20", "zelo_coin_2000", "باقة الأسطورة", "Ultimate", "اربح 500 إضافية", "Get 500 extra" },
        { "king", "5", "5000", "50", "zelo_coin_6000", "باقة الملوك", "Kings", "اربح 1000 إضافية", "Get 1000 extra" }
    };
    protected Dialog stDlg;
    protected TextView stBal;

    // نقطة ربط Google Play Billing (تُستبدل في المرحلة الأخيرة)
    protected void buyCoinPack(String gid) {
        bpBuy(gid, false, false);
    }

    protected void openStorePage() {
        if (stDlg != null) return;
        final Dialog d = sheetDialog(true);
        stDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xFF070C2A));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(0, dp(20), 0, 0);
        // الرأس
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(14), dp(10), dp(14), dp(10));
        TextView back = txt(isRtlLang() ? "›" : "‹", GOLD, 22, true);
        back.setGravity(Gravity.CENTER);
        back.setBackground(rbg(0x332C4BB5, 0x59F5C35A, 12));
        back.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        head.addView(back, new LinearLayout.LayoutParams(dp(40), dp(40)));
        TextView title = txt(L("المتجر", "Store"), Color.WHITE, 18, true);
        title.setGravity(Gravity.CENTER);
        head.addView(title, lpw(1f));
        head.addView(new View(this), new LinearLayout.LayoutParams(dp(40), dp(40)));
        root.addView(head);
        // المحتوى
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), dp(4), dp(16), navH() + dp(28));
        // الرصيد
        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setGravity(Gravity.CENTER);
        hero.setPadding(0, dp(18), 0, dp(26));
        ImageView hc = stCoin(88, false);
        hero.addView(hc, new LinearLayout.LayoutParams(dp(88), dp(88)));
        hc.setRotationY(-360f);
        hc.animate().rotationY(0f).setDuration(1000).setStartDelay(150).start();
        TextView hl = txt(L("رصيدك الحالي", "Your balance"), MUTED, 14, true);
        hl.setPadding(0, dp(12), 0, 0);
        hero.addView(hl);
        LinearLayout br = new LinearLayout(this);
        br.setGravity(Gravity.CENTER_VERTICAL | Gravity.CENTER_HORIZONTAL);
        br.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        stBal = txt("0", GOLD, 40, true);
        br.addView(stBal);
        TextView sm = txt("Zelo Coin", MUTED, 14, true);
        sm.setPadding(dp(8), dp(14), 0, 0);
        br.addView(sm);
        hero.addView(br);
        body.addView(hero);
        body.addView(txt(L("اختر باقتك", "Choose a pack"), 0xFFF8FAFC, 16, true), lpm(4, 0, 4, 14));
        // الباقات: شبكة عمودين، والأخيرة بعرض كامل
        LinearLayout rowL = null;
        for (int i = 0; i < ST_PACKS.length; i++) {
            final String[] p = ST_PACKS[i];
            View card = stPack(p);
            if (i == ST_PACKS.length - 1) {
                body.addView(card, lpm(0, 0, 0, 0));
            } else {
                if (i % 2 == 0) { rowL = new LinearLayout(this); rowL.setBaselineAligned(false); body.addView(rowL, lpm(0, 0, 0, 12)); }
                LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
                cl.setMargins(i % 2 == 0 ? 0 : dp(6), 0, i % 2 == 0 ? dp(6) : 0, 0);
                rowL.addView(card, cl);
            }
        }
        TextView n1 = txt(L("تُضاف الكورة إلى رصيدك بعد تأكيد الدفع.", "Kora is added to your balance once payment is confirmed."), 0xFF7F8BBD, 12, false);
        n1.setGravity(Gravity.CENTER);
        body.addView(n1, lpm(8, 22, 8, 0));
        TextView n2 = txt(L("تحذير: أي تلاعب في الكورة أو المكافآت أو الإعلانات (بأي طريقة أو برنامج) يعرّض الحساب للحذف وخسارة كل الرصيد والمشتريات دون تعويض.", "Warning: any manipulation of Kora, rewards or ads (by any method or tool) may lead to account deletion and loss of all balance and purchases, with no refund."), 0xFFFFB4A8, 12, false);
        n2.setGravity(Gravity.CENTER);
        body.addView(n2, lpm(8, 12, 8, 0));
        ScrollView sv = new ScrollView(this);
        sv.addView(body);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (stDlg == d) { stDlg = null; stBal = null; } } });
        d.show();
        stRefreshBalance();
    }

    protected ImageView stCoin(int size, boolean darkRing) {
        ImageView iv = lbCoin(size);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(GOLD);
        g.setStroke(dp(2), darkRing ? NAVY : GOLD);
        iv.setBackground(g);
        iv.setClipToOutline(true);
        iv.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
        });
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        return iv;
    }

    protected View stPack(final String[] p) {
        final int tier = Integer.parseInt(p[1]);
        final boolean gold = tier >= 4;
        int fg = gold ? NAVY : Color.WHITE;
        FrameLayout f = new FrameLayout(this);
        GradientDrawable bg;
        if (gold) {
            bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFF8D27A, 0xFFF5C35A, 0xFFC98A2B });
            bg.setCornerRadius(dp(20));
        } else {
            bg = new GradientDrawable();
            bg.setColor(0xFF101847);
            bg.setCornerRadius(dp(20));
            bg.setStroke(dp(1), tier == 2 ? 0xFF2C4BB5 : tier == 3 ? 0x8CF5C35A : 0x17FFFFFF);
        }
        f.setBackground(bg);
        f.setClipToOutline(true);
        f.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), dp(20)); }
        });
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(12), dp(30), dp(12), dp(14));
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        TextView amt = txt(String.format(java.util.Locale.US, "%,d", Long.parseLong(p[2])), fg, 30, true);
        top.addView(amt);
        int cs = gold ? 44 : 36;
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(dp(cs), dp(cs));
        cl.setMargins(dp(8), 0, 0, 0);
        top.addView(stCoin(cs, gold), cl);
        top.setGravity(isRtlLang() ? (Gravity.CENTER_VERTICAL | Gravity.END) : (Gravity.CENTER_VERTICAL | Gravity.START));
        c.addView(top);
        TextView nm = txt(L(p[5], p[6]), gold ? 0xBF0A1033 : MUTED, 14, true);
        nm.setPadding(0, dp(14), 0, dp(14));
        c.addView(nm);
        TextView price = txt(bpPrice(p[4]) != null ? bpPrice(p[4]) : "$" + p[3], gold ? GOLD : NAVY, 16, true);
        price.setGravity(Gravity.CENTER);
        price.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        price.setPadding(dp(10), dp(12), dp(10), dp(12));
        GradientDrawable pg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, gold ? new int[] { NAVY, NAVY } : new int[] { 0xFFF8D27A, 0xFFF5C35A });
        pg.setCornerRadius(dp(30));
        price.setBackground(pg);
        c.addView(price);
        f.addView(c, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        String badge = L(p[7], p[8]);
        if (badge.length() > 0) {
            TextView b = txt(badge, tier == 3 ? NAVY : gold ? GOLD : Color.WHITE, 11, true);
            b.setSingleLine(true);
            b.setPadding(dp(12), dp(5), dp(12), dp(5));
            GradientDrawable bgb = new GradientDrawable();
            bgb.setColor(tier == 3 ? GOLD : gold ? NAVY : 0xFF2C4BB5);
            bgb.setCornerRadii(isRtlLang() ? new float[] { 0, 0, 0, 0, dp(14), dp(14), 0, 0 } : new float[] { 0, 0, 0, 0, 0, 0, dp(14), dp(14) });
            b.setBackground(bgb);
            f.addView(b, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.END));
        }
        f.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { buyCoinPack(p[4]); } });
        return f;
    }

    protected void stRefreshBalance() {
        if (uid == null) return;
        pool.execute(new Runnable() { @Override public void run() {
            try {
                JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                if (a.length() == 0) return;
                final long pts = a.getJSONObject(0).optLong("points", 0);
                runOnUiThread(new Runnable() { @Override public void run() { if (stBal != null) stBal.setText(String.format(java.util.Locale.US, "%,d", pts)); } });
            } catch (Exception ignore) {}
        } });
    }
}
