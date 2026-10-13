import React, { useEffect, useId, useRef } from "react";
import Button from "./Button";
import "./Dialog.css";

interface DialogProps {
  open: boolean;
  title: string;
  /** Explanatory text above any field. */
  text?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/**
 * A modal built on the native dialog element, which brings the focus trap,
 * Escape-to-close and inert background with it. Replaces window.prompt and
 * window.confirm, which cannot be styled, read poorly, and in the rename case
 * had a return value that was easy to mishandle.
 */
const Dialog: React.FC<DialogProps> = ({
  open,
  title,
  text,
  confirmLabel = "OK",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  children,
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  /*
   * Every dialog on a page is mounted whether or not it is open, so a fixed id
   * here would be duplicated and the accessible name would point at whichever
   * happened to come first in the DOM.
   */
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // Escape and backdrop dismissal both come through as a cancel.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onCancelEvent = (event: Event) => {
      event.preventDefault();
      onCancel();
    };
    element.addEventListener("cancel", onCancelEvent);
    return () => element.removeEventListener("cancel", onCancelEvent);
  }, [onCancel]);

  return (
    <dialog className="dialog" ref={ref} aria-labelledby={titleId}>
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="dialog-body">
          <h2 className="dialog-title" id={titleId}>
            {title}
          </h2>
          {text && <p className="dialog-text">{text}</p>}
          {children}
        </div>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} type="submit">
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
};

export default Dialog;
