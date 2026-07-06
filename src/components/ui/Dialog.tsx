"use client";

import { useRef } from "react";
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
  useModalBehavior(open, panelRef, onClose);

  if (!open) return null;

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
