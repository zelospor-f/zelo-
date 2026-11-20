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

abstract class Radar extends Referrals {
    // ===== من radar.js: رادار نبض المشجعين =====
    protected static final float RW = 760f, RH = 300f;
    protected static final int C_JOY = 0xFFFFC83D, C_HYPE = 0xFF25E3C6, C_RAGE = 0xFFFF4D5E;
    protected static final String[] COUNTRY_RAW = {
        "brazil|البرازيل:-47:-15", "argentina|الأرجنتين:-64:-34", "france|فرنسا:2:47", "spain|إسبانيا:-3.7:40", "england|إنجلترا:-1:52",
        "germany|ألمانيا:10:51", "italy|إيطاليا:12:42", "portugal|البرتغال:-8:39.5", "netherlands|هولندا:5:52", "belgium|بلجيكا:4.5:50.8",
        "croatia|كرواتيا:16:45", "uruguay|الأوروغواي:-56:-33", "colombia|كولومبيا:-74:4.6", "mexico|المكسيك:-99:19.4",
        "usa|united states|الولايات المتحدة:-98:38", "canada|كندا:-100:56", "japan|اليابان:138:36", "south korea|كوريا الجنوبية:127.5:36.5",
        "australia|أستراليا:134:-25", "saudi arabia|السعودية:45:24", "egypt|مصر:31:27", "morocco|المغرب:-7:32", "tunisia|تونس:9.5:34",
        "algeria|الجزائر:3:28", "senegal|السنغال:-14.5:14.5", "nigeria|نيجيريا:8:9", "ghana|غانا:-1.5:7.9", "cameroon|الكاميرون:12.5:5.7",
        "iran|إيران:53:32", "qatar|قطر:51.2:25.3", "turkey|تركيا:35:39", "switzerland|سويسرا:8:46.8", "denmark|الدنمارك:10:56",
        "poland|بولندا:19:52", "scotland|اسكتلندا:-4:56.5", "ecuador|الإكوادور:-78:-1.8", "paraguay|باراغواي:-58:-23", "chile|تشيلي:-71:-33",
        "iraq|العراق:44:33", "jordan|الأردن:36:31", "uae|الإمارات:54:24", "south africa|جنوب أفريقيا:25:-29" };
    protected static final float[][][] LAND = {
        {{-168,66},{-140,70},{-100,72},{-80,68},{-60,55},{-55,48},{-70,42},{-80,30},{-97,25},{-88,16},{-78,8},{-95,16},{-110,23},{-125,40},{-135,58}},
        {{-80,10},{-60,10},{-35,-6},{-40,-22},{-58,-38},{-68,-54},{-75,-45},{-71,-18},{-80,-3}},
        {{-10,36},{-9,44},{-2,50},{5,58},{20,70},{40,68},{40,45},{28,40},{15,38},{5,38}},
        {{-17,21},{-6,36},{10,37},{32,31},{43,12},{51,11},{40,-12},{33,-27},{20,-35},{12,-17},{9,4},{-8,5},{-17,14}},
        {{40,45},{45,70},{100,76},{150,70},{178,66},{140,45},{122,30},{110,18},{103,2},{90,22},{77,8},{68,24},{57,24},{50,30},{35,30},{27,40}},
        {{114,-22},{130,-12},{142,-11},{153,-27},{146,-39},{132,-33},{116,-35}} };
    // مدن المحاكاة: {عربي، إنجليزي، مباراة عربي، مباراة إنجليزي، lon، lat}
    protected static final String[][] SIM_CITIES = {
        { "الرياض", "Riyadh", "الهلال × النصر", "Al Hilal v Al Nassr", "46.7", "24.7" }, { "مدريد", "Madrid", "ريال مدريد × أتلتيكو", "Real Madrid v Atletico", "-3.7", "40.4" },
        { "لندن", "London", "أرسنال × تشلسي", "Arsenal v Chelsea", "-0.1", "51.5" }, { "القاهرة", "Cairo", "الأهلي × الزمالك", "Al Ahly v Zamalek", "31.2", "30" },
        { "بوينس آيرس", "Buenos Aires", "بوكا × ريفر", "Boca v River", "-58.4", "-34.6" }, { "ريو", "Rio", "فلامنغو × بالميراس", "Flamengo v Palmeiras", "-43.2", "-22.9" },
        { "طوكيو", "Tokyo", "فيسيل كوبي × أوراوا", "Vissel Kobe v Urawa", "139.7", "35.7" }, { "باريس", "Paris", "باريس × مارسيليا", "PSG v Marseille", "2.3", "48.9" },
        { "إسطنبول", "Istanbul", "غلطة سراي × فنربخشة", "Galatasaray v Fenerbahce", "29", "41" }, { "الدار البيضاء", "Casablanca", "الوداد × الرجاء", "Wydad v Raja", "-7.6", "33.6" } };
    protected static final String[][] SIM_EVENTS = { { "هدف!", "Goal!" }, { "ركلة جزاء", "Penalty" }, { "هدف في الدقيقة الأخيرة", "Last-minute goal" }, { "بطاقة حمراء", "Red card" }, { "تصدٍّ تاريخي", "Huge save" }, { "هدف ملغى بالـVAR", "Goal ruled out by VAR" } };

    protected static class Pulse { float x, y; long t; String dom = "joy", city = "", match = "", ev = ""; int[] mix = { 34, 33, 33 }; long fans; }

