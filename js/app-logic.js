import { db, logCol, settingsDocRef } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global State
window.appSettings = {
    adminPassword: "admin123",
    users: [],
    partners: [],
    assets: []
};

window.currentRole = 'guest';
window.currentUser = null;
window.latestLogSnapshot = null;
window.currentLogFilter = 'all';
window.currentLogTimeFilter = 'all_time';

// Initialize Settings Listener - Strictly follows the Database
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        window.appSettings = { ...window.appSettings, ...docSnap.data() };
    } else {
        // Only initialize if the database is completely empty
        setDoc(settingsDocRef, window.appSettings);
    }

    if (window.renderUserList) window.renderUserList();
    if (window.renderPartnerList) window.renderPartnerList();
    if (window.renderAssetList) window.renderAssetList();
    if (window.renderDynamicPartners) window.renderDynamicPartners();
    
    if (window.latestLogSnapshot && document.getElementById('statsTab')?.classList.contains('active')) {
        if (window.processStats) window.processStats(window.latestLogSnapshot);
    }
});

export const setRole = (role, username = null) => {
    window.currentRole = role;
    window.currentUser = username;
    const btn = document.getElementById('modeBtn');
    const btnText = document.getElementById('modeBtnText');
    const settingsBtn = document.getElementById('settingsBtn');
    
    const deskStatsBtn = document.getElementById('deskNavStats');
    const navStatsBtn = document.getElementById('navStats');

    if (role === 'admin') {
        btnText.innerText = 'Admin Mode';
        btn.className = 'bg-info-blue text-white px-3 py-2 rounded-xl text-xs font-bold border border-blue-400 hover:bg-blue-800 transition-colors flex items-center gap-2';
        deskStatsBtn?.classList.remove('hidden');
        navStatsBtn?.classList.remove('hidden');
        settingsBtn?.classList.remove('hidden');
    } else {
        btnText.innerText = username ? `User: ${username}` : 'Log In';
        btn.className = 'bg-gray-100 text-gray-500 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-200 transition-colors flex items-center gap-2';
        deskStatsBtn?.classList.add('hidden');
        navStatsBtn?.classList.add('hidden');
        settingsBtn?.classList.add('hidden');
        if (document.getElementById('statsTab')?.classList.contains('active')) window.switchTab('home');
    }
};
window.setRole = setRole;

export const saveToFirebase = async (label, amount, type, partner = null, sharePercent = 1.0, pendingBalance = 0) => {
    try {
        await addDoc(logCol, {
            label, amount, type, partner, sharePercent, pendingBalance,
            timestamp: serverTimestamp(), dateStr: new Date().toLocaleDateString()
        });
    } catch (err) { console.error("Save error:", err); }
};
window.saveToFirebase = saveToFirebase;

