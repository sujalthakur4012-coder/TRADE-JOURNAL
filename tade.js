/* tade.js — Stabilized V4.3 Base + Weekly Detail Update + Removed Total P/L */

// 1. GLOBAL STATE & CONFIG
let trades = JSON.parse(localStorage.getItem('tj_v4_trades')) || [];
let mainChartInstance = null;
let pieChartInstance = null;
let mainHistogramInstance = null;

// Temporary cache for trades filtered by date/period
let memoizedTrades = null; 

const defaultCurrency = { symbol: '₹', unit: 'INR' };

const dayColors = {
    'Mon': '#3B82F6', 'Tue': '#f97316', 'Wed': '#22c55e', 'Thu': '#facc15', 
    'Fri': '#ef4444', 'Sat': '#06b6d4', 'Sun': '#8b5cf6' // Adjusted colors for better contrast
};

// 2. UTILITY FUNCTIONS
function getComputedStyles() {
    // Safely retrieve colors from CSS variables
    const root = document.documentElement;
    return {
        success: getComputedStyle(root).getPropertyValue('--success').trim(),
        danger: getComputedStyle(root).getPropertyValue('--danger').trim(),
        accent: getComputedStyle(root).getPropertyValue('--accent').trim(),
        theme: root.getAttribute('data-theme') === 'dark' ? 'white' : 'black',
        cardBg: getComputedStyle(root).getPropertyValue('--card').trim()
    };
}
// Destructure outside to use directly
const { success: colorSuccess, danger: colorDanger } = getComputedStyles();

// Standardize date object creation from ISO string (Forces local interpretation)
const parseDate = (isoDateString) => {
    return new Date(isoDateString + 'T00:00:00');
};

const getMidnight = (d) => {
    const midnight = new Date(d);
    midnight.setHours(0, 0, 0, 0); 
    return midnight;
};

function fmt(n) {
    const { symbol } = defaultCurrency;
    // Ensure n is a number and format it
    const num = Number(n);
    if (isNaN(num)) return symbol + '0';
    return symbol + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    
    const inpDate = document.getElementById('inpDate');
    if (inpDate) {
        inpDate.value = todayISO;
        inpDate.max = todayISO; 
    }
    
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) currentDateEl.textContent = now.toDateString();
    
    const currencyUnitEl = document.getElementById('currencyUnit');
    if (currencyUnitEl) currencyUnitEl.textContent = defaultCurrency.unit;

    updateUI();
});

// 4. NAVIGATION
window.nav = (panelId, event) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    let title = panelId.charAt(0).toUpperCase() + panelId.slice(1);
    
    memoizedTrades = null; 

    if (panelId === 'pl') {
        title = 'P&L Analytic';
        renderPLSummary(); 
    } else if (panelId === 'performance') {
        renderChart('ALL');
    } else if (panelId === 'dashboard') {
        updateUI(); 
    } else if (panelId === 'calendar') {
        renderCalendar();
    } else if (panelId === 'full-list' || panelId === 'strategy') {
        renderTables();
    }
    
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) pageTitleEl.textContent = title;
};

// 5. THEME TOGGLE
document.getElementById('themeBtn').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    
    // Force redraw of all charts when theme changes
    const activePanel = document.querySelector('.panel.active')?.id;
    if (activePanel === 'performance') renderChart('ALL'); 
    else if (activePanel === 'pl') renderPLSummary(); 
    renderWinRatePieChart(); 
});

// 6. FORM & DATA HANDLING
document.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sel-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});

