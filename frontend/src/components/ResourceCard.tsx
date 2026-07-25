import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Play, BookOpen, Clock } from 'lucide-react';
import { Workflow, WorkflowTemplate, CronWorkflow } from '../types';
import { PhaseBadge } from './PhaseBadge';
import { getRelativeTime } from '../utils/time';
import { useCluster } from '../context/ClusterContext';

type ResourceKind = 'Workflow' | 'WorkflowTemplate' | 'CronWorkflow';

interface ResourceCardProps {
  kind: ResourceKind;
  resource: Workflow | WorkflowTemplate | CronWorkflow;
}

function getKindColor(kind: ResourceKind): string {
  switch (kind) {
    case 'Workflow': return 'bg-indigo-950/30 text-indigo-400 border-indigo-900/40';
    case 'WorkflowTemplate': return 'bg-cyan-950/30 text-cyan-400 border-cyan-900/40';
    case 'CronWorkflow': return 'bg-amber-950/30 text-amber-400 border-amber-900/40';
  }
}

function getKindLabel(kind: ResourceKind): string {
  switch (kind) {
    case 'Workflow': return 'WORKFLOW';
    case 'WorkflowTemplate': return 'TEMPLATE';
    case 'CronWorkflow': return 'CRON';
  }
}

function getKindIcon(kind: ResourceKind) {
  switch (kind) {
    case 'Workflow': return <Play className="w-3 h-3" />;
    case 'WorkflowTemplate': return <BookOpen className="w-3 h-3" />;
    case 'CronWorkflow': return <Clock className="w-3 h-3" />;
  }
}

function getRoute(kind: ResourceKind, namespace: string, name: string): string {
  switch (kind) {
    case 'Workflow': return `/workflows/${namespace}/${name}`;
    case 'WorkflowTemplate': return `/templates/${namespace}/${name}`;
    case 'CronWorkflow': return `/cron/${namespace}/${name}`;
  }
}

function getPhase(resource: Workflow | WorkflowTemplate | CronWorkflow, kind: ResourceKind): string {
  if (kind === 'Workflow') {
    const wf = resource as Workflow;
    if (wf.spec?.suspend) return 'Suspended';
    return wf.status?.phase || 'Pending';
  }
  if (kind === 'CronWorkflow') {
    const cron = resource as CronWorkflow;
    return cron.spec?.suspend ? 'Suspended' : 'Active';
  }
  return 'Ready';
}

function getTime(resource: Workflow | WorkflowTemplate | CronWorkflow, kind: ResourceKind): string {
  if (kind === 'Workflow') {
    const wf = resource as Workflow;
    return getRelativeTime(wf.status?.startedAt || wf.metadata.creationTimestamp);
  }
  if (kind === 'CronWorkflow') {
    const cron = resource as CronWorkflow;
    return getRelativeTime(cron.status?.lastScheduledTime || cron.metadata.creationTimestamp);
  }
  return getRelativeTime((resource as WorkflowTemplate).metadata.creationTimestamp);
}

function getMessage(resource: Workflow | WorkflowTemplate | CronWorkflow, kind: ResourceKind): string {
  if (kind === 'Workflow') {
    const wf = resource as Workflow;
    if (wf.status?.message) return wf.status.message;
    const tmplRef = wf.spec?.workflowTemplateRef?.name;
    if (tmplRef) return `From template: ${tmplRef}`;
    return '';
  }
  if (kind === 'CronWorkflow') {
    const cron = resource as CronWorkflow;
    const schedule = cron.spec.schedules?.[0] || '';
    const succeeded = cron.status?.succeeded || 0;
    const failed = cron.status?.failed || 0;
    return `${schedule} · ${succeeded} ok / ${failed} failed`;
  }
  const tmpl = resource as WorkflowTemplate;
  const desc = tmpl.metadata.annotations?.['workflows.argoproj.io/description'] || '';
  const paramsCount = tmpl.spec.arguments?.parameters?.length || 0;
  return desc || `${paramsCount} parameters`;
}

export function ResourceCard({ kind, resource }: ResourceCardProps) {
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useCluster();

  const { namespace, name } = resource.metadata;
  const phase = getPhase(resource, kind);
  const time = getTime(resource, kind);
  const message = getMessage(resource, kind);
  const favorited = isFavorite(kind, namespace, name);

  return (
    <div
      onClick={() => navigate(getRoute(kind, namespace, name))}
      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer group shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-mono border font-bold uppercase tracking-wider flex items-center gap-1 ${getKindColor(kind)}`}>
            {getKindIcon(kind)}
            {getKindLabel(kind)}
          </span>
          {(kind === 'Workflow' || kind === 'CronWorkflow') && (
            <PhaseBadge phase={phase} size="sm" />
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(kind, namespace, name); }}
          className={`shrink-0 p-1.5 rounded-lg transition-all ${
            favorited
              ? 'text-amber-400 bg-amber-950/30 border border-amber-900/40'
              : 'text-zinc-600 hover:text-zinc-400 border border-transparent hover:border-zinc-800'
          }`}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className="w-3.5 h-3.5" fill={favorited ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="min-w-0">
        <span className="text-[9px] text-zinc-500 font-mono block uppercase font-black tracking-widest">
          {namespace}
        </span>
        <h2 className="text-sm font-bold text-zinc-200 truncate font-mono tracking-tight group-hover:text-indigo-400 transition-colors select-text">
          {name}
        </h2>
      </div>

      {message && (
        <p className="text-[11px] text-zinc-500 font-mono truncate leading-relaxed">
          {message}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono border-t border-zinc-800/60 pt-2">
        <span>{time}</span>
      </div>
    </div>
  );
}
