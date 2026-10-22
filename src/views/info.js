// About, Help, Privacy, Terms, Disclaimer and Contact pages (bilingual).
import { html, raw } from "../lib/util.js";
import { markdown } from "../lib/markdown.js";
import { layout, pageHead } from "./layout.js";
import { icon } from "./icons.js";

const CONTENT = {
  "certificate-policy": {
    en: `<h2>Who receives a certificate</h2>
<ul>
<li>Certificates are issued automatically when a candidate reaches the pass mark in an exam that offers a certificate (the <strong>Professional</strong> and <strong>Pro</strong> exams).</li>
<li>The <strong>Knowledge Check</strong> exam does not issue a certificate. Its result can be shared with a link.</li>
<li>Scoring happens on our server. Questions are drawn at random from a larger bank and the order of options is shuffled for every candidate.</li>
</ul>
<h2>What the certificate shows</h2>
<p>The candidate's name as entered before the exam, the exam level, the score, the issue date and a unique ID (for example <span class="mono">PB-2026-ABCD-1234</span>) with a QR code.</p>
<h2>Verification</h2>
<p>Anyone can check a certificate on the <a href="/en/certificates/verify">verification page</a> or by scanning its QR code. Verification shows the name, level, score, date and status — never the email address.</p>
<h2>Name corrections</h2>
<p>The name is printed exactly as typed. If you made a spelling mistake, contact us with the certificate ID within 30 days and we will correct it once.</p>
<h2>Revocation</h2>
<p>We may revoke a certificate if we find impersonation, sharing of exam questions, automated answering or other misconduct, or a payment that was reversed. A revoked certificate shows the status "Revoked" on the verification page.</p>
<h2>What it is not</h2>
<p>ProcureBest certificates are online assessment certificates issued by this platform. They are not a university degree, government recognition or professional accreditation such as CIPS, ASCM or ISM.</p>`,
    bn: `<h2>কে সার্টিফিকেট পাবেন</h2>
<ul>
<li>যে পরীক্ষায় সার্টিফিকেট আছে (<strong>প্রফেশনাল</strong> ও <strong>প্রো</strong>), সেখানে পাস নম্বর পেলে সার্টিফিকেট স্বয়ংক্রিয়ভাবে ইস্যু হয়।</li>
<li><strong>নলেজ চেক</strong> পরীক্ষায় সার্টিফিকেট নেই। এর ফলাফল লিংক দিয়ে শেয়ার করা যায়।</li>
<li>নম্বর আমাদের সার্ভারে দেওয়া হয়। বড় প্রশ্নব্যাংক থেকে এলোমেলোভাবে প্রশ্ন আসে এবং প্রত্যেক পরীক্ষার্থীর জন্য বিকল্পের ক্রম বদলে যায়।</li>
</ul>
<h2>সার্টিফিকেটে যা থাকে</h2>
<p>পরীক্ষার আগে লেখা পরীক্ষার্থীর নাম, পরীক্ষার স্তর, নম্বর, ইস্যুর তারিখ এবং একটি অনন্য আইডি (যেমন <span class="mono">PB-2026-ABCD-1234</span>) ও QR কোড।</p>
<h2>যাচাই</h2>
<p>যে কেউ <a href="/bn/certificates/verify">যাচাই পাতায়</a> অথবা QR কোড স্ক্যান করে সার্টিফিকেট যাচাই করতে পারেন। যাচাইয়ে নাম, স্তর, নম্বর, তারিখ ও অবস্থা দেখা যায় — ইমেইল ঠিকানা কখনো দেখানো হয় না।</p>
<h2>নাম সংশোধন</h2>
<p>নাম যেভাবে লেখা হয়েছে হুবহু সেভাবেই ছাপা হয়। বানানে ভুল হলে ৩০ দিনের মধ্যে সার্টিফিকেট আইডিসহ যোগাযোগ করুন — একবার সংশোধন করে দেওয়া হবে।</p>
<h2>বাতিল</h2>
<p>অন্যের হয়ে পরীক্ষা দেওয়া, প্রশ্ন ফাঁস, স্বয়ংক্রিয় উত্তর বা অন্য অসদাচরণ, কিংবা পেমেন্ট ফেরত নেওয়া হলে আমরা সার্টিফিকেট বাতিল করতে পারি। বাতিল সার্টিফিকেট যাচাই পাতায় "বাতিল" দেখাবে।</p>
<h2>যা নয়</h2>
<p>ProcureBest-এর সার্টিফিকেট এই প্ল্যাটফর্মের অনলাইন অ্যাসেসমেন্ট সার্টিফিকেট। এটি কোনো বিশ্ববিদ্যালয়ের ডিগ্রি, সরকারি স্বীকৃতি বা CIPS, ASCM, ISM-এর মতো পেশাদার অ্যাক্রেডিটেশন নয়।</p>`,
  },
  about: {
    en: `<p>ProcureBest is built from the perspective of a working procurement and sourcing professional. The goal is simple: replace guesswork in buying decisions with transparent numbers.</p>
<h2>What we offer</h2>
<ul>
<li><strong>Free calculators</strong> — total cost of ownership, shipping & import (landed) cost and comparative statements. Every formula is shown openly.</li>
<li><strong>Exams and certificates</strong> — test your knowledge at three levels and earn a certificate anyone can verify.</li>
<li><strong>A library</strong> — books, Excel templates, CV samples and document templates for day-to-day work.</li>
<li><strong>Learning</strong> — a blog, a bilingual glossary and career advice.</li>
</ul>
<h2>Our principles</h2>
<p>We do not invent official duty rates, live exchange rates or HS classifications. Where official information is needed, you are asked to verify it. Calculator results support decisions — they are not legal, tax or financial advice.</p>
<p>ProcureBest certificates are platform-issued online assessment certificates. They are not government recognition or professional accreditation.</p>`,
    bn: `<p>ProcureBest একজন কর্মরত প্রকিউরমেন্ট ও সোর্সিং পেশাজীবীর দৃষ্টিভঙ্গি থেকে তৈরি। লক্ষ্য একটাই — ক্রয় সিদ্ধান্তকে অনুমানের বদলে স্বচ্ছ সংখ্যার ওপর দাঁড় করানো।</p>
<h2>আমরা যা দিই</h2>
<ul>
<li><strong>বিনামূল্যের ক্যালকুলেটর</strong> — মোট মালিকানা খরচ (টিসিও), শিপিং ও আমদানি (ল্যান্ডেড) খরচ এবং তুলনামূলক বিবরণী। প্রতিটি সূত্র খোলাখুলি দেখানো হয়।</li>
<li><strong>পরীক্ষা ও সার্টিফিকেট</strong> — তিনটি স্তরে নিজের জ্ঞান যাচাই করুন এবং যে কেউ যাচাই করতে পারে এমন সার্টিফিকেট অর্জন করুন।</li>
<li><strong>লাইব্রেরি</strong> — প্রতিদিনের কাজের জন্য বই, এক্সেল টেমপ্লেট, সিভি নমুনা ও ডকুমেন্ট টেমপ্লেট।</li>
<li><strong>শেখা</strong> — ব্লগ, দ্বিভাষিক গ্লসারি ও ক্যারিয়ার পরামর্শ।</li>
</ul>
<h2>আমাদের নীতি</h2>
<p>আমরা কোনো সরকারি শুল্কহার, লাইভ বিনিময় হার বা এইচএস শ্রেণিবিন্যাস তৈরি করি না। যেখানে সরকারি তথ্য প্রয়োজন, সেখানে আপনাকে তা নিজে যাচাই করতে বলা হয়। ক্যালকুলেটরের ফলাফল সিদ্ধান্ত নিতে সহায়তা করে — এগুলো আইনি, কর বা আর্থিক পরামর্শ নয়।</p>
<p>ProcureBest-এর সার্টিফিকেট প্ল্যাটফর্মের নিজস্ব অনলাইন অ্যাসেসমেন্ট সার্টিফিকেট; এগুলো কোনো সরকারি স্বীকৃতি বা পেশাদার অ্যাক্রেডিটেশন নয়।</p>`,
  },
  privacy: {
    en: `<h2>What we collect</h2>
<ul>
<li><strong>Calculator inputs</strong> stay in your browser. They are not sent to our server; Excel and PDF reports are created on your device.</li>
<li><strong>Email address</strong> — when you download a file, take an exam, place an order or subscribe. We send a single-use link (valid for 60 minutes) to confirm it.</li>
<li><strong>Exam data</strong> — your name as it should appear on the certificate, your answers, score and certificate.</li>
<li><strong>Orders</strong> — name, optional phone, the bKash/Nagad number you paid from and the Transaction ID, so we can match your payment by hand.</li>
<li><strong>Messages</strong> you send through the contact form.</li>
<li><strong>Abuse prevention</strong> — rate limits use a one-way hash of your IP address; the raw IP address is not stored.</li>
</ul>
<h2>Cookies</h2>
<p>We use only necessary cookies: one that remembers your confirmed email in this browser, and (for site administrators) a sign-in session. Calculators may keep your last inputs in your browser's local storage so you do not lose work. There are no advertising trackers.</p>
<h2>Sharing</h2>
<p>We do not sell your data. We use an email delivery provider to send messages and Cloudflare to host the website and database; they process data only to provide those services.</p>
<h2>Certificate verification</h2>
<p>Anyone with a certificate ID can see the candidate name, level, score, issue date and status on the verification page. Email addresses are never shown.</p>
<h2>Your rights</h2>
<p>To see, correct or delete your data, or to unsubscribe, please contact us.</p>`,
    bn: `<h2>আমরা কী তথ্য সংগ্রহ করি</h2>
<ul>
<li><strong>ক্যালকুলেটরের ইনপুট</strong> আপনার ব্রাউজারেই থাকে। এগুলো আমাদের সার্ভারে পাঠানো হয় না; এক্সেল ও পিডিএফ রিপোর্ট আপনার ডিভাইসেই তৈরি হয়।</li>
<li><strong>ইমেইল ঠিকানা</strong> — ফাইল ডাউনলোড, পরীক্ষা, অর্ডার বা সাবস্ক্রাইব করার সময়। নিশ্চিত করতে আমরা একবার ব্যবহারযোগ্য লিংক পাঠাই (৬০ মিনিট বৈধ)।</li>
<li><strong>পরীক্ষার তথ্য</strong> — সার্টিফিকেটে যেভাবে থাকবে আপনার নাম, উত্তর, নম্বর ও সার্টিফিকেট।</li>
<li><strong>অর্ডার</strong> — নাম, ঐচ্ছিক ফোন, যে bKash/Nagad নম্বর থেকে পরিশোধ করেছেন এবং Transaction ID, যাতে আমরা হাতে পেমেন্ট মেলাতে পারি।</li>
<li><strong>বার্তা</strong> — যোগাযোগ ফর্মের মাধ্যমে আপনি যা পাঠান।</li>
<li><strong>অপব্যবহার প্রতিরোধ</strong> — রেট-লিমিটের জন্য আইপি ঠিকানার একমুখী হ্যাশ ব্যবহার করা হয়; মূল আইপি সংরক্ষণ করা হয় না।</li>
</ul>
<h2>কুকি</h2>
<p>আমরা শুধু প্রয়োজনীয় কুকি ব্যবহার করি: এই ব্রাউজারে আপনার নিশ্চিত ইমেইল মনে রাখার একটি কুকি এবং (সাইট অ্যাডমিনদের জন্য) একটি সাইন-ইন সেশন। কাজ যাতে হারিয়ে না যায়, তাই ক্যালকুলেটর আপনার শেষ ইনপুট ব্রাউজারের লোকাল স্টোরেজে রাখতে পারে। বিজ্ঞাপনের কোনো ট্র্যাকার নেই।</p>
<h2>তথ্য শেয়ার</h2>
<p>আমরা আপনার তথ্য বিক্রি করি না। ইমেইল পাঠাতে একটি ইমেইল সেবাদাতা এবং ওয়েবসাইট ও ডাটাবেস চালাতে Cloudflare ব্যবহার করি; তারা কেবল এই সেবার জন্য তথ্য প্রক্রিয়া করে।</p>
<h2>সার্টিফিকেট যাচাই</h2>
<p>সার্টিফিকেট আইডি জানা যে কেউ যাচাই পাতায় প্রার্থীর নাম, স্তর, নম্বর, ইস্যুর তারিখ ও অবস্থা দেখতে পারেন। ইমেইল ঠিকানা কখনো দেখানো হয় না।</p>
<h2>আপনার অধিকার</h2>
<p>আপনার তথ্য দেখতে, সংশোধন করতে বা মুছে ফেলতে, অথবা সাবস্ক্রিপশন বন্ধ করতে আমাদের সঙ্গে যোগাযোগ করুন।</p>`,
  },
  terms: {
    en: `<h2>Using ProcureBest</h2>
<p>You may use the calculators, exams and library for your own professional work and learning. Do not attempt to copy the question bank, overload the service or access it with automated tools.</p>
<h2>Downloads and purchases</h2>
<ul>
<li>Files are for use by the person or organisation that downloaded or bought them. Do not resell or republish them.</li>
<li>Paid items are paid by bKash or Nagad "Send Money". Access is given after we confirm the payment by hand. If a payment cannot be matched, we contact you by email.</li>
<li>A paid exam purchase includes the number of attempts shown on the exam page.</li>
<li>Because digital files can be copied, purchases are normally not refundable once access has been given. If something is wrong with a file, contact us and we will fix it.</li>
</ul>
<h2>Exams and certificates</h2>
<p>Answer the questions yourself. We may revoke a certificate obtained dishonestly. Certificates show the result of an online assessment on this platform.</p>
<h2>Results are estimates</h2>
<p>Calculator results depend entirely on the figures you enter. They are not official rates or professional advice. See the Disclaimer.</p>`,
    bn: `<h2>ProcureBest ব্যবহার</h2>
<p>আপনি নিজের পেশাগত কাজ ও শেখার জন্য ক্যালকুলেটর, পরীক্ষা ও লাইব্রেরি ব্যবহার করতে পারেন। প্রশ্নব্যাংক কপি করার চেষ্টা, সেবার ওপর অতিরিক্ত চাপ তৈরি বা স্বয়ংক্রিয় টুল দিয়ে প্রবেশ করবেন না।</p>
<h2>ডাউনলোড ও কেনাকাটা</h2>
<ul>
<li>ফাইলগুলো যিনি বা যে প্রতিষ্ঠান ডাউনলোড বা কিনেছেন তাঁদের ব্যবহারের জন্য। পুনরায় বিক্রি বা প্রকাশ করবেন না।</li>
<li>পেইড আইটেমের মূল্য bKash বা Nagad-এর "Send Money" দিয়ে পরিশোধ করতে হয়। আমরা হাতে পেমেন্ট নিশ্চিত করার পর অ্যাক্সেস দেওয়া হয়। পেমেন্ট মেলানো না গেলে আমরা ইমেইলে যোগাযোগ করি।</li>
<li>পেইড পরীক্ষা কিনলে পরীক্ষার পাতায় দেখানো সংখ্যকবার পরীক্ষা দেওয়া যায়।</li>
<li>ডিজিটাল ফাইল কপি করা যায় বলে অ্যাক্সেস দেওয়ার পর সাধারণত টাকা ফেরত দেওয়া হয় না। কোনো ফাইলে সমস্যা থাকলে যোগাযোগ করুন, আমরা ঠিক করে দেব।</li>
</ul>
<h2>পরীক্ষা ও সার্টিফিকেট</h2>
<p>প্রশ্নের উত্তর নিজে দিন। অসৎ উপায়ে পাওয়া সার্টিফিকেট আমরা বাতিল করতে পারি। সার্টিফিকেট এই প্ল্যাটফর্মে অনলাইন মূল্যায়নের ফলাফল দেখায়।</p>
<h2>ফলাফল আনুমানিক</h2>
<p>ক্যালকুলেটরের ফলাফল পুরোপুরি আপনার দেওয়া সংখ্যার ওপর নির্ভর করে। এগুলো সরকারি হার বা পেশাদার পরামর্শ নয়। দায়মুক্তি পাতা দেখুন।</p>`,
  },
  disclaimer: {
    en: `<p>ProcureBest calculators produce estimates from the figures you enter. Duty and tax rates, exchange rates, HS codes, freight rates and valuation rules change and depend on your situation.</p>
<ul>
<li>We do not publish official tariffs, exchange rates or classifications.</li>
<li>Always confirm duties, taxes and valuation with Bangladesh Customs (NBR) or a licensed C&F agent before you commit.</li>
<li>Results are not legal, tax, accounting or financial advice.</li>
<li>Templates and books are provided as general guidance; adapt them to your organisation's policies.</li>
</ul>`,
    bn: `<p>ProcureBest ক্যালকুলেটর আপনার দেওয়া সংখ্যা থেকে আনুমানিক হিসাব দেয়। শুল্ক ও করের হার, বিনিময় হার, এইচএস কোড, ফ্রেইট হার ও মূল্যায়নের নিয়ম পরিবর্তিত হয় এবং আপনার অবস্থার ওপর নির্ভর করে।</p>
<ul>
<li>আমরা সরকারি শুল্কহার, বিনিময় হার বা শ্রেণিবিন্যাস প্রকাশ করি না।</li>
<li>সিদ্ধান্তের আগে সবসময় বাংলাদেশ কাস্টমস (এনবিআর) বা লাইসেন্সপ্রাপ্ত সিএন্ডএফ এজেন্টের কাছ থেকে শুল্ক, কর ও মূল্যায়ন নিশ্চিত করুন।</li>
<li>ফলাফল আইনি, কর, হিসাব বা আর্থিক পরামর্শ নয়।</li>
<li>টেমপ্লেট ও বই সাধারণ নির্দেশনা হিসেবে দেওয়া; আপনার প্রতিষ্ঠানের নীতি অনুযায়ী সাজিয়ে নিন।</li>
</ul>`,
  },
};

