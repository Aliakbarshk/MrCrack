
import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Power, Terminal, Monitor, MonitorX, X, Cpu, Zap, Database, Copy, Trash, Clock, Lightbulb, Image as ImageIcon, List, FileText, Table, Download, Eye, EyeOff, LayoutGrid, ChevronLeft } from 'lucide-react';
import { useLiveAgent } from './hooks/useLiveAgent';
import { Visualizer } from './components/Visualizer';
import { ConnectionState, SessionData, CanvasItem } from './types';
import { getAllSessions, deleteSession } from './utils/db';

const App: React.FC = () => {
    const { 
        connect, 
        disconnect, 
        connectionState, 
        logs, 
        volume,
        isAgentSpeaking,
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
        isDualMode,
        videoState,
        closeVideo,
        canvasItems,
        activeCanvasId,
        setActiveCanvasId,
        deleteCanvasItem,
        triggerDownload,
        notifications
    } = useLiveAgent();

    const [isMicOn, setIsMicOn] = useState(true);
    const [dualModeEnabled, setDualModeEnabled] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
    const [historySessions, setHistorySessions] = useState<SessionData[]>([]);
    const [selectedHistorySession, setSelectedHistorySession] = useState<SessionData | null>(null);

    // Sync dual mode state
    useEffect(() => {
        if (connectionState === ConnectionState.CONNECTED && dualModeEnabled !== isDualMode) {
            connect(dualModeEnabled);
        }
    }, [dualModeEnabled, isDualMode, connect, connectionState]);

    // Auto-open workspace when a new item is created
    useEffect(() => {
        if (activeCanvasId) {
            setIsWorkspaceOpen(true);
        }
    }, [activeCanvasId]);

    const handleToggleConnection = () => {
        if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
            disconnect();
        } else {
            connect(dualModeEnabled);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && connectionState === ConnectionState.CONNECTED) {
                if (!e.repeat) setIsMicOn(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && connectionState === ConnectionState.CONNECTED) {
                setIsMicOn(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [connectionState]);

    const loadHistory = async () => {
        const sessions = await getAllSessions();
        setHistorySessions(sessions);
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await deleteSession(id);
        await loadHistory();
        if (selectedHistorySession?.id === id) setSelectedHistorySession(null);
    };

    const toggleHistory = () => {
        if (!isHistoryOpen) {
            loadHistory();
        }
        setIsHistoryOpen(!isHistoryOpen);
    };

    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const activeItem = canvasItems.find(n => n.id === activeCanvasId);

    const renderCanvasIcon = (type: string) => {
        switch(type) {
            case 'image': return <ImageIcon size={16} />;
            case 'routine': return <List size={16} />;
            case 'spreadsheet': return <Table size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const renderSpreadsheet = (csv: string) => {
        const rows = csv.trim().split('\n').map(row => row.split(','));
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm text-left border-collapse">
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className={i === 0 ? 'bg-slate-800 font-bold text-cyan-400' : 'border-b border-slate-800 hover:bg-slate-900/50'}>
                                {row.map((cell, j) => (
                                    <td key={j} className="p-2 border-r border-slate-800 last:border-r-0 whitespace-nowrap">{cell.trim()}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between p-4 md:p-6 overflow-hidden relative font-sans text-slate-200">
            
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.05) 0%, transparent 50%)' 
                 }}>
            </div>
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)', 
                     backgroundSize: '40px 40px' 
                 }}>
            </div>

            {/* Notification Toasts */}
            <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className={`animate-in slide-in-from-right fade-in duration-300 px-4 py-2 rounded-lg shadow-xl border backdrop-blur-md flex items-center gap-2 text-xs font-bold uppercase tracking-wider
                        ${n.type === 'success' ? 'bg-green-900/20 border-green-500/50 text-green-400' : 
                          n.type === 'error' ? 'bg-red-900/20 border-red-500/50 text-red-400' : 
                          'bg-cyan-900/20 border-cyan-500/50 text-cyan-400'}`}>
                        {n.type === 'success' && <Zap size={14} />}
                        {n.type === 'error' && <X size={14} />}
                        {n.type === 'info' && <Terminal size={14} />}
                        {n.message}
                    </div>
                ))}
            </div>

            {/* Header */}
            <header className={`z-10 w-full max-w-6xl flex justify-between items-center border-b border-slate-800/50 pb-4 backdrop-blur-sm transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_15px] ${isDualMode ? 'bg-gradient-to-r from-cyan-400 to-purple-500' : 'bg-cyan-400 shadow-cyan-400'}`}></div>
                        <div className={`absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75 ${isDualMode ? 'bg-purple-500' : 'bg-cyan-400'}`}></div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] text-white glow-text">MR. CRACK <span className="text-xs align-top opacity-50 text-cyan-300 font-normal tracking-normal">SYS.OS</span></h1>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                     <button 
                        onClick={() => setIsZenMode(!isZenMode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all
                            ${isZenMode 
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-cyan-500/50'}`}
                    >
                        {isZenMode ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span className="hidden md:inline">{isZenMode ? 'ZEN: ON' : 'ZEN: OFF'}</span>
                    </button>
                     <button 
                        onClick={toggleHistory}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all
                            ${isHistoryOpen 
                                ? 'bg-slate-800 border-cyan-500 text-cyan-400' 
                                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400'}`}
                    >
                        <Database size={14} /> Memory
                    </button>
                    <div className="flex items-center gap-2 text-[10px] md:text-xs text-cyan-400/70 uppercase tracking-wider border border-cyan-900/50 px-3 py-1 rounded-full bg-slate-900/50">
                        <div className={`w-1.5 h-1.5 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
                        {connectionState}
                    </div>
                </div>
            </header>

            {/* Main Visualizer & Content Area */}
            <main className="z-10 flex-1 flex flex-col items-center justify-center w-full relative gap-8 py-8">
                
                {/* Video Player Overlay */}
                {videoState.isActive && videoState.url && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-500 w-full max-w-2xl px-4">
                        <div className="bg-slate-900/90 border border-slate-700 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-950/50">
                                <span className="text-xs font-mono text-cyan-400 flex items-center gap-2">
                                    <Zap size={12} /> PLAYING: {videoState.query?.toUpperCase()}
                                </span>
                                <button onClick={closeVideo} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="aspect-video w-full bg-black">
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    src={videoState.url} 
                                    title="YouTube video player" 
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                    allowFullScreen
                                ></iframe>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Orb Visualizer */}
                <div className="relative transform transition-all duration-700">
                    <Visualizer 
                        volume={volume} 
                        isActive={connectionState === ConnectionState.CONNECTED} 
                        isSpeaking={isAgentSpeaking}
                        isDualMode={isDualMode}
                    />
                    
                    {/* Screen Share Indicator overlay */}
                    {isScreenSharing && (
                         <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/50 text-red-400 text-xs font-mono animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            EYES ON
                         </div>
                    )}
                </div>

                {/* Canvas Hint */}
                {connectionState === ConnectionState.CONNECTED && !isZenMode && (
                    <div className="absolute top-1/2 left-0 transform -translate-y-1/2 hidden md:flex flex-col gap-2 p-4">
                         <div className="group flex items-center gap-2 text-slate-600 hover:text-cyan-400 transition-colors cursor-help">
                            <Lightbulb size={16} />
                            <span className="text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">"Generate a Sheet"</span>
                         </div>
                    </div>
                )}
            </main>

            {/* Control Panel */}
            <footer className={`z-10 w-full max-w-3xl flex flex-col gap-6 transition-all duration-500 ${isZenMode ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                
                {/* Logs / Terminal */}
                <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-lg h-40 md:h-48 overflow-hidden flex flex-col shadow-2xl relative group">
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-50 ${isDualMode ? 'from-cyan-500 via-purple-500 to-cyan-500 animate-gradient' : 'from-transparent via-cyan-900 to-transparent'}`}></div>
                    <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Terminal size={14} className={isDualMode ? "text-purple-400" : "text-cyan-600"} />
                            <span className={`text-[10px] font-mono uppercase tracking-widest ${isDualMode ? "text-purple-400/80" : "text-cyan-600/80"}`}>
                                {isDualMode ? 'SYS_LOGS // DUAL_CORE' : 'SYS_LOGS // ROOT'}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-xs md:text-sm space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        {logs.length === 0 && (
                            <div className="text-slate-700 italic text-center mt-10 flex flex-col items-center gap-2">
                                <span>System Ready.</span>
                                <span className="text-[10px] text-slate-800">Hold 'SPACE' to Talk</span>
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                                <span className="text-slate-600 min-w-[50px] opacity-50">{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit' })}</span>
                                <div className="flex-1 break-words">
                                    <span className={`font-bold mr-2 ${
                                        log.role === 'system' ? 'text-yellow-500/50' :
                                        log.role === 'model' ? (isDualMode ? 'text-purple-400' : 'text-cyan-400') : 'text-white/90'
                                    }`}>
                                        {log.role === 'system' ? 'SYS >' : log.role === 'model' ? 'AI >' : 'ALI >'}
                                    </span>
                                    <span className={`${log.role === 'system' ? 'text-slate-500' : 'text-slate-300'}`}>{log.text}</span>
                                </div>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>

                {/* Primary Controls */}
                <div className="grid grid-cols-6 gap-3 items-center pb-2">
                    
                    {/* Screen Share Toggle */}
                    <button 
                        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                        disabled={connectionState !== ConnectionState.CONNECTED}
                        className={`col-span-1 flex flex-col items-center justify-center gap-1 p-2 h-14 rounded-xl border transition-all duration-200 
                            ${isScreenSharing 
                                ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 hover:border-cyan-900'}
                            disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                        {isScreenSharing ? <MonitorX size={18} /> : <Monitor size={18} />}
                        <span className="text-[9px] uppercase font-bold tracking-wider hidden md:block">{isScreenSharing ? 'Stop' : 'Share'}</span>
                    </button>

                    {/* Dual Core Toggle */}
                    <button 
                        onClick={() => setDualModeEnabled(!dualModeEnabled)}
                        className={`col-span-1 flex flex-col items-center justify-center gap-1 p-2 h-14 rounded-xl border transition-all duration-200 
                            ${dualModeEnabled 
                                ? 'bg-purple-900/20 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-purple-400 hover:border-purple-900'}`}
                    >
                        <Cpu size={18} />
                        <span className="text-[9px] uppercase font-bold tracking-wider hidden md:block">{dualModeEnabled ? 'Dual On' : 'Dual Off'}</span>
                    </button>

                    {/* Workspace Toggle */}
                    <button 
                        onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
                        className={`col-span-1 flex flex-col items-center justify-center gap-1 p-2 h-14 rounded-xl border transition-all duration-200 
                            ${isWorkspaceOpen 
                                ? 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 hover:border-cyan-900'}`}
                    >
                        <LayoutGrid size={18} />
                        <span className="text-[9px] uppercase font-bold tracking-wider hidden md:block">Work</span>
                    </button>

                    {/* Main Connect Button (Span 2) */}
                    <button 
                        onClick={handleToggleConnection}
                        className={`
                            col-span-2 h-16 rounded-2xl font-bold text-base md:text-lg tracking-wider transition-all duration-300 flex items-center justify-center gap-2 md:gap-3
                            ${connectionState === ConnectionState.CONNECTED 
                                ? 'bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                                : (isDualMode ? 'bg-purple-500/10 border border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-slate-950 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                                              : 'bg-cyan-500/10 border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)]')
                            }
                        `}
                    >
                        <Power size={24} className={connectionState === ConnectionState.CONNECTING ? 'animate-spin' : ''} />
                        {connectionState === ConnectionState.DISCONNECTED && "INITIALIZE"}
                        {connectionState === ConnectionState.CONNECTING && "LOADING..."}
                        {connectionState === ConnectionState.CONNECTED && "TERMINATE"}
                        {connectionState === ConnectionState.ERROR && "REBOOT"}
                    </button>

                    {/* Mic Toggle */}
                    <button 
                        onClick={() => setIsMicOn(!isMicOn)}
                        disabled={connectionState !== ConnectionState.CONNECTED}
                        className={`col-span-1 flex flex-col items-center justify-center gap-1 p-2 h-14 rounded-xl border transition-all duration-200
                            ${isMicOn 
                                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 hover:border-cyan-900' 
                                : 'bg-red-900/20 border-red-900 text-red-500'}
                            disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                        {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
                        <span className="text-[9px] uppercase font-bold tracking-wider hidden md:block">{isMicOn ? 'Live' : 'Muted'}</span>
                    </button>
                </div>
                
                {/* Developer Credit */}
                <div className="text-center text-[10px] text-slate-600 font-mono tracking-widest pb-2 uppercase">
                    Developed by Ali Akbar
                </div>
            </footer>

            {/* SIDE PANEL: CANVAS WORKSPACE */}
            <div className={`fixed top-0 right-0 h-full w-full md:w-[500px] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isWorkspaceOpen && !isZenMode ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <div className="flex items-center gap-2">
                        {activeCanvasId && (
                            <button onClick={() => setActiveCanvasId(null)} className="text-slate-400 hover:text-white mr-2">
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                            <LayoutGrid size={16} />
                            WORKSPACE {activeItem ? `// ${activeItem.type.toUpperCase()}` : '// INDEX'}
                        </h3>
                    </div>
                    <button onClick={() => setIsWorkspaceOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                
                {/* Panel Content */}
                <div className="flex-1 p-6 overflow-y-auto bg-slate-950/80">
                    {activeItem ? (
                        /* Detail View */
                        <>
                            <h2 className="text-xl font-bold text-slate-100 mb-4">{activeItem.title}</h2>
                            
                            {/* Render Content Based on Type */}
                            {activeItem.type === 'image' ? (
                                <div className="rounded-lg overflow-hidden border border-slate-800 shadow-lg">
                                    <img src={activeItem.content} alt={activeItem.title} className="w-full h-auto object-cover" />
                                </div>
                            ) : activeItem.type === 'spreadsheet' ? (
                                renderSpreadsheet(activeItem.content)
                            ) : (
                                <div className="prose prose-invert prose-sm text-slate-300 whitespace-pre-wrap font-mono">
                                    {activeItem.content}
                                </div>
                            )}
                        </>
                    ) : (
                        /* List View */
                        <div className="grid gap-3">
                            {canvasItems.length === 0 ? (
                                <div className="text-slate-600 text-center italic mt-10">Workspace is empty.</div>
                            ) : (
                                canvasItems.map(item => (
                                    <div key={item.id} onClick={() => setActiveCanvasId(item.id)} className="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-cyan-500/50 cursor-pointer transition-all group">
                                         <div className="flex items-center gap-2 font-bold text-slate-200 mb-1 group-hover:text-cyan-400 transition-colors">
                                            {renderCanvasIcon(item.type)} {item.title}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono truncate uppercase flex justify-between">
                                            <span>{item.type}</span>
                                            <span>{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                
                {/* Panel Footer (Actions) - Only in Detail View */}
                {activeItem && (
                    <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
                         <button 
                            onClick={() => triggerDownload(activeItem)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 text-sm font-bold transition-colors border border-cyan-800/50"
                        >
                            <Download size={14} /> Download
                        </button>
                        {activeItem.type !== 'image' && activeItem.type !== 'spreadsheet' && (
                            <button 
                                onClick={() => navigator.clipboard.writeText(`${activeItem.title}\n\n${activeItem.content}`)}
                                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                            >
                                <Copy size={14} />
                            </button>
                        )}
                        <button 
                            onClick={() => deleteCanvasItem(activeItem.id)}
                            className="p-2 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-colors"
                        >
                            <Trash size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL: HISTORY MEMORY */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-950 border border-slate-800 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden">
                        
                        {/* Sidebar: Session List */}
                        <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-cyan-400 text-sm tracking-wider flex items-center gap-2">
                                    <Database size={14} /> MEMORY BANKS
                                </h3>
                                <button onClick={toggleHistory} className="md:hidden text-slate-400"><X size={16} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {historySessions.length === 0 ? (
                                    <div className="p-4 text-center text-slate-600 text-xs italic">No memory data found.</div>
                                ) : (
                                    historySessions.map(session => (
                                        <div 
                                            key={session.id}
                                            onClick={() => setSelectedHistorySession(session)}
                                            className={`p-4 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors group relative ${selectedHistorySession?.id === session.id ? 'bg-cyan-900/10 border-l-2 border-l-cyan-500' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-mono text-slate-500">{new Date(session.startTime).toLocaleDateString()}</span>
                                                <button onClick={(e) => handleDeleteSession(session.id, e)} className="text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={12} /></button>
                                            </div>
                                            <div className="text-sm font-medium text-slate-300 truncate">
                                                {session.canvasItems.length > 0 ? `💾 ${session.canvasItems[0].title}` : (session.logs.find(l => l.role === 'user')?.text || 'Untitled Session')}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-1 flex gap-2">
                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                <span className="flex items-center gap-1">{session.logs.length} msgs</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Main: Details */}
                        <div className="flex-1 flex flex-col bg-slate-950 relative">
                             <button onClick={toggleHistory} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 bg-slate-900 rounded-full z-10 hidden md:block"><X size={16} /></button>
                            
                            {selectedHistorySession ? (
                                <>
                                    <div className="p-6 border-b border-slate-800 bg-slate-900/30 pt-12 md:pt-6">
                                        <h2 className="text-lg font-bold text-white mb-2">Session Details</h2>
                                        <div className="flex gap-4 text-xs text-slate-400 font-mono">
                                            <span>ID: {selectedHistorySession.id}</span>
                                            <span>Duration: {selectedHistorySession.endTime ? Math.round((selectedHistorySession.endTime - selectedHistorySession.startTime)/1000) + 's' : 'Unknown'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        
                                        {/* Canvas Items in History */}
                                        {selectedHistorySession.canvasItems.length > 0 && (
                                            <div className="mb-8">
                                                <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">Saved Content</h3>
                                                <div className="grid gap-3">
                                                    {selectedHistorySession.canvasItems.map(item => (
                                                        <div key={item.id} className="bg-slate-900 border border-slate-800 rounded p-4">
                                                            <div className="flex items-center gap-2 font-bold text-slate-200 mb-2">
                                                                {renderCanvasIcon(item.type)} {item.title}
                                                            </div>
                                                            {item.type === 'image' ? (
                                                                <img src={item.content} alt={item.title} className="w-32 h-24 object-cover rounded" />
                                                            ) : (
                                                                <div className="text-sm text-slate-400 whitespace-pre-wrap font-mono">{item.content}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Logs Section */}
                                        <div>
                                            <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-3">Transcript</h3>
                                            <div className="space-y-3 font-mono text-sm">
                                                {selectedHistorySession.logs.map((log, i) => (
                                                    <div key={i} className="flex gap-3">
                                                        <span className={`font-bold min-w-[60px] ${log.role === 'user' ? 'text-cyan-400' : log.role === 'model' ? 'text-purple-400' : 'text-slate-500'}`}>
                                                            {log.role.toUpperCase()}
                                                        </span>
                                                        <span className="text-slate-300">{log.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                                    <Database size={48} className="mb-4 opacity-20" />
                                    <p>Select a session to access memory banks.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;
