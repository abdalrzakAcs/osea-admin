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
    { key: 'results',   href: 'admin-results.html',   label: 'النتائج والشهادات' },
    { key: 'content',   href: 'admin-content.html',   label: 'المحتوى' },
    { key: 'folders',   href: 'admin-folders.html',   label: 'المجلدات والتسعير' },
    { key: 'news',      href: 'admin-news.html',      label: 'الأخبار' },
    { key: 'accredit',  href: 'admin-accredit.html',  label: 'سجل الاعتمادات' },
    { key: 'jobs',      href: 'admin-jobs.html',      label: 'فرص العمل' },
    { key: 'discounts', href: 'admin-discounts.html', label: 'الخصومات' },
    { key: 'codes',     href: 'admin-codes.html',     label: 'الأكواد المُوجَّهة' },
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
    info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
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
    var nav = NAV.map(function (n) {
      return '<a class="nav-item' + (n.key === cfg.page ? ' active' : '') + '" href="' +
        n.href + '"' + (n.key === cfg.page ? ' aria-current="page"' : '') + '>' +
        esc(n.label) + '</a>';
    }).join('');

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
        '<span class="tag tag--navy">لوحة الإدارة</span>' +
        '<button class="btn btn-outline btn-sm" id="admLogout" hidden>خروج</button>' +
        '<a href="index.html" class="btn btn-outline btn-sm">العودة إلى المنصة</a>' +
      '</div>' +
    '</div></header>' +

    '<nav class="navbar" aria-label="تنقل لوحة الإدارة"><div class="container">' +
      '<button class="nav-toggle" id="admNavToggle" aria-expanded="false" aria-controls="admNavMenu">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
        'القائمة</button>' +
      '<div class="nav-menu" id="admNavMenu">' + nav + '</div>' +
    '</div></nav>' +

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

  /* ---------------------------------------------------------------- اللوحة الجانبية */
  function sheet(opts) {
    var host = document.createElement('div');
    host.className = 'adm-sheet on';
    host.innerHTML =
      '<div class="adm-sheet-veil" data-close></div>' +
      '<div class="adm-sheet-panel" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
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

    function close() { document.removeEventListener('keydown', onKey); host.remove(); }
    /* الهروب يسلك طريق زر الإلغاء نفسه: نقرته تُشغّل مستمع الإغلاق ومستمع
       confirmAsk (حلّ الوعد بـnull) معاً — فلا يبقى تأكيد معلّقاً بلا جواب */
    function onKey(e) {
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
    if (first) { first.focus(); }
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

  /* ---------------------------------------------------------------- الإقلاع */
  function boot(cfg) {
    document.body.insertAdjacentHTML('afterbegin', shellHTML(cfg));

    /* قائمة الموبايل */
    var tg = document.getElementById('admNavToggle');
    var menu = document.getElementById('admNavMenu');
    if (tg) {
      tg.addEventListener('click', function () {
        var open = tg.getAttribute('aria-expanded') === 'true';
        tg.setAttribute('aria-expanded', open ? 'false' : 'true');
        menu.classList.toggle('open', !open);
      });
    }
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
      if (who) {
        who.textContent = (st.name || 'موظف') +
          (st.role === 'viewer' ? ' — صلاحية اطّلاع' : '');
      }
      logout.hidden = false;
      logout.addEventListener('click', function () {
        API.signOut().then(function () { window.location.replace('admin-login.html'); });
      });
      return st;
    });
  }

  window.ADMIN = {
    boot: boot,
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
