import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  StopCircle,
  XCircle,
  Trash2,
  Clock,
  Terminal,
  Activity,
  AlertCircle,
  ExternalLink,
  Copy,
  Layers,
  CheckCircle2,
  Star
} from 'lucide-react';
import { useCluster } from '../context/ClusterContext';
import { Workflow } from '../types';
import { PhaseBadge } from '../components/PhaseBadge';
import { LogStream } from '../components/LogStream';
import { getDuration } from '../utils/time';

interface WorkflowDetailProps {
  workflows: Workflow[];
  onSuspend: (namespace: string, name: string) => void;
  onResume: (namespace: string, name: string) => void;
  onStop: (namespace: string, name: string) => void;
  onTerminate: (namespace: string, name: string) => void;
  onRetry: (namespace: string, name: string) => void;
  onDelete: (namespace: string, name: string) => void;
  onResubmit: (namespace: string, templateName: string, params: Record<string, string>) => void;
}

type TabType = 'SUMMARY' | 'NODES' | 'TIMELINE' | 'LOGS';

export function WorkflowDetail({
  workflows,
  onSuspend,
  onResume,
  onStop,
  onTerminate,
  onRetry,
  onDelete,
  onResubmit
}: WorkflowDetailProps) {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const { addToast, toggleFavorite, isFavorite } = useCluster();

  const [activeTab, setActiveTab] = useState<TabType>('SUMMARY');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const [directFetchedWf, setDirectFetchedWf] = useState<Workflow | null>(null);
  const [fetchingDirect, setFetchingDirect] = useState(false);

  // Find current workflow from live list state
  const workflowFromList = workflows.find(
    (wf) => wf.metadata.namespace === namespace && wf.metadata.name === name
  );
  const workflow = workflowFromList || directFetchedWf;

  const favorited = workflow ? isFavorite('Workflow', workflow.metadata.namespace, workflow.metadata.name) : false;

  // Direct fetch fallback if workflow is not yet in live state
  useEffect(() => {
    if (!workflowFromList && namespace && name && !directFetchedWf && !fetchingDirect) {
      setFetchingDirect(true);
      fetch(`/api/v1/workflows/${namespace}/${name}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.metadata) {
            setDirectFetchedWf(data);
          }
        })
        .catch(() => {})
        .finally(() => setFetchingDirect(false));
    }
  }, [workflowFromList, namespace, name, directFetchedWf, fetchingDirect]);

  // Auto-select the first running or failed pod when entering logs
  useEffect(() => {
    if (workflow?.status?.nodes) {
      const pods = Object.values(workflow.status.nodes).filter((n) => n.type === 'Pod');
      const active = pods.find((p) => p.phase === 'Running') || pods.find((p) => p.phase === 'Failed') || pods[0];
      if (active && !selectedPodId) {
        setSelectedPodId(active.id);
      }
    }
  }, [workflow, selectedPodId]);

  if (!workflow) {
    if (fetchingDirect) {
      return (
        <div className="max-w-md mx-auto my-24 text-center space-y-3 font-mono text-xs">
          <Clock className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
          <span className="text-zinc-500 block uppercase font-bold tracking-wider">Fetching workflow details...</span>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-zinc-950 border border-zinc-800 rounded-xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Workflow Not Found</h2>
          <p className="text-sm text-zinc-500">
            The workflow "{name}" in namespace "{namespace}" could not be located in our cluster.
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

  const phase = workflow.status?.phase || 'Pending';
  const isSuspended = workflow.spec?.suspend === true;
  const isRunning = phase === 'Running' && !isSuspended;

  const nodesList = workflow.status?.nodes ? Object.values(workflow.status.nodes) : [];
  const podNodes = nodesList.filter((n) => n.type === 'Pod');

  // Compute node status summary counts
  const nodeStats = podNodes.reduce(
    (acc, node) => {
      acc[node.phase] = (acc[node.phase] || 0) + 1;
      return acc;
    },
    { Succeeded: 0, Running: 0, Pending: 0, Failed: 0, Error: 0, Skipped: 0, Omitted: 0 } as Record<string, number>
  );



  const toggleExpandNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAction = (action: () => void) => {
    action();
    setShowActionsMenu(false);
  };

  // Convert inputs parameter list
  const workflowParams = workflow.spec?.arguments?.parameters || [];

  return (
    <div className="flex flex-col min-h-screen pb-16 bg-zinc-950 text-white max-w-2xl mx-auto w-full border-x border-zinc-900/40">
      {/* Top sticky action header */}
      <div className="sticky top-0 z-20 flex items-center justify-between p-3 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <button
            data-testid="workflow-detail-back-btn"
            onClick={() => navigate('/resources')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate font-mono text-zinc-200">
              {workflow.metadata.name}
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              {workflow.metadata.namespace}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/20 text-indigo-400 border border-indigo-900/40">
            <Layers className="w-3 h-3" />
            WORKFLOW
          </span>

          {workflow && (
            <button
              onClick={() => toggleFavorite('Workflow', workflow.metadata.namespace, workflow.metadata.name)}
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

          <div className="relative">
            <button
              data-testid="workflow-actions-menu"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors bg-zinc-900 border border-zinc-800"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800/95 rounded-2xl shadow-2xl py-2 z-30 font-sans">
                <button
                  onClick={() =>
                    handleAction(() => {
                      const templateName = workflow.spec?.workflowTemplateRef?.name;
                      if (templateName) {
                        const keyvals: Record<string, string> = {};
                        workflowParams.forEach((p) => {
                          keyvals[p.name] = p.value || '';
                        });
                        onResubmit(namespace!, templateName, keyvals);
                      } else {
                        alert('This workflow does not reference an external template; resubmission from source is required.');
                      }
                    })
                  }
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900/60 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Resubmit (New Copy)</span>
                </button>

                <button
                  onClick={() =>
                    handleAction(() => {
                      if (confirm(`Delete workflow ${workflow.metadata.name}? This is irreversible.`)) {
                        onDelete(namespace!, name!);
                        navigate('/resources');
                      }
                    })
                  }
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-950/20 flex items-center gap-2 border-t border-zinc-800/60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete workflow</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* State banner */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3 font-mono text-xs shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PhaseBadge phase={phase} size="lg" />
              {isSuspended && (
                <span className="text-[10px] bg-amber-950/20 text-amber-500 px-2.5 py-1 rounded-lg border border-amber-900/30 font-bold uppercase">
                  SUSPENDED
                </span>
              )}
            </div>
            <div className="flex flex-col text-right text-[11px]">
              <span className="text-zinc-500 font-bold">DURATION</span>
              <span className="text-zinc-200 font-bold mt-0.5">{getDuration(workflow.status?.startedAt, workflow.status?.finishedAt)}</span>
            </div>
          </div>

          {workflow.status?.message && (
            <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl p-3 text-rose-300 font-mono text-[11px] leading-relaxed flex items-start justify-between gap-2 select-text">
              <div className="space-y-1 min-w-0">
                <span className="block text-rose-500 uppercase font-black text-[9px] tracking-wide">STATUS MESSAGE</span>
                <p className="break-all whitespace-pre-wrap">{workflow.status.message}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(workflow.status!.message!);
                  addToast('Copied status message to clipboard', 'success');
                }}
                className="shrink-0 p-1.5 bg-rose-900/40 hover:bg-rose-900/70 text-rose-200 rounded-lg transition-colors border border-rose-800/40"
                title="Copy message to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Controls island */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <div className="flex flex-wrap gap-2">
            {isRunning && (
              <button
                onClick={() => onSuspend(namespace!, name!)}
                className="flex-1 min-w-[120px] bg-amber-950/20 border border-amber-900/30 text-amber-400 hover:bg-amber-950/40 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Pause className="w-4 h-4" />
                <span>Suspend</span>
              </button>
            )}
            {isSuspended && (
              <button
                onClick={() => onResume(namespace!, name!)}
                className="flex-1 min-w-[120px] bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 hover:bg-emerald-950/40 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            )}
            {isRunning && (
              <button
                onClick={() => onStop(namespace!, name!)}
                className="flex-1 min-w-[120px] bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-950/40 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop</span>
              </button>
            )}
            {isRunning && (
              <button
                onClick={() => onTerminate(namespace!, name!)}
                className="flex-1 min-w-[120px] bg-rose-950/30 border border-rose-900/40 text-rose-500 hover:bg-rose-950/50 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <XCircle className="w-4 h-4" />
                <span>Terminate</span>
              </button>
            )}
            {!isRunning && !isSuspended && (
              <button
                onClick={() => onRetry(namespace!, name!)}
                className="flex-1 min-w-[120px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation bar */}
      <div className="flex border border-zinc-800/80 bg-zinc-900 p-1.5 rounded-2xl mx-4 mb-4 select-none shadow-sm">
        {(['SUMMARY', 'NODES', 'TIMELINE', 'LOGS'] as TabType[]).map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab.toLowerCase()}`}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-center py-2.5 text-[11px] font-mono font-bold rounded-xl transition-all duration-150 ${
              activeTab === tab
                ? 'bg-indigo-600 text-white font-extrabold shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Tab Contents */}
      <div className="flex-1 px-4 overflow-hidden">
        {/* SUMMARY TAB */}
        {activeTab === 'SUMMARY' && (
          <div className="space-y-5 pb-8">
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
                SUBMISSION PARAMETERS
              </h3>
              {workflowParams.length === 0 ? (
                <div className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center shadow-sm">
                  No parameters were specified for this execution.
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl divide-y divide-zinc-900 overflow-hidden shadow-md">
                  {workflowParams.map((p) => (
                    <div key={p.name} className="p-3.5 flex flex-col gap-1.5 text-xs">
                      <span className="font-mono text-[10px] font-bold text-zinc-400">
                        {p.name}
                      </span>
                      <code className="text-zinc-300 bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-800/80 break-all leading-relaxed font-mono text-[11px] select-text cursor-text">
                        {p.value || '""'}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
                NODE STATS (PODS: {podNodes.length})
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center shadow-sm">
                  <span className="text-emerald-500 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Succeeded</span>
                  <span className="font-bold text-zinc-300">{nodeStats.Succeeded}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center shadow-sm">
                  <span className="text-indigo-400 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Running</span>
                  <span className="font-bold text-zinc-300">{nodeStats.Running}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center shadow-sm">
                  <span className="text-amber-500 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pending</span>
                  <span className="font-bold text-zinc-300">{nodeStats.Pending}</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center shadow-sm">
                  <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Failed</span>
                  <span className="font-bold text-zinc-300">{nodeStats.Failed + nodeStats.Error}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
                METADATA DETAILS
              </h3>
                <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3.5 font-mono text-[11px] text-zinc-400 shadow-md select-text">
                <div className="flex justify-between gap-4">
                  <span>UID:</span>
                  <span className="text-zinc-200 truncate max-w-[200px] text-right font-semibold">{workflow.metadata.uid}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>RESOURCE VERSION:</span>
                  <span className="text-zinc-200 font-semibold">{workflow.metadata.resourceVersion}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>CREATED AT:</span>
                  <span className="text-zinc-200 font-semibold">
                    {new Date(workflow.metadata.creationTimestamp).toLocaleString()}
                  </span>
                </div>
                {workflow.spec?.workflowTemplateRef?.name && (
                  <div className="flex justify-between items-center gap-4 border-t border-zinc-900/60 pt-2.5">
                    <span>SOURCE TEMPLATE:</span>
                    <button
                      onClick={() => navigate(`/templates/${namespace}/${workflow.spec.workflowTemplateRef!.name}`)}
                      className="text-indigo-400 hover:text-indigo-300 font-bold underline flex items-center gap-1"
                    >
                      <span>{workflow.spec.workflowTemplateRef?.name}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NODES TAB */}
        {activeTab === 'NODES' && (
          <div className="space-y-3.5 pb-8">
            <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
              Execution Nodes Tree ({podNodes.length} Pods)
            </h3>

            {podNodes.length === 0 ? (
              <div className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center shadow-sm">
                Preparing scheduling tree... No nodes initialized.
              </div>
            ) : (
              <div className="space-y-3">
                {podNodes.map((node) => {
                  const isExpanded = !!expandedNodes[node.id];
                  return (
                    <div
                      key={node.id}
                      className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-sm"
                    >
                      <div
                        onClick={() => toggleExpandNode(node.id)}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-zinc-900/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PhaseBadge phase={node.phase} size="sm" />
                          <span className="text-xs font-mono font-bold text-zinc-200 truncate">
                            {node.displayName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {node.phase === 'Running' ? 'Ongoing' : 'Finished'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-zinc-900/80 bg-zinc-900/30 space-y-4 font-mono text-[11px] text-zinc-400 animate-fade-in select-text">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-zinc-500 uppercase text-[9px] font-black">TYPE:</span>
                              <span className="text-zinc-300 font-semibold">{node.type}</span>
                            </div>
                            <div>
                              <span className="block text-zinc-500 uppercase text-[9px] font-black">POD IP:</span>
                              <span className="text-zinc-300 font-semibold">{node.podIP || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-zinc-500 uppercase text-[9px] font-black">STARTED:</span>
                              <span className="text-zinc-300 font-semibold">
                                {node.startedAt ? new Date(node.startedAt).toLocaleTimeString() : 'Pending'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-zinc-500 uppercase text-[9px] font-black">FINISHED:</span>
                              <span className="text-zinc-300 font-semibold">
                                {node.finishedAt ? new Date(node.finishedAt).toLocaleTimeString() : 'Running...'}
                              </span>
                            </div>
                          </div>

                          {node.message && (
                            <div className="bg-rose-950/20 p-3 rounded-xl border border-rose-900/30 text-rose-400 leading-relaxed flex items-start justify-between gap-2 select-text">
                              <div className="space-y-1 min-w-0">
                                <span className="block text-rose-500 uppercase font-black text-[9px] tracking-wide">
                                  MESSAGE:
                                </span>
                                <p className="break-all whitespace-pre-wrap">{node.message}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(node.message!);
                                  addToast('Copied node message to clipboard', 'success');
                                }}
                                className="shrink-0 p-1.5 bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 rounded-lg transition-colors border border-rose-800/40"
                                title="Copy message to clipboard"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2 pt-3 border-t border-zinc-800/50">
                            <button
                              onClick={() => {
                                setSelectedPodId(node.id);
                                setActiveTab('LOGS');
                              }}
                              className="bg-indigo-600/10 border border-indigo-900/40 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-[10px] font-bold transition-all shadow-sm active:scale-95"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                              <span>View Pod Logs</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'TIMELINE' && (
          <div className="space-y-4 pb-8">
            <h3 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
              Sequential Execution Timeline
            </h3>

            {podNodes.length === 0 ? (
              <div className="text-xs text-zinc-500 italic bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-center shadow-sm">
                Timeline unavailable. Nodes not scheduled.
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 space-y-4.5 font-mono text-[11px] shadow-md">
                {podNodes.map((node) => {
                  const baseStart = workflow.status?.startedAt ? new Date(workflow.status.startedAt).getTime() : Date.now();
                  const nodeStart = node.startedAt ? new Date(node.startedAt).getTime() : baseStart;
                  const startSecs = Math.max(0, Math.floor((nodeStart - baseStart) / 1000));
                  const endSecs = node.finishedAt
                    ? Math.floor((new Date(node.finishedAt).getTime() - baseStart) / 1000)
                    : Math.floor((Date.now() - baseStart) / 1000);
                  const duration = Math.max(endSecs - startSecs, 2);

                  const widthPercent = Math.min((duration / 120) * 100, 80);
                  const offsetPercent = Math.min((startSecs / 120) * 100, 70);

                  let colorClass = 'bg-indigo-600 border-indigo-400';
                  if (node.phase === 'Succeeded') {
                    colorClass = 'bg-emerald-600/85 border-emerald-400';
                  } else if (node.phase === 'Failed' || node.phase === 'Error') {
                    colorClass = 'bg-rose-600/85 border-rose-400';
                  } else if (node.phase === 'Pending') {
                    colorClass = 'bg-zinc-800 border-zinc-700';
                  }

                  return (
                    <div key={node.id} className="space-y-1.5 select-none">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="font-bold text-zinc-300">{node.displayName}</span>
                        <span className="text-zinc-500">{duration}s</span>
                      </div>
                      <div className="w-full bg-zinc-950 h-7 rounded-lg relative border border-zinc-800/80 overflow-hidden">
                        <div
                          style={{
                            width: `${widthPercent}%`,
                            left: `${offsetPercent}%`
                          }}
                          className={`absolute top-0 bottom-0 border-x rounded-sm transition-all duration-500 flex items-center pl-2 text-[8px] text-white font-black truncate shadow-inner ${colorClass}`}
                        >
                          {duration}s
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="border-t border-zinc-800/80 pt-3.5 flex justify-between text-[9px] text-zinc-600 uppercase tracking-wide font-black">
                  <span>0s</span>
                  <span>30s</span>
                  <span>60s</span>
                  <span>90s</span>
                  <span>120s+</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'LOGS' && (
          <div className="h-[480px] pb-8">
            <LogStream
              namespace={namespace!}
              workflowName={name!}
              activePodId={selectedPodId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
