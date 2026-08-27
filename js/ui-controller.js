import { saveToFirebase } from './app-logic.js';

let logIdToDelete = null;
let editLogIdTarget = null;
let currentDeductionTarget = null;
let selectedPartnerName = null;
let selectedSharePercent = 1.0;
let selectedPisonetName = null;
let selectedPisonetShare = 1.0;

window.getLogIdToDelete = () => logIdToDelete;
window.getEditLogIdTarget = () => editLogIdTarget;
window.getCurrentDeductionTarget = () => currentDeductionTarget;

window.toggleRole = () => {
    if (window.currentRole === 'admin' || window.currentUser !== null) {
        window.setRole('guest', null);
    } else {
        const userInp = document.getElementById('loginUsername');
        const passInp = document.getElementById('loginPassword');
        const errEl = document.getElementById('loginError');
        if (userInp) userInp.value = '';
        if (passInp) passInp.value = '';
        if (errEl) errEl.classList.add('hidden');
        document.getElementById('loginModal')?.classList.remove('hidden');
    }
};

window.closeLoginModal = () => document.getElementById('loginModal')?.classList.add('hidden');

window.openSettingsModal = () => {
    window.renderUserList();
    window.renderPartnerList();
    window.renderAssetList();
    document.getElementById('settingsModal')?.classList.remove('hidden');
};

window.closeSettingsModal = () => {
    const feedback = document.getElementById('settingsFeedback');
    if (feedback) feedback.classList.add('hidden');
    document.getElementById('settingsModal')?.classList.add('hidden');
};

window.showSettingsFeedback = (msg, isError = false) => {
    const fb = document.getElementById('settingsFeedback');
    if (!fb) return;
    fb.innerText = msg;
    fb.className = `text-xs font-bold mt-2 text-center ${isError ? 'text-red-500' : 'text-info-green'}`;
    fb.classList.remove('hidden');
    setTimeout(() => fb.classList.add('hidden'), 3000);
};

window.renderUserList = () => {
    const container = document.getElementById('userListContainer');
    if (!container) return;
    container.innerHTML = '';
    const users = window.appSettings.users || [];
    if (users.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 italic">No users enrolled.</p>';
        return;
    }
    users.forEach((u, i) => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                <span class="text-sm font-bold text-info-blue">${u.username}</span>
                <button onclick="removeAppUser(${i})" class="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-2 py-1 rounded transition-colors">Remove</button>
            </div>
        `;
    });
};

window.renderPartnerList = () => {
    const container = document.getElementById('partnerListContainer');
    if (!container) return;
    container.innerHTML = '';
    const partners = window.appSettings.partners || [];
    if (partners.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 italic">No partners enrolled.</p>';
        return;
    }
    partners.forEach((p, i) => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100 mb-2">
                <div>
                    <span class="text-sm font-bold text-info-blue block">${p.name}</span>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${p.type} • ${Math.round(p.share * 100)}% Share</span>
                </div>
                <button onclick="removePartner(${i})" class="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-2 py-1 rounded transition-colors">Remove</button>
            </div>
        `;
    });
};

