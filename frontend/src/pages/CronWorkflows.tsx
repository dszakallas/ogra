import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Play, AlertCircle, Clock } from 'lucide-react';
import { CronWorkflow } from '../types';
import cronstrue from 'cronstrue';
import { getRelativeTime } from '../utils/time';

interface CronWorkflowsProps {
  cronWorkflows: CronWorkflow[];
  selectedNamespace: string;
  search: string;
  onTrigger: (namespace: string, name: string) => void;
  onSuspendToggle: (namespace: string, name: string, isCurrentlySuspended: boolean) => void;
}

export function CronWorkflows({
  cronWorkflows,
  selectedNamespace,
  search,
  onTrigger,
  onSuspendToggle
}: CronWorkflowsProps) {
  const navigate = useNavigate();

  const filteredCrons = cronWorkflows.filter((cron) => {
    const matchesNamespace = selectedNamespace === 'all' || cron.metadata.namespace === selectedNamespace;
    const schedulesStr = cron.spec.schedules?.join(', ') || '';
    const matchesSearch = cron.metadata.name.toLowerCase().includes(search.toLowerCase()) ||
                          schedulesStr.toLowerCase().includes(search.toLowerCase());
    return matchesNamespace && matchesSearch;
  });

  const getHumanSchedule = (expr: string) => {
    try {
      return cronstrue.toString(expr, { use24HourTimeFormat: true });
    } catch {
      return expr;
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full px-4 pb-20 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-display flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          Cron Workflows
        </h1>
      </div>

      {/* Cron List */}
      <div className="space-y-4">
        {filteredCrons.length === 0 ? (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 shadow-inner">
            <AlertCircle className="w-9 h-9 text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-300 font-display">No CronWorkflows found</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              No active cron schedule records in namespace "{selectedNamespace}".
            </p>
          </div>
        ) : (
          filteredCrons.map((cron) => {
            const isSuspended = cron.spec.suspend === true;
            const scheduleExpr = cron.spec.schedules?.join(', ') || '';
            const timezone = cron.spec.timezone || 'UTC';
            const succeeded = cron.status?.succeeded || 0;
            const failed = cron.status?.failed || 0;
            const lastRun = cron.status?.lastScheduledTime;

            return (
              <div
                key={cron.metadata.uid}
                onClick={() => navigate(`/cron/${cron.metadata.namespace}/${cron.metadata.name}`)}
                className="bg-[#121212] border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm cursor-pointer group transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[9px] text-zinc-500 font-mono block uppercase font-black tracking-widest">
                        {cron.metadata.namespace}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[8px] font-mono border font-bold uppercase tracking-wider shrink-0 ${
                          isSuspended
                            ? 'bg-rose-950/20 text-rose-400 border-rose-900/30'
                            : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                        }`}
                      >
                        {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-zinc-200 truncate font-mono group-hover:text-indigo-400 transition-colors tracking-tight">
                      {cron.metadata.name}
                    </h2>
                  </div>

                  {/* Actions buttons identical to template cards but with suspension toggle */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSuspendToggle(cron.metadata.namespace, cron.metadata.name, isSuspended)}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors"
                    >
                      {isSuspended ? 'Activate' : 'Suspend'}
                    </button>
                    <button
                      onClick={() => onTrigger(cron.metadata.namespace, cron.metadata.name)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.2)] transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Trigger</span>
                    </button>
                  </div>
                </div>

                {/* Human schedule panel */}
                <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold font-mono">
                    <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{getHumanSchedule(scheduleExpr)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>EXPRESSION: {scheduleExpr}</span>
                    <span>TZ: {timezone}</span>
                  </div>
                </div>

                {/* Stats summary block */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono border-t border-zinc-800/40 pt-3">
                  <div className="flex gap-3">
                    <span className="text-emerald-500 font-bold">✓ {succeeded} Succeeded</span>
                    <span className="text-rose-400 font-bold">✗ {failed} Failed</span>
                  </div>
                  <span className="text-zinc-500">LAST RUN: <b className="text-zinc-400 font-normal">{getRelativeTime(lastRun)}</b></span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
