import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Workflow, WorkflowTemplate, ClusterWorkflowTemplate, CronWorkflow, UserInfo, ServerInfo } from '../types';
import { apiFetch } from '../utils/api';
import { ToastContainer, ToastMessage } from '../components/Toast';

export interface ResourceEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  kind: 'Workflow' | 'WorkflowTemplate' | 'ClusterWorkflowTemplate' | 'CronWorkflow';
  name: string;
  namespace?: string;
  phase?: string;
  timestamp: string;
}

export type FavoriteKey = string;

function makeFavoriteKey(kind: string, namespace: string | undefined, name: string): FavoriteKey {
  return `${kind}/${namespace || '_'}/${name}`;
}

function loadFavorites(): Set<FavoriteKey> {
  try {
    const raw = localStorage.getItem('ogra-favorites');
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveFavorites(favs: Set<FavoriteKey>) {
  localStorage.setItem('ogra-favorites', JSON.stringify([...favs]));
}

export interface IdentifiableResource {
  metadata: {
    uid?: string;
    name: string;
    namespace?: string;
  };
}

function isSameResource<T extends IdentifiableResource>(a: T, b: T): boolean {
  if (a.metadata.uid && b.metadata.uid && a.metadata.uid === b.metadata.uid) {
    return true;
  }
  const aNs = a.metadata.namespace || '';
  const bNs = b.metadata.namespace || '';
  return aNs === bNs && a.metadata.name === b.metadata.name;
}

function upsertResource<T extends IdentifiableResource>(list: T[], newItem: T): T[] {
  const index = list.findIndex((item) => isSameResource(item, newItem));
  if (index !== -1) {
    const copy = [...list];
    copy[index] = newItem;
    return copy;
  }
  return [newItem, ...list];
}

function deduplicateResources<T extends IdentifiableResource>(items: T[]): T[] {
  const result: T[] = [];
  for (const item of items) {
    const index = result.findIndex((existing) => isSameResource(existing, item));
    if (index === -1) {
      result.push(item);
    } else {
      result[index] = item;
    }
  }
  return result;
}

interface ClusterContextType {
  workflows: Workflow[];
  templates: WorkflowTemplate[];
  clusterTemplates: ClusterWorkflowTemplate[];
  cronWorkflows: CronWorkflow[];
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
  namespaces: string[];
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;
  clusterWorkflowTemplatesEnabled: boolean;
  loading: boolean;
  sseConnected: boolean;
  fetchData: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'error' | 'success' | 'info', title?: string) => void;
  dismissToast: (id: string) => void;

  favorites: Set<FavoriteKey>;
  toggleFavorite: (kind: string, namespace: string | undefined, name: string) => void;
  isFavorite: (kind: string, namespace: string | undefined, name: string) => boolean;

  eventHistory: ResourceEvent[];

  // Actions
  handleWorkflowSubmit: (namespace: string, templateName: string, params: Record<string, string>, isClusterScope?: boolean) => Promise<Workflow>;
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
  const [clusterTemplates, setClusterTemplates] = useState<ClusterWorkflowTemplate[]>([]);
  const [cronWorkflows, setCronWorkflows] = useState<CronWorkflow[]>([]);
  
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [cwtAccessible, setCwtAccessible] = useState(true);

  const [sseConnected, setSseConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [favorites, setFavorites] = useState<Set<FavoriteKey>>(loadFavorites);
  const [eventHistory, setEventHistory] = useState<ResourceEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const addToast = (message: string, type: 'error' | 'success' | 'info' = 'error', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleFavorite = useCallback((kind: string, namespace: string | undefined, name: string) => {
    setFavorites((prev) => {
      const key = makeFavoriteKey(kind, namespace, name);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((kind: string, namespace: string | undefined, name: string) => {
    return favorites.has(makeFavoriteKey(kind, namespace, name));
  }, [favorites]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let cwtFailed = false;
      const [wfData, tmplData, cwtData, cronData, userData, infoData] = await Promise.all([
        apiFetch<{ items: Workflow[] }>('/api/v1/workflows/all'),
        apiFetch<{ items: WorkflowTemplate[] }>('/api/v1/workflow-templates/_'),
        apiFetch<{ items: ClusterWorkflowTemplate[] }>('/api/v1/cluster-workflow-templates').catch(() => {
          cwtFailed = true;
          return { items: [] };
        }),
        apiFetch<{ items: CronWorkflow[] }>('/api/v1/cron-workflows/_'),
        apiFetch<UserInfo>('/api/v1/userinfo'),
        apiFetch<ServerInfo>('/api/v1/info')
      ]);

      setCwtAccessible(!cwtFailed);
      setWorkflows(deduplicateResources(wfData.items || []));
      setTemplates(deduplicateResources(tmplData.items || []));
      setClusterTemplates(deduplicateResources(cwtData.items || []));
      setCronWorkflows(deduplicateResources(cronData.items || []));
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

    const url = '/api/v1/events/_';
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, kind: rawKind, object } = data;
        
        if (!object) return;

        const kind: 'Workflow' | 'WorkflowTemplate' | 'ClusterWorkflowTemplate' | 'CronWorkflow' =
          (rawKind || object.kind || 'Workflow') as any;

        setEventHistory((prev) => [{
          type,
          kind,
          name: object.metadata?.name || '',
          namespace: object.metadata?.namespace || '',
          phase: object.status?.phase || object.status?.conditions?.[0]?.type,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 200));

        if (kind === 'Workflow') {
          setWorkflows((prev) => {
            if (type === 'ADDED' || type === 'MODIFIED') {
              return upsertResource(prev, object);
            } else if (type === 'DELETED') {
              return prev.filter((w) => !isSameResource(w, object));
            }
            return prev;
          });
        } else if (kind === 'WorkflowTemplate') {
          setTemplates((prev) => {
            if (type === 'ADDED' || type === 'MODIFIED') {
              return upsertResource(prev, object);
            } else if (type === 'DELETED') {
              return prev.filter((t) => !isSameResource(t, object));
            }
            return prev;
          });
        } else if (kind === 'ClusterWorkflowTemplate') {
          setClusterTemplates((prev) => {
            if (type === 'ADDED' || type === 'MODIFIED') {
              return upsertResource(prev, object);
            } else if (type === 'DELETED') {
              return prev.filter((t) => !isSameResource(t, object));
            }
            return prev;
          });
        } else if (kind === 'CronWorkflow') {
          setCronWorkflows((prev) => {
            if (type === 'ADDED' || type === 'MODIFIED') {
              return upsertResource(prev, object);
            } else if (type === 'DELETED') {
              return prev.filter((c) => !isSameResource(c, object));
            }
            return prev;
          });
        }
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
  const handleWorkflowSubmit = async (
    namespace: string,
    templateName: string,
    params: Record<string, string>,
    isClusterScope?: boolean
  ) => {
    try {
      const kvList = Object.entries(params).map(([k, v]) => `${k}=${v}`);
      const payload = {
        resourceKind: isClusterScope ? 'ClusterWorkflowTemplate' : 'WorkflowTemplate',
        resourceName: templateName,
        submitOptions: { parameters: kvList }
      };

      const result = await apiFetch<Workflow>(`/api/v1/workflows/${namespace}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setWorkflows((prev) => upsertResource(prev, result));
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
      setWorkflows((prev) => prev.map((w) => (isSameResource(w, updated) ? updated : w)));
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
      setWorkflows((prev) => prev.filter((w) => !((w.metadata.namespace || '') === namespace && w.metadata.name === name)));
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
      setWorkflows((prev) => upsertResource(prev, triggered));
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
      setCronWorkflows((prev) => prev.map((cw) => (isSameResource(cw, updated) ? updated : cw)));
      addToast(`Cron schedule ${name} ${isCurrentlySuspended ? 'resumed' : 'suspended'}`, 'info');
    } catch (err: any) {
      addToast(err.message || `Failed to ${action} cron workflow`, 'error');
    }
  };

  const clusterWorkflowTemplatesEnabled = (serverInfo?.clusterWorkflowTemplates !== false) && cwtAccessible;

  return (
    <ClusterContext.Provider
      value={{
        workflows,
        templates,
        clusterTemplates,
        cronWorkflows,
        selectedNamespace,
        setSelectedNamespace,
        namespaces,
        userInfo,
        serverInfo,
        clusterWorkflowTemplatesEnabled,
        loading,
        sseConnected,
        fetchData,
        toasts,
        addToast,
        dismissToast,
        favorites,
        toggleFavorite,
        isFavorite,
        eventHistory,
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
