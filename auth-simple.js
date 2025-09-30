// Simple, Bulletproof Authentication System
class SimpleAuth {
    constructor(app) {
        this.app = app;
        this.firebase = window.firebase;
        this.isInitialized = false;
        this.notificationShown = false;
    }

    // Initialize authentication - only once
    async initialize() {
        if (this.isInitialized) {
            console.log('Auth already initialized, skipping...');
            return;
        }
        
        this.isInitialized = true;
        console.log('Initializing simple authentication...');
        
        try {
            // Check for redirect result first
            const result = await this.firebase.getRedirectResult(this.firebase.auth);
            if (result && result.user) {
                console.log('Found redirect result:', result.user);
                await this.handleSignIn(result.user);
                return;
            }
            
            // Check if user is already signed in
            if (this.firebase.auth.currentUser) {
                console.log('User already signed in');
                await this.handleSignIn(this.firebase.auth.currentUser);
            } else {
                console.log('No user signed in');
                this.app.showAuthScreen();
            }
        } catch (error) {
            console.error('Error initializing auth:', error);
            this.app.showAuthScreen();
        }
    }

    // Handle user sign in - prevent duplicate notifications
    async handleSignIn(user) {
        try {
            console.log('Handling sign in for:', user.email);
            
            // Set user state
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
                
                // Show notification only once
                if (!this.notificationShown) {
                    this.app.showNotification('Welcome back!', 'success');
                    this.notificationShown = true;
                }
                
                // Force transition to app
                this.forceShowApp();
                
            } else {
                // New user
                this.app.userProfile.name = user.displayName || user.email.split('@')[0];
                this.app.userProfile.email = user.email;
                this.app.userProfile.avatar = user.photoURL;
                this.app.userProfile.color = this.app.generateRandomColor();
                
                this.app.saveData('userProfile', this.app.userProfile);
                
                // Force transition to app
                this.forceShowApp();
                
                // Show household code modal
                this.app.showHouseholdCodeModal();
            }
        } catch (error) {
            console.error('Error handling sign in:', error);
            this.app.showNotification('Error signing in: ' + error.message, 'error');
        }
    }

    // Force show app interface
    forceShowApp() {
        console.log('Forcing app to show...');
        
        // Hide auth screen
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) {
            authScreen.style.display = 'none';
        }
        
        // Show app container
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.display = 'flex';
        }
        
        // Initialize app
        this.app.initializeApp();
        
        console.log('App forced to show');
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

    // Guest sign in
    async signInAsGuest() {
        try {
            console.log('Signing in as guest...');
            
            this.app.currentUser = { uid: 'guest', email: 'guest@local', displayName: 'Guest User' };
            this.app.isOnline = false;
            this.app.isGuest = true;
            
            // Show notification only once
            if (!this.notificationShown) {
                this.app.showNotification('Welcome! You are using guest mode. Data will be saved locally but won\'t sync across devices.', 'info');
                this.notificationShown = true;
            }
            
            // Force transition to app
            this.forceShowApp();
            
        } catch (error) {
            console.error('Guest sign in error:', error);
            this.app.showNotification('Guest sign in failed: ' + error.message, 'error');
        }
    }

    // Sign out
    async signOut() {
        try {
            console.log('Signing out...');
            
            if (this.app.isGuest) {
                // Guest sign out
                this.app.currentUser = null;
                this.app.isOnline = false;
                this.app.isGuest = false;
                this.app.clearAllData();
            } else {
                // Firebase sign out
                await this.firebase.signOut(this.firebase.auth);
                this.app.currentUser = null;
                this.app.isOnline = false;
                this.app.householdId = null;
                this.app.clearAllData();
            }
            
            // Reset notification flag
            this.notificationShown = false;
            
            // Show auth screen
            this.app.showAuthScreen();
            
            this.app.showNotification('Signed out successfully', 'success');
            
        } catch (error) {
            console.error('Error signing out:', error);
            this.app.showNotification('Error signing out: ' + error.message, 'error');
        }
    }
}
