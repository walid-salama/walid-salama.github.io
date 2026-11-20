# مفتاح - دليل التشغيل

العنوان: <https://walid-salama.github.io> (ونسخة احتياطية على <https://abu-hanin.pages.dev>). لوحة التحكم: `/admin.html`.

موقع لقفل الروابط والملفات والبرومبتات: المشاهد ينفّذ الخطوة المطلوبة (اشتراك، متابعة...) ثم يفتح القفل ويحصل على المحتوى.

- `index.html`: الصفحة الرئيسية (الروابط العامة).
- `link.html?s=...`: الصفحة اللي بتظهر للمشاهد.
- `admin.html`: لوحة التحكم (الإحصائيات وإنشاء الروابط).

من غير الخطوات دي الموقع بيشتغل في **وضع تجريبي**: البيانات محفوظة في متصفحك بس، ومش هتظهر لأي حد تاني.

## 1) قاعدة البيانات (Supabase - مجاني)

1. اعمل حساب ومشروع جديد على <https://supabase.com>.
2. افتح **SQL Editor**، الصق محتوى `supabase/setup.sql` كامل، واضغط **Run**.
3. من **Authentication > Sign In / Providers** اقفل **Allow new users to sign up**.
4. من **Authentication > Users** اضغط **Add user** وأنشئ حسابك بالبريد وكلمة مرور قوية.
5. ارجع إلى **SQL Editor** وشغّل السطر ده بعد ما تكتب بريدك:

   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'بريدك@example.com';
   ```

6. من **Project Settings > API** انسخ **Project URL** و **anon / publishable key** وضعهم في `assets/js/config.js`:

   ```js
   supabaseUrl: 'https://xxxx.supabase.co',
   supabaseAnonKey: '...',
   ```

## 2) التحقق الحقيقي من اشتراك يوتيوب (Google)

1. أنشئ مشروعًا على <https://console.cloud.google.com>.
2. من **APIs & Services > Library** فعّل **YouTube Data API v3**.
3. من **OAuth consent screen** اضبط بيانات التطبيق، وأضف صلاحية `youtube.readonly`.
4. من **Credentials > Create credentials > OAuth client ID** اختار **Web application**، وفي **Authorized JavaScript origins** أضف رابط موقعك: `https://USERNAME.github.io`.
5. انسخ **Client ID** وضعه في `config.js` في `googleClientId`.
6. من **OAuth consent screen** انقل التطبيق إلى **In production** واطلب مراجعة جوجل (مجانية).

> قبل موافقة جوجل: حتى 100 مستخدم فقط، وكل واحد هتظهر له شاشة تحذير "التطبيق غير موثّق". بعد الموافقة تختفي الاتنين. الحصة المجانية من يوتيوب تكفي حوالي 5000 عملية تحقق يوميًا.

## 3) الرفع على GitHub Pages

1. أنشئ مستودعًا عامًا جديدًا على GitHub وارفع كل ملفات الفولدر.
2. من **Settings > Pages** اختار **Deploy from a branch**، والفرع `main`، والمجلد `/ (root)`، ثم **Save**.
3. بعد دقيقة هيكون موقعك على `https://USERNAME.github.io/REPO/`، ولوحة التحكم على `.../admin.html`.

## 4) الكتب المدفوعة (Kashier)

كل بوست يقدر يبقى **مجاني** (بالخطوات زي ما هو) أو **مدفوع** (من خانة "مجاني ولا للبيع؟" في المحرر).

- **قاعدة البيانات:** شغّل `supabase/store.sql` في SQL Editor بعد `setup.sql`. الملف بيضيف السعر وبيانات الكتاب وجدول الطلبات، ومش بيغيّر أي حاجة في البوستات المجانية.
- **ملفات الكتب المدفوعة:** بتترفع على مستودع GitHub **خاص** اسمه `paid-books` (الإعداد `paidFiles` في `config.js`). المستودع ده محتاج ملف `.github/workflows/import-file.yml` (نسخة منه في فولدر `paid-books` على سطح المكتب)، ومفتاح لوحة التحكم لازم يكون له صلاحية عليه هو كمان.
- **دوال السيرفر** (Supabase > Edge Functions، وكلها من غير Verify JWT):
  - `store-checkout`: بيعمل الطلب ويفتح صفحة الدفع بتاعة Kashier. السعر بيتاخد من قاعدة البيانات بس.
  - `kashier-webhook`: Kashier بيبعت عليه نتيجة الدفع. هو بس اللي بيعلّم الطلب إنه مدفوع، وده بعد ما يتأكد من التوقيع والمبلغ.
  - `store-download`: بيدّي المشتري رابط تحميل صالح لدقايق بس، من المستودع الخاص.
- **الأسرار** (Edge Functions > Secrets)، وصاحب الموقع هو اللي يدخّلها بنفسه:
  - `KASHIER_MODE` (`test` أو `live`)
  - `KASHIER_MID`
  - `KASHIER_API_KEY`
  - `KASHIER_SECRET_KEY`
  - `SITE_URL`
  - `BOOKS_REPO` (`walid-salama/paid-books`)
  - `BOOKS_GITHUB_TOKEN`: مفتاح قراءة بس على `paid-books`.
- **صفحات المشتري والسياسات:**
  - `order.html`: صفحة الطلب والتحميل، ومن غير رقم طلب بتعرض مشترياتي.
  - صفحات السياسات: `about.html` و`terms.html` و`privacy.html` و`refund.html` و`contact.html`.
  - بيانات التواصل بتتكتب في `legal` في `config.js`.
- **الطلبات والمبيعات:** من زر "الطلبات والمبيعات" في لوحة التحكم.

## الإعدادات

في `assets/js/config.js` تقدر تغيّر:

- `siteName`: اسم الموقع. `tagline`: الجملة الرئيسية.
- `defaultChannel`: القناة في زر الإضافة السريعة.

## حدود لازم تعرفها

- **سياسات المنصات:** ربط المحتوى بخطوة إجبارية ممكن يخالف سياسات Meta ويوتيوب. سياسة Meta بتمنع صراحة طلب المتابعة أو أي تفاعل علني مقابل الوصول لمحتوى.
- **الخطوة بتكمل بعد 15 ثانية من الضغط على الزر** (`checkSeconds` في `config.js`)، وعداد تنازلي بيظهر جنب "جاري التحقق"، حتى لو المشاهد لسه في يوتيوب. الموقع مش بيعرف إذا كان اشترك فعلًا، وده ممكن يتم تجاوزه.
- **التأكد الفعلي** متاح لاشتراك يوتيوب بس، ومحتاج إعداد Google في الخطوة 2. باقي المنصات لا تتيح للمواقع التأكد.
- الزائر اللي اتأكد اشتراكه بيتذكره المتصفح 30 يومًا. من متصفح جديد هيتحقق مرة واحدة بس.
- ملفات الـ PDF محفوظة بأسماء عشوائية، ورابطها بيظهر بعد الفتح فقط. أي حد حصل على الرابط يقدر يشاركه.
- الكتب بتتحفظ في Release اسمه `files` على GitHub (الملف لحد 2 جيجا، ومفيش حد للمساحة أو التحميل)، والصور في فولدر `files/` على الموقع (مساحة الموقع كله 1 جيجا). Supabase للبيانات بس.
- مشروعات Supabase المجانية بتتوقف مؤقتًا بعد فترة طويلة من عدم النشاط، وتتفعل من لوحة Supabase.
