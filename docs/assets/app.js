/* =========================================================================
   Hormuz OSINT Monitor · front-end
   -------------------------------------------------------------------------
   Reads docs/data/feed.json and renders the multilingual OSINT feed.
   No framework.

   Features:
   - Persian / Arabic / English UI
   - RTL / LTR handling
   - Day / Night theme
   - Source-confidence filtering
   - Content-language filtering
   - Full-text search
   - Relative timestamps
   - Automatic polling
   - Defensive JSON/data validation
   - Safe external-link handling
   ========================================================================= */
(function () {
  "use strict";

  var DATA_URL = "data/feed.json";
  var POLL_MS = 5 * 60 * 1000;

  /* ---------------------------------------------------------------- i18n -- */

  var I18N = {
    fa: {
      dir: "rtl",
      promoLabel: "منتشرشده توسط",
      eyebrow: "پایش اطلاعاتی منبع‌باز · CBRNE OSINT",
      title: "روزنامهٔ رصد تنگهٔ هرمز",
      tagline: "اخبار، مقالات و پست‌های عمومی · لحظه به لحظه",
      place: "خلیج فارس · تنگهٔ هرمز",
      editionLabel: "شمارهٔ",
      updatedLabel: "آخرین به‌روزرسانی:",
      unverifiedSeal: "راستی‌آزمایی‌نشده",
      disclaimer:
        "این یک فید <b>جمع‌آوری خودکار منبع‌باز</b> است. تمام موارد بدون راستی‌آزمایی گردآوری می‌شوند و صحت آن‌ها تأیید نشده است. برچسب اطمینان فقط اعتبارِ تاریخیِ «منبع» را نشان می‌دهد، نه درستیِ خبر.",
      langLabel: "زبان",
      confLabel: "اطمینان",
      feedLangLabel: "زبانِ خبر",
      fAll: "همه",
      cHigh: "بالا",
      cMed: "متوسط",
      cLow: "پایین",
      searchPh: "جست‌وجو…",
      night: "شب",
      day: "روز",
      countTpl: "{n} مورد گردآوری‌شده",
      showing: "نمایش {n}",
      newRun: "{n} مورد در آخرین اجرا",
      failed: "{n} منبع ناموفق",
      emptyTitle: "موردی برای نمایش نیست",
      emptyBody:
        "هنوز خبری مطابق فیلترها گردآوری نشده است. به‌زودی به‌روزرسانی می‌شود.",
      legendTitle: "راهنمای برچسب اطمینانِ منبع",
      footNote:
        "مدل اعتبارِ منبع بر پایهٔ مقیاس اعتبارِ منبعِ آدمیرالتی (A بهترین تا F نامشخص) است و صرفاً جایگاهِ تاریخیِ رسانه را می‌سنجد. این ابزار «جمع‌آوری» می‌کند، «راستی‌آزمایی» نمی‌کند.",
      builtBy: "تهیه و پایش:",
      relHigh: "بالا",
      relMed: "متوسط",
      relLow: "پایین",
      source: "منبع",
      go: "متن اصلی ↵",
      cat: {
        news: "خبر",
        social: "شبکهٔ اجتماعی",
        maritime: "دریایی",
        official: "رسمی",
      },
      now: "هم‌اکنون",
      min: "دقیقه پیش",
      hour: "ساعت پیش",
      day2: "روز پیش",
    },

    ar: {
      dir: "rtl",
      promoLabel: "إعداد ونشر",
      eyebrow: "رصد استخباري مفتوح المصدر · CBRNE OSINT",
      title: "جريدة رصد مضيق هرمز",
      tagline: "أخبار ومقالات ومنشورات عامة · لحظة بلحظة",
      place: "الخليج العربي · مضيق هرمز",
      editionLabel: "العدد",
      updatedLabel: "آخر تحديث:",
      unverifiedSeal: "غير مُتحقَّق",
      disclaimer:
        "هذه خلاصة <b>تجميع آلي مفتوح المصدر</b>. تُجمع كل المواد دون تحقّق، ولم تُثبت صحتها. وسم الثقة يعكس فقط المكانة التاريخية «للمصدر»، لا صحّة الخبر.",
      langLabel: "اللغة",
      confLabel: "الثقة",
      feedLangLabel: "لغة الخبر",
      fAll: "الكل",
      cHigh: "عالية",
      cMed: "متوسطة",
      cLow: "منخفضة",
      searchPh: "بحث…",
      night: "ليل",
      day: "نهار",
      countTpl: "{n} مادة مُجمّعة",
      showing: "عرض {n}",
      newRun: "{n} في آخر تشغيل",
      failed: "{n} مصدر فشل",
      emptyTitle: "لا شيء لعرضه",
      emptyBody:
        "لم تُجمع أخبار مطابقة للمرشّحات بعد. سيُحدَّث قريباً.",
      legendTitle: "دليل وسم ثقة المصدر",
      footNote:
        "نموذج موثوقية المصدر مبني على سلّم موثوقية المصدر لدى الأميرالية (A الأفضل حتى F غير مُقدَّر)، ويقيس فقط المكانة التاريخية للوسيلة. هذه الأداة «تجمع» ولا «تتحقّق».",
      builtBy: "إعداد ورصد:",
      relHigh: "عالية",
      relMed: "متوسطة",
      relLow: "منخفضة",
      source: "المصدر",
      go: "النص الأصلي ↵",
      cat: {
        news: "خبر",
        social: "شبكة اجتماعية",
        maritime: "بحري",
        official: "رسمي",
      },
      now: "الآن",
      min: "دقيقة",
      hour: "ساعة",
      day2: "يوم",
    },

    en: {
      dir: "ltr",
      promoLabel: "Compiled & published by",
      eyebrow: "Open-source intelligence watch · CBRNE OSINT",
      title: "The Hormuz Strait Monitor",
      tagline: "News, articles & public posts · as they break",
      place: "Persian Gulf · Strait of Hormuz",
      editionLabel: "No.",
      updatedLabel: "Last updated:",
      unverifiedSeal: "Unverified",
      disclaimer:
        "This is an <b>automated open-source collection</b> feed. Every item is aggregated <b>without verification</b> and none of it is fact-checked. The confidence tag reflects only the historical standing of the <b>source</b>, not the truth of the report.",
      langLabel: "Language",
      confLabel: "Confidence",
      feedLangLabel: "Item language",
      fAll: "All",
      cHigh: "High",
      cMed: "Medium",
      cLow: "Low",
      searchPh: "Search…",
      night: "Night",
      day: "Day",
      countTpl: "{n} items collected",
      showing: "showing {n}",
      newRun: "{n} new this run",
      failed: "{n} feeds failed",
      emptyTitle: "Nothing to show",
      emptyBody:
        "No items match the current filters yet. This updates automatically.",
      legendTitle: "Source-confidence key",
      footNote:
        "The source-reliability model follows the NATO Admiralty scale (A best … F unrated) and rates only an outlet's historical standing. This tool COLLECTS; it does not VERIFY.",
      builtBy: "Curated & monitored by:",
      relHigh: "High",
      relMed: "Medium",
      relLow: "Low",
      source: "Source",
      go: "Read at source ↵",
      cat: {
        news: "News",
        social: "Social",
        maritime: "Maritime",
        official: "Official",
      },
      now: "just now",
      min: "min ago",
      hour: "h ago",
      day2: "d ago",
    },
  };

  var CONF_CLASS = {
    high: "high",
    medium: "medium",
    low: "low",
  };

  /* ---------------------------------------------------------------- state -- */

  var state = {
    ui: localStorage.getItem("hz_lang") || "fa",
    theme: localStorage.getItem("hz_theme") || "day",
    conf: "all",
    contentLang: "all",
    q: "",
    data: {
      meta: {},
      items: [],
    },
  };

  if (!I18N[state.ui]) {
    state.ui = "fa";
  }

  if (state.theme !== "day" && state.theme !== "night") {
    state.theme = "day";
  }

  /* --------------------------------------------------------------- helpers -- */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  }

  function t(key) {
    return (
      I18N[state.ui][key] ||
      I18N.en[key] ||
      key
    );
  }

  function tpl(str, n) {
    return String(str).replace("{n}", n);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripN(str) {
    return String(str)
      .replace("{n} ", "")
      .replace("{n}", "");
  }

  function toLocaleDigits(n) {
    if (state.ui === "en") {
      return String(n);
    }

    var map =
      state.ui === "ar"
        ? ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
        : ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

    return String(n).replace(/\d/g, function (d) {
      return map[Number(d)];
    });
  }

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFKC")
      .trim();
  }

  /* ------------------------------------------------------------ URL safety -- */

  function safeURL(value) {
    if (!value) {
      return "#";
    }

    try {
      var url = new URL(value, window.location.href);

      if (
        url.protocol === "http:" ||
        url.protocol === "https:"
      ) {
        return url.href;
      }
    } catch (e) {}

    return "#";
  }

  /* ------------------------------------------------------------- time/date -- */

  function relTime(ts) {
    if (ts == null || ts === "") {
      return "";
    }

    var n = Number(ts);

    if (!Number.isFinite(n)) {
      return "";
    }

    var diff = Math.floor(Date.now() / 1000) - n;

    if (diff < 0) {
      return t("now");
    }

    if (diff < 60) {
      return t("now");
    }

    if (diff < 3600) {
      return (
        Math.floor(diff / 60) +
        " " +
        t("min")
      );
    }

    if (diff < 86400) {
      return (
        Math.floor(diff / 3600) +
        " " +
        t("hour")
      );
    }

    return (
      Math.floor(diff / 86400) +
      " " +
      t("day2")
    );
  }

  function fmtClock(iso) {
    if (!iso) {
      return "";
    }

    var d = new Date(iso);

    if (Number.isNaN(d.getTime())) {
      return "";
    }

    var loc =
      state.ui === "en"
        ? "en-GB"
        : state.ui === "ar"
        ? "ar"
        : "fa-IR";

    try {
      return d.toLocaleString(loc, {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      });
    } catch (e) {
      return d.toISOString();
    }
  }

  function editionNo(iso) {
    try {
      var base = Date.UTC(2026, 1, 28);
      var parsed = iso ? new Date(iso).getTime() : Date.now();

      if (!Number.isFinite(parsed)) {
        parsed = Date.now();
      }

      var n = Math.max(
        1,
        Math.floor((parsed - base) / 86400000) + 1
      );

      return toLocaleDigits(n);
    } catch (e) {
      return "·";
    }
  }

  /* ----------------------------------------------------- reliability seal -- */

  function seal(tier, letter) {
    tier = CONF_CLASS[tier] ? tier : "low";

    var label =
      tier === "high"
        ? t("relHigh")
        : tier === "medium"
        ? t("relMed")
        : t("relLow");

    return (
      '<span class="seal-rel ' +
      CONF_CLASS[tier] +
      '">' +
      esc(label) +
      '<span class="grade">' +
      esc(letter || "F") +
      "</span></span>"
    );
  }

  /* --------------------------------------------------------- data hygiene -- */

  function normalizeItem(it) {
    if (!it || typeof it !== "object") {
      return null;
    }

    var title = String(it.title || "").trim();

    if (!title) {
      return null;
    }

    var confidence =
      it.confidence === "high" ||
      it.confidence === "medium" ||
      it.confidence === "low"
        ? it.confidence
        : "low";

    var lang =
      it.lang === "fa" ||
      it.lang === "ar" ||
      it.lang === "en"
        ? it.lang
        : "en";

    var publishedTs = Number(it.published_ts);

    if (!Number.isFinite(publishedTs)) {
      var parsedDate = new Date(it.published || "");
      publishedTs = Number.isNaN(parsedDate.getTime())
        ? 0
        : Math.floor(parsedDate.getTime() / 1000);
    }

    return {
      id: String(it.id || ""),
      title: title,
      summary: String(it.summary || "").trim(),
      link: safeURL(it.link),
      lang: lang,
      source: String(it.source || it.feed || "").trim(),
      domain: String(it.domain || "").trim(),
      feed: String(it.feed || "").trim(),
      category: String(it.category || "news").trim(),
      confidence: confidence,
      reliability_letter: String(
        it.reliability_letter || "F"
      ).trim(),
      published: String(it.published || ""),
      published_ts: publishedTs,
      keywords: Array.isArray(it.keywords)
        ? it.keywords.map(String)
        : [],
    };
  }

  function normalizeData(json) {
    if (!json || typeof json !== "object") {
      return {
        meta: {},
        items: [],
      };
    }

    var rawItems = Array.isArray(json.items)
      ? json.items
      : [];

    var items = rawItems
      .map(normalizeItem)
      .filter(Boolean);

    return {
      meta:
        json.meta && typeof json.meta === "object"
          ? json.meta
          : {},
      items: items,
    };
  }

  /* -------------------------------------------------------- apply strings -- */

  function applyStatic() {
    var root = document.documentElement;

    root.lang = state.ui;
    root.dir = I18N[state.ui].dir;
    root.setAttribute("data-theme", state.theme);

    $all("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");

      if (I18N[state.ui][key] != null) {
        el.innerHTML = I18N[state.ui][key];
      }
    });

    $all("[data-i18n-ph]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-ph");

      if (I18N[state.ui][key] != null) {
        el.setAttribute(
          "placeholder",
          I18N[state.ui][key]
        );
      }
    });

    $all("[data-uilang]").forEach(function (button) {
      var active =
        button.getAttribute("data-uilang") === state.ui;

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );

      button.classList.toggle("active", active);
    });

    $all("[data-conf]").forEach(function (button) {
      var active =
        button.getAttribute("data-conf") === state.conf;

      button.setAttribute(
        "aria-pressed",
        active ? "true" : "false"
      );

      button.classList.toggle("active", active);
    });

    var themeIcon = $("#themeIcon");
    var themeText = $("#themeText");

    if (themeIcon) {
      themeIcon.textContent =
        state.theme === "day" ? "☾" : "☀";
    }

    if (themeText) {
      themeText.textContent =
        state.theme === "day"
          ? t("night")
          : t("day");
    }

    var legend = $("#legend");

    if (legend) {
      legend.innerHTML = [
        ["high", "A/B"],
        ["medium", "C/D"],
        ["low", "E/F"],
      ]
        .map(function (p) {
          return seal(p[0], p[1]);
        })
        .join("");
    }
  }

  /* -------------------------------------------------------------- filters -- */

  function passFilters(it) {
    if (
      state.conf !== "all" &&
      it.confidence !== state.conf
    ) {
      return false;
    }

    if (
      state.contentLang !== "all" &&
      it.lang !== state.contentLang
    ) {
      return false;
    }

    if (state.q) {
      var hay = normalizeText(
        [
          it.title,
          it.summary,
          it.source,
          it.domain,
          it.category,
          it.keywords.join(" "),
        ].join(" ")
      );

      if (
        hay.indexOf(normalizeText(state.q)) === -1
      ) {
        return false;
      }
    }

    return true;
  }

  /* --------------------------------------------------------------- render -- */

  function entryHTML(it, isLead) {
    var dir = it.lang === "en" ? "ltr" : "rtl";
    var catName =
      I18N[state.ui].cat &&
      I18N[state.ui].cat[it.category]
        ? I18N[state.ui].cat[it.category]
        : it.category || "";

    var link = safeURL(it.link);

    return (
      '<article class="entry' +
      (isLead ? " lead" : "") +
      '" dir="' +
      dir +
      '" lang="' +
      esc(it.lang) +
      '">' +

      '<div class="entry-kicker">' +
      seal(
        it.confidence,
        it.reliability_letter
      ) +

      '<span class="src">' +
      esc(it.source || it.feed || "") +
      "</span>" +

      '<span class="time">· ' +
      esc(relTime(it.published_ts)) +
      "</span>" +

      "</div>" +

      '<h2><a href="' +
      esc(link) +
      '" target="_blank" rel="noopener noreferrer nofollow">' +
      esc(it.title) +
      "</a></h2>" +

      (it.summary
        ? '<p class="sum">' +
          esc(it.summary) +
          "</p>"
        : "") +

      '<div class="entry-foot">' +

      (it.domain
        ? '<span class="tagx">' +
          esc(it.domain) +
          "</span>"
        : "") +

      (catName
        ? '<span class="tagx">' +
          esc(catName) +
          "</span>"
        : "") +

      '<a class="go" href="' +
      esc(link) +
      '" target="_blank" rel="noopener noreferrer nofollow">' +
      esc(t("go")) +
      "</a>" +

      "</div>" +
      "</article>"
    );
  }

  function render() {
    var feed = $("#feed");
    var empty = $("#empty");

    if (!feed || !empty) {
      return;
    }

    var items = state.data.items.filter(
      passFilters
    );

    if (!items.length) {
      feed.innerHTML = "";
      empty.hidden = false;
    } else {
      empty.hidden = true;

      feed.innerHTML = items
        .map(function (item, index) {
          return entryHTML(
            item,
            index === 0
          );
        })
        .join("");
    }

    var meta = state.data.meta || {};

    var failed = Array.isArray(
      meta.sources_failed
    )
      ? meta.sources_failed.length
      : 0;

    var total =
      meta.count != null
        ? Number(meta.count)
        : state.data.items.length;

    if (!Number.isFinite(total)) {
      total = state.data.items.length;
    }

    var parts = [
      "<b>" +
        esc(toLocaleDigits(total)) +
        "</b> " +
        esc(stripN(t("countTpl"))),

      esc(
        tpl(
          t("showing"),
          toLocaleDigits(items.length)
        )
      ),
    ];

    if (
      Number(meta.new_this_run) > 0
    ) {
      parts.push(
        esc(
          tpl(
            t("newRun"),
            toLocaleDigits(
              Number(meta.new_this_run)
            )
          )
        )
      );
    }

    if (failed > 0) {
      parts.push(
        esc(
          tpl(
            t("failed"),
            toLocaleDigits(failed)
          )
        )
      );
    }

    var status = $("#status");

    if (status) {
      status.innerHTML = parts.join(" · ");
    }

    var updated = $("#updated");

    if (updated) {
      updated.textContent =
        meta.generated_at
          ? fmtClock(meta.generated_at)
          : "·";
    }

    var edition = $("#edition");

    if (edition) {
      edition.textContent =
        editionNo(meta.generated_at);
    }
  }

  /* --------------------------------------------------------------- events -- */

  function bind() {
    $all("[data-uilang]").forEach(function (button) {
      button.addEventListener("click", function () {
        var lang =
          button.getAttribute("data-uilang");

        if (!I18N[lang]) {
          return;
        }

        state.ui = lang;
        localStorage.setItem(
          "hz_lang",
          state.ui
        );

        applyStatic();
        render();
      });
    });

    $all("[data-conf]").forEach(function (button) {
      button.addEventListener("click", function () {
        var conf =
          button.getAttribute("data-conf");

        if (
          conf !== "all" &&
          !CONF_CLASS[conf]
        ) {
          return;
        }

        state.conf = conf;

        applyStatic();
        render();
      });
    });

    var contentLang = $("#contentLang");

    if (contentLang) {
      contentLang.addEventListener(
        "change",
        function (event) {
          var value = event.target.value;

          state.contentLang =
            value === "fa" ||
            value === "ar" ||
            value === "en"
              ? value
              : "all";

          render();
        }
      );
    }

    var search = $("#search");

    if (search) {
      search.addEventListener(
        "input",
        function (event) {
          state.q = event.target.value
            .trim()
            .slice(0, 200);

          render();
        }
      );
    }

    var themeToggle = $("#themeToggle");

    if (themeToggle) {
      themeToggle.addEventListener(
        "click",
        function () {
          state.theme =
            state.theme === "day"
              ? "night"
              : "day";

          localStorage.setItem(
            "hz_theme",
            state.theme
          );

          applyStatic();
        }
      );
    }
  }

  /* ----------------------------------------------------------------- load -- */

  function load() {
    fetch(DATA_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "HTTP " + response.status
          );
        }

        return response.json();
      })
      .then(function (json) {
        state.data = normalizeData(json);
        render();
      })
      .catch(function (error) {
        console.error(
          "Hormuz OSINT feed load failed:",
          error
        );

        state.data = {
          meta: {},
          items: [],
        };

        render();
      });
  }

  /* ------------------------------------------------------------------ init -- */

  applyStatic();
  bind();
  load();

  /* Refresh open tabs automatically. */
  window.setInterval(load, POLL_MS);
})();
