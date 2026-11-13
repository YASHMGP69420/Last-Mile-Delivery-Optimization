import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  label?: string;
  searchable?: boolean;
  clearable?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, error, helperText, label, searchable = false, clearable = false, className, id, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const selectRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = searchable
      ? options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

    const selectedOption = options.find((opt) => opt.value === props.value);
    const displayValue = selectedOption?.label || placeholder || '';

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: SelectOption) => {
      props.onChange?.({ target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
      setIsOpen(false);
      setSearchQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      props.onChange?.({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
      setIsOpen(false);
    };

    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1" ref={selectRef}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-on-surface-variant">
            {label}
          </label>
        )}

        <div className="relative">
          <button
            type="button"
            ref={inputRef as any}
            onClick={() => setIsOpen(!isOpen)}
            className={clsx(
              'w-full block rounded-xl border text-sm transition-all placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-surface-low disabled:text-on-surface-variant text-left',
              'pl-3 pr-10 py-2 bg-surface-lowest border-outline-variant/60 text-on-surface focus:border-primary focus:ring-primary/25',
              error && 'border-error focus:border-error focus:ring-error',
              className
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={props['aria-label'] ?? label ?? placeholder}
            disabled={props.disabled}
          >
            <span className={clsx('flex-1 truncate', !selectedOption && 'text-on-surface-variant/50')}>
              {displayValue}
            </span>
            {clearable && props.value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 text-on-surface-variant hover:text-on-surface rounded"
                aria-label="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={clsx(
                'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-outline-variant/60 bg-surface-lowest shadow-2xl animate-fade-in">
              {searchable && (
                <div className="p-2 border-b border-outline-variant/60 sticky top-0 bg-surface-lowest">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      placeholder="Search options..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-outline-variant/60 bg-surface-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
                      autoFocus
                    />
                  </div>
                </div>
              )}
              <ul className="py-1" role="listbox">
                {filteredOptions.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-on-surface-variant">
                    {searchable ? 'No matching options' : 'No options available'}
                  </li>
                ) : (
                  filteredOptions.map((option) => (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={props.value === option.value}
                      onClick={() => handleSelect(option)}
                      className={clsx(
                        'px-3 py-2.5 text-sm cursor-pointer transition-colors',
                        props.value === option.value
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-on-surface hover:bg-surface-low'
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-on-surface-variant mt-0.5">{option.description}</div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-error font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-on-surface-variant">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
