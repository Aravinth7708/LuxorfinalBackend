import admin from 'firebase-admin';

// Simple Firebase Admin setup for development
// This will work without service account files by using default credentials

const initializeFirebaseAdmin = () => {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin already initialized');
      return admin.app();
    }

    // Initialize with minimal config - Firebase will use default credentials
    const app = admin.initializeApp({
      // No explicit credentials needed for development
      // Firebase will use environment variables or default credentials
    });

    console.log('Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    
    // Try to return existing app if available
    if (admin.apps.length > 0) {
      return admin.app();
    }
    
    throw error;
  }
};

// Initialize Firebase Admin
const firebaseAdminApp = initializeFirebaseAdmin();

module.exports = {
  admin,
  app: firebaseAdminApp
};