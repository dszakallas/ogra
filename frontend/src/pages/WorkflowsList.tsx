import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCw, Filter, SlidersHorizontal, Plus, AlertCircle, Layout, Calendar, Layers, Clock, Trash2 } from 'lucide-react';
import { Workflow, WorkflowPhase } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ProgressBar } from '../components/ProgressBar';
import { getRelativeTime, getDuration } from '../utils/time';

interface WorkflowsListProps {
  workflows: Workflow[];
  selectedNamespace: string;
  search: string;
  setSearch: (s: string) => void;
  selectedPhase: string;
  setSelectedPhase: (p: string) => void;
  onRefresh: () => void;
  onDelete: (namespace: string, name: string) => void;
}

export function WorkflowsList({
  workflows,
  selectedNamespace,
  search,
  setSearch,
  selectedPhase,
  setSelectedPhase,
  onRefresh,
  onDelete
}: WorkflowsListProps) {
  const navigate = useNavigate();

  // Filter workflows based on selected namespace, search, and phase chip
  const filteredWorkflows = workflows.filter((wf) => {
    // Namespace filter
    const matchesNamespace =
      selectedNamespace === 'all' || wf.metadata.namespace === selectedNamespace;

    // Search filter
    const matchesSearch =
      wf.metadata.name.toLowerCase().includes(search.toLowerCase()) ||
      wf.spec.workflowTemplateRef?.name?.toLowerCase().includes(search.toLowerCase()) ||
      wf.metadata.labels?.['workflows.argoproj.io/cron-workflow']?.toLowerCase().includes(search.toLowerCase());

    // Phase filter chip
    const phase = wf.status?.phase || 'Pending';
    const matchesPhase =
      selectedPhase === 'ALL' ||
      phase.toUpperCase() === selectedPhase;

    return matchesNamespace && matchesSearch && matchesPhase;
  });

  // Calculate status counts for the selected namespace
  const counts = workflows
    .filter((wf) => selectedNamespace === 'all' || wf.metadata.namespace === selectedNamespace)
    .reduce(
      (acc, wf) => {
        const ph = wf.status?.phase || 'Pending';
        acc[ph] = (acc[ph] || 0) + 1;
        return acc;
      },
      { Pending: 0, Running: 0, Succeeded: 0, Failed: 0, Error: 0 } as Record<string, number>
    );

  const totalFilteredCount = workflows.filter(
    (wf) => selectedNamespace === 'all' || wf.metadata.namespace === selectedNamespace
  ).length;

  const phaseChips = [
    { label: 'All', value: 'ALL', count: totalFilteredCount, color: 'border-gray-800 text-gray-300' },
    { label: 'Running', value: 'RUNNING', count: counts.Running || 0, color: 'border-blue-900/50 text-blue-400 bg-blue-950/10' },
    { label: 'Pending', value: 'PENDING', count: counts.Pending || 0, color: 'border-amber-900/50 text-amber-500 bg-amber-950/10' },
    { label: 'Succeeded', value: 'SUCCEEDED', count: counts.Succeeded || 0, color: 'border-emerald-900/50 text-emerald-400 bg-emerald-950/10' },
    { label: 'Failed', value: 'FAILED', count: (counts.Failed || 0) + (counts.Error || 0), color: 'border-rose-900/50 text-rose-400 bg-rose-950/10' }
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full px-4 pb-20">
      {/* Header Panel */}
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-display flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          Workflow Runs
        </h1>
      </div>

      {/* Workflow Cards List */}
      <div className="space-y-4">
        {filteredWorkflows.length === 0 ? (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 shadow-inner">
            <AlertCircle className="w-9 h-9 text-zinc-600" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-300 font-display">No runs matched</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                No active runs found matching "{search}" under phase "{selectedPhase}".
              </p>
            </div>
            {selectedPhase !== 'ALL' && (
              <button
                onClick={() => setSelectedPhase('ALL')}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredWorkflows.map((wf) => {
            const isCompleted = wf.metadata.labels?.['workflows.argoproj.io/completed'] === 'true';
            const templateRef = wf.spec?.workflowTemplateRef?.name;
            const cronRef = wf.metadata.labels?.['workflows.argoproj.io/cron-workflow'];
            const phase = wf.status?.phase || 'Pending';

            return (
              <div
                key={wf.metadata.uid}
                onClick={() => navigate(`/workflows/${wf.metadata.namespace}/${wf.metadata.name}`)}
                className="bg-[#121212] border border-zinc-800 hover:border-zinc-700/80 active:bg-zinc-900/40 rounded-2xl p-5 flex flex-col gap-3.5 transition-all cursor-pointer group shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
              >
                {/* Name & Title Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[9px] text-zinc-500 font-mono tracking-widest block uppercase font-black">
                      {wf.metadata.namespace}
                    </span>
                    <h2 className="text-sm font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors font-mono tracking-tight">
                      {wf.metadata.name}
                    </h2>
                  </div>

                  {/* Phase badge */}
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <PhaseBadge phase={phase} />
                  </div>
                </div>

                {/* Subtext info row */}
                {(templateRef || cronRef) && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-400 pt-1">
                    {templateRef && (
                      <span className="flex items-center gap-1 bg-zinc-900/80 px-2.5 py-1 rounded-lg text-zinc-300 border border-zinc-800/80">
                        <Layout className="w-3.5 h-3.5 text-indigo-400" />
                        Tmpl: {templateRef}
                      </span>
                    )}
                    {cronRef && (
                      <span className="flex items-center gap-1 bg-zinc-900/80 px-2.5 py-1 rounded-lg text-zinc-300 border border-zinc-800/80">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        Cron: {cronRef}
                      </span>
                    )}
                  </div>
                )}

                {/* Progress bar or Status detail */}
                {(phase === 'Running' || isCompleted) && wf.status?.progress && (
                  <div className="bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/40">
                    <ProgressBar progress={wf.status.progress} phase={phase} />
                  </div>
                )}

                {/* Timers Footer & Action Buttons */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-zinc-800/60 pt-3 mt-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      Started: {getRelativeTime(wf.status?.startedAt)}
                    </span>
                    <span className="text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800/50">
                      ⏱ {getDuration(wf.status?.startedAt, wf.status?.finishedAt)}
                    </span>
                  </div>

                  {/* Delete button panel on cards */}
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete workflow ${wf.metadata.name}?`)) {
                          onDelete(wf.metadata.namespace, wf.metadata.name);
                        }
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all"
                      title="Delete Workflow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
