import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  AlertCircle,
  History,
  BookOpen,
  X,
  Check,
  Star
} from 'lucide-react';
import { WorkflowTemplate, Workflow } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { ParameterInput } from '../components/ParameterInput';
import { getRelativeTime, getDuration } from '../utils/time';
import { useCluster } from '../context/ClusterContext';

interface WorkflowTemplateDetailProps {
  templates: WorkflowTemplate[];
  workflows: Workflow[];
  onSubmitWorkflow: (namespace: string, templateName: string, params: Record<string, string>) => void;
}

export function WorkflowTemplateDetail({
  templates,
  workflows,
  onSubmitWorkflow
}: WorkflowTemplateDetailProps) {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useCluster();
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [formParams, setFormParams] = useState<Record<string, string>>({});

  const template = templates.find(
    (t) => t.metadata.namespace === namespace && t.metadata.name === name
  );

  const favorited = template ? isFavorite('WorkflowTemplate', template.metadata.namespace, template.metadata.name) : false;

  if (!template) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-zinc-950 border border-zinc-800 rounded-xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Template Not Found</h2>
          <p className="text-sm text-zinc-400">
            The template "{name}" in namespace "{namespace}" could not be located.
          </p>
        </div>
        <button
          onClick={() => navigate('/resources')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
        >
          Return to Templates
        </button>
      </div>
    );
  }

  const description = template.metadata.annotations?.['workflows.argoproj.io/description'] || 'No description supplied.';
  const paramsCount = template.spec.arguments?.parameters?.length || 0;
  const stepsCount = template.spec.templates?.length || 0;

  const instantiatedWorkflows = workflows.filter(
    (wf) =>
      wf.metadata.namespace === namespace &&
      wf.metadata.labels?.['workflows.argoproj.io/workflow-template'] === name
  );

  return (
    <div className="flex flex-col min-h-screen pb-16 bg-zinc-950 text-white max-w-2xl mx-auto w-full border-x border-zinc-900/40">
      <div className="sticky top-0 z-20 flex items-center justify-between p-3 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <button
            data-testid="template-detail-back-btn"
            onClick={() => navigate('/resources')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate font-mono text-zinc-200">
              {template.metadata.name}
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {template.metadata.namespace}
            </p>
          </div>
        </div>

        <span data-testid="template-detail-badge" className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/20 text-indigo-400 border border-indigo-900/40">
          <BookOpen className="w-3 h-3" />
          TEMPLATE
        </span>
        {template && (
          <button
            onClick={() => toggleFavorite('WorkflowTemplate', template.metadata.namespace, template.metadata.name)}
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
          <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500">
            DESCRIPTION
          </span>
          <p className="text-sm text-zinc-300 leading-relaxed select-text">{description}</p>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500">
            STATISTICS
          </span>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 flex justify-between items-center">
              <span className="text-indigo-400 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Parameters</span>
              </span>
              <span className="font-bold text-zinc-300">{paramsCount}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 flex justify-between items-center">
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
            data-testid="trigger-template-detail-btn"
            onClick={() => {
              const paramsList = template.spec.arguments?.parameters || [];
              const defaults: Record<string, string> = {};
              paramsList.forEach((p) => {
                defaults[p.name] = p.value || p.default || '';
              });
              setFormParams(defaults);
              setShowTriggerModal(true);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Trigger Workflow</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-zinc-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500">
              INSTANTIATED WORKFLOWS ({instantiatedWorkflows.length})
            </span>
          </div>

          {instantiatedWorkflows.length === 0 ? (
            <div className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center">
              No workflows have been instantiated from this template yet.
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
                          {wf.metadata.name}
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
                  SUBMIT WORKFLOW
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
                        template.metadata.namespace,
                        template.metadata.name,
                        formParams
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
