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

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        document.getElementById('user-name').textContent = user.displayName || '';
        const avatar = document.getElementById('user-avatar');
        if (user.photoURL) avatar.src = user.photoURL;
        document.getElementById('view-signin').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        showTab('practice');
        loadPerformanceData();
        // Show onboarding popup if no Gemini key saved yet
        setTimeout(() => {
            if (!localStorage.getItem('geminiApiKey')) {
                document.getElementById('gemini-onboarding-modal').classList.remove('hidden');
            }
        }, 700);
    } else {
        document.getElementById('view-signin').classList.remove('hidden');
        document.getElementById('view-app').classList.add('hidden');
    }
});
