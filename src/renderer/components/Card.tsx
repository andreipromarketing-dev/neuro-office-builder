import React from 'react';

export type CardVariant = 'default' | 'outlined' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'small' | 'medium' | 'large';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'medium',
  hoverable = true,
  children,
  className = '',
  ...props
}) => {
  const baseClass = 'md3-card';
  const variantClass = variant === 'default' ? '' : `md3-card--${variant}`;

  const paddingClasses = {
    none: 'p-0',
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6',
  };

  const hoverClass = hoverable ? 'hover:bg-surface-container-high transition-all duration-150' : '';

  return (
    <div
      className={`
        ${baseClass}
        ${variantClass}
        ${paddingClasses[padding]}
        ${hoverClass}
        ${className}
        rounded-md
        animate-fadeIn
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`pb-3 border-b border-outline-variant ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`py-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`pt-3 border-t border-outline-variant ${className}`} {...props}>
    {children}
  </div>
);