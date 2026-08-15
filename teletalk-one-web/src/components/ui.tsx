import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import './ui.css'

/* ------------------------------- Button ------------------------------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'link'
  busy?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  busy = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant}${fullWidth ? ' btn--full' : ''} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="btn__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}

/* -------------------------------- Field -------------------------------- */

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  help?: string
  error?: string
  /** Identifiers render Latin + monospace regardless of locale. */
  identifier?: boolean
  prefix?: string
  trailing?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, help, error, identifier = false, prefix, trailing, className = '', ...rest },
  ref,
) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      <div className="field__control">
        {prefix && (
          <span className="field__prefix identifier" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          ref={ref}
          className={`field__input${identifier ? ' identifier' : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...rest}
        />
        {trailing && <span className="field__trailing">{trailing}</span>}
      </div>

      {help && !error && (
        <p className="field__help" id={helpId}>
          {help}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

/* -------------------------------- Alert -------------------------------- */

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'warn' | 'ok'
  children: ReactNode
}) {
  return (
    <div className={`alert alert--${tone}`} role="alert">
      {children}
    </div>
  )
}

/* ------------------------------- Stepper ------------------------------- */

export function Stepper({
  steps,
  current,
  srLabel,
}: {
  steps: string[]
  current: number
  srLabel: string
}) {
  return (
    <ol className="stepper" aria-label={srLabel}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li key={label} className={`stepper__item stepper__item--${state}`}>
            <span className="stepper__dot" aria-hidden="true" />
            <span className="stepper__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------- Checkbox ------------------------------ */

export function Checkbox({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string
  label: string
  help?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const helpId = `${id}-help`
  return (
    <div className="checkbox">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={help ? helpId : undefined}
      />
      <div className="checkbox__text">
        <label htmlFor={id}>{label}</label>
        {help && (
          <p className="checkbox__help" id={helpId}>
            {help}
          </p>
        )}
      </div>
    </div>
  )
}
