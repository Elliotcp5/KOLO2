import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/themes.css";
import "@/index.css";
import App from "@/App";
import { Capacitor } from "@capacitor/core";

// Ajoute une classe sur <html> si on tourne en natif iOS/Android
// → permet au CSS de retirer le cadre flottant .mobile-frame et prendre tout l'écran
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("capacitor-native");
  document.documentElement.classList.add(`capacitor-${Capacitor.getPlatform()}`);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
