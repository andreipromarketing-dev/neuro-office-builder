import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: boolean;
  errorText?: string;
  fullWidth?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error = false,
  errorText,
  fullWidth = true,
  startAdornment,
  endAdornment,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorClass = error ? 'border-error focus:border-error focus:ring-error/50' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`${widthClass} animate-fadeIn`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-on-surface-variant mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {startAdornment && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">
            {startAdornment}
          </div>
        )}
        <input
          id={inputId}
          className={`
            md3-input
            ${startAdornment ? 'pl-10' : ''}
            ${endAdornment ? 'pr-10' : ''}
            ${errorClass}
            ${widthClass}
            ${className}
            transition-all duration-150
          `}
          {...props}
        />
        {endAdornment && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant">
            {endAdornment}
          </div>
        )}
      </div>
      {(helperText || (error && errorText)) && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-on-surface-variant'}`}>
          {error ? errorText : helperText}
        </p>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: boolean;
  errorText?: string;
  fullWidth?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  helperText,
  error = false,
  errorText,
  fullWidth = true,
  className = '',
  id,
  ...props
}) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const errorClass = error ? 'border-error focus:border-error focus:ring-error/50' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`${widthClass} animate-fadeIn`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-on-surface-variant mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          md3-textarea
          ${errorClass}
          ${widthClass}
          ${className}
          transition-all duration-150
        `}
        {...props}
      />
      {(helperText || (error && errorText)) && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-on-surface-variant'}`}>
          {error ? errorText : helperText}
        </p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: boolean;
  errorText?: string;
  fullWidth?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error = false,
  errorText,
  fullWidth = true,
  className = '',
  options,
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorClass = error ? 'border-error focus:border-error focus:ring-error/50' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`${widthClass} animate-fadeIn`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-on-surface-variant mb-1"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          md3-select
          ${errorClass}
          ${widthClass}
          ${className}
          transition-all duration-150
        `}
        {...props}
      >
        <option value="" className="text-on-surface-variant">
          Выберите...
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-on-surface bg-surface">
            {option.label}
          </option>
        ))}
      </select>
      {(helperText || (error && errorText)) && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-on-surface-variant'}`}>
          {error ? errorText : helperText}
        </p>
      )}
    </div>
  );
};