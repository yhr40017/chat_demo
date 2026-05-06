import React from 'react';

interface Props {
  dark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ dark, onToggle }: Props) {
  return (
    <button className="theme-toggle" onClick={onToggle} title="테마 전환">
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
