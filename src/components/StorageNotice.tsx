import { useSyncExternalStore } from "react";
import { getStorageNotice, retrySaving, storageChanged } from "../helpers/projects";
import { downloadBackup } from "../helpers/backups";

const subscribe = (changed: () => void) => {
  window.addEventListener(storageChanged, changed);
  return () => window.removeEventListener(storageChanged, changed);
};

export default function StorageNotice() {
  const message = useSyncExternalStore(subscribe, getStorageNotice);
  return message ? <aside role="alert" className="storage-notice">
    <p>{message}</p><button type="button" onClick={retrySaving}>Retry saving</button>{" "}
    <button type="button" onClick={downloadBackup}>Export recovery backup</button>
  </aside> : null;
}
