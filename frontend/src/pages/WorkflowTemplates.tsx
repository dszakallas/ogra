import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, BookOpen, AlertCircle, X, Check } from 'lucide-react';
import { WorkflowTemplate } from '../types';
import { ParameterInput } from '../components/ParameterInput';

interface WorkflowTemplatesProps {
  templates: WorkflowTemplate[];
  selectedNamespace: string;
  search: string;
  onSubmitWorkflow: (namespace: string, templateName: string, params: Record<string, string>) => void;
  submitInitialParams?: { templateName: string; params: Record<string, string> } | null;
  clearSubmitInitialParams?: () => void;
}

export function WorkflowTemplates({
  templates,
  selectedNamespace,
  search,
  onSubmitWorkflow,
  submitInitialParams,
  clearSubmitInitialParams
}: WorkflowTemplatesProps) {
  const navigate = useNavigate();

  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null);
  const [formParams, setFormParams] = useState<Record<string, string>>({});

  // If initial trigger from resubmit prop is active, open form automatically
  React.useEffect(() => {
    if (submitInitialParams) {
      const matched = templates.find((t) => t.metadata.name === submitInitialParams.templateName);
      if (matched) {
        setActiveTemplate(matched);
        setFormParams(submitInitialParams.params);
      }
      if (clearSubmitInitialParams) clearSubmitInitialParams();
    }
  }, [submitInitialParams, templates, clearSubmitInitialParams]);

  // Filter templates
  const filteredTemplates = templates.filter((tmpl) => {
    const matchesNamespace = selectedNamespace === 'all' || tmpl.metadata.namespace === selectedNamespace;
    const description = tmpl.metadata.annotations?.['workflows.argoproj.io/description'] || '';
    const matchesSearch = tmpl.metadata.name.toLowerCase().includes(search.toLowerCase()) ||
                          description.toLowerCase().includes(search.toLowerCase());
    return matchesNamespace && matchesSearch;
  });

  const handleOpenSubmitForm = (tmpl: WorkflowTemplate) => {
    setActiveTemplate(tmpl);
    const defaults: Record<string, string> = {};
    const paramsList = tmpl.spec.arguments?.parameters || [];
    paramsList.forEach((p) => {
      defaults[p.name] = p.value || p.default || '';
    });
    setFormParams(defaults);
  };

  const handleCloseSubmitForm = () => {
    setActiveTemplate(null);
    setFormParams({});
  };

  const handleParamChange = (name: string, value: string) => {
    setFormParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    // Validate required fields
    const paramsList = activeTemplate.spec.arguments?.parameters || [];
    const missingFields = paramsList.filter((p) => {
      const val = formParams[p.name];
      const hasDefault = !!p.default;
      const isModeRun = formParams['mode'] === 'run';
      const isModeResume = formParams['mode'] === 'resume';

      // Conditional validation logic
      if (p.name === 'source' && isModeRun && !val && !hasDefault) return true;
      if (p.name === 'notebook-id' && isModeResume && !val && !hasDefault) return true;
      return false;
    });

    if (missingFields.length > 0) {
      alert(`Missing required fields: ${missingFields.map((f) => f.name).join(', ')}`);
      return;
    }

    try {
      // Trigger submission
      const result: any = await onSubmitWorkflow(
        activeTemplate.metadata.namespace,
        activeTemplate.metadata.name,
        formParams
      );

      // Close form
      handleCloseSubmitForm();

      if (result && result.metadata) {
        navigate(`/workflows/${result.metadata.namespace}/${result.metadata.name}`);
      }
    } catch {
      // Errors handled by Toast in Context
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full px-4 pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-display flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Workflow Templates
        </h1>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {filteredTemplates.length === 0 ? (
          <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 shadow-inner">
            <AlertCircle className="w-9 h-9 text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-300 font-display">No templates found</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              No argo templates defined in namespace "{selectedNamespace}".
            </p>
          </div>
        ) : (
          filteredTemplates.map((tmpl) => {
            const description = tmpl.metadata.annotations?.['workflows.argoproj.io/description'] || 'No description supplied.';
            const paramsCount = tmpl.spec.arguments?.parameters?.length || 0;
            const stepsCount = tmpl.spec.templates?.length || 0;

            return (
              <div
                key={tmpl.metadata.uid}
                className="bg-[#121212] border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3.5 shadow-sm hover:border-zinc-700/80 transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <span className="text-[9px] text-zinc-500 font-mono block uppercase font-black tracking-widest">
                      {tmpl.metadata.namespace}
                    </span>
                    <h2 className="text-sm font-bold text-zinc-200 truncate font-mono tracking-tight">
                      {tmpl.metadata.name}
                    </h2>
                  </div>
                  <button
                    data-testid="trigger-template-btn"
                    onClick={() => handleOpenSubmitForm(tmpl)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.2)] transition-all active:scale-95 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Trigger</span>
                  </button>
                </div>

                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  {description}
                </p>

                <div className="flex gap-4 border-t border-zinc-800/60 pt-3 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                  <span>PARAMETERS: <b className="text-zinc-300">{paramsCount}</b></span>
                  <span>TEMPLATES: <b className="text-zinc-300">{stepsCount}</b></span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Slide-up form dialog */}
      {activeTemplate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#121212] border border-zinc-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl mb-12">
            {/* Form Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
              <div className="min-w-0">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase font-black tracking-widest">
                  SUBMIT WORKFLOW
                </span>
                <h3 className="text-sm font-bold text-zinc-200 font-mono truncate">
                  {activeTemplate.metadata.name}
                </h3>
              </div>
              <button
                onClick={handleCloseSubmitForm}
                className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable parameters inputs */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-mono font-black tracking-widest text-zinc-500 uppercase">
                  Dynamic Template Parameters
                </h4>
                {activeTemplate.spec.arguments?.parameters?.map((p) => (
                  <ParameterInput
                    key={p.name}
                    parameter={p}
                    value={formParams[p.name] || ''}
                    onChange={(val) => handleParamChange(p.name, val)}
                  />
                ))}
              </div>

              {/* Submit triggers bar */}
              <div className="pt-4 border-t border-zinc-800/80 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseSubmitForm}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="launch-workflow-btn"
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(99,102,241,0.2)] active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Launch Workflow</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
