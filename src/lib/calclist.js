// Every calculator shown on the site (the three formula calculators plus the career roadmap),
// minus the ones the admin switched off.
import { CALCULATORS, L } from "../../public/js/calc/defs.js";
import { calcOff } from "./settings.js";

export const ROADMAP = {
  slug: "career-roadmap", icon: "bars",
  title: L("Career Roadmap Calculator", "ক্যারিয়ার রোডম্যাপ ক্যালকুলেটর"),
  summary: L("Your path from Executive to Manager and beyond — time, salary and which qualifications (CIPS, MBA, ASCM…) help most.",
    "এক্সিকিউটিভ থেকে ম্যানেজার ও তার পরের পথ — সময়, বেতন এবং কোন যোগ্যতা (CIPS, MBA, ASCM…) সবচেয়ে কাজে দেয়।"),
};
export const ALL_CALCS = [...CALCULATORS, ROADMAP];
export const calcList = (s) => { const off = calcOff(s); return ALL_CALCS.filter((k) => !off.has(k.slug)); };
