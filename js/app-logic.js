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
