// Firebase Firestore Database Manager
class FirestoreManager {
    constructor(firebase) {
        this.firebase = firebase;
        this.listeners = {};
    }

    async saveToFirestore(collectionName, docId, data) {
        if (!this.householdId || !this.firebase) return;

        try {
            const docRef = this.firebase.doc(this.firebase.db, 'households', this.householdId, collectionName, docId);
            
            // Add timestamp and user info
            const dataWithMeta = {
                ...data,
                updatedAt: new Date(),
                updatedBy: this.currentUser.uid
            };
            
            await this.firebase.setDoc(docRef, dataWithMeta);
            console.log('Successfully saved to Firestore:', collectionName, docId);
        } catch (error) {
            console.error('Error saving to Firestore:', error);
        }
    }

    async deleteFromFirestore(collectionName, docId) {
        if (!this.householdId) return;

        try {
            const docRef = this.firebase.doc(this.firebase.db, 'households', this.householdId, collectionName, docId);
            await this.firebase.deleteDoc(docRef);
            console.log('Successfully deleted from Firestore:', collectionName, docId);
        } catch (error) {
            console.error('Error deleting from Firestore:', error);
        }
    }

    setupFirestoreListeners(householdId, app) {
        if (!householdId) {
            console.log('No household ID, skipping Firestore listeners');
            return;
        }

        console.log('Setting up Firestore listeners for household:', householdId);

        try {
            // Set up real-time listeners for each data type
            const dataTypes = [
                { key: 'roommates', render: 'renderRoommates' },
                { key: 'chores', render: 'renderCalendar' },
                { key: 'bills', render: 'renderBills' },
                { key: 'chatMessages', render: 'renderChatMessages' },
                { key: 'laundryBookings', render: 'renderLaundrySchedule' },
                { key: 'inventoryItems', render: 'renderInventory' },
                { key: 'events', render: 'renderUpcomingEvents' },
                { key: 'polls', render: 'renderPolls' },
                { key: 'notifications', render: 'updateNotificationBadge' }
            ];
            
            for (const dataType of dataTypes) {
                const collectionRef = this.firebase.collection(this.firebase.db, 'households', householdId, dataType.key);
                
                // Remove existing listener if it exists
                if (this.listeners[dataType.key]) {
                    this.listeners[dataType.key]();
                }
                
                // Set up new listener
                this.listeners[dataType.key] = this.firebase.onSnapshot(collectionRef, (snapshot) => {
                    const dataArray = [];
                    snapshot.forEach((doc) => {
                        dataArray.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    
                    console.log(`Firestore update for ${dataType.key}:`, dataArray);
                    
                    // Update local data
                    app[dataType.key] = dataArray;
                    
                    // Save to localStorage for offline access
                    localStorage.setItem(`household_${dataType.key}`, JSON.stringify(dataArray));
                    
                    // Re-render the appropriate section
                    if (app[dataType.render]) {
                        app[dataType.render]();
                    }
                });
            }

            console.log('All Firestore listeners set up successfully');
        } catch (error) {
            console.error('Error setting up Firestore listeners:', error);
        }
    }

    cleanupListeners() {
        for (const [key, listener] of Object.entries(this.listeners)) {
            listener(); // Firestore listeners return unsubscribe functions
            console.log(`Cleaned up listener for ${key}`);
        }
        this.listeners = {};
    }
}

// Household Manager Application with Firebase Integration
class HouseholdManager {
    constructor() {
        console.log('HouseholdManager constructor called');
        
        // Firebase integration
        this.firebase = window.firebase;
        this.currentUser = null;
        this.householdId = null;
        this.isOnline = false;
        this.isGuest = false;
        
        console.log('Firebase available:', !!this.firebase);
        
        // Initialize Firestore manager
        this.firestoreManager = new FirestoreManager(this.firebase);
        
        // Clear all existing data for fresh start
        this.clearAllData();
        
        // Initialize Firebase listeners
        this.initFirebase();
        
        // Set up Firebase auth state listener
        this.setupAuthStateListener();
        
        // Handle redirect results (for popup blocker fallback)
        this.handleRedirectResult();
        
        // Also check for redirect results on page load
        this.checkForRedirectResult();
        
        // Set up mandatory authentication
        this.setupMandatoryAuth();
        
        // Initialize maintenance contact settings
        this.updateMaintenanceButton();
        this.roommates = this.loadData('roommates') || [];
        this.chores = this.loadData('chores') || [];
        this.personalTasks = this.loadData('personalTasks') || [];
        this.laundryBookings = this.loadData('laundryBookings') || [];
        this.maintenanceIssues = this.loadData('maintenanceIssues') || [];
        this.filteredMaintenanceIssues = [];
        
        // New data structures for advanced features
        this.inventoryItems = this.loadData('inventoryItems') || [];
        this.bills = this.loadData('bills') || [];
        this.events = this.loadData('events') || [];
        this.polls = this.loadData('polls') || [];
        this.chatMessages = this.loadData('chatMessages') || [];
        this.unreadChatCount = 0;
        this.choreCompletions = this.loadData('choreCompletions') || [];
        this.roommatePreferences = this.loadData('roommatePreferences') || {};
        this.notifications = this.loadData('notifications') || [];
        
        // Add default chore if none exist
        if (this.chores.length === 0) {
            this.addDefaultChore();
        }
        
        this.settings = this.loadData('settings') || {
            emailNotifications: false,
            browserNotifications: false,
            currentUserId: 'user1' // Default user for demo
        };
        
        // User profile data (independent of roommates)
        this.userProfile = this.loadData('userProfile') || {
            name: 'Alex Chen',
            email: 'alex.chen@usc.edu',
            avatar: null,
            color: this.generateRandomColor()
        };
        
        this.currentView = 'weekly';
        this.currentDate = new Date();
        this.currentWeek = new Date();
        
        // Laundry booking state
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.selectedCells = [];
        
        // Current user (for personal tasks)
        this.currentUserId = 'user1'; // Default to first user
        
        // Inventory filtering
        this.currentInventoryFilter = 'all';
        this.currentInventorySearch = '';
        
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeApp();
            });
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        this.loadAllData();
        this.setupEventListeners();
        this.renderRoommates();
        this.renderCalendar();
        this.renderChoresList();
        this.renderPersonalSchedule();
        this.renderLaundrySchedule();
        this.filteredMaintenanceIssues = [...this.maintenanceIssues];
        this.renderMaintenanceList();
        this.renderInventory();
        this.renderBills();
        this.renderEvents();
        this.updateSettings();
        this.updateProfileDisplay();
        this.requestNotificationPermission();
        
        // Initialize sample data if none exists
        this.initializeSampleData();
        this.initializeSampleNotifications();
        this.updateNotificationBadge();
        
        // Check for upcoming chores
        this.checkUpcomingChores();
        
        // Set up real-time sync simulation
        this.setupRealTimeSync();
        
        // Set up periodic chore checking (every hour)
        setInterval(() => {
            this.checkUpcomingChores();
        }, 3600000); // 1 hour
        
        // Show view controls for calendar tab (default active)
        const viewControls = document.getElementById('view-controls');
        if (viewControls) {
            viewControls.style.display = 'flex';
        }
    }