    protected Map<String, float[]> radarCountry = null;
    protected List<float[]> landDots = null;
    protected final List<Pulse> rPulses = new ArrayList<Pulse>();
    protected final List<Pulse> rFeed = new ArrayList<Pulse>();
    protected Pulse rSel = null;
    protected String rFilt = "all", rCurr = null, rSide = null;
    protected float[] rSm = { 33, 34, 33 };
    protected final List<JSONObject> rMatches = new ArrayList<JSONObject>();
    protected final Map<String, JSONObject> rById = new HashMap<String, JSONObject>();
    protected final Map<String, double[]> rLast = new HashMap<String, double[]>();   // joy,hype,rage, aJ,aH,aR, bJ,bH,bR
    protected final Map<String, double[]> rAcc = new HashMap<String, double[]>();    // a(3) b(3) n(3)
    protected final int[][] rPend = new int[3][3];                                   // [a,b,n][joy,hype,rage]
    protected boolean rDemo = false, rActive = false;
    protected Set<String> rSeenEv = new HashSet<String>();
    protected Dialog radarDlg;
    protected RadarMap rMap;
    protected LinearLayout rMatchBox, rSideBox, rTeamsBox, rFeedBox, rVote, rDetail;
    protected TextView rFans, rPj, rPh, rPr;
    protected View rBj, rBh, rBr;
    protected final java.util.Random rnd = new java.util.Random();

    protected int emoColor(String d) { return "joy".equals(d) ? C_JOY : "hype".equals(d) ? C_HYPE : C_RAGE; }
    protected String emoName(String d) { return "joy".equals(d) ? L("فرح", "Joy") : "hype".equals(d) ? L("حماس", "Hype") : L("غضب", "Anger"); }
    protected String fmtN(long n) { return java.text.NumberFormat.getInstance(isAr() ? new java.util.Locale("ar", "EG") : java.util.Locale.US).format(n); }
    protected float[] proj(double lo, double la) { return new float[] { (float) ((lo + 170) / 350 * RW), (float) ((75 - la) / 130 * RH) }; }

