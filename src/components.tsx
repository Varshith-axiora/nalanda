import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function cn(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

export function StatusPill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "cyan" | "green" | "amber" | "red" | "slate" | "violet";
}) {
  const t: Record<string, string> = {
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    red: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    slate: "border-slate-300/20 bg-slate-300/10 text-slate-200",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-100",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        t[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "cyan",
}: {
  value: number;
  tone?: "cyan" | "green" | "amber" | "violet";
}) {
  const t: Record<string, string> = {
    cyan: "from-cyan-300 to-blue-500",
    green: "from-emerald-300 to-teal-500",
    amber: "from-amber-300 to-orange-500",
    violet: "from-violet-300 to-fuchsia-500",
  };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        transition={{ duration: 0.7 }}
        className={cn("h-full rounded-full bg-gradient-to-r", t[tone])}
      />
    </div>
  );
}

export function Panel({
  title,
  kicker,
  action,
  children,
  className: extra,
}: {
  title: string;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl",
        extra,
      )}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {kicker ? (
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              {kicker}
            </p>
          ) : null}
          <h2 className="mt-2 font-display text-xl font-semibold text-white">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl",
          wide ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            Close
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-400">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_16px_rgba(34,211,238,0.15)]"
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-400">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
      >
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
}

export function Metric({
  label,
  value,
  helper,
  tone = "cyan",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "cyan" | "green" | "amber" | "violet";
}) {
  const t: Record<string, string> = {
    cyan: "from-cyan-300/20 text-cyan-100 border-cyan-300/20",
    green: "from-emerald-300/20 text-emerald-100 border-emerald-300/20",
    amber: "from-amber-300/20 text-amber-100 border-amber-300/20",
    violet: "from-violet-300/20 text-violet-100 border-violet-300/20",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl border bg-gradient-to-br to-white/[0.02] p-5",
        t[tone],
      )}
    >
      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">
        {label}
      </p>
      <p className="mt-4 font-display text-3xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </motion.div>
  );
}

export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(star)}
          className={cn(
            "text-2xl transition",
            star <= value ? "text-amber-400" : "text-slate-600",
            !disabled && "hover:text-amber-300 cursor-pointer",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-400/20 to-violet-400/20 font-semibold text-white",
        sizes[size],
      )}
    >
      {initials}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
      <div className="text-4xl text-slate-600">◇</div>
      <p className="mt-4 text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function DeleteConfirmModal({
  entityType,
  entityName,
  entityId,
  onConfirm,
  onClose,
}: {
  entityType: string;
  entityName: string;
  entityId: string;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const valid = comment.trim().length >= 10;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="w-full max-w-lg rounded-[2rem] border border-rose-400/25 bg-slate-950 p-6 shadow-2xl shadow-rose-950/30"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-lg text-rose-300">
            ⚠
          </span>
          <h2 className="font-display text-xl font-semibold text-white">
            Confirm permanent deletion
          </h2>
        </div>
        <div className="rounded-2xl border border-rose-300/15 bg-rose-300/5 p-4">
          <p className="text-sm text-rose-100">
            This action permanently removes{" "}
            <strong className="text-white">{entityName}</strong> ({entityType} ·{" "}
            {entityId}) from active data.
          </p>
          <p className="mt-2 text-xs text-rose-200/70">
            The record and its related data will be moved to the Super Admin
            archive for audit purposes.
          </p>
        </div>
        <label className="mt-5 block space-y-2 text-sm text-slate-400">
          <span>
            Deletion reason <span className="text-rose-300">*</span>{" "}
            <span className="text-xs text-slate-500">(min 10 characters)</span>
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Provide a mandatory reason for this deletion..."
            className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-rose-300/50 focus:shadow-[0_0_16px_rgba(244,63,94,0.1)]"
          />
        </label>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => onConfirm(comment.trim())}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-bold transition",
              valid
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-400"
                : "cursor-not-allowed bg-slate-800 text-slate-500",
            )}
          >
            Confirm delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ToastNotification({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [currentMsg, setCurrentMsg] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setCurrentMsg(message);
      setExiting(false);
      setVisible(true);
      const exitTimer = setTimeout(() => setExiting(true), 2600);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setCurrentMsg(null);
        onDone();
      }, 3000);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [message]);

  if (!visible || !currentMsg) return null;
  return (
    <div
      className={`fixed top-6 right-6 z-[100] max-w-sm ${exiting ? "toast-exit" : "toast-enter"}`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-5 py-3.5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm text-emerald-300">
          ✓
        </span>
        <p className="text-sm font-medium text-white leading-snug">
          {currentMsg}
        </p>
      </div>
    </div>
  );
}
