import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { IconCheck, IconClose, IconCopy } from './Icons';

/* ------------------------------------------------------------------ toasts */

type ToastKind = 'info' | 'bad';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.kind === 'bad' ? 'bad' : ''}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ layout */

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="row between">
        <h1>{title}</h1>
        {action}
      </div>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

export function Card({
  children,
  title,
  hint,
  action,
  tight,
}: {
  children: ReactNode;
  title?: string;
  hint?: string;
  action?: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={`card ${tight ? 'tight' : ''}`}>
      {title || action ? (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {hint ? <div className="hint">{hint}</div> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled,
  small,
  block,
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  small?: boolean;
  block?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      className={`btn ${variant === 'default' ? '' : variant} ${small ? 'small' : ''} ${block ? 'block' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  if (!onClick) {
    return (
      <span className="chip static" title={title}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" className="chip" aria-pressed={Boolean(active)} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Notice({ tone, children }: { tone?: 'warn' | 'ok' | 'bad'; children: ReactNode }) {
  return <div className={`notice ${tone ?? ''}`}>{children}</div>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ inputs */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="faint">{hint}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  onEnter,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url' | 'search';
  maxLength?: number;
  onEnter?: () => void;
  type?: 'text' | 'password' | 'url' | 'email';
}) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      inputMode={inputMode}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onEnter) onEnter();
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ copy */

export function CopyBlock({ label, text, mono }: { label: string; text: string; mono?: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    toast(`${label} copied`);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="copy-block">
      <div className="copy-actions">
        <b>{label}</b>
        <Btn small variant="ghost" onClick={copy} title={`Copy ${label}`}>
          {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Btn>
      </div>
      {mono ? <pre>{text}</pre> : <p>{text}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <Btn small variant="ghost" onClick={onClose} title="Close">
            <IconClose width={16} height={16} />
          </Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