window.confirmLogin = () => {
    const user = document.getElementById('loginUsername').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.classList.add('hidden');

    if (user.toLowerCase() === 'admin' && pass === window.appSettings.adminPassword) {
        window.setRole('admin', 'Admin');
        window.closeLoginModal();
    } else {
        const foundUser = window.appSettings.users?.find(u => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
        if (foundUser) {
            window.setRole('user', foundUser.username);
            window.closeLoginModal();
        } else if (errorEl) {
            errorEl.innerText = "Incorrect username or password!";
            errorEl.classList.remove('hidden');
        }
    }
};

window.saveAdminPassword = async () => {
    const newPass = document.getElementById('newAdminPassword').value;
    if (newPass.length < 4) return window.showSettingsFeedback("Password too short!", true);
    window.appSettings.adminPassword = newPass;
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    window.showSettingsFeedback("Admin password updated successfully!");
    document.getElementById('newAdminPassword').value = '';
};

window.addAppUser = async () => {
    const u = document.getElementById('newUsername').value.trim();
    const p = document.getElementById('newUserPassword').value;
    if (!u || !p) return window.showSettingsFeedback("Please fill both fields!", true);
    if (u.toLowerCase() === 'admin') return window.showSettingsFeedback("Cannot use 'admin' as username!", true);
    if (!window.appSettings.users) window.appSettings.users = [];
    if (window.appSettings.users.find(x => x.username.toLowerCase() === u.toLowerCase())) return window.showSettingsFeedback("User already exists!", true);

    window.appSettings.users.push({ username: u, password: p });
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    window.showSettingsFeedback("User enrolled successfully!");
    window.renderUserList();
};

window.removeAppUser = async (index) => {
    window.appSettings.users.splice(index, 1);
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    window.showSettingsFeedback("User removed successfully!");
    window.renderUserList();
};

window.addPartner = async () => {
    const type = document.getElementById('newPartnerType').value;
    const name = document.getElementById('newPartnerName').value.trim();
    const shareInput = parseFloat(document.getElementById('newPartnerShare').value);

    if (!name || isNaN(shareInput) || shareInput <= 0 || shareInput > 100) {
        return window.showSettingsFeedback("Invalid name or share % (1-100)", true);
    }

    if (!window.appSettings.partners) window.appSettings.partners = [];
    if (window.appSettings.partners.find(p => p.type === type && p.name.toLowerCase() === name.toLowerCase())) {
        return window.showSettingsFeedback(`${name} already exists for ${type}!`, true);
    }

    window.appSettings.partners.push({ type, name, share: shareInput / 100 });
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    document.getElementById('newPartnerName').value = '';
    document.getElementById('newPartnerShare').value = '';
    window.showSettingsFeedback("Partner added successfully!");
    window.renderPartnerList();
    window.renderDynamicPartners();
};

window.removePartner = async (index) => {
    window.appSettings.partners.splice(index, 1);
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    window.showSettingsFeedback("Partner removed successfully!");
    window.renderPartnerList();
    window.renderDynamicPartners();
};

window.addAsset = async () => {
    const category = document.getElementById('newAssetCategory').value;
    const name = document.getElementById('newAssetName').value.trim();
    const cost = parseFloat(document.getElementById('newAssetCost').value);
    const recovery = parseFloat(document.getElementById('newAssetRecovery').value) / 100;
    const savings = parseFloat(document.getElementById('newAssetSavings').value) / 100;

    if (!name || isNaN(cost) || cost <= 0) return window.showSettingsFeedback("Invalid name or cost!", true);

    if (!window.appSettings.assets) window.appSettings.assets = [];
    window.appSettings.assets.push({ id: Date.now(), category, name, cost, recoveryPercent: recovery, savingsPercent: savings, branch: 'Cabagñan' });

    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    document.getElementById('newAssetName').value = '';
    document.getElementById('newAssetCost').value = '';
    window.showSettingsFeedback("Asset enrolled successfully!");
    window.renderAssetList();
};

window.saveAssetEdit = async () => {
    const assetId = window.currentAssetEditId;
    const cost = parseFloat(document.getElementById('editAssetCost').value);
    const recovery = parseFloat(document.getElementById('editAssetRecovery').value) / 100;
    const savings = parseFloat(document.getElementById('editAssetSavings').value) / 100;

    if (isNaN(cost) || cost <= 0) return window.showSettingsFeedback("Invalid cost!", true);

    const assetIndex = window.appSettings.assets.findIndex(a => a.id === assetId);
    if (assetIndex > -1) {
        window.appSettings.assets[assetIndex].cost = cost;
        window.appSettings.assets[assetIndex].recoveryPercent = recovery;
        window.appSettings.assets[assetIndex].savingsPercent = savings;

        await setDoc(settingsDocRef, window.appSettings, { merge: true });
        window.showSettingsFeedback("Asset updated successfully!");
        window.cancelAssetEdit();
        window.renderAssetList();
    }
};

window.removeAsset = async (index) => {
    window.appSettings.assets.splice(index, 1);
    await setDoc(settingsDocRef, window.appSettings, { merge: true });
    window.showSettingsFeedback("Asset removed successfully!");
    window.renderAssetList();
};

window.confirmDeleteLog = async () => {
    const logIdToDelete = window.getLogIdToDelete();
    if (window.currentRole === 'admin') {
        if (logIdToDelete) {
            await deleteDoc(doc(db, "jgs_logs", logIdToDelete));
            window.closeDeleteAuthModal();
        }
    } else {
        const pass = document.getElementById('deleteAuthPassword').value;
        if (pass === window.appSettings.adminPassword) {
            if (logIdToDelete) {
                await deleteDoc(doc(db, "jgs_logs", logIdToDelete));
                window.closeDeleteAuthModal();
            }
        } else {
            document.getElementById('deleteAuthError').classList.remove('hidden');
        }
    }
};

window.saveDeduction = async () => {
    const currentDeductionTarget = window.getCurrentDeductionTarget();
    if (!currentDeductionTarget) return;
    const amtInp = document.getElementById('deductionAmount');
    const inputVal = parseFloat(amtInp ? amtInp.value : 0);
    const maxVal = parseFloat(amtInp ? amtInp.max : 0);
    if (isNaN(inputVal) || inputVal <= 0 || inputVal > maxVal) return alert("Invalid amount.");
    try {
        await setDoc(doc(db, "jgs_logs", currentDeductionTarget), { pendingBalance: maxVal - inputVal }, { merge: true });
        window.closeDeductionModal();
    } catch (err) { console.error(err); }
};

window.setLatestLogSnapshot = (snap) => { window.latestLogSnapshot = snap; };
window.setLogFilter = (filter) => { window.currentLogFilter = filter; };
window.setLogTimeFilter = (filter) => { window.currentLogTimeFilter = filter; };

window.setRole('guest', null);
