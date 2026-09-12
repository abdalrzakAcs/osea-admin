/* ======================================================================
   طبقة البيانات الموحّدة — واجهة واحدة بوضعين
   المصدر الوحيد هو قاعدة النقابة (Supabase). لا طبقة بيانات بديلة.
   كل الصفحات تستدعي OSEA_API فقط ولا تعرف أي الوضعين يعمل.
   ====================================================================== */
(function () {
  'use strict';

  var cfg = window.OSEA_CONFIG || {};
  var LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  var sb = LIVE ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  /* الأرقام لاتينية 1 2 3 … بقرار العميل («أرقام واضحة»). الاسم toAr
     باقٍ لأن الموقع واللوحة والتطبيق يستدعونه في عشرات المواضع، وصار
     ممرّاً واحداً يوحّد شكل الأرقام ويحوّل أي هندي وارد إلى لاتيني. */
  var toAr = function (n) {
    return String(n)
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
  };
  var AR_MONTHS = ['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
  function arDate(iso) {
    if (!iso) return '—';
    /* نص تاريخي فقط YYYY-MM-DD: يُفكَّك يدوياً — تمريره لـ new Date يفسَّر
       منتصف ليل UTC فينقص يوماً في المناطق السالبة عن غرينتش */
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (m) return toAr(+m[3]) + ' ' + AR_MONTHS[+m[2] - 1] + ' ' + toAr(+m[1]);
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return toAr(d.getDate()) + ' ' + AR_MONTHS[d.getMonth()] + ' ' + toAr(d.getFullYear());
  }
  /* تاريخ ووقت معاً «١٥ آب ٢٠٢٦ · ١٤:٢٠» — الطوابع الكاملة تُعرض بتوقيت الجهاز،
     والتواريخ المجردة YYYY-MM-DD تبقى على مسار arDate اليدوي الآمن */
  function arDateTime(iso) {
    if (!iso) return '—';
    var s = String(iso);
    if (s.indexOf('T') === -1) return arDate(s);
    var d = new Date(s);
    if (isNaN(d)) return arDate(s);
    var hh = (d.getHours() < 10 ? '0' : '') + d.getHours();
    var mm = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    return toAr(d.getDate()) + ' ' + AR_MONTHS[d.getMonth()] + ' ' + toAr(d.getFullYear()) +
           ' · ' + toAr(hh) + ':' + toAr(mm);
  }
  /* مدة درس «١٤:١٠» (دقائق:ثوانٍ بأرقام هندية) → ثوانٍ */
  function durSec(s) {
    var ascii = String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
    var p = ascii.split(':');
    if (p.length !== 2) return 0;
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  /* ثوانٍ → «١٤:١٠» بأرقام هندية */
  function secDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return toAr(m) + ':' + toAr((s < 10 ? '0' : '') + s);
  }

  /* حُذفت طبقة «الوضع التوضيحي» بالكامل: كانت تُرجع حسابات وشهادات
     مخترَعة عند تعذّر الوصول للقاعدة. البديل دالة offline() أدناه —
     تفشل بصوت عالٍ فلا يرى العضو بيانات وهمية ظنّاً أنها حقيقية. */


  /* ---------- الوضع الحي ---------- */
  function must(res) {
    if (res.error) { throw res.error; }
    return res.data;
  }

  var live = {
    /* التسجيل عبر دالة آمنة تُعيد الحقول العلنية فقط — جدول الحسابات يبقى
       غير مقروء للزائر (الإدراج المباشر مع select يفشل بسياسة الأمان). */
    register: function (acc) {
      return sb.rpc('register_account', {
        p_name: acc.name,
        p_synd_no: acc.synd_no,
        p_national_id: acc.national_id,
        p_branch: acc.branch || 'دمشق',
        p_contact_method: acc.contact_method || 'phone',
        p_phone: acc.phone || null,
        p_email: acc.email || null,
        p_password: acc.password || null
      }).then(must);
    },
    accounts: function () {
      return sb.from('accounts').select('*').order('created_at', { ascending: false }).then(must);
    },
    setStatus: function (id, status, note) {
      return sb.from('accounts').update({ status: status, note: note || null })
        .eq('id', id).select().single().then(must);
    },
    payments: function () {
      return sb.from('payments')
        .select('*, accounts(name, branch, exempt)')
        .order('paid_at', { ascending: false }).limit(200).then(must);
    },
    /* 🔴 الإدراج المباشر كان يفشل بسياسات الأمان لأي عضو (مفتاح الزائر) —
       فكل تسجيل دفعة حقيقي بعد تفعيل الرسوم كان سيضيع. الدالة الخادمية
       تتحقق وتُدرج بصلاحياتها وتعيد رسائل عربية واضحة. */
    addPayment: function (p) {
      return sb.rpc('member_submit_payment', {
        p_account: p.account_id, p_op_no: p.op_no, p_amount: p.amount,
        p_service: p.service || null, p_item: p.item_id || null,
        /* القناة والموعد (ترحيلة ٠٢٦): شام كاش الافتراض، والموعد لحجز
           دورة الارتقاء وحده — الوصل الواحد يجمع الدفع والحجز */
        p_method: p.method || 'sham', p_slot: p.slot_at || null
      }).then(must);
    },
    /* فرع العضو يحدده بنفسه (طلب النقابة ٢ أيلول) — القائمة تُفرض خادمياً */
    setBranch: function (id, branch) {
      if (!LIVE) return Promise.reject(new Error('قاعدة النقابة غير متاحة'));
      return sb.rpc('member_set_branch', { p_account: id, p_branch: branch }).then(must);
    },
    /* الرقم النقابي يكتبه العضو ولا يصير معتمداً بكتابته: الدالة تضعه
       «قيد المراجعة» حتى تصادق عليه اللوحة، لأنه مفتاح الهوية الرسمي
       ولو قُبل كما ورد لأمكن أن ينتحل عضوٌ رقم زميله ويرث محتواه. */
    /* كلمة المرور وسيطٌ ثالث إلزامي: الرقم النقابي معرّف دخول (login_account
       تبحث به)، وقاعدة المنصة منذ ٠٠٩ج أن تغيير معرّف دخول يمرّ بكلمة
       المرور. والدالة تردّ { ok:false, error } عند خطأ كلمة المرور بدل
       رفع استثناء — كي لا تُلغى زيادةُ عدّاد المحاولات مع المعاملة —
       فعلى المستدعي فحصُ r.ok لا الاكتفاء بـ catch. */
    setSyndNo: function (id, syndNo, password) {
      if (!LIVE) return Promise.reject(new Error('قاعدة النقابة غير متاحة'));
      return sb.rpc('member_set_synd_no', {
        p_account: id, p_synd_no: syndNo, p_password: password
      }).then(must);
    },
    /* المرتبة الهندسية طلبٌ لا إعلان (ترحيلة ٠٢٦): العضو يطلب متدرب/مشارك/
       ممارس/استشاري، والإدارة وحدها تعتمد. الفصل واجب لأن المرتبة تفتح
       محتوى ورسوماً، فلا تُترك بيد صاحب المصلحة فيها. */
    setGradeRequest: function (id, grade) {
      if (!LIVE) return Promise.reject(new Error('قاعدة النقابة غير متاحة'));
      return sb.rpc('member_set_grade_request', { p_account: id, p_grade: grade }).then(must);
    },
    attempts: function () {
      return sb.from('attempts')
        .select('*, accounts(name, branch)')
        .order('taken_at', { ascending: false }).limit(100).then(must);
    },
    addAttempt: function (a) {
      return sb.from('attempts').insert(a).select().single().then(must);
    },
    certs: function () {
      return sb.from('certificates').select('*').order('issued_at', { ascending: false })
        .limit(100).then(must).then(function (rows) {
          rows.forEach(function (r) { r.issued_at_ar = arDate(r.issued_at); r.score = toAr(r.score) + '٪'; });
          return rows;
        });
    },
    findCert: function (code) {
      /* التحقق العام عبر دالة verify_certificate (ترحيل 014): تُعيد صفاً
         واحداً بالحقول العامة فقط دون account_id — القراءة المباشرة للجدول
         أُلغيت عن anon كي لا يُفرَّغ السجل ولا يُسرَّب رمز الحامل. */
      return sb.rpc('verify_certificate', { p_code: code }).then(must)
        .then(function (rows) {
          var r = Array.isArray(rows) ? (rows[0] || null) : (rows || null);
          if (r) {
            r.issued_at_ar = arDate(r.issued_at);
            /* شهادة مسحوبة تُعاد موسومة لا محجوبة: بوابة تحقق رسمية تقول
               «سُحبت بتاريخ كذا» — أما «غير موجودة» فتوحي بأن الرمز مزوَّر. */
            r.revoked = !!r.revoked_at;
            if (r.revoked) { r.revoked_at_ar = arDate(r.revoked_at); }
          }
          return r;
        });
    },
    issueCert: function (accountId, score) {
      return sb.rpc('issue_certificate', { p_account: accountId, p_score: score }).then(must);
    },
    /* إتمام درس بالمشاهدة الفعلية — عبر دالة upsert آمنة: الزائر يملك
       INSERT فقط بلا SELECT ولا UPDATE، فالترقية من العميل مستحيلة،
       وإعادة الإرسال كانت ترتدّ بانتهاك القيد الفريد (حساب، درس). */
    saveLessonProgress: function (p) {
      return sb.rpc('save_lesson_progress', {
        p_account: p.account_id, p_lesson: p.lesson_id,
        p_title: p.lesson_title || p.lesson_id,
        p_watched_s: p.watched_s | 0, p_total_s: p.total_s | 0
      }).then(must).then(function () { return { saved: true }; });
    },
    /* ملف المستخدم التفصيلي: خمس قراءات متوازية بمعرّف الحساب */
    accountProfile: function (id) {
      return Promise.all([
        sb.from('accounts').select('*').eq('id', id).maybeSingle().then(must),
        sb.from('lesson_progress').select('*').eq('account_id', id)
          .order('completed_at', { ascending: true }).then(must),
        sb.from('attempts').select('*').eq('account_id', id)
          .order('taken_at', { ascending: true }).then(must),
        sb.from('payments').select('*').eq('account_id', id)
          .order('paid_at', { ascending: true }).then(must),
        sb.from('certificates').select('*').eq('account_id', id)
          .order('issued_at', { ascending: true }).then(must)
      ]).then(function (r) {
        if (!r[0]) return null;
        return {
          account: r[0],
          lessons: r[1] || [],
          attempts: r[2] || [],
          payments: r[3] || [],
          certs: (r[4] || []).map(function (c) {
            return { code: c.code, cert_type: c.cert_type,
                     score_ar: toAr(c.score) + '٪', issued_at_ar: arDate(c.issued_at) };
          })
        };
      });
    },
    stats: function () {
      return sb.rpc('admin_stats').then(must);
    },
    signIn: function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password }).then(must);
    },
    signOut: function () { return sb.auth.signOut(); },
    session: function () {
      return sb.auth.getSession().then(function (r) { return r.data.session; });
    },
    isStaff: function () {
      /* role لازم: اللوحة تُخفي أدوات الكتابة عن صلاحية الاطّلاع (viewer).
         تقييد الصفّ بالمستخدم الحالي صراحةً واجب ولا يجوز الاتكال على RLS:
         سياسة staff_self_select تعيد سجلّ صاحبها وحده، لكن هجرة 003 أضافت
         staff_admin_all (قراءة كل الطاقم للمدير) — وسياسات RLS المتعددة
         تُجمَع بـOR، فصار الاستعلام يعيد كل سجلّات الطاقم للمدير. ومع أكثر
         من سجلّ ينفجر maybeSingle بخطأ PGRST116 فيُقرأ كأنه فشل دخول:
         «بيقول غلط وبعدين رفرش بيفتح». المدراء وحدهم يقعون فيه، وصلاحية
         الاطّلاع (viewer) تعمل — لأن السياسة الثانية لا تنطبق عليها. */
      return sb.auth.getSession().then(function (s) {
        var sess = s.data.session;
        var uid = sess && sess.user && sess.user.id;
        if (!uid) { return null; }
        return sb.from('staff').select('user_id, name, role').eq('user_id', uid)
          .maybeSingle().then(function (r) {
            /* خطأ شبكي ≠ «ليس من الطاقم»: يُرمى ليعالَج أعلى بدل تسجيل خروج مدير صالح */
            if (r.error) { throw r.error; }
            return r.data || null;
          });
      });
    }
  };

  /* ---------- المحتوى المحمي والامتحان الخادمي وبوابة التحديث ----------
     الملفات في سلة تخزين خاصة: لا تُفتح إلا برابط موقّع تصدره دالة الحافّة
     بعد التحقق، وصلاحيته خمس دقائق. مفتاح الخدمة لا يصل التطبيق إطلاقاً. */
  var content = {
    /* كتالوج المحتوى: كتب/استمارات/دروس */
    catalog: function (kind) {
      if (!LIVE) return Promise.resolve(null);
      var q = sb.from('content_items').select('*').eq('active', true).order('sort');
      if (kind) { q = q.eq('kind', kind); }
      return q.then(must);
    },
    /* مجلدات المحتوى (ترحيل 021): تصنيفٌ وتسعيرٌ يديرهما المدير — القراءة
       العلنية للنشط فقط (RLS)، والفشل بصوت عالٍ كسائر القراءات الحيّة. */
    folders: function () {
      if (!LIVE) { return offline('المجلدات')(); }
      /* قائمة أعمدة صريحة: عمود الملاحظة الداخلية محجوب بمنحٍ عمودي،
         و«*» تُرفض من Postgres حين ينقص امتياز عمودٍ واحد. */
      return sb.from('content_folders').select('id,name,domain,kind,access,price_month,price_year,price_once,sort,active').eq('active', true).order('sort').then(must);
    },
    /* مجالات المحتوى: كان المجال نصّاً حرّاً داخل صف المجلد، فتعدّدت تهجئة
       المجال الواحد وتفرّقت مجلداته إلى قسمين في شاشة المحتوى. صار جدولاً
       يديره المدير ترتيباً وتسميةً، والقراءة العلنية للنشط وحده (RLS).
       الإرجاع مغلَّف { domains } لا مصفوفة عارية: الشاشات تقرأ r.domains،
       فيبقى الشكل واحداً لو رافق المجالات لاحقاً عدّادٌ أو إعداد عرض. */
    domains: function () {
      if (!LIVE) { return offline('مجالات المحتوى')(); }
      /* أعمدة صريحة كنمط folders أعلاه: «*» تُرفض من Postgres حين ينقص
         امتياز عمودٍ واحد على الجدول */
      /* بلا ‎.eq('active', true)‎ عمداً: الخريطة يجب أن تكون كاملة. المجال
         الموقوف لو غاب عن الردّ لعاد usesSubfolders إلى افتراضه (true)،
         فينقلب مجالٌ ضُبط على «الكتاب مباشرةً» إلى شاشة المجلدات لحظة
         إيقافه — انقلابٌ صامت في سلوك ضبطته الإدارة. الشاشة تقرأ active
         وتخفي الموقوف بنفسها. */
      return sb.from('content_domains').select('id,name,sort,use_subfolders,active')
        .order('sort').order('name').then(must)
        .then(function (rows) { return { domains: rows || [] }; });
    },
    /* رابط موقّع قصير العمر — يُطلب لحظة الفتح ولا يُخزَّن.
       بمهلة صريحة: طلب معلّق بلا نهاية يترك الشاشة عالقة على المؤشر. */
    url: function (itemId, accountId) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      return fetch(cfg.SUPABASE_URL + '/functions/v1/content-url', {
        signal: ctl ? ctl.signal : undefined,
        method: 'POST',
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ item: itemId, account: accountId || null })
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (e) {
            /* رموز دالة الحافّة إنجليزية، وشاشة القارئ تطبع الرسالة كما هي
               فيقرأ العضو «تعذّر تحميل الكتاب — account required». الترجمة
               هنا لا في الشاشة كي تنتفع بها كل مستدعية للدالة. */
            var AR = {
              'account required': 'هذا المحتوى للأعضاء — سجّل حسابك في المنصة لفتحه.',
              'not approved': 'حسابك قيد مراجعة إدارة النقابة — يُفتح المحتوى فور الموافقة.',
              'not found': 'هذا البند غير منشور حالياً.',
              'sign failed': 'تعذّر تجهيز الملف على الخادم — أعد المحاولة بعد قليل.',
              'subscription required': 'هذا المحتوى ضمن اشتراك مدفوع — فعّل الاشتراك من شاشة الدفع ثم أعد المحاولة.'
            };
            var code = (e && e.error) || '';
            throw new Error(AR[code] || code || ('تعذّر طلب الملف (' + r.status + ')'));
          });
        }
        return r.json();
      }).then(function (j) { return j.url; })
        .catch(function (e) {
          clearTimeout(timer);
          throw new Error(e && e.name === 'AbortError' ? 'انتهت مهلة طلب الرابط' : (e && e.message) || 'تعذّر طلب الرابط');
        });
    }
  };

  /* ---------- الامتحان ----------
     الورقة تُصدَر من الخادم وتُحفَظ معرّفات أسئلتها في جلسة، والتصحيح يجري
     مقابل الورقة المحفوظة لا مقابل ما يرسله العميل — وإلا صار بالإمكان
     إرسال إجابة صحيحة واحدة والحصول على مئة بالمئة. */
  var exam = {
    /* ترجع { session, count, questions:[{id,q,opts}] } — بلا مفاتيح إجابات */
    paper: function (n, accountId) {
      if (!LIVE) return Promise.resolve(null);
      return sb.rpc('exam_paper', { p_count: n || 20, p_account: accountId || null }).then(must);
    },
    /* ترجع { total, correct, score, passed, distinction, attempt, review }
       — review مصفوفة مراجعة الإجابات إذا فعّل المدير إعداد العرض، وإلا null */
    grade: function (session, answers, durationS) {
      if (!LIVE) return Promise.resolve(null);
      return sb.rpc('grade_exam', {
        p_session: session, p_answers: answers,
        p_duration_s: (durationS == null ? null : durationS | 0)
      }).then(must);
    },
    /* الإعدادات العامة غير الحساسة (ترحيل 010) — null يعني تعذّر القراءة */
    settings: function () {
      if (!LIVE) return Promise.resolve(null);
      return sb.rpc('public_settings', {}).then(must).catch(function () { return null; });
    }
  };

  /* ---------- الرسوم المعتمدة (ترحيل 021) ----------
     رسوم الاختبار من جدول products: القراءة العلنية للنشط فقط (RLS)،
     وشاشة الدفع تعرض المبلغ منها لا من ثوابت مكتوبة يدوياً. */
  function pricing() {
    if (!LIVE) { return offline('الرسوم')(); }
    return sb.from('products').select('*').eq('active', true).order('sort').then(must);
  }

  /* ---------- الدفع الآلي عبر شام كاش (بوابة ePay) ----------
     يُضاف **إلى جانب** المسار اليدوي لا بدلاً منه: المسار اليدوي (يحوّل
     العضو بنفسه في تطبيق شام كاش ثم يكتب رقم العملية فتدقّقه الإدارة)
     يبقى كما هو حرفاً بحرف — هو الاحتياط حين لا تكون البوابة مضبوطة بعد،
     وهو الطريق الوحيد لسيريتل كاش.

     🔒 المفتاح السري للبوابة لا يمرّ من هنا إطلاقاً ولا يصل الجهاز:
     حزمة الأندرويد قابلة للفكّ، فالتشفير (JWE / A256GCM) وإنشاء الفاتورة
     يجريان داخل دالة الحافّة sham-pay وحدها بمفاتيح من متغيّرات البيئة،
     والمتصفح لا يرى إلا رابط الدفع الذي ردّته البوابة.

     🔒 المبلغ لا يُرسل من العميل: الطلب يحمل «الخدمة» و«البند» فقط
     وتحسب دالة الحافّة الرسم من جدول الرسوم. لو أُرسل المبلغ من الشاشة
     لأمكن لأي عضو تعديل الطلب ودفع ليرة واحدة ثم قبض الاستحقاق كاملاً.

     قاعدة المزوّد الملزمة: الفاتورة تُنشأ **لحظة ضغط زر الدفع النهائي**
     لا قبله — عمرها عشر دقائق يبدأ من الإنشاء. فلا shamStart عند فتح
     الشاشة ولا عند اختيار الخدمة؛ والمزوّد يمنع الاستطلاع الدوري لحالة
     الفاتورة، فالحالة تُقرأ مرة عند العودة أو بضغطة «تحديث الحالة». */

  /* سؤال التوافر قصير: الشاشة لا تنتظره وتبقى صالحة للدفع اليدوي بدونه */
  var SHAM_PROBE_MS = 8000;
  /* إنشاء الفاتورة يمرّ ببوابة خارجية (تشفير + نداء شبكي إلى شام كاش)
     فيحتاج سعة أكبر من مهلة content-url؛ والانقطاع قبل الردّ لا يعني أن
     الفاتورة لم تُنشأ — لذلك رسالة المهلة تنهى عن إعادة المحاولة فوراً */
  var SHAM_START_MS = 25000;

  function shamAbort(ms) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    return { ctl: ctl, timer: setTimeout(function () { if (ctl) { ctl.abort(); } }, ms) };
  }

  var shamPay = {
    /* هل المسار الآلي متاح؟ — سؤالٌ **لا يُنشئ فاتورة**.
       الطلب GET عمداً: دالة الحافّة كأخواتها لا تقبل إلا POST، فأسوأ ما
       يمكن أن يردّه هو 405 ولا يُنشأ رقم فاتورة بالخطأ مهما كان جسدها —
       ولو سألنا بـPOST لخالفنا قاعدة «الفاتورة لحظة الضغط» من أول فتح.
       القراءة:
         • فشل شبكي أو 404 من بوابة الدوال ⇐ الدالة غير منشورة ⇐ لا مسار آلي.
         • 200 مع configured:false ⇐ منشورة بلا مفاتيح ⇐ لا مسار آلي.
         • أي ردّ آخر ⇐ الدالة موجودة فيُعرض الزر، وأخطاء الضبط تُترجم
           لحظة الضغط — أهون من إخفاء ميزة عاملة بسبب ردّ لم نفهمه.
       (اتفاق الواجهة: على sham-pay أن تردّ على GET ?probe=1 بـ
        { configured: true|false } كي يكون الإخفاء دقيقاً لا استنتاجياً.)
       والافتراض عند أي فشل هو false: تركيبٌ غير مضبوط يجب ألّا يفقد
       القدرة على الدفع — يبقى المسار اليدوي وحده كما هو اليوم. */
    shamAvailable: function () {
      if (!LIVE || typeof fetch !== 'function') { return Promise.resolve(false); }
      var a = shamAbort(SHAM_PROBE_MS);
      return fetch(cfg.SUPABASE_URL + '/functions/v1/sham-pay?probe=1', {
        signal: a.ctl ? a.ctl.signal : undefined,
        method: 'GET',
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY
        }
      }).then(function (r) {
        clearTimeout(a.timer);
        if (r.status === 404) { return false; }
        return r.json().catch(function () { return null; }).then(function (j) {
          return !(j && j.configured === false);
        });
      }).catch(function () {
        clearTimeout(a.timer);
        return false;
      });
    },

    /* إنشاء الفاتورة وطلب رابط الدفع — يُستدعى لحظة الضغط النهائي فقط.
       تُعيد { bill_no, payment_url, amount, raw } — والشاشة تنقل العضو
       إلى payment_url. الرابط يُفحص https هنا لا في الشاشة: أي مخطط آخر
       (javascript: أو intent:) يُنفَّذ داخل WebView أندرويد لو مُرِّر
       إلى location.href، فالفحص واجب على كل مستدعٍ لا على واحد. */
    shamStart: function (account, service, itemId) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      if (typeof fetch !== 'function') {
        return Promise.reject(new Error(
          'متصفح الجهاز لا يدعم الدفع الآلي — حوّل يدوياً عبر تطبيق شام كاش ثم سجّل رقم العملية أدناه.'));
      }
      var a = shamAbort(SHAM_START_MS);
      return fetch(cfg.SUPABASE_URL + '/functions/v1/sham-pay', {
        signal: a.ctl ? a.ctl.signal : undefined,
        method: 'POST',
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        /* بلا مبلغ عمداً — انظر رأس المنطقة */
        body: JSON.stringify({
          action: 'start',
          account: account || null,
          service: service || null,
          item: itemId || null,
          /* عنوان العودة بعد الدفع: الصفحة نفسها التي بدأ منها العضو بلا
             معاملات (رقم الفاتورة محفوظ على الجهاز وتسأل عنه الشاشة عند
             العودة). https حصراً، ودالة الحافّة تتجاهله ما لم يطابق نطاق
             المنصة المضبوط عندها — فلا يفتح هذا الحقل باب توجيهٍ إلى
             غريب. وبدونه يعود العضو إلى العنوان الافتراضي وحده. */
          redirect_url: (typeof location !== 'undefined' && location.protocol === 'https:')
            ? (location.protocol + '//' + location.host + location.pathname) : null
        })
      }).then(function (r) {
        clearTimeout(a.timer);
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (e) {
            /* رموز دالة الحافّة إنجليزية والشاشة تطبع الرسالة كما هي —
               الترجمة هنا كنمط content.url كي تنتفع بها كل مستدعية */
            var AR = {
              'account required': 'الدفع يتطلب حساباً في المنصة — سجّل دخولك ثم أعد المحاولة.',
              'not approved': 'حسابك قيد مراجعة إدارة النقابة — يُفتح الدفع فور الموافقة.',
              'service required': 'اختر الخدمة أولاً ثم أعد المحاولة.',
              'item required': 'حدّد الكتاب أو المجلد المطلوب الاشتراك به.',
              'not found': 'هذه الخدمة غير معروضة حالياً — أعد تحميل الشاشة.',
              'price unavailable': 'تعذّر تحديد رسم هذه الخدمة على الخادم — استعمل التحويل اليدوي أدناه.',
              'not configured': 'الدفع الآلي عبر شام كاش غير مفعّل بعد على المنصة — استعمل التحويل اليدوي أدناه.',
              'agent invalid': 'حساب المنصة لدى شام كاش غير فعّال حالياً — استعمل التحويل اليدوي وأبلغ النقابة.',
              'bill exists': 'أُنشئت فاتورتك سابقاً ولم تُلغَ — اضغط «تحديث الحالة» بدل إنشاء فاتورة ثانية.',
              'gateway error': 'تعذّر الاتصال ببوابة شام كاش الآن — أعد المحاولة بعد قليل أو حوّل يدوياً أدناه.'
            };
            var code = (e && e.error) || '';
            /* ترتيب مقصود: نصوصنا مضبوطة على شاشة الدفع وتحيل إلى التحويل
               اليدوي، ثم رسالة الخادم العربية لما لم نغطّه، ثم الرمز خاماً
               (قد يكون عربياً أصلاً فالخادم يضع العربية في error أحياناً) */
            var srv = (e && e.message) || '';
            var err = new Error(AR[code] ||
              (/[؀-ۿ]/.test(srv) ? srv : '') || code ||
              ('تعذّر إنشاء فاتورة الدفع (' + r.status + ')'));
            /* 🔴 رقم الفاتورة يرافق أخطاء البوابة (١٧٠٤ «الرقم مستعمل»
               خاصةً، وانقطاع الاتصال بعد الإنشاء): معناه أن الفاتورة
               أُنشئت فعلاً. القاعدة الملزمة من المزوّد أن تُصالَح على
               رقمها لا أن تُولَّد من جديد — فيُمرَّر الرقم إلى الشاشة
               لتحفظه وتسأل عن حالته بدل ضغطةٍ ثانية تُنشئ فاتورتين. */
            if (e && e.bill_no) { err.bill_no = String(e.bill_no); }
            throw err;
          });
        }
        return r.json();
      }).then(function (j) {
        var url = (j && (j.payment_url || j.paymentUrl)) || '';
        if (!/^https:\/\//i.test(url)) {
          throw new Error('ردّت البوابة برابط دفع غير صالح — لا تُتابع، واستعمل التحويل اليدوي وأبلغ النقابة.');
        }
        return {
          bill_no: (j.bill_no || j.billNo || ''),
          payment_url: url,
          amount: (j.amount == null ? null : j.amount),
          raw: j
        };
      }).catch(function (e) {
        clearTimeout(a.timer);
        /* المهلة هنا ليست فشلاً مؤكداً: قد تكون الفاتورة أُنشئت لدى شام
           كاش وضاع الردّ في الطريق. إعادة الضغط فوراً تُنشئ ثانية —
           والنص يوجّه إلى «تحديث الحالة» أولاً كما يشترط المزوّد. */
        var out = new Error(e && e.name === 'AbortError'
          ? 'انتهت مهلة إنشاء الفاتورة — قد تكون أُنشئت فعلاً. اضغط «تحديث الحالة» قبل إعادة المحاولة كي لا تُنشأ فاتورة ثانية.'
          : ((e && e.message) || 'تعذّر إنشاء فاتورة الدفع'));
        /* الرقم يعبر طبقة الالتقاط سليماً — بدونه يضيع مفتاح المصالحة */
        if (e && e.bill_no) { out.bill_no = e.bill_no; }
        throw out;
      });
    },

    /* حالة الفاتورة — نداءٌ واحد عند العودة أو بضغطة «تحديث الحالة».
       ⛔ لا استطلاع دوري: المزوّد يمنعه صراحةً ويُلزم الاعتماد على الـwebhook.
       الرقم إلزامي: sham_bill_status (ترحيلة ٠٣٠) محصورةٌ بصاحب الفاتورة
       وتطابق الحساب بالرقم في شرط الاستعلام نفسه، فبلا رقمٍ ترفع «الفاتورة
       غير موجودة». يُرفض النداء الفارغ هنا برسالة تقول ما ينقص فعلاً بدل
       أن يعود العضو بجوابٍ يوهمه أن فاتورته اختفت. */
    shamStatus: function (account, billNo) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var no = String(billNo == null ? '' : billNo).trim();
      if (!no) {
        return Promise.reject(new Error(
          'لا رقم فاتورة محفوظاً على هذا الجهاز — أنشئ فاتورة جديدة، أو راجع النقابة إن كنت دفعت فعلاً.'));
      }
      return sb.rpc('sham_bill_status', {
        p_account: account || null,
        p_bill_no: no
      }).then(must);
    },

    /* دفتر الفواتير لصفوف لوحة الإدارة — رقم حركة شام كاش (tranId).
       يسكن sham_bills لا payments، وشاشة المدفوعات تحتاجه للمطابقة مع
       كشف المزوّد. القراءة بسياسة الطاقم (sham_bills_staff_read في ٠٣٠)
       فلا تعمل لغير جلسة طاقم — وهو المقصود. إثراء عرضٍ لا أكثر: فشلُه
       لا يجوز أن يُسقط جدول المدفوعات، فيُردّ فارغاً عند تعذّره. */
    shamBills: function (billNos) {
      if (!LIVE || !billNos || !billNos.length) { return Promise.resolve([]); }
      return sb.from('sham_bills')
        .select('bill_no, tran_id, status_id, amount, settled_at, payment_id')
        .in('bill_no', billNos).then(must);
    }
  };


  /* ---------- مصادقة الأعضاء ----------
     الأعضاء ليسوا auth.users: التحقق بـbcrypt داخل القاعدة عبر دوال
     security definer. login لا يرمي عند فشل المصادقة بل يُعيد ok=false،
     لأن الرمي يُلغي المعاملة فيضيع معها عدّاد المحاولات الفاشلة. */
  var member = {
    login: function (identifier, password) {
      if (!LIVE) return Promise.resolve({ ok: true, account: { id: 'demo', name: 'عضو معاينة', status: 'pending' } });
      return sb.rpc('login_account', { p_identifier: identifier, p_password: password }).then(must);
    },

    /* ---------- التسجيل السريع بمعرّف واحد (ترحيل ٠١٥) ----------
       kind: 'phone' | 'email' | 'synd' | 'nid'. تُعيد {account, ticket}
       — والتذكرة هي إذن استكمال البيانات لمرة واحدة. */
    signup: function (kind, value, password, cc) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('signup_account', {
        p_kind: kind, p_value: value, p_password: password, p_cc: cc || '963'
      }).then(must).then(function (r) {
        if (!r || r.ok === false) { throw new Error((r && r.error) || 'تعذّر إنشاء الحساب'); }
        return { account: r.account, ticket: r.ticket };
      });
    },

    /* استكمال البيانات النقابية — بالتذكرة لا بكلمة المرور */
    completeProfile: function (id, ticket, fields) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var f = fields || {};
      return sb.rpc('member_complete_profile', {
        p_account: id, p_ticket: ticket,
        p_name: f.name || '', p_synd_no: f.synd_no || '',
        p_national_id: f.national_id || '', p_branch: f.branch || '',
        p_phone: f.phone || null, p_email: f.email || null,
        p_cc: f.cc || '963'
      }).then(must).then(function (r) {
        if (!r || r.ok === false) { throw new Error((r && r.error) || 'تعذّر حفظ البيانات'); }
        return r.account;
      });
    },
    /* استعادة كلمة المرور: ثلاثة أدلة هوية وكلمة جديدة — القديمة لا تُقرأ لأحد */
    recover: function (syndNo, nationalId, contact, newPass) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('recover_password', {
        p_synd_no: syndNo, p_national_id: nationalId,
        p_contact: contact, p_new: newPass
      }).then(must);
    },

    /* الحالة الحيّة — بها تظهر موافقة الإدارة للعضو داخل التطبيق */
    state: function (id) {
      if (!LIVE || !id) return Promise.resolve(null);
      return sb.rpc('account_state', { p_id: id }).then(must);
    },
    changePassword: function (id, oldPw, newPw) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      /* الدالة تعيد {ok,error} — ok=false يُحوَّل لخطأ (نمط updateProfile:
         قفل المحاولات في القاعدة يتطلب الإعادة لا الـraise) */
      return sb.rpc('change_password', { p_id: id, p_old: oldPw, p_new: newPw }).then(must)
        .then(function (r) {
          if (!r || r.ok === false) { throw new Error((r && r.error) || 'تعذّر تغيير كلمة المرور'); }
          return r;
        });
    },

    /* سجل العضو الكامل: محاولاته وشهاداته ودفعاته ودروسه — عبر نافذة
       خادمية (RLS يحجب هذه الجداول عن مفتاح anon بحق، والنافذة بنموذج
       الحامل كسائر دوال العضو). تعيد null للزائر بلا ضجيج. */
    results: function (id) {
      if (!LIVE || !id) return Promise.resolve(null);
      return sb.rpc('account_results', { p_account: id }).then(must).then(function (r) {
        if (!r) { return r; }
        (r.certs || []).forEach(function (c) {
          c.issued_at_ar = arDate(c.issued_at);
          c.score_ar = toAr(c.score) + '٪';
        });
        (r.attempts || []).forEach(function (t) {
          t.taken_at_ar = arDateTime(t.taken_at);
          t.score_ar = toAr(t.score) + '٪';
        });
        (r.payments || []).forEach(function (p) {
          p.paid_at_ar = arDateTime(p.paid_at);
        });
        return r;
      });
    },

    /* تعديل بيانات التواصل — بكلمة المرور. الهوية النقابية (الاسم/الرقم
       النقابي/الهوية/الفرع) سجل رسمي تعدّله الإدارة حصراً. الدالة تعيد
       {ok,error,account} — ok=false يُحوَّل لخطأ للواجهة (كي يُنفَّذ قفل
       المحاولات في القاعدة بلا إلغاء المعاملة بـraise). */
    updateProfile: function (id, password, fields) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('member_update_profile', {
        p_account: id, p_password: password,
        p_phone: (fields && fields.phone) || null,
        p_email: (fields && fields.email) || null,
        /* كود الدولة يمرّ مع الرقم كي يُطبَّع الرقم غير السوري كما في
           التسجيل — بدونه كانت الأرقام الدولية تُخزَّن بصيغة أخرى */
        p_cc: (fields && fields.cc) || '963'
      }).then(must).then(function (r) {
        if (!r || r.ok === false) { throw new Error((r && r.error) || 'تعذّر حفظ التعديلات'); }
        return r.account || r;
      });
    },

    /* الصورة الشخصية: مسار ثابت <uuid>/avatar.jpg بالكتابة فوقه — ملف
       واحد لكل حساب (لا استنزاف تخزين). كسر الكاش بملحق ?v بعد التثبيت. */
    uploadAvatar: function (id, file) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var path = id + '/avatar.jpg';
      return sb.storage.from('osea-avatars').upload(path, file, { upsert: true, contentType: 'image/jpeg' })
        .then(function (r) {
          if (r.error) { throw new Error(r.error.message || 'تعذّر رفع الصورة'); }
          return sb.storage.from('osea-avatars').getPublicUrl(path).data.publicUrl +
                 '?v=' + (new Date()).getTime();
        });
    },
    setAvatar: function (id, url) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('member_set_avatar', { p_account: id, p_url: url == null ? '' : url }).then(must);
    },

    /* ---------- وضع التوثيق (إذن التقاط الشاشة) ----------
       إذنٌ مؤقّت قابل للسحب تمنحه الإدارة لحسابٍ واحد. هذه الطبقة ناقل
       لا حَكَم: القرار كله في الطبقة الأصيلة (FLAG_SECURE)، وما يُعاد هنا
       سياقٌ للعرض. لا يُبنى على جوابها أي منع أو سماح في الويب. */

    /* فتح جلسة التقاط: كلمة المرور تُعاد هنا عمداً — الإذن قائم منذ منحته
       الإدارة، لكن بدء الجلسة فعلٌ يجب أن يصدر عن صاحب الحساب نفسه لا عمّن
       وجد الجهاز مفتوحاً. p_device معرّف جهاز عشوائي يولّده التطبيق مرة
       (لا معرّف عتاد)، وبه تُحصر الجلسة الحيّة في جهاز واحد.
       الدالة تردّ {ok:false,error} بدل رفع استثناء كي لا تُلغى المعاملة
       ومعها عدّاد المحاولات — نمط changePassword نفسه، فالفحص هنا لا catch. */
    captureBegin: function (id, password, device) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('member_capture_begin', {
        p_account: id, p_password: password, p_device: device || ''
      }).then(must).then(function (r) {
        if (!r || r.ok === false) { throw new Error((r && r.error) || 'تعذّر بدء وضع التوثيق'); }
        return r;
      });
    },

    /* هل لهذا الحساب إذنٌ قائم؟ سؤال عرضٍ محض تسأله شاشة الحساب لتقرّر
       إظهار البطاقة، والقارئ ليعرف أنه في وضع توثيق فيُثخّن علامته
       المائية. لا رمز فيها ولا جلسة، وغيابها (زائر أو بلا قاعدة) يُقرأ
       «لا إذن» — وهو الجواب الآمن: من لا إذن له لا يعلم بوجود الميزة. */
    captureState: function (id) {
      if (!LIVE || !id) return Promise.resolve(null);
      return sb.rpc('capture_grant_state', { p_account: id }).then(must);
    },

    /* اسمٌ ثانٍ لدالتَي الهوية عن قصد: شاشات الحساب اتُّفق أن تناديهما
       member.setSyndNo / member.setGradeRequest، بينما جارتهما التاريخية
       setBranch تُنادى من الجذر (account.html:802). التفويض إلى live بدل
       نسخ الجسم يمنع منطقين للعملية الواحدة يتباعدان بعد أول تعديل. */
    setSyndNo: function (id, syndNo, password) { return live.setSyndNo(id, syndNo, password); },
    setGradeRequest: function (id, grade) { return live.setGradeRequest(id, grade); }
  };

  /* ---------- طبقة لوحة الإدارة ----------
     كل دالة محمية داخل القاعدة بـis_staff() للقراءة و is_admin() للكتابة،
     فالحارس هنا راحة واجهة لا حماية. */
  function rpc(name, args) {
    if (!LIVE) return Promise.reject(new Error('تتطلب لوحة الإدارة الاتصال بالقاعدة'));
    return sb.rpc(name, args || {}).then(must);
  }

  /* ---------- الأكواد المُوجَّهة والاستحقاقات ----------
     الكود يصدر من لوحة الإدارة مربوطاً بحساب بعينه — تسريبه بلا قيمة. */
  var codes = {
    /* استرداد كود لحساب العضو — الخادم يتحقق من كل شيء */
    redeem: function (accountId, code) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('redeem_access_code', { p_account: accountId, p_code: code }).then(must);
    },
    /* استحقاقات الحساب: محاولات امتحان، كتب، مكتبة */
    entitlements: function (accountId) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.rpc('account_entitlements', { p_account: accountId }).then(must);
    }
  };

  /* ---------- الأخبار والإعلانات ----------
     كانت مكتوبة يدوياً في صفحات HTML، فلا تستطيع النقابة نشر خبر دون مبرمج.
     المصدر الآن جدول news، والقراءة علنية والكتابة للطاقم وحده (RLS). */
  var news = {
    /* الواجهة العلنية: المنشور فقط، المثبّت أولاً ثم الأحدث */
    list: function (limit) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var q = sb.from('news').select('*').eq('active', true)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .order('sort', { ascending: true });
      if (limit) { q = q.limit(limit); }
      return q.then(must).then(function (rows) {
        return (rows || []).map(decorate);
      });
    },

    /* لوحة الإدارة: كل الأخبار بما فيها غير المنشور */
    all: function () {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.from('news').select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .then(must).then(function (rows) { return (rows || []).map(decorate); });
    },

    /* رفع صورة خبر إلى السلة العامة — يعمل بجلسة الطاقم حصراً (سياسات التخزين) */
    uploadImage: function (file) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var ext = (file.name.match(/.([a-zA-Z0-9]+)$/) || [, 'jpg'])[1].toLowerCase();
      var path = 'covers/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      return sb.storage.from('osea-news').upload(path, file, { upsert: false })
        .then(function (r) {
          if (r.error) { throw new Error(r.error.message || 'تعذّر رفع الصورة'); }
          return sb.storage.from('osea-news').getPublicUrl(path).data.publicUrl;
        });
    },

    save: function (row) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var payload = {
        title: row.title, summary: row.summary, body: row.body || null,
        chip: row.chip || null, section: row.section || 'المنصة',
        cats: row.cats || [], icon: row.icon || 'megaphone',
        published_at: row.published_at, date_label: row.date_label || null,
        pinned: !!row.pinned, active: row.active !== false,
        sort: row.sort || 0,
        image_url: row.image_url === undefined ? null : row.image_url
      };
      if (row.id) {
        return sb.from('news').update(payload).eq('id', row.id).select().maybeSingle().then(must);
      }
      return sb.from('news').insert(payload).select().maybeSingle().then(must);
    },

    remove: function (id) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.from('news').delete().eq('id', id).then(must);
    }
  };

  /* تاريخ الخبر جاهزاً للعرض: النصّ البديل يسبق التاريخ حين لا يكون للخبر موعد */
  function decorate(r) {
    r.date_ar = r.date_label || arDate(r.published_at);
    r.meta_ar = r.date_ar + (r.section ? ' · ' + r.section : '');
    return r;
  }

  /* ---------- سجل الاعتمادات ----------
     الجهات المعتمدة لدى النقابة: مهندسون ومنظمات وشركات. سجل علني بطبيعته
     كسجل الشهادات: يقرؤه الجميع بلا حساب، وتحرّره لوحة الإدارة وحدها (RLS).
     ترحيلة 018. */
  /* المحافظات السورية — مصدر واحد تقرؤه شاشات التطبيق ولوحة الإدارة معاً،
     بدل قائمتين متطابقتين اليوم متباعدتين بعد أول تعديل. الترتيب إداري لا
     هجائي (نفس ترتيب قائمة الفرع في شاشة استكمال الملف)، والأسماء نفسها
     تصلح فروعاً للنقابة لأن الفرع يُسمّى بمحافظته. */
  var GOVERNORATES = [
    'دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس',
    'دير الزور', 'الرقة', 'الحسكة', 'درعا', 'السويداء', 'القنيطرة', 'إدلب'
  ];

  /* مفتاح الفرع: الفرع الواحد مكتوب في السجلات «حلب» تارة و«فرع حلب» تارة،
     فتنقسم قائمة الفلترة إلى خيارين لواقعٍ واحد ويختفي نصف السجل عن من اختار
     أحدهما. التطبيع هنا لا في الشاشة كي تشترك فيه قائمة التطبيق ولوحة
     الإدارة معاً؛ والتشذيب قبل الحذف وبعده لأن القيمة ذات المسافة السابقة
     كانت تفلت من التعبير النمطي فتبقى بتهجئتها الثانية. */
  /* يطابق public.accr_clean في ترحيلة ٠٢٧ حرفاً بحرف — وهذا شرطٌ لا تجميل:
     الفلترة في التطبيق تقارن نصّاً بنصّ، فلو نظّفت القاعدة محرفاً لا تنظّفه
     الواجهة (أو العكس) لعاد المنسدل ينقسم على فرعٍ واحد وهو العطل نفسه.
     الصنف يشمل كل الفراغات (بما فيها CR الوارد من استيراد Excel) والمسافات
     الخفية والوصلات الصفرية وعلامة ترتيب البايتات، واللاحقة + تدمج
     المتتاليات فلا تبقى «ريف  دمشق» بمسافتين قيمةً ثانية. */
  var BLANKS = /[\s ​‌‍‎‏؜﻿]+/g;
  function branchKey(b) {
    var s = String(b == null ? '' : b).replace(BLANKS, ' ');
    /* التشذيب باستبدال لا بـtrim: trim في المتصفحات القديمة لا يحذف
       U+00A0، وقد استُبدلت أعلاه فصار الطرف مسافةً عادية على أي حال */
    s = s.replace(/^ +/, '').replace(/ +$/, '');
    return s.replace(/^فرع +/, '').replace(/^ +/, '');
  }

  /* أنواع بنود السجل — المفاتيح هي قيم عمود kind في القاعدة (قيد ترحيلة ٠٢٤).
     مصدر واحد كي لا يتباعد اسم النوع بين اللوحة والتطبيق، ولا يظهر نوع في
     أحدهما دون الآخر كما كاد يحدث مع السجلين السوريين. */
  var ACCREDIT_KINDS = [
    { k: 'engineer',   label: 'مهندس',              plural: 'المهندسون المعتمدون وفق الاختبارات' },
    { k: 'org',        label: 'منظمة',              plural: 'المنظمات المعتمدة' },
    { k: 'company',    label: 'شركة معتمدة',        plural: 'الشركات المعتمدة' },
    { k: 'sy_company', label: 'شركة هندسية سورية',  plural: 'الشركات الهندسية السورية' },
    { k: 'sy_office',  label: 'مكتب هندسي سوري',    plural: 'المكاتب الهندسية السورية' }
  ];

  var accredit = {
    /* الأنواع والمحافظات مرفقتان بالواجهة نفسها: من يقرأ السجل يحتاجهما */
    KINDS: ACCREDIT_KINDS,
    GOVERNORATES: GOVERNORATES,
    /* والتطبيع معهما: من يبني خيارات الفلترة من صفوف السجل يجب أن يبنيها
       بالمفتاح الذي حُفظ به الفرع، وإلا عادت القائمة بخيارين متطابقين */
    branchKey: branchKey,

    /* الواجهة العلنية: المنشور من نوع واحد، أو السجل كله بلا وسيط
       (شاشة المدخل تعدّ الأنواع الثلاثة من نداء واحد) */
    list: function (kind) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var q = sb.from('accreditations').select('*').eq('active', true)
        .order('sort', { ascending: true })
        .order('name', { ascending: true });
      if (kind) { q = q.eq('kind', kind); }
      return q.then(must).then(function (rows) { return (rows || []).map(accDecorate); });
    },

    /* لوحة الإدارة: كامل السجل بما فيه الموقوف عن النشر */
    all: function () {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.from('accreditations').select('*')
        .order('kind', { ascending: true })
        .order('sort', { ascending: true })
        .order('name', { ascending: true })
        .then(must).then(function (rows) { return (rows || []).map(accDecorate); });
    },

    /* حمولة صريحة كنمط news.save — تمرير الصف كما ورد يُدخل حقول الزينة
       (cert_date_ar) إلى القاعدة فيفشل الحفظ بعمود مجهول */
    save: function (row) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      var payload = {
        kind: row.kind,
        name: row.name,
        /* الرقم يُحفظ بأرقام لاتينية دوماً: كل مسارات العرض والبحث تطويه
           بـtoAr، وحفظه خاماً يسمح بنسختين هندية ولاتينية للرقم الواحد
           تعبران قيد الفرادة وتظهران متطابقتين في السجل العلني */
        cert_no: row.cert_no == null ? null : toAr(String(row.cert_no)).trim(),
        cert_date: row.cert_date || null,
        field: row.field,
        /* الفرع صار لكل الأنواع لا للمهندسين وحدهم (ترحيلة ٠٢٤): للشركة
           والمكتب فرعٌ تسجّل فيه، وعليه تقوم فلترة السجل في التطبيق.
           ويُطبَّع عند الحفظ كما يُطوى cert_no إلى اللاتيني والبريد إلى
           الصغير أعلاه: القصد واحد — ألّا تعيش تهجئتان لقيمةٍ واحدة */
        branch: branchKey(row.branch) || null,
        governorate: row.governorate || null,
        address_sy: row.address_sy || null,
        address_abroad: row.address_abroad || null,
        website: row.website || null,
        /* البريد يُطوى صغيراً قبل الحفظ: العناوين لا تفرّق بين حالتي الحرف،
           وحفظه كما كُتب يترك نسختين للعنوان الواحد في السجل */
        email: row.email ? String(row.email).trim().toLowerCase() : null,
        phone: row.phone || null,
        active: row.active !== false,
        sort: row.sort | 0
      };
      if (row.id) {
        return sb.from('accreditations').update(payload).eq('id', row.id).select().maybeSingle().then(must);
      }
      return sb.from('accreditations').insert(payload).select().maybeSingle().then(must);
    },

    remove: function (id) {
      if (!LIVE) { return Promise.reject(new Error('قاعدة النقابة غير متاحة')); }
      return sb.from('accreditations').delete().eq('id', id).then(must);
    }
  };

  /* تاريخ الاعتماد جاهزاً للعرض بالتقويم الشامي — «١٥ آب ٢٠٢٦» */
  function accDecorate(r) {
    r.cert_date_ar = r.cert_date ? arDate(r.cert_date) : '—';
    return r;
  }

  /* ---------- مساعدتا رفع ملفات المحتوى (ترحيل 023) ---------- */
  /* ترميز مسار التخزين مقطعاً مقطعاً: معرّفات البنود قد تحمل مسافةً أو حرفاً
     عربياً، وencodeURIComponent على المسار كاملاً يقلب الشرطة المائلة إلى
     %2F فيصير «books/x.pdf» اسمَ ملفٍ واحدٍ في جذر السلة لا ملفاً في مجلد. */
  function encPath(path) {
    return String(path == null ? '' : path).replace(/^\/+/, '').split('/')
      .map(function (seg) { return encodeURIComponent(seg); }).join('/');
  }
  /* امتداد الملف من مسار التخزين بحروف صغيرة («pdf»، «mp4») أو '' إن غاب.
     الامتداد غير مخزَّن في القاعدة، وهذه الدالة هي المصدر الوحيد لاستخراجه
     في اللوحة والتطبيق معاً كي لا يختلف عدّ «ملفات الفيديو» بين شاشتين.
     يُؤخذ آخر مقطع من المسار بعد حذف أي استعلام أو علامة مرساة، والامتداد
     حروفٌ وأرقام لاتينية من ١ إلى ١٠ فقط — فـ«v2.1» في اسم مجلد ليس امتداداً.
     التعبير مطابقٌ حرفياً لدالة القاعدة public.content_path_ext (الترحيل ٠٣١)
     التي تقرأ بها admin_content وadmin_storage_usage؛ الفرق الوحيد أن القاعدة
     تُرجع null عند غياب الامتداد وهذه تُرجع ''، فيُقارَن دائماً بـ(it.ext || ''). */
  function extOf(path) {
    var s = String(path == null ? '' : path).split(/[?#]/)[0];
    var seg = s.substring(s.lastIndexOf('/') + 1);
    var m = /\.([A-Za-z0-9]{1,10})$/.exec(seg);
    return m ? m[1].toLowerCase() : '';
  }
  /* حدود الرفع من osea-config.js (OSEA_UPLOAD) مع احتياطٍ مطابقٍ لقيمها:
     تُقرأ عند كل استدعاء لا عند التحميل كي يبقى الملف صالحاً لو تأخّر
     تحميل الإعداد أو غُيّر في الجلسة نفسها لأغراض الفحص. */
  function uploadLimits() {
    var u = window.OSEA_UPLOAD || {};
    return {
      max:     u.MAX_FILE_BYTES > 0 ? u.MAX_FILE_BYTES : 300 * 1024 * 1024,
      chunk:   u.CHUNK_BYTES > 0    ? u.CHUNK_BYTES    : 6 * 1024 * 1024,
      retries: u.RETRIES >= 0       ? (u.RETRIES | 0)  : 5,
      base:    u.RETRY_BASE_MS > 0  ? u.RETRY_BASE_MS  : 1500
    };
  }
  /* حجم بالميغابايت للرسائل: عشرٌ واحدة تحت ١٠٠ ميغابايت وعددٌ صحيح فوقها.
     up = true يقرّب إلى الأعلى بعشرٍ واحدة دائماً: حجم الملف المرفوض يُعرض
     بها كي لا تتساوى الأرقام في الرسالة — ملفٌ يزيد بايتاً واحداً على ٣٠٠
     ميغابايت كان يُعرض «٣٠٠ ميغابايت يتجاوز ٣٠٠ ميغابايت» فلا تفهم الإدارة
     سبب الرفض. */
  function fmtMB(n, up) {
    var mb = (Number(n) || 0) / 1048576;
    if (up) { return toAr(Math.ceil(mb * 10) / 10) + ' ميغابايت'; }
    return toAr(mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10) + ' ميغابايت';
  }
  /* رسالة عربية من ردّ خدمة التخزين — جسم الخطأ JSON فيه message أو error.
     تقبل أي كائنٍ يحمل status وresponseText (XMLHttpRequest أو ردّ fetch
     بعد قراءة نصّه) كي تُستعمل في مسارَي الرفع معاً. حدّ الحجم يُشتقّ من
     OSEA_UPLOAD لا من رقمٍ مكتوب: الرقم المكتوب «١٠٠ ميغابايت» بقي يُعرض
     بعد رفع حدّ السلة فأربك الإدارة. خدمة التخزين لا تُجيب بـ413 دائماً بل
     أحياناً بـ400 ونصّ «exceeded the maximum allowed size» أو «Payload too
     large»، فيُفحص النصّ أيضاً. */
  function storageErrText(res) {
    var status = (res && res.status) | 0;
    var raw = String((res && res.responseText) || '');
    var body = null, msg = '';
    try { body = JSON.parse(raw || 'null'); } catch (e) { body = null; }
    msg = (body && (body.message || body.error || body.msg)) || '';
    if (status === 401 || status === 403) {
      return 'لا صلاحية لرفع ملفات المحتوى — تأكد أنك داخل بحساب مدير ثم أعد المحاولة.';
    }
    if (status === 413 || /exceeded the maximum allowed size|Payload too large/i.test(msg + ' ' + raw)) {
      return 'حجم الملف يتجاوز الحد المسموح للملف الواحد (' + fmtMB(uploadLimits().max) + ').';
    }
    if (!status) { return 'انقطع الاتصال بالخادم أثناء رفع الملف.'; }
    return 'تعذّر رفع الملف (' + status + ')' + (msg ? ' — ' + msg : '');
  }

  var admin = {
    /* الأكواد المُوجَّهة — إصدار وعرض وإبطال (لوحة الإدارة) */
    issueCode: function (p) {
      return sb.rpc('admin_issue_code', {
        p_kind: p.kind, p_accounts: p.accounts,
        p_item_ids: p.item_ids || null, p_months: p.months || null,
        p_note: p.note || null, p_expires: p.expires || null
      }).then(must);
    },
    listCodes: function () { return sb.rpc('admin_list_codes').then(must); },
    /* تدقيق دفعة: الموافقة تمنح الاستحقاق آلياً حسب خدمتها */
    /* جرد المدفوعات المرقّم — بحث وتصفية على الخادم لكامل السجل */
    listPayments: function (o) {
      o = o || {};
      return rpc('admin_list_payments', {
        p_search: o.search || null, p_status: o.status || null,
        p_service: o.service || null, p_from: o.from || null, p_to: o.to || null,
        p_limit: o.limit || 50, p_offset: o.offset || 0
      });
    },
    report: function (from, to) {
      return rpc('admin_report', { p_from: from, p_to: to });
    },
    verifyPayment: function (id, approve) {
      return sb.rpc('admin_verify_payment', { p_id: id, p_approve: !!approve }).then(must);
    },
    revokeCode: function (id) { return sb.rpc('admin_revoke_code', { p_id: id }).then(must); },

    /* الحسابات: بحث وتصفية وفرز وترقيم على الخادم */
    accounts: function (o) {
      o = o || {};
      /* p_verify: طابور التوثيق ('synd' أو 'grade' أو 'any') — ترحيلة ٠٢٩.
         الإدارة تحتاج أن تجد المنتظِرين لا أن تتصفّح كل الحسابات بحثاً عن
         وسمٍ ذهبي؛ والفهرسان الجزئيان في ٠٢٩ وُضعا لهذا الاستعلام بعينه. */
      return rpc('admin_list_accounts', {
        p_search: o.search || null, p_status: o.status || null, p_branch: o.branch || null,
        p_sort: o.sort || 'created_desc',
        p_verify: o.verify || null,
        p_limit: o.limit || 50, p_offset: o.offset || 0
      });
    },
    profile:       function (id) { return rpc('admin_account_profile', { p_id: id }); },
    overview:      function (days) { return rpc('admin_overview', { p_days: days || 30 }); },
    updateAccount: function (id, f) {
      f = f || {};
      return rpc('admin_update_account', {
        p_id: id, p_name: f.name || null, p_synd_no: f.synd_no || null,
        p_national_id: f.national_id || null, p_branch: f.branch || null,
        p_phone: (f.phone === undefined ? null : f.phone),
        p_email: (f.email === undefined ? null : f.email),
        p_exempt: (f.exempt === undefined ? null : !!f.exempt),
        p_note: (f.note === undefined ? null : f.note)
      });
    },
    bulkStatus:    function (ids, status, note) {
      return rpc('admin_bulk_status', { p_ids: ids, p_status: status, p_note: note || null });
    },
    deleteAccount: function (id) { return rpc('admin_delete_account', { p_id: id }); },
    resetPassword: function (id, pw) { return rpc('admin_reset_password', { p_id: id, p_new: pw }); },
    /* المرتبة الهندسية قرار الإدارة (ترحيلة ٠٢٦) — null تمسحها */
    setGrade: function (id, grade) { return rpc('admin_set_account_grade', { p_id: id, p_grade: grade || null }); },
    /* تدقيق الرقم النقابي الذي أدخله العضو: القبول يثبّته والرفض يعيد الحقل
       قابلاً للتعديل. السبب مكتوب لا اختياري في المعنى — بلا سبب يعيد العضو
       إرسال الرقم نفسه فتدور المراجعة على نفسها بلا نهاية. */
    verifySyndNo: function (id, approve, note) {
      return rpc('admin_verify_synd_no', { p_id: id, p_approve: !!approve, p_note: note || null });
    },
    /* اعتماد المرتبة المطلوبة: المرتبة تُمرَّر صراحةً لا تُؤخذ من الطلب، كي
       يعتمد المدقّق مرتبةً غير التي طُلبت (طلب «استشاري» يُقبل «ممارساً»)
       بقرارٍ واحد بدل رفضٍ ثم طلبٍ ثانٍ من العضو. */
    verifyGrade: function (id, approve, grade) {
      return rpc('admin_verify_grade', { p_id: id, p_approve: !!approve, p_grade: grade || null });
    },

    /* ---------- أذونات التقاط الشاشة ----------
       المنح استثناءٌ من قاعدة «لا لقطة شاشة»، فهو مؤقّت ومنسوب ومسجَّل
       السبب. بنك الأسئلة خارج المفردات المسموح بها في القاعدة أصلاً،
       والطبقة الأصيلة ترفضه ثانيةً مهما قال الخادم. */
    /* الافتراض «الفعّالة وحدها»: سؤال اللوحة المعتاد «من يملك إذناً الآن»
       لا «ماذا مُنح يوماً» — والسجل الكامل بتمرير active:false صراحةً */
    captureGrants: function (o) {
      o = o || {};
      return rpc('admin_capture_grants', {
        p_account: o.account || null,
        p_active: (o.active === undefined ? true : !!o.active),
        p_limit: o.limit || 50, p_offset: o.offset || 0
      });
    },
    /* الافتراضات أضيق ما يمكن لا أوسعه: نداءٌ ناقص المجال يمنح لا شيء
       (items مع قائمة فارغة) بدل أن ينزلق إلى 'all'. والمصفوفتان []
       لا null كي لا يرث الخادم NULL في text[] فيلتبس بـ«كل شيء». */
    grantCapture: function (id, o) {
      o = o || {};
      return rpc('admin_grant_capture', {
        p_account: id, p_scope: o.scope || 'items',
        p_screens: o.screens || [], p_items: o.items || [],
        p_expires: o.expires || null, p_reason: o.reason || null
      });
    },
    /* السحب فوري: الجلسة الحيّة تموت مع الإذن لأن كل فحصٍ لاحق يسأل القاعدة */
    revokeCapture: function (gid, reason) {
      return rpc('admin_revoke_capture', { p_id: gid, p_reason: reason || null });
    },

    /* الطاقم */
    staff:       function () { return rpc('admin_list_staff'); },
    addStaff:    function (email, name, role) {
      return rpc('admin_add_staff', { p_email: email, p_name: name, p_role: role || 'admin' });
    },
    removeStaff: function (uid) { return rpc('admin_remove_staff', { p_user_id: uid }); },

    /* المحتوى وبنك الأسئلة والإصدارات */
    content:   function () { return rpc('admin_content'); },
    /* سجل نسخ ملف البند (ترحيل ٠٣١): كل رفعٍ أو استبدالٍ صفٌّ بوقته وحجمه
       ومن رفعه — الإدارة تسأل «متى رُفعت هذه النسخة؟» ولم يكن لها جواب
       غير updated_at الذي يتحرّك مع أي تعديل عنوان */
    contentFileVersions: function (id) { return rpc('admin_content_file_versions', { p_id: id }); },
    /* استهلاك السلة: مجموع الأحجام من الصفوف ومن كائنات التخزين وحدّ الملف
       الواحد، موزَّعاً على النوع والامتداد — مقياس السعة المخطَّطة في اللوحة */
    storageUsage: function () { return rpc('admin_storage_usage'); },
    /* مجلدات المحتوى (ترحيل 021): قراءة للطاقم وحفظ/حذف للمدير */
    folders:      function ()   { return rpc('admin_folders'); },
    saveFolder:   function (p)  { return rpc('admin_save_folder', { p: p }); },
    deleteFolder: function (id) { return rpc('admin_delete_folder', { p_id: id }); },
    /* مجالات المحتوى: قراءة للطاقم وحفظ/حذف للمدير — نفس تقسيم صلاحيات
       المجلدات، فالمجال أعلى منها في الشجرة وتعديله يحرّك كل ما تحته */
    domains:      function ()   { return rpc('admin_domains'); },
    /* حمولة صريحة كنمط accredit.save: تمرير صف الجدول كما ورد يُدخل حقول
       العرض التي تضيفها اللوحة (عدّاد المجلدات مثلاً) إلى jsonb الحفظ،
       فيرفضها الخادم أو يخزّنها صامتاً — والحقول المسموح بها تُعرف هنا */
    saveDomain:   function (row) {
      row = row || {};
      return rpc('admin_save_domain', {
        p: {
          id: row.id || null,
          name: row.name,
          sort: row.sort | 0,
          /* الافتراض «يستخدم مجلدات» يحفظ سلوك اليوم: محتوى كل مجال قائمٌ
             داخل مجلدات، وحفظ صفٍّ بلا الحقل كان سيُخفي مجلداته دفعةً واحدة */
          use_subfolders: row.use_subfolders !== false,
          active: row.active !== false
        }
      });
    },
    deleteDomain: function (id) { return rpc('admin_delete_domain', { p_id: id }); },
    /* رسوم الاختبار — جدول products (ترحيل 021) */
    products:    function () { return rpc('admin_products'); },
    saveProduct: function (p) {
      return rpc('admin_save_product', {
        p_id: p.id, p_title: p.title, p_descr: p.descr,
        p_amount: p.amount, p_active: p.active
      });
    },
    questions: function (o) {
      o = o || {};
      var args = {
        p_set: o.set || null, p_search: o.search || null,
        p_limit: o.limit || 50, p_offset: o.offset || 0
      };
      /* p_difficulty يُمرَّر عند التصفية فقط: تمريره دوماً يغيّر توقيع
         الاستدعاء فيكسر المستهلكين القائمين قبل تطبيق ترحيل الصعوبة */
      if (o.difficulty) { args.p_difficulty = o.difficulty; }
      return rpc('admin_questions', args);
    },
    /* تركيبة الامتحان حسب الصعوبة: قراءة للطاقم وضبط للمدير.
       get تعيد {enabled, easy_pct, medium_pct, hard_pct, pools} والأحواض
       عدّ الأسئلة النشطة لكل مستوى؛ set تعيد الحالة الجديدة بالشكل نفسه. */
    getExamMix: function () { return rpc('admin_get_exam_mix', {}); },
    setExamMix: function (m) {
      return rpc('admin_set_exam_mix', {
        p_enabled: !!m.enabled, p_easy: m.easy | 0,
        p_medium: m.medium | 0, p_hard: m.hard | 0
      });
    },
    /* صعوبة سؤال أو دفعة أسئلة — تعيد عدد المحدَّث */
    setQuestionDifficulty: function (ids, level) {
      return rpc('admin_set_question_difficulty', { p_ids: ids, p_level: level });
    },
    publishRelease: function (r) {
      return rpc('admin_publish_release', {
        p_version_code: r.version_code | 0, p_version_name: r.version_name,
        p_min_supported: r.min_supported | 0, p_notes: r.notes || null,
        p_download_url: r.download_url || null, p_platform: r.platform || 'android'
      });
    },
    /* كتابة مباشرة — سياسات is_admin() تحرسها */
    saveContentItem: function (row) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      return sb.from('content_items').upsert(row).select().single().then(must);
    },
    deleteContentItem: function (id) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      return sb.from('content_items').delete().eq('id', id).then(must);
    },

    /* ---------- ملفات المحتوى: رفعٌ من اللوحة وترتيبٌ بالسحب (ترحيل 023) ----------
       كانت الملفات تُرفع يدوياً من لوحة Supabase، فصار على الإدارة أن تفتح
       لوحتين لكل كتاب. الرفع الآن من هنا إلى السلة الخاصة osea-content
       بجلسة الطاقم (سياسات التخزين تحرسها) ثم admin_save_content_file
       يضبط الحجم ويرفع rev فتُبطل أجهزة الأعضاء نسختها المخزّنة. */

    /* رفع ملف. الإرجاع: Promise يُحلّ بالمسار المرفوع، وعليه خاصية abort()
       لإلغاء الرفع (يرفض الوعد برسالة «أُلغي رفع الملف») وخاصية onRetry
       اختيارية تضبطها اللوحة بعد الاستدعاء: onRetry(رقم المحاولة, الحدّ, السبب)
       كي تعرض «إعادة المحاولة ٢ من ٥» بدل شريطٍ متجمّد.
       الاستعمال: var up = admin.uploadContentFile(p, f, cb); up.then(…); up.abort();
       onProgress(محمّل, الإجمالي) اختيارية.
       مساران: الملف الذي لا يتجاوز قطعةً واحدة (CHUNK_BYTES) يُرفع بطلب POST
       واحد كما كان؛ والأكبر يمرّ عبر نقطة الرفع القابل للاستئناف (TUS) في خدمة
       التخزين قطعةً قطعة. السبب: ملفات الدروس تقارب ٣٠٠ ميغابايت، وطلبٌ واحد
       بهذا الحجم على شبكةٍ متقطّعة يسقط في منتصفه فيُعاد من الصفر، أما القطع
       فيُعاد المتعثّر منها فقط بعد مصالحة الموضع مع الخادم بطلب HEAD. ولو
       أجابت نقطة الاستئناف بـ404/405 (خدمة أقدم) عاد الرفع إلى الطلب الواحد.
       XMLHttpRequest لا مكتبة التخزين: المكتبة المضمّنة لا تعرف الرفع القابل
       للاستئناف ولا تعطي تقدّماً حقيقياً ولا إلغاءً — شريط تقدّمٍ كاذب يجعل
       الإدارة تظن الصفحة معلّقة فتغلقها في منتصف الرفع فيتلف الملف. */
    uploadContentFile: function (path, file, onProgress) {
      var lim = uploadLimits();
      var CANCEL_MSG = 'أُلغي رفع الملف.';
      var canceled = false;
      var xhr = null;   /* الطلب الجاري: POST الكامل أو قطعة PATCH */
      var ctl = null;   /* مُلغي طلبات fetch (الإنشاء وHEAD) */
      var wake = null;  /* يقطع مهلة التراجع فوراً عند الإلغاء */
      var task;
      function fail(msg) {
        var r = Promise.reject(new Error(msg));
        r.abort = function () {};
        return r;
      }
      if (!LIVE || typeof XMLHttpRequest === 'undefined') { return fail('قاعدة النقابة غير متاحة'); }
      if (!path) { return fail('مسار التخزين مطلوب قبل رفع الملف.'); }
      if (!file) { return fail('اختر ملفاً أولاً.'); }
      /* الفحص قبل أي طلب: رفعُ ٤٠٠ ميغابايت ليرفضها الخادم عند آخر قطعة
         يهدر ربع ساعة من وقت الإدارة ومن حصة الشبكة */
      if ((file.size || 0) > lim.max) {
        return fail('حجم الملف (' + fmtMB(file.size, true) + ') يتجاوز الحد المسموح للملف الواحد (' + fmtMB(lim.max) + ').');
      }

      function cancelErr() { return new Error(CANCEL_MSG); }
      function retryable(msg) { var e = new Error(msg); e.retry = true; return e; }
      function isRetryStatus(st) { return st >= 500 || st === 409 || st === 423 || st === 429; }
      function report(loaded) {
        if (typeof onProgress !== 'function') { return; }
        var total = file.size || 0;
        onProgress(total ? Math.min(loaded, total) : loaded, total);
      }
      /* Base64 لنصٍّ UTF-8: أسماء المسارات قد تحمل حرفاً عربياً وbtoa وحدها
         ترفض ما فوق Latin-1 */
      function b64(str) { return btoa(unescape(encodeURIComponent(String(str)))); }
      function fetchOpts(method, headers) {
        var o = { method: method, headers: headers };
        if (typeof AbortController !== 'undefined') { ctl = new AbortController(); o.signal = ctl.signal; }
        return o;
      }
      function baseHeaders(token) {
        return { 'Authorization': 'Bearer ' + token, 'apikey': cfg.SUPABASE_ANON_KEY, 'Tus-Resumable': '1.0.0' };
      }
      /* موضع الرفع قد يرد مطلقاً أو نسبياً إلى /storage/v1 — كلاهما شوهد */
      function resolveLoc(loc) {
        loc = String(loc || '');
        if (/^https?:\/\//i.test(loc)) { return loc; }
        if (loc.indexOf('/storage/v1/') === 0) { return cfg.SUPABASE_URL + loc; }
        if (loc.charAt(0) === '/') { return cfg.SUPABASE_URL + '/storage/v1' + loc; }
        return cfg.SUPABASE_URL + '/storage/v1/' + loc;
      }
      /* تراجع أُسّي: ١٫٥ ث ثم ٣ ثم ٦ ثم ١٢ بسقف ١٥ ثانية، ويُقطع بالإلغاء */
      function backoff(attempt) {
        var ms = Math.min(lim.base * Math.pow(2, attempt - 1), 15000);
        return new Promise(function (resolve) {
          var t = setTimeout(function () { wake = null; resolve(); }, ms);
          wake = function () { clearTimeout(t); wake = null; resolve(); };
        }).then(function () { if (canceled) { throw cancelErr(); } });
      }

      /* المسار القديم: طلب واحد بالملف كاملاً — للملفات الصغيرة وللاحتياط */
      function postWhole(token) {
        return new Promise(function (resolve, reject) {
          var x = new XMLHttpRequest();
          xhr = x;
          x.open('POST', cfg.SUPABASE_URL + '/storage/v1/object/osea-content/' + encPath(path), true);
          x.setRequestHeader('Authorization', 'Bearer ' + token);
          x.setRequestHeader('apikey', cfg.SUPABASE_ANON_KEY);
          /* الاستبدال مسموح: «استبدال الملف» يرفع على مسار البند نفسه */
          x.setRequestHeader('x-upsert', 'true');
          x.setRequestHeader('Content-Type', (file.type || 'application/octet-stream'));
          if (x.upload) {
            x.upload.onprogress = function (e) {
              report(e.loaded || 0);
            };
          }
          x.onload = function () {
            if (xhr === x) { xhr = null; }
            if (x.status === 200 || x.status === 201) { report(file.size || 0); resolve(path); return; }
            reject(new Error(storageErrText(x)));
          };
          x.onerror   = function () { if (xhr === x) { xhr = null; } reject(new Error('تعذّر الاتصال بالخادم أثناء رفع الملف.')); };
          x.onabort   = function () { if (xhr === x) { xhr = null; } reject(cancelErr()); };
          x.ontimeout = function () { if (xhr === x) { xhr = null; } reject(new Error('انتهت مهلة رفع الملف — أعد المحاولة.')); };
          x.send(file);
        });
      }

      /* إنشاء جلسة رفع قابلة للاستئناف: يعيد {url} أو {unsupported:true} */
      function tusCreate(token) {
        var h = baseHeaders(token);
        h['Upload-Length'] = String(file.size);
        h['x-upsert'] = 'true';
        h['Upload-Metadata'] = 'bucketName ' + b64('osea-content') +
          ',objectName ' + b64(path) +
          ',contentType ' + b64(file.type || 'application/octet-stream') +
          ',cacheControl ' + b64('3600');
        return fetch(cfg.SUPABASE_URL + '/storage/v1/upload/resumable', fetchOpts('POST', h)).then(function (res) {
          ctl = null;
          if (res.status === 404 || res.status === 405) { return { unsupported: true }; }
          return res.text().then(function (txt) {
            if (res.status < 200 || res.status >= 300) {
              var msg = storageErrText({ status: res.status, responseText: txt });
              var err = isRetryStatus(res.status) ? retryable(msg) : new Error(msg);
              err.status = res.status;
              throw err;
            }
            var loc = res.headers.get('Location');
            if (!loc) { throw retryable('لم يُرجع الخادم موضع الرفع القابل للاستئناف.'); }
            return { url: resolveLoc(loc) };
          });
        }, function () {
          ctl = null;
          if (canceled) { throw cancelErr(); }
          throw retryable('تعذّر الاتصال بالخادم أثناء رفع الملف.');
        });
      }
      /* قطعة واحدة: يعيد الموضع الجديد كما أعلنه الخادم */
      function patchChunk(token, url, offset) {
        return new Promise(function (resolve, reject) {
          var end = Math.min(offset + lim.chunk, file.size);
          var x = new XMLHttpRequest();
          xhr = x;
          x.open('PATCH', url, true);
          x.setRequestHeader('Authorization', 'Bearer ' + token);
          x.setRequestHeader('apikey', cfg.SUPABASE_ANON_KEY);
          x.setRequestHeader('Tus-Resumable', '1.0.0');
          x.setRequestHeader('Upload-Offset', String(offset));
          x.setRequestHeader('Content-Type', 'application/offset+octet-stream');
          if (x.upload) {
            x.upload.onprogress = function (e) { report(offset + (e.loaded || 0)); };
          }
          x.onload = function () {
            if (xhr === x) { xhr = null; }
            if (x.status === 204 || x.status === 200) {
              var next = parseInt(x.getResponseHeader('Upload-Offset'), 10);
              resolve(isFinite(next) ? next : end);
              return;
            }
            var msg = storageErrText(x);
            var err = isRetryStatus(x.status) ? retryable(msg) : new Error(msg);
            err.status = x.status;
            reject(err);
          };
          x.onerror   = function () { if (xhr === x) { xhr = null; } reject(retryable('تعذّر الاتصال بالخادم أثناء رفع الملف.')); };
          x.onabort   = function () { if (xhr === x) { xhr = null; } reject(cancelErr()); };
          x.ontimeout = function () { if (xhr === x) { xhr = null; } reject(retryable('انتهت مهلة رفع القطعة.')); };
          x.send(file.slice(offset, end));
        });
      }
      /* مصالحة الموضع بعد تعثّر: -1 = الجلسة زالت من الخادم فتُنشأ من جديد،
         null = لم نعرف فنُبقي الموضع الحالي ويصحّحه 409 التالي */
      function tusOffset(token, url) {
        return fetch(url, fetchOpts('HEAD', baseHeaders(token))).then(function (res) {
          ctl = null;
          if (res.status === 404 || res.status === 410) { return -1; }
          var o = parseInt(res.headers.get('Upload-Offset'), 10);
          return isFinite(o) ? o : null;
        }, function () { ctl = null; return null; });
      }
      function tusUpload(token0) {
        /* الرمز متغيّرٌ لا ثابت: رفع ٣٠٠ ميغابايت على شبكةٍ بطيئة يمتدّ
           نصف ساعة وأكثر، ورمز الجلسة يبلى خلالها (عمره ساعة) بينما تجدّده
           مكتبة الجلسة في خلفيتها؛ لو بقي الرمز الأول محفوظاً هنا رُفضت
           القطعة التالية بـ401 وضاع ما رُفع. يُجدَّد مرةً واحدة عند أول 401
           ثم يُستأنف الرفع من الموضع نفسه، وإن رُفض ثانيةً فالحساب لا
           الجلسة هو المشكلة فتُعرض رسالة الصلاحية. */
        var token = token0, refreshed = false;
        var url = null, offset = 0, attempt = 0;
        function step() {
          if (canceled) { throw cancelErr(); }
          if (!url) {
            return tusCreate(token).then(function (c) {
              if (c.unsupported) { return c; }
              url = c.url; offset = 0;
              return step();
            }, recover);
          }
          if (offset >= file.size) { report(file.size); return path; }
          return patchChunk(token, url, offset).then(function (next) {
            /* العدّاد لكل قطعة لا للملف: ٣٠٠ ميغابايت خمسون قطعة، وخمس هفوات
               متفرّقة على شبكةٍ متقطّعة لا تستحق إسقاط الرفع كله */
            offset = next; attempt = 0;
            report(offset);
            return step();
          }, recover);
        }
        function recover(e) {
          if (canceled || (e && e.message === CANCEL_MSG)) { throw cancelErr(); }
          if (e && e.status === 401 && !refreshed) {
            refreshed = true;
            return sb.auth.getSession().then(function (r) {
              var s = r && r.data && r.data.session;
              if (!s || !s.access_token) { throw new Error('انتهت جلسة اللوحة — سجّل الدخول ثم أعد المحاولة.'); }
              token = s.access_token;
              return step();
            });
          }
          if (!e || !e.retry) { throw e; }
          attempt++;
          if (attempt > lim.retries) {
            throw new Error(e.message + ' — توقّف الرفع بعد ' + toAr(lim.retries) + ' محاولات.');
          }
          if (typeof task.onRetry === 'function') {
            try { task.onRetry(attempt, lim.retries, e.message); } catch (x) {}
          }
          return backoff(attempt).then(function () {
            if (!url) { return step(); }
            return tusOffset(token, url).then(function (o) {
              if (o === -1) { url = null; }
              else if (o != null) { offset = Math.min(o, file.size); }
              return step();
            });
          });
        }
        return Promise.resolve().then(step);
      }

      task = sb.auth.getSession().then(function (r) {
        var sess = r && r.data && r.data.session;
        var token = sess && sess.access_token;
        /* الرمز من الجلسة لا المفتاح العلني: سياسات السلة تشترط is_staff()،
           والمفتاح العلني وحده يُرفض بـ403 برسالة غامضة. */
        if (!token) { throw new Error('انتهت جلسة اللوحة — سجّل الدخول ثم أعد المحاولة.'); }
        if (canceled) { throw cancelErr(); }
        if ((file.size || 0) <= lim.chunk || typeof fetch !== 'function' || typeof file.slice !== 'function') {
          return postWhole(token);
        }
        return tusUpload(token).then(function (r2) {
          return (r2 && r2.unsupported) ? postWhole(token) : r2;
        });
      });
      /* الإلغاء قبل وصول الجلسة يضبط الراية، وبعدها يقطع الطلب الجاري —
         XHR أو fetch — ويُنهي مهلة التراجع كي لا تنتظر الإدارة ١٥ ثانية */
      task.abort = function () {
        canceled = true;
        try { if (xhr) { xhr.abort(); } } catch (e) {}
        try { if (ctl) { ctl.abort(); } } catch (e) {}
        if (wake) { wake(); }
      };
      task.onRetry = null;
      return task;
    },

    /* تثبيت الملف على صف البند: يضبط المسار والحجم ويرفع rev افتراضياً */
    saveContentFile: function (o) {
      o = o || {};
      return rpc('admin_save_content_file', {
        p_id: o.id,
        p_path: o.path,
        p_size: (o.size == null ? 0 : Number(o.size)),
        p_bump: o.bump !== false
      });
    },

    /* ترتيب المجلدات والبنود بالسحب — موضع المعرّف في المصفوفة هو sort */
    reorderFolders: function (ids) { return rpc('admin_reorder_folders', { p_ids: ids }); },
    reorderContent: function (ids) { return rpc('admin_reorder_content', { p_ids: ids }); },
    /* والمجالات كذلك: ترتيبها هو ترتيب أقسام شاشة المحتوى في التطبيق،
       فتقديم مجال على آخر قرار عرضٍ تملكه الإدارة لا الترتيب الهجائي */
    reorderDomains: function (ids) { return rpc('admin_reorder_domains', { p_ids: ids }); },

    /* حذف ملفٍ من السلة (لا يمسّ صف البند) — سياسات التخزين تحرسه */
    deleteContentFile: function (path) {
      if (!LIVE) return Promise.reject(new Error('قاعدة النقابة غير متاحة'));
      return sb.storage.from('osea-content').remove([path]).then(must);
    },

    saveQuestion: function (row) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      return sb.from('questions').upsert(row).select().single().then(must);
    },
    deleteQuestion: function (id) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      return sb.from('questions').delete().eq('id', id).then(must);
    },
    setReleaseActive: function (id, active) {
      if (!LIVE) return Promise.reject(new Error('demo'));
      return sb.from('app_releases').update({ active: !!active }).eq('id', id).then(must);
    },

    /* السجلات */
    accessLog: function (o) {
      o = o || {};
      return rpc('admin_access_log', {
        p_item: o.item || null, p_account: o.account || null,
        p_limit: o.limit || 100, p_offset: o.offset || 0
      });
    },
    audit: function (o) {
      o = o || {};
      return rpc('admin_audit', {
        p_entity: o.entity || null, p_limit: o.limit || 100, p_offset: o.offset || 0
      });
    },

    /* تسجيل دفعة عبر دالة لا إدراجاً مباشراً: تملأ created_by وتسجّل التدقيق.
       الإدراج المباشر كان يترك «من قيّد الدفعة» مجهولاً في القاعدة. */
    addPayment: function (p) {
      return rpc('admin_add_payment', {
        p_account: p.account_id, p_op_no: p.op_no,
        p_amount: p.amount | 0, p_exempt: !!p.exempt
      });
    },

    /* إعدادات المنصة (ترحيل 010): قراءة للطاقم وضبط للمدير */
    getSettings: function () { return rpc('admin_get_settings', {}); },
    setSetting:  function (key, value) {
      return rpc('admin_set_setting', { p_key: key, p_value: value });
    },

    /* التصحيح والسحب */
    deletePayment: function (id) { return rpc('admin_delete_payment', { p_id: id }); },
    deleteAttempt: function (id) { return rpc('admin_delete_attempt', { p_id: id }); },
    /* السحب وسمٌ لا حذف — بوابة التحقق يجب أن تقول «سُحبت» لا «غير موجودة» */
    revokeCert:    function (id, reason) {
      return rpc('admin_revoke_certificate', { p_id: id, p_reason: reason || null });
    },
    restoreCert:   function (id) { return rpc('admin_restore_certificate', { p_id: id }); }
  };

  /* بوابة التحديث — الاحتياط في الويب؛ الإنفاذ الحقيقي في الكود الأصلي */
  function checkUpdate(versionCode) {
    if (!LIVE) return Promise.resolve(null);
    return sb.rpc('check_update', { p_platform: 'android', p_version_code: versionCode })
      .then(must).then(function (rows) { return (rows && rows[0]) || null; });
  }

  /* ---------- الواجهة الموحّدة ---------- */
  /* ⛔ الطريق المسدود: لو غابت القاعدة، تفشل العملية بصوت عالٍ.
     كانت الاستدعاءات تسقط إلى طبقة عرض توضيحي فتُعرض بيانات مخترَعة على
     أنها حقيقية — وهذا أسوأ من عطل ظاهر، لأن العضو لا يعرف أنه يرى وهماً. */
  function offline(what) {
    return function () {
      return Promise.reject(new Error('تعذّر الوصول إلى قاعدة النقابة (' + what + ') — تحقق من الاتصال.'));
    };
  }

  window.OSEA_API = {
    LIVE: LIVE,
    content: content,
    news: news,
    accredit: accredit,
    codes: codes,
    exam: exam,
    pricing: pricing,
    /* الدفع الآلي عبر شام كاش — وسومٌ عربية عند غياب القاعدة كسائر
       الكتابات. shamAvailable وحدها لا تفشل بل تُجيب false: هي سؤال قدرة
       لا عملية عضو، وجوابها السلبي يُبقي الشاشة على مسارها اليدوي. */
    pay: {
      shamAvailable: LIVE ? shamPay.shamAvailable : function () { return Promise.resolve(false); },
      shamStart:     LIVE ? shamPay.shamStart     : offline('الدفع الآلي عبر شام كاش'),
      shamStatus:    LIVE ? shamPay.shamStatus    : offline('حالة الدفع عبر شام كاش'),
      shamBills:     LIVE ? shamPay.shamBills     : function () { return Promise.resolve([]); }
    },
    member: member,
    admin: admin,
    checkUpdate: checkUpdate,
    GOVERNORATES: GOVERNORATES,
    /* على الجذر أيضاً لا في accredit وحده: قائمة الفروع في التطبيق وسجل
       اللوحة يحتاجانه بلا سجل اعتمادات، ونسخة ثانية منه تفتح باب اختلافهما */
    branchKey: branchKey,
    arDate: arDate,
    arDateTime: arDateTime,
    durSec: durSec,
    secDur: secDur,
    toAr: toAr,
    extOf: extOf,

    register:   LIVE ? live.register   : offline('التسجيل'),
    accounts:   LIVE ? live.accounts   : offline('الحسابات'),
    setStatus:  LIVE ? live.setStatus  : offline('تحديث الحالة'),
    payments:   LIVE ? live.payments   : function () { return Promise.resolve(null); },
    addPayment: LIVE ? live.addPayment : function () { return Promise.resolve(null); },
    setBranch:  LIVE ? live.setBranch  : offline('تحديث الفرع'),
    /* هوية العضو النقابية: كتابةٌ من العضو واعتمادٌ من الإدارة — الوسم
       بـoffline كسائر الكتابات كي يقرأ العضو سبب التعذّر لا صمتاً */
    setSyndNo:  LIVE ? live.setSyndNo  : offline('تحديث الرقم النقابي'),
    setGradeRequest: LIVE ? live.setGradeRequest : offline('طلب المرتبة الهندسية'),
    attempts:   LIVE ? live.attempts   : function () { return Promise.resolve(null); },
    addAttempt: LIVE ? live.addAttempt : function () { return Promise.resolve(null); },
    certs:      LIVE ? live.certs      : offline('الشهادات'),
    findCert:   LIVE ? live.findCert   : offline('التحقق من شهادة'),
    saveLessonProgress: LIVE ? live.saveLessonProgress : offline('حفظ تقدم الدرس'),
    accountProfile:     LIVE ? live.accountProfile     : offline('ملف الحساب'),
    issueCert:  LIVE ? live.issueCert  : function () { return Promise.reject(new Error('demo')); },
    stats:      LIVE ? live.stats      : function () { return Promise.resolve(null); },

    signIn:  LIVE ? live.signIn  : function () { return Promise.reject(new Error('demo')); },
    signOut: LIVE ? live.signOut : function () { return Promise.resolve(); },
    session: LIVE ? live.session : function () { return Promise.resolve(null); },
    isStaff: LIVE ? live.isStaff : function () { return Promise.resolve(null); },

    /* حارس صفحات الإدارة: بالوضع الحي يشترط جلسة طاقم وإلا حوّل لصفحة الدخول؛
       بالوضع التوضيحي يُظهر شارة العرض ويُكمل. يعيد Promise<staff|null>. */
    requireStaff: function () {
      if (!LIVE) {
        document.documentElement.setAttribute('data-mode', 'demo');
        return Promise.resolve(null);
      }
      document.documentElement.setAttribute('data-mode', 'live');
      return live.session().then(function (s) {
        if (!s) { window.location.replace('admin-login.html'); return null; }
        return live.isStaff().then(function (st) {
          if (!st) {
            return live.signOut().then(function () {
              window.location.replace('admin-login.html?e=notstaff');
              return null;
            });
          }
          return st;
        }).catch(function () {
          /* تعذّر التحقق شبكياً: لا نطرد جلسة صالحة — تُكمل الصفحة
             وتظهر أخطاء التحميل في مواضعها مع أزرار إعادة المحاولة */
          return { name: '', unverified: true };
        });
      });
    }
  };
})();

