import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

export class FirebaseInitError extends Error {
  constructor(message: string, public readonly cause?: any) {
    super(message);
    this.name = 'FirebaseInitError';
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if all required config values are present
const isConfigValid = firebaseConfig.apiKey && 
                     firebaseConfig.authDomain && 
                     firebaseConfig.projectId;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let initError: FirebaseInitError | null = null;

if (isConfigValid) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    
    // Initialize Firebase Authentication and get a reference to the service
    auth = getAuth(app);
    
    // Initialize Cloud Firestore and get a reference to the service
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    initError = new FirebaseInitError(
      'Firebaseの初期化に失敗しました。ハイライト機能は利用できませんが、他の機能は正常に動作します。',
      error
    );
  }
} else {
  console.warn('Firebase config is incomplete. App will run with limited functionality.');
  initError = new FirebaseInitError(
    'Firebaseの設定が不完全です。ハイライト機能は利用できません。'
  );
}

// Firebaseの初期化状態を確認する関数
export function checkFirebaseInit(): { isInitialized: boolean; error?: FirebaseInitError } {
  if (initError) {
    return { isInitialized: false, error: initError };
  }
  return { isInitialized: !!(app && auth && db) };
}

// Firebaseの機能が利用可能かチェック
export function isFirebaseAvailable(): boolean {
  return !!(app && auth && db);
}

export { auth, db };
export default app;