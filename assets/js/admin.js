/* ======================================================================
   نقابة المهندسين السوريين — قشرة لوحة الإدارة المشتركة
   ----------------------------------------------------------------------
   كانت الترويسة وشريط الدولة والقائمة منسوخة حرفياً في ستة ملفات، فإضافة
   صفحة واحدة تعني تعديل ستة ملفات — ونُسيت فعلاً مع admin-user-detail.
   هنا تُبنى القشرة كلها من إعداد سطر واحد، ومعها الحارس وأدوات الجداول.

   الاستعمال في أي صفحة إدارة:
     ADMIN.boot({
       page:  'users',                       // مفتاح عنصر القائمة النشط
       title: 'الحسابات',
       lead:  'إدارة طلبات الانتساب…',
       crumb: 'الحسابات'
     }).then(function (staff) { ... });      // null = تعذّر التحقق
   ====================================================================== */
(function () {
  'use strict';

  var API = window.OSEA_API;

  /* عناصر القائمة — مصدر واحد لكل الصفحات */
  var NAV = [
    { key: 'overview',  href: 'admin.html',           label: 'نظرة عامة' },
    { key: 'users',     href: 'admin-users.html',     label: 'الحسابات' },
    { key: 'payments',  href: 'admin-payments.html',  label: 'المدفوعات' },
    /* مطابقة كشف شام كاش بدفتر المنصة (٠٣٨) — بجوار المدفوعات لأنها امتدادها */
    { key: 'shamrecon', href: 'admin-sham-recon.html', label: 'مطابقة شام كاش' },
    { key: 'results',  href: 'admin-results.html',   label: 'النتائج والشهادات' },
    /* سجل الشهادات (٠٣٩): كل شهادة صالحة أو مسحوبة بفلترة خادمية */
    { key: 'certs',     href: 'admin-certificates.html', label: 'سجل الشهادات' },
    { key: 'content',   href: 'admin-content.html',   label: 'المحتوى' },
    { key: 'folders',   href: 'admin-folders.html',   label: 'المجلدات والتسعير' },
    { key: 'news',      href: 'admin-news.html',      label: 'الأخبار' },
    { key: 'services',  href: 'admin-services.html',  label: 'الخدمات' },
    { key: 'accredit',  href: 'admin-accredit.html',  label: 'سجل الاعتمادات' },
    { key: 'jobs',      href: 'admin-jobs.html',      label: 'فرص العمل' },
    { key: 'discounts', href: 'admin-discounts.html', label: 'الخصومات' },
    { key: 'codes',     href: 'admin-codes.html',     label: 'كوبونات التطبيق' },
    { key: 'reports',   href: 'admin-reports.html',   label: 'التقارير' },
    { key: 'questions', href: 'admin-questions.html', label: 'بنك الأسئلة' },
    { key: 'releases',  href: 'admin-releases.html',  label: 'إصدارات التطبيق' },
    { key: 'access',    href: 'admin-access.html',    label: 'سجل الوصول' },
    { key: 'staff',     href: 'admin-staff.html',     label: 'الطاقم' },
    { key: 'audit',     href: 'admin-audit.html',     label: 'سجل التدقيق' }
  ];

  var ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    x:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sort:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>',
    empty:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 7 5 3h14l2 4"/><path d="M9 12h6"/></svg>',
    ok:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    bad:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    menu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  /* ---------------------------------------------------------------- تنسيق */
  /* الأرقام تُعرض لاتينية 1 2 3 … بقرار العميل. الاسم toAr باقٍ لأن عشرات
     المواضع تستدعيه، وهو الآن ممرّ واحد يحوّل أي هندي وارد إلى لاتيني. */
  function toAr(n) {
    return String(n == null ? '' : n)
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
  }
  var MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران',
                'تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];

  /* تاريخ بلا وقت (YYYY-MM-DD) يُفسَّر منتصف ليل UTC فينقص يوماً في
     المناطق الزمنية السالبة — يُفكَّك يدوياً بدل تمريره إلى new Date. */
  function parseDate(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
    return isNaN(d) ? null : d;
  }
  function arDate(iso) {
    var d = parseDate(iso);
    if (!d) return '—';
    return toAr(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + toAr(d.getFullYear());
  }
  /* يوم وشهر بلا سنة — لمحاور الرسوم حيث التاريخ الكامل أطول مما يليق */
  function arDateShort(iso) {
    var d = parseDate(iso);
    if (!d) return '—';
    return toAr(d.getDate()) + ' ' + MONTHS[d.getMonth()];
  }
  /* عدد بفاصل آلاف عربي */
  function num(n) {
    return toAr(String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  /* مطابقة العدد للمعدود — «٠ حساباً» خطأ نحوي، والصواب «لا حسابات» */
  function count(n, one, two, few, many) {
    n = Number(n) || 0;
    /* الصفر يأخذ جمع القلّة لا صيغة التمييز المنصوبة: «لا بنود» لا «لا بنداً» */
    if (n === 0) return 'لا ' + (few || two || one || many);
    if (n === 1) return one;
    if (n === 2) return two || one;
    if (n % 100 >= 3 && n % 100 <= 10) return num(n) + ' ' + (few || two || one);
    return num(n) + ' ' + (many || one);
  }
  function arDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    var h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    var ap = h < 12 ? 'ص' : 'م';
    var h12 = h % 12 || 12;
    return arDate(iso) + ' — ' + toAr(h12) + ':' + toAr(m) + ' ' + ap;
  }
  function secDur(s) {
    s = Math.max(0, s | 0);
    var m = Math.floor(s / 60), r = s % 60;
    return toAr(m) + ':' + toAr(String(r).padStart(2, '0'));
  }
  function bytes(n) {
    if (!n) return '—';
    var u = ['بايت', 'ك.ب', 'م.ب', 'غ.ب'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return toAr(n.toFixed(i ? 1 : 0)) + ' ' + u[i];
  }
  /* حماية من الحقن: كل قيمة قادمة من القاعدة تمرّ من هنا قبل innerHTML */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* تطبيع البحث العربي: أرقام هندية وفارسية، همزات، تاء مربوطة، ألف مقصورة، تشكيل */
  function norm(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[ً-ْ]/g, '')
      .trim().toLowerCase();
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms || 260);
    };
  }

  /* ---------------------------------------------------------------- القشرة */
  function shellHTML(cfg) {
    function links(cls) {
      return NAV.map(function (n) {
        var on = n.key === cfg.page;
        return '<a class="' + cls + (on ? ' active' : '') + '" href="' + esc(n.href) + '"' +
          (on ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
      }).join('');
    }

    return '' +
    '<div class="statebar"><div class="container">' +
      '<span class="statebar-official">' +
        '<img src="assets/img/logo-mark-96.png" alt="" width="96" height="96">' +
        '<span>منصة رسمية تابعة لنقابة المهندسين السوريين — الجمهورية العربية السورية</span>' +
      '</span>' +
      '<span class="statebar-actions">' +
        '<span class="hide-mobile" id="admWho"></span>' +
      '</span>' +
    '</div></div>' +

    '<header class="masthead" id="masthead"><div class="container">' +
      '<a class="masthead-brand" href="index.html">' +
        '<img src="assets/img/logo-mark-192.png" alt="شعار نقابة المهندسين السوريين" width="192" height="192">' +
        '<span><span class="ar">نقابة المهندسين السوريين</span>' +
        '<span class="en">Syrian Engineers Syndicate</span></span>' +
      '</a>' +
      '<div class="masthead-tools">' +
        '<span class="tag tag--navy adm-mast-wide">لوحة الإدارة</span>' +
        '<button class="btn btn-outline btn-sm adm-mast-wide" id="admLogout" hidden>خروج</button>' +
        '<a href="index.html" class="btn btn-outline btn-sm adm-mast-wide">العودة إلى المنصة</a>' +
        /* زر الدرج: يظهر على 1080 فما دون مكان شريط التنقل */
        '<button type="button" class="adm-menu-btn" id="admMenuBtn" aria-controls="admDrawer" ' +
          'aria-expanded="false" aria-haspopup="dialog">' + ICONS.menu +
          '<span class="adm-menu-txt">القائمة</span></button>' +
      '</div>' +
    '</div></header>' +

    '<nav class="navbar" aria-label="تنقل لوحة الإدارة"><div class="container">' +
      /* صفّان متساويان على الشاشة الواسعة: الأعمدة نصف عدد العناصر (admin.css) */
      '<div class="nav-menu" id="admNavMenu" style="--adm-nav-cols:' + Math.ceil(NAV.length / 2) + '">' +
        links('nav-item') + '</div>' +
    '</div></nav>' +

    '<div class="adm-drawer" id="admDrawer" hidden>' +
      '<div class="adm-drawer-veil" data-drawer-close></div>' +
      '<div class="adm-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="admDrawerTitle" tabindex="-1">' +
        '<div class="adm-drawer-head">' +
          '<img src="assets/img/logo-mark-96.png" alt="" width="96" height="96">' +
          '<span class="adm-drawer-id"><strong id="admDrawerTitle">لوحة الإدارة</strong>' +
            '<span id="admDrawerWho"></span></span>' +
          '<button type="button" class="adm-x" data-drawer-close aria-label="إغلاق القائمة">' + ICONS.x + '</button>' +
        '</div>' +
        '<nav class="adm-drawer-nav" aria-label="أقسام لوحة الإدارة">' + links('adm-drawer-item') + '</nav>' +
        '<div class="adm-drawer-foot">' +
          '<a href="index.html" class="btn btn-ghost-dark btn-sm">العودة إلى المنصة</a>' +
          '<button type="button" class="btn btn-ghost-dark btn-sm" id="admLogout2" hidden>خروج</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="page-head"><div class="container">' +
      '<span class="tag tag--dark adm-mode" id="admMode">جارٍ التحقق…</span>' +
      '<h1>' + esc(cfg.title) + '</h1>' +
      (cfg.lead ? '<p>' + esc(cfg.lead) + '</p>' : '') +
    '</div></section>' +

    '<nav class="breadcrumb" aria-label="مسار التنقل"><div class="container">' +
      '<a href="admin.html">لوحة الإدارة</a>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
      '<span aria-current="page">' + esc(cfg.crumb || cfg.title) + '</span>' +
    '</div></nav>';
  }

  /* ---------------------------------------------------------------- التنبيهات */
  var toastHost = null;
  function toast(msg, kind, ms) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'adm-toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    /* تحت أدنى شريط علوي ظاهر لحظة الإطلاق (الترويسة اللاصقة أو شريط التنقل) */
    var edge = 0;
    ['.masthead', '.navbar'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) { edge = Math.max(edge, el.getBoundingClientRect().bottom); }
    });
    toastHost.style.insetBlockStart = Math.max(edge + 14, 14) + 'px';
    var el = document.createElement('div');
    el.className = 'adm-toast' + (kind === 'ok' ? ' adm-toast--ok' : kind === 'bad' ? ' adm-toast--bad' : '');
    el.innerHTML = (kind === 'ok' ? ICONS.ok : kind === 'bad' ? ICONS.bad : ICONS.info) +
      '<span>' + esc(msg) + '</span>';
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 200ms';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 220);
    }, ms || (kind === 'bad' ? 6000 : 3600));
  }

  /* رسالة خطأ مفهومة: رسائل القاعدة عربية أصلاً فتُعرض كما هي */
  function errText(e, fallback) {
    var m = (e && (e.message || e.hint || e.details)) || '';
    if (/[؀-ۿ]/.test(m)) return m;
    if (/permission denied|not authorized/i.test(m)) return 'لا تملك صلاحية هذا الإجراء.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال بالخادم — تحقق من إنترنتك.';

    /* دالة غائبة (PGRST202 من PostgREST، 42883 من Postgres) قبل فرع «schema
       cache» أدناه: رسالة PostgREST عنها تذكر «schema cache» أيضاً، فكانت تُقرأ
       «حقلٌ ناقص في الجدول» وتحيل إلى ترحيلة ٠٢٤ — والناقص دالةٌ لا عمود.
       الصفحة التي تعرف ترحيلتها (admin-jobs وadmin-discounts) تسمّيها قبل هذا */
    if ((e && (e.code === 'PGRST202' || e.code === '42883')) ||
        /Could not find the function|function .* does not exist/i.test(m)) {
      return 'القاعدة تنقصها دالة تطلبها هذه الصفحة — ترحيلة لم تُطبَّق بعد. '
           + 'نفّذوا الترحيلات المعلّقة بالترتيب ثم أعيدوا المحاولة. '
           + 'التفصيل التقني: ' + m;
    }

    /* عمود مفقود في القاعدة = ترحيلة لم تُطبَّق، لا خطأ من الموظّف.
       هذه الحالة بعينها هي التي أوقفت سجل الاعتمادات شهراً كاملاً: الحفظ
       يرسل عمودَي المحافظة والبريد دائماً (لكل الأنواع لا للسوريَّين وحدهما)،
       فإن لم تكن ترحيلة ٠٢٤ مطبَّقة رفض PostgREST كل إضافة وكل تعديل —
       حتى لمهندس — برسالة إنكليزية خام قرأتها الإدارة على أنها «القوائم غير
       موجودة». الرسالة الصريحة هنا تختصر الطريق إلى السبب الحقيقي. */
    if (/PGRST204|schema cache|Could not find the .* column/i.test(m)) {
      return 'القاعدة تنقصها ترحيلة: الحقل المطلوب غير موجود في الجدول بعد. '
           + 'نفّذوا الترحيلات المعلّقة بالترتيب (٠٢٤ ثم ما بعدها) ثم أعيدوا المحاولة. '
           + 'التفصيل التقني: ' + m;
    }
    if (/relation .* does not exist|PGRST205/i.test(m)) {
      return 'الجدول غير موجود في القاعدة — الترحيلة المنشئة له لم تُنفَّذ بعد. '
           + 'التفصيل التقني: ' + m;
    }
    if (/violates check constraint|new row for relation .* violates/i.test(m)) {
      return 'القيمة مرفوضة من قيود القاعدة — قد تكون الترحيلة التي توسّع القيم '
           + 'المقبولة غير مطبَّقة بعد. التفصيل التقني: ' + m;
    }

    return fallback || ('تعذّر إتمام العملية' + (m ? ' — ' + m : ''));
  }

  /* ---------------------------------------------------------------- قفل التمرير والتركيز
     عدّاد لا راية: الدرج واللوحة الجانبية والتأكيد قد تتراكب، والقفل يُرفع مع آخرها */
  var locks = 0;
  function lockScroll(on) {
    var root = document.documentElement;
    /* شريط تمرير ظاهر يختفي مع القفل فتقفز الصفحة بعرضه: يُحجز مكانه (admin.css) */
    if (on && !locks) { root.classList.toggle('adm-locked-bar', window.innerWidth > root.clientWidth); }
    locks = Math.max(0, locks + (on ? 1 : -1));
    root.classList.toggle('adm-locked', locks > 0);
  }
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  /* إبقاء Tab داخل الحوار المفتوح: من الأخير إلى الأول وبالعكس */
  function trapTab(e, box) {
    if (e.key !== 'Tab') return;
    var list = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0;
    });
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0], last = list[list.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || cur === box || !box.contains(cur))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (cur === last || !box.contains(cur))) { e.preventDefault(); first.focus(); }
  }
  /* لمس بلا فأرة: لا يُفتح حقلٌ تلقائياً فتقفز لوحة المفاتيح فوق نصف الشاشة */
  function coarse() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  /* ---------------------------------------------------------------- اللوحة الجانبية */
  function sheet(opts) {
    var opener = document.activeElement;
    var host = document.createElement('div');
    host.className = 'adm-sheet on';
    host.innerHTML =
      '<div class="adm-sheet-veil" data-close></div>' +
      '<div class="adm-sheet-panel" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '" tabindex="-1">' +
        '<div class="adm-sheet-head"><h2>' + esc(opts.title) + '</h2>' +
          '<button class="adm-x" data-close aria-label="إغلاق">' + ICONS.x + '</button></div>' +
        '<div class="adm-sheet-body">' + (opts.body || '') + '</div>' +
        '<div class="adm-sheet-foot">' +
          '<button class="btn btn-primary" data-ok>' + esc(opts.okLabel || 'حفظ') + '</button>' +
          '<button class="btn btn-outline" data-close>' +
            esc(opts.closeLabel || (opts.hideOk ? 'إغلاق' : 'إلغاء')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
    lockScroll(true);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      /* لا يُسحب التركيز من لوحةٍ أخرى فُتحت فوقها قبل إغلاقها */
      var inside = host.contains(document.activeElement);
      host.remove();
      lockScroll(false);
      if ((inside || document.activeElement === document.body) &&
          opener && opener.focus && document.contains(opener)) { opener.focus(); }
    }
    /* الهروب يسلك طريق زر الإلغاء نفسه: نقرته تُشغّل مستمع الإغلاق ومستمع
       confirmAsk (حلّ الوعد بـnull) معاً — فلا يبقى تأكيد معلّقاً بلا جواب.
       ولوحةٌ فوق لوحة: الأعلى وحدها تستجيب */
    function onKey(e) {
      var all = document.querySelectorAll('.adm-sheet.on');
      if (all[all.length - 1] !== host) return;
      if (e.key === 'Tab') { trapTab(e, host.querySelector('.adm-sheet-panel')); return; }
      if (e.key !== 'Escape') return;
      var b = host.querySelector('[data-close]');
      if (b) { b.click(); } else { close(); }
    }
    document.addEventListener('keydown', onKey);
    host.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', close);
    });
    var okBtn = host.querySelector('[data-ok]');
    if (opts.hideOk) { okBtn.hidden = true; }
    okBtn.addEventListener('click', function () {
      if (!opts.onOk) return close();
      var r = opts.onOk(host, close);
      if (r && r.then) {
        okBtn.disabled = true;
        var t = okBtn.textContent;
        okBtn.textContent = 'جارٍ الحفظ…';
        r.then(close).catch(function (e) {
          toast(errText(e), 'bad');
          okBtn.disabled = false;
          okBtn.textContent = t;
        });
      }
    });
    var first = host.querySelector('.adm-sheet-body input, .adm-sheet-body select, .adm-sheet-body textarea');
    if (first && !coarse()) { first.focus(); }
    else { host.querySelector('.adm-sheet-panel').focus({ preventScroll: true }); }
    return { el: host, close: close };
  }

  function confirmAsk(opts) {
    return new Promise(function (resolve) {
      var s = sheet({
        title: opts.title,
        okLabel: opts.okLabel || 'تأكيد',
        body: '<p style="font-size:14.5px;line-height:1.9">' + esc(opts.text) + '</p>' +
              (opts.reason
                ? '<div class="field"><label for="admReason">' + esc(opts.reason) + '</label>' +
                  '<input class="input" id="admReason" type="text" maxlength="200"></div>'
                : ''),
        onOk: function (host, close) {
          var r = host.querySelector('#admReason');
          var v = r ? (r.value || '').trim() : true;
          /* سبب إلزامي: لا نغلق ولا نحلّ الوعد حتى يُكتب */
          if (r && opts.reasonRequired && !v) {
            r.setAttribute('aria-invalid', 'true');
            r.focus();
            toast('اكتب السبب قبل المتابعة — يُسجَّل ويظهر للمعنيين.', 'bad', 4000);
            return;
          }
          resolve(v);
          close();
        }
      });
      s.el.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () { resolve(null); });
      });
      /* التأكيد القصير لوحةٌ سفلية على الهاتف لا شاشة كاملة (admin.css) */
      s.el.classList.add('adm-sheet--ask');
      var ok = s.el.querySelector('[data-ok]');
      if (opts.danger) { ok.className = 'btn btn-danger'; }
    });
  }

  /* ---------------------------------------------------------------- تصدير Excel
     كان التصدير CSV بفاصلة، وإكسل على ويندوز العربي يعتمد الفاصلة المنقوطة
     فاصلاً محلياً فتهبط الصفوف كلها في العمود A. الحل الجذري ملف .xlsx
     حقيقي (ZIP بلا ضغط + SpreadsheetML بسلاسل مضمّنة) — يفتح صحيحاً بأي
     لغة نظام، والخلايا النصية مكتوبة كنص فلا حقن معادلات من قيم المستخدمين. */
  /* XLSX-CORE-BEGIN — كتلة نقية بلا DOM (تُختبر خارج المتصفح كما هي) */
  var CRC_T = (function () {
    var t = [], c, k, n;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) { c = CRC_T[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /* أرشيف ZIP بطريقة التخزين (بلا ضغط) — يكفي لملفات التصدير الإدارية */
  function zipStore(entries) {
    var chunks = [], central = [], offset = 0, i, e, name, head, cen;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    var enc = new TextEncoder();
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      name = enc.encode(e.name);
      var data = e.data, crc = crc32(data);
      head = [].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(head), name, data);
      cen = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(cen), name);
      offset += head.length + name.length + data.length;
    }
    var cdSize = 0, j;
    for (j = 0; j < central.length; j++) { cdSize += central[j].length; }
    chunks = chunks.concat(central);
    chunks.push(new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(cdSize), u32(offset), u16(0))));
    var total = 0;
    for (j = 0; j < chunks.length; j++) { total += chunks[j].length; }
    var out = new Uint8Array(total), pos = 0;
    for (j = 0; j < chunks.length; j++) { out.set(chunks[j], pos); pos += chunks[j].length; }
    return out;
  }
  function xmlEsc(s) {
    var t = String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    /* سقف إكسل للخلية 32,767 محرفاً — تجاوزه يجعل الملف كله مرفوضاً */
    return t.length > 32000 ? t.slice(0, 32000) + '…' : t;
  }
  function colRef(n) { /* 0 ⇒ A، 26 ⇒ AA */
    var s = '';
    n += 1;
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function xlsxBytes(headers, rows) {
    var all = [headers].concat(rows), xr = [], i, r, c, v, cells;
    for (i = 0; i < all.length; i++) {
      r = all[i]; cells = '';
      for (c = 0; c < r.length; c++) {
        v = r[c];
        var ref = colRef(c) + (i + 1);
        if (typeof v === 'number' && isFinite(v)) {
          cells += '<c r="' + ref + '"><v>' + v + '</v></c>';
        } else {
          cells += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
                   xmlEsc(v) + '</t></is></c>';
        }
      }
      xr.push('<row r="' + (i + 1) + '">' + cells + '</row>');
    }
    var XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var sheet = XMLH +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>' +
      '<sheetData>' + xr.join('') + '</sheetData></worksheet>';
    var wb = XMLH +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="تصدير" sheetId="1" r:id="rId1"/></sheets></workbook>';
    var wbRels = XMLH +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
    var rootRels = XMLH +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    var types = XMLH +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
    var enc = new TextEncoder();
    return zipStore([
      { name: '[Content_Types].xml', data: enc.encode(types) },
      { name: '_rels/.rels', data: enc.encode(rootRels) },
      { name: 'xl/workbook.xml', data: enc.encode(wb) },
      { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
      { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) }
    ]);
  }
  /* XLSX-CORE-END */
  /* الاسم exportCsv تاريخي — كل أزرار التصدير الثمانية تستدعيه بلا تغيير */
  function exportCsv(filename, headers, rows) {
    var bytes = xlsxBytes(headers, rows);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    a.download = filename.replace(/\.csv$/i, '') + '.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* ---------------------------------------------------------------- الترقيم */
  function pager(host, state, onGo) {
    var total = state.total | 0, lim = state.limit | 0, off = state.offset | 0;
    if (!lim) return;
    var from = total ? off + 1 : 0, to = Math.min(off + lim, total);
    var pages = Math.max(1, Math.ceil(total / lim));
    var cur = Math.floor(off / lim) + 1;
    host.innerHTML =
      '<span>عرض ' + toAr(from) + '–' + toAr(to) + ' من ' + toAr(total) + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-outline btn-sm" data-go="prev"' + (cur <= 1 ? ' disabled' : '') + '>السابق</button>' +
      '<span>صفحة ' + toAr(cur) + ' من ' + toAr(pages) + '</span>' +
      '<button class="btn btn-outline btn-sm" data-go="next"' + (cur >= pages ? ' disabled' : '') + '>التالي</button>';
    host.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        onGo(b.getAttribute('data-go') === 'next' ? off + lim : Math.max(0, off - lim));
      });
    });
  }

  function emptyState(msg, hint) {
    return '<div class="adm-state">' + ICONS.empty +
      '<h3>' + esc(msg) + '</h3>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div>';
  }
  function errorState(msg, retryId) {
    return '<div class="adm-state">' + ICONS.bad + '<h3>تعذّر التحميل</h3>' +
      '<p>' + esc(msg) + '</p>' +
      (retryId ? '<button class="btn btn-outline btn-sm" id="' + retryId + '">إعادة المحاولة</button>' : '') +
      '</div>';
  }

  /* ---------------------------------------------------------------- الجداول على الشاشات الضيقة
     تحت 720 يصير كل صف بطاقة «تسمية: قيمة» (admin.css)، والتسمية من رأس العمود
     تُكتب هنا في data-label لكل خلية — مرةً عند الإقلاع ثم عند كل إعادة رسم.
     عمود الإجراءات يُعرَّف بالصنف acts، ومن رأسه «إجراءات/الإجراءات» إن غاب الصنف؛
     ما سواهما (ومنه «الإجراء») عمود بيانات لا أزرار.
     الجدول الذي يجب أن يبقى شبكة يحمل adm-table--grid. */
  var ACTS_RX = /^(ال)?إجراءات$/;
  var TITLE_RX = /^(العنوان|الاسم)$/;
  var ORDINAL_RX = /^(#|الرقم|الترتيب|المعرّف)$/;   /* أعمدة تسلسل لا تصلح عنواناً */

  function headCols(table) {
    var head = table.tHead;
    if (!head || !head.rows.length) return null;
    var cols = [], pick = false;
    Array.prototype.forEach.call(head.rows[head.rows.length - 1].cells, function (th) {
      var txt = (th.getAttribute('data-label') || th.textContent || '').replace(/\s+/g, ' ').trim();
      var acts = th.classList.contains('acts') || ACTS_RX.test(txt);
      if (acts) { th.classList.add('acts'); }
      /* «تحديد الكل» في رأسٍ يُخفى على الهاتف: يبقى وحده شريطاً فوق البطاقات */
      var box = !txt && th.querySelector('input[type="checkbox"]');
      if (box) {
        pick = true;
        if (!th.hasAttribute('data-pick')) {
          th.addEventListener('click', function (e) {
            var b = th.querySelector('input[type="checkbox"]');
            if (e.target === th && b && !b.disabled) { b.click(); }
          });
        }
        th.classList.add('adm-head-pick');
        th.setAttribute('data-pick', box.getAttribute('aria-label') || 'تحديد الكل');
      }
      for (var k = 0; k < (th.colSpan || 1); k++) {
        cols.push({ label: txt, acts: acts, title: th.classList.contains('adm-card-title') });
      }
    });
    table.classList.toggle('adm-has-pick', pick);
    return cols;
  }

  function labelTable(table) {
    if (table.classList.contains('adm-table--grid')) return;
    var cols = headCols(table);
    if (!cols) return;
    /* عنوان البطاقة: المعلَّم صراحةً (th.adm-card-title)، ثم «العنوان/الاسم»، ثم أول
       عمود ذي تسمية ليس تسلسلاً، ثم أول عمود ذي تسمية */
    var title = -1, i;
    for (i = 0; i < cols.length && title < 0; i++) { if (cols[i].title) title = i; }
    for (i = 0; i < cols.length && title < 0; i++) { if (TITLE_RX.test(cols[i].label)) title = i; }
    for (i = 0; i < cols.length && title < 0; i++) {
      if (cols[i].label && !cols[i].acts && !ORDINAL_RX.test(cols[i].label)) title = i;
    }
    for (i = 0; i < cols.length && title < 0; i++) { if (cols[i].label && !cols[i].acts) title = i; }

    Array.prototype.forEach.call(table.tBodies, function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var cells = tr.cells;
        /* صف حالة (تحميل/فراغ/خطأ): خلية واحدة ممتدة بلا تسمية */
        var full = cells.length === 1 && (cells[0].colSpan > 1 || cols.length === 1);
        tr.classList.toggle('adm-row-full', full);
        if (full) return;
        var c = 0;
        Array.prototype.forEach.call(cells, function (td) {
          var span = td.colSpan || 1, col = span === 1 ? cols[c] : null;
          var bare = !td.textContent.trim();
          if (col && col.label && !col.acts) { td.setAttribute('data-label', col.label); }
          else { td.removeAttribute('data-label'); }
          if (col && col.acts) { td.classList.add('acts'); }
          td.classList.toggle('adm-cell-title', span === 1 && c === title);
          /* مقبض السحب لا يعمل باللمس (البديل سهما الترتيب)، ومربع التحديد إلى زاوية البطاقة */
          td.classList.toggle('adm-cell-drag', bare && !!td.querySelector('[draggable="true"]'));
          td.classList.toggle('adm-cell-pick', bare && !(col && col.label) &&
            !!td.querySelector('input[type="checkbox"]'));
          c += span;
        });
      });
    });
  }

  /* فوق 720 أزرار الصف سطرٌ واحد (admin.css). فإن جعل ذلك الجدولَ يتمرّر وكان التفافها
     يكفي لاحتوائه، تلتفّ في العرض المتبقّي بالضبط (--adm-acts-min) بدل أن يغطّي العمود
     الملتصق أعمدةً من البيانات. وجدولٌ يتمرّر في الحالين تبقى أزراره سطراً */
  function fitActs(s) {
    var t = s.querySelector('table.adm-table');
    var th = t && t.querySelector('thead th.acts');
    if (!th) return;
    t.classList.remove('adm-acts-wrap');
    if (window.innerWidth <= 720 || !s.clientWidth) return;
    var over = s.scrollWidth - s.clientWidth;
    if (over <= 1) return;
    var widest = 0;
    t.querySelectorAll('td.acts .btn').forEach(function (b) { widest = Math.max(widest, b.offsetWidth); });
    var cs = window.getComputedStyle(th);
    var room = Math.floor(th.getBoundingClientRect().width - over -
      parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) - 1;
    if (!widest || room < widest) return;
    t.style.setProperty('--adm-acts-min', room + 'px');
    t.classList.add('adm-acts-wrap');
    if (s.scrollWidth > s.clientWidth + 1) { t.classList.remove('adm-acts-wrap'); }
  }

  /* هل يتمرّر الجدول أفقياً؟ يُظهر فاصل عمود الإجراءات الملتصق حين يغطّي ما خلفه */
  function markOverflow() {
    document.querySelectorAll('.adm-scroll').forEach(function (s) {
      fitActs(s);
      s.toggleAttribute('data-overflow', s.scrollWidth > s.clientWidth + 1);
    });
  }

  /* جدول يظهر بلا تغيير في محتواه (تبويب كان مخفياً، خط تأخّر تحميله) يُعاد قياسه */
  var sizeWatch = window.ResizeObserver ? new ResizeObserver(debounce(markOverflow, 80)) : null;

  var pendingTables = null;
  function queueTables(list) {
    if (!pendingTables) {
      pendingTables = [];
      (window.requestAnimationFrame || setTimeout)(function () {
        var todo = pendingTables;
        pendingTables = null;
        todo.forEach(function (t) {
          if (!t.isConnected) return;
          labelTable(t);
          var s = t.closest('.adm-scroll');
          if (sizeWatch && s) { sizeWatch.observe(s); sizeWatch.observe(t); }
        });
        markOverflow();
      });
    }
    list.forEach(function (t) { if (pendingTables.indexOf(t) < 0) pendingTables.push(t); });
  }

  function watchTables() {
    queueTables(Array.prototype.slice.call(document.querySelectorAll('table.adm-table')));
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      var found = [];
      muts.forEach(function (m) {
        var t = m.target.closest ? m.target.closest('table.adm-table') : null;
        if (t) { found.push(t); return; }
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches('table.adm-table')) { found.push(n); }
          else if (n.querySelector('table.adm-table')) {
            Array.prototype.push.apply(found, n.querySelectorAll('table.adm-table'));
          }
        });
      });
      if (found.length) { queueTables(found); }
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', debounce(markOverflow, 150));
  }

  /* ---------------------------------------------------------------- درج التنقل */
  function wireDrawer() {
    var btn = document.getElementById('admMenuBtn');
    var dr = document.getElementById('admDrawer');
    if (!btn || !dr) return;
    var panel = dr.querySelector('.adm-drawer-panel');
    var wide = window.matchMedia ? window.matchMedia('(min-width: 1081px)') : null;

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      trapTab(e, panel);
    }
    function open() {
      if (!dr.hidden) return;
      dr.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      lockScroll(true);
      document.addEventListener('keydown', onKey);
      /* العنصر الحالي في وسط القائمة: عشرون عنصراً تتجاوز ارتفاع الهاتف */
      var nav = panel.querySelector('.adm-drawer-nav');
      var cur = nav.querySelector('[aria-current="page"]');
      if (cur) {
        nav.scrollTop = Math.max(0, cur.offsetTop - nav.offsetTop - (nav.clientHeight - cur.offsetHeight) / 2);
      }
      panel.focus({ preventScroll: true });
    }
    function close(back) {
      if (dr.hidden) return;
      dr.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      if (back) { btn.focus(); }
    }
    btn.addEventListener('click', function () { if (dr.hidden) { open(); } else { close(true); } });
    dr.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]')) { close(true); }
    });
    /* الرجوع إلى صفحة محفوظة في ذاكرة المتصفح بعد التنقل من الدرج: تعود مغلقة */
    window.addEventListener('pageshow', function (e) { if (e.persisted) { close(false); } });
    /* اتساع النافذة إلى عرض الشريط الكامل يُسقط الدرج */
    if (wide) {
      var onWide = function () { if (wide.matches) { close(false); } };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }

  /* ---------------------------------------------------------------- الإقلاع */
  function boot(cfg) {
    document.body.insertAdjacentHTML('afterbegin', shellHTML(cfg));
    wireDrawer();
    watchTables();
    /* ظل الترويسة اللاصقة */
    var mast = document.getElementById('masthead');
    if (mast) {
      var onScroll = function () { mast.classList.toggle('scrolled', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    var modeTag = document.getElementById('admMode');
    var logout = document.getElementById('admLogout');
    var who = document.getElementById('admWho');

    if (!API || !API.LIVE) {
      modeTag.textContent = 'غير متصل بالقاعدة';
      document.documentElement.setAttribute('data-mode', 'demo');
      return Promise.resolve(null);
    }

    return API.requireStaff().then(function (st) {
      if (!st) return null;                       /* جارٍ التحويل لصفحة الدخول */
      if (st.unverified) {
        modeTag.textContent = 'تعذّر التحقق من الصلاحية';
        return st;
      }
      modeTag.textContent = 'بيانات حيّة';
      modeTag.setAttribute('data-live', '1');
      document.documentElement.setAttribute('data-role', st.role || 'admin');
      var whoText = (st.name || 'موظف') + (st.role === 'viewer' ? ' — صلاحية اطّلاع' : '');
      if (who) { who.textContent = whoText; }
      var dWho = document.getElementById('admDrawerWho');
      if (dWho) { dWho.textContent = whoText; }
      /* زر الخروج في الترويسة وفي الدرج: الثاني وحده ظاهر على الهاتف */
      [logout, document.getElementById('admLogout2')].forEach(function (b) {
        if (!b) return;
        b.hidden = false;
        b.addEventListener('click', function () {
          API.signOut().then(function () { window.location.replace('admin-login.html'); });
        });
      });
      return st;
    });
  }

  /* ---------------------------------------------------------------- أحدث نسخة من التطبيق */
  /* بطاقة رقم آخر إصدار نشط ورابط تنزيله — من check_update نفسها التي تسأل عنها
     الأجهزة، فما تعرضه اللوحة هو ما يُحال إليه المهندس في شاشة التحديث */
  var AV_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/>' +
    '<path d="M10.5 18.5h3"/></svg>';
  var AV_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/>' +
    '<path d="M5 20h14"/></svg>';
  function appVersionCard(host) {
    if (!host || !API || !API.checkUpdate) return Promise.resolve(null);
    host.innerHTML = '<div class="adm-appver"><p class="av-wait">جارٍ قراءة أحدث نسخة…</p></div>';
    return API.checkUpdate(0).then(function (r) {
      var url = r && /^https:\/\/[^\s"<>]+$/.test(String(r.download_url || '')) ? r.download_url : '';
      if (!r) {
        host.innerHTML = '<div class="adm-appver"><p class="av-wait">لا يوجد إصدار منشور للتطبيق بعد.</p></div>';
        return null;
      }
      var forced = (r.min_supported | 0) >= (r.latest_code | 0);
      host.innerHTML = '<section class="adm-appver" aria-label="أحدث نسخة من التطبيق">' +
        '<div class="av-id"><span class="av-ico">' + AV_PHONE + '</span><div>' +
          '<span class="av-cap">تطبيق المنصة — أحدث نسخة</span>' +
          '<div class="av-ver"><b dir="ltr">' + esc(r.latest_name) + '</b>' +
            '<span>بناء ' + toAr(r.latest_code | 0) + '</span>' +
            (forced ? '<span class="tag tag--gold">تحديث إجباري</span>'
                    : '<span class="tag">تحديث اختياري</span>') + '</div>' +
        '</div></div>' +
        (url
          ? '<div class="av-acts">' +
              '<a class="btn btn-primary" href="' + esc(url) + '" rel="noopener">' + AV_DOWN + 'تحميل التطبيق</a>' +
              '<button type="button" class="btn btn-outline" data-av-copy>نسخ الرابط</button>' +
            '</div>' +
            '<p class="av-url" dir="ltr" data-av-url>' + esc(url) + '</p>'
          : '<p class="av-wait">الإصدار المنشور بلا رابط تنزيل.</p>') +
      '</section>';
      var btn = host.querySelector('[data-av-copy]');
      if (btn) {
        btn.addEventListener('click', function () {
          var done = function () { toast('نُسخ رابط التحميل.', 'ok'); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function () { selectUrl(); });
          } else { selectUrl(); }
        });
      }
      function selectUrl() {
        var el = host.querySelector('[data-av-url]');
        var rg = document.createRange(); rg.selectNodeContents(el);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg);
        toast('حُدّد الرابط — انسخه يدوياً.', 'ok');
      }
      return r;
    }).catch(function () {
      host.innerHTML = '<div class="adm-appver"><p class="av-wait">تعذّرت قراءة أحدث نسخة من التطبيق.</p></div>';
      return null;
    });
  }

  window.ADMIN = {
    boot: boot,
    appVersionCard: appVersionCard,
    NAV: NAV,
    ICONS: ICONS,
    toast: toast,
    sheet: sheet,
    confirm: confirmAsk,
    errText: errText,
    exportCsv: exportCsv,
    pager: pager,
    emptyState: emptyState,
    errorState: errorState,
    toAr: toAr,
    num: num,
    count: count,
    arDate: arDate,
    arDateShort: arDateShort,
    arDateTime: arDateTime,
    secDur: secDur,
    bytes: bytes,
    esc: esc,
    norm: norm,
    debounce: debounce
  };
})();
