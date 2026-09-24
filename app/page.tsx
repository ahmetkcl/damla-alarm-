"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BellRing, Check, ChevronRight, Clock3, Droplets, ExternalLink,
  Info, ShieldCheck, Smartphone, Volume2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Medicine = "Navitae" | "Moxidexa" | "Lotemax";

type Reminder = {
  id: string;
  medicine: Medicine;
  date: string;
  time: string;
  week: number;
  isTest?: boolean;
};

const medicineStyle: Record<Medicine, { dot: string; soft: string; ring: string; text: string; button: string; hover: string }> = {
  Navitae: { dot: "bg-[#2d9f96]", soft: "bg-[#e2f5f2]", ring: "ring-[#88d4cc]", text: "text-[#197b73]", button: "bg-[#218d84]", hover: "hover:bg-[#197b73]" },
  Moxidexa: { dot: "bg-[#f29a53]", soft: "bg-[#fff0e2]", ring: "ring-[#f7c28e]", text: "text-[#bf6021]", button: "bg-[#d97631]", hover: "hover:bg-[#bf6021]" },
  Lotemax: { dot: "bg-[#6678d4]", soft: "bg-[#e9ecff]", ring: "ring-[#abb5ed]", text: "text-[#485ab8]", button: "bg-[#5b6bc6]", hover: "hover:bg-[#485ab8]" },
};

const plan = [
  { week: 1, label: "1. hafta", dates: ["2026-09-24", "2026-09-30"], medicines: [{ name: "Navitae" as const, times: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "24:00"] }, { name: "Moxidexa" as const, times: ["08:05", "12:05", "17:00", "22:05"] }] },
  { week: 2, label: "2. hafta", dates: ["2026-10-01", "2026-10-07"], medicines: [{ name: "Navitae" as const, times: ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"] }, { name: "Lotemax" as const, times: ["09:00", "14:05", "19:00", "23:00"] }] },
  { week: 3, label: "3. hafta", dates: ["2026-10-08", "2026-10-14"], medicines: [{ name: "Navitae" as const, times: ["08:00", "11:00", "14:00", "17:00", "20:00", "23:00"] }, { name: "Lotemax" as const, times: ["09:00", "17:05", "22:00"] }] },
  { week: 4, label: "4. hafta", dates: ["2026-10-15", "2026-10-21"], medicines: [{ name: "Navitae" as const, times: ["09:05", "13:00", "18:00", "23:00"] }, { name: "Lotemax" as const, times: ["09:00", "23:05"] }] },
];

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", month: "long", day: "numeric" });

function dateAtOffset(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function range(from: string, through: string) {
  const result: string[] = [];
  let cursor = from;
  while (cursor <= through) { result.push(cursor); cursor = dateAtOffset(cursor, 1); }
  return result;
}

function normaliseTime(date: string, time: string) {
  return time === "24:00" ? { date: dateAtOffset(date, 1), time: "00:00" } : { date, time };
}

const reminders: Reminder[] = plan.flatMap((week) => range(week.dates[0], week.dates[1]).flatMap((date) => week.medicines.flatMap(({ name, times }) => times.map((rawTime) => {
  const scheduled = normaliseTime(date, rawTime);
  return { id: `${name}-${scheduled.date}-${scheduled.time}`, medicine: name, ...scheduled, week: week.week };
}))));

function istanbulNow() {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, second: Number(values.second) };
}

function toDate(reminder: Reminder) { return new Date(`${reminder.date}T${reminder.time}:00+03:00`); }
function readableTime(time: string) { return time === "00:00" ? "00:00 (gece)" : time; }
function notifyTitle(reminder: Reminder) { return reminder.isTest ? "Damla Alarmı denemesi" : `${reminder.medicine} zamanı`; }

function alarmTone() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const play = (offset: number, frequency: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.19, context.currentTime + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.34);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(context.currentTime + offset); oscillator.stop(context.currentTime + offset + 0.36);
  };
  [0, 0.45, 0.9].forEach((offset, index) => play(offset, index === 2 ? 880 : 660));
  window.setTimeout(() => context.close(), 1800);
}

