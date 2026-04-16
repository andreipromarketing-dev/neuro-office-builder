import React from 'react';

export type StatusType = 'online' | 'offline' | 'checking' | 'warning' | 'error';

interface StatusIndicatorProps {
  type: StatusType;
  label?: string;
  pulse?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  type,
  label,
  pulse = false,
  size = 'medium',
}) => {
  const statusConfig = {
    online: {
      bgColor: 'bg-status-green/20',
      textColor: 'text-status-green',
      dotColor: 'bg-status-green',
      icon: '●',
    },
    offline: {
      bgColor: 'bg-status-red/20',
      textColor: 'text-status-red',
      dotColor: 'bg-status-red',
      icon: '●',
    },
    checking: {
      bgColor: 'bg-status-orange/20',
      textColor: 'text-status-orange',
      dotColor: 'bg-status-orange',
      icon: '⟳',
    },
    warning: {
      bgColor: 'bg-status-orange/20',
      textColor: 'text-status-orange',
      dotColor: 'bg-status-orange',
      icon: '⚠',
    },
    error: {
      bgColor: 'bg-status-red/20',
      textColor: 'text-status-red',
      dotColor: 'bg-status-red',
      icon: '✕',
    },
  };

  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };

  const config = statusConfig[type];
  const pulseClass = pulse ? 'animate-pulse' : '';

  return (
    <div className={`inline-flex items-center gap-2 ${pulseClass} animate-fadeIn`}>
      <div
        className={`
          ${config.bgColor}
          ${config.textColor}
          ${sizeClasses[size]}
          rounded-full
          flex items-center gap-1.5
          transition-all duration-150
        `}
      >
        <span className={`${config.dotColor} w-2 h-2 rounded-full`}></span>
        {label && <span className="font-medium">{label}</span>}
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  type: StatusType;
  count?: number;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  count,
  showDot = true,
}) => {
  const config = {
    online: {
      bgColor: 'bg-status-green',
      textColor: 'text-white',
    },
    offline: {
      bgColor: 'bg-status-red',
      textColor: 'text-white',
    },
    checking: {
      bgColor: 'bg-status-orange',
      textColor: 'text-white',
    },
    warning: {
      bgColor: 'bg-status-orange',
      textColor: 'text-white',
    },
    error: {
      bgColor: 'bg-status-red',
      textColor: 'text-white',
    },
  };

  const currentConfig = config[type];

  return (
    <div className="relative">
      {showDot && (
        <div
          className={`
            absolute -top-1 -right-1
            ${currentConfig.bgColor}
            w-3 h-3
            rounded-full
            border-2 border-surface
            animate-pulse
          `}
        ></div>
      )}
      {count !== undefined && (
        <div
          className={`
            absolute -top-2 -right-2
            ${currentConfig.bgColor}
            ${currentConfig.textColor}
            min-w-5 h-5
            rounded-full
            text-xs
            flex items-center justify-center
            border-2 border-surface
            font-bold
            px-1
          `}
        >
          {count > 99 ? '99+' : count}
        </div>
      )}
    </div>
  );
};