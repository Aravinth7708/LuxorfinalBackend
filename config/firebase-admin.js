import admin from 'firebase-admin';

// Simple Firebase Admin setup for development and production
const initializeFirebaseAdmin = () => {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin already initialized');
      return admin.app();
    }

    // For development/production without service account file
    // Firebase will use environment variables or default credentials
    const app = admin.initializeApp({
      // Minimal configuration - Firebase will handle authentication
      projectId: process.env.FIREBASE_PROJECT_ID || 'finalotp-cfb22',
    });

    console.log('Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    
    // Try to return existing app if available
    if (admin.apps.length > 0) {
      console.log('Returning existing Firebase Admin app');
      return admin.app();
    }
    
    // If Firebase Admin fails, we'll handle it gracefully in the auth functions
    console.warn('Firebase Admin initialization failed - phone auth will use fallback mode');
    return null;
  }
};

// Initialize Firebase Admin
const firebaseAdminApp = initializeFirebaseAdmin();

// Export both the admin SDK and the app instance
export { admin, firebaseAdminApp };
export default firebaseAdminApp;