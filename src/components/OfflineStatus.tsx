import { useEffect, useState } from "react";

export default function OfflineStatus() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    const say = (text: string) => { if (alive) setMessage(text); };
    // A release takes over as soon as it is downloaded; a page open on the last one says so.
    const updating = navigator.serviceWorker.controller !== null;
    const updated = () => {
      if (updating) say("A newer version of Sweat Shop is ready. Reload the page to use it.");
    };
    navigator.serviceWorker.addEventListener("controllerchange", updated);
    say("Downloading the site for offline knitting…");
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL, updateViaCache: "none",
    }).then(registration => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "redundant" && !registration.active) {
            say("Offline download failed. Reopen this page online to try again.");
          }
        });
      });
      navigator.serviceWorker.ready.then(() => {
        say("Ready for offline knitting. External pattern and yarn links need an internet connection.");
      });
    }).catch(() => say("Offline access is unavailable in this browser. Your projects are still saved locally when browser storage is available."));
    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener("controllerchange", updated);
    };
  }, []);
  return message ? <p className="quiet" role="status">{message}</p> : null;
}
