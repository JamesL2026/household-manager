// Email/Password Authentication System (Backup Plan)
class EmailAuth {
    constructor(app) {
        this.app = app;
        this.firebase = window.firebase;
        this.isInitialized = false;
        this.notificationShown = false;
    }

    // Initialize email authentication
    async initialize() {
        if (this.isInitialized) {
            console.log('Email auth already initialized');
            return;
        }
        
        this.isInitialized = true;
        console.log('Initializing email authentication...');
        
        try {
            // Set up auth state listener
            this.firebase.onAuthStateChanged(this.firebase.auth, (user) => {
                console.log('Auth state changed:', user ? 'signed in' : 'signed out');
                
                if (user) {
                    this.handleUserSignIn(user);
                } else {
                    this.handleUserSignOut();
                }
            });
            
            // Check current user
            const currentUser = this.firebase.auth.currentUser;
            if (currentUser) {
                console.log('User already signed in');
                this.handleUserSignIn(currentUser);
            } else {
                console.log('No user signed in - showing auth screen');
                this.showAuthScreen();
            }
            
        } catch (error) {
            console.error('Error initializing email auth:', error);
            this.showAuthScreen();
        }
    }

    // Handle user sign in
    async handleUserSignIn(user) {
        try {
            console.log('Handling user sign in:', user.email);
            
            // Set user state
            this.app.currentUser = user;
            this.app.isOnline = true;
            
            // Check user in database
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // Returning user
                const userData = userDoc.data();
                this.app.householdId = userData.householdId;
                this.app.userProfile = userData.profile || this.app.userProfile;
                
                this.app.saveData('userProfile', this.app.userProfile);
                this.app.saveData('householdId', this.app.householdId);
                
                await this.app.loadHouseholdData();
                
                // Show welcome message only once
                if (!this.notificationShown) {
                    this.app.showNotification('Welcome back!', 'success');
                    this.notificationShown = true;
                }
                
            } else {
                // New user
                this.app.userProfile.name = user.displayName || user.email.split('@')[0];
                this.app.userProfile.email = user.email;
                this.app.userProfile.avatar = null;
                this.app.userProfile.color = this.app.generateRandomColor();
                
                this.app.saveData('userProfile', this.app.userProfile);
                
                // Show household code modal for new users
                setTimeout(() => {
                    this.app.showHouseholdCodeModal();
                }, 1000);
            }
            
            // Transition to app
            this.transitionToApp();
            
        } catch (error) {
            console.error('Error handling user sign in:', error);
            this.app.showNotification('Error signing in: ' + error.message, 'error');
        }
    }

    // Handle user sign out
    handleUserSignOut() {
        console.log('Handling user sign out');
        this.app.currentUser = null;
        this.app.isOnline = false;
        this.app.householdId = null;
        this.notificationShown = false;
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
    }

    // Show auth screen
    showAuthScreen() {
        console.log('Showing auth screen...');
        
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        
        if (appContainer) {
            appContainer.style.display = 'none';
        }
        
        if (authScreen) {
            authScreen.style.display = 'flex';
        }
    }

    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            console.log('Signing in with email:', email);
            
            const result = await this.firebase.signInWithEmailAndPassword(this.firebase.auth, email, password);
            console.log('Email sign in successful');
            
            this.app.showNotification('Signed in successfully!', 'success');
            
        } catch (error) {
            console.error('Email sign in error:', error);
            this.app.showNotification('Sign in failed: ' + error.message, 'error');
            throw error;
        }
    }

    // Create account with email and password
    async createAccount(email, password, displayName) {
        try {
            console.log('Creating account with email:', email);
            
            const result = await this.firebase.createUserWithEmailAndPassword(this.firebase.auth, email, password);
            
            // Update display name
            await this.firebase.updateProfile(result.user, {
                displayName: displayName
            });
            
            console.log('Account created successfully');
            this.app.showNotification('Account created successfully!', 'success');
            
        } catch (error) {
            console.error('Account creation error:', error);
            this.app.showNotification('Account creation failed: ' + error.message, 'error');
            throw error;
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
