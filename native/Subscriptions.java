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


abstract class Subscriptions extends Support {
    // ---------------- الاشتراكات والتعزيز ----------------
    protected static final String[][] PLANS = {
        { "1", "الأساسية", "0.99", "8.49", "zelo_t1_m", "zelo_t1_y" },
        { "2", "المميّزة", "1.99", "16.99", "zelo_t2_m", "zelo_t2_y" },
        { "3", "الكاملة", "4.99", "41.99", "zelo_t3_m", "zelo_t3_y" }
    };
    protected static final String[][] MATRIX = {
        { "1", "توثيق الحساب وشعار النادي" }, { "1", "منشور أطول (حتى 1000 حرف)" }, { "1", "رسائل صوتية داخل الغرف" },
        { "2", "نشر الصور" }, { "2", "نشر الفيديو" }, { "2", "الذكاء الاصطناعي" },
        { "3", "نوع المنشور" }, { "3", "توقّع المباريات" }
    };

    protected interface TierCb { void on(int tier); }
    protected void fetchTier(final TierCb cb) { fetchTierOf(uid, cb); }
    protected void fetchTierOf(final String who, final TierCb cb) {
        pool.execute(new Runnable() {
            @Override public void run() {
                int t = 0;
                try {
                    JSONArray a = new JSONArray(rpc("tier_among", "{\"p_ids\":[\"" + who + "\"]}"));
                    if (a.length() > 0) t = a.getJSONObject(0).optInt("tier", 0);
                } catch (Exception ignore) {}
                final int ft = t;
                runOnUiThread(new Runnable() { @Override public void run() { cb.on(ft); } });
            }
        });
    }


    protected void openSubscriptions() {
        final Dialog d = sheetDialog(true);
        ScrollView sc = new ScrollView(this);
        final LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(14), dp(16), navH() + dp(20));
        TextView x = tv(GOLD, 22, true);
        x.setText(L("‹ رجوع", "‹ Back"));
        x.setPadding(0, dp(6), 0, dp(10));
        x.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        box.addView(x);
        TextView h1 = tv(Color.WHITE, 24, true);
        h1.setText(T("الاشتراكات"));
        box.addView(h1);
        TextView sub = tv(MUTED, 13, false);
        sub.setText(L("شارك ناديك المفضل واحصل على مزايا إضافية.", "Share your favorite club and get extra perks."));
        sub.setPadding(0, dp(2), 0, dp(8));
        box.addView(sub);
        final TextView active = tv(GOLD, 14, true);
        active.setVisibility(View.GONE);
        active.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable ag = new GradientDrawable();
        ag.setColor(0x1FF5C35A); ag.setCornerRadius(dp(12)); ag.setStroke(dp(1), 0x66F5C35A);
        active.setBackground(ag);
        box.addView(active);

