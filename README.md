# رصد تنگهٔ هرمز · مضيق هرمز · Hormuz OSINT Monitor

> **بدون راستی‌آزمایی / غير مُتحقَّق / Unverified.**
> این مخزن فقط **جمع‌آوری** می‌کند؛ **راستی‌آزمایی نمی‌کند.**
> This repository **collects**; it does **not verify**.

یک مانیتور منبع‌باز (OSINT) برای رصد لحظه‌به‌لحظهٔ هر چیزی که به **تنگهٔ هرمز** مربوط می‌شود: خبر، مقاله، و پست‌های عمومی، به سه زبان **فارسی، عربی و انگلیسی**. خروجی یک سایت استاتیک با ظاهر **روزنامه‌های سنگ‌چاپ قدیمی** و حالت **روز/شب** است که روی GitHub Pages میزبانی می‌شود و با GitHub Actions به‌صورت زمان‌بندی‌شده تازه می‌شود.

An open-source monitor that continuously aggregates everything about the **Strait of Hormuz**, news, articles and public posts, in **Persian, Arabic and English**. It renders as a static, antique lithograph-newspaper site with **day / night** modes, served from GitHub Pages and refreshed on a schedule by GitHub Actions. Every item carries a **source-based confidence tag** and a **link to the origin**. Nothing is fact-checked.

---

## چطور کار می‌کند / How it works

```
collector/collect.py      جمع‌آوری از فیدهای RSS و جست‌وجوی Google News (سه زبانه)
        │                 keyword-filters for Hormuz, scores each item by SOURCE
        ▼
docs/data/feed.json       تنها منبع دادهٔ سایت (the single data file)
        │
        ▼
docs/index.html + app.js   سه‌زبانه، حالت روز/شب، فیلترها (the newspaper UI)
        ▲
.github/workflows/        هر ۱۵ دقیقه اجرا و کامیت می‌کند (runs & commits every ~15 min)
```

- **`collector/sources.yaml`** فهرست فیدها. ستون فقرات، جست‌وجوی Google News برای هر زبان است که خبرِ منطبق با «هرمز» را از صدها ناشر می‌آورد و **ناشر اصلی** را برای امتیازِ اطمینان نگه می‌دارد. فیدهای مستقیم (BBC فارسی/عربی، الجزیره، DW، دریایی، و ردیت برای پست‌های عمومی) هم افزوده شده‌اند.
- **`collector/keywords.yaml`** واژه‌های کلیدی سه‌زبانه. واژهٔ «هرمز» هم فارسی و هم عربی را پوشش می‌دهد.
- **`collector/reliability.yaml`** مدل اعتبارِ منبع (پایینِ صفحه).

---

## راه‌اندازی / Deploy in 3 steps

1. **Fork / clone** این مخزن به حساب GitHub خودتان.
2. **Settings → Pages** → Source = *Deploy from a branch* → Branch = `main` / folder = `/docs`.
3. **Actions** را فعال کنید. workflow `collect-hormuz-osint` هر ۱۵ دقیقه (و با دکمهٔ *Run workflow*) اجرا می‌شود، `docs/data/feed.json` را تازه می‌کند و کامیت می‌زند. سایت شما این‌جا بالا می‌آید:

```
https://<username>.github.io/<repo>/
```

> نکتهٔ زمان واقعی: زمان‌بندِ GitHub Actions با دقتِ ~۱۵ دقیقه و گاهی با تأخیر اجرا می‌شود. برای جریانِ واقعاً لحظه‌ای، `collector/collect.py` را روی سرور/کرانِ خودتان اجرا کنید.
> Real-time note: GitHub's scheduler is ~15-minute-granular and can lag. For truly live streaming, run `collector/collect.py` on your own host/cron.

### اجرای محلی / Run locally

```bash
pip install -r requirements.txt
python collector/collect.py          # writes docs/data/feed.json
python -m http.server -d docs 8080   # open http://localhost:8080
```

`--dry-run` جمع می‌کند اما فایل را نمی‌نویسد.

---

## برچسب اطمینان / Confidence tag (source reliability)

برچسب، **اعتبارِ تاریخیِ رسانه** را نشان می‌دهد، نه درستیِ خبر. مبتنی بر مقیاس اعتبارِ منبعِ **آدمیرالتی** (A بهترین تا F نامشخص):

| Tag | فارسی | عربي | Admiralty | نمونه‌ها / Examples |
|----|-------|------|-----------|---------------------|
| **High** | بالا | عالية | **A / B** | Reuters, AP, AFP, IAEA, EIA, IEA, CRS, Crisis Group, IISS, Lloyd's List |
| **Medium** | متوسط | متوسطة | **C / D** | Al Jazeera, BBC, CNN, CNBC, DW, France24, gCaptain · state media (IRNA, Tasnim, RT) → **D** |
| **Low** | پایین | منخفضة | **E / F** | Reddit, X/Twitter, Telegram, Google News aggregator, blogs, unknown domains |

منبع‌شناسی و آستانه‌ها در `collector/reliability.yaml` قابل ویرایش است. هر ناشرِ ناشناخته به‌صورت پیش‌فرض **F (نامشخص)** است.

---

## افزودن منبع / Add a source

`collector/sources.yaml` را ویرایش کنید:

```yaml
- name: "My source"
  kind: rss           # rss | gnews
  lang: fa            # fa | ar | en
  url: "https://example.com/feed.xml"
  category: news      # news | social | maritime | official
```

برای جست‌وجوی Google News:

```yaml
- name: "Google News (FA)"
  kind: gnews
  lang: fa
  query: "تنگه هرمز"
  hl: fa
  gl: IR
  ceid: "IR:fa"
```

---

## هشدار / Disclaimer

این یک فیدِ **جمع‌آوریِ خودکار و راستی‌آزمایی‌نشده** است. هیچ ادعایی تأیید نشده و مسئولیتِ استفاده بر عهدهٔ کاربر است. محتوا و لینک‌ها متعلق به ناشرانِ اصلی‌اند و صرفاً برای رصدِ منبع‌باز فهرست می‌شوند.

This is an **automated, unverified** collection feed. No claim is fact-checked. Content and links belong to their original publishers and are indexed only for open-source monitoring.

---

**Compiled & monitored by Sajad Shiri**
· X: [@CBRNE_OSINT](https://x.com/CBRNE_OSINT)
· LinkedIn: [sajad-shiri](https://www.linkedin.com/in/sajad-shiri/)
