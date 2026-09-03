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
    }
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

  /* أنواع بنود السجل — المفاتيح هي قيم عمود kind في القاعدة (قيد ترحيلة ٠٢٤).
     مصدر واحد كي لا يتباعد اسم النوع بين اللوحة والتطبيق، ولا يظهر نوع في
     أحدهما دون الآخر كما كاد يحدث مع السجلين السوريين. */
  var ACCREDIT_KINDS = [
    { k: 'engineer',   label: 'مهندس',              plural: 'المهندسون المعتمدون' },
    { k: 'org',        label: 'منظمة',              plural: 'المنظمات المعتمدة' },
    { k: 'company',    label: 'شركة معتمدة',        plural: 'الشركات المعتمدة' },
    { k: 'sy_company', label: 'شركة هندسية سورية',  plural: 'الشركات الهندسية السورية' },
    { k: 'sy_office',  label: 'مكتب هندسي سوري',    plural: 'المكاتب الهندسية السورية' }
  ];

  var accredit = {
    /* الأنواع والمحافظات مرفقتان بالواجهة نفسها: من يقرأ السجل يحتاجهما */
    KINDS: ACCREDIT_KINDS,
    GOVERNORATES: GOVERNORATES,

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
           والمكتب فرعٌ تسجّل فيه، وعليه تقوم فلترة السجل في التطبيق */
        branch: row.branch || null,
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
  /* رسالة عربية من ردّ خدمة التخزين — جسم الخطأ JSON فيه message أو error */
  function storageErrText(xhr) {
    var body = null, msg = '';
    try { body = JSON.parse(xhr.responseText || 'null'); } catch (e) { body = null; }
    msg = (body && (body.message || body.error || body.msg)) || '';
    if (xhr.status === 401 || xhr.status === 403) {
      return 'لا صلاحية لرفع ملفات المحتوى — تأكد أنك داخل بحساب مدير ثم أعد المحاولة.';
    }
    if (xhr.status === 413) { return 'حجم الملف يتجاوز الحد المسموح للسلة (100 ميغابايت).'; }
    if (!xhr.status) { return 'انقطع الاتصال بالخادم أثناء رفع الملف.'; }
    return 'تعذّر رفع الملف (' + xhr.status + ')' + (msg ? ' — ' + msg : '');
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
      return rpc('admin_list_accounts', {
        p_search: o.search || null, p_status: o.status || null, p_branch: o.branch || null,
        p_sort: o.sort || 'created_desc',
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

    /* الطاقم */
    staff:       function () { return rpc('admin_list_staff'); },
    addStaff:    function (email, name, role) {
      return rpc('admin_add_staff', { p_email: email, p_name: name, p_role: role || 'admin' });
    },
    removeStaff: function (uid) { return rpc('admin_remove_staff', { p_user_id: uid }); },

    /* المحتوى وبنك الأسئلة والإصدارات */
    content:   function () { return rpc('admin_content'); },
    /* مجلدات المحتوى (ترحيل 021): قراءة للطاقم وحفظ/حذف للمدير */
    folders:      function ()   { return rpc('admin_folders'); },
    saveFolder:   function (p)  { return rpc('admin_save_folder', { p: p }); },
    deleteFolder: function (id) { return rpc('admin_delete_folder', { p_id: id }); },
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
       لإلغاء الرفع (يرفض الوعد برسالة «أُلغي رفع الملف»).
       الاستعمال: var up = admin.uploadContentFile(p, f, cb); up.then(…); up.abort();
       XMLHttpRequest لا مكتبة التخزين: المكتبة لا تعطي تقدّماً حقيقياً ولا
       إلغاءً، وملفات الدروس بعشرات الميغابايت — شريط تقدّمٍ كاذب يجعل
       الإدارة تظن الصفحة معلّقة فتغلقها في منتصف الرفع فيتلف الملف.
       onProgress(محمّل, الإجمالي) اختيارية. */
    uploadContentFile: function (path, file, onProgress) {
      var xhr = (typeof XMLHttpRequest !== 'undefined') ? new XMLHttpRequest() : null;
      var canceled = false;
      var p;
      function fail(msg) {
        var r = Promise.reject(new Error(msg));
        r.abort = function () {};
        return r;
      }
      if (!LIVE || !xhr) { return fail('قاعدة النقابة غير متاحة'); }
      if (!path) { return fail('مسار التخزين مطلوب قبل رفع الملف.'); }
      if (!file) { return fail('اختر ملفاً أولاً.'); }

      p = sb.auth.getSession().then(function (r) {
        var sess = r && r.data && r.data.session;
        var token = sess && sess.access_token;
        /* الرمز من الجلسة لا المفتاح العلني: سياسات السلة تشترط is_staff()،
           والمفتاح العلني وحده يُرفض بـ403 برسالة غامضة. */
        if (!token) { throw new Error('انتهت جلسة اللوحة — سجّل الدخول ثم أعد المحاولة.'); }
        if (canceled) { throw new Error('أُلغي رفع الملف.'); }
        return new Promise(function (resolve, reject) {
          xhr.open('POST', cfg.SUPABASE_URL + '/storage/v1/object/osea-content/' + encPath(path), true);
          xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.setRequestHeader('apikey', cfg.SUPABASE_ANON_KEY);
          /* الاستبدال مسموح: «استبدال الملف» يرفع على مسار البند نفسه */
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.setRequestHeader('Content-Type', (file.type || 'application/octet-stream'));
          if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = function (e) {
              onProgress(e.loaded, e.lengthComputable ? e.total : (file.size || 0));
            };
          }
          xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 201) { resolve(path); return; }
            reject(new Error(storageErrText(xhr)));
          };
          xhr.onerror  = function () { reject(new Error('تعذّر الاتصال بالخادم أثناء رفع الملف.')); };
          xhr.onabort  = function () { reject(new Error('أُلغي رفع الملف.')); };
          xhr.ontimeout = function () { reject(new Error('انتهت مهلة رفع الملف — أعد المحاولة.')); };
          xhr.send(file);
        });
      });
      /* الإلغاء قبل وصول الجلسة يضبط الراية، وبعدها يقطع الطلب فعلياً */
      p.abort = function () {
        canceled = true;
        try { xhr.abort(); } catch (e) {}
      };
      return p;
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
    member: member,
    admin: admin,
    checkUpdate: checkUpdate,
    GOVERNORATES: GOVERNORATES,
    arDate: arDate,
    arDateTime: arDateTime,
    durSec: durSec,
    secDur: secDur,
    toAr: toAr,

    register:   LIVE ? live.register   : offline('التسجيل'),
    accounts:   LIVE ? live.accounts   : offline('الحسابات'),
    setStatus:  LIVE ? live.setStatus  : offline('تحديث الحالة'),
    payments:   LIVE ? live.payments   : function () { return Promise.resolve(null); },
    addPayment: LIVE ? live.addPayment : function () { return Promise.resolve(null); },
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
