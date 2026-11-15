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

abstract class FollowLinks extends Countries {
    // ===== من follow-links.js: أزرار متابعة X وتيليجرام (أسفل القائمة الجانبية) =====
    protected static final String LINK_X = "https://x.com/Zelo_Sport";
    protected static final String LINK_TG = "https://t.me/ZeloSport";

    protected void openExternal(String u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(u))); }
        catch (Exception e) { toast(L("تعذر فتح الرابط", "Could not open the link")); }
    }

    // صفّ الزرّين: يوضع أسفل القائمة الجانبية عند تحويلها
    protected View followRow() {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER);
        row.setPadding(0, dp(10), 0, dp(2));
        row.addView(followBtn(L("𝕏 تابعنا", "𝕏 Follow us"), LINK_X), followLp(0));
        row.addView(followBtn(L("✈️ تيليجرام", "✈️ Telegram"), LINK_TG), followLp(dp(8)));
        return row;
    }

    protected LinearLayout.LayoutParams followLp(int start) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(start, 0, 0, 0);
        return lp;
    }

    protected TextView followBtn(String text, final String link) {
        TextView b = tv(0xFFCBD5E1, 14, true);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setColor(0x0DFFFFFF);
        g.setCornerRadius(dp(12));
        g.setStroke(dp(1), 0x26FFFFFF);
        b.setBackground(g);
        b.setPadding(dp(10), dp(10), dp(10), dp(10));
        b.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openExternal(link); }
        });
        return b;
    }
}
