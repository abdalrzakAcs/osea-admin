/* إعداد الاتصال بقاعدة المنصة — مفتاح anon علني بطبيعته والحماية في RLS */
/* وضع التجربة المجانية: كل الخدمات بلا رسوم مع بقاء الحماية والتحكم بالوصول كاملين.
   يُطفأ بتغيير القيمة إلى false فتعود شاشة الدفع وشرط السداد كما هي. */
window.OSEA_FREE_TRIAL = true;

/* رمز إصدار التطبيق — يُطابق versionCode في build.gradle ويُرفع مع كل إصدار */
window.OSEA_VERSION_CODE = 15;

/* ⚠️ النطاق الذي تُنشر عليه المنصة فعلياً.
   هذا العنوان يُطبع داخل رمز QR على كل شهادة، والشهادة المطبوعة لا يتغيّر رمزها بعدها.
   لا تُصدر شهادات نهائية قبل ضبطه على النطاق الصحيح والتأكد أن verify.html يفتح عليه.
   مؤقتاً — حتى حسم النطاق الرسمي (المطلوب من النقابة، البند ١ العاجل) — يشير الرمز
   إلى صفحة تحقق حية تخدمها دالة الحافة cert-verify على مشروع القاعدة نفسه، كي يعمل
   المسح فعلياً في جولات التجربة. العنوان السابق osea.org.sy موقع ووردبريس النقابة
   الحالي ولا يستضيف المنصة فكان الرمز يفتح صفحة «غير موجود». */
window.OSEA_VERIFY_BASE = 'https://kdvhiywnjybdlmzmkjup.supabase.co/functions/v1/cert-verify';

/* حساب شام كاش التجاري للنقابة المركزية — من ملصق الـQR الرسمي.
   يُعرض في شاشة الدفع رمزاً ونصاً، وأي تغيير فيه يتم هنا فقط. */
window.OSEA_SHAM = {
  MERCHANT_CODE: 'be705b9af507f7f9d968376022513066',
  MERCHANT_NAME: 'نقابة المهندسين السوريين المركزية'
};

window.OSEA_CONFIG = {
  SUPABASE_URL: 'https://kdvhiywnjybdlmzmkjup.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdmhpeXduanliZGxtem1ranVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MTg5MTEsImV4cCI6MjEwMjM5NDkxMX0.DmNj9Qe0Y6pj9Hj5enyilifH-oxGCdd6Ufgij7zgeMI'
};
