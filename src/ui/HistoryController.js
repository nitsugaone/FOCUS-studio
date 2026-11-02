import {createDailyHistory} from '../storage/DailyHistory.js';
import {createHistoryView} from './HistoryView.js';

// Coordinates listening progress and the existing history view/controls.
export function createHistoryController({$,storage,clock,listeningProgress,isSilentRest}) {
  const {loadHistory,addFocusSecondsToToday,getLast7DaysData,calculateStreak,resetHistory}=createDailyHistory({storage});

  function syncFocusHistoryProgress(flush = false) {
    const seconds=listeningProgress.advance(clock.elapsedMs,{silent:isSilentRest(),flush});
    if(seconds){addFocusSecondsToToday(seconds);renderHistoryChart();}
  }

  const renderHistoryChart=createHistoryView({$,getLast7DaysData,calculateStreak});

  function initHistoryControls() {
    const btnSimulated = $('btn-add-simulated');
    if (btnSimulated) {
      btnSimulated.addEventListener('click', () => {
        addFocusSecondsToToday(15 * 60);
        renderHistoryChart();
      });
    }

    const btnResetHistory = $('btn-reset-history');
    if (btnResetHistory) {
      btnResetHistory.addEventListener('click', () => {
        resetHistory();
        renderHistoryChart();
      });
    }
  }

  return {loadHistory,renderHistoryChart,syncFocusHistoryProgress,initHistoryControls};
}
