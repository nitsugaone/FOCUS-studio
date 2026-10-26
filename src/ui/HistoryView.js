export function createHistoryView({$,getLast7DaysData,calculateStreak}) {
      function renderHistoryChart() {
        const svg = $('history-svg');
        if (!svg) return;

        const days = getLast7DaysData();
        const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
        const avgMinutes = Math.round(totalMinutes / days.length);
        const streak = calculateStreak(days);
        const todayMinutes = days[days.length - 1].minutes;

        const elTotal = $('metric-total');
        const elAvg = $('metric-avg');
        const elToday = $('metric-today');
        const elStreak = $('hist-streak-chip');

        if (elTotal) elTotal.textContent = `${totalMinutes} min`;
        if (elAvg) elAvg.textContent = `${avgMinutes} min`;
        if (elToday) elToday.textContent = `${todayMinutes} min`;
        if (elStreak) elStreak.textContent = `🔥 Racha: ${streak} ${streak === 1 ? 'día' : 'días'}`;

        const svgW = 680;
        const svgH = 180;
        const padL = 46;
        const padR = 20;
        const padT = 24;
        const padB = 42;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const maxRecorded = Math.max(...days.map(d => d.minutes), 0);
        const gridMax = Math.max(60, Math.ceil((maxRecorded * 1.15) / 15) * 15);
        const gridSteps = [
          { val: Math.round(gridMax * 0.33), y: padT + plotH - (gridMax * 0.33 / gridMax) * plotH },
          { val: Math.round(gridMax * 0.66), y: padT + plotH - (gridMax * 0.66 / gridMax) * plotH },
          { val: gridMax,                    y: padT + plotH - (gridMax / gridMax) * plotH }
        ];

        let content = `
          <defs>
            <linearGradient id="barGradPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#9bb4ff" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="#5573ca" stop-opacity="0.8"/>
            </linearGradient>
            <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8ce5c5" stop-opacity="1"/>
              <stop offset="100%" stop-color="#46a386" stop-opacity="0.85"/>
            </linearGradient>
            <filter id="glowToday" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#8ce5c5" flood-opacity="0.45"/>
            </filter>
          </defs>
        `;

        gridSteps.forEach(step => {
          content += `
            <line x1="${padL}" y1="${step.y.toFixed(1)}" x2="${svgW - padR}" y2="${step.y.toFixed(1)}" stroke="rgba(161, 178, 219, 0.12)" stroke-dasharray="3 3"/>
            <text x="${padL - 8}" y="${(step.y + 3.5).toFixed(1)}" font-size="9" fill="#717c96" text-anchor="end" font-variant-numeric="tabular-nums">${step.val}m</text>
          `;
        });

        content += `<line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="rgba(161, 178, 219, 0.22)"/>`;

        const slotW = plotW / days.length;
        const barW = Math.min(42, slotW * 0.58);

        days.forEach((d, i) => {
          const cx = padL + i * slotW + slotW / 2;
          const barX = cx - barW / 2;
          const trackY = padT;
          const trackH = plotH;

          content += `<rect x="${barX.toFixed(1)}" y="${trackY}" width="${barW}" height="${trackH}" rx="7" fill="rgba(155, 180, 255, 0.035)"/>`;

          if (d.minutes > 0) {
            const barH = Math.max(5, (d.minutes / gridMax) * plotH);
            const barY = padT + plotH - barH;
            const gradId = d.isToday ? 'url(#barGradToday)' : 'url(#barGradPrev)';
            const filterAttr = d.isToday ? 'filter="url(#glowToday)"' : '';
            content += `<rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}" rx="6" fill="${gradId}" ${filterAttr}/>`;

            const labelY = Math.max(padT - 7, barY - 6);
            content += `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="10" font-weight="700" fill="${d.isToday ? '#c7f5e4' : '#c0d0ff'}" text-anchor="middle" font-variant-numeric="tabular-nums">${d.minutes}m</text>`;
          } else {
            content += `<text x="${cx.toFixed(1)}" y="${padT + plotH - 6}" font-size="10" fill="#58637c" text-anchor="middle">0m</text>`;
          }

          const dayColor = d.isToday ? '#8ce5c5' : '#8e98b0';
          const dayWeight = d.isToday ? '750' : '550';
          content += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 16).toFixed(1)}" font-size="11" font-weight="${dayWeight}" fill="${dayColor}" text-anchor="middle">${d.dayLabel}</text>`;
          content += `<text x="${cx.toFixed(1)}" y="${(padT + plotH + 29).toFixed(1)}" font-size="9" fill="${d.isToday ? '#8ce5c5' : '#59657f'}" text-anchor="middle">${d.dayNum}</text>`;
        });

        svg.innerHTML = content;
      }
return renderHistoryChart;
}