const FAQ = {
  en: [
    ["Do I need an account?", "No. There are no accounts or passwords. Calculators work without anything; downloads, exams and purchases only need your email, confirmed once in each browser."],
    ["Why do you ask me to confirm my email before downloading?", "It stops automated abuse and makes sure files, certificates and order updates reach an inbox you control. After you confirm once, this browser remembers it."],
    ["How do I buy a paid book, file or the Pro exam?", "Open the item and press Buy. Send the amount with bKash or Nagad \"Send Money\" to the number shown, then enter the Transaction ID. We check every payment by hand and email you when it is approved."],
    ["How many times can I take an exam?", "The free exams can be taken a few times a day (shown on the exam page). One payment for the Pro exam gives three attempts."],
    ["How are exams scored?", "Scoring happens on the server after you submit, or automatically when the timer ends. You see your score by topic. Correct answers are not shown, to protect the question bank."],
    ["Where do the duty rates and exchange rates come from?", "From you. ProcureBest does not publish official rates. Enter the rates for your HS code and the rate your bank will apply."],
    ["Is the certificate an accreditation?", "No. It is a ProcureBest online assessment certificate that anyone can verify online using its ID or QR code."],
    ["Where are my downloads and certificates?", "Open \"My downloads & certificates\" (the person icon at the top). It shows everything linked to your confirmed email in this browser."],
  ],
  bn: [
    ["অ্যাকাউন্ট কি লাগবে?", "না। কোনো অ্যাকাউন্ট বা পাসওয়ার্ড নেই। ক্যালকুলেটর কিছু ছাড়াই চলে; ডাউনলোড, পরীক্ষা ও কেনাকাটায় শুধু আপনার ইমেইল লাগে, প্রতিটি ব্রাউজারে একবার নিশ্চিত করলেই হয়।"],
    ["ডাউনলোডের আগে ইমেইল নিশ্চিত করতে হয় কেন?", "এতে স্বয়ংক্রিয় অপব্যবহার বন্ধ হয় এবং ফাইল, সার্টিফিকেট ও অর্ডারের খবর আপনার নিজের ইনবক্সে পৌঁছায়। একবার নিশ্চিত করলে এই ব্রাউজার তা মনে রাখে।"],
    ["পেইড বই, ফাইল বা প্রো পরীক্ষা কীভাবে কিনব?", "আইটেমটি খুলে Buy চাপুন। দেখানো নম্বরে bKash বা Nagad-এর \"Send Money\" দিয়ে টাকা পাঠান, তারপর Transaction ID লিখুন। আমরা প্রতিটি পেমেন্ট নিজে যাচাই করি এবং অনুমোদন হলে ইমেইল পাঠাই।"],
    ["একটি পরীক্ষা কতবার দেওয়া যায়?", "ফ্রি পরীক্ষাগুলো দিনে কয়েকবার দেওয়া যায় (পরীক্ষার পাতায় দেখানো আছে)। প্রো পরীক্ষার এক পেমেন্টে তিনবার দেওয়া যায়।"],
    ["পরীক্ষার নম্বর কীভাবে দেওয়া হয়?", "জমা দেওয়ার পর অথবা সময় শেষ হলে স্বয়ংক্রিয়ভাবে সার্ভারে নম্বর দেওয়া হয়। বিষয়ভিত্তিক ফলাফল দেখতে পাবেন। প্রশ্নব্যাংক সুরক্ষার জন্য সঠিক উত্তর দেখানো হয় না।"],
    ["শুল্কহার ও বিনিময় হার কোথা থেকে আসে?", "আপনার কাছ থেকে। ProcureBest সরকারি হার প্রকাশ করে না। আপনার এইচএস কোডের হার এবং ব্যাংকের বিনিময় হার লিখুন।"],
    ["সার্টিফিকেট কি কোনো অ্যাক্রেডিটেশন?", "না। এটি ProcureBest-এর অনলাইন অ্যাসেসমেন্ট সার্টিফিকেট, যা যে কেউ আইডি বা QR কোড দিয়ে অনলাইনে যাচাই করতে পারেন।"],
    ["আমার ডাউনলোড ও সার্টিফিকেট কোথায় পাব?", "ওপরের মানুষের আইকনে \"আমার ডাউনলোড ও সার্টিফিকেট\" খুলুন। এই ব্রাউজারে আপনার নিশ্চিত ইমেইলের সঙ্গে যুক্ত সবকিছু সেখানে দেখা যাবে।"],
  ],
};

