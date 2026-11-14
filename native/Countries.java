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

abstract class Countries extends Auth {
    // ===== من countries.js: أسماء الدول/الدوريات حسب العلم =====
    protected static final String[][] COUNTRY_NAMES = {
        { "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "إنجلترا", "England" }, { "🇪🇸", "إسبانيا", "Spain" }, { "🇩🇪", "ألمانيا", "Germany" },
        { "🇮🇹", "إيطاليا", "Italy" }, { "🇫🇷", "فرنسا", "France" }, { "🇧🇷", "البرازيل", "Brazil" },
        { "🇦🇷", "الأرجنتين", "Argentina" }, { "🇵🇹", "البرتغال", "Portugal" }, { "🇳🇱", "هولندا", "Netherlands" },
        { "🇧🇪", "بلجيكا", "Belgium" }, { "🇺🇾", "الأوروغواي", "Uruguay" }, { "🇨🇴", "كولومبيا", "Colombia" },
        { "🇲🇽", "المكسيك", "Mexico" }, { "🇺🇸", "أمريكا", "USA" }, { "🇨🇦", "كندا", "Canada" },
        { "🇯🇵", "اليابان", "Japan" }, { "🇰🇷", "كوريا الجنوبية", "South Korea" }, { "🇸🇦", "السعودية", "Saudi Arabia" },
        { "🇦🇪", "الإمارات", "UAE" }, { "🇶🇦", "قطر", "Qatar" },
        { "🇲🇦", "المغرب", "Morocco" }, { "🇪🇬", "مصر", "Egypt" }, { "🇹🇳", "تونس", "Tunisia" },
        { "🇩🇿", "الجزائر", "Algeria" }, { "🇮🇷", "إيران", "Iran" }, { "🇮🇶", "العراق", "Iraq" },
        { "🇦🇺", "أستراليا", "Australia" }, { "🇭🇷", "كرواتيا", "Croatia" }, { "🇨🇭", "سويسرا", "Switzerland" },
        { "🇩🇰", "الدنمارك", "Denmark" }, { "🇵🇱", "بولندا", "Poland" }, { "🇷🇸", "صربيا", "Serbia" },
        { "🇦🇹", "النمسا", "Austria" }, { "🇹🇷", "تركيا", "Turkey" }, { "🇬🇷", "اليونان", "Greece" },
        { "🇸🇪", "السويد", "Sweden" }, { "🇳🇴", "النرويج", "Norway" }, { "🇭🇺", "المجر", "Hungary" },
        { "🇪🇨", "الإكوادور", "Ecuador" }, { "🇨🇱", "تشيلي", "Chile" }, { "🇵🇾", "باراغواي", "Paraguay" },
        { "🇵🇪", "بيرو", "Peru" }, { "🇳🇬", "نيجيريا", "Nigeria" }, { "🇬🇭", "غانا", "Ghana" },
        { "🇸🇳", "السنغال", "Senegal" }, { "🇨🇲", "الكاميرون", "Cameroon" }, { "🇨🇮", "ساحل العاج", "Ivory Coast" },
        { "🇸🇾", "سوريا", "Syria" },
        { "🇴🇲", "عُمان", "Oman" }, { "🇱🇾", "ليبيا", "Libya" }, { "🇯🇴", "الأردن", "Jordan" },
        { "🇺🇦", "أوكرانيا", "Ukraine" }, { "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "اسكتلندا", "Scotland" }
    };

    // علم سوريا في الويب صورة (<img>) وليس إيموجي، فنتعرّف عليه من الرابط
    protected static final String SYRIA_FLAG_URL = "https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Syria_(2025-).svg";

    protected String getCountryName(String flag, boolean ar) {
        if (flag != null && flag.indexOf("Flag_of_Syria") >= 0) return ar ? "سوريا" : "Syria";
        for (String[] c : COUNTRY_NAMES) if (c[0].equals(flag)) return ar ? c[1] : c[2];
        return (ar ? "دوري " : "League ") + (flag == null ? "" : flag);
    }
}
