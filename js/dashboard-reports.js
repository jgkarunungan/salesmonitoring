import { db, logCol } from './firebase-config.js';
import { query, orderBy, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let performanceChartInstance = null;
let windowExportDocs = [];

// Helper to format "X days ago" for summary
const getDaysAgo = (ts) => {
    if (!ts) return "";
    const diffDays = Math.floor((new Date() - ts) / 86400000);
    if (diffDays === 0) return ' • <span class="text-[9px] text-info-green uppercase font-bold tracking-tighter">Today</span>';
    if (diffDays === 1) return ' • <span class="text-[9px] text-orange-400 uppercase font-bold tracking-tighter">Yesterday</span>';
    return ` • <span class="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">${diffDays}d ago</span>`;
};

window.applyLogFilter = () => {
    window.currentLogFilter = document.getElementById('logFilterSelect')?.value || 'all';
    window.currentLogTimeFilter = document.getElementById('logTimeFilterSelect')?.value || 'all_time';
    if (window.latestLogSnapshot) window.renderLogsList(window.latestLogSnapshot);
};

window.applyInfographicFilter = () => {
    const filterVal = document.getElementById('infographicFilter')?.value || 'monthly';
    const monthPicker = document.getElementById('statMonthPicker');
    const yearPicker = document.getElementById('statYearPicker');
    const customPicker = document.getElementById('statCustomPicker');

    monthPicker?.classList.add('hidden');
    yearPicker?.classList.add('hidden');
    customPicker?.classList.add('hidden');

    if (filterVal === 'monthly') monthPicker?.classList.remove('hidden');
    else if (filterVal === 'yearly') yearPicker?.classList.remove('hidden');
    else if (filterVal === 'custom') customPicker?.classList.remove('hidden');

    if (window.latestLogSnapshot) window.processStats(window.latestLogSnapshot);
};

window.processStats = (snapshot) => {
    const appSettings = window.appSettings || { assets: [], partners: [] };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const filterMode = document.getElementById('infographicFilter')?.value || 'monthly';
    const branchFilter = document.getElementById('dashboardBranchFilter')?.value || 'all';

    let targetMonth = now.getMonth(), targetYear = now.getFullYear();
    const monthPicker = document.getElementById('statMonthPicker');
    if (filterMode === 'monthly' && monthPicker?.value) {
        const parts = monthPicker.value.split('-');
        if (parts.length === 2) { targetYear = parseInt(parts[0]); targetMonth = parseInt(parts[1]) - 1; }
    } else if (filterMode === 'yearly') {
        targetYear = parseInt(document.getElementById('statYearPicker')?.value) || now.getFullYear();
    }

    let totalGross = 0, myGross = 0, totalPartnerCuts = 0, curExp = 0, myExpenseBurden = 0, totalCapitalRecovered = 0, totalSavingsAccumulated = 0;
    let pisoWifiGross = 0, printingGross = 0, coffeeGross = 0;

    const cats = { Pisonet: 0, PisoWiFi: 0, Printing: 0, Coffee: 0, Other: 0 };
    const partnerStats = {}, pisonetTotals = {}, pisonetLastDates = {}, shopSavings = {};
    const detailedExpenses = {};
    const pisoWifiPartnerTotals = {}; 
    
    let latestPisoWifiTs = null, latestPrintingTs = null, latestCoffeeTs = null;
    const pendingDebts = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp ? data.timestamp.toDate() : null;
        if (!ts) return;

        if (branchFilter !== 'all' && data.partner !== branchFilter) return;
        if (data.type === 'expense' && data.pendingBalance > 0) pendingDebts.push({ id: doc.id, ...data, ts });

        let isIncluded = false;
        if (filterMode === 'weekly' && ts >= sevenDaysAgo) isIncluded = true;
        else if (filterMode === 'monthly' && ts.getMonth() === targetMonth && ts.getFullYear() === targetYear) isIncluded = true;
        else if (filterMode === 'yearly' && ts.getFullYear() === targetYear) isIncluded = true;
        else if (filterMode === 'custom' || filterMode === 'all_time') isIncluded = true;

        if (isIncluded) {
            const rawAmt = data.amount;
            if (data.type === 'income') {
                let share = data.sharePercent || 1.0;
                if (data.partner === 'Iraya') {
                    if (data.label.includes('PisoWiFi')) share = 1.0;
                    else if (data.label.includes('Pisonet')) share = 0.5;
                } else if (data.partner === 'Cabagñan') share = 1.0;

                const myShareAmt = rawAmt * share;
                const partnerShareAmt = rawAmt - myShareAmt;
                totalGross += rawAmt; myGross += myShareAmt; totalPartnerCuts += partnerShareAmt;

                if (data.partner && data.partner !== 'General' && share < 1.0) {
                    if (!partnerStats[data.partner]) partnerStats[data.partner] = { collection: 0, partnerGross: 0, expenseDeduction: 0, netPayout: 0 };
                    partnerStats[data.partner].collection += rawAmt;
                    partnerStats[data.partner].partnerGross += partnerShareAmt;
                    partnerStats[data.partner].netPayout += partnerShareAmt;
                }

                if (data.label.includes('Pisonet')) {
                    const br = data.partner || 'General';
                    pisonetTotals[br] = (pisonetTotals[br] || 0) + rawAmt;
                    if (!pisonetLastDates[br] || ts > pisonetLastDates[br]) pisonetLastDates[br] = ts;
                    cats.Pisonet += rawAmt;
                } else if (data.label.includes('PisoWiFi')) {
                    const wifiPartner = data.partner || 'General';
                    if (!pisoWifiPartnerTotals[wifiPartner]) pisoWifiPartnerTotals[wifiPartner] = { gross: 0, myShare: 0, partnerShare: 0, ts: ts };
                    pisoWifiPartnerTotals[wifiPartner].gross += rawAmt;
                    pisoWifiPartnerTotals[wifiPartner].myShare += myShareAmt;
                    pisoWifiPartnerTotals[wifiPartner].partnerShare += partnerShareAmt;
                    if (ts > pisoWifiPartnerTotals[wifiPartner].ts) pisoWifiPartnerTotals[wifiPartner].ts = ts;

                    pisoWifiGross += rawAmt; cats.PisoWiFi += rawAmt;
                    if (!latestPisoWifiTs || ts > latestPisoWifiTs) latestPisoWifiTs = ts;
                } else if (data.label.includes('Coffee')) {
                    coffeeGross += rawAmt; cats.Coffee += rawAmt;
                    if (!latestCoffeeTs || ts > latestCoffeeTs) latestCoffeeTs = ts;
                } else if (data.label.includes('Print') || data.label.toLowerCase().includes('photocopy')) {
                    printingGross += rawAmt; cats.Printing += rawAmt;
                    if (!latestPrintingTs || ts > latestPrintingTs) latestPrintingTs = ts;
                } else { cats.Other += rawAmt; }

                const catKey = data.label.includes('Coffee') ? 'Coffee Vendo' : data.label.includes('Pisonet') ? 'Pisonet' : data.label.includes('PisoWiFi') ? 'PisoWiFi' : 'Printing';
                const asset = (appSettings.assets || []).find(a => a.category === catKey);
                if (asset) {
                    totalCapitalRecovered += (rawAmt * asset.recoveryPercent);
                    totalSavingsAccumulated += (rawAmt * (asset.savingsPercent || 0));
                    const br = data.partner || 'General';
                    shopSavings[br] = (shopSavings[br] || 0) + (rawAmt * (asset.savingsPercent || 0));
                }
            } else if (data.type === 'expense') {
                curExp += rawAmt;
                const branch = data.partner || 'General';
                const category = data.label || 'Uncategorized';
                if (!detailedExpenses[branch]) detailedExpenses[branch] = {};
                detailedExpenses[branch][category] = (detailedExpenses[branch][category] || 0) + rawAmt;

                let myShareOfBranch = branch === 'Iraya' ? 0.5 : 1.0;
                myExpenseBurden += (rawAmt * myShareOfBranch);
                if (myShareOfBranch < 1.0 && branch !== 'General') {
                    const partnerShareExp = rawAmt * (1 - myShareOfBranch);
                    if (!partnerStats[branch]) partnerStats[branch] = { collection: 0, partnerGross: 0, expenseDeduction: 0, netPayout: 0 };
                    if (!(data.pendingBalance > 0)) {
                        partnerStats[branch].expenseDeduction += partnerShareExp;
                        partnerStats[branch].netPayout -= partnerShareExp;
                    }
                }
            }
        }
    });

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('infoNetProfit', `₱${(myGross - myExpenseBurden - totalCapitalRecovered - totalSavingsAccumulated).toFixed(2)}`);
    set('finalProfitMath', `₱${(myGross - myExpenseBurden - totalCapitalRecovered - totalSavingsAccumulated).toFixed(2)}`);
    set('infoTotalGross', `₱${totalGross.toFixed(2)}`);
    set('mathGross', `₱${totalGross.toFixed(2)}`);
    set('sumAllExpenses', `₱${curExp.toFixed(2)}`);
    set('totalSavingsDisplay', `₱${totalSavingsAccumulated.toFixed(2)}`);
    set('infoTotalSavings', `-₱${totalSavingsAccumulated.toFixed(2)}`);
    set('infoTotalPartnerCuts', `-₱${totalPartnerCuts.toFixed(2)}`);
    set('infoMyGross', `₱${myGross.toFixed(2)}`);
    set('infoTotalExp', `-₱${myExpenseBurden.toFixed(2)}`);
    set('infoTotalCapital', `-₱${totalCapitalRecovered.toFixed(2)}`);

    if (document.getElementById('pisonetSummaryContainer')) document.getElementById('pisonetSummaryContainer').innerHTML = Object.entries(pisonetTotals).map(([br, amt]) => `<div class="flex justify-between items-center text-xs"><span>PISONET (${br})${getDaysAgo(pisonetLastDates[br])}</span><span class="font-bold text-white text-sm">₱${amt.toFixed(2)}</span></div>`).join('');
    
    const cSummary = document.getElementById('coffeeSummaryContainer');
    if (cSummary) {
        if (coffeeGross > 0) { cSummary.classList.remove('hidden'); cSummary.innerHTML = `<div class="flex justify-between items-center text-xs"><span>COFFEE VENDO${getDaysAgo(latestCoffeeTs)}</span><span class="font-bold text-orange-200">₱${coffeeGross.toFixed(2)}</span></div>`; }
        else { cSummary.classList.add('hidden'); }
    }

    const wifiDetailed = document.getElementById('pisoWifiDetailedContainer');
    if (wifiDetailed) {
        wifiDetailed.innerHTML = '<span class="block text-[8px] text-gray-500 uppercase font-black mb-2 tracking-widest text-center opacity-50">Detailed PisoWiFi Breakdown</span>' +
            Object.entries(pisoWifiPartnerTotals).map(([name, s]) => `
            <div class="bg-black/20 p-2 rounded-xl border border-white/5 mb-2">
                <div class="text-[8px] font-black text-blue-300 uppercase tracking-tighter mb-1.5 flex justify-between">
                    <span>${name}</span>
                    <span class="opacity-50">${getDaysAgo(s.ts)}</span>
                </div>
                <div class="grid grid-cols-3 gap-1 text-center">
                    <div class="flex flex-col">
                        <span class="text-[6px] text-gray-500 uppercase font-bold">Collection</span>
                        <span class="text-[10px] font-black text-white">₱${s.gross.toFixed(2)}</span>
                    </div>
                    <div class="flex flex-col border-x border-white/5">
                        <span class="text-[6px] text-gray-500 uppercase font-bold">My Share</span>
                        <span class="text-[10px] font-black text-info-green">₱${s.myShare.toFixed(2)}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[6px] text-gray-500 uppercase font-bold">Partner</span>
                        <span class="text-[10px] font-black text-orange-400">₱${s.partnerShare.toFixed(2)}</span>
                    </div>
                </div>
            </div>`).join('');
    }

    const sCont = document.getElementById('shopSavingsContainer');
    if (sCont) {
        sCont.innerHTML = '<span class="block text-[10px] text-gray-400 uppercase font-bold mb-1">Maintenance Funds</span>' + 
            Object.entries(shopSavings).map(([br, amt]) => `<div class="flex justify-between items-center text-xs"><span>${br} Savings</span><span class="text-info-green font-bold">₱${amt.toFixed(2)}</span></div>`).join('');
    }

    const expCont = document.getElementById('expenseBreakdownContainer');
    if (expCont) {
        expCont.innerHTML = '';
        Object.entries(detailedExpenses).forEach(([branch, categories]) => {
            let branchHTML = `<div class="space-y-1.5"><span class="block text-[10px] text-red-300 uppercase font-black tracking-widest mt-2 border-b border-red-500/10 pb-0.5">${branch}</span>`;
            Object.entries(categories).forEach(([cat, amt]) => { branchHTML += `<div class="flex justify-between items-center text-[11px]"><span class="text-gray-400">${cat}</span><span class="font-bold text-red-400">₱${amt.toFixed(2)}</span></div>`; });
            branchHTML += `</div>`; expCont.innerHTML += branchHTML;
        });
    }

    const partnerContainer = document.getElementById('infoPartnerPayouts');
    if (partnerContainer) {
        partnerContainer.innerHTML = '<span class="block text-[10px] text-gray-400 uppercase font-bold mb-2 tracking-widest">Partner Net Payouts</span>';
        pendingDebts.forEach(debt => { if (debt.partner && partnerStats[debt.partner]) { partnerStats[debt.partner].netPayout -= debt.pendingBalance; partnerStats[debt.partner].expenseDeduction += debt.pendingBalance; } });
        const filtered = Object.entries(partnerStats).filter(([name]) => {
            return (appSettings.partners || []).some(p => p.name === name && p.share < 1.0);
        });
        if (filtered.length === 0) { partnerContainer.innerHTML += '<p class="text-blue-100/50 text-[10px] italic py-2">No active payouts.</p>'; }
        else {
            filtered.forEach(([name, stats]) => {
                const isNeg = stats.netPayout < 0;
                partnerContainer.innerHTML += `<div class="bg-black/20 p-3 rounded-2xl border border-white/5 mb-3 space-y-1.5"><div class="flex justify-between items-center border-b border-white/5 pb-1 mb-1"><span class="text-info-green font-black text-[11px] uppercase tracking-wider">${name}</span><span class="${isNeg ? 'text-red-400' : 'text-white'} font-black text-sm">₱${stats.netPayout.toFixed(2)}</span></div><div class="flex justify-between items-center text-[9px] text-blue-200/70 font-bold uppercase"><span>Collection (Shared only)</span><span>₱${stats.collection.toFixed(2)}</span></div><div class="flex justify-between items-center text-[9px] text-blue-100/50 font-medium uppercase"><span>Share</span><span>₱${stats.partnerGross.toFixed(2)}</span></div><div class="flex justify-between items-center text-[9px] text-red-400/70 font-medium uppercase"><span>Less Exp</span><span>-₱${stats.expenseDeduction.toFixed(2)}</span></div>${isNeg ? `<p class="text-[8px] text-red-400 font-bold uppercase text-center pt-1 animate-pulse">! High Expenses: Collect</p>` : ''}</div>`;
            });
        }
    }

    window.renderInfographicDonuts(cats, totalGross);
    window.renderPerformanceChart(snapshot, targetYear, branchFilter);
    window.renderPendingDebts(pendingDebts);
    window.renderCapitalRecovery(snapshot, branchFilter);
};