    // Data Management
    clearAllData() {
        console.log('Clearing all data for fresh start...');
        // Clear localStorage
        const keysToRemove = [
            'household_roommates',
            'household_chores', 
            'household_bills',
            'household_inventoryItems',
            'household_events',
            'household_polls',
            'household_chatMessages',
            'household_notifications',
            'household_laundryBookings',
            'household_maintenanceIssues',
            'household_personalTasks',
            'household_userProfile',
            'household_settings',
            'pending_sync'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log('All data cleared for fresh start');
    }

    addDefaultChore() {
        console.log('Adding default chore: Take out trash');
        const defaultChore = {
            id: 'chore-' + Date.now(),
            name: 'Take out trash',
            frequency: 'weekly',
            assignedTo: 'user1',
            duration: 15,
            startDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            completed: false
        };
        
        this.chores = [defaultChore];
        this.saveData('chores', this.chores);
        console.log('Default chore added:', defaultChore);
    }

    async saveData(key, data) {
        console.log('Saving data:', key, data);
        
        // Always save to localStorage for persistence
        localStorage.setItem(`household_${key}`, JSON.stringify(data));
        
        // If user is authenticated and online, save to Firebase
        if (this.currentUser && this.isOnline && this.householdId) {
            console.log('Saving to Firebase:', key);
            try {
                await this.saveToFirebase(key, data);
                console.log('Successfully saved to Firebase:', key);
                
                // Log analytics event
                this.firebase.logEvent(this.firebase.analytics, 'data_saved', {
                    data_type: key,
                    user_id: this.currentUser.uid,
                    household_id: this.householdId
                });
            } catch (error) {
                console.error('Error saving to Firebase:', error);
                // Mark data for sync when back online
                this.markForSync(key, data);
            }
        } else {
            console.log('Not saving to Firebase - User:', !!this.currentUser, 'Online:', this.isOnline, 'Household:', this.householdId);
            // Mark data for sync when back online
            this.markForSync(key, data);
        }
        
        // Simulate real-time sync by broadcasting changes
        this.broadcastChange(key, data);
    }

    // Enhanced data loading with persistence
    loadData(key) {
        const data = localStorage.getItem(`household_${key}`);
        if (data) {
            try {
                return JSON.parse(data);
            } catch (error) {
                console.error('Error parsing stored data:', error);
                return null;
            }
        }
        return null;
    }

    // Auto-save all data when user logs in
    async autoSaveAllData() {
        console.log('Auto-saving all data for persistence...');
        
        const dataKeys = [
            'userProfile',
            'roommates', 
            'chores',
            'bills',
            'inventoryItems',
            'events',
            'polls',
            'chatMessages',
            'notifications',
            'laundryBookings',
            'maintenanceIssues',
            'personalTasks'
        ];
        
        for (const key of dataKeys) {
            const data = this[key];
            if (data && Array.isArray(data) ? data.length > 0 : data) {
                await this.saveData(key, data);
            }
        }
        
        console.log('Auto-save completed');
    }

    markForSync(key, data) {
        // Store data that needs to be synced when back online
        const pendingSync = JSON.parse(localStorage.getItem('pending_sync') || '{}');
        pendingSync[key] = data;
        localStorage.setItem('pending_sync', JSON.stringify(pendingSync));
    }

    async syncPendingData() {
        const pendingSync = JSON.parse(localStorage.getItem('pending_sync') || '{}');
        if (Object.keys(pendingSync).length > 0) {
            console.log('Syncing pending data:', Object.keys(pendingSync));
            for (const [key, data] of Object.entries(pendingSync)) {
                try {
                    await this.saveToFirebase(key, data);
                    console.log('Synced pending data:', key);
                } catch (error) {
                    console.error('Error syncing pending data:', key, error);
                }
            }
            localStorage.removeItem('pending_sync');
        }
    }

    loadData(key) {
        const data = localStorage.getItem(`household_${key}`);
        return data ? JSON.parse(data) : null;
    }

    loadAllData() {
        // Load all data from localStorage
        this.roommates = this.loadData('roommates') || [];
        this.chores = this.loadData('chores') || [];
        this.laundryBookings = this.loadData('laundryBookings') || [];
        this.maintenanceIssues = this.loadData('maintenanceIssues') || [];
        this.inventoryItems = this.loadData('inventoryItems') || [];
        this.bills = this.loadData('bills') || [];
        this.events = this.loadData('events') || [];
        this.polls = this.loadData('polls') || [];
        this.chatMessages = this.loadData('chatMessages') || [];
        this.choreCompletions = this.loadData('choreCompletions') || [];
        this.roommatePreferences = this.loadData('roommatePreferences') || [];
        this.notifications = this.loadData('notifications') || [];
        this.settings = this.loadData('settings') || {
            currentUserId: 'user1',
            emailNotifications: true,
            browserNotifications: true
        };
        this.personalTasks = this.loadData('personalTasks') || [];
        this.filteredMaintenanceIssues = [...this.maintenanceIssues];
        this.filteredBills = null;
    }

    // Real-time sync simulation
    setupRealTimeSync() {
        // Listen for storage changes (simulates other users making changes)
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('household_')) {
                const key = e.key.replace('household_', '');
                this.handleDataChange(key, e.newValue);
            }
        });

        // Simulate periodic sync (every 5 seconds)
        setInterval(() => {
            this.syncWithServer();
        }, 5000);
    }

    broadcastChange(key, data) {
        // In a real app, this would send data to a server
        // For now, we'll just log it
        console.log(`Broadcasting change for ${key}:`, data);
    }

    handleDataChange(key, newValue) {
        const data = newValue ? JSON.parse(newValue) : null;
        
        switch (key) {
            case 'roommates':
                this.roommates = data || [];
                this.renderRoommates();
                this.updateProfileDisplay();
                break;
            case 'chores':
                this.chores = data || [];
                this.renderCalendar();
                this.renderChoresList();
                this.renderPersonalSchedule();
                break;
            case 'laundryBookings':
                this.laundryBookings = data || [];
                this.renderLaundrySchedule();
                this.renderPersonalSchedule();
                break;
            case 'maintenanceIssues':
                this.maintenanceIssues = data || [];
                this.filteredMaintenanceIssues = [...this.maintenanceIssues];
                this.renderMaintenanceList();
                break;
            case 'bills':
                this.bills = data || [];
                this.renderBills();
                break;
            case 'notifications':
                this.notifications = data || [];
                this.updateNotificationBadge();
                break;
        }
    }

    syncWithServer() {
        // In a real app, this would fetch latest data from server
        // For now, we'll just ensure data is saved
        this.saveData('roommates', this.roommates);
        this.saveData('chores', this.chores);
        this.saveData('laundryBookings', this.laundryBookings);
        this.saveData('maintenanceIssues', this.maintenanceIssues);
        this.saveData('bills', this.bills);
        this.saveData('notifications', this.notifications);
    }

    // Event Listeners
    setupEventListeners() {
        // Navigation - Sidebar (use event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.nav-item')) {
                const navItem = e.target.closest('.nav-item');
                const tabName = navItem.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            }
        });

        // View Controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Calendar Navigation
        document.getElementById('prev-period').addEventListener('click', () => this.navigatePeriod(-1));
        document.getElementById('next-period').addEventListener('click', () => this.navigatePeriod(1));

        // Laundry Navigation
        document.getElementById('prev-week').addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('next-week').addEventListener('click', () => this.navigateWeek(1));

        // Laundry Reservation
        document.getElementById('reserve-laundry-btn').addEventListener('click', () => this.openLaundryBookingModal());
        document.getElementById('clear-selection').addEventListener('click', () => this.clearSelection());

        // Modal Controls
        this.setupModalListeners();

        // Maintenance
        document.getElementById('add-maintenance-btn').addEventListener('click', () => this.openModal('add-maintenance-modal'));
        document.getElementById('save-maintenance').addEventListener('click', () => this.saveMaintenanceIssue());
        document.getElementById('cancel-maintenance').addEventListener('click', () => this.closeModal('add-maintenance-modal'));
        document.getElementById('save-edit-maintenance').addEventListener('click', () => this.saveEditMaintenance());
        document.getElementById('delete-maintenance').addEventListener('click', () => this.deleteMaintenanceIssue());
        document.getElementById('cancel-edit-maintenance').addEventListener('click', () => this.closeModal('edit-maintenance-modal'));
        document.getElementById('status-filter').addEventListener('change', (e) => this.filterMaintenanceIssues(e.target.value));

        // Inventory
        document.getElementById('add-item-btn').addEventListener('click', () => this.openModal('add-item-modal'));
        document.getElementById('save-item').addEventListener('click', () => this.saveInventoryItem());
        document.getElementById('cancel-item').addEventListener('click', () => this.closeModal('add-item-modal'));
        document.getElementById('category-filter').addEventListener('change', (e) => this.filterInventory(e.target.value));
        document.getElementById('search-items').addEventListener('input', (e) => this.searchInventory(e.target.value));
        document.getElementById('low-stock-btn').addEventListener('click', () => this.showLowStockItems());
        document.getElementById('out-of-stock-btn').addEventListener('click', () => this.showOutOfStockItems());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearInventoryFilters());

        // Bills
        document.getElementById('add-bill-btn').addEventListener('click', () => this.openModal('add-bill-modal'));
        document.getElementById('save-bill').addEventListener('click', () => this.saveBill());
        document.getElementById('cancel-bill').addEventListener('click', () => this.closeModal('add-bill-modal'));
        document.getElementById('bill-split-type').addEventListener('change', (e) => this.updateBillSplitType(e.target.value));
        document.getElementById('bill-status-filter').addEventListener('change', (e) => this.filterBills(e.target.value));
        document.getElementById('bill-period-filter').addEventListener('change', (e) => this.filterBillsByPeriod(e.target.value));
        document.getElementById('bills-search-btn').addEventListener('click', () => this.searchBills());
        document.getElementById('bills-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchBills();
        });
        document.getElementById('bills-search-input').addEventListener('input', (e) => {
            if (e.target.value === '') this.searchBills();
        });

        // Events
        document.getElementById('create-event-btn').addEventListener('click', () => this.openModal('create-event-modal'));
        document.getElementById('create-poll-btn').addEventListener('click', () => this.openModal('create-poll-modal'));
        document.getElementById('save-event').addEventListener('click', () => this.saveEvent());
        document.getElementById('cancel-event').addEventListener('click', () => this.closeModal('create-event-modal'));
        document.getElementById('save-poll').addEventListener('click', () => this.savePoll());
        document.getElementById('cancel-poll').addEventListener('click', () => this.closeModal('create-poll-modal'));

        // Event tabs
        document.querySelectorAll('.event-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchEventTab(e.target.dataset.eventTab));
        });


        // Profile Photo Upload
        document.getElementById('user-profile').addEventListener('click', () => this.openProfileModal());
        document.getElementById('photo-upload-area').addEventListener('click', () => document.getElementById('photo-input').click());
        document.getElementById('photo-input').addEventListener('change', (e) => this.handlePhotoUpload(e));
        document.getElementById('remove-photo').addEventListener('click', () => this.removePhoto());
        document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('cancel-profile').addEventListener('click', () => this.closeModal('profile-photo-modal'));

        // Quick Actions (use event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.quick-btn')) {
                const quickBtn = e.target.closest('.quick-btn');
                const tab = quickBtn.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            }
        });

        // Chat button
        document.getElementById('chat-btn').addEventListener('click', () => {
            this.toggleChatPanel();
        });

        // Chat close button
        document.getElementById('chat-close').addEventListener('click', () => {
            this.closeChatPanel();
        });

        // Chat send button and input
        document.getElementById('chat-send-btn').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Chat search functionality
        document.getElementById('chat-search-btn').addEventListener('click', () => {
            this.searchChatMessages();
        });

        document.getElementById('chat-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchChatMessages();
            }
        });

        document.getElementById('chat-search').addEventListener('input', (e) => {
            if (e.target.value === '') {
                this.renderChatMessages();
            }
        });

        // Chore details modal
        document.getElementById('edit-chore-from-details').addEventListener('click', () => {
            this.closeModal('chore-details-modal');
            this.editChore(this.currentChoreId);
        });

        document.getElementById('delete-chore-from-details').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this chore?')) {
                this.chores = this.chores.filter(c => c.id !== this.currentChoreId);
                this.saveData('chores', this.chores);
                this.renderCalendar();
                this.renderChoresList();
                this.renderPersonalSchedule();
                this.closeModal('chore-details-modal');
                this.showNotification('Chore deleted successfully!', 'success');
            }
        });


        // Notifications button
        document.getElementById('notifications-btn').addEventListener('click', () => {
            this.showNotificationsPanel();
        });

        // Settings
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('import-data').addEventListener('click', () => this.importData());
        document.getElementById('email-notifications').addEventListener('change', (e) => this.updateSetting('emailNotifications', e.target.checked));
        document.getElementById('browser-notifications').addEventListener('change', (e) => this.updateSetting('browserNotifications', e.target.checked));
    }

    setupModalListeners() {
        // Add Roommate Modal
        document.getElementById('add-roommate-btn').addEventListener('click', () => this.openModal('add-roommate-modal'));
        document.getElementById('save-roommate').addEventListener('click', () => this.saveRoommate());
        document.getElementById('cancel-roommate').addEventListener('click', () => this.closeModal('add-roommate-modal'));

        // Add Chore Modal (Calendar)
        document.getElementById('add-chore-btn').addEventListener('click', () => this.openModal('add-chore-modal'));
        document.getElementById('save-chore').addEventListener('click', () => this.saveChore());
        document.getElementById('cancel-chore').addEventListener('click', () => this.closeModal('add-chore-modal'));

        // Add Chore Modal (Management) - Multiple approaches for reliability
        // Approach 1: Direct event listener
        setTimeout(() => {
            const addChoreManageBtn = document.getElementById('add-chore-manage-btn');
            if (addChoreManageBtn) {
                addChoreManageBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openModal('add-chore-modal');
                });
            } else {
                console.error('Add chore manage button not found');
            }
        }, 100);
        
        // Approach 2: Event delegation as backup
        document.addEventListener('click', (e) => {
            if (e.target.id === 'add-chore-manage-btn' || e.target.closest('#add-chore-manage-btn')) {
                this.openModal('add-chore-modal');
            }
        });
        

        // Edit Chore Modal
        document.getElementById('save-edit-chore').addEventListener('click', () => this.saveEditChore());
        document.getElementById('delete-chore').addEventListener('click', () => this.deleteChore());
        document.getElementById('cancel-edit-chore').addEventListener('click', () => this.closeModal('edit-chore-modal'));


        // Personal Task Modal
        document.getElementById('add-personal-chore-btn').addEventListener('click', () => this.openModal('add-personal-chore-modal'));
        document.getElementById('save-personal-chore').addEventListener('click', () => this.savePersonalTask());
        document.getElementById('cancel-personal-chore').addEventListener('click', () => this.closeModal('add-personal-chore-modal'));

        // Book Laundry from Personal
        document.getElementById('book-laundry-personal-btn').addEventListener('click', () => this.switchTab('laundry'));

        // Book Laundry Modal
        document.getElementById('save-laundry').addEventListener('click', () => this.saveLaundryBooking());
        document.getElementById('cancel-laundry').addEventListener('click', () => this.closeModal('book-laundry-modal'));

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Close modals on close button
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal').id);
            });
        });
    }

    // Navigation
    switchTab(tabName) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected nav item
        const selectedNavItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedNavItem) {
            selectedNavItem.classList.add('active');
        }
        
        // Add active class to selected tab content
        const selectedTabContent = document.getElementById(tabName);
        if (selectedTabContent) {
            selectedTabContent.classList.add('active');
        }

        // Show/hide view controls based on tab
        const viewControls = document.getElementById('view-controls');
        if (tabName === 'calendar') {
            viewControls.style.display = 'flex';
        } else {
            viewControls.style.display = 'none';
        }

        if (tabName === 'laundry') {
            this.renderLaundrySchedule();
            this.updateLaundryStatus();
        } else if (tabName === 'personal') {
            this.renderPersonalSchedule();
            this.updatePersonalScheduleTitle();
        } else if (tabName === 'chores') {
            this.renderChoresList();
        } else if (tabName === 'maintenance') {
            this.renderMaintenanceList();
        } else if (tabName === 'inventory') {
            this.renderInventory();
        } else if (tabName === 'bills') {
            this.renderBills();
        } else if (tabName === 'events') {
            this.renderEvents();
        }
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        // Update calendar title based on view
        const titleElement = document.querySelector('#calendar h2');
        if (titleElement) {
            switch(view) {
                case 'daily':
                    titleElement.textContent = 'Daily Calendar';
                    break;
                case 'weekly':
                    titleElement.textContent = 'Weekly Calendar';
                    break;
                case 'monthly':
                    titleElement.textContent = 'Monthly Calendar';
                    break;
            }
        }
        
        this.renderCalendar();
    }

    // Roommate Management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        } else {
            console.error('Modal not found:', modalId);
        }
        
        if (modalId === 'add-chore-modal' || modalId === 'edit-chore-modal') {
            this.populateUserSelects();
            // Set default start date to today for new chores
            if (modalId === 'add-chore-modal') {
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('chore-start-date').value = today;
            }
        } else if (modalId === 'book-laundry-modal') {
            // Set current user for laundry booking
            const currentUser = this.roommates.find(r => r.id === this.settings.currentUserId);
            if (currentUser) {
                document.getElementById('laundry-user').value = currentUser.name;
            }
        } else if (modalId === 'add-maintenance-modal') {
            this.populateReporterSelect();
        } else if (modalId === 'add-item-modal') {
            this.populatePurchasedBySelect();
        } else if (modalId === 'add-bill-modal') {
            this.populatePaidBySelect();
        } else if (modalId === 'create-event-modal' || modalId === 'create-poll-modal') {
            this.populateCreatorSelect();
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        this.clearModalForms();
        this.clearSelection();
    }

    populateUserSelects() {
        const selects = ['chore-assigned', 'edit-chore-assigned'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // For chore selects, add Random option first
                if (selectId.includes('chore-assigned')) {
                    select.innerHTML = '<option value="random">🎲 Random (Fair Rotation)</option>';
                } else {
                    select.innerHTML = '<option value="">Select a roommate</option>';
                }
                
                this.roommates.forEach(roommate => {
                    const option = document.createElement('option');
                    option.value = roommate.id;
                    option.textContent = roommate.name;
                    select.appendChild(option);
                });
            }
        });
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#FF8C00', '#FFD700', '#32CD32', '#00CED1',
            '#1E90FF', '#8A2BE2', '#FF1493', '#FF4500', '#00FF7F'
        ];
        
        // Get used colors
        const usedColors = this.roommates.map(r => r.color).filter(c => c);
        
        // Find available colors
        const availableColors = colors.filter(c => !usedColors.includes(c));
        
        // Return random available color or fallback to random color
        return availableColors.length > 0 ? 
            availableColors[Math.floor(Math.random() * availableColors.length)] :
            colors[Math.floor(Math.random() * colors.length)];
    }

    saveRoommate() {
        const name = document.getElementById('roommate-name').value;
        const email = document.getElementById('roommate-email').value;
        const color = document.getElementById('roommate-color').value || this.generateRandomColor();

        if (!name) {
            this.showNotification('Please enter a name', 'error');
            return;
        }

        const roommate = {
            id: Date.now().toString(),
            name,
            email,
            color,
            createdAt: new Date().toISOString()
        };

        this.roommates.push(roommate);
        this.saveData('roommates', this.roommates);
        this.renderRoommates();
        this.closeModal('add-roommate-modal');
        this.showNotification('Roommate added successfully!', 'success');
    }

    deleteRoommate(id) {
        if (confirm('Are you sure you want to remove this roommate?')) {
            this.roommates = this.roommates.filter(r => r.id !== id);
            this.chores = this.chores.filter(c => c.assignedTo !== id);
            this.laundryBookings = this.laundryBookings.filter(l => l.userId !== id);
            
            this.saveData('roommates', this.roommates);
            this.saveData('chores', this.chores);
            this.saveData('laundryBookings', this.laundryBookings);
            
            this.renderRoommates();
            this.renderCalendar();
            this.renderChoresList();
            this.renderPersonalSchedule();
            this.renderLaundrySchedule();
            this.showNotification('Roommate removed successfully!', 'success');
        }
    }

    renderRoommates() {
        const container = document.getElementById('roommates-list');
        container.innerHTML = '';

        if (this.roommates.length === 0) {
            container.innerHTML = '<p class="text-center">No roommates added yet. Click "Add Roommate" to get started!</p>';
            return;
        }

        this.roommates.forEach(roommate => {
            const card = document.createElement('div');
            card.className = 'roommate-card';
            card.style.backgroundColor = roommate.color;
            card.style.color = 'white';
            card.style.borderRadius = '8px';
            card.style.padding = '16px';
            
            card.innerHTML = `
                <div class="roommate-name" style="color: white; font-weight: 600; font-size: 16px; margin-bottom: 8px;">${roommate.name}</div>
                ${roommate.email ? `<div class="roommate-email" style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin-bottom: 12px;">${roommate.email}</div>` : ''}
                <div class="roommate-actions">
                    <button class="btn btn-secondary btn-small" onclick="app.openRoommateProfile('${roommate.id}')" title="Edit ${roommate.id === this.settings.currentUserId ? 'your profile' : 'roommate info'}" style="background: #4CAF50; color: white; border: 1px solid #45a049; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="app.deleteRoommate('${roommate.id}')" title="Remove roommate" style="background: #f44336; color: white; border: 1px solid #d32f2f; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // Chore Management
    saveChore() {
        const name = document.getElementById('chore-name').value;
        const frequency = document.getElementById('chore-frequency').value;
        const assignedTo = document.getElementById('chore-assigned').value;
        const startDate = document.getElementById('chore-start-date').value;
        const duration = parseInt(document.getElementById('chore-duration').value);

        if (!name || !assignedTo || !startDate) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Handle random assignment
        let finalAssignedTo = assignedTo;
        if (assignedTo === 'random') {
            finalAssignedTo = this.getFairRandomAssignment(frequency);
        }

        const chore = {
            id: Date.now().toString(),
            name,
            frequency,
            assignedTo: finalAssignedTo,
            startDate,
            duration,
            createdAt: new Date().toISOString()
        };

        this.chores.push(chore);
        this.saveData('chores', this.chores);
        this.renderCalendar();
        this.renderChoresList();
        this.renderPersonalSchedule();
        this.closeModal('add-chore-modal');
        this.showNotification('Chore added successfully!', 'success');
        
        // Add notification for chore assignment
        const assignedRoommate = this.roommates.find(r => r.id === finalAssignedTo);
        if (assignedRoommate) {
            this.addNotification(
                'New Chore Assignment',
                `${assignedRoommate.name} has been assigned "${name}" (${frequency})`,
                'fa-broom',
                'assignment'
            );
        }
    }

    renderChoresList() {
        const container = document.getElementById('chores-list');
        container.innerHTML = '';

        if (this.chores.length === 0) {
            container.innerHTML = '<p class="text-center">No chores added yet. Click "Add Chore" to get started!</p>';
            return;
        }

        this.chores.forEach(chore => {
            const roommate = this.roommates.find(r => r.id === chore.assignedTo);
            const card = document.createElement('div');
            card.className = 'chore-item-card';
            
            card.innerHTML = `
                <div class="chore-item-header">
                    <div class="chore-item-name">${chore.name}</div>
                    <div class="chore-item-actions">
                        <button class="btn btn-small btn-secondary" onclick="app.editChore('${chore.id}')" title="Edit chore">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteChoreDirect('${chore.id}')" title="Delete chore">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
                <div class="chore-item-details">
                    <div class="chore-detail">
                        <div class="chore-detail-label">Frequency</div>
                        <div class="chore-detail-value">${chore.frequency.charAt(0).toUpperCase() + chore.frequency.slice(1)}</div>
                    </div>
                    <div class="chore-detail">
                        <div class="chore-detail-label">Assigned To</div>
                        <div class="chore-detail-value">
                            <div class="chore-assignee">
                                <div class="chore-assignee-color" style="background-color: ${roommate ? roommate.color : '#1a73e8'}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 8px;">
                                    ${roommate ? (roommate.id === this.settings.currentUserId ? this.userProfile.name : roommate.name).charAt(0).toUpperCase() : '?'}
                                </div>
                                ${roommate ? (roommate.id === this.settings.currentUserId ? this.userProfile.name : roommate.name) + (roommate.id === this.settings.currentUserId ? ' (YOU)' : '') : 'Unknown'}
                            </div>
                        </div>
                    </div>
                    <div class="chore-detail">
                        <div class="chore-detail-label">Duration</div>
                        <div class="chore-detail-value">${chore.duration} minutes</div>
                    </div>
                    <div class="chore-detail">
                        <div class="chore-detail-label">Created</div>
                        <div class="chore-detail-value">${this.formatDate(new Date(chore.createdAt))}</div>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    editChore(choreId) {
        const chore = this.chores.find(c => c.id === choreId);
        if (!chore) return;

        document.getElementById('edit-chore-name').value = chore.name;
        document.getElementById('edit-chore-frequency').value = chore.frequency;
        document.getElementById('edit-chore-assigned').value = chore.assignedTo;
        document.getElementById('edit-chore-start-date').value = chore.startDate || '';
        document.getElementById('edit-chore-duration').value = chore.duration;
        
        
        // Store chore ID for saving
        document.getElementById('edit-chore-modal').dataset.choreId = choreId;
        
        this.openModal('edit-chore-modal');
    }

    saveEditChore() {
        const choreId = document.getElementById('edit-chore-modal').dataset.choreId;
        const chore = this.chores.find(c => c.id === choreId);
        if (!chore) return;

        const assignedTo = document.getElementById('edit-chore-assigned').value;
        
        // Handle random assignment
        let finalAssignedTo = assignedTo;
        if (assignedTo === 'random') {
            finalAssignedTo = this.getFairRandomAssignment(chore.frequency);
        }

        chore.name = document.getElementById('edit-chore-name').value;
        chore.frequency = document.getElementById('edit-chore-frequency').value;
        chore.assignedTo = finalAssignedTo;
        chore.startDate = document.getElementById('edit-chore-start-date').value;
        chore.duration = parseInt(document.getElementById('edit-chore-duration').value);

        this.saveData('chores', this.chores);
        this.renderCalendar();
        this.renderChoresList();
        this.renderPersonalSchedule();
        this.closeModal('edit-chore-modal');
        this.showNotification('Chore updated successfully!', 'success');
    }

    deleteChore() {
        const choreId = document.getElementById('edit-chore-modal').dataset.choreId;
        if (!choreId) return;

        if (confirm('Are you sure you want to delete this chore?')) {
            this.chores = this.chores.filter(c => c.id !== choreId);
            this.saveData('chores', this.chores);
            this.renderCalendar();
            this.renderChoresList();
            this.renderPersonalSchedule();
            this.closeModal('edit-chore-modal');
            this.showNotification('Chore deleted successfully!', 'success');
        }
    }

    deleteChoreDirect(choreId) {
        if (confirm('Are you sure you want to delete this chore?')) {
            this.chores = this.chores.filter(c => c.id !== choreId);
            this.saveData('chores', this.chores);
            this.renderCalendar();
            this.renderChoresList();
            this.renderPersonalSchedule();
            this.showNotification('Chore deleted successfully!', 'success');
        }
    }

    getFairRandomAssignment(frequency) {
        if (this.roommates.length === 0) return null;
        
        // For weekly chores, use fair rotation based on assignment history
        if (frequency === 'weekly') {
            return this.getFairWeeklyAssignment();
        }
        
        // For other frequencies, use simple random assignment
        const randomIndex = Math.floor(Math.random() * this.roommates.length);
        return this.roommates[randomIndex].id;
    }

    getFairWeeklyAssignment() {
        // Count how many weekly chores each roommate has
        const weeklyChoreCounts = {};
        this.roommates.forEach(roommate => {
            weeklyChoreCounts[roommate.id] = this.chores.filter(chore => 
                chore.frequency === 'weekly' && chore.assignedTo === roommate.id
            ).length;
        });
        
        // Find the roommate(s) with the fewest weekly chores
        const minCount = Math.min(...Object.values(weeklyChoreCounts));
        const leastAssignedRoommates = this.roommates.filter(roommate => 
            weeklyChoreCounts[roommate.id] === minCount
        );
        
        // Randomly select from the least assigned roommates
        const randomIndex = Math.floor(Math.random() * leastAssignedRoommates.length);
        return leastAssignedRoommates[randomIndex].id;
    }

    // Laundry hover highlighting functions
    highlightBooking(day, hour) {
        const booking = this.getBookingForTime(day, hour);
        if (!booking) return;
        
        // Find all cells that belong to this booking
        const startTime = new Date(booking.startTime);
        const endTime = new Date(booking.endTime);
        const startHour = startTime.getHours();
        const endHour = endTime.getHours();
        
        // Highlight all cells in this booking
        for (let h = startHour; h < endHour; h++) {
            const cell = document.querySelector(`[data-hour="${h}"][data-date="${day.toISOString().split('T')[0]}"]`);
            if (cell) {
                cell.classList.add('highlighted');
            }
        }
    }

    clearBookingHighlight() {
        // Remove highlighting from all cells
        document.querySelectorAll('.time-cell.highlighted').forEach(cell => {
            cell.classList.remove('highlighted');
        });
    }

    updateLaundryStatus() {
        const now = new Date();
        const washerStatus = document.getElementById('washer-status');
        const dryerStatus = document.getElementById('dryer-status');
        
        if (!washerStatus || !dryerStatus) return;
        
        // Check if washer is currently in use
        const washerInUse = this.laundryBookings.some(booking => {
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            return booking.type === 'washer' && now >= startTime && now < endTime;
        });
        
        // Check if dryer is currently in use
        const dryerInUse = this.laundryBookings.some(booking => {
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            return booking.type === 'dryer' && now >= startTime && now < endTime;
        });
        
        // Update washer status
        washerStatus.className = `status-dot ${washerInUse ? 'occupied' : 'available'}`;
        washerStatus.parentElement.querySelector('span').textContent = 
            washerInUse ? 'Washer In Use' : 'Washer Available';
        
        // Update dryer status
        dryerStatus.className = `status-dot ${dryerInUse ? 'occupied' : 'available'}`;
        dryerStatus.parentElement.querySelector('span').textContent = 
            dryerInUse ? 'Dryer In Use' : 'Dryer Available';
    }

    // Personal Task Management
    savePersonalTask() {
        const name = document.getElementById('personal-chore-name').value;
        const date = document.getElementById('personal-chore-date').value;
        const time = document.getElementById('personal-chore-time').value;
        const notes = document.getElementById('personal-chore-notes').value;

        if (!name || !date) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const task = {
            id: Date.now().toString(),
            name,
            date,
            time,
            notes,
            userId: this.currentUserId,
            createdAt: new Date().toISOString()
        };

        this.personalTasks.push(task);
        this.saveData('personalTasks', this.personalTasks);
        this.renderPersonalSchedule();
        this.closeModal('add-personal-chore-modal');
        this.showNotification('Personal task added successfully!', 'success');
    }

    completePersonalTask(taskId) {
        const task = this.personalTasks.find(t => t.id === taskId);
        if (task) {
            this.personalTasks = this.personalTasks.filter(t => t.id !== taskId);
            this.saveData('personalTasks', this.personalTasks);
            this.renderPersonalSchedule();
            this.showNotification('Personal task completed!', 'success');
        }
    }

    deletePersonalTask(taskId) {
        if (confirm('Are you sure you want to delete this personal task?')) {
            this.personalTasks = this.personalTasks.filter(t => t.id !== taskId);
            this.saveData('personalTasks', this.personalTasks);
            this.renderPersonalSchedule();
            this.showNotification('Personal task deleted!', 'success');
        }
    }

    renderPersonalSchedule() {
        this.renderPersonalChores();
        this.renderPersonalLaundry();
    }

    renderPersonalChores() {
        const container = document.getElementById('personal-chores');
        const myChores = this.chores.filter(chore => chore.assignedTo === this.currentUserId);
        const myPersonalTasks = this.personalTasks.filter(task => task.userId === this.currentUserId);
        
        container.innerHTML = '';

        // Show assigned chores
        if (myChores.length > 0) {
        myChores.forEach(chore => {
            const item = document.createElement('div');
            item.className = 'personal-item';
            
            item.innerHTML = `
                <div class="personal-item-info">
                    <div class="personal-item-name">${chore.name}</div>
                    <div class="personal-item-details">
                        ${chore.frequency.charAt(0).toUpperCase() + chore.frequency.slice(1)} • ${chore.duration} minutes
                    </div>
                </div>
                <div class="personal-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.editChore('${chore.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(item);
        });
        }

        // Show personal tasks
        if (myPersonalTasks.length > 0) {
            myPersonalTasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'personal-item personal-task';
                
                const taskDate = new Date(task.date);
                const formattedDate = taskDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                });
                
                item.innerHTML = `
                    <div class="personal-item-info">
                        <div class="personal-item-name">${task.name}</div>
                        <div class="personal-item-details">
                            ${formattedDate}${task.time ? ' • ' + task.time : ''}
                            ${task.notes ? ' • ' + task.notes : ''}
                        </div>
                    </div>
                    <div class="personal-item-actions">
                        <button class="btn btn-small btn-success" onclick="app.completePersonalTask('${task.id}')" title="Mark as completed">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="app.deletePersonalTask('${task.id}')" title="Delete task">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                container.appendChild(item);
            });
        }

        // Show message if no tasks
        if (myChores.length === 0 && myPersonalTasks.length === 0) {
            container.innerHTML = '<p class="text-center">No chores or personal tasks yet.</p>';
        }
    }

    renderPersonalLaundry() {
        const container = document.getElementById('personal-laundry');
        const myBookings = this.laundryBookings.filter(booking => booking.userId === this.currentUserId);
        
        container.innerHTML = '';

        if (myBookings.length === 0) {
            container.innerHTML = '<p class="text-center">No laundry bookings yet.</p>';
            return;
        }

        myBookings.forEach(booking => {
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            
            const item = document.createElement('div');
            item.className = 'personal-item';
            
            item.innerHTML = `
                <div class="personal-item-info">
                    <div class="personal-item-name">Laundry Booking</div>
                    <div class="personal-item-details">
                        ${this.formatDate(startTime)} • ${this.formatTime(startTime)} - ${this.formatTime(endTime)}
                        ${booking.notes ? ` • ${booking.notes}` : ''}
                    </div>
                </div>
                <div class="personal-item-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.rescheduleLaundryBooking('${booking.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="app.cancelLaundryBooking('${booking.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    rescheduleLaundryBooking(bookingId) {
        const booking = this.laundryBookings.find(b => b.id === bookingId);
        if (!booking) return;

        // Pre-fill the form with current booking data
        const startTime = new Date(booking.startTime);
        const endTime = new Date(booking.endTime);
        
        document.getElementById('laundry-date').value = startTime.toISOString().split('T')[0];
        document.getElementById('laundry-start-time').value = this.formatTimeForInput(startTime.getHours(), startTime.getMinutes());
        document.getElementById('laundry-end-time').value = this.formatTimeForInput(endTime.getHours(), endTime.getMinutes());
        document.getElementById('laundry-user').value = booking.userId;
        document.getElementById('laundry-notes').value = booking.notes || '';
        
        // Store booking ID for updating
        document.getElementById('book-laundry-modal').dataset.bookingId = bookingId;
        
        this.openModal('book-laundry-modal');
    }

    cancelLaundryBooking(bookingId) {
        if (confirm('Are you sure you want to cancel this laundry booking?')) {
            this.laundryBookings = this.laundryBookings.filter(b => b.id !== bookingId);
            this.saveData('laundryBookings', this.laundryBookings);
            this.renderPersonalSchedule();
            this.renderLaundrySchedule();
            this.showNotification('Laundry booking cancelled!', 'success');
        }
    }

    // Random Assignment
    openRandomAssignModal() {
        const unassignedChores = this.chores.filter(chore => !chore.assignedTo);
        
        if (unassignedChores.length === 0) {
            this.showNotification('No unassigned chores to randomly assign', 'info');
            return;
        }

        if (this.roommates.length === 0) {
            this.showNotification('No roommates available for assignment', 'error');
            return;
        }

        this.openModal('random-assign-modal');
        this.previewRandomAssignment();
    }

    previewRandomAssignment() {
        const unassignedChores = this.chores.filter(chore => !chore.assignedTo);
        const availableRoommates = [...this.roommates];
        
        const preview = unassignedChores.map(chore => {
            const randomIndex = Math.floor(Math.random() * availableRoommates.length);
            const assignedRoommate = availableRoommates[randomIndex];
            
            return {
                chore: chore,
                roommate: assignedRoommate
            };
        });

        const container = document.getElementById('assignment-preview');
        container.innerHTML = '';

        preview.forEach(item => {
            const assignmentItem = document.createElement('div');
            assignmentItem.className = 'assignment-item';
            assignmentItem.innerHTML = `
                <div class="assignment-chore">${item.chore.name}</div>
                <div class="assignment-assignee" style="color: ${item.roommate.color}">→ ${item.roommate.name}</div>
            `;
            container.appendChild(assignmentItem);
        });
    }


    // Calendar Rendering
    renderCalendar() {
        const container = document.getElementById('calendar-grid');
        const periodElement = document.getElementById('current-period');
        
        container.className = `calendar-grid ${this.currentView}`;
        
        let days = [];
        let periodTitle = '';

        switch (this.currentView) {
            case 'daily':
                days = [this.currentDate];
                periodTitle = this.formatDate(this.currentDate);
                break;
            case 'weekly':
                days = this.getWeekDays(this.currentDate);
                periodTitle = `Week of ${this.formatDate(days[0])}`;
                break;
            case 'monthly':
                days = this.getMonthDays(this.currentDate);
                periodTitle = this.formatDate(this.currentDate, { month: 'long', year: 'numeric' });
                break;
        }

        periodElement.textContent = periodTitle;
        container.innerHTML = '';

        days.forEach(day => {
            const dayElement = this.createDayElement(day);
            container.appendChild(dayElement);
        });
    }

    createDayElement(date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const isToday = this.isSameDay(date, new Date());
        if (isToday) {
            dayElement.classList.add('today');
        }

        const dayName = this.formatDate(date, { weekday: 'short' });
        const dayNumber = date.getDate();
        
        dayElement.innerHTML = `
            <div class="calendar-day-header">${dayName}</div>
            <div class="calendar-day-number">${dayNumber}</div>
            <div class="chores-container"></div>
        `;

        const choresContainer = dayElement.querySelector('.chores-container');
        const dayChores = this.getChoresForDate(date);
        
        dayChores.forEach(chore => {
            const choreElement = this.createChoreElement(chore);
            choresContainer.appendChild(choreElement);
        });

        return dayElement;
    }

    createChoreElement(chore) {
        const roommate = this.roommates.find(r => r.id === chore.assignedTo);
        const element = document.createElement('div');
        element.className = 'chore-item clickable-chore';
        
        // Use roommate's assigned color instead of random color
        const choreColor = roommate ? roommate.color : '#1a73e8';
        element.style.backgroundColor = choreColor;
        element.textContent = chore.name;
        const assignedToDisplay = roommate ? (roommate.id === this.settings.currentUserId ? this.userProfile.name : roommate.name) + (roommate.id === this.settings.currentUserId ? ' (YOU)' : '') : 'Unknown';
        element.title = `Click to view details - Assigned to: ${assignedToDisplay}`;
        element.onclick = () => this.showChoreDetails(chore.id);
        return element;
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#FF8C00', '#FFD700', '#32CD32', '#00CED1',
            '#1E90FF', '#8A2BE2', '#FF1493', '#FF4500', '#00FF7F'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    showChoreDetails(choreId) {
        const chore = this.chores.find(c => c.id === choreId);
        if (!chore) return;

        this.currentChoreId = choreId;
        const roommate = this.roommates.find(r => r.id === chore.assignedTo);
        const isCurrentUser = chore.assignedTo === this.settings.currentUserId;
        const assignedName = isCurrentUser ? this.userProfile.name : (roommate?.name || 'Unknown');
        const youIndicator = isCurrentUser ? ' (YOU)' : '';

        // Populate the details modal
        document.getElementById('detail-chore-name').textContent = chore.name;
        document.getElementById('detail-chore-assigned').textContent = assignedName + youIndicator;
        document.getElementById('detail-chore-frequency').textContent = chore.frequency.charAt(0).toUpperCase() + chore.frequency.slice(1);
        document.getElementById('detail-chore-start-date').textContent = chore.startDate ? this.formatDate(new Date(chore.startDate)) : 'Not set';
        document.getElementById('detail-chore-duration').textContent = `${chore.duration} minutes`;
        document.getElementById('detail-chore-color').textContent = 'Based on assigned person\'s color';

        this.openModal('chore-details-modal');
    }

    getChoresForDate(date) {
        return this.chores.filter(chore => {
            // Check if the date is on or after the start date
            const startDate = chore.startDate ? new Date(chore.startDate) : new Date(chore.createdAt);
            if (date < startDate) {
                return false;
            }
            
            switch (chore.frequency) {
                case 'none':
                    return this.isSameDay(date, startDate);
                case 'daily':
                    return true;
                case 'weekly':
                    return this.isSameDayOfWeek(date, startDate);
                case 'monthly':
                    return date.getDate() === startDate.getDate();
                default:
                    return false;
            }
        });
    }

    // Laundry Management - Lettuce Meet Style
    renderLaundrySchedule() {
        const container = document.getElementById('time-grid');
        const weekElement = document.getElementById('current-week');
        
        const weekDays = this.getWeekDays(this.currentWeek);
        weekElement.textContent = `Week of ${this.formatDate(weekDays[0])}`;
        
        container.innerHTML = '';

        // Create time column header
        const timeHeader = document.createElement('div');
        timeHeader.className = 'time-column';
        timeHeader.textContent = 'Time';
        container.appendChild(timeHeader);

        // Create day headers (Monday to Sunday)
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        weekDays.forEach((day, index) => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-column';
            dayHeader.innerHTML = `
                <div>${dayNames[index]}</div>
                <div style="font-size: 0.8rem; color: #666;">${day.getDate()}</div>
            `;
            container.appendChild(dayHeader);
        });

        // Create time slots (8 AM to 9 PM) - one cell per hour
        for (let hour = 8; hour < 22; hour++) {
            // Time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-column';
            timeLabel.textContent = this.formatHour(hour);
            container.appendChild(timeLabel);

            // Day cells for this hour
            weekDays.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'time-cell';
                cell.dataset.date = day.toISOString().split('T')[0];
                cell.dataset.hour = hour;
                
                // Check if this time slot is booked
                const isBooked = this.isTimeSlotBooked(day, hour);
                if (isBooked) {
                    const booking = this.getBookingForTime(day, hour);
                    const startTime = new Date(booking.startTime);
                    const endTime = new Date(booking.endTime);
                    const isStartOfBooking = startTime.getHours() === hour;
                    
                    // Determine if it's washer or dryer based on booking type
                    const bookingType = booking.type || 'washer'; // Default to washer
                    cell.classList.add('booked', bookingType);
                    
                    // Only show name at the start of the booking
                    if (isStartOfBooking) {
                        const userNameDisplay = booking.userName + (booking.userId === this.settings.currentUserId ? ' (YOU)' : '');
                        cell.innerHTML = `<div class="booking-info">${userNameDisplay}</div>`;
                    } else {
                        cell.innerHTML = ''; // Empty for continuation cells
                    }
                    
                    // Add hover tooltip with booking details
                    const startTimeStr = this.formatTime(startTime);
                    const endTimeStr = this.formatTime(endTime);
                    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
                    const typeDisplay = bookingType.toUpperCase();
                    const userNameDisplay = booking.userName + (booking.userId === this.settings.currentUserId ? ' (YOU)' : '');
                    cell.title = `${userNameDisplay} - ${typeDisplay} - ${dayName} ${startTimeStr} to ${endTimeStr}${booking.notes ? ` (${booking.notes})` : ''}`;
                } else {
                    cell.classList.add('available');
                    cell.title = 'Available - Click to select';
                }

                // Add click event for selection
                cell.addEventListener('click', (e) => this.handleTimeCellClick(e, cell));
                cell.addEventListener('mousedown', (e) => this.handleMouseDown(e, cell));
                cell.addEventListener('mouseenter', (e) => this.handleMouseEnter(e, cell));
                cell.addEventListener('mouseup', (e) => this.handleMouseUp(e, cell));
                
                // Add hover events for highlighting bookings
                if (isBooked) {
                    cell.addEventListener('mouseenter', (e) => this.highlightBooking(day, hour));
                    cell.addEventListener('mouseleave', (e) => this.clearBookingHighlight());
                }

                container.appendChild(cell);
            });
        }
        
        // Update status indicators
        this.updateLaundryStatus();
    }

    handleTimeCellClick(e, cell) {
        if (cell.classList.contains('booked')) return;
        
        // If clicking on an already selected cell, deselect it
        if (cell.classList.contains('selected')) {
            cell.classList.remove('selected');
            // Remove from selectedCells array
            this.selectedCells = this.selectedCells.filter(c => c !== cell);
            this.updateSelectionInfo();
            this.updateReserveButton();
            return;
        }
        
        // Add to selection without clearing previous selections
        if (!this.selectedCells) {
            this.selectedCells = [];
        }
        
        // Only allow selection within the same day
        if (this.selectedCells.length > 0) {
            const firstDate = this.selectedCells[0].dataset.date;
            const currentDate = cell.dataset.date;
            
            if (firstDate !== currentDate) {
                // Different day - clear previous selection and start new one
                this.clearSelection();
            }
        }
        
        // Add the cell to selection
        this.selectedCells.push(cell);
        cell.classList.add('selected');
        this.updateSelectionInfo();
        this.updateReserveButton();
    }

    handleMouseDown(e, cell) {
        if (cell.classList.contains('booked')) return;
        e.preventDefault();
        this.startSelection(cell);
    }

    handleMouseEnter(e, cell) {
        if (this.isSelecting && !cell.classList.contains('booked')) {
            this.updateSelection(cell);
        }
    }

    handleMouseUp(e, cell) {
        if (this.isSelecting) {
            this.endSelection(cell);
        }
    }

    startSelection(cell) {
        this.isSelecting = true;
        this.selectionStart = cell;
        this.selectedCells = [cell];
        cell.classList.add('selected', 'selecting');
        this.updateSelectionInfo();
        this.updateReserveButton();
    }

    updateSelection(cell) {
        if (!this.isSelecting) return;
        
        // Clear previous selection
        this.selectedCells.forEach(c => c.classList.remove('selected', 'selecting'));
        
        // Only allow selection within the same day
        const startDate = this.selectionStart.dataset.date;
        const currentDate = cell.dataset.date;
        
        if (startDate !== currentDate) {
            // If different day, only select the start cell
            this.selectedCells = [this.selectionStart];
        } else {
            // Same day - get all cells between start and current for this day only
            const dayCells = Array.from(document.querySelectorAll(`.time-cell:not(.booked)[data-date="${startDate}"]`));
            const startIndex = dayCells.indexOf(this.selectionStart);
            const endIndex = dayCells.indexOf(cell);
            
            if (startIndex !== -1 && endIndex !== -1) {
                const start = Math.min(startIndex, endIndex);
                const end = Math.max(startIndex, endIndex);
                
                this.selectedCells = dayCells.slice(start, end + 1);
            } else {
                this.selectedCells = [this.selectionStart];
            }
        }
        
        this.selectedCells.forEach(c => c.classList.add('selected', 'selecting'));
        this.updateSelectionInfo();
        this.updateReserveButton();
    }

    endSelection(cell) {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        this.selectionEnd = cell;
        
        // Remove selecting class from all cells
        this.selectedCells.forEach(c => c.classList.remove('selecting'));
        
        this.updateSelectionInfo();
        this.updateReserveButton();
    }

    updateSelectionInfo() {
        const selectionInfo = document.getElementById('selection-info');
        const selectionText = document.getElementById('selection-text');
        const reserveBtn = document.getElementById('reserve-laundry-btn');
        
        if (this.selectedCells.length === 0) {
            selectionInfo.style.display = 'none';
            reserveBtn.disabled = true;
            return;
        }
        
        // Sort selected cells by hour to get proper time range
        const sortedCells = [...this.selectedCells].sort((a, b) => {
            const hourA = parseInt(a.dataset.hour);
            const hourB = parseInt(b.dataset.hour);
            return hourA - hourB;
        });
        
        const firstCell = sortedCells[0];
        const lastCell = sortedCells[sortedCells.length - 1];
        
        const startHour = parseInt(firstCell.dataset.hour);
        const endHour = parseInt(lastCell.dataset.hour) + 1;
        const date = firstCell.dataset.date;
        
        const startTime = this.formatHour(startHour);
        const endTime = this.formatHour(endHour);
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        
        // Show time range and number of selected slots
        const slotCount = this.selectedCells.length;
        selectionText.textContent = `${dayName} ${startTime} - ${endTime} (${slotCount} slot${slotCount > 1 ? 's' : ''})`;
        selectionInfo.style.display = 'flex';
        reserveBtn.disabled = false;
    }

    updateReserveButton() {
        const reserveBtn = document.getElementById('reserve-laundry-btn');
        reserveBtn.disabled = this.selectedCells.length === 0;
    }

    openLaundryBookingModal() {
        if (this.selectedCells.length === 0) return;
        
        // Sort selected cells by hour to get proper time range
        const sortedCells = [...this.selectedCells].sort((a, b) => {
            const hourA = parseInt(a.dataset.hour);
            const hourB = parseInt(b.dataset.hour);
            return hourA - hourB;
        });
        
        const firstCell = sortedCells[0];
        const lastCell = sortedCells[sortedCells.length - 1];
        
        const date = firstCell.dataset.date;
        const startHour = parseInt(firstCell.dataset.hour);
        const endHour = parseInt(lastCell.dataset.hour) + 1;
        
        // Convert date to YYYY-MM-DD format for HTML date input
        const dateObj = new Date(date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        
        // Auto-fill the date and times
        document.getElementById('laundry-date').value = formattedDate;
        document.getElementById('laundry-start-time').value = this.formatTimeForInput(startHour, 0);
        document.getElementById('laundry-end-time').value = this.formatTimeForInput(endHour, 0);
        
        // Set the current user from profile
        document.getElementById('laundry-user').value = this.userProfile.name;
        
        // Clear any existing booking ID
        document.getElementById('book-laundry-modal').dataset.bookingId = '';
        
        this.openModal('book-laundry-modal');
    }

    clearSelection() {
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        if (this.selectedCells) {
        this.selectedCells.forEach(cell => cell.classList.remove('selected'));
        }
        this.selectedCells = [];
        this.updateSelectionInfo();
        this.updateReserveButton();
    }

    saveLaundryBooking() {
        const date = document.getElementById('laundry-date').value;
        const startTime = document.getElementById('laundry-start-time').value;
        const endTime = document.getElementById('laundry-end-time').value;
        const type = document.getElementById('laundry-type').value;
        const notes = document.getElementById('laundry-notes').value;
        const bookingId = document.getElementById('book-laundry-modal').dataset.bookingId;

        if (!date || !startTime || !endTime || !type) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Use current user ID and profile name
        const userId = this.currentUserId;
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        const userName = this.userProfile.name;

        if (bookingId) {
            // Update existing booking
            const booking = this.laundryBookings.find(b => b.id === bookingId);
            if (booking) {
                booking.startTime = startDateTime.toISOString();
                booking.endTime = endDateTime.toISOString();
                booking.userId = userId;
                booking.userName = userName;
                booking.type = type;
                booking.notes = notes;
                this.showNotification('Laundry booking updated successfully!', 'success');
            }
        } else {
            // Create single booking
            const booking = {
                id: Date.now().toString(),
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                userId,
                userName: userName,
                type,
                notes,
                createdAt: new Date().toISOString()
            };
            this.laundryBookings.push(booking);
            this.showNotification('Laundry time booked successfully!', 'success');
            
            // Add notification for laundry booking
            this.addNotification(
                'Laundry Booking',
                `${userName} booked ${type} from ${this.formatTime(startDateTime)} to ${this.formatTime(endDateTime)}`,
                'fa-tshirt',
                'booking'
            );
        }

        this.saveData('laundryBookings', this.laundryBookings);
        this.clearSelection();
        this.renderLaundrySchedule();
        this.renderPersonalSchedule();
        this.updateLaundryStatus(); // Update status indicators
        this.closeModal('book-laundry-modal');
    }

    isTimeSlotBooked(date, hour) {
        return this.laundryBookings.some(booking => {
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            const checkTime = new Date(date);
            checkTime.setHours(hour, 0, 0, 0);
            
            return checkTime >= startTime && checkTime < endTime;
        });
    }

    getBookingForTime(date, hour) {
        return this.laundryBookings.find(booking => {
            const startTime = new Date(booking.startTime);
            const endTime = new Date(booking.endTime);
            const checkTime = new Date(date);
            checkTime.setHours(hour, 0, 0, 0);
            
            return checkTime >= startTime && checkTime < endTime;
        });
    }

    navigateWeek(direction) {
        this.currentWeek.setDate(this.currentWeek.getDate() + (direction * 7));
        this.renderLaundrySchedule();
    }

    // Calendar Navigation
    navigatePeriod(direction) {
        switch (this.currentView) {
            case 'daily':
                this.currentDate.setDate(this.currentDate.getDate() + direction);
                break;
            case 'weekly':
                this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
                break;
            case 'monthly':
                this.currentDate.setMonth(this.currentDate.getMonth() + direction);
                break;
        }
        this.renderCalendar();
    }

    // Utility Functions
    formatDate(date, options = {}) {
        const defaultOptions = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    formatHour(hour) {
        if (hour === 0) return '12 AM';
        if (hour < 12) return `${hour} AM`;
        if (hour === 12) return '12 PM';
        return `${hour - 12} PM`;
    }

    formatTimeForInput(hour, minute) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    isSameTime(date1, date2) {
        return date1.getHours() === date2.getHours() &&
               date1.getMinutes() === date2.getMinutes();
    }

    isSameDayOfWeek(date1, date2) {
        return date1.getDay() === date2.getDay();
    }

    getWeekDays(date) {
        const days = [];
        const startOfWeek = new Date(date);
        // Start week on Monday (day 1)
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(date.getDate() + daysToMonday);
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            days.push(day);
        }
        return days;
    }

    getMonthDays(date) {
        const days = [];
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Add days from previous month to fill the first week
        const startDay = firstDay.getDay();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = new Date(firstDay);
            day.setDate(firstDay.getDate() - i - 1);
            days.push(day);
        }
        
        // Add days of current month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            days.push(new Date(year, month, day));
        }
        
        // Add days from next month to fill the last week
        const remainingDays = 42 - days.length; // 6 weeks * 7 days
        for (let day = 1; day <= remainingDays; day++) {
            days.push(new Date(year, month + 1, day));
        }
        
        return days;
    }

    // Settings
    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveData('settings', this.settings);
        this.updateSettings();
    }

    updateSettings() {
        document.getElementById('email-notifications').checked = this.settings.emailNotifications;
        document.getElementById('browser-notifications').checked = this.settings.browserNotifications;
    }

    // Notifications
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // Browser notification
        if (this.settings.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Household Manager', {
                body: message,
                icon: '/favicon.ico'
            });
        }
    }

    // Data Export/Import
    exportData() {
        const data = {
            roommates: this.roommates,
            chores: this.chores,
            personalTasks: this.personalTasks,
            laundryBookings: this.laundryBookings,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `household-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('Data exported successfully!', 'success');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        
                        if (data.roommates) this.roommates = data.roommates;
                        if (data.chores) this.chores = data.chores;
                        if (data.personalTasks) this.personalTasks = data.personalTasks;
                        if (data.laundryBookings) this.laundryBookings = data.laundryBookings;
                        if (data.settings) this.settings = data.settings;
                        
                        this.saveData('roommates', this.roommates);
                        this.saveData('chores', this.chores);
                        this.saveData('personalTasks', this.personalTasks);
                        this.saveData('laundryBookings', this.laundryBookings);
                        this.saveData('settings', this.settings);
                        
                        this.renderRoommates();
                        this.renderCalendar();
                        this.renderChoresList();
                        this.renderPersonalSchedule();
                        this.renderLaundrySchedule();
                        this.updateSettings();
                        
                        this.showNotification('Data imported successfully!', 'success');
                    } catch (error) {
                        this.showNotification('Error importing data. Please check the file format.', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    clearModalForms() {
        document.querySelectorAll('form').forEach(form => form.reset());
    }

    // Maintenance Management
    populateReporterSelect() {
        const select = document.getElementById('maintenance-reporter');
        select.innerHTML = '<option value="">Select reporter</option>';
        this.roommates.forEach(roommate => {
            const option = document.createElement('option');
            option.value = roommate.id;
            option.textContent = roommate.name;
            select.appendChild(option);
        });
    }

    populatePurchasedBySelect() {
        const select = document.getElementById('item-purchased-by');
        select.innerHTML = '<option value="">Select purchaser</option>';
        this.roommates.forEach(roommate => {
            const option = document.createElement('option');
            option.value = roommate.id;
            option.textContent = roommate.name;
            select.appendChild(option);
        });
    }

    populatePaidBySelect() {
        const select = document.getElementById('bill-paid-by');
        select.innerHTML = '<option value="">Select payer</option>';
        this.roommates.forEach(roommate => {
            const option = document.createElement('option');
            option.value = roommate.id;
            option.textContent = roommate.name;
            select.appendChild(option);
        });
    }

    populateCreatorSelect() {
        const selects = ['event-creator', 'poll-creator'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select creator</option>';
                this.roommates.forEach(roommate => {
                    const option = document.createElement('option');
                    option.value = roommate.id;
                    option.textContent = roommate.name;
                    select.appendChild(option);
                });
            }
        });
    }

    saveMaintenanceIssue() {
        const title = document.getElementById('maintenance-title').value;
        const area = document.getElementById('maintenance-area').value;
        const priority = document.getElementById('maintenance-priority').value;
        const description = document.getElementById('maintenance-description').value;
        const reporter = document.getElementById('maintenance-reporter').value;

        if (!title || !area || !description) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const isCurrentUser = reporter === this.settings.currentUserId;
        const reporterName = isCurrentUser ? this.userProfile.name : (this.roommates.find(r => r.id === reporter)?.name || 'Unknown');

        const issue = {
            id: Date.now().toString(),
            title,
            area,
            priority,
            description,
            reporter,
            reporterName,
            status: 'not-reported',
            createdAt: new Date().toISOString()
        };

        this.maintenanceIssues.push(issue);
        this.saveData('maintenanceIssues', this.maintenanceIssues);
        this.renderMaintenanceList();
        this.closeModal('add-maintenance-modal');
        this.showNotification('Maintenance issue added successfully!', 'success');
    }

    renderMaintenanceList() {
        const container = document.getElementById('maintenance-list');
        container.innerHTML = '';

        if (this.filteredMaintenanceIssues.length === 0) {
            container.innerHTML = '<p class="text-center">No maintenance issues found for the selected filter.</p>';
            return;
        }

        // Sort by priority and date
        const sortedIssues = this.filteredMaintenanceIssues.sort((a, b) => {
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        sortedIssues.forEach(issue => {
            const item = document.createElement('div');
            item.className = 'maintenance-item';
            
            item.innerHTML = `
                <div class="maintenance-item-header">
                    <div class="maintenance-item-title">${issue.title}</div>
                    <div class="maintenance-item-actions">
                        <button class="btn btn-small btn-secondary" onclick="app.editMaintenanceIssue('${issue.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="maintenance-item-details">
                    <div class="maintenance-detail">
                        <div class="maintenance-detail-label">Area</div>
                        <div class="maintenance-detail-value">${issue.area.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                    </div>
                    <div class="maintenance-detail">
                        <div class="maintenance-detail-label">Priority</div>
                        <div class="maintenance-detail-value">
                            <span class="maintenance-priority ${issue.priority}">${issue.priority}</span>
                        </div>
                    </div>
                    <div class="maintenance-detail">
                        <div class="maintenance-detail-label">Status</div>
                        <div class="maintenance-detail-value">
                            <span class="maintenance-status ${issue.status}">${issue.status.replace('-', ' ')}</span>
                        </div>
                    </div>
                    <div class="maintenance-detail">
                        <div class="maintenance-detail-label">Reported By</div>
                        <div class="maintenance-detail-value">${issue.reporterName}${issue.reporter === this.settings.currentUserId ? ' (YOU)' : ''}</div>
                    </div>
                    <div class="maintenance-detail">
                        <div class="maintenance-detail-label">Date</div>
                        <div class="maintenance-detail-value">${this.formatDate(new Date(issue.createdAt))}</div>
                    </div>
                </div>
                <div class="maintenance-detail">
                    <div class="maintenance-detail-label">Description</div>
                    <div class="maintenance-detail-value">${issue.description}</div>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    editMaintenanceIssue(issueId) {
        const issue = this.maintenanceIssues.find(i => i.id === issueId);
        if (!issue) return;

        document.getElementById('edit-maintenance-title').value = issue.title;
        document.getElementById('edit-maintenance-area').value = issue.area;
        document.getElementById('edit-maintenance-priority').value = issue.priority;
        document.getElementById('edit-maintenance-status').value = issue.status;
        document.getElementById('edit-maintenance-description').value = issue.description;
        
        // Store issue ID for saving
        document.getElementById('edit-maintenance-modal').dataset.issueId = issueId;
        
        this.openModal('edit-maintenance-modal');
    }

    saveEditMaintenance() {
        const issueId = document.getElementById('edit-maintenance-modal').dataset.issueId;
        const issue = this.maintenanceIssues.find(i => i.id === issueId);
        if (!issue) return;

        issue.title = document.getElementById('edit-maintenance-title').value;
        issue.area = document.getElementById('edit-maintenance-area').value;
        issue.priority = document.getElementById('edit-maintenance-priority').value;
        issue.status = document.getElementById('edit-maintenance-status').value;
        issue.description = document.getElementById('edit-maintenance-description').value;

        this.saveData('maintenanceIssues', this.maintenanceIssues);
        this.renderMaintenanceList();
        this.closeModal('edit-maintenance-modal');
        this.showNotification('Maintenance issue updated successfully!', 'success');
    }

    deleteMaintenanceIssue() {
        const issueId = document.getElementById('edit-maintenance-modal').dataset.issueId;
        if (!issueId) return;

        if (confirm('Are you sure you want to delete this maintenance issue?')) {
            this.maintenanceIssues = this.maintenanceIssues.filter(i => i.id !== issueId);
            this.saveData('maintenanceIssues', this.maintenanceIssues);
            this.renderMaintenanceList();
            this.closeModal('edit-maintenance-modal');
            this.showNotification('Maintenance issue deleted successfully!', 'success');
        }
    }

    saveGoogleFormUrl() {
        const url = document.getElementById('google-form-url').value;
        if (!url) {
            this.showNotification('Please enter a valid Google Form URL', 'error');
            return;
        }

        this.settings.googleFormUrl = url;
        this.saveData('settings', this.settings);
        
        // Update the link
        const link = document.getElementById('google-form-link');
        link.href = url;
        
        this.showNotification('Google Form URL saved successfully!', 'success');
    }

    filterMaintenanceIssues(status) {
        if (status === 'all') {
            this.filteredMaintenanceIssues = [...this.maintenanceIssues];
        } else {
            this.filteredMaintenanceIssues = this.maintenanceIssues.filter(issue => issue.status === status);
        }
        this.renderMaintenanceList();
    }

    updateSettings() {
        document.getElementById('email-notifications').checked = this.settings.emailNotifications;
        document.getElementById('browser-notifications').checked = this.settings.browserNotifications;
    }

    // Sample Data Initialization
    initializeSampleData() {
        if (this.roommates.length === 0) {
            this.initializeUSCRoommates();
        }
        if (this.inventoryItems.length === 0) {
            this.initializeSampleInventory();
        }
        if (this.bills.length === 0) {
            this.initializeSampleBills();
        }
        if (this.events.length === 0) {
            this.initializeSampleEvents();
        }
        if (this.polls.length === 0) {
            this.initializeSamplePolls();
        }
        if (Object.keys(this.roommatePreferences).length === 0) {
            this.initializeRoommatePreferences();
        }
    }

    initializeUSCRoommates() {
        const uscRoommates = [
            { id: 'user1', name: 'Alex Chen', email: 'alex.chen@usc.edu', avatar: '👨‍💻', color: '#FF6B6B', preferences: { chores: ['dishes', 'trash'], availability: 'weekends' } },
            { id: 'user2', name: 'Sarah Johnson', email: 'sarah.j@usc.edu', avatar: '👩‍🎓', color: '#1E90FF', preferences: { chores: ['cleaning', 'laundry'], availability: 'weekdays' } },
            { id: 'user3', name: 'Mike Rodriguez', email: 'mike.r@usc.edu', avatar: '👨‍🍳', color: '#32CD32', preferences: { chores: ['cooking', 'groceries'], availability: 'evenings' } },
            { id: 'user4', name: 'Emma Davis', email: 'emma.d@usc.edu', avatar: '👩‍🔬', color: '#FF8C00', preferences: { chores: ['bathroom', 'organizing'], availability: 'mornings' } },
            { id: 'user5', name: 'David Kim', email: 'david.k@usc.edu', avatar: '👨‍💼', color: '#FFD700', preferences: { chores: ['bills', 'maintenance'], availability: 'weekends' } },
            { id: 'user6', name: 'Lisa Wang', email: 'lisa.w@usc.edu', avatar: '👩‍🎨', color: '#8A2BE2', preferences: { chores: ['decorating', 'plants'], availability: 'flexible' } },
            { id: 'user7', name: 'James Wilson', email: 'james.w@usc.edu', avatar: '👨‍🏫', color: '#00CED1', preferences: { chores: ['trash', 'recycling'], availability: 'evenings' } },
            { id: 'user8', name: 'Maya Patel', email: 'maya.p@usc.edu', avatar: '👩‍⚕️', color: '#FF1493', preferences: { chores: ['cleaning', 'dishes'], availability: 'mornings' } }
        ];
        
        this.roommates = uscRoommates;
        this.saveData('roommates', this.roommates);
    }

    initializeSampleInventory() {
        const sampleItems = [
            { id: 'item1', name: 'Dish Soap', category: 'cleaning', quantity: 2, minQuantity: 1, purchasedBy: 'user1', cost: 3.99, lastUpdated: new Date().toISOString() },
            { id: 'item2', name: 'Toilet Paper', category: 'bathroom', quantity: 8, minQuantity: 2, purchasedBy: 'user2', cost: 12.99, lastUpdated: new Date().toISOString() },
            { id: 'item3', name: 'Laundry Detergent', category: 'cleaning', quantity: 1, minQuantity: 1, purchasedBy: 'user3', cost: 8.99, lastUpdated: new Date().toISOString() },
            { id: 'item4', name: 'Milk', category: 'groceries', quantity: 0, minQuantity: 1, purchasedBy: 'user4', cost: 4.99, lastUpdated: new Date().toISOString() },
            { id: 'item5', name: 'Trash Bags', category: 'cleaning', quantity: 3, minQuantity: 2, purchasedBy: 'user5', cost: 6.99, lastUpdated: new Date().toISOString() }
        ];
        
        this.inventoryItems = sampleItems;
        this.saveData('inventoryItems', this.inventoryItems);
    }

    initializeSampleBills() {
        const sampleBills = [
            {
                id: 'bill1',
                description: 'Rent - January 2024',
                amount: 3200.00,
                paidBy: 'user1',
                splitType: 'equal',
                splits: [
                    { userId: 'user1', amount: 400.00, paid: true },
                    { userId: 'user2', amount: 400.00, paid: true },
                    { userId: 'user3', amount: 400.00, paid: false },
                    { userId: 'user4', amount: 400.00, paid: true },
                    { userId: 'user5', amount: 400.00, paid: false },
                    { userId: 'user6', amount: 400.00, paid: true },
                    { userId: 'user7', amount: 400.00, paid: false },
                    { userId: 'user8', amount: 400.00, paid: true }
                ],
                dueDate: '2024-01-01',
                createdAt: new Date().toISOString()
            },
            {
                id: 'bill2',
                description: 'Electricity Bill',
                amount: 120.00,
                paidBy: 'user2',
                splitType: 'equal',
                splits: [
                    { userId: 'user1', amount: 15.00, paid: true },
                    { userId: 'user2', amount: 15.00, paid: true },
                    { userId: 'user3', amount: 15.00, paid: true },
                    { userId: 'user4', amount: 15.00, paid: true },
                    { userId: 'user5', amount: 15.00, paid: true },
                    { userId: 'user6', amount: 15.00, paid: true },
                    { userId: 'user7', amount: 15.00, paid: true },
                    { userId: 'user8', amount: 15.00, paid: true }
                ],
                dueDate: '2024-01-15',
                createdAt: new Date().toISOString()
            }
        ];
        
        this.bills = sampleBills;
        this.saveData('bills', this.bills);
    }

    initializeSampleEvents() {
        const sampleEvents = [
            {
                id: 'event1',
                title: 'House Meeting',
                description: 'Weekly house meeting to discuss chores and upcoming events',
                date: '2024-01-20',
                time: '19:00',
                location: 'Living Room',
                creator: 'user1',
                attendees: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8'],
                createdAt: new Date().toISOString()
            },
            {
                id: 'event2',
                title: 'Movie Night',
                description: 'Watch the latest Marvel movie together',
                date: '2024-01-25',
                time: '20:00',
                location: 'Living Room',
                creator: 'user3',
                attendees: ['user1', 'user2', 'user3', 'user6', 'user8'],
                createdAt: new Date().toISOString()
            }
        ];
        
        this.events = sampleEvents;
        this.saveData('events', this.events);
    }

    initializeSamplePolls() {
        const samplePolls = [
            {
                id: 'poll1',
                question: 'What should we order for dinner tonight?',
                description: 'Vote for your preferred dinner option',
                options: [
                    { text: 'Pizza', votes: 3, voters: ['user1', 'user3', 'user5'] },
                    { text: 'Chinese Food', votes: 2, voters: ['user2', 'user4'] },
                    { text: 'Mexican Food', votes: 1, voters: ['user6'] },
                    { text: 'Thai Food', votes: 2, voters: ['user7', 'user8'] }
                ],
                creator: 'user1',
                expiryDate: '2024-01-20',
                status: 'active',
                createdAt: new Date().toISOString()
            }
        ];
        
        this.polls = samplePolls;
        this.saveData('polls', this.polls);
    }

    initializeRoommatePreferences() {
        const preferences = {};
        this.roommates.forEach(roommate => {
            preferences[roommate.id] = {
                chorePreferences: roommate.preferences.chores || [],
                availability: roommate.preferences.availability || 'flexible',
                notifications: true,
                badges: []
            };
        });
        
        this.roommatePreferences = preferences;
        this.saveData('roommatePreferences', this.roommatePreferences);
    }

    // Inventory Management
    renderInventory() {
        const container = document.getElementById('inventory-grid');
        container.innerHTML = '';

        if (this.inventoryItems.length === 0) {
            container.innerHTML = '<p class="text-center">No inventory items yet. Add some items to get started!</p>';
            return;
        }

        // Filter items based on category and search
        let filteredItems = this.inventoryItems;

        // Apply category filter
        if (this.currentInventoryFilter && this.currentInventoryFilter !== 'all') {
            if (this.currentInventoryFilter === 'low-stock') {
                filteredItems = filteredItems.filter(item => item.quantity <= item.minQuantity);
            } else if (this.currentInventoryFilter === 'out-of-stock') {
                filteredItems = filteredItems.filter(item => item.quantity === 0);
            } else {
                filteredItems = filteredItems.filter(item => item.category === this.currentInventoryFilter);
            }
        }

        // Apply search filter
        if (this.currentInventorySearch) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(this.currentInventorySearch) ||
                item.category.toLowerCase().includes(this.currentInventorySearch)
            );
        }

        if (filteredItems.length === 0) {
            container.innerHTML = '<p class="text-center">No items match your current filter. Try adjusting your search or filter criteria.</p>';
            return;
        }

        filteredItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            
            const isLowStock = item.quantity <= item.minQuantity;
            const isCurrentUser = item.purchasedBy === this.settings.currentUserId;
            const purchasedBy = isCurrentUser ? this.userProfile.name : (this.roommates.find(r => r.id === item.purchasedBy)?.name || 'Unknown');
            const youIndicator = isCurrentUser ? ' (YOU)' : '';
            
            itemElement.innerHTML = `
                <div class="inventory-item-header">
                    <div class="inventory-item-name">${item.name}</div>
                    <div class="inventory-item-category">${item.category}</div>
                </div>
                <div class="inventory-item-details">
                    <div class="inventory-detail">
                        <div class="inventory-detail-label">Quantity</div>
                        <div class="inventory-detail-value">
                            <span class="inventory-quantity ${isLowStock ? 'low-stock' : ''}">${item.quantity}</span>
                        </div>
                    </div>
                    <div class="inventory-detail">
                        <div class="inventory-detail-label">Min Quantity</div>
                        <div class="inventory-detail-value">${item.minQuantity}</div>
                    </div>
                    <div class="inventory-detail">
                        <div class="inventory-detail-label">Purchased By</div>
                        <div class="inventory-detail-value">${purchasedBy}${youIndicator}</div>
                    </div>
                    <div class="inventory-detail">
                        <div class="inventory-detail-label">Cost</div>
                        <div class="inventory-detail-value">$${item.cost || 'N/A'}</div>
                    </div>
                </div>
                <div class="inventory-actions">
                    <button class="btn btn-small btn-secondary" onclick="app.updateInventoryItem('${item.id}', 1)">
                        <i class="fas fa-plus"></i> Add
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="app.updateInventoryItem('${item.id}', -1)">
                        <i class="fas fa-minus"></i> Remove
                    </button>
                </div>
            `;
            
            container.appendChild(itemElement);
        });
    }

    saveInventoryItem() {
        const name = document.getElementById('item-name').value;
        const category = document.getElementById('item-category').value;
        const quantity = parseInt(document.getElementById('item-quantity').value);
        const minQuantity = parseInt(document.getElementById('item-min-quantity').value);
        const purchasedBy = document.getElementById('item-purchased-by').value;
        const cost = parseFloat(document.getElementById('item-cost').value) || 0;

        if (!name || !category || isNaN(quantity)) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const item = {
            id: Date.now().toString(),
            name,
            category,
            quantity,
            minQuantity,
            purchasedBy,
            cost,
            lastUpdated: new Date().toISOString()
        };

        this.inventoryItems.push(item);
        this.saveData('inventoryItems', this.inventoryItems);
        this.renderInventory();
        this.closeModal('add-item-modal');
        this.showNotification('Inventory item added successfully!', 'success');
    }

    updateInventoryItem(itemId, change) {
        const item = this.inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        item.quantity = Math.max(0, item.quantity + change);
        item.lastUpdated = new Date().toISOString();
        
        this.saveData('inventoryItems', this.inventoryItems);
        this.renderInventory();
        
        if (item.quantity <= item.minQuantity) {
            this.showNotification(`${item.name} is running low!`, 'warning');
        }
    }

    filterInventory(category) {
        this.currentInventoryFilter = category;
        this.renderInventory();
    }

    searchInventory(query) {
        this.currentInventorySearch = query.toLowerCase();
        this.renderInventory();
    }

    showLowStockItems() {
        this.currentInventoryFilter = 'low-stock';
        this.renderInventory();
        this.showNotification('Showing low stock items only', 'info');
    }

    showOutOfStockItems() {
        this.currentInventoryFilter = 'out-of-stock';
        this.renderInventory();
        this.showNotification('Showing out of stock items only', 'info');
    }

    clearInventoryFilters() {
        this.currentInventoryFilter = 'all';
        this.currentInventorySearch = '';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('search-items').value = '';
        this.renderInventory();
        this.showNotification('Filters cleared', 'info');
    }

    // Bills Management
    renderBills() {
        const container = document.getElementById('bills-list');
        container.innerHTML = '';

        let billsToShow = this.filteredBills || this.bills;
        
        // Apply search filter if there's a search term
        const searchTerm = document.getElementById('bills-search-input')?.value?.toLowerCase() || '';
        if (searchTerm) {
            billsToShow = billsToShow.filter(bill => 
                bill.description.toLowerCase().includes(searchTerm) ||
                bill.amount.toString().includes(searchTerm) ||
                this.roommates.find(r => r.id === bill.paidBy)?.name?.toLowerCase().includes(searchTerm)
            );
        }

        if (billsToShow.length === 0) {
            container.innerHTML = '<p class="text-center">No bills found. Try adjusting your filter or add a bill to get started!</p>';
            return;
        }

        billsToShow.forEach(bill => {
            const billElement = document.createElement('div');
            billElement.className = 'bill-item';
            
            const paidBy = this.roommates.find(r => r.id === bill.paidBy)?.name || 'Unknown';
            const totalPaid = bill.splits.filter(s => s.paid).length;
            const totalSplits = bill.splits.length;
            const isOverdue = new Date(bill.dueDate) < new Date() && totalPaid < totalSplits;
            const isFullyPaid = totalPaid === totalSplits;
            
            // Get bill category icon
            const getBillIcon = (description) => {
                const desc = description.toLowerCase();
                if (desc.includes('rent') || desc.includes('mortgage')) return '🏠';
                if (desc.includes('electric') || desc.includes('power')) return '⚡';
                if (desc.includes('water')) return '💧';
                if (desc.includes('gas') || desc.includes('heating')) return '🔥';
                if (desc.includes('internet') || desc.includes('wifi')) return '📶';
                if (desc.includes('cable') || desc.includes('tv')) return '📺';
                if (desc.includes('phone') || desc.includes('mobile')) return '📱';
                if (desc.includes('grocery') || desc.includes('food')) return '🛒';
                if (desc.includes('insurance')) return '🛡️';
                if (desc.includes('maintenance') || desc.includes('repair')) return '🔧';
                return '📄';
            };

            // Get progress percentage
            const progressPercentage = (totalPaid / totalSplits) * 100;
            
            billElement.innerHTML = `
                <div class="bill-item-header">
                    <div class="bill-item-icon">${getBillIcon(bill.description)}</div>
                    <div class="bill-item-info">
                    <div class="bill-item-title">${bill.description}</div>
                        <div class="bill-item-subtitle">Due ${this.formatDate(new Date(bill.dueDate))}</div>
                    </div>
                    <div class="bill-item-amount-container">
                        <div class="bill-item-amount">$${bill.amount.toFixed(2)}</div>
                        <div class="bill-status ${isFullyPaid ? 'paid' : isOverdue ? 'overdue' : 'active'}">
                            <i class="fas ${isFullyPaid ? 'fa-check-circle' : isOverdue ? 'fa-exclamation-triangle' : 'fa-clock'}"></i>
                            ${isFullyPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING'}
                        </div>
                    </div>
                </div>
                
                <div class="bill-progress-section">
                    <div class="bill-progress-header">
                        <span class="progress-label">Payment Progress</span>
                        <span class="progress-text">${totalPaid}/${totalSplits} paid</span>
                    </div>
                    <div class="bill-progress-bar">
                        <div class="bill-progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>

                <div class="bill-item-details">
                    <div class="bill-detail">
                        <i class="fas fa-user-circle bill-detail-icon"></i>
                        <div class="bill-detail-content">
                        <div class="bill-detail-label">Paid By</div>
                        <div class="bill-detail-value">${paidBy}</div>
                        </div>
                    </div>
                    <div class="bill-detail">
                        <i class="fas fa-calendar-alt bill-detail-icon"></i>
                        <div class="bill-detail-content">
                        <div class="bill-detail-label">Due Date</div>
                        <div class="bill-detail-value">${this.formatDate(new Date(bill.dueDate))}</div>
                        </div>
                    </div>
                    <div class="bill-detail">
                        <i class="fas fa-percentage bill-detail-icon"></i>
                        <div class="bill-detail-content">
                            <div class="bill-detail-label">Split Type</div>
                            <div class="bill-detail-value">${bill.splitType.charAt(0).toUpperCase() + bill.splitType.slice(1)}</div>
                    </div>
                </div>
                </div>
                
                <div class="bill-splits">
                    <div class="bill-splits-header">
                        <i class="fas fa-users"></i>
                        <span>Split Details</span>
                    </div>
                    <div class="bill-splits-list">
                    ${bill.splits.map(split => {
                        const roommate = this.roommates.find(r => r.id === split.userId);
                        const isCurrentUser = split.userId === this.settings.currentUserId;
                        const displayName = isCurrentUser ? this.userProfile.name : (roommate?.name || 'Unknown');
                        const youIndicator = isCurrentUser ? ' (YOU)' : '';
                        const avatarColor = isCurrentUser ? this.userProfile.color : (roommate?.color || '#1a73e8');
                        const avatarInitial = isCurrentUser ? this.userProfile.name.charAt(0).toUpperCase() : (roommate?.name?.charAt(0).toUpperCase() || '?');
                        return `
                            <div class="bill-split">
                                    <div class="bill-split-user">
                                        <div class="bill-split-avatar" style="background-color: ${avatarColor}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin-right: 12px;">
                                            ${avatarInitial}
                                        </div>
                                <span class="bill-split-name">${displayName}${youIndicator}</span>
                                    </div>
                                    <div class="bill-split-amount ${split.paid ? 'paid' : 'unpaid'}">
                                        <span class="amount">$${split.amount.toFixed(2)}</span>
                                        <i class="fas ${split.paid ? 'fa-check-circle' : 'fa-clock'}"></i>
                                    </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                </div>
                
                <div class="bill-item-actions">
                    ${bill.createdBy === this.userProfile.name ? `
                        <button class="btn btn-small btn-primary" onclick="app.editBill('${bill.id}')" title="Edit Bill">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    ` : ''}
                    <button class="btn btn-small btn-success" onclick="app.settleUpBill('${bill.id}')" title="Settle Up">
                        <i class="fas fa-handshake"></i> Settle Up
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="app.markBillAsPaid('${bill.id}')" title="Mark as Paid">
                        <i class="fas fa-check"></i> Mark Paid
                    </button>
                    ${bill.createdBy === this.userProfile.name ? `
                        <button class="btn btn-small btn-danger" onclick="app.deleteBill('${bill.id}')" title="Delete Bill">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(billElement);
        });
    }

    saveBill() {
        const description = document.getElementById('bill-description').value;
        const amount = parseFloat(document.getElementById('bill-amount').value);
        const paidBy = document.getElementById('bill-paid-by').value;
        const splitType = document.getElementById('bill-split-type').value;
        const dueDate = document.getElementById('bill-due-date').value;
        const editingBillId = document.getElementById('add-bill-modal').dataset.editingBillId;

        if (!description || !amount || !paidBy || !dueDate) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const splits = this.calculateBillSplits(amount, splitType);
        
        if (editingBillId) {
            // Update existing bill
            const billIndex = this.bills.findIndex(b => b.id === editingBillId);
            if (billIndex !== -1) {
                this.bills[billIndex] = {
                    ...this.bills[billIndex],
                    description,
                    amount,
                    paidBy,
                    splitType,
                    splits,
                    dueDate,
                    updatedAt: new Date().toISOString()
                };
                this.showNotification('Bill updated successfully!', 'success');
            }
        } else {
            // Create new bill
        const bill = {
            id: Date.now().toString(),
            description,
            amount,
            paidBy,
            splitType,
            splits,
            dueDate,
                createdBy: this.userProfile.name,
            createdAt: new Date().toISOString()
        };
        this.bills.push(bill);
            this.showNotification('Bill added successfully!', 'success');
        }

        this.saveData('bills', this.bills);
        this.renderBills();
        this.closeModal('add-bill-modal');
        
        // Reset form
        document.getElementById('add-bill-modal').dataset.editingBillId = '';
        document.getElementById('save-bill').textContent = 'Add Bill';
    }

    calculateBillSplits(amount, splitType) {
        const splits = [];
        
        if (splitType === 'equal') {
            const perPerson = amount / this.roommates.length;
            this.roommates.forEach(roommate => {
                splits.push({
                    userId: roommate.id,
                    amount: perPerson,
                    paid: false
                });
            });
        } else if (splitType === 'percentage') {
            this.roommates.forEach(roommate => {
                const percentageInput = document.getElementById(`percentage-${roommate.id}`);
                const percentage = parseFloat(percentageInput?.value) || 0;
                const splitAmount = (percentage / 100) * amount;
                splits.push({
                    userId: roommate.id,
                    amount: splitAmount,
                    paid: false
                });
            });
        } else if (splitType === 'custom') {
            this.roommates.forEach(roommate => {
                const customInput = document.getElementById(`custom-${roommate.id}`);
                const splitAmount = parseFloat(customInput?.value) || 0;
                splits.push({
                    userId: roommate.id,
                    amount: splitAmount,
                    paid: false
                });
            });
        }
        
        return splits;
    }

    filterBills(status) {
        if (status === 'all') {
            this.filteredBills = null;
        } else {
            this.filteredBills = this.bills.filter(bill => {
                const totalPaid = bill.splits.filter(s => s.paid).length;
                const totalSplits = bill.splits.length;
                const isOverdue = new Date(bill.dueDate) < new Date() && totalPaid < totalSplits;
                const isFullyPaid = totalPaid === totalSplits;
                
                switch (status) {
                    case 'active':
                        return !isFullyPaid && !isOverdue;
                    case 'paid':
                        return isFullyPaid;
                    case 'overdue':
                        return isOverdue;
                    default:
                        return true;
                }
            });
        }
        this.renderBills();
    }

    filterBillsByPeriod(period) {
        if (period === 'all') {
            this.filteredBills = null;
        } else {
            // Parse period (e.g., "september-2025")
            const [month, year] = period.split('-');
            const monthNames = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3,
                'may': 4, 'june': 5, 'july': 6, 'august': 7,
                'september': 8, 'october': 9, 'november': 10, 'december': 11
            };
            
            const targetMonth = monthNames[month];
            const targetYear = parseInt(year);
            
            this.filteredBills = this.bills.filter(bill => {
                const billDate = new Date(bill.dueDate);
                return billDate.getMonth() === targetMonth && billDate.getFullYear() === targetYear;
            });
        }
        this.renderBills();
    }

    searchBills() {
        this.renderBills();
    }

    markBillAsPaid(billId) {
        const bill = this.bills.find(b => b.id === billId);
        if (bill) {
            // Mark all splits as paid
            bill.splits.forEach(split => {
                split.paid = true;
            });
            this.saveData('bills', this.bills);
            this.renderBills();
            this.addNotification('Bill Marked as Paid', `${bill.description} has been marked as fully paid.`);
        }
    }

    editBill(billId) {
        const bill = this.bills.find(b => b.id === billId);
        if (!bill) return;

        // Pre-fill the form with existing bill data
        document.getElementById('bill-description').value = bill.description;
        document.getElementById('bill-amount').value = bill.amount;
        document.getElementById('bill-paid-by').value = bill.paidBy;
        document.getElementById('bill-split-type').value = bill.splitType;
        document.getElementById('bill-due-date').value = bill.dueDate;

        // Update split details based on type
        this.updateBillSplitType(bill.splitType);

        // Store the bill ID for updating
        document.getElementById('add-bill-modal').dataset.editingBillId = billId;

        // Change the save button text
        document.getElementById('save-bill').textContent = 'Update Bill';

        this.openModal('add-bill-modal');
    }

    settleUpBill(billId) {
        const bill = this.bills.find(b => b.id === billId);
        if (!bill) return;

        // Create a simple modal for settling up
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Settle Up - ${bill.description}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Select who has paid their portion:</p>
                    ${bill.splits.map(split => {
                        const roommate = this.roommates.find(r => r.id === split.userId);
                        return `
                            <div class="settle-up-item">
                                <label>
                                    <input type="checkbox" ${split.paid ? 'checked' : ''} 
                                           onchange="app.toggleBillPayment('${billId}', '${split.userId}', this.checked)">
                                    ${roommate?.name || 'Unknown'} - $${split.amount.toFixed(2)}
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    toggleBillPayment(billId, userId, paid) {
        const bill = this.bills.find(b => b.id === billId);
        if (bill) {
            const split = bill.splits.find(s => s.userId === userId);
            if (split) {
                split.paid = paid;
                this.saveData('bills', this.bills);
                this.renderBills();
                this.showNotification(`${paid ? 'Marked as paid' : 'Marked as unpaid'}`, 'success');
            }
        }
    }

    deleteBill(billId) {
        if (confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
            this.bills = this.bills.filter(b => b.id !== billId);
            this.saveData('bills', this.bills);
            this.renderBills();
            this.addNotification('Bill Deleted', 'The bill has been successfully deleted.');
        }
    }

    updateBillSplitType(splitType) {
        const splitDetails = document.getElementById('split-details');
        splitDetails.innerHTML = '';
        
        if (splitType === 'percentage') {
            splitDetails.innerHTML = `
                <h4>Percentage Split</h4>
                <div id="percentage-splits">
                    ${this.roommates.map(roommate => `
                        <div class="form-group split-row" data-roommate-id="${roommate.id}">
                            <label for="percentage-${roommate.id}">${roommate.name} (%)</label>
                            <div class="split-input-group">
                                <input type="number" id="percentage-${roommate.id}" min="0" max="100" value="${Math.round(100 / this.roommates.length)}" required>
                                <button type="button" class="btn btn-small btn-danger" onclick="app.removeSplitRow('${roommate.id}', 'percentage')" title="Remove">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-group">
                    <button type="button" class="btn btn-small btn-secondary" onclick="app.calculatePercentages()">
                        <i class="fas fa-calculator"></i> Auto-calculate Equal
                    </button>
                </div>
            `;
        } else if (splitType === 'custom') {
            splitDetails.innerHTML = `
                <h4>Custom Amount Split</h4>
                <div id="custom-splits">
                    ${this.roommates.map(roommate => `
                        <div class="form-group split-row" data-roommate-id="${roommate.id}">
                            <label for="custom-${roommate.id}">${roommate.name} ($)</label>
                            <div class="split-input-group">
                                <input type="number" id="custom-${roommate.id}" min="0" step="0.01" value="0" required>
                                <button type="button" class="btn btn-small btn-danger" onclick="app.removeSplitRow('${roommate.id}', 'custom')" title="Remove">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-group">
                    <button type="button" class="btn btn-small btn-secondary" onclick="app.calculateCustomSplit()">
                        <i class="fas fa-calculator"></i> Calculate Remaining
                    </button>
                </div>
            `;
        }
    }

    calculatePercentages() {
        const equalPercentage = Math.round(100 / this.roommates.length);
        this.roommates.forEach(roommate => {
            const input = document.getElementById(`percentage-${roommate.id}`);
            if (input) input.value = equalPercentage;
        });
    }

    calculateCustomSplit() {
        const totalAmount = parseFloat(document.getElementById('bill-amount').value) || 0;
        let totalEntered = 0;
        
        this.roommates.forEach(roommate => {
            const input = document.getElementById(`custom-${roommate.id}`);
            if (input) {
                totalEntered += parseFloat(input.value) || 0;
            }
        });
        
        const remaining = totalAmount - totalEntered;
        if (remaining > 0) {
            this.showNotification(`Remaining amount: $${remaining.toFixed(2)}`, 'info');
        } else if (remaining < 0) {
            this.showNotification(`Over by: $${Math.abs(remaining).toFixed(2)}`, 'warning');
        }
    }

    removeSplitRow(roommateId, splitType) {
        const splitRow = document.querySelector(`[data-roommate-id="${roommateId}"]`);
        if (splitRow) {
            splitRow.remove();
            // Recalculate percentages if needed
            if (splitType === 'percentage') {
                this.calculatePercentages();
            } else if (splitType === 'custom') {
                this.calculateCustomSplit();
            }
        }
    }

    // Events Management
    renderEvents() {
        const container = document.getElementById('events-list');
        container.innerHTML = '';

        const activeTab = document.querySelector('.event-tab.active').dataset.eventTab;
        
        if (activeTab === 'upcoming') {
            this.renderUpcomingEvents(container);
        } else if (activeTab === 'polls') {
            this.renderPolls(container);
        }
    }

    renderUpcomingEvents(container) {
        if (this.events.length === 0) {
            container.innerHTML = '<p class="text-center">No upcoming events. Create an event to get started!</p>';
            return;
        }

        this.events.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event-item';
            
            const isCurrentUser = event.creator === this.settings.currentUserId;
            const creator = isCurrentUser ? this.userProfile.name : (this.roommates.find(r => r.id === event.creator)?.name || 'Unknown');
            const youIndicator = isCurrentUser ? ' (YOU)' : '';
            
            eventElement.innerHTML = `
                <div class="event-item-header">
                    <div class="event-item-title">${event.title}</div>
                    <div class="event-item-date">${this.formatDate(new Date(event.date))}</div>
                </div>
                <div class="event-item-details">
                    <div class="event-item-description">${event.description}</div>
                    <div class="event-item-location">📍 ${event.location}</div>
                    <div class="event-item-creator">Created by ${creator}${youIndicator}</div>
                </div>
            `;
            
            container.appendChild(eventElement);
        });
    }

    renderPolls(container) {
        if (this.polls.length === 0) {
            container.innerHTML = '<p class="text-center">No active polls. Create a poll to get started!</p>';
            return;
        }

        this.polls.forEach(poll => {
            const pollElement = document.createElement('div');
            pollElement.className = 'poll-item';
            
            const isCurrentUser = poll.creator === this.settings.currentUserId;
            const creator = isCurrentUser ? this.userProfile.name : (this.roommates.find(r => r.id === poll.creator)?.name || 'Unknown');
            const youIndicator = isCurrentUser ? ' (YOU)' : '';
            const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
            
            pollElement.innerHTML = `
                <div class="poll-item-header">
                    <div class="poll-item-title">${poll.question}</div>
                    <div class="poll-item-expiry">Expires: ${this.formatDate(new Date(poll.expiryDate))}</div>
                </div>
                <div class="poll-item-details">
                    <div class="poll-item-description">${poll.description}</div>
                    <div class="poll-item-creator">Created by ${creator}${youIndicator}</div>
                </div>
                <div class="poll-options">
                    ${poll.options.map(option => `
                        <div class="poll-option" onclick="app.voteOnPoll('${poll.id}', '${option.text}')">
                            <span>${option.text}</span>
                            <span class="poll-option-votes">${option.votes} votes</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            container.appendChild(pollElement);
        });
    }


    saveEvent() {
        const title = document.getElementById('event-title').value;
        const description = document.getElementById('event-description').value;
        const date = document.getElementById('event-date').value;
        const time = document.getElementById('event-time').value;
        const location = document.getElementById('event-location').value;
        const creator = document.getElementById('event-creator').value;

        if (!title || !date || !creator) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const event = {
            id: Date.now().toString(),
            title,
            description,
            date,
            time,
            location,
            creator,
            attendees: [creator],
            createdAt: new Date().toISOString()
        };

        this.events.push(event);
        this.saveData('events', this.events);
        this.renderEvents();
        this.closeModal('create-event-modal');
        this.showNotification('Event created successfully!', 'success');
    }

    updatePollType() {
        const pollType = document.getElementById('poll-type').value;
        const container = document.getElementById('poll-options-container');
        
        container.innerHTML = '';
        
        switch (pollType) {
            case 'multiple-choice':
                container.innerHTML = `
                    <div class="poll-option-inputs">
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" placeholder="Option 1" required>
                            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
                        </div>
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" placeholder="Option 2" required>
                            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
                        </div>
                    </div>
                    <button type="button" class="btn btn-small btn-secondary" onclick="app.addPollOption()">
                        <i class="fas fa-plus"></i> Add Option
                    </button>
                `;
                break;
                
            case 'yes-no':
                container.innerHTML = `
                    <div class="poll-option-inputs">
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" value="Yes" readonly>
                        </div>
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" value="No" readonly>
                        </div>
                    </div>
                `;
                break;
                
            case 'rating':
                container.innerHTML = `
                    <div class="rating-options">
                        <div class="rating-item">
                            <span>1 Star</span>
                            <input type="radio" name="rating" value="1" disabled>
                        </div>
                        <div class="rating-item">
                            <span>2 Stars</span>
                            <input type="radio" name="rating" value="2" disabled>
                        </div>
                        <div class="rating-item">
                            <span>3 Stars</span>
                            <input type="radio" name="rating" value="3" disabled>
                        </div>
                        <div class="rating-item">
                            <span>4 Stars</span>
                            <input type="radio" name="rating" value="4" disabled>
                        </div>
                        <div class="rating-item">
                            <span>5 Stars</span>
                            <input type="radio" name="rating" value="5" disabled>
                        </div>
                    </div>
                `;
                break;
                
            case 'ranking':
                container.innerHTML = `
                    <div class="poll-option-inputs">
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" placeholder="Option 1" required>
                            <span class="ranking-number">1</span>
                        </div>
                        <div class="poll-option-item">
                            <input type="text" class="poll-option-input" placeholder="Option 2" required>
                            <span class="ranking-number">2</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-small btn-secondary" onclick="app.addPollOption()">
                        <i class="fas fa-plus"></i> Add Option
                    </button>
                `;
                break;
                
            case 'date-picker':
                container.innerHTML = `
                    <div class="date-options">
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" id="poll-start-date">
                        </div>
                        <div class="form-group">
                            <label>End Date</label>
                            <input type="date" id="poll-end-date">
                        </div>
                        <div class="form-group">
                            <label>Suggested Dates (one per line)</label>
                            <textarea id="poll-suggested-dates" placeholder="2025-09-15&#10;2025-09-20&#10;2025-09-25"></textarea>
                        </div>
                    </div>
                `;
                break;
                
            case 'time-picker':
                container.innerHTML = `
                    <div class="time-options">
                        <div class="form-group">
                            <label>Suggested Times (one per line)</label>
                            <textarea id="poll-suggested-times" placeholder="6:00 PM&#10;7:00 PM&#10;8:00 PM"></textarea>
                        </div>
                    </div>
                `;
                break;
        }
    }

    addPollOption() {
        const container = document.querySelector('.poll-option-inputs');
        const optionCount = container.children.length;
        
        const optionDiv = document.createElement('div');
        optionDiv.className = 'poll-option-item';
        optionDiv.innerHTML = `
            <input type="text" class="poll-option-input" placeholder="Option ${optionCount + 1}" required>
            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(optionDiv);
    }

    savePoll() {
        const question = document.getElementById('poll-question').value;
        const description = document.getElementById('poll-description').value;
        const pollType = document.getElementById('poll-type').value;
        const expiryDate = document.getElementById('poll-expiry').value;
        const anonymous = document.getElementById('poll-anonymous').checked;

        if (!question) {
            this.showNotification('Please fill in the poll question', 'error');
            return;
        }

        let options = [];
        
        switch (pollType) {
            case 'multiple-choice':
            case 'ranking':
                const optionInputs = document.querySelectorAll('.poll-option-input');
                options = Array.from(optionInputs)
                    .map(input => input.value.trim())
                    .filter(value => value)
                    .map((text, index) => ({
                        text,
                        votes: 0,
                        voters: [],
                        order: pollType === 'ranking' ? index + 1 : null
                    }));
                break;
                
            case 'yes-no':
                options = [
                    { text: 'Yes', votes: 0, voters: [] },
                    { text: 'No', votes: 0, voters: [] }
                ];
                break;
                
            case 'rating':
                options = [
                    { text: '1 Star', votes: 0, voters: [] },
                    { text: '2 Stars', votes: 0, voters: [] },
                    { text: '3 Stars', votes: 0, voters: [] },
                    { text: '4 Stars', votes: 0, voters: [] },
                    { text: '5 Stars', votes: 0, voters: [] }
                ];
                break;
                
            case 'date-picker':
                const startDate = document.getElementById('poll-start-date').value;
                const endDate = document.getElementById('poll-end-date').value;
                const suggestedDates = document.getElementById('poll-suggested-dates').value;
                
                if (suggestedDates) {
                    options = suggestedDates.split('\n')
                        .filter(date => date.trim())
                        .map(date => ({
                            text: date.trim(),
            votes: 0,
            voters: []
        }));
                } else if (startDate && endDate) {
                    // Generate date range
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const dates = [];
                    
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        dates.push({
                            text: d.toISOString().split('T')[0],
                            votes: 0,
                            voters: []
                        });
                    }
                    options = dates;
                }
                break;
                
            case 'time-picker':
                const suggestedTimes = document.getElementById('poll-suggested-times').value;
                if (suggestedTimes) {
                    options = suggestedTimes.split('\n')
                        .filter(time => time.trim())
                        .map(time => ({
                            text: time.trim(),
                            votes: 0,
                            voters: []
                        }));
                }
                break;
        }

        if (options.length === 0) {
            this.showNotification('Please add at least one option', 'error');
            return;
        }

        const poll = {
            id: Date.now().toString(),
            question,
            description,
            type: pollType,
            options,
            creator: this.userProfile.name,
            expiryDate,
            anonymous,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        this.polls.push(poll);
        this.saveData('polls', this.polls);
        this.renderEvents();
        this.closeModal('create-poll-modal');
        this.showNotification('Poll created successfully!', 'success');
    }

    switchEventTab(tabName) {
        document.querySelectorAll('.event-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-event-tab="${tabName}"]`).classList.add('active');
        this.renderEvents();
    }

    voteOnPoll(pollId, optionText) {
        const poll = this.polls.find(p => p.id === pollId);
        if (!poll) return;

        const option = poll.options.find(o => o.text === optionText);
        if (!option) return;

        // Check if user already voted
        const currentUser = this.settings.currentUserId;
        const hasVoted = option.voters.includes(currentUser);
        
        if (hasVoted) {
            // Remove vote
            option.votes--;
            option.voters = option.voters.filter(v => v !== currentUser);
        } else {
            // Add vote
            option.votes++;
            option.voters.push(currentUser);
        }

        this.saveData('polls', this.polls);
        this.renderEvents();
    }


    // Chat Functions
    toggleChatPanel() {
        const chatPanel = document.getElementById('chat-panel');
        chatPanel.classList.toggle('active');
        
        if (chatPanel.classList.contains('active')) {
            this.renderChatMessages();
            this.unreadChatCount = 0;
            this.updateChatBadge();
        }
    }

    closeChatPanel() {
        const chatPanel = document.getElementById('chat-panel');
        chatPanel.classList.remove('active');
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        const newMessage = {
            id: Date.now().toString(),
            sender: this.userProfile.name,
            message: message,
            timestamp: new Date(),
            isOwn: true
        };

        this.chatMessages.push(newMessage);
        this.saveData('chatMessages', this.chatMessages);
        this.renderChatMessages();
        
        input.value = '';
        this.scrollToBottom();
        
        // Simulate other users receiving the message
        setTimeout(() => {
            this.simulateOtherUserResponse(message);
        }, 1000 + Math.random() * 2000);
    }

    simulateOtherUserResponse(originalMessage) {
        const responses = [
            "Got it!",
            "Thanks for letting me know",
            "I'll take care of that",
            "Sounds good",
            "On it!",
            "Will do",
            "Perfect",
            "👍",
            "Sure thing",
            "No problem"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const otherUsers = this.roommates.filter(roommate => roommate.name !== this.userProfile.name);
        
        if (otherUsers.length > 0) {
            const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
            
            const responseMessage = {
                id: Date.now().toString(),
                sender: randomUser.name,
                message: randomResponse,
                timestamp: new Date(),
                isOwn: false
            };

            this.chatMessages.push(responseMessage);
            this.saveData('chatMessages', this.chatMessages);
            
            if (!document.getElementById('chat-panel').classList.contains('active')) {
                this.unreadChatCount++;
                this.updateChatBadge();
            } else {
                this.renderChatMessages();
                this.scrollToBottom();
            }
        }
    }

    renderChatMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        
        if (!messagesContainer) {
            console.error('Chat messages container not found!');
            return;
        }
        
        messagesContainer.innerHTML = '';

        if (this.chatMessages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="chat-welcome">
                    <i class="fas fa-comments"></i>
                    <p>Start a conversation with your household!</p>
                </div>
            `;
            return;
        }

        this.chatMessages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${message.isOwn ? 'own' : 'other'}`;
            
            const timeString = message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const senderDisplay = message.isOwn ? message.sender + ' (YOU)' : message.sender;
            messageElement.innerHTML = `
                <div class="message-bubble">${this.escapeHtml(message.message)}</div>
                <div class="message-info">
                    <span class="message-sender">${this.escapeHtml(senderDisplay)}</span>
                    <span class="message-time">${timeString}</span>
                </div>
            `;
            
            messagesContainer.appendChild(messageElement);
        });
        
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateChatBadge() {
        const badge = document.getElementById('chat-badge');
        if (this.unreadChatCount > 0) {
            badge.textContent = this.unreadChatCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    searchChatMessages() {
        const searchTerm = document.getElementById('chat-search').value.toLowerCase().trim();
        if (!searchTerm) {
            this.renderChatMessages();
            return;
        }

        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        const filteredMessages = this.chatMessages.filter(message => 
            message.message.toLowerCase().includes(searchTerm) ||
            message.sender.toLowerCase().includes(searchTerm)
        );

        if (filteredMessages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="chat-welcome">
                    <i class="fas fa-search"></i>
                    <p>No messages found for "${searchTerm}"</p>
                </div>
            `;
            return;
        }

        filteredMessages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${message.isOwn ? 'own' : 'other'}`;
            
            const timeString = message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Highlight search terms
            const highlightedMessage = this.highlightSearchTerm(message.message, searchTerm);
            
            const senderDisplay = message.isOwn ? message.sender + ' (YOU)' : message.sender;
            messageElement.innerHTML = `
                <div class="message-bubble">${highlightedMessage}</div>
                <div class="message-info">
                    <span class="message-sender">${this.escapeHtml(senderDisplay)}</span>
                    <span class="message-time">${timeString}</span>
                </div>
            `;
            
            messagesContainer.appendChild(messageElement);
        });
        
        this.scrollToBottom();
    }

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return this.escapeHtml(text);
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlightedText = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        return highlightedText;
    }

    // Profile Photo Upload Functions
    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('preview-img');
            const photoPreview = document.getElementById('photo-preview');
            const uploadPlaceholder = document.querySelector('.upload-placeholder');
            
            previewImg.src = e.target.result;
            photoPreview.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removePhoto() {
        const photoPreview = document.getElementById('photo-preview');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const photoInput = document.getElementById('photo-input');
        
        photoPreview.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';
        photoInput.value = '';
    }

    async saveProfile() {
        const name = document.getElementById('profile-name-input').value;
        const email = document.getElementById('profile-email-input').value;
        const color = document.getElementById('profile-color-input').value;
        const photoInput = document.getElementById('photo-input');
        
        if (!name || !email) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Update user profile (independent of roommates)
        this.userProfile.name = name;
        this.userProfile.email = email;
        this.userProfile.color = color;
        
        // Handle photo upload with Firebase Storage
            if (photoInput.files[0]) {
            try {
                const file = photoInput.files[0];
                const fileName = `profile-${this.currentUser?.uid || 'default'}-${Date.now()}.${file.name.split('.').pop()}`;
                const storageRef = this.firebase.ref(this.firebase.storage, `profile-pictures/${fileName}`);
                
                // Show loading
                this.showNotification('Uploading profile picture...', 'info');
                
                // Upload to Firebase Storage
                const snapshot = await this.firebase.uploadBytes(storageRef, file);
                const downloadURL = await this.firebase.getDownloadURL(snapshot.ref);
                
                this.userProfile.avatar = downloadURL;
                this.userProfile.avatarPath = `profile-pictures/${fileName}`;
                
                // Log analytics event
                this.firebase.logEvent(this.firebase.analytics, 'profile_picture_uploaded', {
                    user_id: this.currentUser?.uid,
                    file_size: file.size,
                    file_type: file.type
                });
                
                this.updateProfileDisplay();
                await this.saveData('userProfile', this.userProfile);
                this.showNotification('Profile updated successfully!', 'success');
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                this.showNotification('Error uploading profile picture', 'error');
                // Fallback to local storage
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.userProfile.avatar = e.target.result;
                    this.updateProfileDisplay();
                    this.saveData('userProfile', this.userProfile);
                };
                reader.readAsDataURL(photoInput.files[0]);
            }
            } else {
            // Save user profile data and update display
            await this.saveData('userProfile', this.userProfile);
                this.updateProfileDisplay();
        }
        
        // Also update the current user's name and color in roommates list
        const currentUser = this.roommates.find(r => r.id === this.settings.currentUserId);
        if (currentUser) {
            currentUser.name = name;
            currentUser.color = color;
            await this.saveData('roommates', this.roommates);
        }
        
        // Log analytics event
        this.firebase.logEvent(this.firebase.analytics, 'profile_updated', {
            user_id: this.currentUser?.uid,
            has_avatar: !!this.userProfile.avatar
        });
        
        this.renderRoommates(); // Refresh roommates display
        this.closeModal('profile-photo-modal');
        this.showNotification('Profile updated successfully!', 'success');
    }

    openProfileModal() {
        // Pre-fill the profile modal with current user data
        document.getElementById('profile-name-input').value = this.userProfile.name;
        document.getElementById('profile-email-input').value = this.userProfile.email;
        document.getElementById('profile-color-input').value = this.userProfile.color || '#1a73e8';
        
        // Clear any existing photo selection
        document.getElementById('photo-input').value = '';
        
        this.openModal('profile-photo-modal');
    }

    updateProfileDisplay() {
        const profileName = document.getElementById('profile-name');
        const profileImg = document.getElementById('profile-img');
        const avatarPlaceholder = document.getElementById('avatar-placeholder');
        const profileContainer = document.querySelector('.profile-info');

        profileName.textContent = this.userProfile.name;

        if (this.userProfile.avatar && this.userProfile.avatar.startsWith('data:')) {
            profileImg.src = this.userProfile.avatar;
            profileImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            profileImg.style.display = 'none';
            avatarPlaceholder.style.display = 'block';
            avatarPlaceholder.textContent = this.userProfile.avatar || '👤';
        }
        
        // Update profile container with user's color
        if (profileContainer) {
            const userColor = this.userProfile.color || '#1a73e8';
            profileContainer.style.backgroundColor = userColor;
            profileContainer.style.color = 'white';
            profileContainer.style.borderRadius = '8px';
            profileContainer.style.padding = '12px';
        }
        
        // Update personal schedule title
        this.updatePersonalScheduleTitle();
    }
    
    updatePersonalScheduleTitle() {
        const titleElement = document.getElementById('personal-schedule-title');
        if (titleElement) {
            titleElement.textContent = `${this.userProfile.name}'s Schedule`;
        }
    }

    // Enhanced Roommate Rendering with Photos
    renderRoommates() {
        const container = document.getElementById('roommates-list');
        container.innerHTML = '';

        // Create a combined list with current user first, then other roommates
        let currentUser;
        if (this.isGuest) {
            // Guest user - show as "Guest"
            currentUser = {
                id: this.settings.currentUserId,
                name: 'Guest User',
                email: 'guest@example.com',
                color: this.userProfile.color || '#1a73e8',
                avatar: null,
                isCurrentUser: true,
                isGuest: true
            };
        } else {
            // Authenticated user - show profile information
            currentUser = {
                id: this.settings.currentUserId,
                name: this.userProfile.name,
                email: this.userProfile.email,
                color: this.userProfile.color || '#1a73e8',
                avatar: this.userProfile.avatar,
                isCurrentUser: true,
                isGuest: false
            };
        }

        const allRoommates = [currentUser, ...this.roommates.filter(r => r.id !== this.settings.currentUserId)];

        if (allRoommates.length === 0) {
            container.innerHTML = '<p class="text-center">No roommates added yet. Add some roommates to get started!</p>';
            return;
        }

        allRoommates.forEach(roommate => {
            const roommateElement = document.createElement('div');
            roommateElement.className = 'roommate-card';
            
            const preferences = this.roommatePreferences[roommate.id] || {};
            const stats = this.calculateRoommateStats(roommate.id);
            
            roommateElement.innerHTML = `
                <div class="roommate-card-header" style="background-color: ${roommate.color}; color: #202124; border-radius: 8px 8px 0 0; padding: 16px;">
                    <div class="roommate-avatar" onclick="app.openRoommateProfile('${roommate.id}')">
                        ${roommate.avatar && roommate.avatar.startsWith('data:') ? 
                            `<img src="${roommate.avatar}" alt="${roommate.name}">` : 
                            `<div class="avatar-placeholder" style="background-color: ${roommate.color}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${roommate.name.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="roommate-info">
                        <h3 style="color: #202124; margin: 0 0 4px 0; font-weight: 600;">
                            ${roommate.name}
                            ${roommate.id === this.settings.currentUserId ? ' <span style="background: #1a73e8; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: 500;">YOU</span>' : ''}
                        </h3>
                    </div>
                    <div class="roommate-actions">
                        <button class="btn btn-small btn-secondary" onclick="app.openRoommateProfile('${roommate.id}')" title="Edit ${roommate.id === this.settings.currentUserId ? 'your profile' : 'roommate info'}" style="background: #4CAF50; color: white; border: 1px solid #45a049; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${roommate.id !== this.settings.currentUserId ? `
                            <button class="btn btn-small btn-danger" onclick="app.deleteRoommate('${roommate.id}')" title="Remove roommate" style="background: #f44336; color: white; border: 1px solid #d32f2f; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="roommate-stats" style="background: white; border-radius: 0 0 8px 8px; padding: 16px; border: 1px solid #e0e0e0; border-top: none;">
                    <div class="stat-item">
                        <span class="stat-value" style="color: #202124; font-weight: 600;">${stats.choresCompleted}</span>
                        <span class="stat-label" style="color: #5f6368;">Chores Done</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color: #202124; font-weight: 600;">${stats.billsPaid}</span>
                        <span class="stat-label" style="color: #5f6368;">Bills Paid</span>
                    </div>
                </div>
            `;
            
            container.appendChild(roommateElement);
        });
    }

    calculateRoommateStats(roommateId) {
        const choresCompleted = this.choreCompletions.filter(c => c.userId === roommateId).length;
        const billsPaid = this.bills.reduce((count, bill) => {
            return count + bill.splits.filter(s => s.userId === roommateId && s.paid).length;
        }, 0);
        
        return {
            choresCompleted,
            billsPaid
        };
    }

    openRoommateProfile(roommateId) {
        const isCurrentUser = roommateId === this.settings.currentUserId;
        
        if (isCurrentUser) {
            // For current user, use the regular profile modal
            document.getElementById('profile-name-input').value = this.userProfile.name;
            document.getElementById('profile-email-input').value = this.userProfile.email;
            document.getElementById('profile-color-input').value = this.userProfile.color || '#1a73e8';
            
            // Clear any existing photo selection
            document.getElementById('photo-input').value = '';
        
        this.openModal('profile-photo-modal');
        } else {
            // For other roommates, find them in the roommates list
        const roommate = this.roommates.find(r => r.id === roommateId);
        if (!roommate) return;

            // Store the roommate being edited
            this.currentEditingRoommateId = roommateId;
            
            // Create a separate edit modal
            this.createRoommateEditModal(roommate);
        }
    }

    createRoommateEditModal(roommate) {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('roommate-edit-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create the modal
        const modal = document.createElement('div');
        modal.id = 'roommate-edit-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit ${roommate.name}'s Information</h3>
                    <button class="close-btn" onclick="app.closeModal('roommate-edit-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="roommate-edit-name">Name</label>
                        <input type="text" id="roommate-edit-name" value="${roommate.name}" readonly>
                        <small class="form-help">Name cannot be changed by others</small>
                    </div>
                    <div class="form-group">
                        <label for="roommate-edit-email">Email</label>
                        <input type="email" id="roommate-edit-email" value="${roommate.email}">
                    </div>
                    <div class="form-group">
                        <label for="roommate-edit-color">Color</label>
                        <select id="roommate-edit-color">
                            <option value="#FF6B6B" ${roommate.color === '#FF6B6B' ? 'selected' : ''} style="background-color: #FF6B6B; color: white;">Red</option>
                            <option value="#FF8C00" ${roommate.color === '#FF8C00' ? 'selected' : ''} style="background-color: #FF8C00; color: white;">Orange</option>
                            <option value="#FFD700" ${roommate.color === '#FFD700' ? 'selected' : ''} style="background-color: #FFD700; color: black;">Yellow</option>
                            <option value="#32CD32" ${roommate.color === '#32CD32' ? 'selected' : ''} style="background-color: #32CD32; color: white;">Green</option>
                            <option value="#00CED1" ${roommate.color === '#00CED1' ? 'selected' : ''} style="background-color: #00CED1; color: white;">Cyan</option>
                            <option value="#1E90FF" ${roommate.color === '#1E90FF' ? 'selected' : ''} style="background-color: #1E90FF; color: white;">Blue</option>
                            <option value="#8A2BE2" ${roommate.color === '#8A2BE2' ? 'selected' : ''} style="background-color: #8A2BE2; color: white;">Purple</option>
                            <option value="#FF1493" ${roommate.color === '#FF1493' ? 'selected' : ''} style="background-color: #FF1493; color: white;">Pink</option>
                            <option value="#FF4500" ${roommate.color === '#FF4500' ? 'selected' : ''} style="background-color: #FF4500; color: white;">Red Orange</option>
                            <option value="#00FF7F" ${roommate.color === '#00FF7F' ? 'selected' : ''} style="background-color: #00FF7F; color: black;">Spring Green</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.closeModal('roommate-edit-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.saveRoommateEdit()">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    saveRoommateEdit() {
        const roommateId = this.currentEditingRoommateId;
        const roommate = this.roommates.find(r => r.id === roommateId);
        if (!roommate) return;

        const email = document.getElementById('roommate-edit-email').value;
        const color = document.getElementById('roommate-edit-color').value;

        if (!email) {
            this.showNotification('Email is required', 'error');
            return;
        }

        // Update roommate information
        roommate.email = email;
        roommate.color = color;

        this.saveData('roommates', this.roommates);
        this.renderRoommates();
        this.renderCalendar();
        this.renderChoresList();
        this.renderPersonalSchedule();
        this.closeModal('roommate-edit-modal');
        this.showNotification('Roommate information updated successfully!', 'success');
    }


    // Enhanced Notifications System
    showNotificationsPanel() {
        const unreadNotifications = this.notifications.filter(n => !n.read);
        const readNotifications = this.notifications.filter(n => n.read);
        
        // Create notifications dropdown
        let existingPanel = document.getElementById('notifications-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'notifications-panel';
        panel.className = 'notifications-panel';
        
        panel.innerHTML = `
            <div class="notifications-header">
                <h3>Notifications</h3>
                <button class="close-btn" id="close-notifications-btn">&times;</button>
            </div>
            <div class="notifications-tabs">
                <button class="notification-tab active" data-tab="current">Current (${unreadNotifications.length})</button>
                <button class="notification-tab" data-tab="past">Past (${readNotifications.length})</button>
            </div>
            <div class="notifications-actions">
                <button class="btn btn-small btn-secondary" id="mark-all-read-btn" ${unreadNotifications.length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-check-double"></i> Mark All Read
                </button>
                <button class="btn btn-small btn-danger" id="delete-all-btn" ${this.notifications.length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i> Delete All
                </button>
            </div>
            <div class="notifications-content" id="notifications-content">
                ${this.renderNotificationsContent(unreadNotifications)}
            </div>
        `;

        // Add close button functionality
        panel.querySelector('#close-notifications-btn').addEventListener('click', () => {
            this.closeNotificationsPanel();
        });

        // Add tab switching functionality
        panel.querySelectorAll('.notification-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabType = e.target.dataset.tab;
                const content = panel.querySelector('#notifications-content');
                
                // Update active tab
                panel.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // Get fresh notification data
                const currentUnreadNotifications = this.notifications.filter(n => !n.read);
                const currentReadNotifications = this.notifications.filter(n => n.read);
                
                // Update tab counts
                const currentTab = panel.querySelector('[data-tab="current"]');
                const pastTab = panel.querySelector('[data-tab="past"]');
                currentTab.textContent = `Current (${currentUnreadNotifications.length})`;
                pastTab.textContent = `Past (${currentReadNotifications.length})`;
                
                // Update content
                if (tabType === 'current') {
                    content.innerHTML = this.renderNotificationsContent(currentUnreadNotifications);
                } else {
                    content.innerHTML = this.renderNotificationsContent(currentReadNotifications);
                }
            });
        });

        // Add bulk action functionality
        panel.querySelector('#mark-all-read-btn').addEventListener('click', () => {
            this.markAllAsRead();
        });

        panel.querySelector('#delete-all-btn').addEventListener('click', () => {
            this.deleteAllNotifications();
        });

        // Position the panel
        const button = document.getElementById('notifications-btn');
        const rect = button.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.right = '24px';
        panel.style.zIndex = '1000';

        document.body.appendChild(panel);

        // Close panel when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!panel.contains(e.target) && !button.contains(e.target)) {
                    this.closeNotificationsPanel();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    renderNotificationsContent(notifications) {
        if (notifications.length === 0) {
            return `
                <div class="notification-item">
                    <div class="notification-content">
                        <p>No notifications</p>
                    </div>
                </div>
            `;
        }

        return notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <div class="notification-icon">
                    <i class="fas ${notification.icon}"></i>
                </div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.message}</p>
                    <span class="notification-time">${this.formatTimeAgo(notification.createdAt)}</span>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? `
                        <button class="btn btn-small btn-secondary" onclick="app.markAsRead('${notification.id}')" title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                        <button class="btn btn-small btn-danger" onclick="app.deleteNotification('${notification.id}')" title="Delete notification">
                            <i class="fas fa-trash"></i>
                        </button>
                </div>
            </div>
        `).join('');
    }

    closeNotificationsPanel() {
        const panel = document.getElementById('notifications-panel');
        if (panel) {
            panel.remove();
        }
    }

    getNotifications() {
        return this.notifications.filter(n => !n.read).slice(0, 10);
    }

    addNotification(title, message, icon = 'fa-bell', type = 'info') {
        const notification = {
            id: Date.now().toString(),
            title,
            message,
            icon,
            type,
            read: false,
            createdAt: new Date().toISOString()
        };

        this.notifications.unshift(notification);
        this.saveData('notifications', this.notifications);
        this.updateNotificationBadge();
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveData('notifications', this.notifications);
            this.updateNotificationBadge();
            
            // Refresh the panel content without closing it
            this.refreshNotificationsPanel();
            
            // Automatically switch to Past tab to show the read notification
            setTimeout(() => {
                const pastTab = document.querySelector('[data-tab="past"]');
                if (pastTab) {
                    pastTab.click();
                }
            }, 100);
            
            // Show success message
            this.showNotification('Notification marked as read', 'success');
        }
    }

    updateNotificationBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-count');
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    deleteNotification(notificationId) {
        if (confirm('Are you sure you want to delete this notification?')) {
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.saveData('notifications', this.notifications);
            this.updateNotificationBadge();
            
            // Refresh the panel content without closing it
            this.refreshNotificationsPanel();
            
            // Show success message
            this.showNotification('Notification deleted', 'success');
        }
    }

    markAllAsRead() {
        const unreadNotifications = this.notifications.filter(n => !n.read);
        if (unreadNotifications.length === 0) {
            this.showNotification('No unread notifications to mark', 'info');
            return;
        }

        if (confirm(`Are you sure you want to mark all ${unreadNotifications.length} notifications as read?`)) {
            unreadNotifications.forEach(notification => {
                notification.read = true;
            });
            
            this.saveData('notifications', this.notifications);
            this.updateNotificationBadge();
            
            // Refresh the panel content without closing it
            this.refreshNotificationsPanel();
            
            this.showNotification(`Marked ${unreadNotifications.length} notifications as read`, 'success');
        }
    }

    deleteAllNotifications() {
        if (this.notifications.length === 0) {
            this.showNotification('No notifications to delete', 'info');
            return;
        }

        if (confirm(`Are you sure you want to delete all ${this.notifications.length} notifications?`)) {
            this.notifications = [];
            this.saveData('notifications', this.notifications);
            this.updateNotificationBadge();
            
            // Refresh the panel content without closing it
            this.refreshNotificationsPanel();
            
            this.showNotification('All notifications deleted', 'success');
        }
    }

    refreshNotificationsPanel() {
        const panel = document.getElementById('notifications-panel');
        if (!panel) return;

        const unreadNotifications = this.notifications.filter(n => !n.read);
        const readNotifications = this.notifications.filter(n => n.read);
        
        // Update tab counts
        const currentTab = panel.querySelector('[data-tab="current"]');
        const pastTab = panel.querySelector('[data-tab="past"]');
        currentTab.textContent = `Current (${unreadNotifications.length})`;
        pastTab.textContent = `Past (${readNotifications.length})`;
        
        // Update bulk action buttons
        const markAllBtn = panel.querySelector('#mark-all-read-btn');
        const deleteAllBtn = panel.querySelector('#delete-all-btn');
        markAllBtn.disabled = unreadNotifications.length === 0;
        deleteAllBtn.disabled = this.notifications.length === 0;
        
        // Update content based on active tab
        const activeTab = panel.querySelector('.notification-tab.active');
        const content = panel.querySelector('#notifications-content');
        
        if (activeTab.dataset.tab === 'current') {
            content.innerHTML = this.renderNotificationsContent(unreadNotifications);
        } else {
            content.innerHTML = this.renderNotificationsContent(readNotifications);
        }
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }

    // Initialize sample notifications
    initializeSampleNotifications() {
        if (this.notifications.length === 0) {
            this.addNotification(
                'Chore Reminder',
                'Take out trash is due today',
                'fa-broom',
                'reminder'
            );
            this.addNotification(
                'Bill Payment',
                'Electricity bill is due in 2 days',
                'fa-receipt',
                'payment'
            );
            this.addNotification(
                'New Event',
                'Movie night scheduled for Friday',
                'fa-calendar',
                'event'
            );
        }
    }

    // Check for upcoming chores and send notifications
    checkUpcomingChores() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Check for chores due today
        this.chores.forEach(chore => {
            if (this.isChoreDueToday(chore)) {
                const assignedRoommate = this.roommates.find(r => r.id === chore.assignedTo);
                if (assignedRoommate && assignedRoommate.id === this.settings.currentUserId) {
                    this.addNotification(
                        'Chore Due Today',
                        `You have "${chore.name}" due today`,
                        'fa-broom',
                        'reminder'
                    );
                }
            }
        });
        
        // Check for chores due tomorrow
        this.chores.forEach(chore => {
            if (this.isChoreDueTomorrow(chore)) {
                const assignedRoommate = this.roommates.find(r => r.id === chore.assignedTo);
                if (assignedRoommate && assignedRoommate.id === this.settings.currentUserId) {
                    this.addNotification(
                        'Chore Due Tomorrow',
                        `You have "${chore.name}" due tomorrow`,
                        'fa-broom',
                        'reminder'
                    );
                }
            }
        });
    }

    isChoreDueToday(chore) {
        const today = new Date();
        switch (chore.frequency) {
            case 'daily':
                return true;
            case 'weekly':
                return this.isSameDayOfWeek(today, new Date(chore.createdAt));
            case 'monthly':
                return today.getDate() === new Date(chore.createdAt).getDate();
            case 'none':
                return this.isSameDay(today, new Date(chore.createdAt));
            default:
                return false;
        }
    }

    isChoreDueTomorrow(chore) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        switch (chore.frequency) {
            case 'daily':
                return true;
            case 'weekly':
                return this.isSameDayOfWeek(tomorrow, new Date(chore.createdAt));
            case 'monthly':
                return tomorrow.getDate() === new Date(chore.createdAt).getDate();
            case 'none':
                return this.isSameDay(tomorrow, new Date(chore.createdAt));
            default:
                return false;
        }
    }

    // Firebase Integration Methods
    async initFirebase() {
        // Wait for Firebase to be available
        let attempts = 0;
        while (!this.firebase && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!this.firebase) {
            console.error('Firebase not loaded after 5 seconds');
            return;
        }

        console.log('Firebase initialized successfully');

        // Initialize push notifications
        this.initPushNotifications();

        // Listen for authentication state changes
        this.firebase.onAuthStateChanged(this.firebase.auth, (user) => {
            console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
            if (user) {
                this.currentUser = user;
                this.isOnline = true;
                this.loadUserData();
                this.hideLoginModal();
                this.hideAuthScreen(); // Hide mandatory auth screen
                
                // Log user sign in
                this.firebase.logEvent(this.firebase.analytics, 'login', {
                    method: 'google'
                });
            } else {
                this.currentUser = null;
                this.isOnline = false;
                this.showAuthScreen(); // Show mandatory auth screen instead of login modal
            }
        });
    }

    async initPushNotifications() {
        try {
            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted');
                
                // Get FCM token
                const token = await this.firebase.getToken(this.firebase.messaging, {
                    vapidKey: 'YOUR_VAPID_KEY' // You'll need to generate this in Firebase Console
                });
                
                if (token) {
                    console.log('FCM Token:', token);
                    // Save token to user's document in Firestore
                    if (this.currentUser) {
                        await this.firebase.setDoc(
                            this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid),
                            { fcmToken: token },
                            { merge: true }
                        );
                    }
                }
                
                // Listen for foreground messages
                this.firebase.onMessage(this.firebase.messaging, (payload) => {
                    console.log('Message received:', payload);
                    this.showNotification(payload.notification.title, 'info');
                });
            } else {
                console.log('Notification permission denied');
            }
        } catch (error) {
            console.error('Error initializing push notifications:', error);
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            console.log('Loading user data for:', this.currentUser.uid);
            
            // Load user's household ID
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.householdId = userData.householdId;
                this.userProfile = userData.profile || this.userProfile;
                
                console.log('User household ID:', this.householdId);
                
                // Save user data locally for persistence
                this.saveData('userProfile', this.userProfile);
                this.saveData('householdId', this.householdId);
                
                // Load household data
                await this.loadHouseholdData();
                
                // Sync any pending data
                await this.syncPendingData();
                
                // Auto-save all data for persistence
                await this.autoSaveAllData();
                
                // Log analytics event
                this.firebase.logEvent(this.firebase.analytics, 'user_data_loaded', {
                    user_id: this.currentUser.uid,
                    household_id: this.householdId
                });
            } else {
                console.log('User document not found, creating new user profile');
                // Create user document if it doesn't exist
                await this.firebase.setDoc(
                    this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid),
                    {
                        name: this.userProfile.name,
                        email: this.userProfile.email,
                        profile: this.userProfile,
                        createdAt: new Date().toISOString()
                    }
                );
                
                // Save locally
                this.saveData('userProfile', this.userProfile);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showNotification('Error loading user data. Please try again.', 'error');
        }
    }

    async loadHouseholdData() {
        if (!this.householdId) {
            console.log('No household ID, skipping real-time listeners');
            return;
        }

        console.log('Setting up real-time listeners for household:', this.householdId);

        try {
            // Initialize Realtime Database manager
            this.initFirestore();
            
            // Set up real-time listeners using Firestore
            this.firestoreManager.setupFirestoreListeners(this.householdId, this);

            console.log('All real-time listeners set up successfully');

        } catch (error) {
            console.error('Error loading household data:', error);
        }
    }

    async saveToFirebase(path, data) {
        if (!this.householdId || !this.firebase) return;

        try {
            // For arrays, save each item as a document
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.id) {
                        const docRef = this.firebase.doc(this.firebase.db, 'households', this.householdId, path, item.id);
                        const dataWithMeta = {
                            ...item,
                            updatedAt: new Date(),
                            updatedBy: this.currentUser.uid
                        };
                        await this.firebase.setDoc(docRef, dataWithMeta);
                    }
                }
            } else {
                // For single documents
                const docRef = this.firebase.doc(this.firebase.db, 'households', this.householdId, path, 'data');
                const dataWithMeta = {
                    ...data,
                    updatedAt: new Date(),
                    updatedBy: this.currentUser.uid
                };
                await this.firebase.setDoc(docRef, dataWithMeta);
            }
            console.log('Successfully saved to Firestore:', path);
        } catch (error) {
            console.error('Error saving to Firestore:', error);
        }
    }

    // Initialize Realtime Database manager
    initFirestore() {
        if (!this.firestoreManager) {
            this.firestoreManager = new FirestoreManager(this.firebase);
        }
    }

    // Handle redirect results for popup blocker fallback
    async handleRedirectResult() {
        try {
            const result = await this.firebase.getRedirectResult(this.firebase.auth);
            if (result && result.user) {
                console.log('Redirect sign-in successful:', result.user);
                
                // Process the redirect result the same way as popup
                const user = result.user;
                
                // Check if user already exists
                const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
                
                if (userDoc.exists()) {
                    // Existing user - load their data
                    const userData = userDoc.data();
                    this.householdId = userData.householdId;
                    this.userProfile = userData.profile || this.userProfile;
                    
                    // Save user data locally for persistence
                    this.saveData('userProfile', this.userProfile);
                    this.saveData('householdId', this.householdId);
                    
                    // Load household data
                    await this.loadHouseholdData();
                    this.showNotification('Welcome back!', 'success');
                } else {
                    // New user - update profile with Google data and show household code modal
                    this.userProfile.name = user.displayName || user.email.split('@')[0];
                    this.userProfile.email = user.email;
                    this.userProfile.avatar = user.photoURL;
                    this.userProfile.color = this.generateRandomColor();
                    
                    console.log('Updated user profile with Google data (redirect):', this.userProfile);
                    
                    // Save profile locally
                    this.saveData('userProfile', this.userProfile);
                    
                    // Show household code modal
                    this.showHouseholdCodeModal();
                    return;
                }
                
                // Update profile display immediately
                this.updateProfileDisplay();
                
                // Hide auth screen and show app
                this.hideAuthScreen();
                
                // Initialize app
                this.initializeApp();
            }
        } catch (error) {
            console.error('Error handling redirect result:', error);
        }
    }

    // Check for redirect results on page load (for when user returns from redirect)
    async checkForRedirectResult() {
        try {
            // Check if we have a redirect result in the URL or if user is already authenticated
            const result = await this.firebase.getRedirectResult(this.firebase.auth);
            if (result && result.user) {
                console.log('Found redirect result on page load:', result.user);
                
                // Set current user
                this.currentUser = result.user;
                this.isOnline = true;
                
                // Process the authentication
                await this.processGoogleSignIn(result.user);
            } else if (this.firebase.auth.currentUser) {
                // User is already signed in
                console.log('User already signed in:', this.firebase.auth.currentUser);
                this.currentUser = this.firebase.auth.currentUser;
                this.isOnline = true;
                
                // Check if user has household data
                const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    this.householdId = userData.householdId;
                    this.userProfile = userData.profile || this.userProfile;
                    
                    // Load household data and show app
                    await this.loadHouseholdData();
                    this.hideAuthScreen();
                    this.initializeApp();
                } else {
                    // User exists but no household data - show household code modal
                    this.userProfile.name = this.currentUser.displayName || this.currentUser.email.split('@')[0];
                    this.userProfile.email = this.currentUser.email;
                    this.userProfile.avatar = this.currentUser.photoURL;
                    this.userProfile.color = this.generateRandomColor();
                    
                    this.saveData('userProfile', this.userProfile);
                    this.showHouseholdCodeModal();
                }
            }
        } catch (error) {
            console.error('Error checking for redirect result:', error);
        }
    }

    // Process Google sign-in result (used by both popup and redirect)
    async processGoogleSignIn(user) {
        try {
            console.log('Processing Google sign-in for user:', user);
            
            // Check if user already exists
            const userDoc = await this.firebase.getDoc(this.firebase.doc(this.firebase.db, 'users', user.uid));
            
            if (userDoc.exists()) {
                // Existing user - load their data
                const userData = userDoc.data();
                this.householdId = userData.householdId;
                this.userProfile = userData.profile || this.userProfile;
                
                // Save user data locally for persistence
                this.saveData('userProfile', this.userProfile);
                this.saveData('householdId', this.householdId);
                
                // Load household data
                await this.loadHouseholdData();
                this.showNotification('Welcome back!', 'success');
                
                // Hide auth screen and show app
                this.hideAuthScreen();
                this.initializeApp();
            } else {
                // New user - update profile with Google data and show household code modal
                this.userProfile.name = user.displayName || user.email.split('@')[0];
                this.userProfile.email = user.email;
                this.userProfile.avatar = user.photoURL;
                this.userProfile.color = this.generateRandomColor();
                
                console.log('Updated user profile with Google data:', this.userProfile);
                
                // Save profile locally
                this.saveData('userProfile', this.userProfile);
                
                // Show household code modal
                this.showHouseholdCodeModal();
            }
        } catch (error) {
            console.error('Error processing Google sign-in:', error);
            this.showNotification('Error processing sign-in: ' + error.message, 'error');
        }
    }

    // Set up Firebase auth state listener
    setupAuthStateListener() {
        this.firebase.onAuthStateChanged(this.firebase.auth, async (user) => {
            if (user) {
                console.log('Auth state changed - user signed in:', user);
                this.currentUser = user;
                this.isOnline = true;
                
                // Check if we already processed this user (avoid duplicate processing)
                if (!this.userProfile.name || this.userProfile.name === 'Alex Chen') {
                    await this.processGoogleSignIn(user);
                }
            } else {
                console.log('Auth state changed - user signed out');
                this.currentUser = null;
                this.isOnline = false;
                this.showAuthScreen();
            }
        });
    }

    // Check for popup blockers and provide guidance
    checkPopupBlocker() {
        const testPopup = window.open('', '_blank', 'width=1,height=1');
        if (!testPopup || testPopup.closed || typeof testPopup.closed === 'undefined') {
            // Popup was blocked
            this.showPopupBlockerWarning();
        } else {
            testPopup.close();
        }
    }

    showPopupBlockerWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'popup-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
        `;
        warningDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <i class="fas fa-exclamation-triangle" style="color: #f39c12; margin-right: 8px;"></i>
                <strong>Popup Blocker Detected</strong>
            </div>
            <p style="margin: 0; font-size: 12px; color: #666;">
                For the best experience, please allow popups for this site. 
                <a href="#" onclick="this.parentElement.parentElement.parentElement.remove()" style="color: #007bff;">Dismiss</a>
            </p>
        `;
        document.body.appendChild(warningDiv);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
            }
        }, 10000);
    }

    // Set up mandatory authentication screen
    setupMandatoryAuth() {
        console.log('Setting up mandatory authentication');
        
        // Show auth screen by default
        this.showAuthScreen();
        
        // No popup blocker check needed - using redirect only
        
        // Set up event listeners for auth options - use setTimeout to ensure DOM is ready
        setTimeout(() => {
            const googleBtn = document.getElementById('google-auth-btn');
            const guestBtn = document.getElementById('guest-auth-btn');
            
            console.log('Setting up auth button listeners:', { googleBtn, guestBtn });
            
            if (googleBtn) {
                googleBtn.addEventListener('click', () => {
                    console.log('Google auth button clicked');
                    this.handleGoogleAuth();
                });
            }
            
            if (guestBtn) {
                guestBtn.addEventListener('click', () => {
                    console.log('Guest auth button clicked');
                    this.handleGuestAuth();
                });
            }
        }, 100);
        
        // Also set up event delegation as fallback
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'google-auth-btn') {
                console.log('Google auth button clicked (delegation)');
                this.handleGoogleAuth();
            } else if (e.target && e.target.id === 'guest-auth-btn') {
                console.log('Guest auth button clicked (delegation)');
                this.handleGuestAuth();
            }
        });
    }

    // Show authentication screen
    showAuthScreen() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        
        if (authScreen) {
            authScreen.style.display = 'flex';
        }
        
        if (appContainer) {
            appContainer.style.display = 'none';
        }
    }

    // Hide authentication screen and show app
    hideAuthScreen() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        
        if (authScreen) {
            authScreen.style.display = 'none';
        }
        
        if (appContainer) {
            appContainer.style.display = 'flex';
        }
    }

    // Handle Google authentication
    async handleGoogleAuth() {
        try {
            console.log('Starting Google authentication');
            
            // Check if Firebase is available
            if (!this.firebase || !this.firebase.auth) {
                console.error('Firebase authentication not available');
                this.showNotification('Firebase authentication not configured. Please use Guest mode.', 'error');
                return;
            }
            
            await this.signInWithGoogle();
        } catch (error) {
            console.error('Google authentication failed:', error);
            this.showNotification('Google sign-in failed. Please use Guest mode instead.', 'error');
        }
    }

    // Handle guest authentication
    handleGuestAuth() {
        console.log('User chose guest mode');
        this.isGuest = true;
        this.currentUser = {
            uid: 'guest_' + Date.now(),
            displayName: 'Guest User',
            email: 'guest@example.com',
            photoURL: null
        };
        
        // Set up guest profile
        this.userProfile = {
            name: 'Guest User',
            email: 'guest@example.com',
            avatar: null,
            color: this.generateRandomColor()
        };
        
        // Save guest profile
        this.saveData('userProfile', this.userProfile);
        
        // Hide auth screen and show app
        this.hideAuthScreen();
        
        // Update profile display
        this.updateProfileDisplay();
        
        // Update roommates display
        this.renderRoommates();
        
        // Show guest notification
        this.showNotification('Welcome! You are using guest mode. Data will be saved locally but won\'t sync across devices.', 'info');
        
        console.log('Guest authentication completed');
    }

    async deleteFromFirebase(path) {
        if (!this.householdId) return;

        try {
            const fullPath = `households/${this.householdId}/${path}`;
            const dataRef = this.firebase.ref(this.firebase.database, fullPath);
            await this.firebase.remove(dataRef);
            console.log('Successfully deleted from Realtime Database:', fullPath);
        } catch (error) {
            console.error('Error deleting from Firebase Realtime Database:', error);
        }
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('Login modal shown');
        } else {
            console.error('Login modal not found');
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.style.display = 'none';
            console.log('Login modal hidden');
        }
    }

    async signIn(email, password) {
        try {
            console.log('Attempting sign in...');
            const userCredential = await this.firebase.signInWithEmailAndPassword(this.firebase.auth, email, password);
            console.log('Sign in successful:', userCredential.user);
            
            // Log analytics event
            this.firebase.logEvent(this.firebase.analytics, 'login', {
                method: 'email',
                user_id: userCredential.user.uid
            });
            
            this.showNotification('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Sign in error:', error);
            
            // Log failed login attempt
            this.firebase.logEvent(this.firebase.analytics, 'login_failed', {
                method: 'email',
                error_code: error.code
            });
            
            this.showNotification('Sign in failed: ' + error.message, 'error');
        }
    }

    async signInWithGoogle() {
        try {
            console.log('Attempting Google sign in...');
            
            // Check if Firebase is properly configured
            if (!this.firebase || !this.firebase.auth || !this.firebase.GoogleAuthProvider) {
                throw new Error('Firebase authentication not properly configured');
            }
            
            const provider = new this.firebase.GoogleAuthProvider();
            
            // Use redirect method only (no popup)
            console.log('Using redirect method for Google sign-in...');
            this.showNotification('Redirecting to Google sign-in...', 'info');
            
            // Use redirect method
            await this.firebase.signInWithRedirect(this.firebase.auth, provider);
            return; // Redirect will handle the rest
            
        } catch (error) {
            console.error('Google sign in error:', error);
            
            // Log failed login attempt
            this.firebase.logEvent(this.firebase.analytics, 'login_failed', {
                method: 'google',
                error_code: error.code
            });
            
            this.showNotification('Google sign in failed: ' + error.message, 'error');
        }
    }

    async signIn(email, password) {
        try {
            console.log('Attempting sign in...');
            const userCredential = await this.firebase.signInWithEmailAndPassword(this.firebase.auth, email, password);
            console.log('Sign in successful:', userCredential.user);
            
            // Log analytics event
            this.firebase.logEvent(this.firebase.analytics, 'login', {
                method: 'email',
                user_id: userCredential.user.uid
            });
            
            this.showNotification('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Sign in error:', error);
            
            // Log failed login attempt
            this.firebase.logEvent(this.firebase.analytics, 'login_failed', {
                method: 'email',
                error_code: error.code
            });
            
            this.showNotification('Sign in failed: ' + error.message, 'error');
        }
    }


    showHouseholdCodeModal() {
        const modal = document.getElementById('household-code-modal');
        if (modal) {
            modal.style.display = 'flex';
            console.log('Household code modal shown');
        }
    }

    hideHouseholdCodeModal() {
        const modal = document.getElementById('household-code-modal');
        if (modal) {
            modal.style.display = 'none';
            console.log('Household code modal hidden');
        }
    }

    generateHouseholdCode() {
        // Generate a 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    showHouseholdCodeSuccess(householdCode) {
        // Create success modal if it doesn't exist
        let successModal = document.getElementById('household-success-modal');
        if (!successModal) {
            successModal = document.createElement('div');
            successModal.id = 'household-success-modal';
            successModal.className = 'modal';
            successModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🎉 Household Created Successfully!</h3>
                    </div>
                    <div class="modal-body">
                        <div class="success-content">
                            <div class="household-code-display">
                                <h4>Your Household Code</h4>
                                <div class="code-box">
                                    <span class="household-code">${householdCode}</span>
                                </div>
                                <p>Share this code with your roommates so they can join your household.</p>
                            </div>
                            
                            <div class="success-actions">
                                <button class="btn btn-primary" id="copy-code-btn">
                                    <i class="fas fa-copy"></i>
                                    Copy Code
                                </button>
                                <button class="btn btn-secondary" id="continue-btn">
                                    <i class="fas fa-arrow-right"></i>
                                    Continue to App
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(successModal);
        } else {
            // Update the code if modal exists
            const codeElement = successModal.querySelector('.household-code');
            if (codeElement) {
                codeElement.textContent = householdCode;
            }
        }
        
        successModal.style.display = 'flex';
        
        // Add event listeners
        const copyBtn = document.getElementById('copy-code-btn');
        const continueBtn = document.getElementById('continue-btn');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(householdCode).then(() => {
                    this.showNotification('Household code copied to clipboard!', 'success');
                }).catch(() => {
                    this.showNotification('Failed to copy code', 'error');
                });
            });
        }
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                successModal.style.display = 'none';
                this.initializeApp();
            });
        }
    }

    async createHousehold() {
        try {
            console.log('Creating new household...');
            
            // Generate household code
            const householdCode = this.generateHouseholdCode();
            
            // Create household document
            const householdRef = await this.firebase.addDoc(this.firebase.collection(this.firebase.db, 'households'), {
                code: householdCode,
                name: `${this.userProfile.name}'s Household`,
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser.uid
            });
            
            this.householdId = householdRef.id;
            
            // Add user to household
            await this.firebase.setDoc(
                this.firebase.doc(this.firebase.db, 'households', this.householdId, 'roommates', this.currentUser.uid),
                {
                    name: this.userProfile.name,
                    email: this.userProfile.email,
                    color: this.userProfile.color,
                    userId: this.currentUser.uid,
                    joinedAt: new Date().toISOString()
                }
            );
            
            // Save user data
            await this.firebase.setDoc(
                this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid),
                {
                    name: this.userProfile.name,
                    email: this.userProfile.email,
                    householdId: this.householdId,
                    profile: this.userProfile,
                    createdAt: new Date().toISOString()
                }
            );
            
            // Save locally
            this.saveData('householdId', this.householdId);
            this.saveData('userProfile', this.userProfile);
            
            // Load household data
            await this.loadHouseholdData();
            
            this.hideHouseholdCodeModal();
            this.updateProfileDisplay();
            
            // Show success modal with household code
            this.showHouseholdCodeSuccess(householdCode);
            
        } catch (error) {
            console.error('Error creating household:', error);
            this.showNotification('Error creating household: ' + error.message, 'error');
        }
    }

    async joinHousehold(householdCode) {
        try {
            console.log('Joining household with code:', householdCode);
            
            // Find household by code
            const householdQuery = this.firebase.query(
                this.firebase.collection(this.firebase.db, 'households'),
                this.firebase.where('code', '==', householdCode)
            );
            const householdSnapshot = await this.firebase.getDocs(householdQuery);
            
            if (householdSnapshot.empty) {
                throw new Error('Household code not found');
            }
            
            const householdDoc = householdSnapshot.docs[0];
            this.householdId = householdDoc.id;
            
            // Add user to household
            await this.firebase.setDoc(
                this.firebase.doc(this.firebase.db, 'households', this.householdId, 'roommates', this.currentUser.uid),
                {
                    name: this.userProfile.name,
                    email: this.userProfile.email,
                    color: this.userProfile.color,
                    userId: this.currentUser.uid,
                    joinedAt: new Date().toISOString()
                }
            );
            
            // Save user data
            await this.firebase.setDoc(
                this.firebase.doc(this.firebase.db, 'users', this.currentUser.uid),
                {
                    name: this.userProfile.name,
                    email: this.userProfile.email,
                    householdId: this.householdId,
                    profile: this.userProfile,
                    createdAt: new Date().toISOString()
                }
            );
            
            // Save locally
            this.saveData('householdId', this.householdId);
            this.saveData('userProfile', this.userProfile);
            
            // Load household data
            await this.loadHouseholdData();
            
            this.hideHouseholdCodeModal();
            this.updateProfileDisplay();
            this.showNotification('Joined household successfully!', 'success');
            
        } catch (error) {
            console.error('Error joining household:', error);
            this.showNotification('Error joining household: ' + error.message, 'error');
        }
    }

    async signUp(name, email, password, householdCode) {
        try {
            console.log('Attempting sign up...');
            const userCredential = await this.firebase.createUserWithEmailAndPassword(this.firebase.auth, email, password);
            const user = userCredential.user;
            console.log('User created:', user);
            
            // Create or join household
            let householdId = householdCode;
            if (!householdId) {
                console.log('Creating new household...');
                // Create new household
                const householdRef = await this.firebase.addDoc(this.firebase.collection(this.firebase.db, 'households'), {
                    name: 'My Household',
                    createdAt: new Date().toISOString(),
                    createdBy: user.uid
                });
                householdId = householdRef.id;
                console.log('Household created:', householdId);
            }

            console.log('Saving user data...');
            
            // Auto-update user profile with signup information
            this.userProfile.name = name;
            this.userProfile.email = email;
            this.userProfile.color = this.generateRandomColor();
            
            // Save user data
            await this.firebase.setDoc(this.firebase.doc(this.firebase.db, 'users', user.uid), {
                name: name,
                email: email,
                householdId: householdId,
                profile: this.userProfile
            });
            
            // Save profile locally
            this.saveData('userProfile', this.userProfile);
            
            // Update profile display immediately
            this.updateProfileDisplay();

            console.log('Adding user to household...');
            // Add user to household roommates
            await this.firebase.addDoc(this.firebase.collection(this.firebase.db, 'households', householdId, 'roommates'), {
                name: name,
                email: email,
                color: this.generateRandomColor(),
                userId: user.uid,
                createdAt: new Date().toISOString()
            });

            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            console.error('Sign up error:', error);
            this.showNotification('Sign up failed: ' + error.message, 'error');
        }
    }

    async signOut() {
        try {
            console.log('Signing out user');
            
            // Handle guest users
            if (this.isGuest) {
                console.log('Signing out guest user');
                this.currentUser = null;
                this.isOnline = false;
                this.householdId = null;
                this.isGuest = false;
                
                // Clear all data
                this.clearAllData();
                
                // Show auth screen
                this.showAuthScreen();
                
                this.showNotification('Guest signed out successfully!', 'success');
                return;
            }
            
            // Handle Firebase authenticated users
            if (this.firebase && this.firebase.auth) {
                await this.firebase.signOut(this.firebase.auth);
            }
            
            this.currentUser = null;
            this.isOnline = false;
            this.householdId = null;
            
            // Clear all data
            this.clearAllData();
            
            // Show auth screen
            this.showAuthScreen();
            
            this.showNotification('Signed out successfully!', 'success');
        } catch (error) {
            console.error('Error signing out:', error);
            this.showNotification('Sign out failed: ' + error.message, 'error');
        }
    }

    // Maintenance Contact Settings Functions
    openMaintenanceContactModal() {
        const modal = document.getElementById('maintenance-contact-modal');
        if (modal) {
            // Load current settings
            const settings = this.loadData('maintenanceContact') || {
                type: 'url',
                url: 'https://docs.google.com/forms/d/e/1FAIpQLScaYoRhEz52za3Zv6OPTDoDo-2_H_rzFSrdzpYDGCrFj-tC6A/viewform',
                phone: '',
                label: 'Report to Maintenance'
            };
            
            document.getElementById('maintenance-contact-type').value = settings.type;
            document.getElementById('maintenance-url').value = settings.url;
            document.getElementById('maintenance-phone').value = settings.phone;
            document.getElementById('maintenance-label').value = settings.label;
            
            this.updateMaintenanceContactType();
            modal.style.display = 'flex';
        }
    }

    hideMaintenanceContactModal() {
        const modal = document.getElementById('maintenance-contact-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    updateMaintenanceContactType() {
        const type = document.getElementById('maintenance-contact-type').value;
        const urlGroup = document.getElementById('url-group');
        const phoneGroup = document.getElementById('phone-group');
        
        if (type === 'url') {
            urlGroup.style.display = 'block';
            phoneGroup.style.display = 'none';
        } else {
            urlGroup.style.display = 'none';
            phoneGroup.style.display = 'block';
        }
    }

    saveMaintenanceContact() {
        const type = document.getElementById('maintenance-contact-type').value;
        const url = document.getElementById('maintenance-url').value;
        const phone = document.getElementById('maintenance-phone').value;
        const label = document.getElementById('maintenance-label').value;
        
        const settings = {
            type: type,
            url: url,
            phone: phone,
            label: label
        };
        
        this.saveData('maintenanceContact', settings);
        this.updateMaintenanceButton();
        this.hideMaintenanceContactModal();
        this.showNotification('Maintenance contact settings saved!', 'success');
    }

    updateMaintenanceButton() {
        const settings = this.loadData('maintenanceContact') || {
            type: 'url',
            url: 'https://docs.google.com/forms/d/e/1FAIpQLScaYoRhEz52za3Zv6OPTDoDo-2_H_rzFSrdzpYDGCrFj-tC6A/viewform',
            phone: '',
            label: 'Report to Maintenance'
        };
        
        const button = document.getElementById('report-maintenance-btn');
        if (button) {
            button.innerHTML = `<i class="fas fa-${settings.type === 'url' ? 'external-link-alt' : 'phone'}"></i> ${settings.label}`;
        }
    }

    reportToMaintenance() {
        const settings = this.loadData('maintenanceContact') || {
            type: 'url',
            url: 'https://docs.google.com/forms/d/e/1FAIpQLScaYoRhEz52za3Zv6OPTDoDo-2_H_rzFSrdzpYDGCrFj-tC6A/viewform',
            phone: '',
            label: 'Report to Maintenance'
        };
        
        if (settings.type === 'url' && settings.url) {
            window.open(settings.url, '_blank');
        } else if (settings.type === 'phone' && settings.phone) {
            window.location.href = `tel:${settings.phone}`;
        } else {
            this.showNotification('Maintenance contact not configured. Please set it up first.', 'error');
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HouseholdManager();
    
    // Initialize default roommates if none exist
    if (window.app.roommates.length === 0) {
        window.app.roommates = [
            { id: '1', name: 'You', email: '', color: '#1a73e8', createdAt: new Date().toISOString() },
            { id: '2', name: 'Roommate 1', email: '', color: '#d93025', createdAt: new Date().toISOString() },
            { id: '3', name: 'Roommate 2', email: '', color: '#34a853', createdAt: new Date().toISOString() }
        ];
        window.app.saveData('roommates', window.app.roommates);
        window.app.renderRoommates();
    }
    
    // Initialize default chores if none exist
    if (window.app.chores.length === 0) {
        window.app.chores = [
            { id: '1', name: 'Take out trash', frequency: 'weekly', assignedTo: '1', duration: 15, createdAt: new Date().toISOString() },
            { id: '2', name: 'Vacuum living room', frequency: 'weekly', assignedTo: '2', duration: 30, createdAt: new Date().toISOString() },
            { id: '3', name: 'Mop kitchen floor', frequency: 'weekly', assignedTo: '3', duration: 20, createdAt: new Date().toISOString() },
            { id: '4', name: 'Deep clean bathroom', frequency: 'none', assignedTo: '1', duration: 45, createdAt: new Date().toISOString() }
        ];
        window.app.saveData('chores', window.app.chores);
        window.app.renderCalendar();
    }

    // Login Modal Event Listeners
    setupLoginModal();
});

function setupLoginModal() {
    console.log('Setting up login modal...');
    
    // Wait for elements to be available
    setTimeout(() => {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('Found tab buttons:', tabButtons.length);
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                console.log('Tab clicked:', tab);
                
                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update forms
                document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
                const form = document.getElementById(tab + '-form');
                if (form) {
                    form.classList.add('active');
                }
            });
        });

        // Google Sign-In button
        const googleSignInBtn = document.getElementById('google-signin-btn');
        if (googleSignInBtn) {
            console.log('Found Google sign in button');
            googleSignInBtn.addEventListener('click', () => {
                console.log('Google sign in clicked');
                window.app.signInWithGoogle();
            });
        } else {
            console.error('Google sign in button not found');
        }

        // Sign In button
        const signInBtn = document.getElementById('signin-btn');
        if (signInBtn) {
            console.log('Found sign in button');
            signInBtn.addEventListener('click', () => {
                const email = document.getElementById('login-email')?.value;
                const password = document.getElementById('login-password')?.value;
                
                console.log('Sign in attempt:', { email, password: '***' });
                
                if (email && password) {
                    window.app.signIn(email, password);
                } else {
                    window.app.showNotification('Please fill in all fields', 'error');
                }
            });
        } else {
            console.error('Sign in button not found');
        }

        // Sign Up button
        const signUpBtn = document.getElementById('signup-btn');
        if (signUpBtn) {
            console.log('Found sign up button');
            signUpBtn.addEventListener('click', () => {
                const name = document.getElementById('signup-name')?.value;
                const email = document.getElementById('signup-email')?.value;
                const password = document.getElementById('signup-password')?.value;
                const householdCode = document.getElementById('household-code')?.value;
                
                console.log('Sign up attempt:', { name, email, password: '***', householdCode });
                
                if (name && email && password) {
                    window.app.signUp(name, email, password, householdCode);
                } else {
                    window.app.showNotification('Please fill in all required fields', 'error');
                }
            });
        } else {
            console.error('Sign up button not found');
        }

        // Household Code Modal buttons
        const createHouseholdBtn = document.getElementById('create-household-btn');
        if (createHouseholdBtn) {
            console.log('Found create household button');
            createHouseholdBtn.addEventListener('click', () => {
                console.log('Create household clicked');
                if (window.app && typeof window.app.createHousehold === 'function') {
                    window.app.createHousehold();
                } else {
                    console.error('createHousehold function not found on app object');
                    console.log('Available methods:', Object.getOwnPropertyNames(window.app));
                }
            });
        } else {
            console.error('Create household button not found');
        }

        const joinHouseholdBtn = document.getElementById('join-household-btn');
        if (joinHouseholdBtn) {
            console.log('Found join household button');
            joinHouseholdBtn.addEventListener('click', () => {
                const householdCode = document.getElementById('join-household-code')?.value;
                console.log('Join household clicked with code:', householdCode);
                
                if (householdCode && householdCode.trim() !== '') {
                    if (window.app && typeof window.app.joinHousehold === 'function') {
                        window.app.joinHousehold(householdCode.trim());
                    } else {
                        console.error('joinHousehold function not found on app object');
                        console.log('Available methods:', Object.getOwnPropertyNames(window.app));
                    }
                } else {
                    if (window.app && typeof window.app.showNotification === 'function') {
                        window.app.showNotification('Please enter a household code', 'error');
                    } else {
                        alert('Please enter a household code');
                    }
                }
            });
        } else {
            console.error('Join household button not found');
        }

        // Close modal
        const closeBtn = document.querySelector('#login-modal .close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.app.hideLoginModal();
            });
        }

        // Close on outside click
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'login-modal') {
                    window.app.hideLoginModal();
                }
            });
        }
    }, 1000); // Wait 1 second for elements to load
}

