import { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'secondary', size = 'md', className, type, ...rest },
    ref
  ) {
    const cls = [
      styles.button,
      styles[variant],
      size !== 'md' ? styles[size] : null,
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button ref={ref} type={type ?? 'button'} className={cls} {...rest} />
    );
  }
);
