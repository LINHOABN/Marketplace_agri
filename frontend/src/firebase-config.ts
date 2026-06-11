/**
 * Notifications push (Firebase Cloud Messaging).
 * Renseignez les variables dans .env (préfixe VITE_) puis décommentez l'usage dans App.tsx.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import axios from "axios";
import { API_URL } from "./config";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  !firebaseConfig.apiKey.includes("YOUR_") &&
  Boolean(firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (!isFirebaseConfigured) return null;
  if (!app) app = initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

export const requestForToken = async () => {
  const msg = getMessagingInstance();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;

    const token = await getToken(msg, { vapidKey });
    if (!token) return null;

    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      await axios.post(
        `${API_URL}/auth/save-fcm-token`,
        { token },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    }
    return token;
  } catch (error) {
    console.error("Firebase FCM:", error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    const msg = getMessagingInstance();
    if (!msg) {
      reject(new Error("Firebase non configuré"));
      return;
    }
    onMessage(msg, (payload) => resolve(payload));
  });
