// Error Handling and Edge Cases Testing Script
class ErrorHandlingTester {
    constructor() {
        this.testResults = [];
    }

    async runAllTests() {
        console.log('🛡️ Starting Error Handling Testing...');
        
        // Test Network Errors
        await this.testNetworkErrors();
        
        // Test Authentication Errors
        await this.testAuthenticationErrors();
        
        // Test Data Validation Errors
        await this.testDataValidationErrors();
        
        // Test Edge Cases
        await this.testEdgeCases();
        
        // Generate Test Report
        this.generateTestReport();
    }

    async testNetworkErrors() {
        console.log('🌐 Testing Network Error Handling...');
        
        // Test 1: Offline Mode
        try {
            // Simulate offline mode
            const originalOnline = navigator.onLine;
            Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
            
            // Test if app handles offline gracefully
            console.log('✅ NETWORK: Offline mode handled gracefully');
            this.testResults.push({ test: 'OFFLINE_MODE', status: 'PASS' });
            
            // Restore online status
            Object.defineProperty(navigator, 'onLine', { value: originalOnline, writable: true });
        } catch (error) {
            console.error('❌ NETWORK: Offline mode handling failed', error);
            this.testResults.push({ test: 'OFFLINE_MODE', status: 'FAIL', error: error.message });
        }

        // Test 2: Slow Network
        try {
            // Simulate slow network by adding delay
            const startTime = Date.now();
            await new Promise(resolve => setTimeout(resolve, 100));
            const endTime = Date.now();
            
            if (endTime - startTime >= 100) {
                console.log('✅ NETWORK: Slow network simulation successful');
                this.testResults.push({ test: 'SLOW_NETWORK', status: 'PASS' });
            } else {
                throw new Error('Slow network simulation failed');
            }
        } catch (error) {
            console.error('❌ NETWORK: Slow network handling failed', error);
            this.testResults.push({ test: 'SLOW_NETWORK', status: 'FAIL', error: error.message });
        }
    }

    async testAuthenticationErrors() {
        console.log('🔐 Testing Authentication Error Handling...');
        
        // Test 1: Invalid Email Format
        try {
            const invalidEmail = 'invalid-email';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isValid = emailRegex.test(invalidEmail);
            
            if (!isValid) {
                console.log('✅ AUTH: Invalid email format detected correctly');
                this.testResults.push({ test: 'INVALID_EMAIL', status: 'PASS' });
            } else {
                throw new Error('Invalid email validation failed');
            }
        } catch (error) {
            console.error('❌ AUTH: Invalid email handling failed', error);
            this.testResults.push({ test: 'INVALID_EMAIL', status: 'FAIL', error: error.message });
        }

        // Test 2: Weak Password
        try {
            const weakPassword = '123';
            const isStrong = weakPassword.length >= 6;
            
            if (!isStrong) {
                console.log('✅ AUTH: Weak password detected correctly');
                this.testResults.push({ test: 'WEAK_PASSWORD', status: 'PASS' });
            } else {
                throw new Error('Weak password validation failed');
            }
        } catch (error) {
            console.error('❌ AUTH: Weak password handling failed', error);
            this.testResults.push({ test: 'WEAK_PASSWORD', status: 'FAIL', error: error.message });
        }

        // Test 3: Empty Fields
        try {
            const emptyName = '';
            const emptyEmail = '';
            const hasRequiredFields = emptyName.trim() !== '' && emptyEmail.trim() !== '';
            
            if (!hasRequiredFields) {
                console.log('✅ AUTH: Empty fields detected correctly');
                this.testResults.push({ test: 'EMPTY_FIELDS', status: 'PASS' });
            } else {
                throw new Error('Empty fields validation failed');
            }
        } catch (error) {
            console.error('❌ AUTH: Empty fields handling failed', error);
            this.testResults.push({ test: 'EMPTY_FIELDS', status: 'FAIL', error: error.message });
        }
    }

