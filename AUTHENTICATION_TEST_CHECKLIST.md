# 🔐 Authentication Flow Test Checklist

## ✅ **Google Sign-In Testing**

### **Test 1: Popup Authentication**
- [ ] Click "Continue with Google"
- [ ] Google popup opens (if not blocked)
- [ ] Sign in with Google account
- [ ] Profile data captured (name, email, avatar)
- [ ] Household code modal appears

### **Test 2: Popup Blocker Fallback**
- [ ] Block popups in browser settings
- [ ] Click "Continue with Google"
- [ ] Should show "Popup blocked! Redirecting..." message
- [ ] Should redirect to Google sign-in page
- [ ] After sign-in, should return to app
- [ ] Profile data should be captured

### **Test 3: Profile Data Capture**
- [ ] Verify Google display name appears in profile
- [ ] Verify Google email appears in profile
- [ ] Verify Google avatar/photo appears
- [ ] Verify random color is assigned
- [ ] Profile data is saved to localStorage

## 🏠 **Household Management Testing**

### **Test 4: Create New Household**
- [ ] Click "Create Household" button
- [ ] Household code is generated (6 characters)
- [ ] Success modal shows household code
- [ ] "Copy Code" button works
- [ ] Household created in Firestore
- [ ] User added as admin to household
- [ ] App initializes with household data

### **Test 5: Join Existing Household**
- [ ] Enter valid household code
- [ ] Click "Join Household" button
- [ ] Should find household by code
- [ ] User added to household
- [ ] Household data loaded
- [ ] App initializes with shared data

### **Test 6: Invalid Household Code**
- [ ] Enter invalid/non-existent code
- [ ] Should show error message
- [ ] Should not join household

## 🔄 **Data Persistence Testing**

### **Test 7: Local Storage**
- [ ] Profile data persists after page refresh
- [ ] Household ID persists after page refresh
- [ ] User stays signed in after page refresh

### **Test 8: Firestore Integration**
- [ ] Data syncs to Firestore in real-time
- [ ] Multiple users can see shared data
- [ ] Changes appear instantly for all users

## 🎨 **UI/UX Testing**

### **Test 9: Modal Functionality**
- [ ] Household code modal displays properly
- [ ] Success modal shows household code
- [ ] Copy to clipboard works
- [ ] Modals close properly
- [ ] Responsive design works on mobile

### **Test 10: Error Handling**
- [ ] Network errors handled gracefully
- [ ] Firebase errors show user-friendly messages
- [ ] Loading states work properly
- [ ] No JavaScript errors in console

## 🚀 **Complete User Journey**

### **Scenario 1: First User (Household Creator)**
1. [ ] Sign in with Google
2. [ ] Profile data captured automatically
3. [ ] Create new household
4. [ ] Get household code
5. [ ] Share code with roommates
6. [ ] Access full app functionality

### **Scenario 2: Roommate Joining**
1. [ ] Sign in with Google
2. [ ] Profile data captured automatically
3. [ ] Enter household code from creator
4. [ ] Join existing household
5. [ ] Access shared household data
6. [ ] See other roommates and shared content

## 🐛 **Common Issues to Check**

- [ ] Console errors in browser developer tools
- [ ] Firebase connection issues
- [ ] Authentication state persistence
- [ ] Firestore security rules working
- [ ] Real-time data synchronization
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

## 📱 **Mobile Testing**
- [ ] Touch interactions work properly
- [ ] Modals display correctly on small screens
- [ ] Google sign-in works on mobile
- [ ] Household code input works on mobile
- [ ] Copy to clipboard works on mobile

---

**Test Results:** ✅ All tests passed / ❌ Issues found
**Notes:** 
**Date:** 
**Tester:** 
