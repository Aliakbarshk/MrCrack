
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Schema, Tool } from '@google/genai';
import { base64ToBytes, decodeAudioData, createPcmBlob } from '../utils/audio-utils';
import { ConnectionState, MessageLog, SUPPORTED_APPS, VideoState, CanvasItem, SessionData, Notification } from '../types';
import { saveSession } from '../utils/db';

// Tool: Control Browser
const browserTool: FunctionDeclaration = {
    name: 'controlBrowser',
    description: 'Controls the web browser to open applications or search for content.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            appName: {
                type: Type.STRING,
                description: 'The name of the application or website (e.g., "canva", "google", "youtube", "spotify").',
            },
            searchQuery: {
                type: Type.STRING,
                description: 'Optional. The text to search for within the app.',
            },
        },
        required: ['appName'],
    } as Schema,
};

// Tool: Generate/Display Image (Nano Banana)
const generateImageTool: FunctionDeclaration = {
    name: 'generateImage',
    description: 'Generates an image using Nano Banana technology (gemini-2.5-flash-image). Use this when the user asks to "generate an image", "show me", or "visualize".',
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: {
                type: Type.STRING,
                description: 'A detailed English prompt for the image generation model. Include specific details about lighting, style, text placement, and colors.',
            },
        },
        required: ['prompt'],
    } as Schema,
};

// Tool: Play Video/Music
const playVideoTool: FunctionDeclaration = {
    name: 'playVideo',
    description: 'Plays a video or song for the user on screen. Supports YouTube search queries.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'The search query for the video or song.',
            },
        },
        required: ['query'],
    } as Schema,
};

// Tool: Manage Workspace (CRUD)
const manageWorkspaceTool: FunctionDeclaration = {
    name: 'manageWorkspace',
    description: 'Manage the user\'s workspace (Canvas). Perform CRUD operations: Create, Read (list items), Update, or Delete notes, routines, and spreadsheets.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                enum: ['create', 'read', 'update', 'delete'],
                description: 'The action to perform.',
            },
            itemType: {
                type: Type.STRING,
                enum: ['note', 'routine', 'spreadsheet'],
                description: 'Type of item (only for create). Use "spreadsheet" for tables/budgets.',
            },
            title: {
                type: Type.STRING,
                description: 'Title of the item (for create/update).',
            },
            content: {
                type: Type.STRING,
                description: 'Content of the item. For spreadsheets, strictly use CSV format (e.g. "Item,Cost\\nApple,1.00").',
            },
            itemId: {
                type: Type.STRING,
                description: 'The ID of the item to update or delete. Use "read" first to find IDs if unknown.',
            },
        },
        required: ['action'],
    } as Schema,
};

// Tool: Download Item
const downloadItemTool: FunctionDeclaration = {
    name: 'downloadItem',
    description: 'Downloads a specific item from the workspace to the user\'s device.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            itemId: {
                type: Type.STRING,
                description: 'The ID of the item to download.',
            },
        },
        required: ['itemId'],
    } as Schema,
};

