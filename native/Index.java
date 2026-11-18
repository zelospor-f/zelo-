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

abstract class Index extends I18nHelpers {
    // ===== من index.html: هيكل التطبيق المشترك =====
    // الشريط السفلي والعلوي مبنيان في Home. هنا: عدّاد الرسائل على زر الرسائل،
    // تحديث رصيد ZELO كل 30 ثانية، وزر الرجوع الموحّد. (قائمة تحميل ملفات الويب لا مقابل لها: كل ملف أصبح Java)
    protected int msgUnread = 0, notifUnread = 0;
    protected TextView msgBadgeV;
    protected final android.os.Handler shellH = new android.os.Handler();
    protected boolean shellOn = false;
    protected final Runnable balTick = new Runnable() {
        @Override public void run() {
            if (!shellOn) return;
            loadBalance();
            shellH.postDelayed(this, 30000);
        }
    };
    protected final Runnable msgTick = new Runnable() {
        @Override public void run() {
            if (!shellOn) return;
            updateMsgBadge();
            shellH.postDelayed(this, 15000);
        }
    };

    // عدد الصفوف حسب الاستعلام (Content-Range)
    protected long countRows(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/" + path).openConnection();
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Prefer", "count=exact");
        c.setRequestProperty("Range-Unit", "items");
        c.setRequestProperty("Range", "0-0");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        int code = c.getResponseCode();
        String cr = c.getHeaderField("Content-Range");
        if (code >= 400 || cr == null || cr.indexOf('/') < 0) return 0;
        String n = cr.substring(cr.indexOf('/') + 1);
        try { return Long.parseLong(n.trim()); } catch (Exception e) { return 0; }
    }

    // رسائل غير مقروءة: dm_messages حيث receiver_id = أنا و read_at فارغ
    protected void updateMsgBadge() {
        if (uid == null || token == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    msgUnread = (int) countRows("dm_messages?select=id&receiver_id=eq." + uid + "&read_at=is.null");
                    runOnUiThread(new Runnable() { @Override public void run() { updateNavBadge(); } });
                } catch (Exception ignore) {}
            }
        });
    }

    // عدّاد زر الرسائل = الرسائل غير المقروءة فقط، وعدّاد الإشعارات على أيقونة الجرس
    protected void updateBellBadge() {}
    protected void updateNavBadge() {
        updateBellBadge();
        if (msgBadgeV == null) return;
        int n = msgUnread;
        msgBadgeV.setText(n > 99 ? "99+" : String.valueOf(n));
        msgBadgeV.setVisibility(n > 0 ? View.VISIBLE : View.GONE);
    }

    // يلفّ عنصر الشريط السفلي ويضيف عليه العدّاد الأزرق
    protected View withMsgBadge(View item) {
        FrameLayout fl = new FrameLayout(this);
        fl.addView(item, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView b = tv(Color.WHITE, 10, true);
        b.setGravity(Gravity.CENTER);
        b.setMinWidth(dp(18));
        b.setPadding(dp(4), 0, dp(4), 0);
        GradientDrawable g = new GradientDrawable();
        g.setColor(0xFF2C4BB5);
        g.setCornerRadius(dp(9));
        g.setStroke(dp(2), NAVY);
        b.setBackground(g);
        b.setVisibility(View.GONE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(18), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        lp.setMargins(dp(26), dp(6), 0, 0);
        fl.addView(b, lp);
        msgBadgeV = b;
        updateNavBadge();
        return fl;
    }

    protected void shellStart() {
        if (shellOn) return;
        shellOn = true;
        shellH.postDelayed(balTick, 3000);
        shellH.postDelayed(msgTick, 4000);
    }

    @Override
    protected void onResume() {
        super.onResume();
        shellStart();
    }

    @Override
    protected void onPause() {
        super.onPause();
        shellOn = false;
        shellH.removeCallbacksAndMessages(null);
    }
}
