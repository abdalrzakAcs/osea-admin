/* سلوك مشترك لكل صفحات المنصة — الإصدار ٣ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* الأرقام تُعرض لاتينية 1 2 3 … بقرار العميل. الاسم toAr باقٍ لأن مواضع
     كثيرة تستدعيه، وهو الآن ممرّ واحد يحوّل أي هندي وارد إلى لاتيني. */
  var toAr = function (n) {
    return String(n)
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
  };

  /* قائمة الجوال */
  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* موسّع «كيف تتحقق؟» في شريط الدولة */
  var vToggle = document.getElementById('verifyToggle');
  var vPanel = document.getElementById('verifyPanel');
  if (vToggle && vPanel) {
    vToggle.addEventListener('click', function () {
      var open = vPanel.classList.toggle('open');
      vToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ظل الترويسة اللاصقة بعد التمرير */
  var masthead = document.getElementById('masthead');
  if (masthead) {
    var onScroll = function () {
      masthead.classList.toggle('is-stuck', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* حركة الدخول المتتابعة */
  var revealEls = document.querySelectorAll('.reveal');
  var inViewport = function (el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };
  if (revealEls.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.2 });
      revealEls.forEach(function (el) { io.observe(el); });
      /* احتياطان يضمنان ألا يبقى محتوى محجوباً لو تعطل المراقب:
         (١) تفعيل الظاهر في الشاشة بعد التحميل مباشرة
         (٢) فحص خفيف عند التمرير للعناصر التي لم تُفعَّل بعد */
      var revealFallback = function () {
        revealEls.forEach(function (el) {
          if (!el.classList.contains('in') && inViewport(el)) {
            el.classList.add('in');
            io.unobserve(el);
          }
        });
      };
      setTimeout(revealFallback, 350);
      window.addEventListener('scroll', revealFallback, { passive: true });
    }
  }

  /* عدّادات تصعد مرة واحدة عند دخول 35٪ من الشاشة */
  var counters = document.querySelectorAll('.counter[data-count]');
  if (counters.length) {
    var runCounter = function (el) {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduced) { el.textContent = toAr(target); return; }
      /* توقيت setTimeout لا rAF: يعمل حتى في التبويبات غير المركّبة */
      var t0 = performance.now(), dur = 1600;
      var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
      var tick = function () {
        var p = Math.min((performance.now() - t0) / dur, 1);
        el.textContent = toAr(Math.round(target * ease(p)));
        if (p < 1) setTimeout(tick, 24);
      };
      tick();
    };
    if (reduced || !('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
        });
      }, { threshold: 0.35 });
      counters.forEach(function (el) { cio.observe(el); });
      /* احتياط التبويبات غير المركّبة */
      setTimeout(function () {
        counters.forEach(function (el) {
          if (!el.dataset.done && inViewport(el)) { runCounter(el); cio.unobserve(el); }
        });
      }, 500);
    }
  }

  /* بحث الواجهة: فهرس خدمات المنصة */
  var searchForm = document.getElementById('heroSearch');
  var searchInput = document.getElementById('q');
  var suggestBox = document.getElementById('heroSuggest');
  if (searchForm && searchInput && suggestBox) {
    var INDEX = [
      { t: 'اختبار الاعتماد الهندسي', d: 'بوابة الاختبارات', href: 'exams.html', k: 'اختبار امتحان اعتماد رسوم شهادة فيديو استمارة وزارة' },
      { t: 'نموذج تجريبي من الامتحان', d: 'تجربة مجانية', href: 'exam-demo.html', k: 'نموذج تجريبي تجربة امتحان اسئلة تصحيح' },
      { t: 'مكتبة الأكواد الهندسية', d: 'كتب مرجعية واستمارات رسمية', href: 'codes.html', k: 'كود اكواد كتب خرسانة زلازل احمال كهرباء حريق مكتبة قراءة' },
      { t: 'التحقق من الشهادات', d: 'السجل المركزي', href: 'verify.html', k: 'تحقق شهادة كود سجل جهات بلدية موثقة' },
      { t: 'إنشاء حساب / تسجيل الدخول', d: 'الدخول الموحّد', href: 'login.html', k: 'حساب دخول تسجيل رقم نقابي واتساب رمز كلمة مرور' },
      { t: 'الأخبار وقرارات المجلس', d: 'آخر المستجدات', href: 'news.html', k: 'اخبار قرار مجلس اعلان صندوق اقراض مكاتب' }
      /* حُذف «دليل الهوية البصرية»: صفحة brand.html وثيقة داخلية تستبعدها
         أداة البناء من النشر (قاعدة `(qa|shot|brand|font-preview)`)، فكان
         الاقتراح يقود زائر الموقع المنشور إلى 404. */
    ];
    var norm = function (s) {
      return s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْ]/g, '').toLowerCase();
    };
    var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
    var current = [];
    var render = function (items) {
      current = items;
      if (!items.length) { suggestBox.hidden = true; suggestBox.innerHTML = ''; return; }
      suggestBox.innerHTML = items.map(function (it) {
        return '<a href="' + it.href + '">' + arrow + '<span>' + it.t + '</span><small>' + it.d + '</small></a>';
      }).join('');
      suggestBox.hidden = false;
    };
    var query = function () {
      var q = norm(searchInput.value.trim());
      if (q.length < 2) { render([]); return; }
      render(INDEX.filter(function (it) {
        return norm(it.t).indexOf(q) !== -1 || norm(it.k).indexOf(q) !== -1;
      }).slice(0, 5));
    };
    searchInput.addEventListener('input', query);
    searchInput.addEventListener('focus', query);
    document.addEventListener('click', function (e) {
      if (!searchForm.contains(e.target) && !suggestBox.contains(e.target)) render([]);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') render([]);
    });
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (current.length) { window.location.href = current[0].href; return; }
      var q = norm(searchInput.value.trim());
      var hit = INDEX.filter(function (it) {
        return q && (norm(it.t).indexOf(q) !== -1 || norm(it.k).indexOf(q) !== -1);
      })[0];
      window.location.href = hit ? hit.href : 'exams.html';
    });
  }

  /* شاشة الافتتاح: مرة واحدة لكل جلسة (الرئيسية فقط) */
  var splash = document.getElementById('splash');
  if (splash) {
    var done = false;
    try { done = sessionStorage.getItem('osea-splash-done') === '1'; } catch (err) { done = false; }
    if (done) {
      splash.remove();
    } else {
      try { sessionStorage.setItem('osea-splash-done', '1'); } catch (err) { /* وضع خاص */ }
      setTimeout(function () { splash.remove(); }, 2000);
    }
  }
})();