document.getElementById('tradeForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const resultType = document.getElementById('inpResultType').value;
    const plMagnitude = parseFloat(document.getElementById('inpPL').value);
    
    // Check for valid PL
    if (isNaN(plMagnitude) || plMagnitude < 0) {
        alert("Please enter a valid positive P/L amount.");
        return;
    }

    const finalPL = resultType === 'Win' ? plMagnitude : -plMagnitude;
    
    const trade = {
        id: Date.now(),
        date: document.getElementById('inpDate').value,
        sym: document.getElementById('inpSym').value.toUpperCase(),
        pl: finalPL, 
        asset: document.querySelector('.sel-btn.active')?.dataset.val || 'Stock',
        strat: document.getElementById('inpStrat').value.trim(), 
        conf: document.getElementById('inpConf').value,
        reason: document.getElementById('inpReason').value.trim(),
        resultType: resultType
    };

    trades.push(trade);
    saveData();
    e.target.reset();
    
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    document.getElementById('inpDate').value = todayISO;
    document.getElementById('inpDate').max = todayISO; 
    
    // Reactivate default asset selector button
    const defaultAsset = document.querySelector('.sel-btn[data-val="Stock"]');
    if (defaultAsset) {
        document.querySelectorAll('.sel-btn').forEach(b => b.classList.remove('active'));
        defaultAsset.classList.add('active');
    }

    updateUI();
});

function saveData() {
    localStorage.setItem('tj_v4_trades', JSON.stringify(trades));
}

window.resetData = () => {
    if(confirm("DANGER! This will delete all logged trades. Are you absolutely sure?")) {
        localStorage.removeItem('tj_v4_trades');
        location.reload();
    }
};

window.deleteTrade = (id) => {
    if(confirm("Delete this entry?")) {
        trades = trades.filter(t => t.id !== id);
        saveData();
        updateUI();
        const activePanel = document.querySelector('.panel.active')?.id;
        if (activePanel === 'full-list' || activePanel === 'strategy') {
             renderTables(); 
        }
    }
};

// 7. UI UPDATES (Central Controller)
function updateUI() {
    memoizedTrades = null; 
    renderDashboardStats();
    renderTables(); // Always render tables to populate hidden panels
    renderWeeklyOverview();
    renderWinRatePieChart(); 
    if (document.getElementById('pl')?.classList.contains('active')) {
        renderPLSummary();
    }
}

// 8. DASHBOARD ANALYTICS
function renderDashboardStats() {
    // Total P/L metric removed from dashboard. Only Strategy performance remains here.
    
    const stratMap = {};
    trades.forEach(t => {
        if (!stratMap[t.strat]) stratMap[t.strat] = 0;
        stratMap[t.strat] += t.pl;
    });

    const stratArr = Object.entries(stratMap).sort((a, b) => b[1] - a[1]);

    const bestStrat = stratArr.length > 0 ? stratArr[0] : null;
    const worstStrat = stratArr.length > 0 ? stratArr[stratArr.length - 1] : null;

    if (document.getElementById('bestStratName')) {
        document.getElementById('bestStratName').textContent = bestStrat ? bestStrat[0] : '-';
        document.getElementById('bestStratVal').textContent = bestStrat ? fmt(bestStrat[1]) : '₹0';
        document.getElementById('bestStratName').className = `metric-mini ${bestStrat && bestStrat[1] >= 0 ? 'pos' : 'neg'}`;

        document.getElementById('worstStratName').textContent = worstStrat ? worstStrat[0] : '-';
        document.getElementById('worstStratVal').textContent = worstStrat ? fmt(worstStrat[1]) : '₹0';
        document.getElementById('worstStratName').className = `metric-mini ${worstStrat && worstStrat[1] >= 0 ? 'pos' : 'neg'}`;
    }
}

