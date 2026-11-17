package PKG;

import android.view.MotionEvent;
import android.view.Window;
import android.graphics.Shader;
import android.graphics.LinearGradient;
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

abstract class Push extends Radar {
    // ===== من push.js: تسجيل الجهاز لإشعارات Firebase =====
    // يقرأ توكن FCM بالانعكاس (Reflection) من مكتبة firebase-messaging التي تضيفها إضافة Push الحالية،
    // فلا يحتاج مكتبة إضافية ولا يتعطل البناء إن غابت.
    protected String lastPushToken = "";
    protected boolean pushStarted = false;

    // قناة إشعارات بأهمية عالية: تجعل الإشعار ينزل كبانر من أعلى الشاشة
    protected void ensurePushChannel() {
        if (android.os.Build.VERSION.SDK_INT < 26) return;
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null || nm.getNotificationChannel("zelo_high") != null) return;
            android.app.NotificationChannel ch = new android.app.NotificationChannel("zelo_high", "ZELO Sport", android.app.NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            ch.setShowBadge(true);
            nm.createNotificationChannel(ch);
        } catch (Throwable e) { android.util.Log.w("ZELO", "channel: " + e); }
    }

    protected void startPush() {
        ensurePushChannel();
        if (pushStarted || uid == null || token == null) return;
        pushStarted = true;
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 7721);
            return;
        }
        fetchPushToken();
    }
    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 7721 && res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) fetchPushToken();
    }
    protected void fetchPushToken() {
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    Class<?> fm = Class.forName("com.google.firebase.messaging.FirebaseMessaging");
                    Object inst = fm.getMethod("getInstance").invoke(null);
                    Object task = fm.getMethod("getToken").invoke(inst);
                    Class<?> tasks = Class.forName("com.google.android.gms.tasks.Tasks");
                    Class<?> taskC = Class.forName("com.google.android.gms.tasks.Task");
                    String tok = (String) tasks.getMethod("await", taskC).invoke(null, task);
                    savePushToken(tok);
                } catch (Throwable e) { android.util.Log.w("ZELO", "push: " + e); }
            }
        });
    }
    protected void savePushToken(String tok) {
        if (tok == null || tok.length() == 0 || tok.equals(lastPushToken)) return;
        try { rpc("register_device", new JSONObject().put("p_token", tok).toString()); lastPushToken = tok; }
        catch (Exception e) { android.util.Log.w("ZELO", "push save: " + e); }
    }
}
