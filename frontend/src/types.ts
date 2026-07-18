export type WorkflowPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Error';
export type NodePhase = '' | 'Pending' | 'Running' | 'Succeeded' | 'Skipped' | 'Failed' | 'Error' | 'Omitted';
export type NodeType = 'Pod' | 'Container' | 'Steps' | 'StepGroup' | 'DAG' | 'Retry' | 'Skipped' | 'TaskGroup' | 'Suspend';

export interface Parameter {
  name: string;
  value?: string;
  default?: string;
  description?: string;
  enum?: string[];
}

export interface NodeStatus {
  id: string;
  name: string;
  displayName: string;
  type: NodeType;
  phase: NodePhase;
  startedAt: string;
  finishedAt?: string;
  templateName?: string;
  inputs?: { parameters?: Parameter[] };
  outputs?: { parameters?: Parameter[] };
  children: string[];
  boundaryID: string;
  message?: string;
  progress?: string;
  podIP?: string;
}

export interface Workflow {
  apiVersion: string;
  kind: "Workflow";
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    entrypoint?: string;
    arguments?: { parameters?: Parameter[] };
    workflowTemplateRef?: { name: string };
    templates?: any[];
    suspend?: boolean;
  };
  status: {
    phase: WorkflowPhase;
    startedAt: string;
    finishedAt?: string;
    progress?: string; // "N/M"
    message?: string;
    estimatedDuration?: number;
    nodes: Record<string, NodeStatus>;
    conditions?: Array<{ type: string; status: string; message?: string }>;
  };
}

export interface WorkflowTemplate {
  apiVersion: string;
  kind: "WorkflowTemplate";
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    creationTimestamp: string;
    annotations?: Record<string, string>;
  };
  spec: {
    entrypoint: string;
    arguments?: { parameters?: Parameter[] };
    templates: any[];
  };
}

export interface CronWorkflow {
  apiVersion: string;
  kind: "CronWorkflow";
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    creationTimestamp: string;
  };
  spec: {
    schedule?: string;
    schedules?: string[];
    timezone?: string;
    suspend?: boolean;
    workflowSpec: {
      workflowTemplateRef?: { name: string };
      arguments?: { parameters?: Parameter[] };
    };
  };
  status?: {
    lastScheduledTime?: string;
    active?: Array<{ name: string; namespace: string }>;
    succeeded?: number;
    failed?: number;
  };
}

export interface ServerInfo {
  managedNamespaces: string[];
  links: Array<{ name: string; url: string; scope: string }>;
}

export interface UserInfo {
  loggedIn: boolean;
  username: string;
  email: string;
  serviceAccountName: string;
  roles: string[];
}
