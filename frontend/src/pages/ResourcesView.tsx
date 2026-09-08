import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Layers, Activity, AlertCircle } from 'lucide-react';
import { Workflow, WorkflowTemplate, ClusterWorkflowTemplate, CronWorkflow } from '../types';
import { useCluster, ResourceEvent } from '../context/ClusterContext';
import { ResourceCard } from '../components/ResourceCard';
import { getRelativeTime } from '../utils/time';

type SubTab = 'resources' | 'favorites' | 'events';

type ResourceKind = 'Workflow' | 'WorkflowTemplate' | 'ClusterWorkflowTemplate' | 'CronWorkflow';

interface UnifiedResource {
  kind: ResourceKind;
  resource: Workflow | WorkflowTemplate | ClusterWorkflowTemplate | CronWorkflow;
}

export function ResourcesView() {
  const { workflows, templates, clusterTemplates, cronWorkflows, favorites, eventHistory } = useCluster();
  const [searchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') as SubTab | null;
  const kindFilter = searchParams.get('kind') as ResourceKind | null;
  const nsFilter = searchParams.get('ns') || null;
  const queryFilter = searchParams.get('q') || null;
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab === 'favorites' || initialTab === 'events' ? initialTab : 'resources');

  const allResources: UnifiedResource[] = useMemo(() => {
    const resources: UnifiedResource[] = [
      ...workflows.map((w) => ({ kind: 'Workflow' as const, resource: w })),
      ...templates.map((t) => ({ kind: 'WorkflowTemplate' as const, resource: t })),
      ...clusterTemplates.map((ct) => ({ kind: 'ClusterWorkflowTemplate' as const, resource: ct })),
      ...cronWorkflows.map((c) => ({ kind: 'CronWorkflow' as const, resource: c }))
    ];

    return resources.filter((r) => {
      if (kindFilter && r.kind !== kindFilter) return false;
      if (nsFilter) {
        if (r.kind === 'ClusterWorkflowTemplate') {
          if (kindFilter !== 'ClusterWorkflowTemplate') return false;
        } else if (r.resource.metadata.namespace !== nsFilter) {
          return false;
        }
      }
      if (queryFilter) {
        const q = queryFilter.toLowerCase();
        const name = r.resource.metadata.name.toLowerCase();
        const ns = (r.resource.metadata.namespace || '').toLowerCase();
        if (!name.includes(q) && !ns.includes(q) && !`${ns}/${name}`.includes(q)) return false;
      }
      return true;
    });
  }, [workflows, templates, clusterTemplates, cronWorkflows, kindFilter, nsFilter, queryFilter]);

  const favoritedResources = useMemo(() => {
    return allResources.filter(({ kind, resource }) => {
      const ns = resource.metadata.namespace || '_';
      const key = `${kind}/${ns}/${resource.metadata.name}`;
      return favorites.has(key);
    });
  }, [allResources, favorites]);

  const tabs: { id: SubTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'resources', label: 'Resources', icon: <Layers className="w-4 h-4" />, count: allResources.length },
    { id: 'favorites', label: 'Favorites', icon: <Star className="w-4 h-4" />, count: favoritedResources.length },
    { id: 'events', label: 'Events', icon: <Activity className="w-4 h-4" />, count: eventHistory.length }
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full px-4 pb-20">
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-display flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          Resources
        </h1>
      </div>

      <div className="flex border border-zinc-800/80 bg-zinc-900 p-1.5 rounded-2xl select-none shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-center py-2.5 text-[11px] font-mono font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white font-extrabold shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className="text-[9px] opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'resources' && (
        <div className="space-y-3">
          {allResources.length === 0 ? (
            <EmptyState message="No resources found" />
          ) : (
            allResources.map(({ kind, resource }) => (
              <ResourceCard key={`${kind}/${resource.metadata.uid}`} kind={kind} resource={resource} />
            ))
          )}
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {favoritedResources.length === 0 ? (
            <EmptyState message="No favorites yet" hint="Star any resource to add it here. Favorites are saved in your browser." />
          ) : (
            favoritedResources.map(({ kind, resource }) => (
              <ResourceCard key={`${kind}/${resource.metadata.uid}`} kind={kind} resource={resource} />
            ))
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-2">
          {eventHistory.length === 0 ? (
            <EmptyState message="No events yet" hint="Workflow events will appear here as they happen." />
          ) : (
            eventHistory.map((ev, i) => <EventRow key={`${ev.timestamp}-${i}`} event={ev} />)
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 shadow-inner">
      <AlertCircle className="w-9 h-9 text-zinc-600" />
      <h3 className="text-sm font-semibold text-zinc-300 font-display">{message}</h3>
      {hint && <p className="text-xs text-zinc-500 max-w-sm">{hint}</p>}
    </div>
  );
}

function EventRow({ event }: { event: ResourceEvent }) {
  const typeColor = event.type === 'ADDED' ? 'text-emerald-400' : event.type === 'DELETED' ? 'text-rose-400' : 'text-indigo-400';
  const typeLabel = event.type === 'ADDED' ? 'CREATED' : event.type === 'DELETED' ? 'DELETED' : 'UPDATED';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3 font-mono text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${typeColor}`}>
          {typeLabel}
        </span>
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-indigo-950/30 text-indigo-400 border border-indigo-900/40 font-bold">
          {event.kind.toUpperCase()}
        </span>
        <span className="text-zinc-200 truncate font-bold">{event.namespace}/{event.name}</span>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {event.phase && (
          <span className="text-[10px] text-zinc-500">{event.phase}</span>
        )}
        <span className="text-[10px] text-zinc-600">{getRelativeTime(event.timestamp)}</span>
      </div>
    </div>
  );
}
