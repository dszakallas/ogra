import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  AlertCircle,
  History,
  Globe,
  X,
  Check,
  Star
} from 'lucide-react';
import { ClusterWorkflowTemplate, Workflow } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ParameterInput } from '../components/ParameterInput';
import { getRelativeTime, getDuration } from '../utils/time';
import { useCluster } from '../context/ClusterContext';

interface ClusterWorkflowTemplateDetailProps {
  clusterTemplates: ClusterWorkflowTemplate[];
  workflows: Workflow[];
  onSubmitWorkflow: (
    namespace: string,
    templateName: string,
    params: Record<string, string>,
    isClusterScope?: boolean
  ) => Promise<any>;
}

export function ClusterWorkflowTemplateDetail({
  clusterTemplates,
  workflows,
  onSubmitWorkflow
}: ClusterWorkflowTemplateDetailProps) {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { namespaces, selectedNamespace, toggleFavorite, isFavorite } = useCluster();
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [formParams, setFormParams] = useState<Record<string, string>>({});
  const [targetNamespace, setTargetNamespace] = useState<string>(() => {
    return selectedNamespace !== 'all' ? selectedNamespace : (namespaces[0] || 'default');
  });

  const template = clusterTemplates.find((t) => t.metadata.name === name);

  const favorited = template ? isFavorite('ClusterWorkflowTemplate', undefined, template.metadata.name) : false;

  if (!template) {
    return (
      <div className="not-found">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Cluster Template Not Found</h2>
          <p className="text-sm text-zinc-400">
            The cluster workflow template "{name}" could not be located.
          </p>
        </div>
        <button
          onClick={() => navigate('/resources')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
        >
          Return to Resources
        </button>
      </div>
    );
  }

  const description =
    template.metadata.annotations?.['workflows.argoproj.io/description'] ||
    'No description supplied.';
  const paramsCount = template.spec.arguments?.parameters?.length || 0;
  const stepsCount = template.spec.templates?.length || 0;

  const instantiatedWorkflows = workflows.filter(
    (wf) =>
      wf.metadata.labels?.['workflows.argoproj.io/cluster-workflow-template'] === name ||
      (wf.spec?.workflowTemplateRef?.name === name && wf.spec?.workflowTemplateRef?.clusterScope === true)
  );

  return (
    <div className="detail-page">
      <div className="detail-header">
        <div className="flex items-center gap-2 min-w-0">
          <button
            data-testid="cwt-detail-back-btn"
            onClick={() => navigate('/resources')}
            className="icon-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate font-mono text-zinc-200">
              {template.metadata.name}
            </h1>
            <p className="meta-label">
              Cluster Scoped
            </p>
          </div>
        </div>

        <span
          data-testid="cwt-detail-badge"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-950/20 text-teal-400 border border-teal-900/40"
        >
          <Globe className="w-3 h-3" />
          CLUSTER TEMPLATE
        </span>
        {template && (
          <button
            onClick={() => toggleFavorite('ClusterWorkflowTemplate', undefined, template.metadata.name)}
            className={`p-1.5 rounded-lg transition-all ${
              favorited
                ? 'text-amber-400 bg-amber-950/30 border border-amber-900/40'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-800'
            }`}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className="w-4 h-4" fill={favorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-2">
          <span className="section-title">
            DESCRIPTION
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed select-text">{description}</p>
        </div>

        <div className="space-y-2">
          <span className="section-title">
            STATISTICS
          </span>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="stat-card">
              <span className="text-teal-400 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Parameters</span>
              </span>
              <span className="font-bold text-zinc-300">{paramsCount}</span>
            </div>
            <div className="stat-card">
              <span className="text-cyan-400 flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                <span>Templates</span>
              </span>
              <span className="font-bold text-zinc-300">{stepsCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <button
            data-testid="trigger-cwt-detail-btn"
            onClick={() => {
              const paramsList = template.spec.arguments?.parameters || [];
              const defaults: Record<string, string> = {};
              paramsList.forEach((p) => {
                defaults[p.name] = p.value || p.default || '';
              });
              setFormParams(defaults);
              setTargetNamespace(selectedNamespace !== 'all' ? selectedNamespace : (namespaces[0] || 'default'));
              setShowTriggerModal(true);
            }}
            className="btn-primary w-full"
          >
            <Play className="w-4 h-4" />
            <span>Trigger Workflow</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-zinc-400" />
            <span className="section-title">
              INSTANTIATED WORKFLOWS ({instantiatedWorkflows.length})
            </span>
          </div>

          {instantiatedWorkflows.length === 0 ? (
            <div className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center">
              No workflows have been instantiated from this cluster template yet.
            </div>
          ) : (
            <div className="space-y-2">
              {instantiatedWorkflows.map((wf) => {
                const phase = wf.status?.phase || 'Pending';
                return (
                  <div
                    key={wf.metadata.uid}
                    onClick={() => navigate(`/workflows/${wf.metadata.namespace}/${wf.metadata.name}`)}
                    className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition-all font-mono text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <PhaseBadge phase={phase} size="sm" />
                      <div className="min-w-0 select-text">
                        <h4 className="font-bold text-zinc-200 truncate">
                          <span className="text-zinc-500">{wf.metadata.namespace}/</span>{wf.metadata.name}
                        </h4>
                        <span className="text-[10px] text-zinc-500">
                          Started: {wf.status?.startedAt ? getRelativeTime(wf.status.startedAt) : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-400">
                      {getDuration(wf.status?.startedAt, wf.status?.finishedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTriggerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl mb-12">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
              <div className="min-w-0">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase font-black tracking-widest">
                  SUBMIT CLUSTER WORKFLOW
                </span>
                <h3 className="text-sm font-bold text-zinc-200 font-mono truncate">
                  {template.metadata.name}
                </h3>
              </div>
              <button
                data-testid="close-trigger-modal"
                onClick={() => setShowTriggerModal(false)}
                className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                  Target Namespace
                </label>
                <select
                  data-testid="cwt-target-namespace-select"
                  value={targetNamespace}
                  onChange={(e) => setTargetNamespace(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3.5">
                <h4 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
                  Dynamic Template Parameters
                </h4>
                {(template.spec.arguments?.parameters || []).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">This template has no configurable parameters.</p>
                ) : (
                  template.spec.arguments!.parameters!.map((p) => (
                    <ParameterInput
                      key={p.name}
                      parameter={p}
                      value={formParams[p.name] || ''}
                      onChange={(val) => setFormParams((prev) => ({ ...prev, [p.name]: val }))}
                    />
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-zinc-800/80 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTriggerModal(false)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="launch-workflow-btn"
                  onClick={async () => {
                    try {
                      const result: any = await onSubmitWorkflow(
                        targetNamespace,
                        template.metadata.name,
                        formParams,
                        true
                      );
                      setShowTriggerModal(false);
                      if (result && result.metadata) {
                        navigate(`/workflows/${result.metadata.namespace}/${result.metadata.name}`);
                      }
                    } catch {
                      // Errors handled by Toast in Context
                    }
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(99,102,241,0.2)] active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Launch Workflow</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
