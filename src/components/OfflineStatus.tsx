import { useEffect, useState } from "react";

export default function OfflineStatus() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    const say = (text: string) => { if (alive) setMessage(text); };
    say("Downloading the site for offline knitting…");
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL, updateViaCache: "none",
    }).then(registration => {
      const waiting = () => {
        if (registration.waiting) say("Ready offline. An update will be used after all Sweat Shop tabs are closed.");
      };
      waiting();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "redundant" && !registration.active) {
            say("Offline download failed. Reopen this page online to try again.");
          }
          waiting();
        });
      });
      navigator.serviceWorker.ready.then(() => {
        say("Ready for offline knitting. External pattern and yarn links need an internet connection.");
        waiting();
      });
    }).catch(() => say("Offline access is unavailable in this browser. Your projects are still saved locally when browser storage is available."));
    return () => { alive = false; };
  }, []);
  return message ? <p className="quiet" role="status">{message}</p> : null;
}
