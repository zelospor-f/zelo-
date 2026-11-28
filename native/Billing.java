package PKG;

import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.ConsumeResponseListener;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
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

// ===== من google-verify.js (جزء مكتبة الدفع): الشراء عبر Google Play Billing أصلياً =====
// المنتجات: العملات (مستهلكة) والاشتراكات. التحقق لدى الخادم يتم في GoogleVerify.handlePurchase
abstract class Billing extends GoogleVerify {
    protected abstract String L(String ar, String en);
    private BillingClient bpClient;
    private boolean bpConnecting = false;
    private final Map<String, ProductDetails> bpDetails = new HashMap<String, ProductDetails>();
    private final Map<String, String> bpPrices = new HashMap<String, String>();
    private final List<Runnable> bpWaiters = new ArrayList<Runnable>();
    private boolean bpBusy = false;

    // السعر المحلي من Google (أو null قبل التحميل)
    protected String bpPrice(String id) { return bpPrices.get(id); }

    private void bpReady(final Runnable ok, final Runnable fail) {
        if (bpClient != null && bpClient.isReady()) { ok.run(); return; }
        if (bpClient == null) {
            bpClient = BillingClient.newBuilder(this)
                .setListener(new PurchasesUpdatedListener() {
                    @Override public void onPurchasesUpdated(BillingResult r, List<Purchase> list) { bpOnUpdated(r, list); }
                })
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        }
        synchronized (bpWaiters) { bpWaiters.add(ok); }
        if (bpConnecting) return;
        bpConnecting = true;
        bpClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                bpConnecting = false;
                List<Runnable> w;
                synchronized (bpWaiters) { w = new ArrayList<Runnable>(bpWaiters); bpWaiters.clear(); }
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) { for (Runnable x : w) x.run(); }
                else if (fail != null) fail.run();
            }
            @Override public void onBillingServiceDisconnected() { bpConnecting = false; }
        });
    }

    // يحمّل الأسعار المحلية لكل المنتجات (يُستدعى مبكراً بعد الدخول)
    protected void bpPreload() {
        bpReady(new Runnable() { @Override public void run() {
            bpQuery(BillingClient.ProductType.INAPP, COINS, null);
            bpQuery(BillingClient.ProductType.SUBS, SUBS, null);
        } }, null);
    }

    private void bpQuery(final String type, String[] ids, final Runnable done) {
        List<QueryProductDetailsParams.Product> ps = new ArrayList<QueryProductDetailsParams.Product>();
        for (String id : ids) ps.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build());
        bpClient.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(ps).build(), new ProductDetailsResponseListener() {
            @Override public void onProductDetailsResponse(BillingResult r, QueryProductDetailsResult qr) {
                List<ProductDetails> list = qr == null ? null : qr.getProductDetailsList();
                if (list != null) for (ProductDetails pd : list) {
                    bpDetails.put(pd.getProductId(), pd);
                    String price = null;
                    if (BillingClient.ProductType.INAPP.equals(type)) {
                        if (pd.getOneTimePurchaseOfferDetails() != null) price = pd.getOneTimePurchaseOfferDetails().getFormattedPrice();
                    } else {
                        List<ProductDetails.SubscriptionOfferDetails> od = pd.getSubscriptionOfferDetails();
                        if (od != null && od.size() > 0 && od.get(0).getPricingPhases().getPricingPhaseList().size() > 0)
                            price = od.get(0).getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice();
                    }
                    if (price != null) bpPrices.put(pd.getProductId(), price);
                }
                if (done != null) done.run();
            }
        });
    }

    // شراء: sub=true للاشتراكات، upgrade=true لاستبدال الاشتراك الحالي
    protected void bpBuy(final String productId, final boolean sub, final boolean upgrade) {
        if (!adultGate()) return;
        if (bpBusy) return;
        bpBusy = true;
        bpReady(new Runnable() { @Override public void run() {
            bpQuery(sub ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP, new String[] { productId }, new Runnable() { @Override public void run() {
                final ProductDetails pd = bpDetails.get(productId);
                if (pd == null) { bpBusy = false; toast(L("المنتج غير متاح حالياً في Google Play", "This product is not available in Google Play right now")); return; }
                if (sub && upgrade) {
                    pool.execute(new Runnable() { @Override public void run() {
                        String oldTok = null, oldId = "";
                        try {
                            String r = rpc("my_active_sub", "{}").trim();
                            JSONObject row = r.startsWith("[") ? (new JSONArray(r).length() > 0 ? new JSONArray(r).getJSONObject(0) : null) : (r.startsWith("{") ? new JSONObject(r) : null);
                            if (row != null && !row.isNull("purchase_token")) { oldTok = row.optString("purchase_token"); oldId = row.optString("product_id"); }
                        } catch (Exception ignore) {}
                        final String ot = oldTok, oi = oldId;
                        runOnUiThread(new Runnable() { @Override public void run() { bpLaunch(pd, sub, ot, oi); } });
                    } });
                } else bpLaunch(pd, sub, null, "");
            } });
        } }, new Runnable() { @Override public void run() { bpBusy = false; toast(L("خدمة Google Play غير متاحة", "Google Play is unavailable")); } });
    }

    private void bpLaunch(ProductDetails pd, boolean sub, String oldTok, String oldId) {
        try {
            BillingFlowParams.ProductDetailsParams.Builder pb = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
            if (sub) {
                List<ProductDetails.SubscriptionOfferDetails> od = pd.getSubscriptionOfferDetails();
                if (od == null || od.isEmpty()) { bpBusy = false; toast(L("العرض غير متاح", "Offer unavailable")); return; }
                pb.setOfferToken(od.get(0).getOfferToken());
            }
            List<BillingFlowParams.ProductDetailsParams> l = new ArrayList<BillingFlowParams.ProductDetailsParams>();
            l.add(pb.build());
            BillingFlowParams.Builder fb = BillingFlowParams.newBuilder().setProductDetailsParamsList(l);
            String h = acctHash();
            if (h.length() > 0) fb.setObfuscatedAccountId(h);
            if (sub && oldTok != null && oldTok.length() > 0) {
                boolean same = oldId.length() >= 2 && pd.getProductId().endsWith(oldId.substring(oldId.length() - 2));
                fb.setSubscriptionUpdateParams(BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                    .setOldPurchaseToken(oldTok)
                    .setSubscriptionReplacementMode(same ? BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE : BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE)
                    .build());
            }
            BillingResult r = bpClient.launchBillingFlow(this, fb.build());
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { bpBusy = false; toast(L("تعذّر فتح نافذة الدفع", "Could not open the payment window")); }
        } catch (Exception e) { bpBusy = false; toast(L("تعذّر إتمام الشراء: ", "Purchase failed: ") + e.getMessage()); }
    }

    private void bpOnUpdated(BillingResult r, List<Purchase> list) {
        bpBusy = false;
        int c = r.getResponseCode();
        if (c == BillingClient.BillingResponseCode.USER_CANCELED) return;
        if (c == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) { toast(L("تملك هذا المنتج بالفعل. اضغط «استعادة مشترياتي».", "You already own this. Tap “Restore purchases”.")); return; }
        if (c != BillingClient.BillingResponseCode.OK || list == null) { toast(L("تعذّر إتمام الشراء", "Purchase failed")); return; }
        for (Purchase p : list) bpProcess(p);
    }

    // يتحقق من الشراء لدى الخادم ثم يستهلكه (عملات) أو يؤكده (اشتراك)
    private void bpProcess(final Purchase p) {
        if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) { toast(L("الدفع قيد المعالجة…", "Payment is pending…")); return; }
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        final String tok = p.getPurchaseToken();
        for (final String pid : p.getProducts()) {
            if (!inList(COINS, pid) && !inList(SUBS, pid)) continue;
            handlePurchase(pid, tok, new Runnable() { @Override public void run() {
                if (inList(COINS, pid)) {
                    bpClient.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(tok).build(), new ConsumeResponseListener() {
                        @Override public void onConsumeResponse(BillingResult r, String t) {}
                    });
                } else if (!p.isAcknowledged()) {
                    bpClient.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(tok).build(), new AcknowledgePurchaseResponseListener() {
                        @Override public void onAcknowledgePurchaseResponse(BillingResult r) {}
                    });
                }
            } });
        }
    }

    // استعادة المشتريات: يتحقق من كل ما يملكه الحساب في Google Play
    protected void bpRestore() {
        toast(L("جارٍ البحث عن مشترياتك…", "Looking for your purchases…"));
        bpReady(new Runnable() { @Override public void run() {
            final int[] found = { 0 };
            final String[] types = { BillingClient.ProductType.SUBS, BillingClient.ProductType.INAPP };
            final int[] pending = { types.length };
            for (String t : types) {
                bpClient.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(t).build(), new PurchasesResponseListener() {
                    @Override public void onQueryPurchasesResponse(BillingResult r, List<Purchase> list) {
                        if (list != null) for (Purchase p : list) { found[0]++; bpProcess(p); }
                        synchronized (pending) { pending[0]--; }
                        if (pending[0] == 0 && found[0] == 0) runOnUiThread(new Runnable() { @Override public void run() { toast(L("لا توجد مشتريات لاستعادتها", "No purchases to restore")); } });
                    }
                });
            }
        } }, new Runnable() { @Override public void run() { toast(L("خدمة Google Play غير متاحة", "Google Play is unavailable")); } });
    }
}
