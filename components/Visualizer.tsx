import React, { useMemo } from 'react';

interface VisualizerProps {
    volume: number;
    isActive: boolean;
    isSpeaking: boolean;
    isDualMode?: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive, isSpeaking, isDualMode = false }) => {
    
    // Scale for main orb
    const baseScale = isActive ? 1 + Math.min(volume * 1.5, 0.8) : 1;

    // Colors
    const crackColor = '#22d3ee'; // Cyan (Crack)
    const jackColor = '#a855f7';  // Purple (Jack)
    const inactiveColor = '#334155';

    return (
        <div className="orb-container relative w-[300px] h-[200px] flex items-center justify-center">
            
            {/* SINGLE MODE ORB / MR. CRACK (The Energy) */}
            <div 
                className={`absolute transition-all duration-700 ease-in-out z-10
                    ${isDualMode ? '-translate-x-16 opacity-90' : 'translate-x-0 opacity-100'}
                `}
                style={{
                    transform: isDualMode ? `translateX(-60px) scale(${baseScale * 0.8})` : `scale(${baseScale})`
                }}
            >
                 {/* Crack Specific: Chaotic Rings */}
                 {isActive && (
                    <>
                        <div className="orb-ring" style={{ borderColor: 'rgba(34, 211, 238, 0.6)', animationDuration: '2s' }} />
                        <div className="orb-ring" style={{ borderColor: 'rgba(34, 211, 238, 0.6)', animationDelay: '0.4s', animationDuration: '1.5s' }} />
                        <div className="orb-ring" style={{ borderColor: 'rgba(34, 211, 238, 0.4)', animationDelay: '0.8s', animationDuration: '3s' }} />
                    </>
                )}
                
                {/* Crack Core */}
                <div 
                    className="w-24 h-24 rounded-full flex items-center justify-center relative transition-colors duration-300"
                    style={{
                        background: `radial-gradient(circle, ${isActive ? crackColor : inactiveColor} 0%, #020617 100%)`,
                        boxShadow: isActive ? `0 0 ${30 + volume * 50}px ${crackColor}, inset 0 0 20px #cffafe` : 'none',
                        border: '2px solid rgba(34, 211, 238, 0.4)'
                    }}
                >
                    {isActive && isSpeaking && (
                        <div className="absolute inset-0 rounded-full border border-cyan-100 opacity-60 animate-ping"></div>
                    )}
                </div>
                {/* Label */}
                {isDualMode && (
                    <div className="absolute -bottom-8 w-full text-center text-[10px] font-mono text-cyan-400 font-bold tracking-widest animate-in fade-in slide-in-from-top-2">
                        MR. CRACK
                    </div>
                )}
            </div>

            {/* DUAL MODE ORB / JACK (The Stability) */}
            <div 
                className={`absolute transition-all duration-700 ease-in-out z-10
                    ${isDualMode ? 'opacity-100 translate-x-16' : 'opacity-0 translate-x-0 scale-0'}
                `}
                style={{
                     transform: isDualMode ? `translateX(60px) scale(${1 + (volume * 0.5)})` : `scale(0)`, // Jack moves less
                     filter: isDualMode ? 'none' : 'blur(20px)'
                }}
            >
                {/* Jack Specific: Solid Core, No erratic rings, just a slow pulse */}
                <div 
                    className="w-24 h-24 flex items-center justify-center relative"
                    style={{
                        background: `linear-gradient(135deg, ${jackColor} 0%, #581c87 100%)`,
                        boxShadow: `0 0 ${20 + volume * 20}px ${jackColor}, inset 0 0 10px #f3e8ff`,
                        border: '1px solid rgba(168, 85, 247, 0.5)',
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' // Hexagon shape for logic
                    }}
                >
                     {isActive && isSpeaking && isDualMode && (
                        <div className="absolute inset-2 bg-purple-300/20 animate-pulse" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
                    )}
                </div>
                 {/* Label */}
                 {isDualMode && (
                    <div className="absolute -bottom-8 w-full text-center text-[10px] font-mono text-purple-400 font-bold tracking-widest animate-in fade-in slide-in-from-top-2">
                        JACK
                    </div>
                )}
            </div>

            {/* Connecting Line (Neural Link) */}
            {isDualMode && isActive && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 opacity-50 z-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping absolute"></div>
                </div>
            )}
            
            {/* Main Status Text */}
            <div className="absolute -bottom-24 text-center w-full">
               <span className={`text-sm font-medium tracking-widest uppercase ${isActive ? (isDualMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 glow-text' : 'text-cyan-400 glow-text') : 'text-slate-500'}`}>
                   {isActive ? (isDualMode ? "DUAL CORE // SYNCED" : (isSpeaking ? "Speaking" : "Listening")) : "Offline"}
               </span>
            </div>
        </div>
    );
};