(function () {
  /* كنس شارة «Powered by Netlify» التي يحقنها مضيف النشر المجاني في الصفحات
     المُخدَّمة — ليست من ملفاتنا ولا يليق ظهورها على منصة رسمية. المعيار:
     عنصر مثبَّت (fixed) ببصمة netlify، أو iframe مثبَّت (لا iframe مثبَّتاً
     في واجهاتنا إطلاقاً)، أو حاوية مثبَّتة تلفّ iframe. */
  if (!window.MutationObserver || !window.getComputedStyle) { return; }
  var RX = /netlify/i;
  function isFixed(el) {
    try { return getComputedStyle(el).position === 'fixed'; } catch (e) { return false; }
  }
  function isBadge(el) {
    if (!el || el.nodeType !== 1) { return false; }
    if (el.tagName === 'IFRAME') { return isFixed(el); }
    if (isFixed(el) && el.querySelector && el.querySelector('iframe')) { return true; }
    var hay = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' +
              (el.getAttribute('href') || '') + ' ' + (el.getAttribute('title') || '') + ' ' +
              (el.getAttribute('aria-label') || '');
    return RX.test(hay) && isFixed(el);
  }
  function scrub(root) {
    if (isBadge(root)) { root.remove(); return; }
    if (!root.querySelectorAll) { return; }
    var list = root.querySelectorAll(
      'iframe, a[href*="netlify"], [id*="netlify" i], [class*="netlify" i], [title*="netlify" i]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      /* حاوية مثبّتة تلفّ iframe كانت في الصفحة منذ التحليل:
         تُلتقط صعوداً من الوليد لأن الفاحص العام لا يمسح كل div */
      if (el.tagName === 'IFRAME' && !isFixed(el)) {
        var p = el.parentElement, hops = 0;
        while (p && p !== document.body && p !== document.documentElement && hops < 4) {
          if (isFixed(p)) { el = p; break; }
          p = p.parentElement; hops++;
        }
      }
      if (isBadge(el)) { el.remove(); }
    }
  }
  new MutationObserver(function (muts) {
    for (var m = 0; m < muts.length; m++) {
      for (var n = 0; n < muts[m].addedNodes.length; n++) {
        if (muts[m].addedNodes[n].nodeType === 1) { scrub(muts[m].addedNodes[n]); }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scrub(document.documentElement); });
  } else {
    scrub(document.documentElement);
  }
})();
