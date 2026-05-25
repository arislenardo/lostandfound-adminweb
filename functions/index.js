const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 1. Scheduled Deactivation of Accounts (Runs every day at midnight)
exports.deactivateInactiveUsers = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("Asia/Manila") // Ensure this matches your timezone
  .onRun(async (context) => {
    console.log("Running daily inactive user deactivation job.");
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const usersRef = db.collection("users");
    // Get all users who are not already inactive
    const snapshot = await usersRef.where("status", "!=", "inactive").get();

    let count = 0;
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const userData = doc.data();
      let lastActive = null;
      
      if (userData.lastLogin) {
        lastActive = userData.lastLogin.toDate ? userData.lastLogin.toDate() : new Date(userData.lastLogin);
      } else if (userData.createdAt) {
        lastActive = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
      }

      if (lastActive && lastActive < oneYearAgo) {
        batch.update(doc.ref, { status: "inactive" });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully deactivated ${count} inactive users.`);
    } else {
      console.log("No inactive users found.");
    }
    return null;
  });

// 2. Prevent Duplicate Phone Numbers on User Creation/Update
exports.enforceUniquePhoneNumber = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    const afterData = change.after.data();
    const beforeData = change.before.data();

    // If the document was deleted, do nothing
    if (!afterData) return null;

    const phoneNumber = afterData.phoneNumber;

    // Only proceed if phoneNumber exists and has changed (or is new)
    if (!phoneNumber) return null;
    if (beforeData && beforeData.phoneNumber === phoneNumber) return null;

    // Check if another user already has this phone number
    const snapshot = await db.collection("users")
      .where("phoneNumber", "==", phoneNumber)
      .get();

    // The snapshot might include the current document, so we filter it out
    const duplicates = snapshot.docs.filter(doc => doc.id !== context.params.userId);

    if (duplicates.length > 0) {
      console.error(`Duplicate phone number detected: ${phoneNumber} for user ${context.params.userId}`);
      
      // Revert the phone number change or remove it if it's a new registration
      if (!change.before.exists) {
        await change.after.ref.update({ 
          phoneNumber: admin.firestore.FieldValue.delete(), 
          duplicateWarning: `Phone number ${phoneNumber} was removed because it is already associated with another account.`
        });
      } else {
        // Revert to old phone number
        await change.after.ref.update({ 
          phoneNumber: beforeData.phoneNumber || null, 
          duplicateWarning: `Failed to change phone number to ${phoneNumber} as it belongs to another account.`
        });
      }
    }
    
    return null;
  });

// 3. Sync Firestore user status with Firebase Authentication (Disable/Enable login)
exports.syncUserStatusWithAuth = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const afterData = change.after.data();
    const beforeData = change.before.data();

    // If status didn't change, we do nothing
    if (afterData.status === beforeData.status) return null;

    const userId = context.params.userId;

    try {
      if (afterData.status === "inactive") {
        // Disable the user in Firebase Auth so they cannot log in
        await admin.auth().updateUser(userId, { disabled: true });
        console.log(`Successfully disabled Firebase Auth for user: ${userId}`);
      } else if (afterData.status === "active") {
        // Re-enable the user in Firebase Auth
        await admin.auth().updateUser(userId, { disabled: false });
        console.log(`Successfully re-enabled Firebase Auth for user: ${userId}`);
      }
    } catch (error) {
      console.error(`Error updating Firebase Auth for user ${userId}:`, error);
    }

    return null;
  });
