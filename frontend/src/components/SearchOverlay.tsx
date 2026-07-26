import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Layers, BookOpen, Calendar, XCircle, Star } from 'lucide-react';
import { useCluster } from '../context/ClusterContext';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

type SearchKind = 'Workflow' | 'WorkflowTemplate' | 'CronWorkflow';

interface SearchResult {
  kind: SearchKind;
  namespace: string;
  name: string;
  phase?: string;
}

interface RecentItem {
  kind: SearchKind;
  namespace: string;
  name: string;
}

interface Chip {
  type: 'ns' | 'kind';
  value: string;
}

const RECENT_KEY = 'ogra-search-recent';
const RECENT_MAX = 10;

const ALL_KINDS: SearchKind[] = ['Workflow', 'WorkflowTemplate', 'CronWorkflow'];

function getRoute(kind: SearchKind, namespace: string, name: string): string {
  switch (kind) {
    case 'Workflow': return `/workflows/${namespace}/${name}`;
    case 'WorkflowTemplate': return `/templates/${namespace}/${name}`;
    case 'CronWorkflow': return `/cron/${namespace}/${name}`;
  }
}

function getKindIcon(kind: SearchKind) {
  switch (kind) {
    case 'Workflow': return <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    case 'WorkflowTemplate': return <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case 'CronWorkflow': return <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
}

function getKindLabel(kind: SearchKind): string {
  switch (kind) {
    case 'Workflow': return 'Workflows';
    case 'WorkflowTemplate': return 'Templates';
    case 'CronWorkflow': return 'Cron';
  }
}

function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecent(items: RecentItem[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items));
}

function addRecent(kind: SearchKind, namespace: string, name: string) {
  const items = loadRecent().filter(
    (r) => !(r.kind === kind && r.namespace === namespace && r.name === name)
  );
  items.unshift({ kind, namespace, name });
  saveRecent(items.slice(0, RECENT_MAX));
}

type CompletionMode = 'ns' | 'kind' | null;

