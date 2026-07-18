import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Workflow, WorkflowTemplate, CronWorkflow, UserInfo, ServerInfo } from '../types';
import { apiFetch, ApiError } from '../utils/api';
import { ToastContainer, ToastMessage } from '../components/Toast';

interface ClusterContextType {
  workflows: Workflow[];
  templates: WorkflowTemplate[];
  cronWorkflows: CronWorkflow[];
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
  namespaces: string[];
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;
  loading: boolean;
  sseConnected: boolean;
  fetchData: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'error' | 'success' | 'info', title?: string) => void;
  dismissToast: (id: string) => void;

  // Actions
  handleWorkflowSubmit: (namespace: string, templateName: string, params: Record<string, string>) => Promise<Workflow>;
  handleSuspendWorkflow: (namespace: string, name: string) => Promise<void>;
  handleResumeWorkflow: (namespace: string, name: string) => Promise<void>;
  handleStopWorkflow: (namespace: string, name: string) => Promise<void>;
  handleTerminateWorkflow: (namespace: string, name: string) => Promise<void>;
  handleRetryWorkflow: (namespace: string, name: string) => Promise<void>;
  handleDeleteWorkflow: (namespace: string, name: string) => Promise<void>;
  handleCronTrigger: (namespace: string, name: string) => Promise<Workflow>;
  handleCronSuspendToggle: (namespace: string, name: string, isCurrentlySuspended: boolean) => Promise<void>;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [cronWorkflows, setCronWorkflows] = useState<CronWorkflow[]>([]);
  
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  const [sseConnected, setSseConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const addToast = (message: string, type: 'error' | 'success' | 'info' = 'error', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wfData, tmplData, cronData, userData, infoData] = await Promise.all([
        apiFetch<{ items: Workflow[] }>('/api/v1/workflows/all'),
        apiFetch<{ items: WorkflowTemplate[] }>('/api/v1/workflow-templates/_'),
        apiFetch<{ items: CronWorkflow[] }>('/api/v1/cron-workflows/_'),
        apiFetch<UserInfo>('/api/v1/userinfo'),
        apiFetch<ServerInfo>('/api/v1/info')
      ]);

      setWorkflows(wfData.items || []);
      setTemplates(tmplData.items || []);
      setCronWorkflows(cronData.items || []);
      setUserInfo(userData);
      setServerInfo(infoData);
      
      if (infoData?.managedNamespaces) {
        setNamespaces(infoData.managedNamespaces);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to fetch cluster resources', 'error', 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const url = '/api/v1/workflow-events/_';
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, object } = data;
        
        if (!object) return;

        setWorkflows((prev) => {
          const index = prev.findIndex((w) => w.metadata.uid === object.metadata.uid);
          
          if (type === 'ADDED') {
            if (index === -1) return [object, ...prev];
            return prev;
          } else if (type === 'MODIFIED') {
            if (index !== -1) {
              const copy = [...prev];
              copy[index] = object;
              return copy;
            }
            return [object, ...prev];
          } else if (type === 'DELETED') {
            return prev.filter((w) => w.metadata.uid !== object.metadata.uid);
          }
          return prev;
        });
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Action implementations with clean Toast error reporting
  const handleWorkflowSubmit = async (namespace: string, templateName: string, params: Record<string, string>) => {
    try {
      const kvList = Object.entries(params).map(([k, v]) => `${k}=${v}`);
      const payload = {
        resourceKind: 'WorkflowTemplate',
        resourceName: templateName,
        submitOptions: { parameters: kvList }
      };

      const result = await apiFetch<Workflow>(`/api/v1/workflows/${namespace}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setWorkflows((prev) => [result, ...prev]);
      addToast(`Workflow ${result.metadata.name} launched successfully`, 'success');
      return result;
    } catch (err: any) {
      addToast(err.message || 'Failed to submit workflow', 'error', 'Submission Error');
      throw err;
    }
  };

  const handlePatchAction = async (namespace: string, name: string, action: string, successMsg: string) => {
    try {
      const updated = await apiFetch<Workflow>(`/api/v1/workflows/${namespace}/${name}/${action}`, {
        method: 'PUT'
      });
      setWorkflows((prev) => prev.map((w) => (w.metadata.uid === updated.metadata.uid ? updated : w)));
      addToast(successMsg, 'success');
    } catch (err: any) {
      addToast(err.message || `Failed to ${action} workflow`, 'error');
    }
  };

  const handleSuspendWorkflow = (ns: string, name: string) =>
    handlePatchAction(ns, name, 'suspend', `Workflow ${name} suspended`);

  const handleResumeWorkflow = (ns: string, name: string) =>
    handlePatchAction(ns, name, 'resume', `Workflow ${name} resumed`);

  const handleStopWorkflow = (ns: string, name: string) =>
    handlePatchAction(ns, name, 'stop', `Workflow ${name} stopped`);

  const handleTerminateWorkflow = (ns: string, name: string) =>
    handlePatchAction(ns, name, 'terminate', `Workflow ${name} terminated`);

  const handleRetryWorkflow = (ns: string, name: string) =>
    handlePatchAction(ns, name, 'retry', `Workflow ${name} retried`);

  const handleDeleteWorkflow = async (namespace: string, name: string) => {
    try {
      await apiFetch(`/api/v1/workflows/${namespace}/${name}`, { method: 'DELETE' });
      setWorkflows((prev) => prev.filter((w) => !(w.metadata.namespace === namespace && w.metadata.name === name)));
      addToast(`Workflow ${name} deleted`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to delete workflow', 'error');
    }
  };

  const handleCronTrigger = async (namespace: string, name: string) => {
    try {
      const triggered = await apiFetch<Workflow>(`/api/v1/cron-workflows/${namespace}/${name}/trigger`, {
        method: 'POST'
      });
      setWorkflows((prev) => [triggered, ...prev]);
      addToast(`Cron workflow ${name} manually triggered`, 'success');
      return triggered;
    } catch (err: any) {
      addToast(err.message || 'Failed to trigger cron workflow', 'error');
    }
  };

  const handleCronSuspendToggle = async (namespace: string, name: string, isCurrentlySuspended: boolean) => {
    const action = isCurrentlySuspended ? 'resume' : 'suspend';
    try {
      const updated = await apiFetch<CronWorkflow>(`/api/v1/cron-workflows/${namespace}/${name}/${action}`, {
        method: 'PUT'
      });
      setCronWorkflows((prev) => prev.map((cw) => (cw.metadata.uid === updated.metadata.uid ? updated : cw)));
      addToast(`Cron schedule ${name} ${isCurrentlySuspended ? 'resumed' : 'suspended'}`, 'info');
    } catch (err: any) {
      addToast(err.message || `Failed to ${action} cron workflow`, 'error');
    }
  };

  return (
    <ClusterContext.Provider
      value={{
        workflows,
        templates,
        cronWorkflows,
        selectedNamespace,
        setSelectedNamespace,
        namespaces,
        userInfo,
        serverInfo,
        loading,
        sseConnected,
        fetchData,
        toasts,
        addToast,
        dismissToast,
        handleWorkflowSubmit,
        handleSuspendWorkflow,
        handleResumeWorkflow,
        handleStopWorkflow,
        handleTerminateWorkflow,
        handleRetryWorkflow,
        handleDeleteWorkflow,
        handleCronTrigger,
        handleCronSuspendToggle
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error('useCluster must be used within a ClusterProvider');
  }
  return context;
}
