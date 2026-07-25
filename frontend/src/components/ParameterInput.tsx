import React from 'react';
import { Parameter } from '../types';

interface ParameterInputProps {
  key?: React.Key;
  parameter: Parameter;
  value: string;
  onChange: (value: string) => void;
}

export function ParameterInput({ parameter, value, onChange }: ParameterInputProps) {
  const { name, description, enum: enumValues, default: defaultValue } = parameter;

  const placeholder = defaultValue || '';
  const isSecret = name.toLowerCase().includes('password') || name.toLowerCase().includes('secret') || name.toLowerCase().includes('token');
  const isLong = description && description.length > 80;

  return (
    <div className="flex flex-col gap-1 w-full bg-zinc-900/20 border border-zinc-800/60 p-3 rounded-lg focus-within:border-blue-600/60 transition-colors">
      <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center justify-between">
        <span>{name}</span>
        {defaultValue && (
          <span className="text-[10px] text-zinc-500 font-normal">
            Default: <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-400">{defaultValue}</code>
          </span>
        )}
      </label>

      {description && (
        <span className="text-[11px] text-zinc-400 leading-relaxed">
          {description}
        </span>
      )}

      <div className="mt-1.5">
        {enumValues && enumValues.length > 0 ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
          >
            {enumValues.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        ) : isLong ? (
          <textarea
            rows={2}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
          />
        ) : (
          <input
            type={isSecret ? 'password' : 'text'}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
          />
        )}
      </div>
    </div>
  );
}