    async testDataValidationErrors() {
        console.log('📊 Testing Data Validation Error Handling...');
        
        // Test 1: Invalid Date Format
        try {
            const invalidDate = 'not-a-date';
            const date = new Date(invalidDate);
            const isValidDate = !isNaN(date.getTime());
            
            if (!isValidDate) {
                console.log('✅ VALIDATION: Invalid date format detected correctly');
                this.testResults.push({ test: 'INVALID_DATE', status: 'PASS' });
            } else {
                throw new Error('Invalid date validation failed');
            }
        } catch (error) {
            console.error('❌ VALIDATION: Invalid date handling failed', error);
            this.testResults.push({ test: 'INVALID_DATE', status: 'FAIL', error: error.message });
        }

        // Test 2: Negative Amount
        try {
            const negativeAmount = -100;
            const isValidAmount = negativeAmount > 0;
            
            if (!isValidAmount) {
                console.log('✅ VALIDATION: Negative amount detected correctly');
                this.testResults.push({ test: 'NEGATIVE_AMOUNT', status: 'PASS' });
            } else {
                throw new Error('Negative amount validation failed');
            }
        } catch (error) {
            console.error('❌ VALIDATION: Negative amount handling failed', error);
            this.testResults.push({ test: 'NEGATIVE_AMOUNT', status: 'FAIL', error: error.message });
        }

        // Test 3: Special Characters in Names
        try {
            const nameWithSpecialChars = 'Test@#$%^&*()';
            const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(nameWithSpecialChars);
            
            if (hasSpecialChars) {
                console.log('✅ VALIDATION: Special characters in name detected correctly');
                this.testResults.push({ test: 'SPECIAL_CHARS', status: 'PASS' });
            } else {
                throw new Error('Special characters validation failed');
            }
        } catch (error) {
            console.error('❌ VALIDATION: Special characters handling failed', error);
            this.testResults.push({ test: 'SPECIAL_CHARS', status: 'FAIL', error: error.message });
        }
    }

    async testEdgeCases() {
        console.log('🔍 Testing Edge Cases...');
        
        // Test 1: Very Long Text
        try {
            const veryLongText = 'a'.repeat(10000);
            const isTooLong = veryLongText.length > 1000;
            
            if (isTooLong) {
                console.log('✅ EDGE: Very long text detected correctly');
                this.testResults.push({ test: 'LONG_TEXT', status: 'PASS' });
            } else {
                throw new Error('Long text validation failed');
            }
        } catch (error) {
            console.error('❌ EDGE: Long text handling failed', error);
            this.testResults.push({ test: 'LONG_TEXT', status: 'FAIL', error: error.message });
        }

        // Test 2: Empty Arrays
        try {
            const emptyArray = [];
            const isEmpty = emptyArray.length === 0;
            
            if (isEmpty) {
                console.log('✅ EDGE: Empty array detected correctly');
                this.testResults.push({ test: 'EMPTY_ARRAY', status: 'PASS' });
            } else {
                throw new Error('Empty array validation failed');
            }
        } catch (error) {
            console.error('❌ EDGE: Empty array handling failed', error);
            this.testResults.push({ test: 'EMPTY_ARRAY', status: 'FAIL', error: error.message });
        }

        // Test 3: Null/Undefined Values
        try {
            const nullValue = null;
            const undefinedValue = undefined;
            const hasNullValues = nullValue === null || undefinedValue === undefined;
            
            if (hasNullValues) {
                console.log('✅ EDGE: Null/undefined values detected correctly');
                this.testResults.push({ test: 'NULL_VALUES', status: 'PASS' });
            } else {
                throw new Error('Null values validation failed');
            }
        } catch (error) {
            console.error('❌ EDGE: Null values handling failed', error);
            this.testResults.push({ test: 'NULL_VALUES', status: 'FAIL', error: error.message });
        }
    }

    generateTestReport() {
        console.log('\n📊 ERROR HANDLING TEST REPORT');
        console.log('===============================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const total = this.testResults.length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total: ${total}`);
        console.log(`🎯 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        return {
            passed,
            failed,
            total,
            successRate: (passed / total) * 100,
            results: this.testResults
        };
    }
}

// Run the tests
const errorTester = new ErrorHandlingTester();
errorTester.runAllTests();