// Also initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
    window.app = new HouseholdManager();
    
    // Initialize default roommates if none exist
    if (window.app.roommates.length === 0) {
        window.app.roommates = [
        { id: '1', name: 'You', email: '', color: '#1a73e8', createdAt: new Date().toISOString() },
        { id: '2', name: 'Roommate 1', email: '', color: '#d93025', createdAt: new Date().toISOString() },
        { id: '3', name: 'Roommate 2', email: '', color: '#34a853', createdAt: new Date().toISOString() }
    ];
        window.app.saveData('roommates', window.app.roommates);
        window.app.renderRoommates();
}

    // Initialize default chores if none exist
    if (window.app.chores.length === 0) {
        window.app.chores = [
        { id: '1', name: 'Take out trash', frequency: 'weekly', assignedTo: '1', duration: 15, createdAt: new Date().toISOString() },
        { id: '2', name: 'Vacuum living room', frequency: 'weekly', assignedTo: '2', duration: 30, createdAt: new Date().toISOString() },
        { id: '3', name: 'Mop kitchen floor', frequency: 'weekly', assignedTo: '3', duration: 20, createdAt: new Date().toISOString() },
        { id: '4', name: 'Deep clean bathroom', frequency: 'none', assignedTo: '1', duration: 45, createdAt: new Date().toISOString() }
    ];
        window.app.saveData('chores', window.app.chores);
        window.app.renderCalendar();
    }
}