window.renderAssetList = () => {
    const container = document.getElementById('assetListContainer');
    if (!container) return;
    container.innerHTML = '';
    const assets = window.appSettings.assets || [];
    if (assets.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 italic">No assets enrolled.</p>';
        return;
    }
    assets.forEach((a, i) => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-orange-100 mb-2">
                <div>
                    <span class="text-sm font-bold text-orange-800 block">${a.name}</span>
                    <span class="text-[10px] text-gray-400 font-bold uppercase">${a.category} • ₱${a.cost.toLocaleString()} • ${Math.round(a.recoveryPercent * 100)}% Payback</span>
                </div>
                <button onclick="removeAsset(${i})" class="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-2 py-1 rounded transition-colors">Remove</button>
            </div>
        `;
    });
};

window.renderDynamicPartners = () => {
    const pisonetContainer = document.getElementById('pisonetPartnerContainer');
    const pisoContainer = document.getElementById('pisoWifiPartnerContainer');
    const expLocation = document.getElementById('expLocation');

    if (pisonetContainer) pisonetContainer.innerHTML = '';
    if (pisoContainer) pisoContainer.innerHTML = '';

    const partners = window.appSettings.partners || [];

    if (expLocation) {
        const currentVal = expLocation.value;
        expLocation.innerHTML = '<option value="General" class="bg-[#1e3a8a] text-white">General / All Shops</option>';
        const uniqueBranches = [...new Set(partners.map(p => p.name))];
        uniqueBranches.forEach(name => {
            expLocation.innerHTML += `<option value="${name}" class="bg-[#1e3a8a] text-white">${name}</option>`;
        });
        if (currentVal && uniqueBranches.includes(currentVal)) {
            expLocation.value = currentVal;
        }
    }

    partners.forEach(p => {
        if (p.type === 'Pisonet' && pisonetContainer) {
            pisonetContainer.innerHTML += `
                <button onclick="selectPisonetBranch('${p.name}', ${p.share})" class="pisonet-btn bg-gray-50 p-4 rounded-xl text-sm font-bold border-2 border-gray-100 text-gray-600 hover:border-blue-200 transition-colors w-full">
                    ${p.name}<br><span class="text-[10px] font-normal text-gray-400 block mt-1">${Math.round(p.share * 100)}% Share</span>
                </button>`;
        } else if (p.type === 'PisoWiFi' && pisoContainer) {
            pisoContainer.innerHTML += `
                <button onclick="selectPartner('${p.name}', ${p.share})" class="partner-btn bg-gray-50 p-4 rounded-xl text-sm font-bold border-2 border-gray-100 text-gray-600 hover:border-blue-200 transition-colors w-full">
                    ${p.name}<br><span class="text-[10px] font-normal text-gray-400 block mt-1">${Math.round(p.share * 100)}% Share</span>
                </button>`;
        }
    });
};

window.selectPartner = (name, share) => {
    selectedPartnerName = name; 
    selectedSharePercent = share;
    document.querySelectorAll('.partner-btn').forEach(btn => {
        if(btn.innerText.includes(name)) {
            btn.classList.add('border-info-blue', 'bg-blue-50', 'text-info-blue');
            btn.classList.remove('border-gray-100', 'bg-gray-50', 'text-gray-600');
        } else {
            btn.classList.remove('border-info-blue', 'bg-blue-50', 'text-info-blue');
            btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-600');
        }
    });
    updateModalSaveButton();
};

window.switchTab = (tab) => {
    const tabs = ['home', 'stats', 'history'];
    tabs.forEach(t => {
        const el = document.getElementById(`${t}Tab`);
        if (el) el.classList.remove('active');
        const navBtn = document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (navBtn) navBtn.classList.replace('text-info-blue', 'text-gray-400');
        const deskNavBtn = document.getElementById(`deskNav${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (deskNavBtn) deskNavBtn.classList.replace('text-info-blue', 'text-gray-400');
    });

    const activeTab = document.getElementById(`${tab}Tab`);
    if (activeTab) activeTab.classList.add('active');

    const activeNavBtn = document.getElementById(`nav${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (activeNavBtn) activeNavBtn.classList.replace('text-gray-400', 'text-info-blue');

    const activeDeskNavBtn = document.getElementById(`deskNav${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (activeDeskNavBtn) activeDeskNavBtn.classList.replace('text-gray-400', 'text-info-blue');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tab === 'stats' && window.latestLogSnapshot) {
        if (!document.getElementById('statMonthPicker').value) {
            const now = new Date();
            document.getElementById('statMonthPicker').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            document.getElementById('statYearPicker').value = now.getFullYear();
        }
        window.processStats(window.latestLogSnapshot);
    }
};

window.toggleExpenseForm = () => {
    const form = document.getElementById('expenseForm');
    const chevron = document.getElementById('expChevron');
    if (form) form.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180');
};

window.openRegisterModal = () => {
    const costAmt = document.getElementById('pAmount');
    const cost = parseFloat(costAmt ? costAmt.value : 0) || 0;
    if (cost <= 0) {
        alert("Please enter a 'Price to Charge' first before opening the register.");
        return;
    }
    const costDisplay = document.getElementById('regTotalCost');
    if (costDisplay) costDisplay.innerText = `₱${cost.toFixed(2)}`;
    
    const cashRec = document.getElementById('regCashReceived');
    if (cashRec) cashRec.value = '';
    
    const changeDue = document.getElementById('regChangeDue');
    if (changeDue) {
        changeDue.innerText = '₱0.00';
        changeDue.className = 'text-4xl font-black text-gray-400 font-mont';
    }
    
    const saveBtn = document.getElementById('regSaveBtn');
    if (saveBtn) saveBtn.disabled = true;
    
    document.getElementById('registerModal')?.classList.remove('hidden');
};

window.closeRegisterModal = () => document.getElementById('registerModal')?.classList.add('hidden');

window.addCash = (amount) => {
    const currentInp = document.getElementById('regCashReceived');
    if (!currentInp) return;
    const currentCash = parseFloat(currentInp.value) || 0;
    currentInp.value = currentCash + amount;
    window.calculateChange();
};

window.calculateChange = () => {
    const costInp = document.getElementById('pAmount');
    const cashInp = document.getElementById('regCashReceived');
    const cost = parseFloat(costInp ? costInp.value : 0) || 0;
    const received = parseFloat(cashInp ? cashInp.value : 0) || 0;
    const change = received - cost;

    const changeDisplay = document.getElementById('regChangeDue');
    const saveBtn = document.getElementById('regSaveBtn');

    if (!changeDisplay || !saveBtn) return;

    if (received === 0) {
        changeDisplay.innerText = '₱0.00';
        changeDisplay.className = 'text-4xl font-black text-gray-400 font-mont';
        saveBtn.disabled = true;
    } else if (change < 0) {
        changeDisplay.innerText = `Need ₱${Math.abs(change).toFixed(2)}`;
        changeDisplay.className = 'text-2xl font-black text-red-500 font-mont';
        saveBtn.disabled = true;
    } else {
        changeDisplay.innerText = `₱${change.toFixed(2)}`;
        changeDisplay.className = 'text-4xl font-black text-info-green font-mont';
        saveBtn.disabled = false;
    }
};

window.saveFromRegister = () => {
    window.logPrint();
    window.closeRegisterModal();
};

window.openPisoWifiModal = () => {
    document.getElementById('pisoWifiModal')?.classList.remove('hidden');
    selectedPartnerName = null;
    selectedSharePercent = 1.0;
    const amtInp = document.getElementById('modalPisoAmount');
    if (amtInp) amtInp.value = '';
    document.querySelectorAll('.partner-btn').forEach(btn => {
        btn.classList.remove('border-info-blue', 'bg-blue-50', 'text-info-blue');
        btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-600');
    });
    updateModalSaveButton();
};

window.closePisoWifiModal = () => document.getElementById('pisoWifiModal')?.classList.add('hidden');

function updateModalSaveButton() {
    const amtInp = document.getElementById('modalPisoAmount');
    const amt = parseFloat(amtInp ? amtInp.value : 0);
    const btn = document.getElementById('savePisoBtn');
    if (btn) btn.disabled = !(selectedPartnerName && amt > 0);
}
const pisoAmtInp = document.getElementById('modalPisoAmount');
if (pisoAmtInp) pisoAmtInp.oninput = updateModalSaveButton;

window.savePisoCollection = async () => {
    const amtInp = document.getElementById('modalPisoAmount');
    const amount = parseFloat(amtInp ? amtInp.value : 0);
    if (selectedPartnerName && amount > 0) {
        // Use the actual selected share percent (e.g., 0.3 for Wing) instead of 1.0
        await saveToFirebase(`PisoWiFi: ${selectedPartnerName}`, amount, 'income', selectedPartnerName, selectedSharePercent);
        window.closePisoWifiModal();
    }
};

window.openCoffeeModal = () => {
    document.getElementById('coffeeModal')?.classList.remove('hidden');
    const amtInp = document.getElementById('modalCoffeeAmount');
    if (amtInp) amtInp.value = '';
    
    const splitInc = document.getElementById('coffeeSplitIncome');
    const splitCap = document.getElementById('coffeeSplitCapital');
    const splitSav = document.getElementById('coffeeSplitSavings');
    if (splitInc) splitInc.innerText = '₱0.00';
    if (splitCap) splitCap.innerText = '₱0.00';
    if (splitSav) splitSav.innerText = '₱0.00';
    
    const saveBtn = document.getElementById('saveCoffeeBtn');
    if (saveBtn) saveBtn.disabled = true;

    const assets = window.appSettings.assets || [];
    const asset = assets.find(a => a.category === 'Coffee Vendo');
    const paybackPct = asset ? asset.recoveryPercent * 100 : 70;
    const savingsPct = asset ? asset.savingsPercent * 100 : 5;
    const incomePct = 100 - paybackPct - savingsPct;
    const splitEl = document.querySelector('#coffeeModal p.text-orange-800');
    if (splitEl) splitEl.innerText = `Split: ${incomePct}% / ${paybackPct}% / ${savingsPct}%`;
};

window.closeCoffeeModal = () => document.getElementById('coffeeModal')?.classList.add('hidden');

const coffeeAmtInp = document.getElementById('modalCoffeeAmount');
if (coffeeAmtInp) {
    coffeeAmtInp.oninput = (e) => {
        const amt = parseFloat(e.target.value) || 0;
        const assets = window.appSettings.assets || [];
        const asset = assets.find(a => a.category === 'Coffee Vendo');
        const paybackRate = asset ? asset.recoveryPercent : 0.7;
        const savingsRate = asset ? asset.savingsPercent : 0.05;
        
        const cap = amt * paybackRate;
        const sav = amt * savingsRate;
        const inc = amt - cap - sav;

        const splitInc = document.getElementById('coffeeSplitIncome');
        const splitCap = document.getElementById('coffeeSplitCapital');
        const splitSav = document.getElementById('coffeeSplitSavings');
        if (splitInc) splitInc.innerText = `₱${inc.toFixed(2)}`;
        if (splitCap) splitCap.innerText = `₱${cap.toFixed(2)}`;
        if (splitSav) splitSav.innerText = `₱${sav.toFixed(2)}`;
        
        const saveBtn = document.getElementById('saveCoffeeBtn');
        if (saveBtn) saveBtn.disabled = !(amt > 0);
    };
}

window.saveCoffeeCollection = async () => {
    const amtInp = document.getElementById('modalCoffeeAmount');
    const amount = parseFloat(amtInp ? amtInp.value : 0);
    if (amount > 0) {
        await saveToFirebase(`Coffee Vendo`, amount, 'income', 'Cabagñan', 1.0);
        window.closeCoffeeModal();
    }
};

window.openPisonetModal = () => {
    document.getElementById('pisonetModal')?.classList.remove('hidden');
    selectedPisonetName = null; selectedPisonetShare = 1.0;
    const amtInp = document.getElementById('modalPisonetAmount');
    if (amtInp) amtInp.value = '';
    document.querySelectorAll('.pisonet-btn').forEach(btn => {
        btn.classList.remove('border-info-blue', 'bg-blue-50', 'text-info-blue');
        btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-600');
    });
    updatePisonetModalSaveButton();
};

window.closePisonetModal = () => document.getElementById('pisonetModal')?.classList.add('hidden');

window.selectPisonetBranch = (name, share) => {
    selectedPisonetName = name; selectedPisonetShare = share;
    document.querySelectorAll('.pisonet-btn').forEach(btn => {
        if(btn.innerText.includes(name)) {
            btn.classList.add('border-info-blue', 'bg-blue-50', 'text-info-blue');
            btn.classList.remove('border-gray-100', 'bg-gray-50', 'text-gray-600');
        } else {
            btn.classList.remove('border-info-blue', 'bg-blue-50', 'text-info-blue');
            btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-600');
        }
    });
    updatePisonetModalSaveButton();
};

function updatePisonetModalSaveButton() {
    const amtInp = document.getElementById('modalPisonetAmount');
    const amt = parseFloat(amtInp ? amtInp.value : 0);
    const btn = document.getElementById('savePisonetBtn');
    if (btn) btn.disabled = !(selectedPisonetName && amt > 0);
}
const pisonetAmtInp = document.getElementById('modalPisonetAmount');
if (pisonetAmtInp) pisonetAmtInp.oninput = updatePisonetModalSaveButton;

window.savePisonetCollection = async () => {
    const amtInp = document.getElementById('modalPisonetAmount');
    const amount = parseFloat(amtInp ? amtInp.value : 0);
    if (selectedPisonetName && amount > 0) {
        window.checkAndSaveIncome(`Pisonet: ${selectedPisonetName}`, amount, selectedPisonetName, selectedPisonetShare, 'pisonetModal');
    }
};

window.toggleOtherPrintInput = () => {
    const sel = document.getElementById('pDesc');
    const category = sel ? sel.value : '';
    const otherInput = document.getElementById('pOtherDesc');
    if (otherInput) {
        category === 'Others' ? otherInput.classList.remove('hidden') : (otherInput.classList.add('hidden'), otherInput.value = '');
    }
};

window.logPrint = async () => {
    const amtInput = document.getElementById('pAmount');
    const descSelect = document.getElementById('pDesc');
    const otherInput = document.getElementById('pOtherDesc');
    const amount = parseFloat(amtInput ? amtInput.value : 0);

    let descVal = descSelect ? descSelect.value : '';
    if (descVal === 'Others' && otherInput) descVal = otherInput.value.trim();
    const label = descVal ? `Print: ${descVal}` : "Printing";

    if (amount > 0) {
        await saveToFirebase(label, amount, 'income', 'Cabagñan', 1.0);
        if (amtInput) amtInput.value = '';
        if (descSelect) descSelect.selectedIndex = 0;
        if (otherInput) {
            otherInput.value = '';
            otherInput.classList.add('hidden');
        }
    } else { alert("Please enter a valid amount."); }
};

window.toggleOtherExpenseInput = () => {
    const sel = document.getElementById('expCategory');
    const category = sel ? sel.value : '';
    const otherInput = document.getElementById('expOtherDesc');
    if (otherInput) {
        category === 'Others' ? otherInput.classList.remove('hidden') : (otherInput.classList.add('hidden'), otherInput.value = '');
    }
};

window.logExpense = async () => {
    const categorySelect = document.getElementById('expCategory');
    const otherInput = document.getElementById('expOtherDesc');
    const amtInput = document.getElementById('expAmt');
    const locSelect = document.getElementById('expLocation');
    const expLocation = locSelect ? locSelect.value : 'General';
    const amt = parseFloat(amtInput ? amtInput.value : 0);
    let desc = categorySelect ? categorySelect.value : '';

    if (!desc) return alert("Please select an expense category.");
    if (desc === 'Others' && otherInput) {
        desc = otherInput.value.trim();
        if (!desc) return alert("Please specify what the 'Other' expense is.");
    }
    if (amt > 0) {
        const partnerVal = expLocation !== 'General' ? expLocation : null;
        let sharePercent = 1.0;
        if (partnerVal === 'Iraya') sharePercent = 0.5;

        let pendingBalance = 0;
        const checkbox = document.getElementById('expIsDebt');
        if (partnerVal && checkbox && checkbox.checked) {
            pendingBalance = amt * (1 - sharePercent);
        }

        await saveToFirebase(desc, amt, 'expense', partnerVal, sharePercent, pendingBalance);

        if (categorySelect) categorySelect.selectedIndex = 0;
        if (otherInput) {
            otherInput.value = ''; otherInput.classList.add('hidden');
        }
        if (amtInput) amtInput.value = '';
        if (locSelect) locSelect.value = 'General';
        document.getElementById('expenseDebtContainer')?.classList.add('hidden');
        if (checkbox) checkbox.checked = false;

        if(window.innerWidth < 1024) window.toggleExpenseForm();
    } else { alert("Please enter a valid amount."); }
};

window.deleteLog = (id) => {
    logIdToDelete = id;
    const passInp = document.getElementById('deleteAuthPassword');
    const errEl = document.getElementById('deleteAuthError');
    if (passInp) passInp.value = '';
    if (errEl) errEl.classList.add('hidden');

    const descEl = document.getElementById('deleteAuthDesc');
    const inputCont = document.getElementById('deleteAuthInputContainer');

    if (window.currentRole === 'admin') {
        if (descEl) descEl.innerText = "Are you sure you want to permanently void this transaction?";
        if (inputCont) inputCont.classList.add('hidden');
    } else {
        if (descEl) descEl.innerText = "Please enter the admin password to permanently void this transaction.";
        if (inputCont) inputCont.classList.remove('hidden');
    }

    document.getElementById('deleteAuthModal')?.classList.remove('hidden');
};

window.closeDeleteAuthModal = () => {
    logIdToDelete = null;
    document.getElementById('deleteAuthModal')?.classList.add('hidden');
};

window.initEditLog = (id, currentAmount) => {
    editLogIdTarget = id;
    const amtInp = document.getElementById('editLogAmount');
    if (amtInp) amtInp.value = currentAmount;
    
    const passInp = document.getElementById('editAuthPassword');
    const errEl = document.getElementById('editAuthError');
    if (passInp) passInp.value = '';
    if (errEl) errEl.classList.add('hidden');

    const authSec = document.getElementById('editAuthSection');
    const dataSec = document.getElementById('editDataSection');

    if (window.currentRole === 'admin') {
        if (authSec) authSec.classList.add('hidden');
        if (dataSec) dataSec.classList.remove('hidden');
    } else {
        if (authSec) authSec.classList.remove('hidden');
        if (dataSec) dataSec.classList.add('hidden');
    }
    document.getElementById('editLogModal')?.classList.remove('hidden');
};

window.closeEditModal = () => {
    editLogIdTarget = null;
    document.getElementById('editLogModal')?.classList.add('hidden');
};

window.authEditLog = () => {
    const passInp = document.getElementById('editAuthPassword');
    const pass = passInp ? passInp.value : '';
    if (pass === window.appSettings.adminPassword) {
        document.getElementById('editAuthSection')?.classList.add('hidden');
        document.getElementById('editDataSection')?.classList.remove('hidden');
    } else {
        document.getElementById('editAuthError')?.classList.remove('hidden');
    }
};

window.openDeductionModal = (id, maxAmount, label, partner) => {
    currentDeductionTarget = id;
    const desc = document.getElementById('deductionDesc');
    if (desc) desc.innerText = `Settle debt for ${partner} (${label})`;
    
    const amtInp = document.getElementById('deductionAmount');
    if (amtInp) {
        amtInp.value = maxAmount;
        amtInp.max = maxAmount;
    }
    document.getElementById('deductionModal')?.classList.remove('hidden');
};

window.closeDeductionModal = () => {
    currentDeductionTarget = null;
    document.getElementById('deductionModal')?.classList.add('hidden');
};

const dateDisplay = document.getElementById('currentDate');
if (dateDisplay) dateDisplay.innerText = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });

// Branch selection listener for expenses
document.getElementById('expLocation')?.addEventListener('change', (e) => {
    const branch = e.target.value;
    const debtContainer = document.getElementById('expenseDebtContainer');
    if (!debtContainer) return;
    
    let isShared = false;
    if (branch !== 'General') {
        const partners = window.appSettings.partners || [];
        const partnerObj = partners.find(p => p.name === branch && p.share < 1.0);
        if (partnerObj) isShared = true;
    }

    if (isShared) {
        debtContainer.classList.remove('hidden');
    } else {
        debtContainer.classList.add('hidden');
        const checkbox = document.getElementById('expIsDebt');
        if (checkbox) checkbox.checked = false;
    }
});