export default function Home() {
  const [now, setNow] = useState(istanbulNow);
  const [notifications, setNotifications] = useState<NotificationPermission | "unsupported">("unsupported");
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [lastTriggered, setLastTriggered] = useState<string[]>([]);
  const [testReminder, setTestReminder] = useState<Reminder | null>(null);
  const [showAll, setShowAll] = useState(false);
  const audioUnlocked = useRef(false);

  useEffect(() => {
    setNotifications("Notification" in window ? Notification.permission : "unsupported");
    const saved = window.localStorage.getItem("damla-alarmi-completed");
    if (saved) setCompleted(JSON.parse(saved));
    const parameters = new URLSearchParams(window.location.search);
    const testTime = parameters.get("test");
    const requestedMedicine = parameters.get("medicine");
    const medicine: Medicine = requestedMedicine === "Navitae" || requestedMedicine === "Lotemax" || requestedMedicine === "Moxidexa" ? requestedMedicine : "Moxidexa";
    if (testTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(testTime)) {
      const current = istanbulNow();
      setTestReminder({ id: `test-${current.date}-${testTime}-${medicine}`, medicine, date: current.date, time: testTime, week: 0, isTest: true });
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const allReminders = useMemo(() => testReminder ? [...reminders, testReminder] : reminders, [testReminder]);
  const todayReminders = useMemo(() => allReminders.filter((reminder) => reminder.date === now.date).sort((a, b) => toDate(a).getTime() - toDate(b).getTime()), [allReminders, now.date]);
  const upcoming = useMemo(() => allReminders.filter((reminder) => toDate(reminder).getTime() >= Date.now()).sort((a, b) => toDate(a).getTime() - toDate(b).getTime())[0], [allReminders, now]);

  const fireAlarm = useCallback((reminder: Reminder) => {
    setActiveAlarm(reminder);
    setLastTriggered((existing) => [...existing, reminder.id].slice(-20));
    if (reminder.isTest && reminder.id === testReminder?.id) setTestReminder(null);
    if (audioUnlocked.current) alarmTone();
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker?.ready.then((registration) => registration.showNotification(notifyTitle(reminder), {
        body: reminder.isTest ? `${reminder.medicine} renkli alarm denemesi.` : `1 damla ${reminder.medicine} uygulama zamanı.`, icon: "/icon.svg", tag: reminder.id, requireInteraction: true,
      })).catch(() => new Notification(notifyTitle(reminder), { body: reminder.isTest ? `${reminder.medicine} renkli alarm denemesi.` : `1 damla ${reminder.medicine} uygulama zamanı.` }));
    }
  }, [testReminder]);

  useEffect(() => {
    const tick = () => {
      const current = istanbulNow();
      setNow(current);
      if (current.second < 4) {
        const due = allReminders.find((reminder) => reminder.date === current.date && reminder.time === current.time && !lastTriggered.includes(reminder.id));
        if (due) fireAlarm(due);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [allReminders, fireAlarm, lastTriggered]);

  const enableAlarms = async () => {
    audioUnlocked.current = true;
    alarmTone();
    if ("Notification" in window) setNotifications(await Notification.requestPermission());
  };

  const runImmediateTest = () => {
    audioUnlocked.current = true;
    const current = istanbulNow();
    fireAlarm({ id: `instant-test-${Date.now()}`, medicine: "Moxidexa", date: current.date, time: current.time, week: 0, isTest: true });
  };

  const markDone = (id: string) => {
    setCompleted((existing) => {
      const next = existing.includes(id) ? existing.filter((entry) => entry !== id) : [...existing, id];
      window.localStorage.setItem("damla-alarmi-completed", JSON.stringify(next));
      return next;
    });
  };

  const dateHeading = new Date(`${now.date}T12:00:00+03:00`);
  const progress = todayReminders.length ? Math.round((todayReminders.filter((reminder) => completed.includes(reminder.id)).length / todayReminders.length) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10213a] text-white shadow-lg shadow-[#10213a]/15"><Droplets size={25} strokeWidth={2.2} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#4c8f8a]">Kişisel takip</p><h1 className="text-2xl font-bold tracking-tight">Damla Alarmı</h1></div>
        </div>
        <button onClick={enableAlarms} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10213a] px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#193250] focus:outline-none focus:ring-4 focus:ring-[#10213a]/15">
          {notifications === "granted" ? <BellRing size={17} /> : <Bell size={17} />}{notifications === "granted" ? "Alarmlar açık" : "Alarmları etkinleştir"}
        </button>
      </header>

      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-[#10213a] px-6 py-7 text-white shadow-soft sm:px-9 sm:py-9">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-[#52b9ae]/20 blur-2xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="mb-3 text-sm font-semibold text-[#8bd7d0]">{weekdayFormatter.format(dateHeading)}</p><h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Bugünün damla planı<br /><span className="text-[#9fe6de]">kontrol altında.</span></h2><p className="mt-3 text-sm leading-6 text-slate-300">Saatler Türkiye saati (GMT+3) ile çalışır. Her alarmda 1 damla uygulanır.</p></div>
          <div className="min-w-52 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="flex justify-between text-xs font-semibold text-slate-300"><span>Bugünkü ilerleme</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-[#80ded4]" animate={{ width: `${progress}%` }} /></div><p className="mt-3 text-sm font-semibold">{todayReminders.filter((reminder) => completed.includes(reminder.id)).length} / {todayReminders.length} tamamlandı</p></div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-[1.45fr_1fr]">
        <div className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5b9f99]">Sıradaki alarm</p><h2 className={`mt-1 text-xl font-bold ${upcoming ? medicineStyle[upcoming.medicine].text : ""}`}>{upcoming ? upcoming.medicine : "Plan tamamlandı"}</h2></div><div className={`grid h-12 w-12 place-items-center rounded-2xl ${upcoming ? medicineStyle[upcoming.medicine].soft : "bg-[#e2f5f2]"} ${upcoming ? medicineStyle[upcoming.medicine].text : "text-[#24877f]"}`}><Clock3 size={22} /></div></div>
          {upcoming ? <div className="flex items-end justify-between gap-4"><div><p className="text-4xl font-bold tracking-tight text-[#10213a]">{readableTime(upcoming.time)}</p><p className="mt-1 text-sm text-slate-500">{upcoming.isTest ? "Bu cihazdaki deneme alarmı" : `${weekdayFormatter.format(toDate(upcoming))} · ${upcoming.week}. hafta`}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${medicineStyle[upcoming.medicine].soft}`}>{upcoming.isTest ? "Deneme" : "1 damla"}</span></div> : <p className="text-slate-500">24 Eylül–21 Ekim programı bitti.</p>}
        </div>
        <div className="rounded-3xl border border-[#cce8e4] bg-[#f7fffd] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#267c75]"><ShieldCheck size={19} /><p className="text-sm font-bold">Arka plan için hazır</p></div><p className="mt-3 text-sm leading-6 text-slate-600">Bildirime izin verip uygulamayı ana ekrana eklerseniz, sekme önde olmasa da uyarı görünür.</p><button onClick={notifications === "granted" ? runImmediateTest : enableAlarms} className="mt-4 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-bold text-[#267c75] transition hover:bg-[#dff3f0] hover:underline focus:outline-none focus:ring-4 focus:ring-[#a9ded8]">{notifications === "granted" ? <>Alarmı şimdi dene <Volume2 size={16} /></> : notifications === "unsupported" ? "Bu tarayıcı bildirim desteklemiyor" : <>İzinleri aç <ChevronRight size={16} /></>}</button>{notifications === "granted" && <p className="mt-2 text-xs font-medium text-[#4f7773]">Bildirimler açık. Düğme renkli deneme alarmını hemen gösterir.</p>}</div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-soft sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5b9f99]">Bugün</p><h2 className="mt-1 text-xl font-bold">Saat saat takip</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{todayReminders.length} alarm</span></div>
          {todayReminders.length ? <div className="grid gap-2 sm:grid-cols-2">{todayReminders.map((reminder) => { const done = completed.includes(reminder.id); const current = reminder.time === now.time; return <motion.button layout key={reminder.id} onClick={() => markDone(reminder.id)} className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-4 ${done ? "border-transparent bg-slate-50 opacity-60 focus:ring-slate-200" : current ? `${medicineStyle[reminder.medicine].ring} bg-white ring-2 focus:ring-[#8bd7d0]` : "border-slate-100 bg-white hover:border-[#a8dcd6] focus:ring-[#d6f0ed]"}`}><span className={`h-3 w-3 shrink-0 rounded-full ${medicineStyle[reminder.medicine].dot}`} /><span className="min-w-0 flex-1"><span className={`block font-bold ${medicineStyle[reminder.medicine].text}`}>{reminder.medicine}</span><span className="block text-xs text-slate-500">{reminder.isTest ? "deneme alarmı" : "1 damla"} {current && "· şimdi"}</span></span><span className="font-bold tabular-nums text-[#10213a]">{readableTime(reminder.time)}</span><span className={`grid h-7 w-7 place-items-center rounded-full border ${done ? `${medicineStyle[reminder.medicine].dot} border-transparent text-white` : "border-slate-200 text-transparent group-hover:text-slate-300"}`}><Check size={15} /></span></motion.button>; })}</div> : <div className="rounded-2xl bg-[#f7fffd] p-6 text-sm leading-6 text-slate-600">Bu tarih için planlı damla yok. Program 24 Eylül–21 Ekim 2026 arasındadır.</div>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-3xl bg-[#dff3f0] p-6"><div className="flex items-center gap-2 text-[#267c75]"><Smartphone size={19} /><h2 className="font-bold">Her bilgisayarda kullan</h2></div><ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700"><li><span className="mr-2 font-bold text-[#267c75]">1.</span>Bu sayfayı Vercel’de yayınlayın.</li><li><span className="mr-2 font-bold text-[#267c75]">2.</span>Her cihazda aynı adresi açıp “Alarmları etkinleştir”e dokunun.</li><li><span className="mr-2 font-bold text-[#267c75]">3.</span>Tarayıcının bildirim iznini açık bırakın.</li></ol><a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#267c75] hover:underline">Vercel’e yayınla <ExternalLink size={15} /></a></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><Info size={19} className="text-[#4c8f8a]" /><h2 className="font-bold">Önemli not</h2></div><p className="mt-3 text-sm leading-6 text-slate-600">Web uygulamaları açık bir sekmede ses çalabilir; sekme arka plandayken bildirim gösterebilir. Tarayıcı tamamen kapalıyken ya da bilgisayar uyku modundayken, yalnızca web sitesi sesli alarmı garanti edemez. Kritik dozlar için ayrıca telefonun yerleşik alarmını kurun ve reçeteyi hekiminizin talimatıyla teyit edin.</p></div>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-soft sm:p-7"><button onClick={() => setShowAll((open) => !open)} className="flex w-full items-center justify-between text-left"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5b9f99]">Reçete takvimi</p><h2 className="mt-1 text-xl font-bold">4 haftalık planı görüntüle</h2></div><ChevronRight className={`transition ${showAll ? "rotate-90" : ""}`} /></button><AnimatePresence>{showAll && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-6 grid gap-3 sm:grid-cols-2">{plan.map((week) => <div key={week.week} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{week.label}</p><p className="mt-1 text-xs text-slate-500">{week.dates[0].slice(8)} {week.dates[0].slice(5, 7) === "09" ? "Eylül" : "Ekim"} – {week.dates[1].slice(8)} {week.dates[1].slice(5, 7) === "09" ? "Eylül" : "Ekim"}</p>{week.medicines.map((medicine) => <div key={medicine.name} className="mt-3 border-t border-slate-200 pt-3"><p className="text-sm font-bold">{medicine.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{medicine.times.map(readableTime).join(" · ")}</p></div>)}</div>)}</div></motion.div>}</AnimatePresence></section>

      <AnimatePresence>{activeAlarm && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#07172c]/50 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ y: 24, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white p-7 text-center shadow-2xl"><button onClick={() => setActiveAlarm(null)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button><motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.35 }} className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${medicineStyle[activeAlarm.medicine].soft}`}><Volume2 size={33} className={medicineStyle[activeAlarm.medicine].text} /></motion.div><p className={`mt-6 text-sm font-bold uppercase tracking-[.15em] ${medicineStyle[activeAlarm.medicine].text}`}>{activeAlarm.isTest ? "Deneme alarmı" : "Damla zamanı"}</p><h2 className={`mt-2 text-3xl font-bold ${medicineStyle[activeAlarm.medicine].text}`}>{activeAlarm.medicine}</h2><p className="mt-2 text-slate-600">{activeAlarm.isTest ? "Renkli alarm görünümünü kontrol edin." : <>Şimdi <strong>1 damla</strong> uygulayın.</>}</p><button onClick={() => { markDone(activeAlarm.id); setActiveAlarm(null); }} className={`mt-7 w-full rounded-xl px-5 py-3.5 font-bold text-white ${medicineStyle[activeAlarm.medicine].button} ${medicineStyle[activeAlarm.medicine].hover}`}>{activeAlarm.isTest ? "Tamam" : "Uyguladım"}</button><button onClick={() => { alarmTone(); }} className={`mt-3 text-sm font-bold ${medicineStyle[activeAlarm.medicine].text} hover:underline`}>Sesi tekrar çal</button></motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}
