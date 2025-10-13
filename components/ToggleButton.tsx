import React from 'react';

interface ToggleProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export default function Toggle({ label, checked = false, onChange }: ToggleProps) {
  const toggle = () => {
    const next = !checked;
    onChange?.(next);
  };

  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>

      {label && <span className='text-sm text-gray-800 select-none'>{label}</span>}
    </div>
  );
}
