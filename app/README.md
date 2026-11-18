# StoreApp — যেকোনো WooCommerce সাইটকে iOS + Android অ্যাপ বানানোর সিস্টেম

এখানে দুটো অংশ:

```
storeapp/
├── plugin/storeapp-connector/   ← WordPress প্লাগইন (প্রতিটা ক্লায়েন্টের সাইটে বসবে)
└── app/                         ← একটাই Expo (React Native) অ্যাপ, সব ক্লায়েন্টের জন্য
    ├── clients/<slug>/          ← প্রতিটা ক্লায়েন্টের নাম, bundle ID, আইকন, splash, config snapshot
    ├── scripts/new-client.mjs   ← নতুন ক্লায়েন্ট বানানোর স্ক্রিপ্ট
    └── src/                     ← অ্যাপের কোড (expo-router)
```

## ১. প্লাগইন (StoreApp Connector)

ইনস্টল: WP Admin → Plugins → Add New → Upload → `storeapp-connector.zip` → Activate।
এরপর বাম মেনুতে **StoreApp** আসবে। সেখান থেকে কালার, লোগো, ব্যানার, হোম সেকশন, কন্টাক্ট, ফিচার অন/অফ আর পুশ নোটিফিকেশন পাঠানো যায়। কোনো ঘর খালি রাখলে প্লাগইন থিম থেকে নিজে খুঁজে নেয়।

প্লাগইন যা যা দেয়:

| Endpoint | কাজ |
|---|---|
| `GET /wp-json/storeapp/v1/config` | ব্র্যান্ডিং (Elementor/theme.json/Astra/Flatsome/Woodmart থেকে কালার), WCAG কনট্রাস্ট ঠিক করা palette, Google Font এর TTF লিংক, হোম লেআউট, চেকআউট ফিল্ড, জেলা→থানা লিস্ট (BD Smart Address থেকে), পেমেন্ট মেথড |
| `POST /auth/login`, `/auth/register`, `/auth/forgot`, `/auth/logout` | মোবাইল নম্বর/ইমেইল/ইউজারনেম দিয়ে লগইন; টোকেন `X-StoreApp-Token` হেডারে যায় (Hostinger/LiteSpeed এ Authorization হেডার কেটে যায় বলে) |
| `GET/POST/DELETE /me`, `/me/password` | প্রোফাইল, ঠিকানা, পাসওয়ার্ড, অ্যাকাউন্ট ডিলিট (Apple এর নিয়ম অনুযায়ী বাধ্যতামূলক) |
| `GET /orders`, `/orders/{id}`, `POST /orders/{id}/cancel`, `POST /track` | কাস্টমারের নিজের অর্ডার, গেস্ট অর্ডার ট্র্যাকিং |
| `POST /push/register` | Expo push টোকেন সেভ; অর্ডার স্ট্যাটাস বদলালে অটো নোটিফিকেশন |

কার্ট আর চেকআউট চলে WooCommerce এর নিজের **Store API** (`/wc/store/v1`) দিয়ে, তাই শিপিং জোন, কুপন, স্টক, মিনিমাম অর্ডার সব সাইটের নিয়মেই চলে।

**Classic checkout bridge:** অনেক সাইটে classic checkout এর hook দিয়ে কাস্টম নিয়ম বানানো থাকে (ফোন ভ্যালিডেশন, একই নম্বর থেকে ১০ মিনিটে ডুপ্লিকেট অর্ডার ব্লক ইত্যাদি)। Store API এই hook গুলো চালায় না। প্লাগইন অ্যাপ থেকে আসা অর্ডারের জন্য `woocommerce_checkout_process`, `woocommerce_after_checkout_validation` আর `woocommerce_checkout_order_processed` চালায়, ফলে ওয়েবসাইট আর অ্যাপ একই নিয়ম মানে। সাইটের checkout থেকে বাদ দেওয়া ফিল্ড (যেমন last name) Store API যেন বাধ্যতামূলক না ধরে, সেটাও প্লাগইন ঠিক করে দেয়। ইমেইল ঐচ্ছিক রাখা সাইটের জন্যও এটা কাজ করে।

## ২. অ্যাপ চালানো (ডেভেলপমেন্ট)

```bash
cd app
npm install
npm run use-client -- ceramicbysarah
npx eas-cli@latest build --profile development --platform android   # একবার dev build বানাতে হবে
npx expo start                                                       # তারপর ফোনে dev build খুলে QR স্ক্যান
```

