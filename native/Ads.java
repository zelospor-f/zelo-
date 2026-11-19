package PKG;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.OnUserEarnedRewardListener;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.rewarded.RewardItem;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions;
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
// Ads.java — محوَّل من ads.js (إعلانات AdMob: المكافأة + البانر)
// يستعمل حزمة Google Mobile Ads مباشرة (play-services-ads). غير مفحوص بالمترجم هنا.
// الإعلان البيني معطّل عمداً كما في الأصل. عند الإطلاق غيّر AD_REAL إلى true فقط.
// ============================================================
abstract class Ads extends Store {
    protected static final boolean AD_REAL = true;   // false = معرّفات جوجل التجريبية
    protected static final String AD_REWARDED = AD_REAL ? "ca-app-pub-4978898922755717/4216858741" : "ca-app-pub-3940256099942544/5224354917";
    protected static final String AD_BANNER = AD_REAL ? "ca-app-pub-4978898922755717/4234216793" : "ca-app-pub-3940256099942544/6300978111";
    protected static final String AD_NATIVE = AD_REAL ? "ca-app-pub-4978898922755717/2981291981" : "ca-app-pub-3940256099942544/2247696110"; // الحقيقي: ضع معرّف وحدة Native من AdMob
    protected final List<NativeAd> adNativeList = new ArrayList<NativeAd>();
    protected static final long AD_COOLDOWN_MS = 30 * 1000L;

    protected boolean adInit = false, adBusy = false, adBannerOn = false, adRewardEarned = false;
    protected long adLastShown = 0;
    protected Dialog adDlg;
    protected TextView adStatus, adWatchBtn;
    protected LinearLayout adProg;
    protected View adSlot;

    protected void adInitSdk(final Runnable then) {
        if (adInit) { then.run(); return; }
        try {
            MobileAds.initialize(this, new OnInitializationCompleteListener() {
                @Override public void onInitializationComplete(InitializationStatus s) { adInit = true; then.run(); }
            });
        } catch (Throwable e) { adStatus(L("تعذّر تهيئة الإعلانات", "Could not start ads"), true); }
    }

    protected void adStatus(String msg, boolean err) {
        if (adStatus == null) { if (msg != null && msg.length() > 0) toast(msg); return; }
        adStatus.setText(msg == null ? "" : msg);
        adStatus.setTextColor(err ? 0xFFFF6B6B : 0xFF94A3B8);
    }

    protected void adButton(boolean disabled, String label) {
        if (adWatchBtn == null) return;
        adWatchBtn.setEnabled(!disabled);
        adWatchBtn.setAlpha(disabled ? 0.6f : 1f);
        if (label != null) adWatchBtn.setText(label);
    }

