import React from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'contained';
  fullWidth?: boolean;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  fullWidth = true,
}) => {
  const isContained = variant === 'contained';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`${widthClass} animate-fadeIn`}>
      {isContained ? (
        <div className="md3-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`
                md3-tab
                ${activeTab === tab.id ? 'md3-tab--active' : ''}
                ${tab.disabled ? 'opacity-38 cursor-not-allowed' : ''}
                transition-all duration-150
              `}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
            >
              <div className="flex items-center justify-center gap-2">
                {tab.icon && <span className="flex items-center">{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-outline-variant">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`
                px-4 py-3 text-sm font-medium
                ${activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
                }
                ${tab.disabled ? 'opacity-38 cursor-not-allowed' : ''}
                transition-all duration-150
                relative
              `}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
            >
              <div className="flex items-center gap-2">
                {tab.icon && <span className="flex items-center">{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-slideIn"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};