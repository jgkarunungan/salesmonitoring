import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOFB3Xf8ru3Uhauhtt8LGAbX_0b2-V6fw",
    authDomain: "jgs-business-tracker.firebaseapp.com",
    projectId: "jgs-business-tracker",
    storageBucket: "jgs-business-tracker.firebasestorage.app",
    messagingSenderId: "183591785629",
    appId: "1:183591785629:web:9710670076127e6faeb074"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const logCol = collection(db, "jgs_logs");
const settingsDocRef = doc(db, "jgs_settings", "auth");

export { db, logCol, settingsDocRef };