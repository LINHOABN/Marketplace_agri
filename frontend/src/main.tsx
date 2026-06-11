import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { UserProvider } from "./context/UserContext.tsx";
import { SocketProvider } from "./context/SocketContext.tsx";

/** Charge toutes les feuilles de style (pages + composants) au démarrage */
import.meta.glob("./pages/**/*.css", { eager: true });
import.meta.glob("./components/**/*.css", { eager: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UserProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </UserProvider>
  </StrictMode>,
);
