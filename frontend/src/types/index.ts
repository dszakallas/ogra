import { components as WorkflowComponents } from './generated/Workflow';
import { components as WorkflowTemplateComponents } from './generated/WorkflowTemplate';
import { components as CronWorkflowComponents } from './generated/CronWorkflow';

export interface ObjectMeta {
  name: string;
  namespace: string;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export type Workflow = Omit<WorkflowComponents['schemas']['Workflow'], 'metadata'> & {
  metadata: ObjectMeta;
};
export type WorkflowTemplate = Omit<WorkflowTemplateComponents['schemas']['WorkflowTemplate'], 'metadata'> & {
  metadata: ObjectMeta;
};
export type CronWorkflow = Omit<CronWorkflowComponents['schemas']['CronWorkflow'], 'metadata'> & {
  metadata: ObjectMeta;
};

export type WorkflowPhase = string;
export type NodePhase = string;
export type NodeType = string;

export type Parameter = NonNullable<
  NonNullable<NonNullable<Workflow['spec']>['arguments']>['parameters']
>[number];

export type NodeStatus = NonNullable<
  NonNullable<NonNullable<Workflow['status']>['nodes']>[string]
>;

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