export async function infoPage(c, page) {
  const s = await c.settings();
  const title = c.t(`page.${page}.title`);
  let inner;
  if (page === "contact") return contactPage(c, s);
  if (page === "help") {
    inner = html`${FAQ[c.lang].map(([q, a], i) => html`<details class="disclosure" ${i === 0 ? raw("open") : ""}><summary>${q}</summary><div><p>${a}</p></div></details>`)}
      <p style="margin-top:32px"><a class="btn btn-primary" href="${c.p("/contact")}">${c.t("footer.contact")}</a></p>`;
  } else {
    inner = html`${raw(CONTENT[page][c.lang])}<p style="margin-top:28px"><a class="btn btn-secondary" href="${c.p("/contact")}">${c.t("footer.contact")}</a></p>`;
  }
  if (page === "about") inner = html`${founderBlock(c, s)}<h2 id="about-us">${c.t("nav.about_us")}</h2>${raw(c.pick(s.about_en, s.about_bn) ? markdown(c.pick(s.about_en, s.about_bn)) : CONTENT.about[c.lang])}
    <p style="margin-top:28px"><a class="btn btn-secondary" href="${c.p("/contact")}">${c.t("footer.contact")}</a></p>`;
  const lead = page === "about" ? c.t("page.about.lead") : page === "help" ? c.t("page.help.lead") : "";
  const body = html`${pageHead(c, { title, lead, narrow: true })}<section class="section-sm" style="padding-top:0"><div class="wrap wrap-narrow prose">${inner}</div></section>`;
  return c.html(await layout(c, { title, description: c.t(`page.${page}.meta`), body }));
}