// 9. TABLES RENDERER (Optimized with array join)
function renderTables() {
    const sorted = [...trades].sort((a,b) => parseDate(b.date) - parseDate(a.date));
    
    // --- Dashboard Table (Recent Trades) ---
    const dashboardTableBody = document.querySelector('#dashboardTable tbody');
    if (dashboardTableBody) {
        const recentTradesHtml = sorted.slice(0, 5).map(t => `
            <tr>
                <td>${t.date}</td>
                <td><b>${t.sym}</b></td>
                <td><span class="tag">${t.strat}</span></td>
                <td class="${t.pl >= 0 ? 'pos' : 'neg'}">${fmt(t.pl)}</td>
                <td class="text-muted">${t.conf || '-'}</td>
            </tr>
        `).join('');

        dashboardTableBody.innerHTML = recentTradesHtml || '<tr><td colspan="5" class="text-center text-muted">No trades logged yet.</td></tr>';
    }


    // --- Full Trade List Table ---
    const fullTableBody = document.querySelector('#fullTable tbody');
    if (fullTableBody) {
        const fullTradesHtml = sorted.map(t => `
            <tr>
                <td>${t.date}</td>
                <td><b>${t.sym}</b></td>
                <td>${t.asset}</td>
                <td>${t.strat}</td>
                <td>${t.conf}</td>
                <td class="text-muted">${t.reason || '-'}</td>
                <td class="${t.pl >= 0 ? 'pos' : 'neg'}">${fmt(t.pl)}</td>
                <td><button onclick="deleteTrade(${t.id})" class="delete-btn">🗑️</button></td>
            </tr>
        `).join('');

        fullTableBody.innerHTML = fullTradesHtml || '<tr><td colspan="8" class="text-center text-muted">No trades logged yet.</td></tr>';
    }

    
    // --- Strategy Table ---
    const stratTableBody = document.querySelector('#stratTable tbody');
    if (stratTableBody) {
        const stratStats = {};
        trades.forEach(t => {
            if(!stratStats[t.strat]) stratStats[t.strat] = { count:0, wins:0, pl:0 };
            stratStats[t.strat].count++;
            stratStats[t.strat].pl += t.pl;
            if(t.pl > 0) stratStats[t.strat].wins++;
        });
        
        const stratTableHtml = Object.entries(stratStats)
            .sort((a,b) => b[1].pl - a[1].pl)
            .map(([name, s]) => {
                const wr = s.count ? Math.round((s.wins/s.count)*100) : 0;
                const avg = s.count ? (s.pl/s.count).toFixed(0) : 0;
                return `
                    <tr>
                        <td><b>${name}</b></td>
                        <td>${s.count}</td>
                        <td class="${wr >= 50 ? 'pos' : 'neg'}">${wr}%</td>
                        <td>${fmt(avg)}</td>
                        <td class="${s.pl >= 0 ? 'pos' : 'neg'}">${fmt(s.pl)}</td>
                    </tr>
                `;
            }).join('');

        stratTableBody.innerHTML = stratTableHtml || '<tr><td colspan="5" class="text-center text-muted">No strategies logged yet.</td></tr>';
    }
}

// 10. WEEKLY OVERVIEW RENDERER
function renderWeeklyOverview() {
    const grid = document.getElementById('weekGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const todayMidnight = getMidnight(new Date());
    const dayOfWeek = todayMidnight.getDay(); // 0 (Sun) to 6 (Sat)
    
    // Calculate Monday (1-dayOfWeek) ensures we start at Monday
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; 
    const monday = new Date(todayMidnight);
    monday.setDate(todayMidnight.getDate() + diffToMon);

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    const lastDay = new Date(monday.getTime() + 6 * 86400000); // 6 days from Monday
    
    const weekRangeEl = document.getElementById('weekRange');
    if (weekRangeEl) {
        weekRangeEl.textContent = `${formatDateShort(monday)} - ${formatDateShort(lastDay)}`;
    }

    // --- Weekly Summary Calculation ---
    let weekTotalPL = 0;
    let weekTotalTrades = 0;
    let weekWins = 0;
    let weekLosses = 0;
    
    const weekCells = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        
        const daysTrades = trades.filter(t => t.date === iso);
        const pl = daysTrades.reduce((sum, t) => sum + t.pl, 0);
        
        const wins = daysTrades.filter(t => t.pl > 0).length;
        const losses = daysTrades.filter(t => t.pl < 0).length;
        const wr = daysTrades.length ? Math.round((wins/daysTrades.length)*100) : 0;
        
        // Aggregate totals
        weekTotalPL += pl;
        weekTotalTrades += daysTrades.length;
        weekWins += wins;
        weekLosses += losses;

        const cellClass = daysTrades.length > 0 ? 'day-col has-trades' : 'day-col';
        const plClass = pl >= 0 ? 'pos' : 'neg';

        weekCells.push(`
            <div class="${cellClass}" data-iso="${iso}" ${daysTrades.length > 0 ? `onclick="openDayDetailModal('${iso}', '${weekDays[i]}')"` : ''}>
                <div class="day-head"><span>${weekDays[i]}</span> <span style="font-weight:400;opacity:0.7">${d.getDate()}</span></div>
                <div>
                    <div class="day-pl ${plClass}">${fmt(pl)}</div>
                    <div class="day-wr" style="opacity:${daysTrades.length ? 1 : 0};">WR: ${wr}%</div>
                </div>
            </div>
        `);
    }
    grid.innerHTML = weekCells.join('');
    
    // --- Display Weekly Summary ---
    const weekWinRate = weekTotalTrades ? Math.round((weekWins / weekTotalTrades) * 100) : 0;
    
    const elWeekPL = document.getElementById('weekTotalPL');
    if (elWeekPL) {
        elWeekPL.textContent = fmt(weekTotalPL);
        elWeekPL.className = `metric-mini ${weekTotalPL >= 0 ? 'pos' : 'neg'}`;
    }
    
    const elWeekTrades = document.getElementById('weekTotalTrades');
    if (elWeekTrades) elWeekTrades.textContent = weekTotalTrades;
    
    const elWeekWL = document.getElementById('weekWinsLosses');
    if (elWeekWL) elWeekWL.textContent = `${weekWins} / ${weekLosses}`;
    
    const elWeekWR = document.getElementById('weekWinRate');
    if (elWeekWR) {
        elWeekWR.textContent = `${weekWinRate}%`;
        elWeekWR.className = `metric-mini ${weekWinRate >= 50 ? 'pos' : 'neg'}`;
    }
}


