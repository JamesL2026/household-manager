// Firebase Realtime Database Implementation
// This replaces the Firestore implementation for better real-time sync

class RealtimeDatabaseManager {
    constructor(firebase) {
        this.firebase = firebase;
        this.listeners = {};
    }

    async saveToRealtimeDatabase(path, data) {
        if (!this.householdId || !this.firebase) return;

        try {
            const fullPath = `households/${this.householdId}/${path}`;
            const dataRef = this.firebase.ref(this.firebase.database, fullPath);
            
            // Add timestamp and user info
            const dataWithMeta = {
                ...data,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser.uid
            };
            
            await this.firebase.set(dataRef, dataWithMeta);
            console.log('Successfully saved to Realtime Database:', fullPath);
        } catch (error) {
            console.error('Error saving to Firebase Realtime Database:', error);
        }
    }

    async deleteFromRealtimeDatabase(path) {
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

    setupRealtimeListeners(householdId, app) {
        if (!householdId) {
            console.log('No household ID, skipping real-time listeners');
            return;
        }

        console.log('Setting up real-time listeners for household:', householdId);

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
                const dataRef = this.firebase.ref(this.firebase.database, `households/${householdId}/${dataType.key}`);
                
                // Remove existing listener if it exists
                if (this.listeners[dataType.key]) {
                    this.firebase.off(this.listeners[dataType.key]);
                }
                
                // Set up new listener
                this.listeners[dataType.key] = this.firebase.onValue(dataRef, (snapshot) => {
                    const data = snapshot.val();
                    console.log(`Real-time update for ${dataType.key}:`, data);
                    
                    // Convert to array if it's an object
                    let dataArray = data;
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        dataArray = Object.values(data);
                    } else if (!data) {
                        dataArray = [];
                    }
                    
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

            console.log('All real-time listeners set up successfully');
        } catch (error) {
            console.error('Error setting up real-time listeners:', error);
        }
    }

    cleanupListeners() {
        for (const [key, listener] of Object.entries(this.listeners)) {
            this.firebase.off(listener);
            console.log(`Cleaned up listener for ${key}`);
        }
        this.listeners = {};
    }
}

// Export for use in main application
window.RealtimeDatabaseManager = RealtimeDatabaseManager;