// Founder profile (Admin → About & founder). Hidden until a name is entered.
function founderBlock(c, s) {
  const name = c.pick(s.founder_name_en, s.founder_name_bn);
  if (!name) return "";
  const title = c.pick(s.founder_title_en, s.founder_title_bn);
  const bio = c.pick(s.founder_bio_en, s.founder_bio_bn);
  const exp = c.pick(s.founder_experience_en, s.founder_experience_bn);
  return html`<div class="founder not-prose" id="founder">
    ${s.founder_photo_id ? html`<img class="founder-photo" src="/media/${s.founder_photo_id}" alt="${name}">` : html`<div class="founder-photo placeholder">${icon("user", 40)}</div>`}
    <div><span class="eyebrow">${c.t("founder.eyebrow")}</span><h2 style="margin:0 0 4px">${name}</h2>
      ${title ? html`<p class="muted" style="margin:0 0 14px">${title}</p>` : ""}
      ${bio ? html`<div class="prose" style="font-size:17px">${raw(markdown(bio))}</div>` : ""}
      ${/^https:\/\/(www\.)?linkedin\.com\//.test(s.founder_linkedin || "") ? html`<a class="btn btn-ghost btn-sm" href="${s.founder_linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
    </div></div>
  ${exp ? html`<h2>${c.t("founder.experience")}</h2><div class="founder-exp">${raw(markdown(exp))}</div>` : ""}`;
}

async function contactPage(c, s) {
  const body = html`${pageHead(c, { title: c.t("page.contact.title"), lead: c.t("page.contact.lead") })}
<section class="section-sm" style="padding-top:0">
  <div class="wrap split" style="align-items:start">
    <div class="panel">
      <form action="/api/contact" data-json-form data-hide-on-ok novalidate>
        <div style="position:absolute;left:-5000px" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-grid">
          <div class="field"><label for="c-name">${c.t("form.name")} *</label><input id="c-name" name="name" required autocomplete="name"></div>
          <div class="field"><label for="c-email">${c.t("form.email")} *</label><input id="c-email" type="email" name="email" required autocomplete="email"></div>
          <div class="field full"><label for="c-subject">${c.t("form.subject")}</label><input id="c-subject" name="subject"></div>
          <div class="field full"><label for="c-msg">${c.t("form.message")} *</label><textarea id="c-msg" name="message" required></textarea></div>
        </div>
        <div class="alert" data-form-msg hidden style="margin-top:16px"></div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${c.t("contact.send")}</button></div>
        <p class="tiny muted" style="margin-top:12px" data-hide>${c.t("contact.privacy")}</p>
      </form>
    </div>
    <div class="stack">
      ${s.contact_email ? html`<div class="card surface"><div class="card-icon">${icon("mail", 20)}</div><h3>${c.t("form.email")}</h3><p><a href="mailto:${s.contact_email}">${s.contact_email}</a></p></div>` : ""}
      ${s.contact_phone ? html`<div class="card surface"><div class="card-icon">${icon("phone", 20)}</div><h3>${c.t("contact.phone")}</h3><p>${s.contact_phone}</p></div>` : ""}
      ${s.contact_address ? html`<div class="card surface"><div class="card-icon">${icon("globe", 20)}</div><h3>${c.t("contact.address")}</h3><p>${s.contact_address}</p></div>` : ""}
      <div class="card surface"><div class="card-icon">${icon("book", 20)}</div><h3>${c.t("footer.help")}</h3><p>${c.t("contact.help_line")} <a href="${c.p("/help")}">${c.t("footer.help")}</a></p></div>
    </div>
  </div>
</section>`;
  return c.html(await layout(c, { title: c.t("page.contact.title"), description: c.t("page.contact.meta"), body }));
}
