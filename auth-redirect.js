// Firebase Redirect Authentication System - Following Official Guidelines
class RedirectAuth {
    constructor(app) {
        this.app = app;
        this.firebase = window.firebase;
        this.isInitialized = false;
        this.notificationShown = false;
    }

    // Initialize authentication following Firebase guidelines
    async initialize() {
        if (this.isInitialized) {
            console.log('Auth already initialized, skipping...');
            return;
        }
        
        this.isInitialized = true;
        console.log('Initializing redirect authentication...');
        
        try {
            // Step 1: Check for redirect result FIRST (Firebase recommendation)
            const result = await this.firebase.getRedirectResult(this.firebase.auth);
            if (result && result.user) {
                console.log('Found redirect result:', result.user);
                await this.handleRedirectResult(result);
                return;
            }
            
            // Step 2: Set up auth state listener (waits for redirect result)
            this.firebase.onAuthStateChanged(this.firebase.auth, (user) => {
                console.log('Auth state changed:', user ? 'signed in' : 'signed out');
                
                if (user) {
                    this.handleAuthenticatedUser(user);
                } else {
                    this.handleUnauthenticatedUser();
                }
            });
            
        } catch (error) {
            console.error('Error initializing auth:', error);
            this.showAuthScreen();
        }
    }

    // Handle redirect result (Firebase official method)
    async handleRedirectResult(result) {
        try {
            console.log('Processing redirect result for:', result.user.email);
            
            // Set user state
            this.app.currentUser = result.user;
            this.app.isOnline = true;
            
            // Check if user exists in Firestore
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', result.user.uid));
            
            if (userDoc.exists()) {
                // Returning user - load their data
                await this.handleReturningUser(userDoc.data());
            } else {
                // New user - set up profile
                await this.handleNewUser(result.user);
            }
            
        } catch (error) {
            console.error('Error handling redirect result:', error);
            this.app.showNotification('Error processing sign-in: ' + error.message, 'error');
            this.showAuthScreen();
        }
    }

    // Handle authenticated user (from onAuthStateChanged)
    async handleAuthenticatedUser(user) {
        try {
            console.log('Handling authenticated user:', user.email);
            
            // Set user state
            this.app.currentUser = user;
            this.app.isOnline = true;
            
            // Check if user exists in Firestore
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // Returning user - load their data
                await this.handleReturningUser(userDoc.data());
            } else {
                // New user - set up profile
                await this.handleNewUser(user);
            }
            
        } catch (error) {
            console.error('Error handling authenticated user:', error);
            this.app.showNotification('Error loading user data: ' + error.message, 'error');
            this.showAuthScreen();
        }
    }

    // Handle returning user
    async handleReturningUser(userData) {
        console.log('Loading returning user data...');
        
        // Load user data
        this.app.householdId = userData.householdId;
        this.app.userProfile = userData.profile || this.app.userProfile;
        
        // Save to local storage
        this.app.saveData('userProfile', this.app.userProfile);
        this.app.saveData('householdId', this.app.householdId);
        
        // Load household data
        await this.app.loadHouseholdData();
        
        // Show welcome message (only once)
        if (!this.notificationShown) {
            this.app.showNotification('Welcome back!', 'success');
            this.notificationShown = true;
        }
        
        // Transition to app
        this.transitionToApp();
    }

    // Handle new user
    async handleNewUser(user) {
        console.log('Setting up new user profile...');
        
        // Set up user profile
        this.app.userProfile.name = user.displayName || user.email.split('@')[0];
        this.app.userProfile.email = user.email;
        this.app.userProfile.avatar = user.photoURL;
        this.app.userProfile.color = this.app.generateRandomColor();
        
        // Save profile
        this.app.saveData('userProfile', this.app.userProfile);
        
        // Transition to app
        this.transitionToApp();
        
        // Show household code modal for new users
        this.app.showHouseholdCodeModal();
    }

    // Handle unauthenticated user
    handleUnauthenticatedUser() {
        console.log('No user authenticated');
        this.app.currentUser = null;
        this.app.isOnline = false;
        this.app.householdId = null;
        this.showAuthScreen();
    }

    // Transition to app interface
    transitionToApp() {
        console.log('Transitioning to app interface...');
        
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
        
        console.log('App interface displayed');
    }

    // Show auth screen
    showAuthScreen() {
        console.log('Showing auth screen...');
        
        // Hide app container
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.display = 'none';
        }
        
        // Show auth screen
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) {
            authScreen.style.display = 'flex';
        }
        
        console.log('Auth screen displayed');
    }

    // Google sign in with redirect (Firebase recommended method)
    async signInWithGoogle() {
        try {
            console.log('Starting Google sign in with redirect...');
            
            const provider = new this.firebase.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            this.app.showNotification('Redirecting to Google...', 'info');
            
            // Use redirect method (Firebase recommendation for web.app domains)
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
            
            // Transition to app
            this.transitionToApp();
            
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
            this.showAuthScreen();
            
            this.app.showNotification('Signed out successfully', 'success');
            
        } catch (error) {
            console.error('Error signing out:', error);
            this.app.showNotification('Error signing out: ' + error.message, 'error');
        }
    }
}