window.renderPerformanceChart = (snapshot, targetYear, branchFilter) => {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pData = Array(12).fill(0), wData = Array(12).fill(0), prData = Array(12).fill(0), cData = Array(12).fill(0);
    snapshot.forEach(doc => {
        const data = doc.data(), ts = data.timestamp?.toDate();
        if (ts && ts.getFullYear() === targetYear && data.type === 'income') {
            if (branchFilter !== 'all' && data.partner !== branchFilter) return;
            const month = ts.getMonth();
            if (data.label.includes('Pisonet')) pData[month] += data.amount;
            else if (data.label.includes('PisoWiFi')) wData[month] += data.amount;
            else if (data.label.includes('Coffee')) cData[month] += data.amount;
            else if (data.label.includes('Print') || data.label.toLowerCase().includes('photocopy')) prData[month] += data.amount;
        }
    });
    const ds = (l, d, c) => ({ label: l, data: d, borderColor: c, backgroundColor: c, tension: 0.4, pointRadius: 2, borderWidth: 2 });
    const data = { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], datasets: [ds('Pisonet', pData, '#3b82f6'), ds('PisoWiFi', wData, '#f97316'), ds('Coffee', cData, '#fbbf24'), ds('Printing', prData, '#00e676')] };
    if (performanceChartInstance) { performanceChartInstance.data = data; performanceChartInstance.update(); }
    else { performanceChartInstance = new Chart(ctx, { type: 'line', data, options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 9 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ₱${c.parsed.y.toFixed(2)}` } } },
        scales: { x: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 8 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 8 }, callback: (v) => '₱' + v }, grid: { color: 'rgba(255, 255, 255, 0.05)' } } }
    } }); }
};

window.renderInfographicDonuts = (cats, totalGross) => {
    const container = document.getElementById('revenueDonutsContainer');
    if (!container) return; container.innerHTML = '';
    if (totalGross === 0) { container.innerHTML = '<p class="text-white/50 col-span-4 text-center">No data.</p>'; return; }
    Object.entries(cats).forEach(([key, val]) => {
        if (val === 0) return;
        const pct = Math.round((val / totalGross) * 100);
        const grad = `conic-gradient(#00e676 ${pct}%, rgba(255,255,255,0.1) 0)`;
        container.innerHTML += `<div class="flex flex-col items-center"><div class="donut-ring" style="background: ${grad}; width: 60px; height: 60px;"><div class="donut-inner text-white font-bold text-xs" style="width: 45px; height: 45px;">${pct}%</div></div><p class="text-info-green mt-2 font-bold text-[8px] uppercase">${key}</p></div>`;
    });
};

window.renderPendingDebts = (debts) => {
    const container = document.getElementById('pendingDeductionsContainer');
    if (!container) return; container.innerHTML = '<span class="block text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-widest">Sticky Notes (Pending)</span>';
    if (debts.length === 0) { container.innerHTML += '<p class="text-orange-200/50 text-[10px] italic py-2 text-center">None.</p>'; return; }
    debts.sort((a,b) => b.ts - a.ts).forEach(debt => { 
        container.innerHTML += `<div class="flex justify-between items-center text-xs mb-2 bg-white/5 p-2 rounded-xl border border-white/5"><div class="truncate pr-2"><span class="text-orange-200 font-bold block">${debt.partner}</span><span class="text-white/60 text-[10px] truncate">${debt.label}</span></div><div class="text-right flex flex-col items-end gap-1"><span class="text-orange-400 font-bold shrink-0">₱${debt.pendingBalance.toFixed(2)}</span><button onclick="openDeductionModal('${debt.id}', ${debt.pendingBalance}, '${debt.label}', '${debt.partner}')" class="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-[9px] font-black uppercase hover:bg-orange-500/40 transition-colors">Settle</button></div></div>`;
    });
};

window.renderCapitalRecovery = (snapshot, branchFilter) => {
    const container = document.getElementById('capitalRecoveryContainer');
    if (!container) return; container.innerHTML = '<span class="block text-[10px] text-orange-200 uppercase font-bold mb-2 tracking-widest">Asset Recovery Status</span>';
    const recoveryTotals = {};
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'income') {
            if (branchFilter !== 'all' && data.partner !== branchFilter) return;
            const cat = data.label.includes('Coffee') ? 'Coffee Vendo' : data.label.includes('Pisonet') ? 'Pisonet' : data.label.includes('PisoWiFi') ? 'PisoWiFi' : 'Printing';
            const asset = (window.appSettings.assets || []).find(a => a.category === cat);
            if (asset) recoveryTotals[cat] = (recoveryTotals[cat] || 0) + (data.amount * asset.recoveryPercent);
        }
    });
    (window.appSettings.assets || []).forEach(asset => {
        if (branchFilter !== 'all' && asset.branch !== branchFilter) return;
        const recovered = recoveryTotals[asset.category] || 0, percent = Math.min(100, Math.round((recovered / asset.cost) * 100));
        container.innerHTML += `<div class="mb-4"><div class="flex justify-between mb-1"><span class="text-[10px] font-black text-orange-200 uppercase tracking-widest">${asset.name}</span><span class="text-xs font-bold text-white">₱${recovered.toLocaleString()} / ₱${asset.cost.toLocaleString()}</span></div><div class="w-full h-2 bg-black/40 rounded-full overflow-hidden shadow-inner"><div class="h-full bg-orange-500 transition-all duration-1000" style="width: ${percent}%"></div></div></div>`;
    });
};

