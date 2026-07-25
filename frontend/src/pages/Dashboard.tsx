import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Play, BookOpen, Calendar } from 'lucide-react';
import { useCluster } from '../context/ClusterContext';

export function Dashboard() {
  const navigate = useNavigate();
  const { workflows, templates, cronWorkflows, sseConnected, serverInfo } = useCluster();

  const running = workflows.filter((w) => w.status?.phase === 'Running' && !w.spec?.suspend).length;
  const succeeded = workflows.filter((w) => w.status?.phase === 'Succeeded').length;
  const failed = workflows.filter((w) => w.status?.phase === 'Failed').length;
  const pending = workflows.filter((w) => w.status?.phase === 'Pending' || (!w.status?.phase)).length;

  const activeCrons = cronWorkflows.filter((c) => !c.spec?.suspend).length;
  const suspendedCrons = cronWorkflows.filter((c) => c.spec?.suspend).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full px-4 pb-20">
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-display flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          Dashboard
        </h1>
      </div>

      <div className={`border rounded-2xl p-4 ${sseConnected ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-amber-950/10 border-amber-900/30'}`}>
        <div className="flex items-center gap-3">
          <span className={`inline-block w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <h2 className={`text-sm font-bold ${sseConnected ? 'text-emerald-300' : 'text-amber-300'}`}>
              {sseConnected ? 'All Systems Operational' : 'Watch Stream Disconnected'}
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono">
              {workflows.length} workflows · {templates.length} templates · {cronWorkflows.length} cron schedules
            </p>
          </div>
        </div>
        {serverInfo?.managedNamespaces && (
          <div className="mt-2 pt-2 border-t border-zinc-800/40 text-[10px] text-zinc-500 font-mono">
            NAMESPACES: {serverInfo.managedNamespaces.join(', ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <KindCard
          icon={<Play className="w-5 h-5 text-indigo-400" />}
          title="Workflows"
          count={workflows.length}
          stats={[
            { label: 'Running', value: running, color: 'text-indigo-400' },
            { label: 'Succeeded', value: succeeded, color: 'text-emerald-400' },
            { label: 'Failed', value: failed, color: 'text-rose-400' },
            { label: 'Pending', value: pending, color: 'text-amber-400' }
          ]}
          onClick={() => navigate('/resources?kind=Workflow')}
        />

        <KindCard
          icon={<BookOpen className="w-5 h-5 text-cyan-400" />}
          title="Workflow Templates"
          count={templates.length}
          stats={[]}
          onClick={() => navigate('/resources?kind=WorkflowTemplate')}
        />

        <KindCard
          icon={<Calendar className="w-5 h-5 text-amber-400" />}
          title="Cron Workflows"
          count={cronWorkflows.length}
          stats={[
            { label: 'Active', value: activeCrons, color: 'text-emerald-400' },
            { label: 'Suspended', value: suspendedCrons, color: 'text-rose-400' }
          ]}
          onClick={() => navigate('/resources?kind=CronWorkflow')}
        />
      </div>
    </div>
  );
}

interface KindCardProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  stats: { label: string; value: number; color: string }[];
  onClick: () => void;
}

function KindCard({ icon, title, count, stats, onClick }: KindCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-5 text-left transition-all group shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-sm font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">{title}</h3>
        </div>
        <span className="text-2xl font-bold text-zinc-100 font-mono">{count}</span>
      </div>

      {stats.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {stats.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-[11px] font-mono">
              <span className={s.color}>{s.value}</span>
              <span className="text-zinc-500">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
