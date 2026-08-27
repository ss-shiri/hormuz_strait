/* =========================================================================
   Hormuz OSINT Monitor  ·  front-end
   Reads docs/data/feed.json, renders the newspaper, handles language / theme
   / filters. No framework. Persists UI language + theme in localStorage.
   ========================================================================= */
(function () {
  "use strict";

  var DATA_URL = "data/feed.json";

  /* ---------------------------------------------------------------- i18n -- */
  var I18N = {
    fa: {
      dir: "rtl",
      promoLabel: "منتشرشده توسط",
      eyebrow: "پایش اطلاعاتی منبع‌باز · CBRNE OSINT",
      title: "روزنامهٔ رصد تنگهٔ هرمز",
      tagline: "اخبار، مقالات و پست‌های عمومی — لحظه به لحظه",
      place: "خلیج فارس · تنگهٔ هرمز",
      editionLabel: "شمارهٔ",
      updatedLabel: "آخرین به‌روزرسانی:",
      unverifiedSeal: "راستی‌آزمایی‌نشده",
      disclaimer: "این یک فید <b>جمع‌آوری خودکار منبع‌باز</b> است. تمام موارد بدون راستی‌آزمایی گردآوری می‌شوند و صحت آن‌ها تأیید نشده است. برچسب اطمینان فقط اعتبارِ تاریخیِ «منبع» را نشان می‌دهد، نه درستیِ خبر.",
      langLabel: "زبان", confLabel: "اطمینان", feedLangLabel: "زبانِ خبر",
      fAll: "همه", cHigh: "بالا", cMed: "متوسط", cLow: "پایین",
      searchPh: "جست‌وجو…",
      night: "شب", day: "روز",
      countTpl: "{n} مورد گردآوری‌شده", showing: "نمایش {n}",
      newRun: "{n} مورد در آخرین اجرا", failed: "{n} منبع ناموفق",
      emptyTitle: "موردی برای نمایش نیست",
      emptyBody: "هنوز خبری مطابق فیلترها گردآوری نشده است. به‌زودی به‌روزرسانی می‌شود.",
      legendTitle: "راهنمای برچسب اطمینانِ منبع",
      footNote: "مدل اعتبارِ منبع بر پایهٔ مقیاس اعتبارِ منبعِ آدمیرالتی (A بهترین تا F نامشخص) است و صرفاً جایگاهِ تاریخیِ رسانه را می‌سنجد. این ابزار «جمع‌آوری» می‌کند، «راستی‌آزمایی» نمی‌کند.",
      builtBy: "تهیه و پایش:",
      relHigh: "بالا", relMed: "متوسط", relLow: "پایین",
      source: "منبع", go: "متن اصلی ↵",
      cat: { news: "خبر", social: "شبکهٔ اجتماعی", maritime: "دریایی", official: "رسمی" },
      now: "هم‌اکنون", min: "دقیقه پیش", hour: "ساعت پیش", day2: "روز پیش",
    },
    ar: {
      dir: "rtl",
      promoLabel: "إعداد ونشر",
      eyebrow: "رصد استخباري مفتوح المصدر · CBRNE OSINT",
      title: "جريدة رصد مضيق هرمز",
      tagline: "أخبار ومقالات ومنشورات عامة — لحظة بلحظة",
      place: "الخليج العربي · مضيق هرمز",
      editionLabel: "العدد",
      updatedLabel: "آخر تحديث:",
      unverifiedSeal: "غير مُتحقَّق",
      disclaimer: "هذه خلاصة <b>تجميع آلي مفتوح المصدر</b>. تُجمع كل المواد دون تحقّق، ولم تُثبت صحتها. وسم الثقة يعكس فقط المكانة التاريخية «للمصدر»، لا صحّة الخبر.",
      langLabel: "اللغة", confLabel: "الثقة", feedLangLabel: "لغة الخبر",
      fAll: "الكل", cHigh: "عالية", cMed: "متوسطة", cLow: "منخفضة",
      searchPh: "بحث…",
      night: "ليل", day: "نهار",
      countTpl: "{n} مادة مُجمّعة", showing: "عرض {n}",
      newRun: "{n} في آخر تشغيل", failed: "{n} مصدر فشل",
      emptyTitle: "لا شيء لعرضه",
      emptyBody: "لم تُجمع أخبار مطابقة للمرشّحات بعد. سيُحدَّث قريباً.",
      legendTitle: "دليل وسم ثقة المصدر",
      footNote: "نموذج موثوقية المصدر مبني على سلّم موثوقية المصدر لدى الأميرالية (A الأفضل حتى F غير مُقدَّر)، ويقيس فقط المكانة التاريخية للوسيلة. هذه الأداة «تجمع» ولا «تتحقّق».",
      builtBy: "إعداد ورصد:",
      relHigh: "عالية", relMed: "متوسطة", relLow: "منخفضة",
      source: "المصدر", go: "النص الأصلي ↵",
      cat: { news: "خبر", social: "شبكة اجتماعية", maritime: "بحري", official: "رسمي" },
      now: "الآن", min: "دقيقة", hour: "ساعة", day2: "يوم",
    },
    en: {
      dir: "ltr",
      promoLabel: "Compiled & published by",
      eyebrow: "Open-source intelligence watch · CBRNE OSINT",
      title: "The Hormuz Strait Monitor",
      tagline: "News, articles & public posts — as they break",
      place: "Persian Gulf · Strait of Hormuz",
      editionLabel: "No.",
      updatedLabel: "Last updated:",
      unverifiedSeal: "Unverified",
      disclaimer: "This is an <b>automated open-source collection</b> feed. Every item is aggregated <b>without verification</b> and none of it is fact-checked. The confidence tag reflects only the historical standing of the <b>source</b>, not the truth of the report.",
      langLabel: "Language", confLabel: "Confidence", feedLangLabel: "Item language",
      fAll: "All", cHigh: "High", cMed: "Medium", cLow: "Low",
      searchPh: "Search…",
      night: "Night", day: "Day",
      countTpl: "{n} items collected", showing: "showing {n}",
      newRun: "{n} new this run", failed: "{n} feeds failed",
      emptyTitle: "Nothing to show",
      emptyBody: "No items match the current filters yet. This updates automatically.",
      legendTitle: "Source-confidence key",
      footNote: "The source-reliability model follows the NATO Admiralty scale (A best … F unrated) and rates only an outlet's historical standing. This tool COLLECTS; it does not VERIFY.",
      builtBy: "Curated & monitored by:",
      relHigh: "High", relMed: "Medium", relLow: "Low",
      source: "Source", go: "Read at source ↵",
      cat: { news: "News", social: "Social", maritime: "Maritime", official: "Official" },
      now: "just now", min: "min ago", hour: "h ago", day2: "d ago",
    },
  };

  var CONF_CLASS = { high: "high", medium: "medium", low: "low" };

  /* --------------------------------------------------------------- state -- */
  var state = {
    ui: localStorage.getItem("hz_lang") || "fa",
    theme: localStorage.getItem("hz_theme") || "day",
    conf: "all",
    contentLang: "all",
    q: "",
    data: { meta: {}, items: [] },
  };
  if (!I18N[state.ui]) state.ui = "fa";

  /* --------------------------------------------------------------- utils -- */
  function t(key) { return I18N[state.ui][key] || I18N.en[key] || key; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function tpl(str, n) { return String(str).replace("{n}", n); }

  function relTime(ts) {
    if (!ts) return "";
    var diff = Math.floor(Date.now() / 1000) - Number(ts);
    if (diff < 60) return t("now");
    if (diff < 3600) return Math.floor(diff / 60) + " " + t("min");
    if (diff < 86400) return Math.floor(diff / 3600) + " " + t("hour");
    return Math.floor(diff / 86400) + " " + t("day2");
  }
  function fmtClock(iso) {
    try {
      var d = new Date(iso);
      var loc = state.ui === "en" ? "en-GB" : (state.ui === "ar" ? "ar" : "fa-IR");
      return d.toLocaleString(loc, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    } catch (e) { return ""; }
  }
  function editionNo(iso) {
    // a stable "issue number" = days since 2026-02-28 (crisis onset)
    try {
      var base = Date.UTC(2026, 1, 28);
      var now = iso ? new Date(iso).getTime() : Date.now();
      var n = Math.max(1, Math.floor((now - base) / 86400000) + 1);
      return state.ui === "en" ? String(n) : toLocaleDigits(n);
    } catch (e) { return "—"; }
  }
  function toLocaleDigits(n) {
    if (state.ui === "en") return String(n);
    var map = state.ui === "ar"
      ? ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"]
      : ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    return String(n).replace(/\d/g, function (d) { return map[+d]; });
  }

  /* ----------------------------------------------------- reliability seal -- */
  function seal(tier, letter) {
    var label = tier === "high" ? t("relHigh") : tier === "medium" ? t("relMed") : t("relLow");
    return '<span class="seal-rel ' + (CONF_CLASS[tier] || "low") + '">' +
             esc(label) + '<span class="grade">' + esc(letter || "F") + "</span></span>";
  }

  /* -------------------------------------------------------- apply strings -- */
  function applyStatic() {
    var html = document.documentElement;
    html.lang = state.ui;
    html.dir = I18N[state.ui].dir;
    html.setAttribute("data-theme", state.theme);

    $all("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (I18N[state.ui][k] != null) el.innerHTML = I18N[state.ui][k];
    });
    $all("[data-i18n-ph]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-ph");
      if (I18N[state.ui][k] != null) el.setAttribute("placeholder", I18N[state.ui][k]);
    });

    // active states on toggles
    $all("[data-uilang]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-uilang") === state.ui);
    });
    $all("[data-conf]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-conf") === state.conf);
    });

    // theme button label + icon
    $("#themeIcon").textContent = state.theme === "day" ? "☾" : "☀";
    $("#themeText").textContent = state.theme === "day" ? t("night") : t("day");

    // legend
    $("#legend").innerHTML = [
      ["high", "A/B"], ["medium", "C/D"], ["low", "E/F"],
    ].map(function (p) { return seal(p[0], p[1]); }).join("");
  }

  /* --------------------------------------------------------------- render -- */
  function passFilters(it) {
    if (state.conf !== "all" && it.confidence !== state.conf) return false;
    if (state.contentLang !== "all" && it.lang !== state.contentLang) return false;
    if (state.q) {
      var hay = (it.title + " " + it.summary + " " + it.source).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function entryHTML(it, isLead) {
    var dir = (it.lang === "en") ? "ltr" : "rtl";
    var catName = (I18N[state.ui].cat && I18N[state.ui].cat[it.category]) || it.category || "";
    var link = it.link || "#";
    return '' +
      '<article class="entry' + (isLead ? " lead" : "") + '" dir="' + dir + '" lang="' + esc(it.lang) + '">' +
        '<div class="entry-kicker">' +
          seal(it.confidence, it.reliability_letter) +
          '<span class="src">' + esc(it.source || it.feed || "") + "</span>" +
          '<span class="time">· ' + esc(relTime(it.published_ts)) + "</span>" +
        "</div>" +
        '<h2><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h2>" +
        (it.summary ? '<p class="sum">' + esc(it.summary) + "</p>" : "") +
        '<div class="entry-foot">' +
          (it.domain ? '<span class="tagx">' + esc(it.domain) + "</span>" : "") +
          (catName ? '<span class="tagx">' + esc(catName) + "</span>" : "") +
          '<a class="go" href="' + esc(link) + '" target="_blank" rel="noopener">' + t("go") + "</a>" +
        "</div>" +
      "</article>";
  }

  function render() {
    var items = (state.data.items || []).filter(passFilters);
    var feed = $("#feed"), empty = $("#empty");

    if (!items.length) {
      feed.innerHTML = "";
      empty.hidden = false;
    } else {
      empty.hidden = true;
      feed.innerHTML = items.map(function (it, i) { return entryHTML(it, i === 0); }).join("");
    }

    // status line
    var m = state.data.meta || {};
    var failed = (m.sources_failed || []).length;
    var parts = [
      "<b>" + toLocaleDigits((m.count != null ? m.count : (state.data.items || []).length)) + "</b> " +
        stripN(t("countTpl")),
      tpl(t("showing"), toLocaleDigits(items.length)),
    ];
    if (m.new_this_run) parts.push(tpl(t("newRun"), toLocaleDigits(m.new_this_run)));
    if (failed) parts.push(tpl(t("failed"), toLocaleDigits(failed)));
    $("#status").innerHTML = parts.join(" · ");

    $("#updated").textContent = m.generated_at ? fmtClock(m.generated_at) : "—";
    $("#edition").textContent = editionNo(m.generated_at);
  }
  function stripN(s){ return String(s).replace("{n} ","").replace("{n}",""); }

  /* --------------------------------------------------------------- events -- */
  function bind() {
    $all("[data-uilang]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.ui = b.getAttribute("data-uilang");
        localStorage.setItem("hz_lang", state.ui);
        applyStatic(); render();
      });
    });
    $all("[data-conf]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.conf = b.getAttribute("data-conf");
        applyStatic(); render();
      });
    });
    $("#contentLang").addEventListener("change", function (e) {
      state.contentLang = e.target.value; render();
    });
    $("#search").addEventListener("input", function (e) {
      state.q = e.target.value.trim(); render();
    });
    $("#themeToggle").addEventListener("click", function () {
      state.theme = state.theme === "day" ? "night" : "day";
      localStorage.setItem("hz_theme", state.theme);
      applyStatic();
    });
  }

  /* ----------------------------------------------------------------- load -- */
  function load() {
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (json) { state.data = json || { meta: {}, items: [] }; render(); })
      .catch(function () {
        state.data = { meta: {}, items: [] };
        render();
      });
  }

  /* ------------------------------------------------------------------ go -- */
  applyStatic();
  bind();
  load();
  // light polling so an open tab picks up new commits without a manual reload
  setInterval(load, 5 * 60 * 1000);
})();
