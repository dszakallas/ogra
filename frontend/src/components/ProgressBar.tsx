import React from 'react';
import { WorkflowPhase } from '../types';

interface ProgressBarProps {
  progress: string | undefined; // "N/M" format, e.g. "3/5"
  phase: WorkflowPhase;
}

export function ProgressBar({ progress, phase }: ProgressBarProps) {
  let done = 0;
  let total = 0;

  if (progress && progress.includes('/')) {
    const parts = progress.split('/');
    done = parseInt(parts[0], 10) || 0;
    total = parseInt(parts[1], 10) || 0;
  }

  // Fallbacks if total is unspecified
  if (total <= 0) {
    if (phase === 'Succeeded') {
      done = 5;
      total = 5;
    } else if (phase === 'Failed' || phase === 'Error') {
      done = 2;
      total = 5;
    } else {
      done = 1;
      total = 5;
    }
  }

  // Ensure bounds
  done = Math.min(done, total);

  // Generate segments
  const segments = [];
  for (let i = 0; i < total; i++) {
    let state: 'done' | 'running' | 'pending' | 'failed' = 'pending';
    
    if (i < done) {
      state = 'done';
    } else if (i === done && phase === 'Running') {
      state = 'running';
    } else if (phase === 'Failed' || phase === 'Error') {
      state = 'failed';
    }

    segments.push(state);
  }

  const percentage = Math.round((done / total) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5 text-[10px] font-mono font-black text-zinc-500 tracking-wider">
        <span>PROGRESS</span>
        <span className="text-zinc-400 font-bold">{done}/{total} ({percentage}%)</span>
      </div>
      
      <div className="flex gap-1.5 h-2.5 w-full">
        {segments.map((state, idx) => {
          let bgClass = 'bg-zinc-850';
          if (state === 'done') {
            bgClass = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
          } else if (state === 'running') {
            bgClass = 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]';
          } else if (state === 'failed') {
            bgClass = 'bg-rose-500/60';
          }

          return (
            <div
              key={idx}
              className={`h-full flex-1 rounded-md transition-all duration-500 ${bgClass}`}
            />
          );
        })}
      </div>
    </div>
  );
}
