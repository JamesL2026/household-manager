// Clean Authentication System for Household Manager
class CleanAuth {
    constructor(app) {
        this.app = app;
        this.firebase = window.firebase;
        this.currentUser = null;
        this.isOnline = false;
    }

    // Initialize authentication
    async initialize() {
        try {
            console.log('Initializing clean authentication...');
            
            // Set up auth state listener
            this.firebase.onAuthStateChanged(this.firebase.auth, (user) => {
                console.log('Auth state changed:', user ? 'signed in' : 'signed out');
                
                if (user) {
                    this.handleUserSignIn(user);
                } else {
                    this.handleUserSignOut();
                }
            });
            
            // Check for redirect result
            const result = await this.firebase.getRedirectResult(this.firebase.auth);
            if (result && result.user) {
                console.log('Found redirect result:', result.user);
                this.handleUserSignIn(result.user);
            } else if (this.firebase.auth.currentUser) {
                console.log('User already signed in');
                this.handleUserSignIn(this.firebase.auth.currentUser);
            } else {
                console.log('No user signed in');
                this.app.showAuthScreen();
            }
        } catch (error) {
            console.error('Error initializing auth:', error);
            this.app.showAuthScreen();
        }
    }

    // Handle user sign in
    async handleUserSignIn(user) {
        try {
            console.log('Handling user sign in:', user.email);
            
            this.currentUser = user;
            this.isOnline = true;
            this.app.currentUser = user;
            this.app.isOnline = true;
            
            // Check if user exists in database
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // Existing user
                const userData = userDoc.data();
                this.app.householdId = userData.householdId;
                this.app.userProfile = userData.profile || this.app.userProfile;
                
                this.app.saveData('userProfile', this.app.userProfile);
                this.app.saveData('householdId', this.app.householdId);
                
                await this.app.loadHouseholdData();
                this.app.hideAuthScreen();
                this.app.initializeApp();
                this.app.showNotification('Welcome back!', 'success');
            } else {
                // New user
                this.app.userProfile.name = user.displayName || user.email.split('@')[0];
                this.app.userProfile.email = user.email;
                this.app.userProfile.avatar = user.photoURL;
                this.app.userProfile.color = this.app.generateRandomColor();
                
                this.app.saveData('userProfile', this.app.userProfile);
                this.app.showHouseholdCodeModal();
            }
        } catch (error) {
            console.error('Error handling user sign in:', error);
            this.app.showNotification('Error signing in: ' + error.message, 'error');
        }
    }

    // Handle user sign out
    handleUserSignOut() {
        console.log('Handling user sign out');
        this.currentUser = null;
        this.isOnline = false;
        this.app.currentUser = null;
        this.app.isOnline = false;
        this.app.householdId = null;
        this.app.showAuthScreen();
    }

    // Google sign in
    async signInWithGoogle() {
        try {
            console.log('Starting Google sign in...');
            
            const provider = new this.firebase.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            this.app.showNotification('Redirecting to Google...', 'info');
            
            await this.firebase.signInWithRedirect(this.firebase.auth, provider);
            
        } catch (error) {
            console.error('Google sign in error:', error);
            this.app.showNotification('Google sign in failed: ' + error.message, 'error');
        }
    }

    // Sign out
    async signOut() {
        try {
            await this.firebase.signOut(this.firebase.auth);
            this.app.clearAllData();
            this.app.showNotification('Signed out successfully', 'success');
        } catch (error) {
            console.error('Error signing out:', error);
            this.app.showNotification('Error signing out: ' + error.message, 'error');
        }
    }
}
