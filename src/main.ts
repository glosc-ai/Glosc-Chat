import { createApp } from "vue";
import App from "./App.vue";
import { initializeFirebaseAnalytics } from "./services/firebaseAnalytics";
import "./styles/app.css";

void initializeFirebaseAnalytics();

createApp(App).mount("#app");
