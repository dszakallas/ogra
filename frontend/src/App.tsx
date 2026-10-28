import React, { useState, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Layers, LayoutDashboard, RefreshCw, Search } from 'lucide-react';
import { ClusterProvider, useCluster } from './context/ClusterContext';

import { Dashboard } from './pages/Dashboard';
import { ResourcesView } from './pages/ResourcesView';
import { WorkflowDetail } from './pages/WorkflowDetail';
import { CronWorkflowDetail } from './pages/CronWorkflowDetail';
import { WorkflowTemplateDetail } from './pages/WorkflowTemplateDetail';
import { ClusterWorkflowTemplateDetail } from './pages/ClusterWorkflowTemplateDetail';
import { SearchOverlay } from './components/SearchOverlay';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    workflows,
    templates,
    clusterTemplates,
    cronWorkflows,
    setSelectedNamespace,
    loading,
    sseConnected,
    fetchData,
    handleWorkflowSubmit,
    handleSuspendWorkflow,
    handleResumeWorkflow,
    handleStopWorkflow,
    handleTerminateWorkflow,
    handleRetryWorkflow,
    handleDeleteWorkflow,
    handleCronTrigger,
    handleCronSuspendToggle
  } = useCluster();

  const [searchOpen, setSearchOpen] = useState(false);

  const handleResubmitBridge = (ns: string, templateName: string, ...rest: unknown[]) => {
    const isCluster = rest[1] as boolean | undefined;
    if (isCluster) {
      navigate(`/cluster-templates/${templateName}`);
    } else {
      setSelectedNamespace(ns);
      navigate(`/templates/${ns}/${templateName}`);
    }
  };

  const handleSearchKey = useCallback((e: KeyboardEvent) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener('keydown', handleSearchKey);
    return () => window.removeEventListener('keydown', handleSearchKey);
  }, [handleSearchKey]);

  const currentPath = location.pathname;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <header className="sticky top-0 z-30 bg-zinc-950/85 border-b border-zinc-800/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-2xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto w-full flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(255,105,180,0.3)]">
              <img src="/logo-dark.svg" alt="ogra" className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-widest font-display text-zinc-100 lowercase leading-none">
                ogra
              </h1>
            </div>
          </NavLink>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-zinc-900 border border-zinc-800/80 px-2 py-1.5 rounded-lg text-[9px] font-mono text-zinc-400 mr-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>WATCH</span>
            </span>

            <button
              data-testid="search-btn"
              onClick={() => setSearchOpen(true)}
              className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all flex items-center justify-center"
              title="Search (press /)"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              data-testid="refresh-btn"
              onClick={fetchData}
              className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all flex items-center justify-center"
              title="Refresh current data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {loading ? (
          <div className="max-w-md mx-auto my-24 text-center space-y-3 font-mono text-xs">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
            <span className="text-zinc-500 block uppercase font-bold tracking-wider">Synchronizing clusters...</span>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/resources" element={<ResourcesView />} />
            <Route
              path="/workflows/:namespace/:name"
              element={
                <WorkflowDetail
                  workflows={workflows}
                  onSuspend={handleSuspendWorkflow}
                  onResume={handleResumeWorkflow}
                  onStop={handleStopWorkflow}
                  onTerminate={handleTerminateWorkflow}
                  onRetry={handleRetryWorkflow}
                  onDelete={handleDeleteWorkflow}
                  onResubmit={handleResubmitBridge}
                />
              }
            />
            <Route
              path="/templates/:namespace/:name"
              element={
                <WorkflowTemplateDetail
                  templates={templates}
                  workflows={workflows}
                  onSubmitWorkflow={handleWorkflowSubmit}
                />
              }
            />
            <Route
              path="/cluster-templates/:name"
              element={
                <ClusterWorkflowTemplateDetail
                  clusterTemplates={clusterTemplates}
                  workflows={workflows}
                  onSubmitWorkflow={handleWorkflowSubmit}
                />
              }
            />
            <Route
              path="/cron/:namespace/:name"
              element={
                <CronWorkflowDetail
                  cronWorkflows={cronWorkflows}
                  workflows={workflows}
                  onTrigger={handleCronTrigger}
                  onSuspendToggle={handleCronSuspendToggle}
                />
              }
            />
          </Routes>
        )}
      </main>

      <div className="fixed bottom-0 sm:bottom-4 left-0 sm:left-1/2 sm:-translate-x-1/2 right-0 sm:right-auto z-30 bg-zinc-900/95 sm:border sm:rounded-2xl border-t sm:border-zinc-800 border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] sm:shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <nav className="max-w-md mx-auto py-3 sm:py-2 px-6 sm:px-8 flex items-center justify-around sm:gap-8 select-none">
          <NavLink
            data-testid="nav-dashboard"
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-center transition-all ${
                isActive
                  ? 'text-indigo-400 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase">Dashboard</span>
          </NavLink>

          <NavLink
            data-testid="nav-resources"
            to="/resources"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-center transition-all ${
                isActive || currentPath.startsWith('/workflows') || currentPath.startsWith('/templates') || currentPath.startsWith('/cluster-templates') || currentPath.startsWith('/cron')
                  ? 'text-indigo-400 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase">Resources</span>
          </NavLink>
        </nav>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ClusterProvider>
        <AppContent />
      </ClusterProvider>
    </Router>
  );
}