> Notifications, SecureStore, WebView এর মতো native module থাকায় Expo Go তে পুরোটা চলবে না। একবার dev build বানিয়ে নিলে এরপর কোড বদলালে সাথে সাথে ফোনে দেখা যাবে।

## ৩. নতুন ক্লায়েন্ট যোগ করা

ক্লায়েন্টের সাইটে প্লাগইন ইনস্টল করে তারপর:

```bash
npm run client -- https://client-site.com --slug clientname --bundle com.clientname.app
```

এই একটা কমান্ড যা করে:
1. সাইট থেকে config পড়ে
2. লোগো/সাইট আইকন নামিয়ে ব্র্যান্ড কালারে অ্যাপ আইকন, Android adaptive icon, splash আর notification icon বানায়
3. `clients/clientname/` ফোল্ডারে সব রাখে এবং প্রজেক্টকে ওই ক্লায়েন্টে সুইচ করে

> ceramicbysarah এর জন্য এখন একটা placeholder আইকন আছে (সবুজ বৃত্তে "S")। আসল লোগো দিয়ে আইকন বানাতে নিজের কম্পিউটারে একবার `npm run client -- https://ceramicbysarah.com --slug ceramicbysarah` চালান।

## ৪. স্টোরে পাবলিশ

```bash
npm run use-client -- clientname
npx eas-cli@latest init          # প্রতি ক্লায়েন্টে একবার; projectId টা clients/clientname/client.json এর easProjectId তে বসান
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform all
```

- **পুশ নোটিফিকেশন** কাজ করতে `easProjectId` লাগবে। Android এর জন্য EAS এ FCM credentials আর iOS এর জন্য APNs key সেট করতে হবে (`eas credentials`)।
- **Apple/Google এর নিয়ম:** আমার জানা মতে টেমপ্লেট দিয়ে বানানো অ্যাপ প্রতিটা ক্লায়েন্টের নিজের ডেভেলপার অ্যাকাউন্ট থেকে সাবমিট করতে হয় (Apple guideline 4.2.6)। নিজের এক অ্যাকাউন্ট থেকে অনেক ক্লায়েন্টের অ্যাপ দিলে reject হওয়ার ঝুঁকি আছে।
- নতুন ভার্সন দেওয়ার সময় `clients/<slug>/client.json` এ `version` আর `buildNumber` বাড়ান।

## ৫. অ্যাপে যা আছে

- রানটাইম থিমিং: কালার, লোগো, Google Font, রেডিয়াস, ডার্ক মোড; প্রথমবার চালু হওয়ার পর config ক্যাশে থাকে, তাই অফলাইনেও ব্র্যান্ডিং ঠিক থাকে
- হোম: নোটিশ, ব্যানার স্লাইডার (ব্যানার না থাকলে ব্র্যান্ড কালারে অটো hero), ক্যাটাগরি, প্রোডাক্ট সেকশন (খালি সেকশন নিজে লুকিয়ে যায়)
- ক্যাটাগরি, সার্চ (live), সর্ট, সাব-ক্যাটাগরি চিপ, infinite scroll
- প্রোডাক্ট পেজ: গ্যালারি, ভ্যারিয়েশন (রং/সাইজ), স্টক, রিভিউ, related, share, Buy now
- কার্ট: পরিমাণ বদলানো, কুপন, টোটাল; চেকআউট: সাইটের নিজের ফিল্ড থেকে ফর্ম তৈরি, জেলা→থানা পিকার, ডেলিভারি চার্জ লাইভ হিসাব, পেমেন্ট মেথড, অর্ডার নোট
- অনলাইন পেমেন্ট (bKash/SSLCommerz ইত্যাদি) অ্যাপের ভেতরে WebView তে
- লগইন/রেজিস্ট্রেশন (মোবাইল নম্বর দিয়ে), প্রোফাইল, পাসওয়ার্ড বদল, অ্যাকাউন্ট ডিলিট
- আমার অর্ডার, অর্ডার টাইমলাইন, ক্যানসেল, WhatsApp এ অর্ডার নিয়ে যোগাযোগ, গেস্ট অর্ডার ট্র্যাকিং
- উইশলিস্ট, পুশ নোটিফিকেশন (প্রথম অর্ডারের পর অনুমতি চায়), বাংলা/ইংরেজি UI
