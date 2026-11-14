import React, { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog";

interface NameDialogProps {
  open: boolean;
  title: string;
  text?: React.ReactNode;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/** Asks for a single line of text. The in-page replacement for window.prompt. */
const NameDialog: React.FC<NameDialogProps> = ({
  open,
  title,
  text,
  initialValue = "",
  confirmLabel = "Save",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    // Let the dialog open before selecting, or focus lands nowhere.
    const timer = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(timer);
  }, [open, initialValue]);

  return (
    <Dialog
      open={open}
      title={title}
      text={text}
      confirmLabel={confirmLabel}
      onConfirm={() => onConfirm(value)}
      onCancel={onCancel}
    >
      <input
        ref={inputRef}
        className="dialog-field"
        type="text"
        value={value}
        maxLength={80}
        aria-label={title}
        onChange={(event) => setValue(event.target.value)}
      />
    </Dialog>
  );
};

export default NameDialog;
