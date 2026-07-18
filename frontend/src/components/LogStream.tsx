import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Download, Trash2, ArrowDown, Search, Copy, Check } from 'lucide-react';

interface LogLine {
  id: string;
  content: string;
  podName: string;
  timestamp: string;
}

interface LogStreamProps {
  namespace: string;
  workflowName: string;
  activePodId?: string; // Optional default filter
}

export function LogStream({ namespace, workflowName, activePodId = '' }: LogStreamProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPod, setSelectedPod] = useState(activePodId);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync state filter with prop
  useEffect(() => {
    if (activePodId) {
      setSelectedPod(activePodId);
    }
  }, [activePodId]);

  // Connect to SSE log stream
  useEffect(() => {
    if (isPaused) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    setLogs([]); // Reset or preserve? Reset matches fresh stream connection

    const url = `/api/v1/workflows/${namespace}/${workflowName}/log`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.result) {
          const { content, podName } = data.result;
          const newLine: LogLine = {
            id: Math.random().toString(36).substring(2, 9),
            content: content || '',
            podName: podName || 'unknown',
            timestamp: new Date().toLocaleTimeString()
          };

          setLogs((prev) => {
            // Cap at 1000 lines for mobile memory conservation
            const updated = [...prev, newLine];
            if (updated.length > 1000) {
              return updated.slice(updated.length - 1000);
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Error parsing SSE log:', err);
      }
    };

    eventSource.onerror = () => {
      console.log('SSE connection closed or re-establishing...');
    };

    return () => {
      if (eventSource.readyState !== 2) {
        eventSource.close();
      }
    };
  }, [namespace, workflowName, isPaused]);

  // Scroll to bottom helper
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle manual scroll detection
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user is within 40px of bottom, autoScroll remains true
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  // Extract unique Pod Names
  const podsList = Array.from(new Set(logs.map((l) => l.podName))).filter(Boolean);

  // Filtered log display
  const filteredLogs = logs.filter((log) => {
    const matchesPod = !selectedPod || log.podName === selectedPod;
    const matchesSearch = !searchQuery || log.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPod && matchesSearch;
  });

  // Copy all visible logs to clipboard
  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.podName}] ${l.content}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Copy single log line
  const handleCopyLine = (log: LogLine) => {
    navigator.clipboard.writeText(log.content);
    setCopiedLineId(log.id);
    setTimeout(() => setCopiedLineId(null), 2000);
  };

  // Download logic
  const handleDownload = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.podName}] ${l.content}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Log syntax highlighter
  const highlightLogLine = (text: string) => {
    let style = 'text-gray-300';
    if (text.includes('[INFO]')) {
      style = 'text-blue-400';
    } else if (text.includes('[SUCCESS]') || text.includes('[OK]')) {
      style = 'text-emerald-400 font-medium';
    } else if (text.includes('[WARN]') || text.includes('[WARNING]')) {
      style = 'text-amber-400';
    } else if (text.includes('[ERROR]') || text.includes('[FATAL]')) {
      style = 'text-rose-400 font-semibold';
    } else if (text.includes('[DEBUG]')) {
      style = 'text-purple-400';
    }

    return <span className={style}>{text}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-[#090D12] rounded-xl border border-gray-800/80 overflow-hidden shadow-inner">
      {/* Control Bar */}
      <div className="flex flex-col gap-2 p-3 bg-gray-950/80 border-b border-gray-800/80">
        <div className="flex items-center justify-between gap-2">
          {/* Pod selector */}
          <div className="flex-1 min-w-[120px]">
            <select
              value={selectedPod}
              onChange={(e) => setSelectedPod(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="">All pods</option>
              {podsList.map((pod) => (
                <option key={pod} value={pod}>
                  {pod}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-1.5 rounded text-gray-400 hover:text-gray-200 transition-colors ${
                isPaused ? 'bg-amber-950/40 text-amber-500 hover:text-amber-400' : 'hover:bg-gray-900'
              }`}
              title={isPaused ? 'Resume logs stream' : 'Pause logs stream'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCopyLogs}
              disabled={filteredLogs.length === 0}
              className="p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Copy visible logs to clipboard"
            >
              {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              disabled={filteredLogs.length === 0}
              className="p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Download Logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-900 transition-colors"
              title="Clear Terminal View"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-500">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search within logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded pl-7 pr-3 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Terminal Display */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed select-text scrollbar-thin scrollbar-thumb-gray-800"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center gap-1.5 font-sans">
            <p className="font-mono text-[11px]">
              {isPaused ? 'Logs stream is paused.' : 'Awaiting streaming cluster events...'}
            </p>
            <span className="text-[10px] text-gray-600 max-w-[200px]">
              Ensure the pod is in Running/Succeeded phase and trigger actions above if necessary.
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-2 hover:bg-gray-900/60 py-0.5 rounded px-1 group">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="text-gray-600 shrink-0 select-none text-[10px]">{log.timestamp}</span>
                  <span className="text-blue-500/80 shrink-0 select-none font-semibold text-[10px] bg-blue-950/20 px-1 border border-blue-900/20 rounded">
                    {log.podName.split('-').slice(-1)[0] || log.podName}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{highlightLogLine(log.content)}</span>
                </div>
                <button
                  onClick={() => handleCopyLine(log)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-200 transition-opacity shrink-0"
                  title="Copy log line"
                >
                  {copiedLineId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Scroll button */}
      {!autoScroll && filteredLogs.length > 0 && (
        <button
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full p-2 shadow-lg flex items-center gap-1 text-xs font-sans transition-all scale-100 hover:scale-105"
        >
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Scroll Live</span>
        </button>
      )}
    </div>
  );
}