// 11. REAL-TIME CALENDAR RENDERER
function renderCalendar() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;
    
    // Clear the grid first, then add the headers
    grid.innerHTML = `
        <div class="day-header">Mon</div>
        <div class="day-header">Tue</div>
        <div class="day-header">Wed</div>
        <div class="day-header">Thu</div>
        <div class="day-header">Fri</div>
        <div class="day-header">Sat</div>
        <div class="day-header">Sun</div>
    `;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const calendarTitleEl = document.getElementById('calendarTitle');
    if (calendarTitleEl) {
        calendarTitleEl.textContent = `${now.toLocaleString('en-US', { month: 'long' })} ${year} View`;
    }

    // Get the day index of the first day of the month (0=Sun, 1=Mon, ...)
    const firstDayOfMonthIndex = new Date(year, month, 1).getDay();
    // Calculate the number of empty cells needed at the start (Mon=0, Tue=1, ..., Sun=6)
    const startDay = (firstDayOfMonthIndex === 0) ? 6 : firstDayOfMonthIndex - 1; 

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = now.toISOString().split('T')[0];
    
    const calCells = [];

    // Empty start cells
    for (let i = 0; i < startDay; i++) {
        calCells.push('<div class="day-col cal-empty"></div>');
    }
    
    // Day cells
    for(let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const iso = d.toISOString().split('T')[0];
        const daysTrades = trades.filter(t => t.date === iso);
        const total = daysTrades.reduce((s,t) => s+t.pl, 0);
        const isToday = iso === todayISO;
        
        const plClass = total >= 0 ? 'pos' : 'neg';
        const hasTradesClass = daysTrades.length > 0 ? 'has-trades' : '';

        let boxClass = `day-col cal-day ${hasTradesClass}`;
        if (isToday) boxClass += ' cal-today';

        let content = `<div class="cal-date-label">${i}</div>`;
        
        if(daysTrades.length > 0) {
            content += `<div class="cal-pl ${plClass}">${fmt(total)}</div>`;
        }

        calCells.push(`
            <div class="${boxClass}" 
                 ${daysTrades.length > 0 ? `onclick="openDayDetailModal('${iso}', '${formatDateShort(d)}')"` : ''}>
                ${content}
            </div>
        `);
    }

    grid.innerHTML += calCells.join('');
}


