import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useEffect, useId } from 'react';
import { Meta } from '../lib/api';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({ variant = 'primary', loading, className, children, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }) {
  const v = {
    primary: 'bg-accent text-white hover:bg-accent-hover', secondary: 'bg-surface text-ink border border-line hover:bg-bg',
    danger: 'bg-bad text-white hover:opacity-90', ghost: 'text-accent hover:bg-accent-soft',
  }[variant];
  return (
    <button {...p} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', v, className)}>
      {loading && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export const Card = ({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) => (
  <section className={cx('rounded-xl border border-line bg-surface p-5', className)}>
    {(title || action) && <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-ink">{title}</h2>{action}</header>}
    {children}
  </section>
);

export const PageHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
    {action}
  </div>
);

interface FieldProps { label: string; error?: string | null; hint?: string }
const fieldCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(({ label, error, hint, className, ...p }, ref) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input id={id} ref={ref} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...p} className={cx(fieldCls, error && 'border-bad', className)} />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';

export function Select({ label, error, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <select id={id} {...p} className={cx(fieldCls, error && 'border-bad')}>{children}</select>
      {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
export function Textarea({ label, error, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <textarea id={id} rows={3} {...p} className={cx(fieldCls, error && 'border-bad')} />
      {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  DRAFT: 'bg-bg text-muted border border-line', SUBMITTED: 'bg-warn-soft text-warn', APPROVED: 'bg-ok-soft text-ok', REJECTED: 'bg-bad-soft text-bad', REIMBURSED: 'bg-accent-soft text-accent',
  ACTIVE: 'bg-ok-soft text-ok', FROZEN: 'bg-warn-soft text-warn', DEACTIVATED: 'bg-bad-soft text-bad', DECLINED: 'bg-bad-soft text-bad', FLAGGED: 'bg-warn-soft text-warn', INACTIVE: 'bg-bad-soft text-bad', SUSPENDED: 'bg-bad-soft text-bad',
};
export const Badge = ({ value, label }: { value: string; label?: string }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[value] ?? 'bg-bg text-muted border border-line')}>{label ?? value.charAt(0) + value.slice(1).toLowerCase().replace('_', ' ')}</span>
);

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-12 text-sm text-muted">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />{label}…
  </div>
);
export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div role="alert" className="rounded-xl border border-bad/30 bg-bad-soft p-5 text-sm text-bad">
    <p className="font-medium">Something went wrong</p>
    <p className="mt-1">{error instanceof Error ? error.message : String(error)}</p>
    {onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>}
  </div>
);
export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center"><p className="font-medium">{title}</p>{hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}{action}</div>
);

export function Pagination({ meta, onPage }: { meta?: Meta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>Page {meta.page} of {meta.totalPages} · {meta.total} results</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded p-1 text-muted hover:bg-bg">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export const Stat = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'bad' }) => (
  <div className="rounded-xl border border-line bg-surface p-5">
    <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
    <p className={cx('mt-2 text-2xl font-semibold tabular-nums', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>{value}</p>
    {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
  </div>
);

export function ProgressBar({ pct }: { pct: number }) {
  const tone = pct >= 100 ? 'bg-bad' : pct >= 90 ? 'bg-bad/80' : pct >= 75 ? 'bg-warn' : 'bg-accent';
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget utilisation" className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className={cx('h-full rounded-full transition-all', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export const Table = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto"><table className="w-full text-left text-sm">{children}</table></div>;
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => <th scope="col" className={cx('whitespace-nowrap border-b border-line px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted', right && 'text-right')}>{children}</th>;
export const Td = ({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) => <td className={cx('border-b border-line/60 px-3 py-3 align-middle', right && 'text-right tabular-nums', className)}>{children}</td>;
