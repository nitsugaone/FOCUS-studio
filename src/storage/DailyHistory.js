// Daily history rules and persistence; no browser UI or audio dependencies.
export function createDailyHistory({storage,currentDate=()=>new Date()}) {
  const HISTORY_STORAGE_KEY='focus-daily-history-v1';
  let dailyHistory=null;

  function getTodayKey() {
    const now = currentDate();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getInitialHistory() {
    return {};
  }

  function loadHistory() {
    dailyHistory=storage.read(HISTORY_STORAGE_KEY,null);
    if (!dailyHistory || typeof dailyHistory !== 'object') {
      dailyHistory = getInitialHistory();
      persistHistory();
    }
    const todayKey = getTodayKey();
    if (typeof dailyHistory[todayKey] !== 'number') {
      dailyHistory[todayKey] = 0;
      persistHistory();
    }
  }

  function persistHistory() {
    storage.write(HISTORY_STORAGE_KEY,dailyHistory);
  }

  function addFocusSecondsToToday(seconds) {
    if (seconds <= 0) return;
    const todayKey = getTodayKey();
    if (typeof dailyHistory[todayKey] !== 'number') {
      dailyHistory[todayKey] = 0;
    }
    dailyHistory[todayKey] = Math.round((dailyHistory[todayKey] + seconds / 60) * 10) / 10;
    persistHistory();
  }

  function getLast7DaysData() {
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const now = currentDate();
    const todayKey = getTodayKey();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isToday = (key === todayKey);
      const mins = Math.round(Number(dailyHistory[key]) || 0);
      days.push({
        dateKey: key,
        dayLabel: isToday ? 'Hoy' : dayNames[d.getDay()],
        dayNum: `${d.getDate()}/${d.getMonth() + 1}`,
        minutes: mins,
        isToday
      });
    }
    return days;
  }

  function calculateStreak(days) {
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].minutes > 0) {
        streak++;
      } else if (days[i].isToday) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }

  function resetHistory() {
    dailyHistory={};
    dailyHistory[getTodayKey()]=0;
    persistHistory();
  }

  return {loadHistory,addFocusSecondsToToday,getLast7DaysData,calculateStreak,resetHistory};
}
