/* ======================================================================
   ملحق لوحة الإدارة — الدفع الآلي عبر شام كاش (ترحيلتا ٠٣٧ و٠٣٨)
   ----------------------------------------------------------------------
   يمدّ OSEA_API.admin بدوال الفواتير والإشعارات والاسترداد والمطابقة
   ومفتاح الدفع، ولا يعدّل osea-api.js: يُحمَّل بعده في الصفحات التي
   تحتاجه وحدها (المدفوعات، والمطابقة، والنظرة العامة). وهو مستبعَد من
   حزمة تطبيق العضو (tools/sync-app.mjs) — لا شأن للعضو بهذه الدوال.

   العميل نفسه بجلسته (OSEA_API._sb) لا عميل ثانٍ: عميلان في صفحة واحدة
   يتسابقان على تجديد رمز الجلسة فيُطرد الموظف بلا سبب ظاهر.

   كل دالة محمية داخل القاعدة أو داخل دالة الحافّة (is_staff للقراءة،
   is_admin للاسترداد وجلب الكشف ومفتاح الدفع) — الحارس هنا راحة واجهة.
   ====================================================================== */
(function () {
  'use strict';

  var API = window.OSEA_API;
  if (!API || !API.admin) { return; }
  var cfg = window.OSEA_CONFIG || {};
  var sb = API._sb || null;

  /* مهلة كل نداء لدالة حافّة: فحص الفاتورة نداء getBillInfo واحد بمهلة
     ١٠ ث داخل الدالة، والاسترداد ٢٠ ث، وجلب الكشف حتى ٥٠ صفحة متتالية */
  var FN_MS = { 'sham-recon:bill': 45000, 'sham-recon:ledger': 170000, 'sham-refund': 60000 };

  function offline() {
    /* نسخة osea-api.js أقدم من الملحق (ذاكرة المتصفح) لا تحمل المنفذ _sb */
    if (API.LIVE && !sb) {
      return Promise.reject(new Error(
        'ملحق شام كاش يحتاج نسخة أحدث من ملفات اللوحة — حدّث الصفحة تحديثاً كاملاً (Ctrl+F5).'));
    }
    return Promise.reject(new Error('تتطلب لوحة الإدارة الاتصال بالقاعدة'));
  }
  function must(res) {
    if (res.error) { throw res.error; }
    return res.data;
  }
  function rpc(name, args) {
    if (!API.LIVE || !sb) { return offline(); }
    return sb.rpc(name, args || {}).then(must);
  }

  /* خطأ عربي يحمل رمز المزوّد (code) والرمز الإنجليزي للدالة (reason)،
     وجسم الردّ كاملاً (body) — نافذة الاسترداد تقرأ منه صفّ الاسترداد */
  function fnError(msg, reason, status, body) {
    var e = new Error(msg);
    e.reason = reason || null;
    e.status = status || 0;
    e.code = (body && body.code != null) ? body.code : null;
    e.body = body || null;
    e.refund = (body && body.refund) || null;
    return e;
  }
  function hasAr(s) { return /[؀-ۿ]/.test(String(s || '')); }

  /* رسالة عربية حين لا يحمل الردّ واحدة: دالة غير منشورة تعيد 404 من
     المنصة نفسها بجسم إنجليزي، وانتهاء الجلسة 401 بلا رسالة عربية */
  function statusText(status, reason) {
    if (reason === 'unknown') { return 'لم يُعرف مصير العملية — أعد المحاولة بالمفتاح نفسه.'; }
    if (status === 401) { return 'انتهت جلسة الطاقم — سجّل الدخول من جديد ثم أعد المحاولة.'; }
    if (status === 403) { return 'هذا الإجراء يتطلب صلاحية المدير.'; }
    if (status === 404) {
      return reason === 'unknown bill'
        ? 'الفاتورة غير موجودة في دفتر المنصة.'
        : 'دالة شام كاش غير منشورة على الخادم بعد — يلزم نشر دوال الحافّة أولاً.';
    }
    if (status === 409 && reason === 'too early') {
      return 'لم تمضِ عشر دقائق على إنشاء الفاتورة — شام كاش يمنع السؤال عنها قبل ذلك.';
    }
    if (status === 429 || reason === 'busy') {
      return 'فُحصت هذه الفاتورة قبل أقل من دقيقتين — انتظر قليلاً ثم أعد المحاولة.';
    }
    if (status === 503) { return 'خدمة شام كاش غير مهيأة على الخادم (الأسرار أو المفاتيح) — راجع المشغّل.'; }
    if (status === 504 || status === 0) { return 'تعذّر الوصول إلى بوابة شام كاش الآن — أعد المحاولة بعد قليل.'; }
    if (status === 502) { return 'ردّ غير مفهوم من بوابة شام كاش — أعد المحاولة بعد قليل.'; }
    if (status === 400) { return 'الطلب مرفوض — تحقق من القيم المدخلة.'; }
    return 'تعذّر إتمام العملية (' + status + ').';
  }

  /* نداء دالة حافّة بجلسة الموظف: الدالة تتحقق من JWT المستدعي ثم من
     is_staff/is_admin بنفسها، فلا يكفي مفتاح الزائر هنا */
  function callFn(slug, body, key) {
    if (!API.LIVE || !sb) { return offline(); }
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('المتصفح لا يدعم هذا الإجراء — استعمل متصفحاً حديثاً.'));
    }
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = null;
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s || !s.access_token) {
        throw fnError('انتهت جلسة الطاقم — سجّل الدخول من جديد ثم أعد المحاولة.', 'unauthorized', 401, null);
      }
      if (ctl) { timer = setTimeout(function () { ctl.abort(); }, FN_MS[key || slug] || 45000); }
      return fetch(cfg.SUPABASE_URL + '/functions/v1/' + slug, {
        method: 'POST',
        signal: ctl ? ctl.signal : undefined,
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + s.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (res.ok && j && j.ok !== false) { return j; }
          var reason = (j && typeof j.error === 'string') ? j.error : null;
          var msg = (j && hasAr(j.message)) ? j.message
                  : (reason && hasAr(reason)) ? reason
                  : statusText(res.status, reason);
          throw fnError(msg, reason, res.status, j);
        });
      }, function (netErr) {
        /* انقطاع أو انتهاء المهلة: في الاسترداد لا يعني الفشل — المفتاح
           محفوظ قبل نداء المزوّد، والإعادة به آمنة */
        var aborted = netErr && netErr.name === 'AbortError';
        throw fnError(aborted
          ? 'انتهت مهلة الانتظار قبل وصول الردّ — النتيجة غير معروفة؛ أعد المحاولة (بالمفتاح نفسه للاسترداد).'
          : 'تعذّر الاتصال بالخادم — تحقق من إنترنتك ثم أعد المحاولة.', 'network', 0, null);
      });
    }).then(function (v) {
      if (timer) { clearTimeout(timer); }
      return v;
    }, function (e) {
      if (timer) { clearTimeout(timer); }
      throw e;
    });
  }

  /* مفتاح تماثل الاسترداد: RF- + uuid v4 (٣٩ محرفاً ضمن قيد ٠٣٨
     ^[A-Za-z0-9_-]{10,100}$). يُولَّد عند فتح النافذة ويُعاد إرساله
     في كل ضغطة حتى تُغلق بنجاح — فالإعادة بعد انقطاع لا تكرّر الاسترداد */
  function newIdempotencyKey() {
    var b = new Array(16), i, h = [];
    var c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      var u = new Uint8Array(16);
      c.getRandomValues(u);
      for (i = 0; i < 16; i++) { b[i] = u[i]; }
    } else {
      for (i = 0; i < 16; i++) { b[i] = Math.floor(Math.random() * 256); }
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    for (i = 0; i < 16; i++) { h.push((b[i] + 0x100).toString(16).slice(1)); }
    return 'RF-' + h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
      h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
  }

  var ext = {
    /* دفتر الفواتير (٠٣٧): p = {state, from, to, q, limit, offset} */
    shamBills: function (o) { return rpc('admin_sham_bills', { p: o || {} }); },
    /* سجل الإشعارات الواردة من شام كاش (٠٣٧) */
    shamWebhookEvents: function (o) { return rpc('admin_sham_webhook_events', { p: o || {} }); },
    /* «تحقق الآن»: getBillInfo واحد لفاتورة بعينها — طاقم بأي صلاحية */
    shamCheckNow: function (billNo) {
      return callFn('sham-recon', { mode: 'bill', bill_no: billNo }, 'sham-recon:bill');
    },
    /* الاسترداد: مدير فقط، والمفتاح يرسله المستدعي دائماً (newIdempotencyKey) */
    shamRefund: function (r) {
      r = r || {};
      return callFn('sham-refund', {
        bill_no: r.bill_no,
        amount: r.amount,
        note: r.note || null,
        idempotency_key: r.idempotency_key,
        revoke: !!r.revoke
      });
    },
    /* سجل الاستردادات (٠٣٨) */
    shamRefunds: function (o) { return rpc('admin_sham_refunds', { p: o || {} }); },
    /* جلب كشف getTransactions لمدى (≤ ٣١ يوماً) — مدير فقط */
    shamLedgerFetch: function (from, to) {
      return callFn('sham-recon', { mode: 'ledger', from: from || undefined, to: to || undefined },
        'sham-recon:ledger');
    },
    /* مقارنة الكشف المجلوب بدفتر المنصة (٠٣٨) — المدى ≤ ٩٣ يوماً */
    shamLedgerDiff: function (from, to) {
      return rpc('admin_sham_ledger_diff', { p_from: from, p_to: to });
    },
    /* الإيراد الصافي: المدقَّق غير المعفى ناقص الاستردادات الناجحة (٠٣٨) */
    revenue: function (from, to) {
      return rpc('admin_revenue', { p_from: from || null, p_to: to || null });
    },
    /* مفتاح الدفع والمختبرون والتجربة المجانية ورابط التحقق (٠٣٧) */
    platformSettings: function () { return rpc('admin_platform_settings', {}); },
    /* حفظ جزئي: المفاتيح الحاضرة وحدها تُكتب */
    setPlatformSettings: function (p) { return rpc('admin_set_platform_settings', { p: p || {} }); },
    newIdempotencyKey: newIdempotencyKey
  };

  for (var k in ext) {
    if (Object.prototype.hasOwnProperty.call(ext, k)) { API.admin[k] = ext[k]; }
  }
})();
