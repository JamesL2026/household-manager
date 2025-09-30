// Bulletproof Authentication System - Final Attempt
class BulletproofAuth {
    constructor(app) {
        this.app = app;
        this.firebase = window.firebase;
        this.isInitialized = false;
        this.isProcessing = false;
        this.notificationShown = false;
        this.redirectProcessed = false;
    }

    // Initialize with maximum error handling
    async initialize() {
        if (this.isInitialized) {
            console.log('Auth already initialized');
            return;
        }
        
        this.isInitialized = true;
        console.log('Initializing bulletproof authentication...');
        
        try {
            // Wait for Firebase to be ready
            await this.waitForFirebase();
            
            // Check for redirect result with timeout
            const redirectResult = await this.checkRedirectResult();
            if (redirectResult) {
                console.log('Processing redirect result...');
                await this.processRedirectResult(redirectResult);
                return;
            }
            
            // Set up auth state listener with debouncing
            this.setupAuthStateListener();
            
            // Check current user
            const currentUser = this.firebase.auth.currentUser;
            if (currentUser) {
                console.log('User already signed in');
                await this.handleUserSignIn(currentUser);
            } else {
                console.log('No user signed in - showing auth screen');
                this.showAuthScreen();
            }
            
        } catch (error) {
            console.error('Critical auth initialization error:', error);
            this.showAuthScreen();
        }
    }

    // Wait for Firebase to be fully ready
    async waitForFirebase() {
        let attempts = 0;
        while (!this.firebase || !this.firebase.auth) {
            if (attempts > 50) {
                throw new Error('Firebase not ready after 5 seconds');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        console.log('Firebase is ready');
    }

    // Check for redirect result with timeout
    async checkRedirectResult() {
        try {
            console.log('Checking for redirect result...');
            const result = await Promise.race([
                this.firebase.getRedirectResult(this.firebase.auth),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
            
            if (result && result.user) {
                console.log('Found redirect result:', result.user.email);
                return result;
            }
            return null;
        } catch (error) {
            console.log('No redirect result or timeout:', error.message);
            return null;
        }
    }

    // Process redirect result
    async processRedirectResult(result) {
        if (this.redirectProcessed) {
            console.log('Redirect already processed, skipping');
            return;
        }
        
        this.redirectProcessed = true;
        console.log('Processing redirect result for:', result.user.email);
        
        try {
            // Set user state immediately
            this.app.currentUser = result.user;
            this.app.isOnline = true;
            
            // Check user in database
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', result.user.uid));
            
            if (userDoc.exists()) {
                // Returning user
                await this.handleReturningUser(userDoc.data());
            } else {
                // New user
                await this.handleNewUser(result.user);
            }
            
            // Force transition to app
            this.forceShowApp();
            
        } catch (error) {
            console.error('Error processing redirect result:', error);
            this.showAuthScreen();
        }
    }

    // Set up auth state listener with debouncing
    setupAuthStateListener() {
        let authStateTimeout;
        
        this.firebase.onAuthStateChanged(this.firebase.auth, (user) => {
            // Debounce rapid auth state changes
            clearTimeout(authStateTimeout);
            authStateTimeout = setTimeout(async () => {
                console.log('Auth state changed:', user ? 'signed in' : 'signed out');
                
                if (user && !this.redirectProcessed) {
                    await this.handleUserSignIn(user);
                } else if (!user) {
                    this.handleUserSignOut();
                }
            }, 100);
        });
    }

    // Handle user sign in
    async handleUserSignIn(user) {
        if (this.isProcessing) {
            console.log('Already processing user sign in');
            return;
        }
        
        this.isProcessing = true;
        console.log('Handling user sign in:', user.email);
        
        try {
            // Set user state
            this.app.currentUser = user;
            this.app.isOnline = true;
            
            // Check user in database
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // Returning user
                await this.handleReturningUser(userDoc.data());
            } else {
                // New user
                await this.handleNewUser(user);
            }
            
            // Force transition to app
            this.forceShowApp();
            
        } catch (error) {
            console.error('Error handling user sign in:', error);
            this.showAuthScreen();
        } finally {
            this.isProcessing = false;
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
        
        // Show welcome message only once
        if (!this.notificationShown) {
            this.app.showNotification('Welcome back!', 'success');
            this.notificationShown = true;
        }
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
        
        // Show household code modal for new users
        setTimeout(() => {
            this.app.showHouseholdCodeModal();
        }, 1000);
    }

    // Handle user sign out
    handleUserSignOut() {
        console.log('Handling user sign out');
        this.app.currentUser = null;
        this.app.isOnline = false;
        this.app.householdId = null;
        this.notificationShown = false;
        this.redirectProcessed = false;
        this.showAuthScreen();
    }

    // Force show app interface
    forceShowApp() {
        console.log('Force showing app interface...');
        
        // Multiple attempts to ensure transition
        const showApp = () => {
            const authScreen = document.getElementById('auth-screen');
            const appContainer = document.getElementById('app-container');
            
            if (authScreen) {
                authScreen.style.display = 'none';
                authScreen.style.visibility = 'hidden';
            }
            
            if (appContainer) {
                appContainer.style.display = 'flex';
                appContainer.style.visibility = 'visible';
            }
            
            // Initialize app
            this.app.initializeApp();
        };
        
        // Immediate attempt
        showApp();
        
        // Backup attempts
        setTimeout(showApp, 100);
        setTimeout(showApp, 500);
        setTimeout(showApp, 1000);
        
        console.log('App interface forced to show');
    }

    // Show auth screen
    showAuthScreen() {
        console.log('Showing auth screen...');
        
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        
        if (appContainer) {
            appContainer.style.display = 'none';
            appContainer.style.visibility = 'hidden';
        }
        
        if (authScreen) {
            authScreen.style.display = 'flex';
            authScreen.style.visibility = 'visible';
        }
    }

    // Google sign in with maximum error handling
    async signInWithGoogle() {
        try {
            console.log('Starting Google sign in...');
            
            const provider = new this.firebase.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            this.app.showNotification('Redirecting to Google...', 'info');
            
            // Use redirect method
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

    // Sign out with cleanup
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
            
            // Reset all flags
            this.notificationShown = false;
            this.redirectProcessed = false;
            this.isProcessing = false;
            
            // Show auth screen
            this.showAuthScreen();
            
            this.app.showNotification('Signed out successfully', 'success');
            
        } catch (error) {
            console.error('Error signing out:', error);
            this.app.showNotification('Error signing out: ' + error.message, 'error');
        }
    }
}
