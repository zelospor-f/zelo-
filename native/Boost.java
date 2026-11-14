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


abstract class Boost extends Subscriptions {
    protected int bDaily = 1, bDays = 1;
    protected long bBalance = 0, bAudience = -1;
    protected TextView bDailyV, bDaysV, bTotal, bReach, bBal, bMsg, bBtn;
    protected boolean bBusy = false;

    protected void openBoost(final String pk) {
        if (uid == null) return;
        fetchTier(new TierCb() {
            @Override public void on(int t) {
                if (t <= 0) { toast("التعزيز للمشتركين فقط"); openSubscriptions(); return; }
                showBoost(pk);
            }
        });
    }

    protected void showBoost(final String pk) {
        bDaily = 1; bDays = 1; bBalance = 0; bAudience = -1; bBusy = false;
        final Dialog d = sheetDialog(false);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(16), dp(18), navH() + dp(14));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF121215);
        pbg.setCornerRadii(new float[] { dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0 });
        pbg.setStroke(dp(1), 0x40F5C35A);
        box.setBackground(pbg);
        TextView title = tv(Color.WHITE, 18, true);
        title.setText("تعزيز المنشور");
        title.setGravity(Gravity.CENTER);
        box.addView(title);
        TextView ds = tv(MUTED, 13, false);
        ds.setText("اختر الميزانية اليومية والمدة. تُخصم النقاط حسب الظهور الفعلي فقط.");
        ds.setPadding(0, dp(8), 0, dp(14));
        box.addView(ds);

        LinearLayout r1 = new LinearLayout(this);
        TextView l1 = tv(MUTED, 13, false); l1.setText("الميزانية اليومية");
        bDailyV = tv(Color.WHITE, 15, true);
        r1.addView(l1, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r1.addView(bDailyV);
        box.addView(r1);
        SeekBar s1 = new SeekBar(this);
        s1.setMax(499);
        s1.setProgress(0);
        s1.getProgressDrawable().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        s1.getThumb().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        box.addView(s1);

        LinearLayout r2 = new LinearLayout(this);
        r2.setPadding(0, dp(14), 0, 0);
        TextView l2 = tv(MUTED, 13, false); l2.setText("المدة");
        bDaysV = tv(Color.WHITE, 15, true);
        r2.addView(l2, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r2.addView(bDaysV);
        box.addView(r2);
        SeekBar s2 = new SeekBar(this);
        s2.setMax(29);
        s2.setProgress(0);
        s2.getProgressDrawable().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        s2.getThumb().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        box.addView(s2);

        LinearLayout r3 = new LinearLayout(this);
        r3.setPadding(0, dp(16), 0, 0);
        TextView l3 = tv(MUTED, 13, false); l3.setText("الإجمالي");
        bTotal = tv(Color.WHITE, 15, true);
        r3.addView(l3, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r3.addView(bTotal);
        box.addView(r3);
        LinearLayout r4 = new LinearLayout(this);
        r4.setPadding(0, dp(8), 0, 0);
        TextView l4 = tv(MUTED, 13, false); l4.setText("الوصول اليومي المتوقع");
        bReach = tv(Color.WHITE, 13, true);
        r4.addView(l4, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r4.addView(bReach);
        box.addView(r4);
        bBal = tv(MUTED, 13, false);
        bBal.setPadding(0, dp(8), 0, 0);
        box.addView(bBal);
        bMsg = tv(0xFFFF6B6B, 12, false);
        bMsg.setPadding(0, dp(8), 0, dp(6));
        box.addView(bMsg);
        bBtn = pill("تعزيز المنشور", NAVY, GOLD, 0);
        box.addView(bBtn);

        SeekBar.OnSeekBarChangeListener ch = new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int p, boolean u) {
                if (sb.getMax() == 499) bDaily = p + 1; else bDays = p + 1;
                updateBoost();
            }
            @Override public void onStartTrackingTouch(SeekBar sb) {}
            @Override public void onStopTrackingTouch(SeekBar sb) {}
        };
        s1.setOnSeekBarChangeListener(ch);
        s2.setOnSeekBarChangeListener(ch);
        bBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submitBoost(pk, d); }
        });
        sc.addView(box);
        d.setContentView(sc);
        d.show();
        updateBoost();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                    if (a.length() > 0) bBalance = a.getJSONObject(0).optLong("points", 0);
                } catch (Exception ignore) {}
                try { bAudience = Long.parseLong(rpc("boost_audience_size", "{}").trim()); } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { updateBoost(); } });
            }
        });
    }

    protected void updateBoost() {
        if (bDailyV == null) return;
        long daily = bDaily * 1000L;
        boolean enough = bBalance >= daily;
        bDailyV.setText(nfmt(daily) + " ZELO");
        bDaysV.setText(bDays + " يومًا");
        bTotal.setText(nfmt(daily * bDays) + " ZELO");
        if (bAudience < 0) bReach.setText("—");
        else bReach.setText("حتى " + nfmt(Math.min(daily * 10, bAudience * 3)) + " ظهور يوميًا (تقديري)");
        bBal.setText("رصيدك: " + nfmt(bBalance) + " ZELO");
        bMsg.setText(enough ? "" : "رصيدك لا يكفي لميزانية يوم واحد. اربح نقاطًا أولًا.");
        bBtn.setAlpha(!enough || bBusy ? 0.5f : 1f);
    }

    protected void submitBoost(final String pk, final Dialog d) {
        if (bBusy || bBalance < bDaily * 1000L) return;
        bBusy = true;
        updateBoost();
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    JSONObject b = new JSONObject();
                    b.put("p_user_id", uid);
                    b.put("p_post_id", Long.parseLong(pk));
                    b.put("p_daily_points", bDaily * 1000L);
                    b.put("p_days", bDays);
                    rpc("create_boost", b.toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        bBusy = false;
                        if (fe == null) { d.dismiss(); toast("تم تعزيز المنشور ✅"); loadBalance(); return; }
                        String m = "تعذّر التعزيز، حاول لاحقًا";
                        if (fe.contains("premium_required")) m = "التعزيز للمشتركين فقط";
                        else if (fe.contains("insufficient_balance")) m = "رصيدك لا يكفي";
                        else if (fe.contains("already_active")) m = "هذا المنشور معزّز حاليًا";
                        else if (fe.contains("not_owner")) m = "لا يمكنك تعزيز منشور ليس لك";
                        toast(m);
                        updateBoost();
                    }
                });
            }
        });
    }
          }
