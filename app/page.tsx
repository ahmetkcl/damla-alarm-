"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, BellRing, Check, ChevronRight, Clock3, Droplets, Volume2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Medicine = "Navitae" | "Moxidexa" | "Lotemax";

type Reminder = {
  id: string;
  medicine: Medicine;
  date: string;
  time: string;
  week: number;
};

const medicineStyle: Record<Medicine, { dot: string; soft: string; ring: string; text: string; button: string; hover: string }> = {
  Navitae: { dot: "bg-[#2d9f96]", soft: "bg-[#e2f5f2]", ring: "ring-[#88d4cc]", text: "text-[#197b73]", button: "bg-[#218d84]", hover: "hover:bg-[#197b73]" },
  Moxidexa: { dot: "bg-[#f29a53]", soft: "bg-[#fff0e2]", ring: "ring-[#f7c28e]", text: "text-[#bf6021]", button: "bg-[#d97631]", hover: "hover:bg-[#bf6021]" },
  Lotemax: { dot: "bg-[#6678d4]", soft: "bg-[#e9ecff]", ring: "ring-[#abb5ed]", text: "text-[#485ab8]", button: "bg-[#5b6bc6]", hover: "hover:bg-[#485ab8]" },
};

const selectedCalendarDot: Record<Medicine, string> = {
  Navitae: "bg-[#80ded4]",
  Moxidexa: "bg-[#ffd0aa]",
  Lotemax: "bg-[#c8d0ff]",
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

function istanbulNow(date = new Date()) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, second: Number(values.second) };
}

const followUpMinutes: Record<number, Partial<Record<Medicine, number>>> = {
  1: { Navitae: 120, Moxidexa: 240 },
  2: { Navitae: 180, Lotemax: 300 },
  3: { Navitae: 180, Lotemax: 480 },
  4: { Navitae: 240, Lotemax: 840 },
};

function followUpInterval(reminder: Reminder) { return followUpMinutes[reminder.week][reminder.medicine] ?? 240; }
function isQuietHour(timestamp: number) {
  const hour = Number(istanbulNow(new Date(timestamp)).time.slice(0, 2));
  return hour >= 2 && hour < 8;
}
function nextAllowedAlarmTime(timestamp: number) {
  if (!isQuietHour(timestamp)) return timestamp;
  const local = istanbulNow(new Date(timestamp));
  return new Date(`${local.date}T08:00:00+03:00`).getTime();
}
function reminderAt(reminder: Reminder, timestamp: number): Reminder {
  const local = istanbulNow(new Date(timestamp));
  return { ...reminder, date: local.date, time: local.time };
}

function toDate(reminder: Reminder) { return new Date(`${reminder.date}T${reminder.time}:00+03:00`); }
function readableTime(time: string) { return time === "00:00" ? "00:00 (gece)" : time; }
function notifyTitle(reminder: Reminder) { return `${reminder.medicine} zamanı`; }

const calendarWeekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function startLongAlarmTone(context: AudioContext) {
  const siren = context.createOscillator();
  const undertone = context.createOscillator();
  const sweep = context.createOscillator();
  const pulse = context.createOscillator();
  const sirenGain = context.createGain();
  const undertoneGain = context.createGain();
  const sweepAmount = context.createGain();
  const lowSweepAmount = context.createGain();
  const pulseAmount = context.createGain();

  siren.type = "square";
  siren.frequency.setValueAtTime(760, context.currentTime);
  undertone.type = "sine";
  undertone.frequency.setValueAtTime(460, context.currentTime);
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(0.72, context.currentTime);
  pulse.type = "square";
  pulse.frequency.setValueAtTime(1.85, context.currentTime);

  sweepAmount.gain.setValueAtTime(320, context.currentTime);
  lowSweepAmount.gain.setValueAtTime(150, context.currentTime);
  sirenGain.gain.setValueAtTime(0.1, context.currentTime);
  undertoneGain.gain.setValueAtTime(0.05, context.currentTime);
  pulseAmount.gain.setValueAtTime(0.07, context.currentTime);

  sweep.connect(sweepAmount); sweepAmount.connect(siren.frequency);
  sweep.connect(lowSweepAmount); lowSweepAmount.connect(undertone.frequency);
  pulse.connect(pulseAmount); pulseAmount.connect(sirenGain.gain);
  siren.connect(sirenGain); sirenGain.connect(context.destination);
  undertone.connect(undertoneGain); undertoneGain.connect(context.destination);
  [siren, undertone, sweep, pulse].forEach((node) => node.start());

  let stopped = false;
  let autoStopTimer: number | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (autoStopTimer) window.clearTimeout(autoStopTimer);
    [siren, undertone, sweep, pulse].forEach((node) => { try { node.stop(); } catch { /* node already stopped */ } });
  };
  autoStopTimer = window.setTimeout(stop, 2 * 60 * 1000);
  return stop;
}

