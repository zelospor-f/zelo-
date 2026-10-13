const countryNames = {
    "🏴󠁧󠁢󠁥󠁮󠁧󠁿": {ar: "إنجلترا", en: "England"}, "🇪🇸": {ar: "إسبانيا", en: "Spain"}, "🇩🇪": {ar: "ألمانيا", en: "Germany"},
    "🇮🇹": {ar: "إيطاليا", en: "Italy"}, "🇫🇷": {ar: "فرنسا", en: "France"}, "🇧🇷": {ar: "البرازيل", en: "Brazil"},
    "🇦🇷": {ar: "الأرجنتين", en: "Argentina"}, "🇵🇹": {ar: "البرتغال", en: "Portugal"}, "🇳🇱": {ar: "هولندا", en: "Netherlands"},
    "🇧🇪": {ar: "بلجيكا", en: "Belgium"}, "🇺🇾": {ar: "الأوروغواي", en: "Uruguay"}, "🇨🇴": {ar: "كولومبيا", en: "Colombia"},
    "🇲🇽": {ar: "المكسيك", en: "Mexico"}, "🇺🇸": {ar: "أمريكا", en: "USA"}, "🇨🇦": {ar: "كندا", en: "Canada"},
    "🇯🇵": {ar: "اليابان", en: "Japan"}, "🇰🇷": {ar: "كوريا الجنوبية", en: "South Korea"}, "🇸🇦": {ar: "السعودية", en: "Saudi Arabia"},
    "🇦🇪": {ar: "الإمارات", en: "UAE"}, "🇶🇦": {ar: "قطر", en: "Qatar"},
    "🇲🇦": {ar: "المغرب", en: "Morocco"}, "🇪🇬": {ar: "مصر", en: "Egypt"}, "🇹🇳": {ar: "تونس", en: "Tunisia"},
    "🇩🇿": {ar: "الجزائر", en: "Algeria"}, "🇮🇷": {ar: "إيران", en: "Iran"}, "🇮🇶": {ar: "العراق", en: "Iraq"},
    "🇦🇺": {ar: "أستراليا", en: "Australia"}, "🇭🇷": {ar: "كرواتيا", en: "Croatia"}, "🇨🇭": {ar: "سويسرا", en: "Switzerland"},
    "🇩🇰": {ar: "الدنمارك", en: "Denmark"}, "🇵🇱": {ar: "بولندا", en: "Poland"}, "🇷🇸": {ar: "صربيا", en: "Serbia"},
    "🇦🇹": {ar: "النمسا", en: "Austria"}, "🇹🇷": {ar: "تركيا", en: "Turkey"}, "🇬🇷": {ar: "اليونان", en: "Greece"},
    "🇸🇪": {ar: "السويد", en: "Sweden"}, "🇳🇴": {ar: "النرويج", en: "Norway"}, "🇭🇺": {ar: "المجر", en: "Hungary"},
    "🇪🇨": {ar: "الإكوادور", en: "Ecuador"}, "🇨🇱": {ar: "تشيلي", en: "Chile"}, "🇵🇾": {ar: "باراغواي", en: "Paraguay"},
    "🇵🇪": {ar: "بيرو", en: "Peru"}, "🇳🇬": {ar: "نيجيريا", en: "Nigeria"}, "🇬🇭": {ar: "غانا", en: "Ghana"},
    "🇸🇳": {ar: "السنغال", en: "Senegal"}, "🇨🇲": {ar: "الكاميرون", en: "Cameroon"}, "🇨🇮": {ar: "ساحل العاج", en: "Ivory Coast"},
    "<img src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Flag_of_Syria_%281932%E2%80%931958%3B_1961%E2%80%931963%29.svg/320px-Flag_of_Syria_%281932%E2%80%931958%3B_1961%E2%80%931963%29.svg.png' style='width: 22px; height: 14px; border-radius: 2px; object-fit: cover; vertical-align: middle; margin: 0 4px;'>": {ar: "سوريا", en: "Syria"},
    "🇴🇲": {ar: "عُمان", en: "Oman"},
    "🇱🇾": {ar: "ليبيا", en: "Libya"},
    "🇯🇴": {ar: "الأردن", en: "Jordan"},
    "🇺🇦": {ar: "أوكرانيا", en: "Ukraine"},
    "🏴󠁧󠁢󠁳󠁣󠁴󠁿": {ar: "اسكتلندا", en: "Scotland"}
};

function getCountryName(flag) {
    if(countryNames[flag]) return userState.lang === 'ar' ? countryNames[flag].ar : countryNames[flag].en;
    return (userState.lang === 'ar' ? "دوري " : "League ") + flag;
                                                                                       }