function parseCompletion(input: string): { mode: CompletionMode; prefix: string; searchPart: string } {
  if (input.startsWith('ns:')) {
    const rest = input.slice(3);
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) return { mode: 'ns', prefix: rest, searchPart: '' };
    return { mode: null, prefix: '', searchPart: input };
  }
  if (input.startsWith('kind:')) {
    const rest = input.slice(5);
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) return { mode: 'kind', prefix: rest, searchPart: '' };
    return { mode: null, prefix: '', searchPart: input };
  }
  return { mode: null, prefix: '', searchPart: input };
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const { workflows, templates, cronWorkflows, namespaces, isFavorite } = useCluster();
  const [input, setInput] = useState('');
  const [chips, setChips] = useState<Chip[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setChips([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const { mode: completionMode, prefix: completionPrefix, searchPart } = useMemo(
    () => parseCompletion(input),
    [input]
  );

  const nsFilter = chips.find((c) => c.type === 'ns')?.value ?? null;
  const kindFilter = chips.find((c) => c.type === 'kind')?.value as SearchKind | null ?? null;

  const allResources: SearchResult[] = useMemo(() => [
    ...workflows.map((w) => ({ kind: 'Workflow' as const, namespace: w.metadata.namespace, name: w.metadata.name, phase: w.status?.phase })),
    ...templates.map((t) => ({ kind: 'WorkflowTemplate' as const, namespace: t.metadata.namespace, name: t.metadata.name })),
    ...cronWorkflows.map((c) => ({ kind: 'CronWorkflow' as const, namespace: c.metadata.namespace, name: c.metadata.name }))
  ], [workflows, templates, cronWorkflows]);

  const suggestions: string[] = useMemo(() => {
    if (!completionMode) return [];
    const p = completionPrefix.toLowerCase();
    if (completionMode === 'ns') {
      const existing = chips.filter((c) => c.type === 'ns').map((c) => c.value);
      return namespaces.filter((ns) => !existing.includes(ns) && ns.toLowerCase().includes(p));
    }
    const existing = chips.filter((c) => c.type === 'kind').map((c) => c.value);
    return ALL_KINDS.filter((k) => !existing.includes(k) && k.toLowerCase().includes(p));
  }, [completionMode, completionPrefix, namespaces, chips]);

  useEffect(() => {
    setActiveIdx(0);
  }, [completionMode, completionPrefix]);

  const commitSuggestion = useCallback((value: string) => {
    if (!completionMode) return;
    setChips((prev) => {
      const filtered = prev.filter((c) => !(c.type === completionMode && c.value === value));
      return [...filtered, { type: completionMode, value }];
    });
    setInput('');
  }, [completionMode]);

  const results: SearchResult[] = useMemo(() => {
    const query = searchPart;
    const isWildcard = query === '*' || query === '**';
    if (query.length < 2 && !isWildcard) return [];

    const filtered = allResources.filter((r) => {
      if (kindFilter && r.kind !== kindFilter) return false;
      if (nsFilter && r.namespace !== nsFilter) return false;
      if (!isWildcard) {
        const q = query.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !`${r.namespace}/${r.name}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Sort favorites first
    return filtered.sort((a, b) => {
      const aFav = isFavorite(a.kind, a.namespace, a.name);
      const bFav = isFavorite(b.kind, b.namespace, b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    }).slice(0, 30);
  }, [searchPart, kindFilter, nsFilter, allResources, isFavorite]);

  const handleNavigate = useCallback((kind: SearchKind, namespace: string, name: string) => {
    addRecent(kind, namespace, name);
    setRecent(loadRecent());
    navigate(getRoute(kind, namespace, name));
    onClose();
  }, [navigate, onClose]);

  const removeChip = useCallback((type: 'ns' | 'kind') => {
    setChips((prev) => prev.filter((c) => c.type !== type));
  }, []);

  const filteredRecent = useMemo(() => {
    return recent.filter((r) => {
      if (kindFilter && r.kind !== kindFilter) return false;
      if (nsFilter && r.namespace !== nsFilter) return false;
      if (searchPart && searchPart !== '*' && searchPart !== '**') {
        const q = searchPart.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !`${r.namespace}/${r.name}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [recent, kindFilter, nsFilter, searchPart]);

  if (!open) return null;

  const hasChips = chips.length > 0;
  const showResults = searchPart.length >= 2 || searchPart === '*' || searchPart === '**';
  const showSuggestions = completionMode !== null && suggestions.length > 0;
  const showEmptyState = !completionMode && !showResults;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {chips.map((chip) => (
              <span
                key={chip.type}
                data-testid={`chip-${chip.type}`}
                className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-mono font-bold ${
                  chip.type === 'ns'
                    ? 'bg-indigo-950/30 text-indigo-300 border border-indigo-900/40'
                    : 'bg-cyan-950/30 text-cyan-300 border border-cyan-900/40'
                }`}
              >
                {chip.type}:{chip.value}
                <button onClick={() => removeChip(chip.type)} className="hover:text-white">
                  <XCircle className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              data-testid="global-search-input"
              placeholder={hasChips ? 'Search...' : 'Search resources...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (showSuggestions) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIdx((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (e.key === 'Tab' || e.key === 'Enter') {
                    e.preventDefault();
                    const selected = suggestions[activeIdx];
                    if (selected) commitSuggestion(selected);
                    return;
                  }
                }
                if (e.key === 'Backspace' && input === '' && chips.length > 0) {
                  const last = chips[chips.length - 1];
                  removeChip(last.type);
                }
              }}
              className="flex-1 min-w-[80px] bg-transparent text-sm text-zinc-200 focus:outline-none placeholder-zinc-500 font-sans"
            />
          </div>
          <button data-testid="close-search" onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {showSuggestions && (
          <div className="border-b border-zinc-800/60 max-h-48 overflow-y-auto scrollbar-none">
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                {completionMode === 'ns' ? 'Namespaces' : 'Resource kinds'}
                <span className="text-zinc-600 ml-2 normal-case font-normal">
                  Tab / Enter to select
                </span>
              </span>
            </div>
            {suggestions.map((s, i) => (
              <button
                key={s}
                data-testid={completionMode === 'ns' ? `suggestion-ns-${s}` : `suggestion-kind-${s}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitSuggestion(s)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                  i === activeIdx ? 'bg-zinc-800/80 text-white' : 'text-zinc-300 hover:bg-zinc-900/60'
                }`}
              >
                {completionMode === 'kind' && getKindIcon(s as SearchKind)}
                <span>{s}</span>
                {completionMode === 'kind' && (
                  <span className="text-[9px] text-zinc-500 ml-auto">{getKindLabel(s as SearchKind)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!completionMode && (
          <div className="px-3 py-2 border-b border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 font-mono">
              Type <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">ns:</kbd> or <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">kind:</kbd> to filter
              {!hasChips && <> &middot; <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">**</kbd> for all</>}
            </span>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto scrollbar-none">
          {showEmptyState ? (
            filteredRecent.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                Start typing to search across all resources
              </div>
            ) : (
              <>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Recent</span>
                </div>
                {filteredRecent.map((r, i) => (
                  <button
                    key={`${r.kind}/${r.namespace}/${r.name}-${i}`}
                    data-testid="search-recent-item"
                    onClick={() => handleNavigate(r.kind, r.namespace, r.name)}
                    className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-zinc-900/60 transition-colors border-b border-zinc-800/30 last:border-0"
                  >
                    {getKindIcon(r.kind)}
                    <span className="text-xs font-mono text-zinc-300 truncate">
                      <span className="text-zinc-500">{r.kind}/</span>{r.namespace}/{r.name}
                    </span>
                  </button>
                ))}
              </>
            )
          ) : !showSuggestions && showResults && results.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 font-mono">
              No results found
            </div>
          ) : !showSuggestions && showResults ? (
            results.map((r, i) => {
              const favorited = isFavorite(r.kind, r.namespace, r.name);
              return (
                <button
                  key={`${r.kind}/${r.namespace}/${r.name}-${i}`}
                  data-testid="search-result"
                  onClick={() => handleNavigate(r.kind, r.namespace, r.name)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-zinc-900/60 transition-colors border-b border-zinc-800/30 last:border-0"
                >
                  {getKindIcon(r.kind)}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-zinc-200 font-mono block truncate">
                      {r.namespace}/{r.name}
                    </span>
                  </div>
                  {favorited && (
                    <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />
                  )}
                  {r.phase && (
                    <span className="shrink-0 text-[9px] font-mono text-zinc-500 uppercase">{r.phase}</span>
                  )}
                </button>
              );
            })
          ) : null}
        </div>

        <div className="px-3 py-2 border-t border-zinc-800/60 flex items-center justify-between text-[9px] text-zinc-600 font-mono">
          <span>Search across all resources</span>
          <span>ESC to close</span>
        </div>

        {showResults && results.length > 0 && (
          <div className="p-3 border-t border-zinc-800/60">
            <button
              data-testid="show-results-btn"
              onClick={() => {
                const params = new URLSearchParams();
                if (kindFilter) params.set('kind', kindFilter);
                if (nsFilter) params.set('ns', nsFilter);
                if (searchPart && searchPart !== '*' && searchPart !== '**') params.set('q', searchPart);
                navigate(`/resources?${params.toString()}`);
                onClose();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
            >
              Show results ({results.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
