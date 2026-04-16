import React from 'react';

export type ButtonVariant = 'filled' | 'outlined' | 'text' | 'elevated';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  size = 'medium',
  fullWidth = false,
  startIcon,
  endIcon,
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseClass = 'md3-button';
  const variantClass = `md3-button--${variant}`;

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm min-h-8',
    medium: 'px-6 py-2.5 text-base min-h-10',
    large: 'px-8 py-3 text-lg min-h-12',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const loadingClass = loading ? 'opacity-70 cursor-wait' : '';
  const disabledClass = disabled ? 'opacity-38 cursor-not-allowed' : '';

  return (
    <button
      className={`
        ${baseClass}
        ${variantClass}
        ${sizeClasses[size]}
        ${widthClass}
        ${loadingClass}
        ${disabledClass}
        ${className}
        transition-all duration-150 ease-standard
        focus:outline-none focus:ring-2 focus:ring-primary/50
        disabled:opacity-38 disabled:cursor-not-allowed
        animate-fadeIn
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span>Загрузка...</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          {startIcon && <span className="flex items-center">{startIcon}</span>}
          <span>{children}</span>
          {endIcon && <span className="flex items-center">{endIcon}</span>}
        </div>
      )}
    </button>
  );
};