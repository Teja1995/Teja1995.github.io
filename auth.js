const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
let currentUser = null;

function signInWithGoogle() {
    auth.signInWithPopup(googleProvider).catch(err => {
        alert('Sign-in failed: ' + err.message);
    });
}

function signOut() {
    auth.signOut();
}

auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (user) {
        document.getElementById('user-name').textContent = user.displayName || '';
        const avatar = document.getElementById('user-avatar');
        if (user.photoURL) avatar.src = user.photoURL;

        // Restore all model API keys from database into localStorage on every login
        try {
            const userSnap = await db.ref('users/' + user.uid).once('value');
            const userData = userSnap.val() || {};
            // Use the MODELS registry to restore each key by its dbKey
            const seen = new Set();
            for (const model of MODELS) {
                if (!model.dbKey || seen.has(model.dbKey)) continue;
                seen.add(model.dbKey);
                if (userData[model.dbKey]) {
                    localStorage.setItem(model.keyStorageKey, userData[model.dbKey]);
                }
            }
        } catch (e) { /* ignore — keys will be prompted if missing */ }

        document.getElementById('view-signin').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        showTab('practice');
        loadPerformanceData();

        // Show onboarding popup if no key exists for any model
        setTimeout(() => {
            const hasAnyKey = MODELS.some(m => localStorage.getItem(m.keyStorageKey));
            if (!hasAnyKey) {
                document.getElementById('gemini-onboarding-modal').classList.remove('hidden');
            }
        }, 700);
    } else {
        document.getElementById('view-signin').classList.remove('hidden');
        document.getElementById('view-app').classList.add('hidden');
    }
});
