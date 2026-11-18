import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({
  children,
  close,
  label,
  className,
  busy = false,
}: {
  children: ReactNode;
  close: () => void;
  label: string;
  className: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      {children}
    </dialog>
  );
}
