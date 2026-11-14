import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Developing, the designs as they are in hand are what is knitted and shown: see knitting/builder.
if (import.meta.env.DEV) (await import("./knitting/builder")).showLiveDesigns();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