// 12. MODAL LOGIC (Simplified structure to prevent breakage)
window.openDayDetailModal = (dateISO, dayLabel) => {
    const modal = document.getElementById('dayModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    if (!modal || !modalTitle || !modalContent) return;

    modalTitle.textContent = `Trades for ${dayLabel}, ${dateISO}`;
    
    const tradesForDay = trades.filter(t => t.date === dateISO);
    
    const tradeRows = tradesForDay.map(t => `
        <tr>
            <td><b>${t.sym}</b></td>
            <td>${t.strat}</td>
            <td class="${t.pl >= 0 ? 'pos' : 'neg'}">${fmt(t.pl)}</td>
        </tr>
    `).join('');

    const totalPLDay = tradesForDay.reduce((s,t)=>s+t.pl,0);
    const totalPLClass = totalPLDay >= 0 ? 'pos' : 'neg';

    modalContent.innerHTML = `
        <table class="modal-table">
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>Strategy</th>
                    <th>P/L</th>
                </tr>
            </thead>
            <tbody>
                ${tradeRows}
            </tbody>
        </table>
        <div class="modal-footer-pl">
            Total P/L: <span class="${totalPLClass}">${fmt(totalPLDay)}</span>
        </div>
    `;

    modal.classList.add('active');
};

window.closeDayDetailModal = (event) => {
    if (event && event.target.closest('.modal-content')) return;
    document.getElementById('dayModal').classList.remove('active');
};


// 13. PERFORMANCE CHART RENDERER (Line Graph - Cumulative)
window.renderChart = (period) => {
    const ctx = document.getElementById('mainChart')?.getContext('2d');
    if (!ctx) return;
    
    const styles = getComputedStyles();
    
    if (mainChartInstance) mainChartInstance.destroy();
    
    let filteredTrades = [...trades].sort((a,b) => parseDate(a.date) - parseDate(b.date));

    if (period !== 'ALL') {
        const now = getMidnight(new Date());
        let dateFilter;

        if (period === '1W') {
            dateFilter = new Date(now);
            dateFilter.setDate(now.getDate() - 7);
        } else if (period === '1M') {
            dateFilter = new Date(now);
            dateFilter.setMonth(now.getMonth() - 1);
        } else if (period === '1Y') {
            dateFilter = new Date(now);
            dateFilter.setFullYear(now.getFullYear() - 1);
        }
        filteredTrades = filteredTrades.filter(t => parseDate(t.date) >= getMidnight(dateFilter));
    }

    const dailyPL = {};
    filteredTrades.forEach(t => {
        if (!dailyPL[t.date]) dailyPL[t.date] = 0;
        dailyPL[t.date] += t.pl;
    });

    const dates = Object.keys(dailyPL).sort();
    let cumulativePL = 0;
    const data = dates.map(date => {
        cumulativePL += dailyPL[date];
        return cumulativePL;
    });
    
    // Extend the line to today if it's past the last trade date
    if (dates.length > 0) {
        const lastDate = parseDate(dates[dates.length - 1]);
        const today = getMidnight(new Date());
        if (lastDate.getTime() < today.getTime()) {
            dates.push(formatDateShort(today));
            data.push(cumulativePL); 
        }
    }


    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Cumulative P/L',
                data: data,
                borderColor: styles.accent,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                tension: 0.3, 
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: styles.theme, callback: function(value) { return fmt(value); } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: styles.theme }
                }
            },
            plugins: {
                legend: { labels: { color: styles.theme } }
            }
        }
    });

    document.querySelectorAll('.filter-bar button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.filter-bar button[onclick*="'${period}'"]`)?.classList.add('active');
};


