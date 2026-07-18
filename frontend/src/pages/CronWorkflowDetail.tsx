import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Play,
  Pause,
  AlertCircle,
  Clock,
  ExternalLink,
  History,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { CronWorkflow, Workflow } from '../types';
import cronstrue from 'cronstrue';
import { getRelativeTime } from '../utils/time';

interface CronWorkflowDetailProps {
  cronWorkflows: CronWorkflow[];
  workflows: Workflow[];
  onTrigger: (namespace: string, name: string) => void;
  onSuspendToggle: (namespace: string, name: string, isCurrentlySuspended: boolean) => void;
}

export function CronWorkflowDetail({
  cronWorkflows,
  workflows,
  onTrigger,
  onSuspendToggle
}: CronWorkflowDetailProps) {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();

  // Find the selected CronWorkflow
  const cron = cronWorkflows.find(
    (c) => c.metadata.namespace === namespace && c.metadata.name === name
  );

  if (!cron) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-gray-950 border border-gray-800 rounded-xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">CronWorkflow Not Found</h2>
          <p className="text-sm text-gray-500">
            The CronWorkflow "{name}" in namespace "{namespace}" could not be located.
          </p>
        </div>
        <button
          onClick={() => navigate('/cron')}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-all"
        >
          Return to Cron List
        </button>
      </div>
    );
  }

  const isSuspended = cron.spec.suspend === true;
  const scheduleExpr = cron.spec.schedule || cron.spec.schedules?.[0] || '';
  const timezone = cron.spec.timezone || 'UTC';
  const succeeded = cron.status?.succeeded || 0;
  const failed = cron.status?.failed || 0;
  const lastRun = cron.status?.lastScheduledTime;

  // Filter workflows triggered by this cron
  const triggeredWorkflows = workflows.filter(
    (wf) =>
      wf.metadata.namespace === namespace &&
      wf.metadata.labels?.['workflows.argoproj.io/cron-workflow'] === name
  );

  const getHumanSchedule = (expr: string) => {
    try {
      return cronstrue.toString(expr, { use24HourTimeFormat: true });
    } catch (e) {
      return expr;
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-16 bg-[#07090E] text-white max-w-2xl mx-auto w-full border-x border-gray-900/40">
      {/* Top sticky header */}
      <div className="sticky top-0 z-20 flex items-center justify-between p-3 bg-gray-950/90 border-b border-gray-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/cron')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate font-mono text-gray-200">
              {cron.metadata.name}
            </h1>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
              {cron.metadata.namespace}
            </p>
          </div>
        </div>

        {/* Suspend State Badge */}
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
            isSuspended
              ? 'bg-rose-950/20 text-rose-500 border-rose-900/40'
              : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40'
          }`}
        >
          {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Schedule Display */}
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-4 space-y-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-gray-500">
            CRON JOB TIMING
          </span>
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold text-gray-200">
                {getHumanSchedule(scheduleExpr)}
              </h3>
              <div className="text-[11px] text-gray-500 font-mono">
                Expression: <code className="text-gray-300 bg-gray-900 px-1 py-0.5 rounded">{scheduleExpr}</code>
              </div>
            </div>
          </div>
          <div className="flex justify-between border-t border-gray-900/80 pt-2.5 font-mono text-[11px] text-gray-400">
            <span>TIMEZONE: {timezone}</span>
            <span>LAST RUN: {getRelativeTime(lastRun)}</span>
          </div>
        </div>

        {/* Statistics bar */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-gray-500">
            STATISTICS
          </span>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-900 flex justify-between items-center">
              <span className="text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Succeeded</span>
              </span>
              <span className="font-bold text-gray-300">{succeeded}</span>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-900 flex justify-between items-center">
              <span className="text-rose-500 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Failed</span>
              </span>
              <span className="font-bold text-gray-300">{failed}</span>
            </div>
          </div>
        </div>

        {/* Trigger Controls bar */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 flex gap-2">
          <button
            onClick={async () => {
              const triggered: any = await onTrigger(cron.metadata.namespace, cron.metadata.name);
              if (triggered && triggered.metadata) {
                navigate(`/workflows/${triggered.metadata.namespace}/${triggered.metadata.name}`);
              }
            }}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Trigger Run Now</span>
          </button>

          <button
            onClick={() => onSuspendToggle(cron.metadata.namespace, cron.metadata.name, isSuspended)}
            className="flex-1 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            {isSuspended ? (
              <>
                <ToggleLeft className="w-4 h-4 text-rose-500" />
                <span>Activate Schedule</span>
              </>
            ) : (
              <>
                <ToggleRight className="w-4 h-4 text-emerald-400" />
                <span>Suspend Schedule</span>
              </>
            )}
          </button>
        </div>

        {/* History / Recent Workflows list */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-gray-500">
              RECENT TRIGGERED RUNS ({triggeredWorkflows.length})
            </span>
          </div>

          {triggeredWorkflows.length === 0 ? (
            <div className="text-xs text-gray-500 italic bg-gray-950 p-4 rounded-xl border border-gray-900 text-center">
              No recent workflows triggered by this cron schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {triggeredWorkflows.map((wf) => (
                <div
                  key={wf.metadata.uid}
                  onClick={() => navigate(`/workflows/${wf.metadata.namespace}/${wf.metadata.name}`)}
                  className="bg-gray-950 border border-gray-900 hover:border-gray-800 rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition-all font-mono text-xs"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                      {wf.metadata.name}
                    </h4>
                    <span className="text-[10px] text-gray-500">
                      Triggered: {wf.status?.startedAt ? getRelativeTime(wf.status.startedAt) : 'Pending'}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      ⏱ {wf.status?.startedAt ? Math.round((new Date(wf.status.finishedAt || Date.now()).getTime() - new Date(wf.status.startedAt).getTime()) / 1000) : 0}s
                    </span>
                    <span className="text-[10px] bg-gray-900 px-1.5 py-0.5 rounded text-gray-400 border border-gray-800">
                      {wf.status?.phase || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