        final List<TextView> btns = new ArrayList<TextView>();
        for (int i = 0; i < PLANS.length; i++) {
            final String[] p = PLANS[i];
            final int tier = Integer.parseInt(p[0]);
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(14), dp(14), dp(14), dp(14));
            GradientDrawable cg = new GradientDrawable();
            cg.setColor(CARD); cg.setCornerRadius(dp(18));
            cg.setStroke(dp(tier == 3 ? 2 : 1), tier == 3 ? GOLD : 0x73F5C35A);
            card.setBackground(cg);
            LinearLayout head = new LinearLayout(this);
            head.setGravity(Gravity.CENTER_VERTICAL);
            TextView nm = tv(Color.WHITE, 18, true);
            nm.setText(T(p[1]) + (tier == 3 ? L("  ★ الأفضل قيمة", "  ★ Best value") : ""));
            head.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            TextView pr = tv(GOLD, 20, true);
            pr.setText((bpPrice(p[4]) != null ? bpPrice(p[4]) : "$" + p[2]) + L(" / شهريًا", " / monthly"));
            head.addView(pr);
            card.addView(head);
            for (int m = 0; m < MATRIX.length; m++) {
                boolean on = tier >= Integer.parseInt(MATRIX[m][0]);
                LinearLayout rw = new LinearLayout(this);
                rw.setGravity(Gravity.CENTER_VERTICAL);
                rw.setPadding(0, dp(7), 0, dp(7));
                TextView lb = tv(on ? Color.WHITE : 0xFF6F7AA8, 14, false);
                lb.setText(T(MATRIX[m][1]));
                rw.addView(lb, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                TextView mk = tv(on ? 0xFF2DE2C4 : 0xFFFF6B86, 16, true);
                mk.setText(on ? "✓" : "✗");
                rw.addView(mk);
                card.addView(rw);
            }
            TextView btn = pill(L("اشترك", "Subscribe"), tier == 3 ? NAVY : GOLD, tier == 3 ? GOLD : 0x00000000, tier == 3 ? 0 : 0x73F5C35A);
            btn.setTag(Integer.valueOf(tier));
            btns.add(btn);
            LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            bl.setMargins(0, dp(8), 0, 0);
            card.addView(btn, bl);
            btn.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { Object cur = box.getTag(); int ct = cur instanceof Integer ? (Integer) cur : 0; planClick(d, p, tier, ct); }
            });
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cl.setMargins(0, dp(10), 0, 0);
            box.addView(card, cl);
        }
        String[] notes = new String[] {
            L("الدفع عبر Google Play. يتجدد الاشتراك تلقائيًا ويمكنك إلغاؤه في أي وقت من إعدادات الاشتراكات في Google Play. السعر النهائي بعملتك يظهر في نافذة الدفع.", "Payment via Google Play. The subscription renews automatically and you can cancel anytime from subscription settings in Google Play. The final price in your currency appears in the payment window."),
            L("ZELO Sport تطبيق مستقل وغير تابع لأي نادٍ أو رابطة. أسماء الأندية وشعاراتها ملك لأصحابها وتُعرض للتعريف بالنادي المفضّل فقط.", "ZELO Sport is an independent app, not affiliated with any club or league. Club names and logos belong to their owners and are shown only to identify your favorite club."),
            L("تحذير: أي تلاعب في الكورة أو المكافآت أو الإعلانات يعرّض الحساب للحذف وخسارة كل شيء، بما في ذلك الاشتراك والرصيد، دون تعويض.", "Warning: any manipulation of balls, rewards or ads may get the account deleted and everything lost, including the subscription and balance, without compensation.")
        };
        for (int i = 0; i < notes.length; i++) {
            TextView n = tv(i == 2 ? 0xFFFFB4A8 : MUTED, 11, false);
            n.setText(notes[i]);
            n.setPadding(0, dp(10), 0, 0);
            box.addView(n);
        }
        TextView rs = pill(L("استعادة مشترياتي", "Restore my purchases"), GOLD, 0x00000000, 0x73F5C35A);
        rs.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); bpRestore(); } });
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rl.setMargins(0, dp(14), 0, 0);
        box.addView(rs, rl);
        sc.addView(box);
        d.setContentView(sc);
        d.show();
        fetchTier(new TierCb() {
            @Override public void on(int t) {
                box.setTag(Integer.valueOf(t));
                if (t > 0) {
                    active.setText(L("✅ اشتراكك فعّال: ", "✅ Your subscription is active: ") + T(PLANS[Math.min(t, 3) - 1][1]));
                    active.setVisibility(View.VISIBLE);
                }
                for (TextView b : btns) {
                    int pt = (Integer) b.getTag();
                    b.setText(t == 0 ? L("اشترك", "Subscribe") : pt > t ? L("ترقية", "Upgrade") : pt == t ? L("باقتك الحالية", "Your current plan") : L("باقتك أعلى من هذه", "Your plan is higher than this"));
                    b.setAlpha(pt <= t && t > 0 ? 0.55f : 1f);
                }
            }
        });
    }

    protected void planClick(final Dialog parent, final String[] p, int tier, final int cur) {
        if (cur > 0 && tier == cur) { toast(L("هذه باقتك الحالية", "This is your current plan")); return; }
        if (cur > 0 && tier < cur) { toast(L("لا يمكن النزول إلى باقة أقل أثناء اشتراكك الحالي", "You can't downgrade to a lower plan during your current subscription")); return; }
        final Dialog d = sheetDialog(false);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(16), dp(16), navH() + dp(14));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(CARD);
        pbg.setCornerRadii(new float[] { dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0 });
        box.setBackground(pbg);
        TextView t = tv(Color.WHITE, 18, true);
        t.setText((cur > 0 ? L("ترقية إلى ", "Upgrade to ") : "") + T(p[1]));
        t.setPadding(0, 0, 0, dp(12));
        box.addView(t);
        final String up = cur > 0 ? "1" : "0";
        TextView m = pill(L("شهري  ·  ", "Monthly  ·  ") + (bpPrice(p[4]) != null ? bpPrice(p[4]) : "$" + p[2]) + L(" / شهر", " / month"), GOLD, 0x00000000, 0x73F5C35A);
        m.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); parent.dismiss(); bpBuy(p[4], true, "1".equals(up)); } });
        box.addView(m);
        int save = (int) Math.round((1 - Double.parseDouble(p[3]) / (Double.parseDouble(p[2]) * 12)) * 100);
        TextView y = pill(L("سنوي (وفّر ", "Yearly (save ") + save + L("٪)  ·  ", "%)  ·  ") + (bpPrice(p[5]) != null ? bpPrice(p[5]) : "$" + p[3]) + L(" / سنة", " / year"), NAVY, GOLD, 0);
        y.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); parent.dismiss(); bpBuy(p[5], true, "1".equals(up)); } });
        LinearLayout.LayoutParams yl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        yl.setMargins(0, dp(10), 0, 0);
        box.addView(y, yl);
        if (cur > 0) {
            TextView n = tv(MUTED, 11, false);
            n.setText(L("الترقية فورية. تُحسب لك المدة المتبقية من باقتك الحالية.", "Upgrade is immediate. The remaining time on your current plan is credited to you."));
            n.setPadding(0, dp(10), 0, 0);
            box.addView(n);
        }
        d.setContentView(box);
        d.show();
    }
}
