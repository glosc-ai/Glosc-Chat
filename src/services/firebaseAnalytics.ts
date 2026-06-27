import { getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

type AnalyticsEventParams = Record<string, string | number | undefined>;

const firebaseConfig = {
  apiKey: "AIzaSyAIzViHof4TNB694JyuxeBwGJYVbXu9HLA",
  authDomain: "gloscai.firebaseapp.com",
  projectId: "gloscai",
  storageBucket: "gloscai.firebasestorage.app",
  messagingSenderId: "224927712933",
  appId: "1:224927712933:web:9a28d7beb67beaf3272f4c",
  measurementId: "G-R2T7LPDWW8",
};

let analyticsInstance: Analytics | null = null;
let analyticsInitPromise: Promise<Analytics | null> | null = null;

export function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsInitPromise) return analyticsInitPromise;

  analyticsInitPromise = resolveFirebaseAnalytics();
  return analyticsInitPromise;
}

export function trackAppScreen(screenName: string): void {
  trackAnalyticsEvent("screen_view", {
    firebase_screen: screenName,
    firebase_screen_class: "GloscChat",
  });
}

export function trackAnalyticsEvent(eventName: string, params?: AnalyticsEventParams): void {
  void sendAnalyticsEvent(eventName, params);
}

async function resolveFirebaseAnalytics(): Promise<Analytics | null> {
  try {
    if (!(await isSupported())) return null;

    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch (error) {
    console.warn("Firebase Analytics initialization failed", error);
    return null;
  }
}

async function sendAnalyticsEvent(eventName: string, params?: AnalyticsEventParams): Promise<void> {
  const analytics = analyticsInstance ?? (await initializeFirebaseAnalytics());
  if (!analytics) return;

  try {
    logEvent(analytics, eventName, params);
  } catch (error) {
    console.warn(`Firebase Analytics event failed: ${eventName}`, error);
  }
}
