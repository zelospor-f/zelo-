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

abstract class GoogleVerify extends FollowLinks {
    // ===== من google-verify.js: ربط الشراء بالحساب والتحقق منه لدى الخادم =====
    // ملاحظة: الجزء الخاص بمكتبة Google Play Billing نفسها (تهيئة المتجر وإنهاء العملية) مؤجَّل لآخر مرحلة
    protected static final String[] COINS = { "zelo_coin_100", "zelo_coin_500", "zelo_coin_1000", "zelo_coin_2000", "zelo_coin_6000" };
    protected static final String[] SUBS = { "zelo_t1_m", "zelo_t1_y", "zelo_t2_m", "zelo_t2_y", "zelo_t3_m", "zelo_t3_y" };

    protected boolean inList(String[] l, String id) { for (String x : l) if (x.equals(id)) return true; return false; }

    // بصمة الحساب = sha256("zelo:" + uid) (applicationUsername في الشراء)
    protected String acctHash() {
        try {
            if (uid == null || uid.length() == 0) return "";
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(("zelo:" + uid).getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(java.util.Locale.US, "%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }

    // التحقق لدى الخادم: دالة Supabase "google-verify". يعيد null عند النجاح أو رسالة الخطأ
    protected String verifyPurchase(String productId, String purchaseToken) {
        try {
            JSONObject b = new JSONObject().put("product_id", productId).put("purchase_token", purchaseToken);
            JSONObject r = authCall("POST", "/functions/v1/google-verify", b.toString(), token);
            if (r.optBoolean("ok", false)) return null;
            return r.optString("error", "verify_failed");
        } catch (Exception e) { return String.valueOf(e.getMessage()); }
    }

    // يُستدعى من مكتبة الدفع عند اعتماد عملية شراء. النتيجة تصل إلى done(ok)
    protected void handlePurchase(final String productId, final String purchaseToken, final Runnable onOk) {
        if (purchaseToken == null || productId == null || (!inList(COINS, productId) && !inList(SUBS, productId))) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                final String err = verifyPurchase(productId, purchaseToken);
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (err == null) {
                            toast(inList(COINS, productId) ? L("تم شحن النقاط ✅", "Points added ✅") : L("تم تفعيل الاشتراك ✅", "Subscription activated ✅"));
                            if (onOk != null) onOk.run();
                            loadBalance();
                        } else toast(L("تعذّر التحقق من الشراء: ", "Could not verify the purchase: ") + err);
                    }
                });
            }
        });
    }
}