window.renderLogsList = (snapshot) => {
    const container = document.getElementById('activityContainer');
    if (!container) return; container.innerHTML = '';
    const uniqueLabels = new Set();
    snapshot.forEach(doc => { if (doc.data().label) uniqueLabels.add(doc.data().label); });
    const logFilterSelect = document.getElementById('logFilterSelect');
    if (logFilterSelect) {
        const currentVal = logFilterSelect.value;
        logFilterSelect.innerHTML = '<option value="all">All Categories</option>';
        Array.from(uniqueLabels).sort().forEach(label => { const opt = document.createElement('option'); opt.value = label; opt.textContent = label; logFilterSelect.appendChild(opt); });
        logFilterSelect.value = currentVal || 'all';
    }
    let displayDocs = [];
    const now = new Date(), currentMonth = now.getMonth(), currentYear = now.getFullYear();
    snapshot.forEach(doc => {
        const data = doc.data(), ts = data.timestamp?.toDate();
        let matchesCategory = (window.currentLogFilter === 'all' || data.label === window.currentLogFilter);
        let matchesTime = true;
        if (window.currentLogTimeFilter === 'this_month' && ts) { matchesTime = (ts.getMonth() === currentMonth && ts.getFullYear() === currentYear); }
        if (matchesCategory && matchesTime) displayDocs.push(doc);
    });
    windowExportDocs = displayDocs;
    if (document.getElementById('logCount')) document.getElementById('logCount').innerText = `${displayDocs.length} Total Logs`;
    displayDocs.forEach((doc, index) => {
        const data = doc.data(), id = doc.id, ts = data.timestamp?.toDate(), rawAmt = data.amount;
        const myShareAmt = rawAmt * (data.sharePercent || 1.0);

        let daysPassedHTML = '';
        if (ts) {
            const diffDays = Math.floor((new Date() - ts) / 86400000);
            daysPassedHTML = `<span class="ml-3 inline-block bg-orange-400 text-white text-[9px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase">${diffDays} DAYS ELAPSED SINCE THIS COLLECTION</span>`;
        }

        let gapHTML = '';
        if (window.currentLogFilter !== 'all' && index < displayDocs.length - 1) {
            const nextTs = displayDocs[index + 1].data().timestamp?.toDate();
            if (ts && nextTs) {
                const gap = Math.round(Math.abs(ts - nextTs) / 86400000);
                gapHTML = `<span class="ml-2 inline-block bg-info-green text-[#1e3a8a] text-[9px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase">${gap} DAYS SINCE LAST</span>`;
            }
        }

        const icon = data.type === 'income' ? '💰' : '💸', colorClass = data.type === 'income' ? 'text-info-green' : 'text-red-400';
        const itemEl = document.createElement('div');
        itemEl.className = `bg-white/5 border border-white/10 p-5 rounded-3xl flex justify-between items-center hover:bg-white/10 transition-colors mb-3`;

        const shareNote = (data.sharePercent || 1.0) < 1.0 ? `<p class="text-[9px] text-orange-400 font-bold uppercase mt-1.5 tracking-wider">MY SHARE: ₱${myShareAmt.toFixed(2)} | PARTNER: ₱${(rawAmt - myShareAmt).toFixed(2)}</p>` : '';

        itemEl.innerHTML = `
            <div class="flex items-center gap-5 overflow-hidden">
                <div class="w-14 h-14 flex-shrink-0 rounded-2xl bg-black/20 flex items-center justify-center text-2xl border border-white/10 shadow-inner">${icon}</div>
                <div class="truncate">
                    <div class="flex items-center">
                        <p class="font-bold text-lg text-white truncate font-mont">${data.label}</p>
                        ${daysPassedHTML}
                        ${gapHTML}
                    </div>
                    <p class="text-xs text-blue-200">${ts ? ts.toLocaleString() : '...'}</p>
                    ${shareNote}
                    ${data.partner ? `<p class="text-[9px] text-blue-200/50 uppercase font-bold mt-1">BRANCH: ${data.partner}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="font-black text-2xl ${colorClass}">${data.type === 'income' ? '+' : '-'}₱${rawAmt.toFixed(2)}</span>
                <button onclick="initEditLog('${id}', ${rawAmt})" class="text-white/30 hover:text-info-blue p-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                <button onclick="deleteLog('${id}')" class="text-white/30 hover:text-red-400 p-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
            </div>`;
        container.appendChild(itemEl);
    });
};

window.exportToCSV = () => {
    if (!windowExportDocs.length) return alert("No logs to export!");
    let csv = "data:text/csv;charset=utf-8,Date,Time,Type,Category,Branch,Amount\n";
    windowExportDocs.forEach(d => { const data = d.data(), ts = data.timestamp?.toDate(); csv += `${ts ? ts.toLocaleDateString() : ''},${ts ? ts.toLocaleTimeString() : ''},${data.type},"${data.label}","${data.partner}",${data.amount}\n`; });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", "JGB_Logs.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

let pendingIncomeSave = null;
let pendingDebtsForPartner = [];

window.checkAndSaveIncome = (label, amount, partner, sharePercent, modalId) => {
    pendingDebtsForPartner = [];
    let totalDebt = 0;
    if (window.latestLogSnapshot) {
        window.latestLogSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.type === 'expense' && data.partner === partner && data.pendingBalance > 0) {
                pendingDebtsForPartner.push({ id: docSnap.id, balance: data.pendingBalance, ts: data.timestamp });
                totalDebt += data.pendingBalance;
            }
        });
    }
    if (totalDebt > 0) {
        pendingDebtsForPartner.sort((a, b) => (a.ts?.toMillis() || 0) - (b.ts?.toMillis() || 0));
        pendingIncomeSave = { label, amount, partner, sharePercent, modalId };
        document.getElementById(modalId)?.classList.add('hidden');
        const descEl = document.getElementById('interceptDeductionDesc');
        if (descEl) descEl.innerText = `${partner} has ₱${totalDebt.toFixed(2)} in pending shared expenses.`;
        const amtInp = document.getElementById('interceptDeductionAmount');
        if (amtInp) { amtInp.value = ''; amtInp.max = totalDebt; }
        document.getElementById('interceptDeductionModal')?.classList.remove('hidden');
    } else {
        window.saveToFirebase(label, amount, 'income', partner, sharePercent);
        document.getElementById(modalId)?.classList.add('hidden');
    }
};

window.confirmInterceptSave = async () => {
    if (!pendingIncomeSave) return;
    const amtInp = document.getElementById('interceptDeductionAmount');
    let deductAmt = parseFloat(amtInp ? amtInp.value : 0) || 0;
    const maxDebt = parseFloat(amtInp ? amtInp.max : 0);
    if (deductAmt < 0 || deductAmt > maxDebt) return alert("Invalid amount.");
    await window.saveToFirebase(pendingIncomeSave.label, pendingIncomeSave.amount, 'income', pendingIncomeSave.partner, pendingIncomeSave.sharePercent);
    if (deductAmt > 0) {
        let remaining = deductAmt;
        for (let debt of pendingDebtsForPartner) {
            if (remaining <= 0) break;
            let toDeduct = Math.min(debt.balance, remaining);
            await setDoc(doc(db, "jgs_logs", debt.id), { pendingBalance: debt.balance - toDeduct }, { merge: true });
            remaining -= toDeduct;
        }
    }
    document.getElementById('interceptDeductionModal')?.classList.add('hidden');
    pendingIncomeSave = null;
};

window.skipInterceptSave = async () => {
    if (!pendingIncomeSave) return;
    await window.saveToFirebase(pendingIncomeSave.label, pendingIncomeSave.amount, 'income', pendingIncomeSave.partner, pendingIncomeSave.sharePercent);
    document.getElementById('interceptDeductionModal')?.classList.add('hidden');
    pendingIncomeSave = null;
};

const q = query(logCol, orderBy("timestamp", "desc"));
onSnapshot(q, (snapshot) => {
    window.latestLogSnapshot = snapshot;
    window.renderLogsList(snapshot);
    if (document.getElementById('statsTab')?.classList.contains('active')) window.processStats(snapshot);
});
