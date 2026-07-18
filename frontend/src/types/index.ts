import { components as WorkflowComponents } from './generated/Workflow';
import { components as WorkflowTemplateComponents } from './generated/WorkflowTemplate';
import { components as CronWorkflowComponents } from './generated/CronWorkflow';

export type Workflow = WorkflowComponents['schemas']['Workflow'];
export type WorkflowTemplate = WorkflowTemplateComponents['schemas']['WorkflowTemplate'];
export type CronWorkflow = CronWorkflowComponents['schemas']['CronWorkflow'];

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