export default function Home() {
  const [now, setNow] = useState(istanbulNow);
  const [notifications, setNotifications] = useState<NotificationPermission | "unsupported">("unsupported");
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [takenAt, setTakenAt] = useState<Record<string, string>>({});
  const [lastTriggered, setLastTriggered] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [showAllToday, setShowAllToday] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(istanbulNow().date);
  const [alarmsEnabled, setAlarmsEnabled] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editingTime, setEditingTime] = useState(istanbulNow().time);
  const [audioReady, setAudioReady] = useState(false);
  const audioUnlocked = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopToneRef = useRef<(() => void) | null>(null);
  const dailyAlarmResetRef = useRef<string>("");
  const calendarPanelRef = useRef<HTMLElement | null>(null);
  const calendarTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const permission = "Notification" in window ? Notification.permission : "unsupported";
    setNotifications(permission);
    const saved = window.localStorage.getItem("damla-alarmi-completed");
    if (saved) setCompleted(JSON.parse(saved));
    const savedTakenAt = window.localStorage.getItem("damla-alarmi-taken-at");
    if (savedTakenAt) setTakenAt(JSON.parse(savedTakenAt));
    setAlarmsEnabled(window.localStorage.getItem("damla-alarmi-alarm-enabled") === "true");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!showAllToday) return;
    const closeCalendar = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (calendarPanelRef.current?.contains(target) || calendarTriggerRef.current?.contains(target)) return;
      setShowAllToday(false);
    };
    document.addEventListener("pointerdown", closeCalendar);
    return () => document.removeEventListener("pointerdown", closeCalendar);
  }, [showAllToday]);

  useEffect(() => {
    if (!scheduleWarning) return;
    const timer = window.setTimeout(() => setScheduleWarning(null), 4500);
    return () => window.clearTimeout(timer);
  }, [scheduleWarning]);

  const adjustedReminders = useMemo(() => {
    return (["Navitae", "Moxidexa", "Lotemax"] as Medicine[]).flatMap((medicine) => {
      const series = reminders.filter((reminder) => reminder.medicine === medicine).sort((a, b) => toDate(a).getTime() - toDate(b).getTime());
      let previousTimestamp: number | null = null;
      let hasTakenAnchor = false;
      return series.map((reminder, index) => {
        const takenTimestamp = takenAt[reminder.id] ? new Date(takenAt[reminder.id]).getTime() : null;
        const timestamp = takenTimestamp ?? (hasTakenAnchor && previousTimestamp !== null ? nextAllowedAlarmTime(previousTimestamp + followUpInterval(series[Math.max(0, index - 1)]) * 60 * 1000) : toDate(reminder).getTime());
        if (takenTimestamp) hasTakenAnchor = true;
        previousTimestamp = timestamp;
        return reminderAt(reminder, timestamp);
      });
    }).sort((a, b) => toDate(a).getTime() - toDate(b).getTime());
  }, [takenAt]);
  const visibleReminders = useMemo(() => adjustedReminders.filter((reminder) => {
    const markedAt = takenAt[reminder.id];
    return !markedAt || Date.now() - new Date(markedAt).getTime() < 2 * 60 * 60 * 1000;
  }), [adjustedReminders, takenAt, now]);
  const todayReminders = useMemo(() => adjustedReminders.filter((reminder) => reminder.date === now.date).sort((a, b) => toDate(a).getTime() - toDate(b).getTime()), [adjustedReminders, now.date]);
  const activePlanWeek = useMemo(() => plan.find((week) => now.date >= week.dates[0] && now.date <= week.dates[1]), [now.date]);
  const nextMedicineGroups = useMemo(() => (activePlanWeek?.medicines ?? []).map(({ name }) => ({
    medicine: name,
    reminders: adjustedReminders.filter((reminder) => reminder.medicine === name && !takenAt[reminder.id] && toDate(reminder).getTime() >= Date.now()).slice(0, 1),
  })).filter((group) => group.reminders.length > 0), [activePlanWeek, adjustedReminders, takenAt, now]);
  const calendarDates = useMemo(() => {
    const lastAdjustedDate = adjustedReminders[adjustedReminders.length - 1]?.date ?? plan[plan.length - 1].dates[1];
    return range(dateAtOffset(plan[0].dates[0], -3), lastAdjustedDate > plan[plan.length - 1].dates[1] ? lastAdjustedDate : plan[plan.length - 1].dates[1]);
  }, [adjustedReminders]);
  const selectedCalendarReminders = useMemo(() => visibleReminders.filter((reminder) => reminder.date === selectedCalendarDate).sort((a, b) => toDate(a).getTime() - toDate(b).getTime()), [visibleReminders, selectedCalendarDate]);

  const unlockAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") audioContextRef.current = new AudioContextClass();
    try {
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
      audioUnlocked.current = audioContextRef.current.state === "running";
      setAudioReady(audioUnlocked.current);
      return audioUnlocked.current;
    } catch {
      setAudioReady(false);
      return false;
    }
  }, []);

  const playLongAlarm = useCallback(async () => {
    if (!await unlockAudio() || !audioContextRef.current) return;
    stopToneRef.current?.();
    stopToneRef.current = startLongAlarmTone(audioContextRef.current);
  }, [unlockAudio]);

  const stopLongAlarm = useCallback(() => {
    stopToneRef.current?.();
    stopToneRef.current = null;
  }, []);

  useEffect(() => {
    if (notifications === "granted" && window.localStorage.getItem("damla-alarmi-alarm-enabled") === "true") void unlockAudio();
  }, [notifications, unlockAudio]);

  useEffect(() => () => {
    stopToneRef.current?.();
    audioContextRef.current?.close().catch(() => undefined);
  }, []);

  const fireAlarm = useCallback((reminder: Reminder) => {
    const body = `1 damla ${reminder.medicine} uygulama zamanı.`;
    document.title = `🔔 ${notifyTitle(reminder)}`;
    const badging = navigator as Navigator & { setAppBadge?: (contents?: number) => Promise<void> };
    void badging.setAppBadge?.(1);
    setActiveAlarm(reminder);
    setLastTriggered((existing) => [...existing, reminder.id].slice(-20));
    if (audioUnlocked.current) void playLongAlarm();
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker?.ready.then((registration) => registration.showNotification(notifyTitle(reminder), {
        body, icon: "/icon.svg", badge: "/icon.svg", tag: reminder.id, requireInteraction: true,
      })).catch(() => new Notification(notifyTitle(reminder), { body, tag: reminder.id, requireInteraction: true }));
    }
  }, [playLongAlarm]);

  useEffect(() => {
    const tick = () => {
      const current = istanbulNow();
      setNow(current);
      const currentTimestamp = Date.now();
      if (current.time === "08:00" && dailyAlarmResetRef.current !== current.date) {
        dailyAlarmResetRef.current = current.date;
        setLastTriggered([]);
      }
      if (isQuietHour(currentTimestamp)) {
        if (activeAlarm) {
          stopLongAlarm();
          setActiveAlarm(null);
        }
        return;
      }
      if (current.second < 4 || document.visibilityState === "visible") {
        if (activeAlarm) {
          const silencedIds = adjustedReminders.filter((reminder) => {
            const delay = Date.now() - toDate(reminder).getTime();
            return reminder.id !== activeAlarm.id && delay >= 0 && delay <= 5 * 60 * 1000 && !takenAt[reminder.id] && !lastTriggered.includes(reminder.id);
          }).map((reminder) => reminder.id);
          if (silencedIds.length) setLastTriggered((existing) => [...existing, ...silencedIds].slice(-20));
          return;
        }
        const exactMatch = adjustedReminders.find((reminder) => reminder.date === current.date && reminder.time === current.time && !takenAt[reminder.id] && !lastTriggered.includes(reminder.id));
        const due = exactMatch ?? adjustedReminders.find((reminder) => {
          const delay = Date.now() - toDate(reminder).getTime();
          return delay >= 0 && delay <= 5 * 60 * 1000 && !takenAt[reminder.id] && !lastTriggered.includes(reminder.id);
        });
        if (due) fireAlarm(due);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [activeAlarm, adjustedReminders, fireAlarm, lastTriggered, stopLongAlarm, takenAt]);

  const enableAlarms = async () => {
    window.localStorage.setItem("damla-alarmi-alarm-enabled", "true");
    setAlarmsEnabled(true);
    await unlockAudio();
    if ("Notification" in window) {
      const permission = Notification.permission === "denied" ? "denied" : await Notification.requestPermission();
      setNotifications(permission);
    }
  };

  const markDoseAt = (id: string, occurredAt = new Date()) => {
    document.title = "Damla Alarmı";
    const badging = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    void badging.clearAppBadge?.();
    setCompleted((existing) => {
      const next = existing.includes(id) ? existing : [...existing, id];
      window.localStorage.setItem("damla-alarmi-completed", JSON.stringify(next));
      return next;
    });
    setTakenAt((existing) => {
      const next = { ...existing, [id]: occurredAt.toISOString() };
      window.localStorage.setItem("damla-alarmi-taken-at", JSON.stringify(next));
      return next;
    });
  };

  const handleReminderClick = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditingTime(takenAt[reminder.id] ? istanbulNow(new Date(takenAt[reminder.id])).time : istanbulNow().time);
  };

  const saveDoseTime = () => {
    if (!editingReminder) return;
    const actualDate = istanbulNow().date;
    const actualTime = new Date(`${actualDate}T${editingTime}:00+03:00`);
    if (actualTime.getTime() > Date.now()) {
      setScheduleWarning("İleri bir uygulama saati seçilemez.");
      return;
    }
    markDoseAt(editingReminder.id, actualTime);
    setEditingReminder(null);
  };

  const dateHeading = new Date(`${now.date}T12:00:00+03:00`);
  const progress = todayReminders.length ? Math.round((todayReminders.filter((reminder) => completed.includes(reminder.id)).length / todayReminders.length) * 100) : 0;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
      <AnimatePresence>{scheduleWarning && <motion.button role="alert" onClick={() => setScheduleWarning(null)} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="fixed left-1/2 top-5 z-[60] flex w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border border-[#f7c28e] bg-[#fff7ef] px-4 py-3 text-left text-sm font-semibold text-[#9c4c17] shadow-xl"><span className="flex-1">{scheduleWarning}</span><X size={17} className="shrink-0" /></motion.button>}</AnimatePresence>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10213a] text-white shadow-lg shadow-[#10213a]/15"><Droplets size={25} strokeWidth={2.2} /></div>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#4c8f8a]">Kişisel takip</p><h1 className="text-2xl font-bold tracking-tight">Damla Alarmı</h1></div>
        </div>
        <button onClick={enableAlarms} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10213a] px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#193250] focus:outline-none focus:ring-4 focus:ring-[#10213a]/15">
          {alarmsEnabled ? <BellRing size={17} /> : <Bell size={17} />}{alarmsEnabled ? "Alarmlar açık" : "Alarmları etkinleştir"}
        </button>
      </header>

      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-[#10213a] px-6 py-7 text-white shadow-soft sm:px-9 sm:py-9">
        <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-[#52b9ae]/20 blur-2xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="mb-3 text-sm font-semibold text-[#8bd7d0]">{weekdayFormatter.format(dateHeading)}</p><h2 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">Bugünün damla planı<br /><span className="text-[#9fe6de]">kontrol altında.</span></h2></div>
          <div className="min-w-52 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="flex justify-between text-xs font-semibold text-slate-300"><span>Bugünkü ilerleme</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-[#80ded4]" animate={{ width: `${progress}%` }} /></div><p className="mt-3 text-sm font-semibold">{todayReminders.filter((reminder) => completed.includes(reminder.id)).length} / {todayReminders.length} tamamlandı</p></div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-soft sm:p-7">
        <div className="relative mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5b9f99]">Sonraki dozlar</p>
            <h2 className="mt-1 text-xl font-bold">Sıradaki ilaçlar</h2>
          </div>
          <div className="flex items-center gap-2">
            <button ref={calendarTriggerRef} onClick={() => setShowAllToday((open) => !open)} aria-expanded={showAllToday} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#10213a] shadow-sm transition hover:border-[#86cfc8] hover:bg-[#f7fffd] focus:outline-none focus:ring-4 focus:ring-[#d6f0ed]">
              Takvim <ChevronRight size={15} className={`transition ${showAllToday ? "rotate-90" : ""}`} />
            </button>
          </div>
          <AnimatePresence>
            {showAllToday && <motion.aside ref={calendarPanelRef} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 28 }} className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:fixed sm:right-4 sm:top-6 sm:w-[calc(50vw-1rem)] sm:max-h-[calc(100vh-3rem)]">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[#5b9f99]">Takvim</p>
                  <h3 className="mt-1 text-xl font-bold">24 Eylül – 21 Ekim 2026</h3>
                </div>
                <button onClick={() => setShowAllToday(false)} aria-label="Takvimi kapat" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">{calendarWeekdays.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
              <div className="mt-1 grid grid-cols-7 gap-1">{calendarDates.map((date) => {
                const medicines = [...new Set(visibleReminders.filter((reminder) => reminder.date === date).map((reminder) => reminder.medicine))];
                const isToday = date === now.date;
                const isSelected = date === selectedCalendarDate;
                if (!medicines.length) return <span key={date} aria-hidden="true" className="grid aspect-square place-items-center text-sm font-bold text-slate-300">{Number(date.slice(8))}</span>;
                return <button key={date} onClick={() => setSelectedCalendarDate(date)} className={`relative aspect-square rounded-xl text-sm font-bold transition ${isSelected ? "bg-[#10213a] text-white shadow-lg" : isToday ? "bg-[#dff3f0] text-[#16756d]" : "text-[#10213a] hover:bg-slate-100"}`}>{Number(date.slice(8))}<span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1">{medicines.map((medicine) => <span key={medicine} className={`h-1.5 w-1.5 rounded-full ${isSelected ? selectedCalendarDot[medicine] : medicineStyle[medicine].dot}`} />)}</span></button>;
              })}</div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold">{weekdayFormatter.format(new Date(`${selectedCalendarDate}T12:00:00+03:00`))}</p>
                  <span className="text-xs font-bold text-slate-400">{selectedCalendarReminders.length} alarm</span>
                </div>
                {selectedCalendarReminders.length ? <div className="grid grid-cols-2 gap-2">{selectedCalendarReminders.map((reminder) => {
                  const done = completed.includes(reminder.id);
                  const locked = toDate(reminder).getTime() > Date.now();
                  return <button key={`calendar-${reminder.id}`} onClick={() => handleReminderClick(reminder)} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${done ? "bg-slate-100 opacity-60" : locked ? "bg-[#fff7ef]" : "bg-slate-50 hover:bg-[#f1fbf9]"}`}><span className={`text-sm font-bold ${medicineStyle[reminder.medicine].text}`}>{reminder.medicine}</span><span className="flex items-center gap-1.5 font-bold tabular-nums text-[#10213a]">{readableTime(reminder.time)}{done && <Check size={14} className={medicineStyle[reminder.medicine].text} />}</span></button>;
                })}</div> : <p className="py-4 text-sm text-slate-400">Bu gün için alarm yok.</p>}
              </div>
            </motion.aside>}
          </AnimatePresence>
        </div>
        {nextMedicineGroups.length ? <div className="grid gap-3 sm:grid-cols-2">{nextMedicineGroups.map((group) => <div key={group.medicine} className="grid gap-3">{group.reminders.map((reminder) => {
          return <motion.button layout key={reminder.id} onClick={() => handleReminderClick(reminder)} className="group rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-[#a8dcd6] focus:outline-none focus:ring-4 focus:ring-[#d6f0ed]">
            <div className="flex items-start justify-between gap-4"><div><span className={`inline-flex h-3 w-3 rounded-full ${medicineStyle[reminder.medicine].dot}`} /><p className={`mt-3 text-lg font-bold ${medicineStyle[reminder.medicine].text}`}>{reminder.medicine}</p><p className="mt-1 text-sm text-slate-500">1 damla · {weekdayFormatter.format(toDate(reminder))}</p></div><Clock3 size={21} className={medicineStyle[reminder.medicine].text} /></div>
            <div className="mt-5 flex items-end justify-between"><p className="text-4xl font-bold tracking-tight text-[#10213a]">{readableTime(reminder.time)}</p><span className={`text-xs font-bold ${medicineStyle[reminder.medicine].text}`}>Saati düzenle</span></div>
          </motion.button>;
        })}</div>)}</div> : <div className="rounded-2xl bg-[#f7fffd] p-6 text-sm leading-6 text-slate-600">Bu tarih için sıradaki ilaç yok.</div>}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-soft sm:p-7"><button onClick={() => setShowAll((open) => !open)} className="flex w-full items-center justify-between text-left"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5b9f99]">Reçete takvimi</p><h2 className="mt-1 text-xl font-bold">4 haftalık planı görüntüle</h2></div><ChevronRight className={`transition ${showAll ? "rotate-90" : ""}`} /></button><AnimatePresence>{showAll && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-6 grid gap-3 sm:grid-cols-2">{plan.map((week) => <div key={week.week} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{week.label}</p><p className="mt-1 text-xs text-slate-500">{week.dates[0].slice(8)} {week.dates[0].slice(5, 7) === "09" ? "Eylül" : "Ekim"} – {week.dates[1].slice(8)} {week.dates[1].slice(5, 7) === "09" ? "Eylül" : "Ekim"}</p>{week.medicines.map((medicine) => <div key={medicine.name} className="mt-3 border-t border-slate-200 pt-3"><p className="text-sm font-bold">{medicine.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{medicine.times.map(readableTime).join(" · ")}</p></div>)}</div>)}</div></motion.div>}</AnimatePresence></section>

      <AnimatePresence>{editingReminder && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#07172c]/50 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.form onSubmit={(event) => { event.preventDefault(); saveDoseTime(); }} initial={{ y: 24, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} className="relative w-full max-w-sm rounded-[2rem] bg-white p-7 shadow-2xl"><button type="button" onClick={() => setEditingReminder(null)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button><p className={`text-sm font-bold uppercase tracking-[.15em] ${medicineStyle[editingReminder.medicine].text}`}>{editingReminder.medicine}</p><h2 className="mt-2 text-2xl font-bold text-[#10213a]">Uygulama saatini seç</h2><p className="mt-2 text-sm leading-6 text-slate-500">Bu saatten sonraki alarmlar otomatik olarak yeniden hesaplanır.</p><label className="mt-6 block text-sm font-bold text-[#10213a]">Gerçek uygulama saati<input type="time" value={editingTime} onChange={(event) => setEditingTime(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-bold text-[#10213a] outline-none focus:border-[#86cfc8] focus:ring-4 focus:ring-[#d6f0ed]" required /></label><button type="submit" className={`mt-6 w-full rounded-xl px-5 py-3.5 font-bold text-white ${medicineStyle[editingReminder.medicine].button} ${medicineStyle[editingReminder.medicine].hover}`}>Bu saatte işaretle</button></motion.form></motion.div>}</AnimatePresence>
      <AnimatePresence>{activeAlarm && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#07172c]/50 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ y: 24, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white p-7 text-center shadow-2xl"><button onClick={() => { stopLongAlarm(); markDoseAt(activeAlarm.id); setActiveAlarm(null); }} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button><motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.35 }} className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${medicineStyle[activeAlarm.medicine].soft}`}><Volume2 size={33} className={medicineStyle[activeAlarm.medicine].text} /></motion.div><p className={`mt-6 text-sm font-bold uppercase tracking-[.15em] ${medicineStyle[activeAlarm.medicine].text}`}>Damla zamanı</p><h2 className={`mt-2 text-3xl font-bold ${medicineStyle[activeAlarm.medicine].text}`}>{activeAlarm.medicine}</h2><p className="mt-2 text-slate-600">Şimdi <strong>1 damla</strong> uygulayın.</p><p className="mt-2 text-xs font-semibold text-slate-400">Alarm sesi en fazla 2 dakika sürer.</p><button onClick={() => { stopLongAlarm(); markDoseAt(activeAlarm.id); setActiveAlarm(null); }} className={`mt-7 w-full rounded-xl px-5 py-3.5 font-bold text-white ${medicineStyle[activeAlarm.medicine].button} ${medicineStyle[activeAlarm.medicine].hover}`}>Uyguladım</button><button onClick={() => { void playLongAlarm(); }} className={`mt-3 text-sm font-bold ${medicineStyle[activeAlarm.medicine].text} hover:underline`}>Sesi tekrar çal</button></motion.div></motion.div>}</AnimatePresence>
    </main>
  );
}
