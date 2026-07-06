"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useModalBehavior } from "./use-modal-behavior";
import styles from "./Dialog.module.css";

export type DialogProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Client-only mount flag: guards `createPortal(..., document.body)` below
    // from running during SSR/server rendering, where `document` is
    // undefined. This is the standard mount-detection idiom and has no
    // setState-free equivalent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useModalBehavior(mounted && open, panelRef, onClose);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={styles.scrim}
      data-testid="dialog-scrim"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(styles.panel, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
