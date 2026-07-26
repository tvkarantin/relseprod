import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'primary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  children: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  primary: 'button-primary',
  danger: 'button-danger',
}

/** A real <button>; never a clickable div. */
export function Button({
  variant = 'default',
  small = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = ['button', VARIANT_CLASS[variant], small ? 'button-small' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