    protected boolean insideLand(float x, float y) {
        float lo = x / RW * 350 - 170, la = 75 - y / RH * 130;
        for (float[][] p : LAND) {
            boolean c = false;
            for (int i = 0, j = p.length - 1; i < p.length; j = i++) {
                float[] a = p[i], b = p[j];
                if ((a[1] > la) != (b[1] > la) && lo < (b[0] - a[0]) * (la - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
            }
            if (c) return true;
        }
        return false;
    }
    protected List<float[]> dots() {
        if (landDots != null) return landDots;
        landDots = new ArrayList<float[]>();
        for (float x = 5; x < RW; x += 8) for (float y = 5; y < RH; y += 8) if (insideLand(x, y)) landDots.add(new float[] { x, y });
        return landDots;
    }
    protected float[] countryXY(String name) {
        if (radarCountry == null) {
            radarCountry = new HashMap<String, float[]>();
            for (String r : COUNTRY_RAW) {
                int b = r.lastIndexOf(':'), a = r.lastIndexOf(':', b - 1);
                float[] ll = { Float.parseFloat(r.substring(a + 1, b)), Float.parseFloat(r.substring(b + 1)) };
                for (String n : r.substring(0, a).split("\\|")) radarCountry.put(n.trim().toLowerCase(), ll);
            }
        }
        return radarCountry.get(String.valueOf(name == null ? "" : name).trim().toLowerCase());
    }
    protected float[] matchXY(JSONObject m, String side) {
        float[] ll = null;
        if (!m.isNull("lon") && !m.isNull("lat")) ll = new float[] { (float) m.optDouble("lon"), (float) m.optDouble("lat") };
        if (ll == null) {
            float[] a = countryXY(m.optString("team_a")), b = countryXY(m.optString("team_b"));
            ll = "b".equals(side) ? (b != null ? b : a) : (a != null ? a : b);
        }
        if (ll == null) ll = new float[] { 10, 30 };
        return proj(ll[0] + (rnd.nextFloat() - 0.5) * 4, ll[1] + (rnd.nextFloat() - 0.5) * 3);
    }
    protected boolean rIsLive(JSONObject m) {
        String st = m.optString("status").toUpperCase().trim();
        if (st.equals("FINISHED")) return false;
        String ls = (m.isNull("live_status") ? (m.isNull("api_status") ? "" : m.optString("api_status")) : m.optString("live_status")).toUpperCase().trim();
        if (ls.equals("IN_PLAY") || ls.equals("PAUSED") || ls.equals("LIVE")) return true;
        if (ls.equals("FINISHED") || ls.equals("POSTPONED") || ls.equals("CANCELLED") || ls.equals("SUSPENDED")) return false;
        if (st.equals("LIVE") || st.equals("IN_PLAY") || st.equals("PAUSED") || st.equals("HALF_TIME")) return true;
        double mins = (System.currentTimeMillis() - isoMs(m.optString("match_date"))) / 60000.0;
        return mins >= 0 && mins <= 150;
    }

    // ---------- الخريطة ----------
    protected class RadarMap extends View {
        final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float scale;
        RadarMap() { super(Radar.this); scale = dp(230) / RH; }
        @Override protected void onMeasure(int w, int h) { setMeasuredDimension((int) (RW * scale), (int) (RH * scale)); }
        @Override protected void onDraw(Canvas c) {
            long now = System.currentTimeMillis();
            c.drawColor(0xFF070C2B);
            c.save(); c.scale(scale, scale);
            p.setStyle(Paint.Style.FILL); p.setColor(0xFF26307A);
            for (float[] d : dots()) c.drawRect(d[0] - 1, d[1] - 1, d[0] + 1.2f, d[1] + 1.2f, p);
            float sx = (now / 12f) % (RW + 100) - 50;
            p.setShader(new LinearGradient(sx - 60, 0, sx, 0, 0x0025E3C6, 0x3825E3C6, Shader.TileMode.CLAMP));
            c.drawRect(sx - 60, 0, sx, RH, p);
            p.setShader(null);
            synchronized (rPulses) {
                for (int i = rPulses.size() - 1; i >= 0; i--) if (now - rPulses.get(i).t > 30000) rPulses.remove(i);
                double[] tot = { 0, 0, 0 };
                for (Pulse o : rPulses) {
                    float age = (now - o.t) / 1000f, fade = Math.max(0, 1 - age / 30f);
                    for (int k = 0; k < 3; k++) tot[k] += o.mix[k] * fade * o.fans / 1e5;
                    if (!rFilt.equals("all") && !rFilt.equals(o.dom)) continue;
                    int col = emoColor(o.dom);
                    p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(2);
                    for (int r = 0; r < 3; r++) {
                        float a = ((age * 0.5f) + r / 3f) % 1f;
                        p.setColor(col);
                        p.setAlpha((int) ((1 - a) * 0.8f * Math.max(fade, 0.35f) * 255));
                        c.drawCircle(o.x, o.y, 6 + a * (22 + Math.max(0, (float) (Math.log10(o.fans + 1) - 2) * 7)), p);
                    }
                    p.setStyle(Paint.Style.FILL);
                    p.setColor(col); p.setAlpha((int) (Math.max(fade, 0.4f) * 255));
                    p.setShadowLayer(12, 0, 0, col);
                    c.drawCircle(o.x, o.y, 5, p);
                    p.clearShadowLayer();
                    if (o == rSel) { p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(1.5f); p.setColor(Color.WHITE); c.drawCircle(o.x, o.y, 11, p); }
                    p.setAlpha(255);
                }
                double sum = tot[0] + tot[1] + tot[2];
                if (sum == 0) sum = 1;
                for (int k = 0; k < 3; k++) rSm[k] += (tot[k] / sum * 100 - rSm[k]) * 0.03f;
            }
            c.restore();
            if (radarDlg != null) postInvalidateDelayed(40);
        }
        @Override public boolean onTouchEvent(MotionEvent e) {
            if (e.getAction() == MotionEvent.ACTION_UP && e.getEventTime() - e.getDownTime() < 300) {
                float x = e.getX() / scale, y = e.getY() / scale, bd = 900;
                Pulse best = null;
                synchronized (rPulses) {
                    for (Pulse o : rPulses) {
                        if (!rFilt.equals("all") && !rFilt.equals(o.dom)) continue;
                        float d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
                        if (d < bd) { bd = d; best = o; }
                    }
                }
                if (best != null) rPick(best);
            }
            return true;
        }
    }

    // ---------- الأحداث ----------
    protected void rPush(String city, String match, String ev, String dom, int[] mix, long fans, float x, float y, long age, boolean silent) {
        Pulse o = new Pulse();
        o.x = x; o.y = y; o.t = System.currentTimeMillis() - age; o.dom = dom; o.mix = mix; o.city = city; o.match = match; o.ev = ev; o.fans = fans > 0 ? fans : 20000;
        synchronized (rPulses) { rPulses.add(o); }
        rFeed.add(0, o);
        while (rFeed.size() > 5) rFeed.remove(rFeed.size() - 1);
        rRenderFeed();
        if (!silent) rPick(o);
    }
    protected void rSimulate(long age) {
        String[] c = SIM_CITIES[rnd.nextInt(SIM_CITIES.length)];
        int k = rnd.nextInt(SIM_EVENTS.length);
        int dom = (k == 3 || k == 5) ? 2 : (k == 1 || k == 4 ? 1 : (rnd.nextFloat() < 0.6 ? 0 : 1));
        double[] m = { rnd.nextDouble() * 20, rnd.nextDouble() * 20, rnd.nextDouble() * 20 };
        m[dom] += 45 + rnd.nextDouble() * 30;
        double s = m[0] + m[1] + m[2];
        int[] mix = { (int) Math.round(m[0] / s * 100), (int) Math.round(m[1] / s * 100), (int) Math.round(m[2] / s * 100) };
        float[] xy = proj(Double.parseDouble(c[4]), Double.parseDouble(c[5]));
        String[] doms = { "joy", "hype", "rage" };
        rPush(isAr() ? c[0] : c[1], isAr() ? c[2] : c[3], SIM_EVENTS[k][isAr() ? 0 : 1], doms[dom], mix, Math.round(12000 + rnd.nextDouble() * 470000), xy[0], xy[1], age, age > 0);
    }
    protected void rPick(Pulse o) {
        rSel = o;
        if (rDetail == null) return;
        rDetail.removeAllViews();
        rDetail.setBackground(rbg(0x47000000, emoColor(o.dom), 12));
        rDetail.addView(txt(o.ev + " — " + o.city, Color.WHITE, 13, true));
        rDetail.addView(txt(o.match + " · " + fmtN(o.fans) + " " + L("مشجع متفاعل", "fans reacting"), 0xFFCFD8FF, 12, false));
        rDetail.addView(txt(L("فرح", "Joy") + " " + o.mix[0] + "% · " + L("حماس", "Hype") + " " + o.mix[1] + "% · " + L("غضب", "Anger") + " " + o.mix[2] + "%", Color.WHITE, 12, false), lpm(0, 6, 0, 0));
    }
    protected void rRenderFeed() {
        if (rFeedBox == null) return;
        rFeedBox.removeAllViews();
        for (Pulse o : rFeed) {
            LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.setPadding(0, dp(10), 0, dp(10));
            TextView ic = txt("joy".equals(o.dom) ? "😍" : "hype".equals(o.dom) ? "🔥" : "😡", Color.WHITE, 17, false);
            ic.setGravity(Gravity.CENTER);
            ic.setBackground(rbg(0x1FF5C35A, (emoColor(o.dom) & 0x00FFFFFF) | 0x66000000, 18));
            r.addView(ic, new LinearLayout.LayoutParams(dp(36), dp(36)));
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setPadding(dp(10), 0, dp(10), 0);
            col.addView(txt(o.ev, Color.WHITE, 13, true));
            col.addView(txt(o.city, MUTED, 12, false));
            r.addView(col, lpw(1f));
            r.addView(txt(fmtN(o.fans), GOLD, 12, false));
            rFeedBox.addView(r);
        }
    }

    // ---------- البيانات الحقيقية (استطلاع دوري بدل Realtime) ----------
    protected void rLoadMatches() {
        try {
            JSONArray a = new JSONArray(get("matches?select=*&status=neq.FINISHED&order=match_date.asc"));
            final List<JSONObject> live = new ArrayList<JSONObject>();
            for (int i = 0; i < a.length(); i++) if (rIsLive(a.getJSONObject(i))) live.add(a.getJSONObject(i));
            if (!live.isEmpty()) {
                List<String> ids = new ArrayList<String>();
                for (JSONObject m : live) ids.add(m.optString("id"));
                JSONArray pr = new JSONArray(get("match_pulse?select=*&match_id=in.(" + android.text.TextUtils.join(",", ids) + ")"));
                for (int i = 0; i < pr.length(); i++) rLast.put(pr.getJSONObject(i).optString("match_id"), snap(pr.getJSONObject(i)));
            }
            runOnUiThread(new Runnable() { @Override public void run() {
                rMatches.clear(); rMatches.addAll(live); rById.clear();
                for (JSONObject m : live) rById.put(m.optString("id"), m);
                if (!live.isEmpty() && (rCurr == null || !rById.containsKey(rCurr))) rSelectMatch(live.get(0).optString("id"));
                else rRenderChips();
            } });
        } catch (Exception ignore) {}
    }
    protected double[] snap(JSONObject x) {
        return new double[] { x.optDouble("joy", 0), x.optDouble("hype", 0), x.optDouble("rage", 0),
            x.optDouble("a_joy", 0), x.optDouble("a_hype", 0), x.optDouble("a_rage", 0), x.optDouble("b_joy", 0), x.optDouble("b_hype", 0), x.optDouble("b_rage", 0) };
    }
    protected void rPollPulse() {
        if (rMatches.isEmpty()) return;
        try {
            List<String> ids = new ArrayList<String>();
            for (JSONObject m : rMatches) ids.add(m.optString("id"));
            JSONArray pr = new JSONArray(get("match_pulse?select=*&match_id=in.(" + android.text.TextUtils.join(",", ids) + ")"));
            for (int i = 0; i < pr.length(); i++) {
                JSONObject row = pr.getJSONObject(i);
                String id = row.optString("match_id");
                double[] prev = rLast.get(id), cur = snap(row);
                rLast.put(id, cur);
                if (prev == null) continue;
                double[] acc = rAcc.get(id);
                if (acc == null) { acc = new double[9]; rAcc.put(id, acc); }
                for (int k = 0; k < 3; k++) {
                    double da = Math.max(0, cur[3 + k] - prev[3 + k]), db = Math.max(0, cur[6 + k] - prev[6 + k]), dt = Math.max(0, cur[k] - prev[k]);
                    acc[k] += da; acc[3 + k] += db; acc[6 + k] += Math.max(0, dt - da - db);
                }
            }
            runOnUiThread(new Runnable() { @Override public void run() { rRenderTeams(); } });
        } catch (Exception ignore) {}
    }
    protected void rPollEvents(boolean first) {
        try {
            String since = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US) {{ setTimeZone(TimeZone.getTimeZone("UTC")); }}.format(new Date(System.currentTimeMillis() - 30 * 60000L));
            JSONArray a = new JSONArray(get("match_events?select=*&created_at=gte." + since + "&order=created_at.asc&limit=12"));
            for (int i = 0; i < a.length(); i++) {
                final JSONObject e = a.getJSONObject(i);
                String k = e.optString("id", e.optString("created_at"));
                if (!rSeenEv.add(k)) continue;
                final long age = System.currentTimeMillis() - isoMs(e.optString("created_at"));
                final boolean quiet = first;
                runOnUiThread(new Runnable() { @Override public void run() { rOnEvent(e, quiet ? age : 0); } });
            }
        } catch (Exception ignore) {}
    }
    protected void rOnEvent(JSONObject e, long age) {
        String type = e.optString("type"), ar, en; int[] mix;
        if (type.equals("goal")) { ar = "هدف!"; en = "Goal!"; mix = new int[] { 62, 30, 8 }; }
        else if (type.equals("red_card")) { ar = "بطاقة حمراء"; en = "Red card"; mix = new int[] { 10, 20, 70 }; }
        else if (type.equals("penalty")) { ar = "ركلة جزاء"; en = "Penalty"; mix = new int[] { 20, 65, 15 }; }
        else if (type.equals("var")) { ar = "مراجعة VAR"; en = "VAR check"; mix = new int[] { 10, 45, 45 }; }
        else if (type.equals("kickoff")) { ar = "انطلقت المباراة"; en = "Kick-off"; mix = new int[] { 25, 65, 10 }; }
        else if (type.equals("fulltime")) { ar = "نهاية المباراة"; en = "Full time"; mix = new int[] { 35, 40, 25 }; }
        else return;
        JSONObject m = rById.get(e.optString("match_id"));
        if (m == null) { m = new JSONObject(); try { m.put("team_a", e.optString("home")).put("team_b", e.optString("away")); } catch (Exception ignore) {} }
        float[] xy = matchXY(m, null);
        double[] l = rLast.get(e.optString("match_id"));
        long taps = l == null ? 0 : (long) (l[0] + l[1] + l[2]);
        String score = (!e.isNull("score_home") && !e.isNull("score_away")) ? " " + e.optInt("score_home") + "-" + e.optInt("score_away") : "";
        int d = mix[0] >= mix[1] && mix[0] >= mix[2] ? 0 : (mix[1] >= mix[2] ? 1 : 2);
        rPush(e.optString("team", e.optString("home")), e.optString("home") + " × " + e.optString("away"),
            (isAr() ? ar : en) + (e.optInt("minute", 0) > 0 ? " " + e.optInt("minute") + "’" : "") + score, new String[] { "joy", "hype", "rage" }[d], mix, Math.max(3000, taps), xy[0], xy[1], age, age > 0);
    }
    protected void rDrain() {
        for (Map.Entry<String, double[]> en : rAcc.entrySet()) {
            JSONObject m = rById.get(en.getKey());
            if (m == null) continue;
            double[] acc = en.getValue();
            for (int s = 0; s < 3; s++) {
                double j = acc[s * 3], h = acc[s * 3 + 1], r = acc[s * 3 + 2], sum = j + h + r;
                if (sum <= 0) continue;
                acc[s * 3] = acc[s * 3 + 1] = acc[s * 3 + 2] = 0;
                int[] mix = { (int) Math.round(j / sum * 100), (int) Math.round(h / sum * 100), (int) Math.round(r / sum * 100) };
                int d = mix[0] >= mix[1] && mix[0] >= mix[2] ? 0 : (mix[1] >= mix[2] ? 1 : 2);
                String[] doms = { "joy", "hype", "rage" };
                String who = s == 0 ? L("مشجعو ", "Fans of ") + teamName(m.optString("team_a")) : s == 1 ? L("مشجعو ", "Fans of ") + teamName(m.optString("team_b")) : L("جمهور محايد", "Neutral fans");
                float[] xy = matchXY(m, s == 0 ? "a" : s == 1 ? "b" : null);
                rPush(who, teamName(m.optString("team_a")) + " × " + teamName(m.optString("team_b")), emoName(doms[d]), doms[d], mix, (long) sum, xy[0], xy[1], 0, true);
            }
        }
    }
    // ضغطات المشجع: تُرسل كل ~1.2 ثانية، فريق واحد في كل دورة
    protected void rFlush() {
        if (rCurr == null) return;
        int side = -1;
        for (int s = 0; s < 3; s++) if (rPend[s][0] + rPend[s][1] + rPend[s][2] > 0) { side = s; break; }
        if (side < 0) return;
        final int[] n = { rPend[side][0], rPend[side][1], rPend[side][2] };
        rPend[side] = new int[3];
        final String sd = side == 0 ? "a" : side == 1 ? "b" : "n";
        try {
            JSONObject b = new JSONObject().put("p_match", rCurr).put("p_joy", n[0]).put("p_hype", n[1]).put("p_rage", n[2]);
            try { rpc("cast_pulse", new JSONObject(b.toString()).put("p_side", sd).toString()); }
            catch (Exception e) {
                String m = String.valueOf(e.getMessage());
                if (m.matches("(?is).*(p_side|could not find the function|PGRST202).*")) rpc("cast_pulse", b.toString()); else throw e;
            }
        } catch (Exception e) { runOnUiThread(new Runnable() { @Override public void run() { toast(L("تعذّر إرسال تفاعلك", "Could not send your reaction")); } }); }
    }

    // ---------- الواجهة ----------
    protected final Runnable rUiTick = new Runnable() {
        @Override public void run() {
            if (radarDlg == null) return;
            long tot = 0;
            synchronized (rPulses) { for (Pulse o : rPulses) tot += o.fans; }
            if (rFans != null) rFans.setText(fmtN(tot));
            float[] w = rSm;
            if (rBj != null) { ((LinearLayout.LayoutParams) rBj.getLayoutParams()).weight = Math.max(0.01f, w[0]); ((LinearLayout.LayoutParams) rBh.getLayoutParams()).weight = Math.max(0.01f, w[1]); ((LinearLayout.LayoutParams) rBr.getLayoutParams()).weight = Math.max(0.01f, w[2]); ((View) rBj.getParent()).requestLayout(); }
            if (rPj != null) { rPj.setText(Math.round(w[0]) + "%"); rPh.setText(Math.round(w[1]) + "%"); rPr.setText(Math.round(w[2]) + "%"); }
            timerH.postDelayed(this, 400);
        }
    };
    protected final Runnable rPoll = new Runnable() {
        @Override public void run() {
            if (radarDlg == null) return;
            if (!rDemo) pool.execute(new Runnable() { @Override public void run() { rFlush(); rPollPulse(); } });
            rDrain();
            timerH.postDelayed(this, 1500);
        }
    };
    protected final Runnable rSlow = new Runnable() {
        @Override public void run() {
            if (radarDlg == null) return;
            if (!rDemo) pool.execute(new Runnable() { @Override public void run() { rPollEvents(false); rLoadMatches(); } });
            timerH.postDelayed(this, 20000);
        }
    };
    protected final Runnable rSimTick = new Runnable() {
        @Override public void run() { if (radarDlg == null || !rDemo) return; rSimulate(0); timerH.postDelayed(this, 4500); }
    };

    protected void openFanRadar() {
        if (radarDlg != null) { try { radarDlg.dismiss(); } catch (Exception ignore) {} }
        synchronized (rPulses) { rPulses.clear(); }
        rFeed.clear(); rSel = null; rFilt = "all"; rLast.clear(); rAcc.clear(); rById.clear(); rMatches.clear(); rCurr = null; rSide = null;
        rPend[0] = new int[3]; rPend[1] = new int[3]; rPend[2] = new int[3]; rDemo = false; rSm = new float[] { 33, 34, 33 }; rSeenEv = new HashSet<String>();
        final Dialog d = sheetDialog(true);
        radarDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), statusH() + dp(6), dp(18), navH() + dp(30));
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        LinearLayout tt = new LinearLayout(this);
        tt.setOrientation(LinearLayout.VERTICAL);
        tt.setPadding(dp(12), 0, 0, 0);
        tt.addView(txt(L("رادار نبض المشجعين", "Fan Pulse Radar"), Color.WHITE, 19, true));
        LinearLayout lv = new LinearLayout(this);
        lv.setGravity(Gravity.CENTER_VERTICAL);
        lv.addView(txt("● " + L("مباشر", "Live") + " · ", 0xFF14F195, 11, true));
        rFans = txt("0", Color.WHITE, 11, true);
        lv.addView(rFans);
        lv.addView(txt(" " + L("تفاعل", "reactions"), MUTED, 11, false));
        tt.addView(lv);
        top.addView(tt, lpw(1f));
        root.addView(top);
        rMatchBox = new LinearLayout(this);
        rMatchBox.setOrientation(LinearLayout.VERTICAL);
        root.addView(rMatchBox, lpm(0, 12, 0, 0));

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(12), dp(12), dp(12), dp(12));
        box.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20));
        LinearLayout chips = new LinearLayout(this);
        final String[][] fl = { { "all", L("الكل", "All") }, { "joy", L("فرح", "Joy") }, { "hype", L("حماس", "Hype") }, { "rage", L("غضب", "Anger") } };
        final TextView[] cs = new TextView[4];
        for (int i = 0; i < 4; i++) {
            final int fi = i;
            cs[i] = txt(fl[i][1], GOLD, 12, true);
            cs[i].setPadding(dp(13), dp(5), dp(13), dp(5));
            cs[i].setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                rFilt = fl[fi][0];
                for (int q = 0; q < 4; q++) { int col = q == 0 ? GOLD : emoColor(fl[q][0]); boolean on = fl[q][0].equals(rFilt); cs[q].setTextColor(on ? NAVY : col); cs[q].setBackground(rbg(on ? col : 0x00000000, col, 20)); }
            } });
            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cp.setMargins(0, 0, dp(7), 0);
            chips.addView(cs[i], cp);
        }
        cs[0].performClick();
        box.addView(chips, lpm(0, 0, 0, 10));
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        hs.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        rMap = new RadarMap();
        hs.addView(rMap);
        hs.setBackground(rbg(0xFF070C2B, 0x0FFFFFFF, 14));
        box.addView(hs);
        rDetail = new LinearLayout(this);
        rDetail.setOrientation(LinearLayout.VERTICAL);
        rDetail.setPadding(dp(12), dp(9), dp(12), dp(9));
        rDetail.setBackground(rbg(0x47000000, 0x00000000, 12));
        rDetail.addView(txt(L("اضغط على أي نبضة في الخريطة", "Tap any pulse on the map"), Color.WHITE, 13, true));
        rDetail.addView(txt(L("ستظهر تفاصيل الحدث ونسب مشاعر الجمهور.", "See the event and the crowd's emotion mix."), 0xFFCFD8FF, 12, false));
        box.addView(rDetail, lpm(0, 10, 0, 0));
        root.addView(box, lpm(0, 12, 0, 0));

        rSideBox = new LinearLayout(this);
        rSideBox.setOrientation(LinearLayout.VERTICAL);
        root.addView(rSideBox, lpm(0, 14, 0, 0));
        root.addView(txt(L("كيف تشعر الآن؟", "How do you feel?"), Color.WHITE, 15, true), lpm(0, 14, 0, 8));
        rVote = new LinearLayout(this);
        rVote.setAlpha(0.45f);
        String[][] vb = { { "joy", "😍", L("فرح", "Joy") }, { "hype", "🔥", L("حماس", "Hype") }, { "rage", "😡", L("غضب", "Anger") } };
        for (final String[] b : vb) {
            LinearLayout v = new LinearLayout(this);
            v.setOrientation(LinearLayout.VERTICAL);
            v.setGravity(Gravity.CENTER);
            v.setPadding(dp(4), dp(14), dp(4), dp(12));
            int col = emoColor(b[0]);
            v.setBackground(rbg((col & 0x00FFFFFF) | 0x1F000000, (col & 0x00FFFFFF) | 0x8C000000, 18));
            v.addView(txt(b[1], col, 28, false));
            v.addView(txt(b[2], col, 14, true));
            v.addView(txt(L("اضغط للتفاعل", "tap to react"), MUTED, 10, false));
            v.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View x) { rTap(b[0]); } });
            LinearLayout.LayoutParams vp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            vp.setMargins(dp(5), 0, dp(5), 0);
            rVote.addView(v, vp);
        }
        root.addView(rVote);

        LinearLayout g = new LinearLayout(this);
        g.setOrientation(LinearLayout.VERTICAL);
        g.setPadding(dp(14), dp(14), dp(14), dp(14));
        g.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20));
        g.addView(txt(L("مزاج الجماهير حول العالم الآن", "Global fan mood right now"), Color.WHITE, 15, true), lpm(0, 0, 0, 10));
        LinearLayout bar = new LinearLayout(this);
        bar.setWeightSum(100);
        rBj = new View(this); rBh = new View(this); rBr = new View(this);
        rBj.setBackgroundColor(C_JOY); rBh.setBackgroundColor(C_HYPE); rBr.setBackgroundColor(C_RAGE);
        bar.addView(rBj, new LinearLayout.LayoutParams(0, dp(14), 33));
        bar.addView(rBh, new LinearLayout.LayoutParams(0, dp(14), 34));
        bar.addView(rBr, new LinearLayout.LayoutParams(0, dp(14), 33));
        g.addView(bar);
        LinearLayout lg = new LinearLayout(this);
        rPj = txt("0%", C_JOY, 17, true); rPh = txt("0%", C_HYPE, 17, true); rPr = txt("0%", C_RAGE, 17, true);
        TextView[] ps = { rPj, rPh, rPr }; String[] pn = { emoName("joy"), emoName("hype"), emoName("rage") }; int[] pc = { C_JOY, C_HYPE, C_RAGE };
        for (int i = 0; i < 3; i++) {
            LinearLayout c = new LinearLayout(this);
            c.setGravity(Gravity.CENTER_VERTICAL);
            c.addView(ps[i]);
            c.addView(txt(" " + pn[i], pc[i], 12, true));
            lg.addView(c, lpw(1f));
        }
        g.addView(lg, lpm(0, 10, 0, 0));
        root.addView(g, lpm(0, 12, 0, 0));

        LinearLayout tc = new LinearLayout(this);
        tc.setOrientation(LinearLayout.VERTICAL);
        tc.setPadding(dp(14), dp(14), dp(14), dp(10));
        tc.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20));
        tc.addView(txt(L("مزاج جمهور كل فريق", "Mood of each team's fans"), Color.WHITE, 15, true), lpm(0, 0, 0, 10));
        rTeamsBox = new LinearLayout(this);
        rTeamsBox.setOrientation(LinearLayout.VERTICAL);
        tc.addView(rTeamsBox);
        root.addView(tc, lpm(0, 12, 0, 0));

        LinearLayout fc = new LinearLayout(this);
        fc.setOrientation(LinearLayout.VERTICAL);
        fc.setPadding(dp(14), dp(14), dp(14), dp(4));
        fc.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20));
        fc.addView(txt(L("آخر الأحداث", "Latest events"), Color.WHITE, 15, true), lpm(0, 0, 0, 6));
        rFeedBox = new LinearLayout(this);
        rFeedBox.setOrientation(LinearLayout.VERTICAL);
        fc.addView(rFeedBox);
        root.addView(fc, lpm(0, 12, 0, 0));

        ScrollView sc = new ScrollView(this);
        sc.addView(root);
        d.setContentView(sc);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { radarDlg = null; timerH.removeCallbacks(rUiTick); timerH.removeCallbacks(rPoll); timerH.removeCallbacks(rSlow); timerH.removeCallbacks(rSimTick); }
        });
        d.show();
        rRenderChips(); rRenderTeams();
        timerH.postDelayed(rUiTick, 400);
        timerH.postDelayed(rPoll, 1500);
        timerH.postDelayed(rSlow, 20000);
        pool.execute(new Runnable() { @Override public void run() { rLoadMatches(); rPollEvents(true); } });
    }

    protected void rRenderChips() {
        if (rMatchBox == null) return;
        rMatchBox.removeAllViews();
        if (rMatches.isEmpty()) {
            LinearLayout c = new LinearLayout(this);
            c.setGravity(Gravity.CENTER_VERTICAL);
            c.setPadding(dp(12), dp(10), dp(12), dp(10));
            c.setBackground(rbg(0x0DFFFFFF, 0x6614F195, 20));
            c.addView(txt(L("لا توجد مباريات الآن.", "No matches right now."), MUTED, 14, false), lpw(1f));
            rMatchBox.addView(c);
            return;
        }
        JSONObject m = rById.get(rCurr) != null ? rById.get(rCurr) : rMatches.get(0);
        String h = !m.isNull("live_home") ? m.optString("live_home") : (m.isNull("home_score") ? "-" : m.optString("home_score"));
        String a = !m.isNull("live_away") ? m.optString("live_away") : (m.isNull("away_score") ? "-" : m.optString("away_score"));
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(12), dp(10), dp(12), dp(10));
        c.setBackground(rbg(0x0DFFFFFF, 0x6614F195, 20));
        c.addView(txt("● " + L("مباراة مباشرة الآن", "Live now"), 0xFF14F195, 11, true));
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView t1 = txt(teamName(m.optString("team_a")), Color.WHITE, 14, true), sc = txt(h + " - " + a, 0xFF14F195, 22, true), t2 = txt(teamName(m.optString("team_b")), Color.WHITE, 14, true);
        t1.setGravity(Gravity.CENTER); t2.setGravity(Gravity.CENTER); sc.setGravity(Gravity.CENTER);
        row.addView(t1, lpw(1f)); row.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)); row.addView(t2, lpw(1f));
        c.addView(row, lpm(0, 6, 0, 0));
        rMatchBox.addView(c);
        if (rMatches.size() > 1) {
            LinearLayout cr = new LinearLayout(this);
            HorizontalScrollView hs = new HorizontalScrollView(this);
            hs.setHorizontalScrollBarEnabled(false);
            for (final JSONObject x : rMatches) {
                boolean on = x.optString("id").equals(rCurr);
                TextView ch = txt(teamName(x.optString("team_a")) + " × " + teamName(x.optString("team_b")), on ? NAVY : GOLD, 12, true);
                ch.setPadding(dp(13), dp(5), dp(13), dp(5));
                ch.setBackground(rbg(on ? GOLD : 0x00000000, GOLD, 20));
                ch.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rSelectMatch(x.optString("id")); } });
                LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                cp.setMargins(0, 0, dp(8), 0);
                cr.addView(ch, cp);
            }
            hs.addView(cr);
            rMatchBox.addView(hs, lpm(0, 8, 0, 0));
        }
    }
    protected void rSelectMatch(String id) {
        rCurr = id;
        String v = getSharedPreferences("zn_radar", MODE_PRIVATE).getString("side_" + id, null);
        rSide = v;
        rRenderChips(); rRenderSide(); rRenderTeams();
        if (rVote != null) rVote.setAlpha(rSide == null ? 0.45f : 1f);
    }
    protected void rRenderSide() {
        if (rSideBox == null) return;
        rSideBox.removeAllViews();
        JSONObject m = rById.get(rCurr);
        if (m == null) return;
        rSideBox.addView(txt(L("مع أي فريق أنت؟", "Which side are you on?"), Color.WHITE, 15, true), lpm(0, 0, 0, 8));
        LinearLayout r = new LinearLayout(this);
        String[][] bs = { { "a", teamName(m.optString("team_a")) }, { "b", teamName(m.optString("team_b")) }, { "n", L("محايد", "Neutral") } };
        for (final String[] b : bs) {
            boolean on = b[0].equals(rSide);
            TextView t = txt(b[1], on ? NAVY : 0xFFCFD8FF, 13, true);
            t.setGravity(Gravity.CENTER);
            t.setPadding(dp(4), dp(11), dp(4), dp(11));
            if (on) { GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFE7AD, GOLD }); g.setCornerRadius(dp(14)); t.setBackground(g); }
            else t.setBackground(rbg(0x0FFFFFFF, 0x1FFFFFFF, 14));
            t.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                rSide = b[0];
                getSharedPreferences("zn_radar", MODE_PRIVATE).edit().putString("side_" + rCurr, rSide).apply();
                rRenderSide(); rVote.setAlpha(1f);
            } });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            p.setMargins(dp(4), 0, dp(4), 0);
            r.addView(t, p);
        }
        rSideBox.addView(r);
    }
    protected void rRenderTeams() {
        if (rTeamsBox == null) return;
        rTeamsBox.removeAllViews();
        JSONObject m = rById.get(rCurr);
        double[] l = rLast.get(rCurr);
        if (m == null || l == null) { rTeamsBox.addView(txt(L("اختر مباراة مباشرة.", "Pick a live match."), MUTED, 13, false)); return; }
        rTeamBlock(L("مشجعو ", "Fans of ") + teamName(m.optString("team_a")), l[3], l[4], l[5]);
        rTeamBlock(L("مشجعو ", "Fans of ") + teamName(m.optString("team_b")), l[6], l[7], l[8]);
    }
    protected void rTeamBlock(String name, double j, double h, double r) {
        double sum = j + h + r;
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(0, 0, 0, dp(12));
        LinearLayout nr = new LinearLayout(this);
        nr.addView(txt(name, Color.WHITE, 13, true));
        if (sum > 0) nr.addView(txt("  " + fmtN((long) sum), MUTED, 11, false));
        b.addView(nr);
        if (sum <= 0) { b.addView(txt(L("لا تفاعل بعد", "No reactions yet"), MUTED, 13, false)); rTeamsBox.addView(b); return; }
        LinearLayout bar = new LinearLayout(this);
        bar.setWeightSum(100);
        double[] v = { j, h, r }; int[] cl = { C_JOY, C_HYPE, C_RAGE };
        for (int i = 0; i < 3; i++) { View x = new View(this); x.setBackgroundColor(cl[i]); bar.addView(x, new LinearLayout.LayoutParams(0, dp(10), (float) (v[i] / sum * 100))); }
        b.addView(bar, lpm(0, 6, 0, 0));
        LinearLayout lg = new LinearLayout(this);
        String[] n = { "joy", "hype", "rage" };
        for (int i = 0; i < 3; i++) lg.addView(txt(emoName(n[i]) + " " + Math.round(v[i] / sum * 100) + "%", cl[i], 11, false), lpw(1f));
        b.addView(lg, lpm(0, 5, 0, 0));
        rTeamsBox.addView(b);
    }
    protected void rTap(String emotion) {
        if (rCurr == null) { toast(L("اختر مباراة مباشرة أولاً", "Pick a live match first")); return; }
        if (rSide == null) { toast(L("اختر فريقك أولاً", "Pick your side first")); return; }
        int s = rSide.equals("a") ? 0 : rSide.equals("b") ? 1 : 2;
        rPend[s][emotion.equals("joy") ? 0 : emotion.equals("hype") ? 1 : 2]++;
        try { ((android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE)).vibrate(12); } catch (Exception ignore) {}
    }
}
