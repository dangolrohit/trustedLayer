import { useEffect } from "react";

export function GetStartedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Get started</h2>
        <p className="mt-2 text-sm text-muted-foreground">Welcome — let's configure your account and upload your first statement.</p>
        <div className="mt-4 flex justify-end">
          <button
            className="rounded bg-primary px-3 py-2 text-white"
            onClick={() => {
              localStorage.removeItem("show_get_started");
              onClose();
            }}
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