    // ---------- صفحة «اربح كورة» ----------
    protected void openAdsPage() {
        if (adDlg != null) return;
        final Dialog d = sheetDialog(true);
        adDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), statusH() + dp(6), dp(18), navH() + dp(20));
        root.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        c.setPadding(0, dp(16), 0, 0);
        ImageView coin = lbCoin(84);
        c.addView(coin, new LinearLayout.LayoutParams(dp(84), dp(84)));
        TextView h = txt(L("اربح كورة مجانية", "Earn free Kora"), 0xFFF8FAFC, 22, true);
        h.setGravity(Gravity.CENTER);
        c.addView(h, lpm(0, 10, 0, 8));
        TextView p = txt(L("شاهد إعلانًا قصيرًا واحصل على كورة.", "Watch a short ad and get Kora."), 0xFF94A3B8, 15, false);
        p.setGravity(Gravity.CENTER);
        c.addView(p, lpm(0, 0, 0, 22));
        adProg = new LinearLayout(this);
        adProg.setOrientation(LinearLayout.VERTICAL);
        adProg.setGravity(Gravity.CENTER_HORIZONTAL);
        c.addView(adProg, lpm(0, 0, 0, 18));
        adWatchBtn = txt(L("📺 شاهد الإعلان", "📺 Watch ad"), Color.WHITE, 17, true);
        adWatchBtn.setGravity(Gravity.CENTER);
        adWatchBtn.setPadding(dp(30), dp(16), dp(30), dp(16));
        adWatchBtn.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF14206B, 0xFF2C4BB5, 0xFFF5C35A }) {{ setCornerRadius(dp(16)); }});
        adWatchBtn.setMinWidth(dp(220));
        adWatchBtn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { adWatch(); } });
        c.addView(adWatchBtn, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        adStatus = txt("", 0xFF94A3B8, 14, false);
        adStatus.setGravity(Gravity.CENTER);
        adStatus.setMinHeight(dp(22));
        c.addView(adStatus, lpm(0, 16, 0, 0));
        root.addView(c);
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (adDlg == d) { adDlg = null; adStatus = null; adWatchBtn = null; adProg = null; } } });
        d.show();
        adInitSdk(new Runnable() { @Override public void run() {} });
        adRenderProgress(null);
    }

    protected JSONObject adGetProgress() {
        try { return rmRow(rpc("my_ad_progress", "{}")); } catch (Exception e) { return null; }
    }

    protected void adRenderProgress(final JSONObject given) {
        pool.execute(new Runnable() { @Override public void run() {
            final JSONObject p = given != null ? given : adGetProgress();
            runOnUiThread(new Runnable() { @Override public void run() {
                if (adProg == null) return;
                adProg.removeAllViews();
                if (p == null) return;
                int per = p.optInt("per", 5), prog = p.optInt("progress", 0), total = p.optInt("total", 0);
                LinearLayout dots = new LinearLayout(Ads.this);
                for (int i = 0; i < per; i++) {
                    View dv = new View(Ads.this);
                    dv.setBackground(oval(i < prog ? 0xFFFCB045 : 0x26FFFFFF, 0));
                    LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(dp(16), dp(16));
                    dl.setMargins(dp(4), 0, dp(4), 0);
                    dots.addView(dv, dl);
                }
                adProg.addView(dots);
                TextView t = txt(L(prog + T(" من ") + per + T(" للكورة القادمة · شاهدت ") + total + T(" إعلانًا"), prog + " of " + per + " to next Kora · " + total + " ads watched"), 0xFF94A3B8, 13, false);
                t.setPadding(0, dp(8), 0, 0);
                adProg.addView(t);
            } });
        } });
    }

    protected void adWatch() {
        if (adBusy) return;
        if (uid == null) { adStatus(L("سجّل الدخول أولاً.", "Please sign in first."), true); return; }
        long wait = AD_COOLDOWN_MS - (System.currentTimeMillis() - adLastShown);
        if (wait > 0) {
            long s = (wait + 999) / 1000;
            adStatus(L("انتظر " + s + T(" ثانية قبل الإعلان التالي."), "Wait " + s + "s before the next ad."), true);
            return;
        }
        adBusy = true;
        adButton(true, L("جارٍ التحضير...", "Preparing..."));
        adStatus("", false);
        adLastShown = System.currentTimeMillis();
        adInitSdk(new Runnable() { @Override public void run() { adLoadAndShow(); } });
    }

    protected void adEnd() {
        adBusy = false;
        adButton(false, L("📺 شاهد الإعلان", "📺 Watch ad"));
    }

    protected void adLoadAndShow() {
        adStatus(L("جارٍ تحميل الإعلان...", "Loading ad..."), false);
        adRewardEarned = false;
        try {
            RewardedAd.load(this, AD_REWARDED, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override public void onAdFailedToLoad(LoadAdError e) {
                    adStatus(L("تعذّر عرض الإعلان الآن، حاول لاحقاً.", "Could not show the ad, try again later."), true);
                    adEnd();
                }
                @Override public void onAdLoaded(RewardedAd ad) {
                    try {
                        ad.setServerSideVerificationOptions(new ServerSideVerificationOptions.Builder().setUserId(String.valueOf(uid == null ? "guest" : uid)).setCustomData("manual").build());
                        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                            @Override public void onAdDismissedFullScreenContent() { adFinished(); }
                            @Override public void onAdFailedToShowFullScreenContent(AdError e) {
                                adStatus(L("تعذّر عرض الإعلان الآن، حاول لاحقاً.", "Could not show the ad, try again later."), true);
                                adEnd();
                            }
                        });
                        ad.show(Ads.this, new OnUserEarnedRewardListener() {
                            @Override public void onUserEarnedReward(RewardItem item) { adRewardEarned = true; }
                        });
                    } catch (Throwable t) {
                        adStatus(L("تعذّر عرض الإعلان الآن، حاول لاحقاً.", "Could not show the ad, try again later."), true);
                        adEnd();
                    }
                }
            });
        } catch (Throwable t) {
            adStatus(L("تعذّر عرض الإعلان الآن، حاول لاحقاً.", "Could not show the ad, try again later."), true);
            adEnd();
        }
    }

    protected void adFinished() {
        boolean ok = adRewardEarned;
        adEnd();
        if (ok) { adStatus(L("جارٍ التحقق من المكافأة...", "Verifying reward..."), false); adWaitForPoints(); }
        else adStatus(L("لم تكتمل مشاهدة الإعلان، لذلك لا توجد مكافأة.", "Ad was not completed, no reward."), true);
    }

    // ينتظر تسجيل الإعلان في الخادم ثم يعرض التقدّم نحو الكورة التالية
    protected void adWaitForPoints() {
        pool.execute(new Runnable() { @Override public void run() {
            JSONObject b0 = adGetProgress();
            long t0 = b0 == null ? -1 : b0.optLong("total", 0);
            for (int i = 0; i < 6; i++) {
                try { Thread.sleep(2500); } catch (Exception ignore) {}
                final JSONObject p = adGetProgress();
                if (p != null && t0 >= 0 && p.optLong("total", 0) > t0) {
                    final int prog = p.optInt("progress", 0), per = p.optInt("per", 5);
                    runOnUiThread(new Runnable() { @Override public void run() {
                        loadBalance();
                        adRenderProgress(p);
                        adStatus(prog == 0 ? L("🎉 ربحت +1 كورة", "🎉 You earned +1 Kora") : L("تم ✅ التقدّم: " + prog + T(" من ") + per + T(" إعلانات للكورة القادمة"), "Done ✅ Progress: " + prog + " of " + per + " ads for the next Kora"), false);
                    } });
                    return;
                }
            }
            runOnUiThread(new Runnable() { @Override public void run() { adStatus(L("إذا لم يُسجَّل الإعلان خلال دقيقة، افتح الصفحة مرة أخرى.", "If the ad is not counted within a minute, reopen this page."), false); } });
        } });
    }

    // ---------- البانر (أسفل الصفحة الرئيسية فوق الشريط السفلي؛ المشترك لا يراه) ----------
    protected final Runnable startBanner = new Runnable() {
        @Override public void run() { adShowBanner(); }
    };

    // زر النشر العائم يرتفع فوق البانر كي لا يغطيه
    protected View adFab;
    protected void adFabShift() {
        if (adFab == null || !(adFab.getLayoutParams() instanceof FrameLayout.LayoutParams)) return;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) adFab.getLayoutParams();
        lp.bottomMargin = dp(18) + (adBannerOn ? dp(80) : 0);
        adFab.setLayoutParams(lp);
    }

    // بانر داخل الخلاصة (بين المنشورات): حاوية ثابتة لكل موضع، والإعلان يُحمَّل بعد تهيئة الـSDK
    protected View adFeedView() {
        final LinearLayout slot = new LinearLayout(this);
        slot.setOrientation(LinearLayout.VERTICAL);
        slot.setGravity(Gravity.CENTER_HORIZONTAL);
        slot.setPadding(dp(14), dp(6), dp(14), dp(6));
        TextView lab = txt(L("إعلان", "Ad"), MUTED, 11, true);
        lab.setGravity(Gravity.CENTER);
        slot.addView(lab);
        adInitSdk(new Runnable() { @Override public void run() {
            try {
                AdView av = new AdView(Ads.this);
                av.setAdSize(AdSize.BANNER);
                av.setAdUnitId(AD_BANNER);
                slot.addView(av, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                TextView sub = txt(L("اشترك لإزالة الإعلانات", "Subscribe to remove ads"), GOLD, 11, true);
                sub.setGravity(Gravity.CENTER);
                sub.setPadding(dp(10), dp(3), dp(10), dp(3));
                sub.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSubscriptions(); } });
                slot.addView(sub);
                av.loadAd(new AdRequest.Builder().build());
            } catch (Throwable e) { slot.setVisibility(View.GONE); }
        } });
        return slot;
    }

    // إعلان أصلي (Native) داخل الردود: بطاقة بتصميم التطبيق مع شارة «إعلان» واضحة
    protected void adNativeDestroy() {
        for (NativeAd a : adNativeList) { try { a.destroy(); } catch (Throwable ignore) {} }
        adNativeList.clear();
    }
    protected View adNativeView() {
        final LinearLayout slot = new LinearLayout(this);
        slot.setOrientation(LinearLayout.VERTICAL);
        slot.setPadding(dp(14), dp(12), dp(14), dp(8));
        slot.setVisibility(View.GONE);
        if (AD_NATIVE.length() == 0) return slot;
        adInitSdk(new Runnable() { @Override public void run() {
            try {
                AdLoader loader = new AdLoader.Builder(Ads.this, AD_NATIVE)
                    .forNativeAd(new NativeAd.OnNativeAdLoadedListener() {
                        @Override public void onNativeAdLoaded(NativeAd ad) {
                            if (isDestroyed()) { ad.destroy(); return; }
                            adNativeList.add(ad);
                            slot.removeAllViews();
                            slot.addView(adNativeCard(ad));
                            slot.setVisibility(View.VISIBLE);
                        }
                    })
                    .withAdListener(new AdListener() {
                        @Override public void onAdFailedToLoad(LoadAdError e) { slot.setVisibility(View.GONE); }
                    })
                    .build();
                loader.loadAd(new AdRequest.Builder().build());
            } catch (Throwable e) { slot.setVisibility(View.GONE); }
        } });
        return slot;
    }
    protected View adNativeCard(NativeAd ad) {
        NativeAdView nav = new NativeAdView(this);
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(14), dp(14), dp(12));
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFF111A4A, 0xFF0D1540 });
        bg.setCornerRadius(dp(20));
        bg.setStroke(dp(1), 0x33F5C35A);
        card.setBackground(bg);
        LinearLayout hd = new LinearLayout(this);
        hd.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge = tv(0xFFC9D1FF, 10, true);
        badge.setText(L("إعلان", "Ad"));
        badge.setPadding(dp(8), dp(2), dp(8), dp(2));
        GradientDrawable bgd = new GradientDrawable();
        bgd.setColor(0xFF2A3258);
        bgd.setCornerRadius(dp(6));
        badge.setBackground(bgd);
        ImageView icon = new ImageView(this);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        if (ad.getIcon() != null && ad.getIcon().getDrawable() != null) icon.setImageDrawable(ad.getIcon().getDrawable());
        else icon.setVisibility(View.GONE);
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(dp(44), dp(44));
        ilp.setMarginEnd(dp(10));
        hd.addView(icon, ilp);
        TextView head = tv(Color.WHITE, 15, true);
        head.setText(ad.getHeadline());
        head.setMaxLines(2);
        hd.addView(head, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        hd.addView(badge);
        card.addView(hd);
        TextView body = tv(0xFFD6DCF5, 13, false);
        if (ad.getBody() != null) { body.setText(ad.getBody()); body.setMaxLines(3); body.setPadding(0, dp(8), 0, 0); card.addView(body); }
        MediaView mv = new MediaView(this);
        if (ad.getMediaContent() != null) {
            mv.setMediaContent(ad.getMediaContent());
            mv.setImageScaleType(ImageView.ScaleType.CENTER_CROP);
            LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(170));
            mlp.topMargin = dp(10);
            card.addView(mv, mlp);
        }
        TextView cta = tv(NAVY, 14, true);
        cta.setGravity(Gravity.CENTER);
        GradientDrawable cg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { GOLD, 0xFFFDE9A8 });
        cg.setCornerRadius(dp(14));
        cta.setBackground(cg);
        cta.setPadding(0, dp(10), 0, dp(10));
        if (ad.getCallToAction() != null) {
            cta.setText(ad.getCallToAction());
            LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            clp.topMargin = dp(10);
            card.addView(cta, clp);
        }
        nav.addView(card);
        nav.setHeadlineView(head);
        nav.setBodyView(body);
        nav.setIconView(icon);
        nav.setMediaView(mv);
        nav.setCallToActionView(cta);
        nav.setNativeAd(ad);
        // رابط إزالة الإعلانات خارج منطقة الإعلان
        LinearLayout out = new LinearLayout(this);
        out.setOrientation(LinearLayout.VERTICAL);
        out.addView(nav);
        TextView sub = tv(GOLD, 11, true);
        sub.setText(L("اشترك لإزالة الإعلانات", "Subscribe to remove ads"));
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(dp(10), dp(8), dp(10), dp(2));
        sub.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSubscriptions(); } });
        out.addView(sub);
        return out;
    }

    protected void adShowBanner() {
        if (true) return; // الإعلان صار بين المنشورات (adFeedView) بدل الشريط الثابت
        if (adBannerOn || uid == null) return;
        fetchTier(new TierCb() { @Override public void on(int tier) {
            if (tier >= 1 || adBannerOn) return;
            adInitSdk(new Runnable() { @Override public void run() {
                try {
                    LinearLayout slot = new LinearLayout(Ads.this);
                    slot.setOrientation(LinearLayout.VERTICAL);
                    slot.setGravity(Gravity.CENTER_HORIZONTAL);
                    AdView av = new AdView(Ads.this);
                    av.setAdSize(AdSize.BANNER);
                    av.setAdUnitId(AD_BANNER);
                    slot.addView(av, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                    TextView sub = txt(L("اشترك لإزالة الإعلانات", "Subscribe to remove ads"), GOLD, 11, true);
                    sub.setGravity(Gravity.CENTER);
                    sub.setPadding(dp(10), dp(3), dp(10), dp(3));
                    sub.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSubscriptions(); } });
                    slot.addView(sub);
                    FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
                    lp.bottomMargin = dp(64) + navH() - dp(8);
                    addContentView(slot, lp);
                    adSlot = slot;
                    adBannerOn = true;
                    adFabShift();
                    av.loadAd(new AdRequest.Builder().build());
                } catch (Throwable e) { adBannerOn = false; }
            } });
        } });
    }

    // يُستدعى بعد الاشتراك لإخفاء البانر
    protected void adHideBanner() {
        if (adSlot != null && adSlot.getParent() instanceof ViewGroup) ((ViewGroup) adSlot.getParent()).removeView(adSlot);
        adSlot = null;
        adBannerOn = false;
        adFabShift();
    }
}