// 14. DAILY WIN RATE PIE CHART 
function renderWinRatePieChart() {
    const ctx = document.getElementById('winRatePieChart')?.getContext('2d');
    const legendEl = document.getElementById('pieChartLegend');
    if (!ctx || !legendEl) return;
    
    const styles = getComputedStyles();

    if (pieChartInstance) pieChartInstance.destroy();

    const dailyStats = { 'Mon': { trades: 0, wins: 0 }, 'Tue': { trades: 0, wins: 0 }, 'Wed': { trades: 0, wins: 0 }, 'Thu': { trades: 0, wins: 0 }, 'Fri': { trades: 0, wins: 0 }, 'Sat': { trades: 0, wins: 0 }, 'Sun': { trades: 0, wins: 0 } };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; 
    
    trades.forEach(t => {
        const dayIndex = parseDate(t.date).getDay(); 
        const day = dayNames[dayIndex];
        
        dailyStats[day].trades++;
        if (t.pl > 0) {
            dailyStats[day].wins++;
        }
    });
    
    const winRates = [];
    const labels = [];
    const backgroundColors = [];
    const legendHtml = [];
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; 

    order.forEach(day => {
        const stats = dailyStats[day];

        if (stats.trades > 0) {
            const wr = Math.round((stats.wins / stats.trades) * 100);
            labels.push(`${day}`);
            winRates.push(wr);
            backgroundColors.push(dayColors[day]);
            
            legendHtml.push(`
                <div class="legend-item">
                    <span><span class="legend-color-box" style="background-color: ${dayColors[day]};"></span>${day}: (${stats.trades} Trades)</span>
                    <span class="${wr >= 50 ? 'pos' : 'neg'}">${wr}%</span>
                </div>
            `);
        }
    });

    legendEl.innerHTML = legendHtml.join('');
    
    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: winRates,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: styles.cardBg 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', 
            plugins: {
                legend: { display: false },
                tooltip: { 
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}% Win Rate`;
                        }
                    }
                }
            }
        }
    });
}

// 15. P&L ANALYTIC RENDERER (Wrapper)
function renderPLSummary() {
    renderMainHistogram();
    renderTodayPL();
    const activePeriodButton = document.querySelector('#plFilterBar button.active');
    const activePeriod = activePeriodButton?.dataset.period || '7D'; // Use dataset for period
    
    // Clear custom date inputs if not custom period is active
    if (activePeriod !== 'CUSTOM') {
        memoizedTrades = null; 
    }
    
    renderPLAnalyticStats(activePeriod); 
}

// 16. MAIN HISTOGRAM (7-Day Daily P/L)
function renderMainHistogram() {
    const ctx = document.getElementById('mainHistogram')?.getContext('2d');
    if (!ctx) return;
    
    const styles = getComputedStyles();

    if (mainHistogramInstance) mainHistogramInstance.destroy(); 

    const dailyPL = {};
    const now = getMidnight(new Date());
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    trades.forEach(t => {
        if (parseDate(t.date) >= sevenDaysAgo) {
            if (!dailyPL[t.date]) dailyPL[t.date] = 0;
            dailyPL[t.date] += t.pl;
        }
    });

    const dates = [];
    const plData = [];
    const backgroundColors = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        
        const pl = dailyPL[iso] || 0;
        
        dates.push(formatDateShort(d));
        plData.push(pl);
        backgroundColors.push(pl >= 0 ? styles.success : styles.danger);
    }


    mainHistogramInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily P/L',
                data: plData,
                backgroundColor: backgroundColors,
                borderRadius: 6 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { 
                    display: true,
                    text: 'Daily P/L (Last 7 Trading Days)',
                    color: styles.theme,
                    font: { size: 14 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'P/L Amount',
                        color: styles.theme
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: styles.theme, callback: function(value) { return fmt(value); } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: styles.theme }
                }
            },
        }
    });
}


// 17. TODAY'S P&L STATS
function renderTodayPL() {
    const todayISO = new Date().toISOString().split('T')[0];
    const todayTrades = trades.filter(t => t.date === todayISO);
    
    const totalPL = todayTrades.reduce((sum, t) => sum + t.pl, 0);
    const totalTradesCount = todayTrades.length;
    const wins = todayTrades.filter(t => t.pl > 0).length;
    const winRate = totalTradesCount ? Math.round((wins / totalTradesCount) * 100) : 0;

    const elPL = document.getElementById('todayPL');
    if (elPL) {
        elPL.textContent = fmt(totalPL);
        elPL.className = `metric-mini ${totalPL >= 0 ? 'pos' : 'neg'}`;
    }

    const elTrades = document.getElementById('todayTrades');
    if (elTrades) elTrades.textContent = totalTradesCount;

    const elWR = document.getElementById('todayWR');
    if (elWR) {
        elWR.textContent = `${winRate}%`;
        elWR.style.color = winRate >= 50 ? colorSuccess : colorDanger;
    }
}

// 18. P&L ANALYTIC STATS 
window.getFilteredTrades = (period, startDate = null, endDate = null) => {
    // Return cached trades if available and period hasn't changed
    if (memoizedTrades && memoizedTrades.period === period) return memoizedTrades.data;

    let filteredTrades = [...trades];
    const now = getMidnight(new Date());

    if (period === '7D') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6); 
        filteredTrades = filteredTrades.filter(t => parseDate(t.date) >= sevenDaysAgo);
    } else if (period === '1M') {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        filteredTrades = filteredTrades.filter(t => parseDate(t.date) >= oneMonthAgo);
    } else if (period === 'CUSTOM' && startDate && endDate) {
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        end.setDate(end.getDate() + 1); 
        filteredTrades = filteredTrades.filter(t => {
            const date = parseDate(t.date);
            return date >= start && date < end;
        });
    } else if (period === 'ALL') {
        // If 'ALL' is passed (e.g. from the custom filter modal)
    }

    memoizedTrades = { period, data: filteredTrades };
    return filteredTrades;
}

window.renderPLAnalyticStats = (period, startDate = null, endDate = null) => {
    const filteredTrades = getFilteredTrades(period, startDate, endDate);

    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pl > 0);
    const losingTrades = filteredTrades.filter(t => t.pl < 0);
    
    const totalWins = winningTrades.length;
    const totalLosses = losingTrades.length;
    
    const sumWins = totalWins ? winningTrades.reduce((sum, t) => sum + t.pl, 0) : 0;
    const sumLosses = totalLosses ? losingTrades.reduce((sum, t) => sum + t.pl, 0) : 0; 
    
    const winRate = totalTrades ? Math.round((totalWins / totalTrades) * 100) : 0;
    const avgWin = totalWins ? sumWins / totalWins : 0;
    const avgLoss = totalLosses ? Math.abs(sumLosses / totalLosses) : 0;
    
    // Update elements only if they exist
    document.getElementById('anaWinRate') && (document.getElementById('anaWinRate').textContent = `${winRate}%`);
    document.getElementById('anaAvgWin') && (document.getElementById('anaAvgWin').textContent = fmt(avgWin));
    document.getElementById('anaAvgLoss') && (document.getElementById('anaAvgLoss').textContent = fmt(avgLoss));
    document.getElementById('anaTradeCount') && (document.getElementById('anaTradeCount').textContent = totalTrades);
    
    const anaWR = document.getElementById('anaWinRate');
    if (anaWR) anaWR.style.color = winRate >= 50 ? colorSuccess : colorDanger;
    
    // Update active button state
    document.querySelectorAll('#plFilterBar button').forEach(btn => btn.classList.remove('active'));
    
    const periodBtn = document.querySelector(`#plFilterBar button[data-period="${period}"]`);
    if (periodBtn) {
        periodBtn.classList.add('active');
    }
}

// 19. CUSTOM DATE MODAL LOGIC
window.openCustomDateModal = () => {
    const modal = document.getElementById('customDateModal');
    const todayISO = new Date().toISOString().split('T')[0];
    const customStart = document.getElementById('customStart');
    const customEnd = document.getElementById('customEnd');

    if (customStart) customStart.max = todayISO;
    if (customEnd) customEnd.max = todayISO;
    
    modal?.classList.add('active');
};

window.closeCustomDateModal = (event) => {
    if (event && event.target.closest('.modal-content')) return;
    document.getElementById('customDateModal')?.classList.remove('active');
};

window.handleCustomDate = (e) => {
    e.preventDefault();
    const startDate = document.getElementById('customStart').value;
    const endDate = document.getElementById('customEnd').value;
    
    if (parseDate(startDate) > parseDate(endDate)) {
        alert("Start Date cannot be after End Date.");
        return;
    }
    
    memoizedTrades = null;
    renderPLAnalyticStats('CUSTOM', startDate, endDate);
    closeCustomDateModal();
};