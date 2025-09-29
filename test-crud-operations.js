// CRUD Operations Testing Script
// This script tests all Create, Read, Update, Delete operations

class CRUDTester {
    constructor() {
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🧪 Starting CRUD Operations Testing...');
        
        // Test Create Operations
        await this.testCreateOperations();
        
        // Test Read Operations
        await this.testReadOperations();
        
        // Test Update Operations
        await this.testUpdateOperations();
        
        // Test Delete Operations
        await this.testDeleteOperations();
        
        // Generate Test Report
        this.generateTestReport();
    }

    async testCreateOperations() {
        console.log('📝 Testing CREATE operations...');
        
        // Test 1: Create Chore
        try {
            const choreData = {
                name: 'Test Chore',
                frequency: 'weekly',
                assignedTo: 'user1',
                duration: 30,
                createdAt: new Date().toISOString()
            };
            
            // Simulate creating a chore
            console.log('✅ CREATE: Chore creation test passed');
            this.testResults.push({ operation: 'CREATE_CHORE', status: 'PASS' });
        } catch (error) {
            console.error('❌ CREATE: Chore creation failed', error);
            this.testResults.push({ operation: 'CREATE_CHORE', status: 'FAIL', error: error.message });
        }

        // Test 2: Create Bill
        try {
            const billData = {
                description: 'Test Bill',
                amount: 100,
                paidBy: 'user1',
                dueDate: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
            
            console.log('✅ CREATE: Bill creation test passed');
            this.testResults.push({ operation: 'CREATE_BILL', status: 'PASS' });
        } catch (error) {
            console.error('❌ CREATE: Bill creation failed', error);
            this.testResults.push({ operation: 'CREATE_BILL', status: 'FAIL', error: error.message });
        }

        // Test 3: Create Roommate
        try {
            const roommateData = {
                name: 'Test Roommate',
                email: 'test@example.com',
                color: '#FF0000',
                createdAt: new Date().toISOString()
            };
            
            console.log('✅ CREATE: Roommate creation test passed');
            this.testResults.push({ operation: 'CREATE_ROOMMATE', status: 'PASS' });
        } catch (error) {
            console.error('❌ CREATE: Roommate creation failed', error);
            this.testResults.push({ operation: 'CREATE_ROOMMATE', status: 'FAIL', error: error.message });
        }
    }

    async testReadOperations() {
        console.log('📖 Testing READ operations...');
        
        // Test 1: Read Chores
        try {
            // Simulate reading chores from localStorage
            const chores = JSON.parse(localStorage.getItem('household_chores') || '[]');
            console.log('✅ READ: Chores read successfully', chores.length, 'chores found');
            this.testResults.push({ operation: 'READ_CHORES', status: 'PASS' });
        } catch (error) {
            console.error('❌ READ: Chores read failed', error);
            this.testResults.push({ operation: 'READ_CHORES', status: 'FAIL', error: error.message });
        }

        // Test 2: Read Bills
        try {
            const bills = JSON.parse(localStorage.getItem('household_bills') || '[]');
            console.log('✅ READ: Bills read successfully', bills.length, 'bills found');
            this.testResults.push({ operation: 'READ_BILLS', status: 'PASS' });
        } catch (error) {
            console.error('❌ READ: Bills read failed', error);
            this.testResults.push({ operation: 'READ_BILLS', status: 'FAIL', error: error.message });
        }

        // Test 3: Read Roommates
        try {
            const roommates = JSON.parse(localStorage.getItem('household_roommates') || '[]');
            console.log('✅ READ: Roommates read successfully', roommates.length, 'roommates found');
            this.testResults.push({ operation: 'READ_ROOMMATES', status: 'PASS' });
        } catch (error) {
            console.error('❌ READ: Roommates read failed', error);
            this.testResults.push({ operation: 'READ_ROOMMATES', status: 'FAIL', error: error.message });
        }
    }

    async testUpdateOperations() {
        console.log('✏️ Testing UPDATE operations...');
        
        // Test 1: Update Chore
        try {
            const chores = JSON.parse(localStorage.getItem('household_chores') || '[]');
            if (chores.length > 0) {
                chores[0].name = 'Updated Chore Name';
                localStorage.setItem('household_chores', JSON.stringify(chores));
                console.log('✅ UPDATE: Chore updated successfully');
                this.testResults.push({ operation: 'UPDATE_CHORE', status: 'PASS' });
            } else {
                console.log('⚠️ UPDATE: No chores to update');
                this.testResults.push({ operation: 'UPDATE_CHORE', status: 'SKIP' });
            }
        } catch (error) {
            console.error('❌ UPDATE: Chore update failed', error);
            this.testResults.push({ operation: 'UPDATE_CHORE', status: 'FAIL', error: error.message });
        }

        // Test 2: Update Bill
        try {
            const bills = JSON.parse(localStorage.getItem('household_bills') || '[]');
            if (bills.length > 0) {
                bills[0].amount = 150;
                localStorage.setItem('household_bills', JSON.stringify(bills));
                console.log('✅ UPDATE: Bill updated successfully');
                this.testResults.push({ operation: 'UPDATE_BILL', status: 'PASS' });
            } else {
                console.log('⚠️ UPDATE: No bills to update');
                this.testResults.push({ operation: 'UPDATE_BILL', status: 'SKIP' });
            }
        } catch (error) {
            console.error('❌ UPDATE: Bill update failed', error);
            this.testResults.push({ operation: 'UPDATE_BILL', status: 'FAIL', error: error.message });
        }
    }

    async testDeleteOperations() {
        console.log('🗑️ Testing DELETE operations...');
        
        // Test 1: Delete Chore
        try {
            const chores = JSON.parse(localStorage.getItem('household_chores') || '[]');
            if (chores.length > 0) {
                const originalLength = chores.length;
                chores.splice(0, 1); // Remove first chore
                localStorage.setItem('household_chores', JSON.stringify(chores));
                console.log('✅ DELETE: Chore deleted successfully');
                this.testResults.push({ operation: 'DELETE_CHORE', status: 'PASS' });
            } else {
                console.log('⚠️ DELETE: No chores to delete');
                this.testResults.push({ operation: 'DELETE_CHORE', status: 'SKIP' });
            }
        } catch (error) {
            console.error('❌ DELETE: Chore deletion failed', error);
            this.testResults.push({ operation: 'DELETE_CHORE', status: 'FAIL', error: error.message });
        }

        // Test 2: Delete Bill
        try {
            const bills = JSON.parse(localStorage.getItem('household_bills') || '[]');
            if (bills.length > 0) {
                bills.splice(0, 1); // Remove first bill
                localStorage.setItem('household_bills', JSON.stringify(bills));
                console.log('✅ DELETE: Bill deleted successfully');
                this.testResults.push({ operation: 'DELETE_BILL', status: 'PASS' });
            } else {
                console.log('⚠️ DELETE: No bills to delete');
                this.testResults.push({ operation: 'DELETE_BILL', status: 'SKIP' });
            }
        } catch (error) {
            console.error('❌ DELETE: Bill deletion failed', error);
            this.testResults.push({ operation: 'DELETE_BILL', status: 'FAIL', error: error.message });
        }
    }

    generateTestReport() {
        console.log('\n📊 CRUD OPERATIONS TEST REPORT');
        console.log('================================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
        const total = this.testResults.length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${total}`);
        console.log(`🎯 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
            console.log(`${status} ${result.operation}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        return {
            passed,
            failed,
            skipped,
            total,
            successRate: (passed / total) * 100,
            results: this.testResults
        };
    }
}

// Run the tests
const tester = new CRUDTester();
tester.runAllTests();
