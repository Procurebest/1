const copy = {
  en: {
    eyebrow:"YOUR PROCUREMENT CAREER COMPANION", headline:"Build your procurement career with confidence.",
    intro:"Practical career guidance, procurement calculators and learning resources — all in one place.",
    careerCta:"Explore Career Hub", careerEyebrow:"PLAN YOUR NEXT STEP", careerTitle:"Career Hub", viewAll:"View all →",
    roadmap:"Career Roadmap", roadmapSub:"Explore roles and career paths", careerCalc:"Career Calculator", careerCalcSub:"Plan your development journey",
    salary:"Salary Calculator", salarySub:"Explore salary progression", workSmarter:"WORK SMARTER", toolsTitle:"Procurement Tools",
    tcoSub:"Compare total ownership costs", landing:"Landing Cost", landingSub:"Estimate your import costs",
    keepLearning:"KEEP LEARNING", learnTitle:"Grow your procurement knowledge.", learnSub:"Read practical articles, guides and industry insights in Bangla and English.",
    readBlogs:"Explore Articles →", sourceNote:"Your App uses ProcureBest website content. New articles and tools can be updated without maintaining a separate content library.",
    home:"Home", career:"Career", tools:"Tools", learn:"Learn", website:"Website", backHome:"Back to Home", careerHeading:"Build your Procurement Career.", careerIntro:"Understand career paths, explore job roles and make a practical development plan.", startHere:"START HERE", careerPlanning:"Career Planning", analysis:"Career Analysis", analysisDesc:"Assess your current position and identify skill gaps.", roadmapDesc:"See career levels, roles and progression paths.", jobRoles:"Procurement Job Roles", jobRolesDesc:"Explore responsibilities, skills and experience levels.", skills:"Skills Assessment", skillsDesc:"Check your strengths and development areas.", growFurther:"GROW FURTHER", careerResources:"Career Resources", certifications:"Certifications Guide", certificationsDesc:"Compare qualifications and career directions.", salaryDesc:"Explore indicative salary ranges by role and experience.", opportunities:"Career Opportunities", opportunitiesDesc:"Explore industries and employer types.", careerBlog:"Career Articles", careerBlogDesc:"Practical guidance for your procurement career.", explore:"Explore →", start:"Start →", browse:"Browse →", assess:"Assess →", viewGuide:"View guide →", viewSalary:"View salary data →", read:"Read →", noteTitle:"A quick note", noteText:"These features open the live ProcureBest Career Hub, so the existing career data and tools remain the single source of truth. A dedicated Salary Calculator can be added after its calculation model and reliable salary data are finalized.", installText:"Install ProcureBest on your phone for quick access.", install:"Install App"
  },
  bn: {
    eyebrow:"আপনার প্রকিউরমেন্ট ক্যারিয়ারের সঙ্গী", headline:"আত্মবিশ্বাসের সঙ্গে গড়ে তুলুন আপনার Procurement Career।",
    intro:"Career Guidance, Procurement Calculator এবং Learning Resources — সবকিছু এক জায়গায়।",
    careerCta:"Career Hub দেখুন", careerEyebrow:"পরবর্তী পদক্ষেপ পরিকল্পনা করুন", careerTitle:"Career Hub", viewAll:"সব দেখুন →",
    roadmap:"Career Roadmap", roadmapSub:"ক্যারিয়ারের ধাপ ও Job Role দেখুন", careerCalc:"Career Calculator", careerCalcSub:"নিজের উন্নয়নের পরিকল্পনা করুন",
    salary:"Salary Calculator", salarySub:"সম্ভাব্য Salary Progression দেখুন", workSmarter:"আরও দক্ষভাবে কাজ করুন", toolsTitle:"Procurement Tools",
    tcoSub:"মোট মালিকানা খরচ তুলনা করুন", landing:"Landing Cost", landingSub:"Import Cost হিসাব করুন",
    keepLearning:"শিখতে থাকুন", learnTitle:"বাড়ান আপনার Procurement Knowledge।", learnSub:"বাংলা ও ইংরেজিতে Practical Article, Guide এবং Industry Insight পড়ুন।",
    readBlogs:"আর্টিকেল দেখুন →", sourceNote:"এই App ProcureBest Website-এর Content ব্যবহার করবে। আলাদা Content Library পরিচালনা করতে হবে না।",
    home:"হোম", career:"ক্যারিয়ার", tools:"টুলস", learn:"শিখুন", website:"ওয়েবসাইট", backHome:"হোমে ফিরুন", careerHeading:"গড়ে তুলুন আপনার Procurement Career।", careerIntro:"ক্যারিয়ারের ধাপ বুঝুন, Job Role দেখুন এবং বাস্তবসম্মত Development Plan তৈরি করুন।", startHere:"এখান থেকে শুরু করুন", careerPlanning:"Career Planning", analysis:"Career Analysis", analysisDesc:"আপনার বর্তমান অবস্থান ও Skill Gap চিহ্নিত করুন।", roadmapDesc:"Career Level, Job Role ও অগ্রগতির পথ দেখুন।", jobRoles:"Procurement Job Roles", jobRolesDesc:"দায়িত্ব, দক্ষতা ও অভিজ্ঞতার স্তর জানুন।", skills:"Skills Assessment", skillsDesc:"নিজের শক্তি ও উন্নয়নের জায়গা যাচাই করুন।", growFurther:"আরও এগিয়ে যান", careerResources:"Career Resources", certifications:"Certifications Guide", certificationsDesc:"যোগ্যতা ও সম্ভাব্য Career Direction তুলনা করুন।", salaryDesc:"পদ ও অভিজ্ঞতা অনুযায়ী আনুমানিক বেতন দেখুন।", opportunities:"Career Opportunities", opportunitiesDesc:"Industry ও সম্ভাব্য Employer Type দেখুন।", careerBlog:"Career Articles", careerBlogDesc:"Procurement Career নিয়ে ব্যবহারিক পরামর্শ পড়ুন।", explore:"দেখুন →", start:"শুরু করুন →", browse:"ব্রাউজ করুন →", assess:"যাচাই করুন →", viewGuide:"গাইড দেখুন →", viewSalary:"বেতনের তথ্য দেখুন →", read:"পড়ুন →", noteTitle:"একটি গুরুত্বপূর্ণ কথা", noteText:"এই Feature-গুলো ProcureBest-এর Live Career Hub খুলবে, ফলে বিদ্যমান Career Data ও Tool-ই তথ্যের মূল উৎস থাকবে। নির্ভরযোগ্য Salary Data ও Calculation Model চূড়ান্ত হলে আলাদা Salary Calculator যুক্ত করা যাবে।", installText:"সহজে ব্যবহারের জন্য ProcureBest ফোনে Install করুন।", install:"Install করুন"
  }
};
let lang = localStorage.getItem("pb-app-lang") || "en";
function setLanguage(next) {
  lang = next;
  localStorage.setItem("pb-app-lang", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = copy[lang][el.dataset.i18n];
    if (value) el.textContent = value;
  });
  document.getElementById("languageToggle").textContent = lang === "en" ? "বাংলা" : "English";
  document.getElementById("careerCta").href = "/" + lang + "/career";
  document.querySelectorAll('a[href^="/en/"],a[href^="/bn/"]').forEach(a => {
    a.href = a.getAttribute("href").replace(/^\/(en|bn)\//, "/" + lang + "/");
  });
}
setLanguage(lang);
document.getElementById("languageToggle").addEventListener("click", () => setLanguage(lang === "en" ? "bn" : "en"));

let installPrompt;
const banner = document.getElementById("installBanner");
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  banner.hidden = false;
});
document.getElementById("installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  banner.hidden = true;
});
document.getElementById("dismissInstall").addEventListener("click", () => banner.hidden = true);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/app/sw.js", {scope:"/app/"}).catch(() => {}));
}