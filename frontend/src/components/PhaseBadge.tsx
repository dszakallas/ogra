import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock, SkipForward, HelpCircle } from 'lucide-react';
import { WorkflowPhase, NodePhase } from '../types';

interface PhaseBadgeProps {
  phase: WorkflowPhase | NodePhase;
  size?: 'sm' | 'md' | 'lg';
}

export function PhaseBadge({ phase, size = 'md' }: PhaseBadgeProps) {
  const normalized = phase || 'Pending';

  let icon = <HelpCircle className="w-4 h-4 text-zinc-400" />;
  let styles = 'bg-zinc-900/40 text-zinc-400 border border-zinc-850';

  switch (normalized) {
    case 'Pending':
      icon = <Clock className="w-3.5 h-3.5 text-amber-400" />;
      styles = 'bg-amber-950/20 text-amber-400 border border-amber-900/30';
      break;
    case 'Running':
      icon = <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />;
      styles = 'bg-indigo-950/20 text-indigo-400 border border-indigo-900/30 font-medium shadow-[0_0_12px_rgba(99,102,241,0.15)]';
      break;
    case 'Succeeded':
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      styles = 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30';
      break;
    case 'Failed':
      icon = <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      styles = 'bg-rose-950/20 text-rose-400 border border-rose-900/30';
      break;
    case 'Error':
      icon = <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      styles = 'bg-red-950/20 text-red-400 border border-red-900/30';
      break;
    case 'Skipped':
      icon = <SkipForward className="w-3.5 h-3.5 text-zinc-450" />;
      styles = 'bg-zinc-800/30 text-zinc-400 border border-zinc-750/50';
      break;
    case 'Omitted':
      icon = <SkipForward className="w-3.5 h-3.5 text-zinc-500" />;
      styles = 'bg-zinc-800/10 text-zinc-500 border border-zinc-800';
      break;
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3.5 py-1.5 text-xs font-bold' : 'px-2.5 py-1 text-xs';
  const gapClass = size === 'sm' ? 'gap-1' : 'gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-lg font-mono uppercase tracking-wider font-bold ${paddingClass} ${gapClass} ${styles}`}>
      {icon}
      <span>{normalized}</span>
    </span>
  );
}