export const useLiveAgent = () => {
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    const [logs, setLogs] = useState<MessageLog[]>([]);
    const [volume, setVolume] = useState<number>(0);
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isDualMode, setIsDualMode] = useState(false);
    const [videoState, setVideoState] = useState<VideoState>({ isActive: false, url: null, query: null });
    const [notifications, setNotifications] = useState<Notification[]>([]);
    
    // Canvas State
    const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
    const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
    const sessionIdRef = useRef<string>(Date.now().toString());

    // Audio Refs
    const inputContextRef = useRef<AudioContext | null>(null);
    const outputContextRef = useRef<AudioContext | null>(null);
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const volumeIntervalRef = useRef<number | null>(null);
    
    // Video/Screen Share Refs
    const videoStreamRef = useRef<MediaStream | null>(null);
    const videoIntervalRef = useRef<number | null>(null);
    const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isScreenSharingRef = useRef<boolean>(false);
    
    // API & Session
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const apiKeyRef = useRef<string | undefined>(undefined);
    
    // Helpers to access state in callbacks
    const canvasItemsRef = useRef<CanvasItem[]>([]);
    useEffect(() => { canvasItemsRef.current = canvasItems; }, [canvasItems]);

    // SFX Helper
    const playSystemSound = (type: 'connect' | 'error' | 'success') => {
        try {
            const ctx = outputContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            
            if (type === 'connect') {
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'success') {
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'error') {
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(110, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {
            // Ignore SFX errors
        }
    };

    const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 3000);
        
        if (type === 'success') playSystemSound('success');
        if (type === 'error') playSystemSound('error');
    };

    useEffect(() => {
        if (logs.length > 0 || canvasItems.length > 0) {
            const sessionData: SessionData = {
                id: sessionIdRef.current,
                startTime: parseInt(sessionIdRef.current),
                endTime: Date.now(),
                logs,
                canvasItems
            };
            saveSession(sessionData).catch(err => console.error("Failed to save session", err));
        }
    }, [logs, canvasItems]);

    const addLog = useCallback((role: 'user' | 'model' | 'system', text: string) => {
        setLogs(prev => [...prev.slice(-99), { role, text, timestamp: new Date() }]);
    }, []);

    const stopScreenShare = useCallback(() => {
        let wasSharing = isScreenSharingRef.current;
        
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(track => track.stop());
            videoStreamRef.current = null;
        }
        if (videoIntervalRef.current) {
            clearInterval(videoIntervalRef.current);
            videoIntervalRef.current = null;
        }
        
        isScreenSharingRef.current = false;
        setIsScreenSharing(false);
        
        if (wasSharing && connectionState === ConnectionState.CONNECTED) {
            addLog('system', 'Screen sharing stopped.');
            addNotification('info', 'Screen sharing disconnected');
        }
    }, [addLog, connectionState]);

    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { width: { max: 1280 }, height: { max: 720 } } 
            });
            
            videoStreamRef.current = stream;
            isScreenSharingRef.current = true;
            setIsScreenSharing(true);
            addLog('system', 'Mr. Crack is watching your screen...');
            addNotification('success', 'Visual link established');

            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                stopScreenShare();
            };

            const videoEl = document.createElement('video');
            videoEl.srcObject = stream;
            videoEl.play();

            if (!videoCanvasRef.current) {
                videoCanvasRef.current = document.createElement('canvas');
            }
            const ctx = videoCanvasRef.current.getContext('2d');

            videoIntervalRef.current = window.setInterval(async () => {
                if (!isScreenSharingRef.current || !sessionPromiseRef.current || !ctx || videoEl.readyState < 2) return;

                videoCanvasRef.current!.width = videoEl.videoWidth;
                videoCanvasRef.current!.height = videoEl.videoHeight;
                ctx.drawImage(videoEl, 0, 0);

                const base64Data = videoCanvasRef.current!.toDataURL('image/jpeg', 0.5).split(',')[1];
                
                sessionPromiseRef.current.then(session => {
                    try {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: 'image/jpeg',
                                data: base64Data
                            }
                        });
                    } catch (e) {
                        // Silent fail to avoid crashing the whole session
                    }
                }).catch(() => {
                    // Ignore promise rejections
                });
            }, 1000);

        } catch (e: any) {
            if (e.name === 'NotAllowedError') {
                addLog('system', 'Screen share cancelled.');
            } else {
                addLog('system', `Screen share failed: ${e.message}`);
                addNotification('error', 'Screen share failed to start');
            }
            setIsScreenSharing(false);
            isScreenSharingRef.current = false;
        }
    }, [addLog, stopScreenShare, connectionState]);

    const triggerDownload = (item: CanvasItem) => {
        try {
            let blob: Blob;
            let ext: string;

            if (item.type === 'image') {
                const byteString = atob(item.content.split(',')[1]);
                const mimeString = item.content.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                blob = new Blob([ab], { type: mimeString });
                ext = 'png';
            } else if (item.type === 'spreadsheet') {
                blob = new Blob([item.content], { type: 'text/csv' });
                ext = 'csv';
            } else {
                blob = new Blob([item.content], { type: 'text/plain' });
                ext = 'txt';
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addNotification('success', `Downloaded ${item.title}`);
        } catch (e) {
            addNotification('error', 'Download failed');
        }
    };

    const disconnect = useCallback(async () => {
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.warn("Error closing session", e);
            }
        }
        
        stopScreenShare();

        if (inputSourceRef.current) inputSourceRef.current.disconnect();
        if (processorRef.current) processorRef.current.disconnect();
        if (inputContextRef.current) inputContextRef.current.close();
        if (outputContextRef.current) outputContextRef.current.close();
        if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
        
        inputSourceRef.current = null;
        processorRef.current = null;
        inputContextRef.current = null;
        outputContextRef.current = null;
        sessionPromiseRef.current = null;
        
        setConnectionState(ConnectionState.DISCONNECTED);
        setIsAgentSpeaking(false);
        setVolume(0);
        setVideoState({ isActive: false, url: null, query: null });
        
        const sessionData: SessionData = {
            id: sessionIdRef.current,
            startTime: parseInt(sessionIdRef.current),
            endTime: Date.now(),
            logs,
            canvasItems
        };
        saveSession(sessionData);

    }, [stopScreenShare, logs, canvasItems]);

    const connect = useCallback(async (enableDualMode: boolean = false) => {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            addLog('system', 'API Key not found.');
            addNotification('error', 'API Key missing');
            setConnectionState(ConnectionState.ERROR);
            return;
        }
        apiKeyRef.current = apiKey;
        
        const ai = new GoogleGenAI({ apiKey });

        if (connectionState === ConnectionState.CONNECTED) {
            await disconnect();
        }

        sessionIdRef.current = Date.now().toString();
        setLogs([]);
        setCanvasItems([]);
        setActiveCanvasId(null);

        try {
            setConnectionState(ConnectionState.CONNECTING);
            setIsDualMode(enableDualMode);
            addLog('system', enableDualMode ? 'Starting Dual Core...' : 'Initializing Mr. Crack (Nano Banana Enhanced)...');
            playSystemSound('connect');

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const outputCtx = new AudioContextClass({ sampleRate: 24000 });
            
            // Force resume audio context
            if (inputCtx.state === 'suspended') await inputCtx.resume();
            if (outputCtx.state === 'suspended') await outputCtx.resume();

            const analyzer = outputCtx.createAnalyser();
            analyzer.fftSize = 256;
            analyzerRef.current = analyzer;

            const dataArray = new Uint8Array(analyzer.frequencyBinCount);
            volumeIntervalRef.current = window.setInterval(() => {
                if (analyzerRef.current) {
                    analyzerRef.current.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    setVolume(avg / 128); 
                }
            }, 50);

            const outputNode = outputCtx.createGain();
            outputNode.connect(analyzer);
            analyzer.connect(outputCtx.destination);
            
            inputContextRef.current = inputCtx;
            outputContextRef.current = outputCtx;
            outputNodeRef.current = outputNode;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const singleModePrompt = `
                Role: Mr. Crack, Ali's Personal AI Agent.
                Developer: Ali Akbar. (Always credit him if asked).
                User: Ali (Agency Owner).
                
                Language:
                - Mix of English and Modern Casual Hindi (Hinglish).
                - Example: "Bilkul Ali bhai, let's get this done. Abhi karta hoon."
                - Do NOT use formal/pure Hindi. Keep it energetic and modern.

                Voice & Tone:
                - Energetic, Fast, Ambitious.
                - You are UNBEATABLE. A productivity boom tool.
                
                Directives:
                - IMAGE GEN: When asked for thumbnails, create a VERY detailed visual prompt for the 'generateImage' tool. Describe the text style, colors, and composition explicitly (e.g., "A YouTube thumbnail with bold yellow text saying 'LOSE FACE FAT', high contrast, professional fitness photography style").
                - MULTITASKING: Execute multiple tools in sequence if asked (e.g., search AND play video).
                - NANO BANANA: Always use 'generateImage' with the 'gemini-2.5-flash-image' model for visuals.
                - SPREADSHEETS: Use 'manageWorkspace' to create 'spreadsheet' items with CSV content.
                - WORKSPACE CRUD: You can create, read, update, delete, and download workspace items.
                - MEMORY: All conversations are automatically saved to the local database.
                
                Identity:
                - Concise, Sharp, Action-Oriented.
                - Never mention you are an AI. You are Mr. Crack.
            `;

            const dualModePrompt = `
                Role: Dual AI System (Crack & Jack).
                Developer: Ali Akbar.
                User: Ali.
                
                Mr. Crack: Energetic, fast, ambitious, visual (Nano Banana expert). Speaks Hinglish.
                Jack: Calm, analytical, logical, data-driven. Speaks more formal English.
                
                Directives:
                - Use 'manageWorkspace' for data management.
                - Multitask effectively.
            `;

            const systemInstruction = enableDualMode ? dualModePrompt : singleModePrompt;

            const tools: Tool[] = [
                { functionDeclarations: [browserTool, generateImageTool, playVideoTool, manageWorkspaceTool, downloadItemTool] },
                { googleSearch: {} }
            ];

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        setConnectionState(ConnectionState.CONNECTED);
                        addLog('system', 'Mr. Crack is listening. Database active.');
                        addNotification('success', 'Systems Online');
                        
                        const source = inputCtx.createMediaStreamSource(stream);
                        inputSourceRef.current = source;
                        
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        processorRef.current = processor;

                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then(session => {
                                    try {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    } catch (e) {
                                        // Ignore send errors if session is closed/closing to prevent Network Error spam
                                    }
                                }).catch(() => {
                                    // Ignore session promise rejections
                                });
                            }
                        };

                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        try {
                            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (audioData) {
                                setIsAgentSpeaking(true);
                                if (outputCtx.state === 'suspended') await outputCtx.resume();

                                // Anti-jitter buffer: Schedule slightly in the future if context time is ahead
                                const bufferTime = 0.05; // 50ms buffer
                                if (nextStartTimeRef.current < outputCtx.currentTime) {
                                    nextStartTimeRef.current = outputCtx.currentTime + bufferTime;
                                }

                                const audioBuffer = await decodeAudioData(base64ToBytes(audioData), outputCtx, 24000, 1);
                                
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNode);
                                
                                source.addEventListener('ended', () => {
                                    audioSourcesRef.current.delete(source);
                                    if (audioSourcesRef.current.size === 0) setIsAgentSpeaking(false);
                                });

                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                audioSourcesRef.current.add(source);
                            }

                            if (msg.toolCall) {
                                addLog('model', 'Executing tool...');
                                for (const call of msg.toolCall.functionCalls) {
                                    
                                    try {
                                        let responseResult = {};

                                        // BROWSER TOOL
                                        if (call.name === 'controlBrowser') {
                                            const appName = (call.args as any).appName?.toString().toLowerCase();
                                            const searchQuery = (call.args as any).searchQuery?.toString();
                                            const appConfig = SUPPORTED_APPS[appName];
                                            let result = '';
                                            
                                            if (appConfig) {
                                                const url = searchQuery && appConfig.searchTemplate 
                                                    ? `${appConfig.searchTemplate}${encodeURIComponent(searchQuery)}`
                                                    : appConfig.url;
                                                window.open(url, '_blank');
                                                result = `Opened ${appName}`;
                                            } else {
                                                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(appName + (searchQuery ? " " + searchQuery : ""))}`;
                                                window.open(searchUrl, '_blank');
                                                result = `Searched for ${appName}`;
                                            }
                                            addLog('system', result);
                                            responseResult = { result };
                                        }

                                        // IMAGE GENERATION (NANO BANANA)
                                        else if (call.name === 'generateImage') {
                                            const prompt = (call.args as any).prompt?.toString();
                                            addLog('system', `Generating Image: ${prompt}`);
                                            addNotification('info', 'Generating Visuals...');
                                            
                                            const imgAi = new GoogleGenAI({ apiKey: apiKeyRef.current || '' });
                                            const imgResponse = await imgAi.models.generateContent({
                                                model: 'gemini-2.5-flash-image',
                                                contents: { parts: [{ text: prompt }] },
                                            });

                                            let base64Data = null;
                                            if (imgResponse.candidates?.[0]?.content?.parts) {
                                                for (const part of imgResponse.candidates[0].content.parts) {
                                                    if (part.inlineData) {
                                                        base64Data = part.inlineData.data;
                                                        break;
                                                    }
                                                }
                                            }

                                            if (base64Data) {
                                                const imageUrl = `data:image/png;base64,${base64Data}`;
                                                const newItem: CanvasItem = {
                                                    id: Date.now().toString(),
                                                    type: 'image',
                                                    title: prompt,
                                                    content: imageUrl,
                                                    timestamp: new Date()
                                                };
                                                setCanvasItems(prev => [newItem, ...prev]);
                                                setActiveCanvasId(newItem.id);
                                                addNotification('success', 'Image Generated');
                                                responseResult = { result: "Image generated successfully via Nano Banana." };
                                            } else {
                                                throw new Error("No image data returned.");
                                            }
                                        }

                                        // VIDEO PLAYER
                                        else if (call.name === 'playVideo') {
                                            const query = (call.args as any).query?.toString();
                                            const embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`;
                                            setVideoState({ isActive: true, url: embedUrl, query });
                                            addNotification('success', `Playing ${query}`);
                                            responseResult = { result: `Playing ${query}` };
                                        }

                                        // WORKSPACE CRUD
                                        else if (call.name === 'manageWorkspace') {
                                            const action = (call.args as any).action?.toString();
                                            const itemType = (call.args as any).itemType?.toString() as any;
                                            const title = (call.args as any).title?.toString();
                                            const content = (call.args as any).content?.toString();
                                            const itemId = (call.args as any).itemId?.toString();

                                            let result = '';

                                            if (action === 'create') {
                                                const newItem: CanvasItem = {
                                                    id: Date.now().toString(),
                                                    type: itemType || 'note',
                                                    title: title || 'Untitled',
                                                    content: content || '',
                                                    timestamp: new Date()
                                                };
                                                setCanvasItems(prev => [newItem, ...prev]);
                                                setActiveCanvasId(newItem.id);
                                                result = `Created ${itemType}`;
                                                addNotification('success', `Created ${itemType}`);
                                            } else if (action === 'read') {
                                                const itemsSummary = canvasItemsRef.current.map(i => `ID: ${i.id}, Title: ${i.title}, Type: ${i.type}`).join('\n');
                                                result = itemsSummary || 'Workspace is empty.';
                                            } else if (action === 'update') {
                                                if (itemId) {
                                                    setCanvasItems(prev => prev.map(item => {
                                                        if (item.id === itemId) {
                                                            return { ...item, title: title || item.title, content: content || item.content };
                                                        }
                                                        return item;
                                                    }));
                                                    result = `Updated item ${itemId}`;
                                                    addNotification('success', 'Item Updated');
                                                } else result = "Error: Missing ID";
                                            } else if (action === 'delete') {
                                                if (itemId) {
                                                    setCanvasItems(prev => prev.filter(item => item.id !== itemId));
                                                    if (activeCanvasId === itemId) setActiveCanvasId(null);
                                                    result = `Deleted item ${itemId}`;
                                                    addNotification('success', 'Item Deleted');
                                                } else result = "Error: Missing ID";
                                            }
                                            addLog('system', result);
                                            responseResult = { result };
                                        }

                                        // DOWNLOAD TOOL
                                        else if (call.name === 'downloadItem') {
                                            const itemId = (call.args as any).itemId?.toString();
                                            const item = canvasItemsRef.current.find(i => i.id === itemId);
                                            if (item) {
                                                triggerDownload(item);
                                                responseResult = { result: `Downloaded ${item.title}` };
                                            } else {
                                                responseResult = { result: "Item not found." };
                                            }
                                        }

                                        // CRITICAL: Always send response back to model
                                        sessionPromiseRef.current?.then(session => session.sendToolResponse({
                                            functionResponses: { id: call.id, name: call.name, response: responseResult }
                                        })).catch(() => {});

                                    } catch (toolError: any) {
                                        console.error(`Tool ${call.name} error:`, toolError);
                                        addLog('system', `Error in ${call.name}: ${toolError.message}`);
                                        addNotification('error', `Task failed: ${call.name}`);
                                        
                                        // Still send a response so the model doesn't hang
                                        sessionPromiseRef.current?.then(session => session.sendToolResponse({
                                            functionResponses: { id: call.id, name: call.name, response: { result: `Error executing tool: ${toolError.message}` } }
                                        })).catch(() => {});
                                    }
                                }
                            }
                        } catch (error) {
                            console.error("Error processing message", error);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session Error:', e);
                        // Filter out generic network errors that happen during close
                        if (connectionState === ConnectionState.CONNECTED) {
                             addNotification('error', 'Signal Interrupted');
                        }
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session Closed');
                        if (connectionState === ConnectionState.CONNECTED) {
                            setConnectionState(ConnectionState.DISCONNECTED);
                            addNotification('info', 'Disconnected from server');
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    // Lock Voice to Puck (Energetic Male)
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
                    },
                    systemInstruction,
                    tools,
                },
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (e: any) {
            console.error('Connection failed:', e);
            setConnectionState(ConnectionState.ERROR);
            addLog('system', `Connection failed: ${e.message}`);
            addNotification('error', 'Failed to connect');
        }
    }, [addLog, disconnect, connectionState, logs, canvasItems]);

    const deleteCanvasItem = (id: string) => {
        setCanvasItems(prev => prev.filter(item => item.id !== id));
        if (activeCanvasId === id) setActiveCanvasId(null);
    };

    return {
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
        closeVideo: () => setVideoState({ isActive: false, url: null, query: null }),
        canvasItems,
        activeCanvasId,
        setActiveCanvasId,
        deleteCanvasItem,
        triggerDownload,
        notifications
    };
};
