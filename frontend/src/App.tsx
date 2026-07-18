import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Layers, BookOpen, Calendar, RefreshCw, Search } from 'lucide-react';
import { ClusterProvider, useCluster } from './context/ClusterContext';

// Page Imports
import { WorkflowsList } from './pages/WorkflowsList';
import { WorkflowDetail } from './pages/WorkflowDetail';
import { WorkflowTemplates } from './pages/WorkflowTemplates';
import { CronWorkflows } from './pages/CronWorkflows';
import { CronWorkflowDetail } from './pages/CronWorkflowDetail';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    workflows,
    templates,
    cronWorkflows,
    selectedNamespace,
    setSelectedNamespace,
    namespaces,
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

  // Filter search/phase states for retaining during navigation
  const [searchWorkflows, setSearchWorkflows] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('ALL');
  const [searchTemplates, setSearchTemplates] = useState('');
  const [searchCron, setSearchCron] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Bridge state for resubmit workflow params
  const [resubmitParams, setResubmitParams] = useState<{ templateName: string; params: Record<string, string> } | null>(null);

  const handleResubmitBridge = (ns: string, templateName: string, params: Record<string, string>) => {
    setSelectedNamespace(ns);
    setResubmitParams({ templateName, params });
    navigate('/templates');
  };

  const currentPath = location.pathname;
  const isListPage = currentPath === '/' || currentPath === '/templates' || currentPath === '/cron';

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Universal App Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/85 border-b border-zinc-800/80 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-widest font-display text-zinc-100 lowercase leading-none">
              ogra
            </h1>
          </div>
        </div>

        {/* Liveness Indicator & Header Buttons */}
        <div className="flex items-center gap-2">
          {/* Watch Stream SSE Status bubble */}
          <span className="flex items-center gap-1 bg-[#121212] border border-zinc-800/80 px-2 py-1.5 rounded-lg text-[9px] font-mono text-zinc-400 mr-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>WATCH</span>
          </span>

          {/* Search Toggle Button */}
          {isListPage && (
            <button
              data-testid="toggle-filters-btn"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl border transition-all ${
                showFilters
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                  : 'bg-[#121212] border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Toggle search filters"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Universal Refresh Button */}
          <button
            data-testid="refresh-btn"
            onClick={fetchData}
            className="p-2 bg-[#121212] border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all flex items-center justify-center"
            title="Refresh current data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Dynamic Slide-down Filter/Search Widget */}
      {showFilters && isListPage && (
        <div className="bg-[#121212] border-b border-zinc-800 px-4 py-4 space-y-4 shadow-xl z-25 relative">
          <div className="max-w-2xl mx-auto w-full space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Namespace selector is common across all lists */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Active Namespace</label>
                <select
                  data-testid="namespace-select"
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer transition-colors"
                >
                  <option value="all">All Namespaces</option>
                  {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource-specific name search input */}
              {currentPath === '/' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Search Runs</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search runs by name..."
                      value={searchWorkflows}
                      onChange={(e) => setSearchWorkflows(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-500 transition-colors font-sans"
                    />
                  </div>
                </div>
              )}

              {currentPath === '/templates' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Search Templates</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search templates by name..."
                      value={searchTemplates}
                      onChange={(e) => setSearchTemplates(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-500 transition-colors font-sans"
                    />
                  </div>
                </div>
              )}

              {currentPath === '/cron' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Search Cron Workflows</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search cron schedules..."
                      value={searchCron}
                      onChange={(e) => setSearchCron(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-500 transition-colors font-sans"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Phase Chips for Runs view inside the dropdown */}
            {currentPath === '/' && (
              <div className="flex flex-col gap-2 border-t border-zinc-800/60 pt-3">
                <label className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest">Filter by Phase</label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {['ALL', 'RUNNING', 'PENDING', 'SUCCEEDED', 'FAILED'].map((phaseVal) => {
                    const isActive = selectedPhase === phaseVal;
                    return (
                      <button
                        key={phaseVal}
                        onClick={() => setSelectedPhase(phaseVal)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-xl border text-[11px] font-mono transition-all active:scale-95 ${
                          isActive
                            ? 'bg-zinc-100 border-zinc-100 text-[#0A0A0A] font-bold shadow-sm'
                            : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {phaseVal}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Pages Content container */}
      <main className="flex-1 pb-24">
        {loading ? (
          <div className="max-w-md mx-auto my-24 text-center space-y-3 font-mono text-xs">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
            <span className="text-zinc-500 block uppercase font-bold tracking-wider">Synchronizing clusters...</span>
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <WorkflowsList
                  workflows={workflows}
                  selectedNamespace={selectedNamespace}
                  search={searchWorkflows}
                  setSearch={setSearchWorkflows}
                  selectedPhase={selectedPhase}
                  setSelectedPhase={setSelectedPhase}
                  onRefresh={fetchData}
                  onDelete={handleDeleteWorkflow}
                />
              }
            />
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
              path="/templates"
              element={
                <WorkflowTemplates
                  templates={templates}
                  selectedNamespace={selectedNamespace}
                  search={searchTemplates}
                  onSubmitWorkflow={handleWorkflowSubmit}
                  submitInitialParams={resubmitParams}
                  clearSubmitInitialParams={() => setResubmitParams(null)}
                />
              }
            />
            <Route
              path="/cron"
              element={
                <CronWorkflows
                  cronWorkflows={cronWorkflows}
                  selectedNamespace={selectedNamespace}
                  search={searchCron}
                  onTrigger={handleCronTrigger}
                  onSuspendToggle={handleCronSuspendToggle}
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

      {/* Persistent Sticky Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#121212]/95 border-t border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <nav className="max-w-md mx-auto py-3 px-6 flex items-center justify-around select-none">
          <NavLink
            data-testid="nav-runs"
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-center transition-all ${
                isActive || currentPath.startsWith('/workflows') 
                  ? 'text-indigo-400 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase">Runs</span>
          </NavLink>

          <NavLink
            data-testid="nav-templates"
            to="/templates"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-center transition-all ${
                isActive 
                  ? 'text-indigo-400 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase">Templates</span>
          </NavLink>

          <NavLink
            data-testid="nav-cron"
            to="/cron"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-center transition-all ${
                isActive || currentPath.startsWith('/cron/') 
                  ? 'text-indigo-400 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase">Cron</span>
          </NavLink>
        </nav>
      </div>
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
