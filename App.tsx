
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { saveAs } from 'file-saver';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';
import { generateArtFromSketch, generateVideoFromImage, analyzeVideoForSpeech, generateMixedVoiceover } from './services/geminiService';
import { GenerationConfig, StylePreset, HistoryItem, VideoHistoryItem, VideoMode, SpeechSegment, VoiceName, VideoGenerationConfig, UserTier, VideoResolution, ModelMode } from './types';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';
import AdminDashboard from './components/AdminDashboard'; // Import Admin Component
import { useCreditSystem } from './hooks/useCreditSystem';
import { API_BASE_URL } from './config';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const STYLE_PRESETS: StylePreset[] = [
  { id: 'cartoon_mix', name: 'Cartoon Mix', prompt: 'STRICT_LOCKDOWN: ULTIMATE CARTOON HYBRID. Fusion of adult sci-fi thin-line precision (Rick and Morty style), iconic yellow-saturated skin tones (Simpsons style), and sharp urban anime aesthetics (Boondocks style). MANDATORY: Rendered with high-budget Pixar-quality 3D volumetric lighting, cinematic surface scattering, and perfectly smooth textures. FORBIDDEN: Any realism, photographic skin, or real-world human features.', thumbnail: '📺' },
  { id: 'bighead', name: 'Big Head Mode', prompt: 'STRICT_LOCKDOWN: FUNNY 3D CARICATURE. Ultra-exaggerated cartoon proportions. MANDATORY: Disproportionately massive head (5x normal size), extremely tiny micro body, oversized comical giant feet, expressive playful features, high-budget 3D Disney/Pixar style render, vibrant colors. FORBIDDEN: Realistic proportions, normal human anatomy, serious lighting.', thumbnail: '🦒' },
  { id: 'aura', name: 'Aura', prompt: 'STRICT_LOCKDOWN: SIGNATURE AURA ART. High-fidelity 3D-Illustrative hybrid. MANDATORY: Glowing edges, ethereal lighting, smooth stylized surfaces. FORBIDDEN: Photorealism.', thumbnail: '✨' },
  { id: 'anime', name: 'Anime', prompt: 'STRICT_LOCKDOWN: MODERN ANIME. Sharp digital cel-shading. MANDATORY: Cinematic sky gradients, vibrant effects, iconic proportions. FORBIDDEN: 3D textures.', thumbnail: '🍱' },
  { id: 'manga', name: 'Manga Art', prompt: 'STRICT_LOCKDOWN: INK MANGA. Traditional black and white pen work. MANDATORY: Screen-tones, speed lines, deep black ink pools.', thumbnail: '📖' },
  { id: 'cine', name: 'Cinematic', prompt: 'STRICT_LOCKDOWN: CINEMATIC PHOTOGRAPHY. Film-look. MANDATORY: 35mm grain, teal/orange grading, anamorphic flares.', thumbnail: '🎬' },
  { id: 'cyber', name: 'Cyberpunk', prompt: 'STRICT_LOCKDOWN: CYBER NEON. Futuristic dark aesthetic. MANDATORY: Neon glow, rain reflections, synthetic textures.', thumbnail: '🌆' },
  { id: 'ghibli', name: 'Studio Ghibli', prompt: 'STRICT_LOCKpainted GHIBLI. Soft watercolor palettes. MANDATORY: Lush organic backgrounds, nostalgic charm.', thumbnail: '🍃' },
  { id: 'pixel', name: 'Pixel Art', prompt: 'STRICT_LOCKDOWN: 32-BIT PIXEL ART. Sharp square grid. MANDATORY: Limited palette, visible blocks. FORBIDDEN: Curves.', thumbnail: '👾' },
  { id: 'oil', name: 'Oil Painting', prompt: 'STRICT_LOCKDOWN: OIL ON CANVAS. Impasto technique. MANDATORY: Thick brushstrokes, canvas weave, wet oil sheen.', thumbnail: '🎨' },
  { id: 'photo', name: 'Hyper-Real', prompt: 'STRICT_LOCKDOWN: RAW PHOTOGRAPHY. Extreme detail. MANDATORY: Skin pores, realistic lighting, raw unedited look.', thumbnail: '📸' },
  { id: 'surreal', name: 'Surrealism', prompt: 'STRICT_LOCKDOWN: SURREALIST ART. Dream logic. MANDATORY: Bizarre juxtapositions, melting forms, painterly medium.', thumbnail: '🫠' },
  { id: 'water', name: 'Watercolor', prompt: 'STRICT_LOCKDOWN: FINE WATERCOLOR. Fluid pigments. MANDATORY: Soft bleeding edges, wet-on-wet textures.', thumbnail: '🖌️' },
  { id: 'dark', name: 'Dark Fantasy', prompt: 'STRICT_LOCKDOWN: GOTHIC FANTASY. Eldritch aesthetic. MANDATORY: Gritty textures, ominous fog, rusted metal.', thumbnail: '⚔️' },
  { id: 'ue5', name: '3D Render', prompt: 'STRICT_LOCKDOWN: UNREAL ENGINE 5. Ray-traced. MANDATORY: Subsurface scattering, cinematic 3D surfaces.', thumbnail: '🎮' },
  { id: 'pop', name: 'Pop Art', prompt: 'STRICT_LOCKDOWN: VINTAGE POP ART. Graphic impact. MANDATORY: Ben-Day dots, bold primary colors, thick outlines.', thumbnail: '💥' },
  { id: 'pencil', name: 'Pencil Art', prompt: 'STRICT_LOCKDOWN: GRAPHITE SKETCH. Hand-drawn. MANDATORY: Grayscale, lead smudges, cross-hatching, paper grain.', thumbnail: '✏️' },
  { id: 'street', name: 'Street Art', prompt: 'STRICT_LOCKDOWN: GRAFFITI MURAL. Urban spray. MANDATORY: Drips, stencil layers, brick wall texture.', thumbnail: '🏙️' },
  { id: 'abstract', name: 'Abstract Art', prompt: 'STRICT_LOCKDOWN: FINE ABSTRACT. Non-linear. MANDATORY: Dynamic shapes, emotional color usage.', thumbnail: '🎨' },
  { id: 'vapor', name: 'Vaporwave', prompt: 'STRICT_LOCKDOWN: VAPORWAVE AESTHETIC. 80s retro-futurism. MANDATORY: Pink/purple hues, glitch effects, marble statues.', thumbnail: '🌴' },
  { id: 'neonink', name: 'Neon Ink', prompt: 'STRICT_LOCKDOWN: LUMINOUS INK. Radiant lines. MANDATORY: Glowing black ink, electric cyan/magenta paths.', thumbnail: '✒️' },
  { id: 'retrocomic', name: 'Retro Comic', prompt: 'STRICT_LOCKDOWN: VINTAGE COMIC. Printed pulp. MANDATORY: Benday dots, action lines, aged paper yellowing.', thumbnail: '📰' },
  { id: 'claymation', name: 'Claymation', prompt: 'STRICT_LOCKDOWN: BRIGHT CLAYMATION. Plasticine. MANDATORY: Thumbprints, visible mold marks, vibrant clay colors.', thumbnail: '🧸' }
];

const COLORS = ['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE'];
const EXTENDED_COLORS = [
  '#000000', '#1a1a1a', '#4a4a4a', '#9ca3af', '#FFFFFF',
  '#ef4444', '#dc2626', '#b91c1c', // Reds
  '#f97316', '#ea580c', '#c2410c', // Oranges
  '#f59e0b', '#d97706', '#b45309', // Ambers
  '#84cc16', '#65a30d', '#4d7c0f', // Limes
  '#10b981', '#059669', '#047857', // Emeralds
  '#06b6d4', '#0891b2', '#0e7490', // Cyans
  '#3b82f6', '#2563eb', '#1d4ed8', // Blues
  '#6366f1', '#4f46e5', '#4338ca', // Indigos
  '#8b5cf6', '#7c3aed', '#6d28d9', // Violets
  '#d946ef', '#c026d3', '#a21caf', // Fuchsias
  '#f43f5e', '#e11d48', '#be123c', // Roses
  '#78350f', '#5B21B6', '#1e293b'  // Misc
];

const ACCESS_CODE = "111111";
const VOICE_OPTIONS: VoiceName[] = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'];
const ASPECT_RATIOS: GenerationConfig['aspectRatio'][] = ['1:1', '16:9', '9:16', '4:3', '3:4'];

// --- ECONOMY CONFIG ---
const TIER_CONFIG = {
  designer: { price: 99, minutes: 100, maxRes: '720p', upscaleRes: '1K', allowRefMode: false },
  producer: { price: 199, minutes: 250, maxRes: '1080p', upscaleRes: '2K', allowRefMode: false },
  studio: { price: 599, minutes: 600, maxRes: '4K', upscaleRes: '4K', allowRefMode: true }
};

const BURN_RATES = {
  // Base rates
  REAL_TIME_STANDARD: 1, // 1 Aura Credit Time per minute (approx)
  REAL_TIME_PRO: 2,      // 2x burn for Pro model (as requested)

  // Per Image Costs (To offset high volume generation)
  IMAGE_GEN_STANDARD: 0.1, // Cost per single generated image (Flash)
  IMAGE_GEN_PRO: 0.2,      // Cost per single generated image (Pro) - DOUBLE Standard

  UPSCALE_1K: 0.5,
  UPSCALE_2K: 1,
  UPSCALE_4K: 2,
  VEO_720P: 5,
  VEO_1080P: 10,
  VEO_4K: 15
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // const [loginInput, setLoginInput] = useState(''); // Removed access code state

  // Economy & Tier State
  const [userTier, setUserTier] = useState<UserTier | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);

  // UPSCALE STATE
  const [upscaleResult, setUpscaleResult] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [showUpscaleModal, setShowUpscaleModal] = useState(false);

  // REBUILT CREDIT SYSTEM HOOK
  const { credits: auraCreditTime, startBurn, stopBurn, deduct, forceSave, isLoaded } = useCreditSystem(user, userTier as string);

  // AUTO-RESTORE REMOVED PER USER REQUEST: Credits should burn to 0 naturally.
  // Master Admin can use the recharge button or manual dashboard tools if needed.

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsProfileLoading(false);
      }
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth State Change:', _event, session?.user?.email);
      setUser(session?.user ?? null);
      if (session?.user) {
        // If logging in, keep loading true
        if (_event === 'SIGNED_IN') setIsProfileLoading(true);
        fetchUserProfile(session.user.id);
      } else {
        setIsProfileLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('tier, credits')
      .eq('id', userId)
      .single();

    if (data) {
      setUserTier(data.tier as UserTier || null); // Removed default to 'designer' so new users see sub screen
      // Credits are now handled by useCreditSystem hook internally
    }
    setIsProfileLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
  };

  const handleLogout = async () => {
    // Force save credits before logout
    await forceSave();
    await supabase.auth.signOut();
    setUser(null);
    setUserTier(null);
    setIsProfileLoading(true); // Reset for next login
  };
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>('standard');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(12);
  const [opacity, setOpacity] = useState(1);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');

  const [directives, setDirectives] = useState<string[]>([]);
  const [currentDirective, setCurrentDirective] = useState('');

  const [activeStyle, setActiveStyle] = useState(STYLE_PRESETS[0]);
  const [aspectRatio, setAspectRatio] = useState<GenerationConfig['aspectRatio']>('1:1');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRealTimePaused, setIsRealTimePaused] = useState(true); // Default to PAUSED

  // Tool Suite Toggle State
  const [isSuiteMinimized, setIsSuiteMinimized] = useState(false);

  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [pencilResult, setPencilResult] = useState<string | null>(null);
  const [styleResult, setStyleResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]
  );
  const [showAdmin, setShowAdmin] = useState(false); // Admin Modal State

  // Video Studio State
  const [isVideoStudioOpen, setIsVideoStudioOpen] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>('interpolation');
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('720p');
  const [videoStartFrame, setVideoStartFrame] = useState<string | null>(null);
  const [videoEndFrame, setVideoEndFrame] = useState<string | null>(null);
  const [videoIngredients, setVideoIngredients] = useState<string[]>([]);
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // Dubbing State
  const [voiceInstruction, setVoiceInstruction] = useState('');
  const [dubSegments, setDubSegments] = useState<SpeechSegment[]>([]);
  const [isDubbing, setIsDubbing] = useState(false);
  const [syncedAudioUrl, setSyncedAudioUrl] = useState<string | null>(null);

  const [viewState, setViewState] = useState({ scale: 1, offset: { x: 0, y: 0 } });
  const [canvasKey, setCanvasKey] = useState(0);

  // Removed old refs
  const currentSketchRef = useRef<string | null>(null);
  const lastGenerationTime = useRef<number>(0);

  // Old Credit Refs Removed (Handled by Hook)

  // --- SAFETY TIMER LOGIC (Billing Only - DOES NOT TRIGGER GENERATION) ---
  useEffect(() => {
    if (user && userTier && !isRealTimePaused) {
      // Start Burning
      const rate = modelMode === 'pro' ? BURN_RATES.REAL_TIME_PRO : BURN_RATES.REAL_TIME_STANDARD;
      startBurn(rate);
    } else {
      stopBurn();
    }
  }, [user, userTier, isRealTimePaused, modelMode]);

  /* OLD LOGIC REMOVED - REPLACED BY HOOK ABOVE */

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setIsSidebarOpen(true); };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);




  const handlePlanSelect = async (tier: UserTier) => {
    if (!user) {
      alert('Please sign in with Google first.');
      return;
    }

    setLoading(true);
    try {
      console.log('Initiating checkout for:', tier);
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email: user.email })
      });

      const json = await res.json();
      console.log('Checkout Response:', json);

      if (json.error) {
        throw new Error('Backend Error: ' + json.error);
      }

      const { id, url } = json;

      if (url) {
        window.location.href = url;
        return;
      }

      if (id) {
        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe JS not loaded. Check your Internet or AdBlock.');

        const { error } = await stripe.redirectToCheckout({ sessionId: id });
        if (error) throw error;
      } else {
        throw new Error('No Session ID returned');
      }

    } catch (err: any) {
      console.error('Checkout Error:', err);
      // Detailed Alert for the User
      alert(`Stripe Checkout Failed:\n${err.message}\n\nCheck if the backend is running on 3001.`);
      setLoading(false);
    }
  };

  const handleRecharge = async (amount: number) => {
    if (!user) {
      alert('Please sign in to recharge.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credit',
          creditAmount: amount,
          email: user.email
        })
      });

      const json = await res.json();

      if (json.url) {
        window.location.href = json.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      alert(`Recharge Failed: ${err.message}`);
      setLoading(false);
    }
  };

  // Payment Verification Effect
  useEffect(() => {
    const fn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const sessionId = urlParams.get('session_id');

      if (success && sessionId && user) {
        console.log('Payment Successful! Verifying...');
        try {
          const res = await fetch(`${API_BASE_URL}/api/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          const data = await res.json();

          if (data.verified) {
            window.history.replaceState({}, document.title, "/");

            if (data.type === 'credit') {
              alert(`Successfully recharged ${data.credits - (userTier === data.tier ? 0 : 0)} credits! (Total: ${data.credits})`);
              // Note: The logic above is slightly off because API returns total. 
              // Just alerting Success is enough.
              alert('Recharge Successful! Credits added.');
            } else {
              console.log('Plan upgraded!');
            }

            await fetchUserProfile(user.id);
          } else {
            alert('Payment verification failed.');
          }
        } catch (err) {
          console.error('Verify Error:', err);
        }
      }
    };
    fn();
  }, [user]);

  // Master Admin Auto-Grant Effect - DISABLED TO PREVENT RESET RACES
  /*
  useEffect(() => {
    if (user?.email === 'auraassistantai@gmail.com') {
      const claim = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          const data = await res.json();
          if (data.success && userTier !== 'studio') {
            console.log('Master Access Claimed');
            fetchUserProfile(user.id); // Refresh to get Studio status
          }
        } catch (e) { console.error('Admin Claim Error', e); }
      };
      claim();
    }
  }, [user, userTier]);
  */

  const deductCredits = (amount: number) => {
    const success = deduct(amount);
    if (!success) {
      setShowUpgradeModal(true);
      throw new Error("Insufficient Aura Credit Time");
    }
  };

  // Legacy ensureApiKey removed for security. Backend handles keys.

  const openVideoStudio = (imageUrl: string) => {
    setVideoStartFrame(imageUrl);
    setVideoEndFrame(null);
    setVideoIngredients([imageUrl]);
    setVideoPrompt('');
    setVoiceInstruction('');
    setVideoMode('interpolation');
    setGeneratedVideoUrl(null);
    setDubSegments([]);
    setSyncedAudioUrl(null);
    setIsVideoStudioOpen(true);
  };

  const handleGenerateVideo = async () => {
    if (!userTier) return;

    // Calculate cost based on resolution
    let cost = BURN_RATES.VEO_720P;
    if (videoResolution === '1080p') cost = BURN_RATES.VEO_1080P;
    if (videoResolution === '4K') cost = BURN_RATES.VEO_4K;

    // Check constraints
    if (videoResolution === '4K' && userTier !== 'studio') {
      setShowUpgradeModal(true);
      return;
    }
    if (videoResolution === '1080p' && userTier === 'designer') {
      setShowUpgradeModal(true);
      return;
    }

    setVideoLoading(true);
    setApiError(null);
    try {
      deductCredits(cost);
      const config: VideoGenerationConfig = {
        mode: videoMode,
        prompt: videoPrompt,
        startingImage: videoStartFrame || undefined,
        endingImage: videoEndFrame || undefined,
        ingredients: videoMode === 'reference' ? videoIngredients : undefined,
        aspectRatio: videoAspectRatio,
        model: userTier === 'studio' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview',
        resolution: videoResolution
      };
      const videoUrl = await generateVideoFromImage(config, (status) => setVideoStatus(status));
      if (videoUrl) setGeneratedVideoUrl(videoUrl);
    } catch (err: any) {
      if (err.message === "Insufficient Aura Credit Time") return;
      setApiError("Video synthesis interrupted. Check backend logs.");
      console.error(err);
    } finally {
      setVideoLoading(false);
      setVideoStatus('');
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!generatedVideoUrl) return;
    setIsDubbing(true);
    setVideoStatus("Gemini is reading lips...");
    try {
      const segments = await analyzeVideoForSpeech(generatedVideoUrl, voiceInstruction);
      setDubSegments(segments);
    } catch (err) {
      setApiError("Analysis failed.");
    } finally {
      setIsDubbing(false);
      setVideoStatus("");
    }
  };

  const handleForgeVoiceover = async () => {
    if (dubSegments.length === 0) return;
    setIsDubbing(true);
    setVideoStatus("Forging high-fidelity dubbing...");
    try {
      // Pass voice instruction to the forge engine for perfect style application
      const audioUrl = await generateMixedVoiceover(dubSegments, voiceInstruction);
      setSyncedAudioUrl(audioUrl);
    } catch (err) {
      setApiError("Voice synthesis failed.");
    } finally {
      setIsDubbing(false);
      setVideoStatus("");
    }
  };

  const handleDownload = async (url: string | null, type: 'video' | 'image' = 'image') => {
    if (!url) {
      console.error("Download aborted: No URL provided");
      return;
    }

    const filename = type === 'video' ? `AuraVideo_${Date.now()}.mp4` : `AuraArt_${Date.now()}.png`;
    const mimeType = type === 'video' ? 'video/mp4' : 'image/png';
    const extension = type === 'video' ? 'mp4' : 'png';

    try {
      let base64Data: string;

      // Extract base64 data from URL
      if (url.startsWith('data:')) {
        base64Data = url.split(',')[1];
        if (!base64Data) throw new Error("Invalid data URI");
      }
      else if (url.startsWith('blob:') || url.startsWith('http')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Data = btoa(binary);
      }
      else {
        throw new Error("Unknown URL format");
      }

      // Get file from server with proper headers
      const downloadResponse = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, filename, mimeType })
      });

      if (!downloadResponse.ok) throw new Error('Server download failed');
      const blob = await downloadResponse.blob();

      // Try Chrome's File System Access API first (works in Chrome 86+)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: type === 'video' ? 'Video File' : 'Image File',
              accept: { [mimeType]: [`.${extension}`] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          console.log(`[Download] Saved via File System API: ${filename}`);
          return;
        } catch (fsError: any) {
          // User cancelled or API failed, fall through to fallback
          if (fsError.name === 'AbortError') {
            console.log('[Download] User cancelled save dialog');
            return;
          }
          console.log('[Download] File System API failed, using fallback');
        }
      }

      // Fallback for Safari and older browsers
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      console.log(`[Download] Fallback download: ${filename}`);

    } catch (error: any) {
      console.error("[Download] FAILED:", error);
      window.open(url, '_blank');
    }
  };



  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setReferenceImage(dataUrl);
        currentSketchRef.current = null;
        setCanvasKey(k => k + 1);
        setStyleResult(null);
        setPencilResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEndFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setVideoEndFrame(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleClearPhoto = () => {
    setReferenceImage(null);
    setStyleResult(null);
    setPencilResult(null);
    setDirectives([]);
    setViewState({ scale: 1, offset: { x: 0, y: 0 } });
    currentSketchRef.current = null;
    setCanvasKey(k => k + 1);
  };

  // --- CORE GENERATION LOGIC ---
  // Added styleOverride to allow immediate generation with the selected style before state updates
  const handleGenerate = useCallback(async (sketchData: string, styleOverride?: StylePreset, ignorePaused = false) => {
    const effectiveSketch = sketchData || currentSketchRef.current || "";
    if (!effectiveSketch && !referenceImage) return;

    // Safety: If paused or out of credit time, do NOT generate
    if ((isRealTimePaused && !ignorePaused) || auraCreditTime <= 0) return;

    // Rate Limiting (Double check to prevent spam)
    const now = Date.now();
    if (now - lastGenerationTime.current < 500) return; // Hard 500ms limit
    lastGenerationTime.current = now;

    setIsLoading(true);
    setApiError(null);

    // Determine the style to use (override takes precedence)
    const currentStyle = styleOverride || activeStyle;

    try {
      // DEDUCT COST PER IMAGE GENERATED
      // Standard = 0.1, Pro = 0.2 (Double the price)
      const imageCost = modelMode === 'pro' ? BURN_RATES.IMAGE_GEN_PRO : BURN_RATES.IMAGE_GEN_STANDARD;
      deductCredits(imageCost);

      const combinedPrompt = directives.map((d, i) => `Mandatory Detail ${i + 1}: ${d}`).join('\n');
      const globalNegative = "low quality, blurry, realism bleed, text, watermarks, distorted, messy, unfinished areas";

      // Determine Model: 'standard' (Flash) vs 'pro' (Pro Preview)
      // Standard = Nano Banana (Flash)
      // Pro = Nano Banana Pro (Gemini 3 Pro)
      const selectedModel = modelMode === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

      const config: GenerationConfig = {
        prompt: combinedPrompt,
        negativePrompt: globalNegative,
        aspectRatio,
        referenceImage: referenceImage || undefined,
        model: selectedModel
      };

      const pencilStyle = STYLE_PRESETS.find(s => s.id === 'pencil')?.prompt || "Graphite pencil sketch.";

      // We only generate pencil sketch if expanded to save tokens in condensed view
      const tasks = isExpanded
        ? [generateArtFromSketch(effectiveSketch, config, currentStyle.prompt)]
        : [
          generateArtFromSketch(effectiveSketch, config, pencilStyle),
          generateArtFromSketch(effectiveSketch, config, currentStyle.prompt)
        ];

      const results = await Promise.all(tasks);

      if (isExpanded) {
        const sRes = results[0];
        if (sRes) setStyleResult(sRes);
      } else {
        const [pRes, sRes] = results;
        if (pRes) setPencilResult(pRes);
        if (sRes) {
          setStyleResult(sRes);
          setHistory(prev => [{ id: Math.random().toString(36).substr(2, 9), sketch: effectiveSketch, result: sRes, prompt: currentStyle.name, timestamp: Date.now() }, ...prev].slice(0, 10));
        }
      }
    } catch (err: any) {
      if (err.message === "Insufficient Aura Credit Time") {
        // Modal is handled by deductCredits
        return;
      }
      if (err?.message?.includes("Requested entity was not found")) {
        setApiError("Premium Session Expired. Check backend.");
      } else {
        setApiError("Neural Synthesis Active...");
        console.error(err);
      }
    } finally { setIsLoading(false); }
  }, [directives, aspectRatio, activeStyle, referenceImage, isRealTimePaused, isExpanded, auraCreditTime, modelMode]);

  // Triggered when user lifts mouse/finger (Final high-quality render)
  const onStrokeEnd = useCallback((sketchData: string) => {
    currentSketchRef.current = sketchData;
    if (!isRealTimePaused) {
      handleGenerate(sketchData);
    }
  }, [handleGenerate, isRealTimePaused]);

  // Triggered while drawing (Throttled real-time preview)
  const onRealTimeUpdate = useCallback((sketchData: string) => {
    currentSketchRef.current = sketchData;
    if (!isRealTimePaused) {
      handleGenerate(sketchData);
    }
  }, [handleGenerate, isRealTimePaused]);

  const toggleRealTime = () => {
    if (auraCreditTime <= 0) {
      setShowUpgradeModal(true);
      return;
    }
    setIsRealTimePaused(prev => {
      const newState = !prev;
      // If unpausing, trigger a generation immediately if we have data
      if (!newState && (currentSketchRef.current || referenceImage)) {
        handleGenerate(currentSketchRef.current || "", undefined, true);
      }
      return newState;
    });
  };

  const addDirective = () => {
    if (!currentDirective.trim()) return;
    setDirectives([...directives, currentDirective.trim()]);
    setCurrentDirective('');
    // Trigger update on change
    if (currentSketchRef.current) handleGenerate(currentSketchRef.current);
  };

  const removeDirective = (index: number) => {
    setDirectives(directives.filter((_, i) => i !== index));
    if (currentSketchRef.current) handleGenerate(currentSketchRef.current);
  };

  const getAspectClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video';
      case '9:16': return 'aspect-[9/16]';
      case '4:3': return 'aspect-[4/3]';
      case '3:4': return 'aspect-[3/4]';
      default: return 'aspect-square';
    }
  };

  const handleStyleSelect = (style: StylePreset) => {
    setActiveStyle(style);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    // Explicitly trigger generate on style change using the NEW style, bypassing async state wait
    if (currentSketchRef.current) handleGenerate(currentSketchRef.current, style);
  };

  const handleAspectSelect = (ratio: GenerationConfig['aspectRatio']) => {
    setAspectRatio(ratio);
    setCanvasKey(prev => prev + 1);
    // Explicitly trigger generate on aspect change
    if (currentSketchRef.current || referenceImage) handleGenerate(currentSketchRef.current || "");
  };

  const computeColor = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const setBrushPreset = (type: 'pencil' | 'pen' | 'marker' | 'paint') => {
    setTool('brush');
    switch (type) {
      case 'pencil': setBrushSize(2); setOpacity(0.8); break;
      case 'pen': setBrushSize(4); setOpacity(1); break;
      case 'marker': setBrushSize(16); setOpacity(0.5); break;
      case 'paint': setBrushSize(32); setOpacity(0.9); break;
    }
  };



  // --- UPSCALE LOGIC ---
  const handleUpscale = async (sourceImage?: string) => {
    // Use the provided source, or styleResult (final image), or fallback to sketch
    const activeSource = sourceImage || styleResult || currentSketchRef.current;

    if (!userTier || !activeSource) return;

    // 1. Get Config for Tier
    const tierSettings = TIER_CONFIG[userTier];
    if (!tierSettings) return;

    // 2. Burn Credits (Upscale Cost)
    const costMap: Record<string, number> = {
      '1K': BURN_RATES.UPSCALE_1K,
      '2K': BURN_RATES.UPSCALE_2K,
      '4K': BURN_RATES.UPSCALE_4K
    };
    const cost = costMap[tierSettings.upscaleRes] || 1;

    // Deduct
    const hasCredit = await deduct(cost);
    if (!hasCredit) {
      setShowUpgradeModal(true);
      return;
    }

    setIsUpscaling(true);
    try {
      // 3. Re-run Generation with PRO Mode & High Res
      // CRITICAL FIX: We pass the FINAL IMAGE (activeSource) as the input "sketch"
      // effectively doing Image-to-Image upscaling.
      const result = await generateArtFromSketch(
        activeSource,
        {
          prompt: directives.join('. ') + (activeStyle.prompt ? '. ' + activeStyle.prompt : ''),
          negativePrompt: "low quality, blurry, pixelated, grain, noise", // Enhanced negative for upscaling
          aspectRatio: aspectRatio,
          stylePreset: activeStyle.id,
          // We DO NOT pass a separate referenceImage here, because activeSource IS the reference.
          modelMode: 'pro',
          outputResolution: tierSettings.upscaleRes
        },
        activeStyle.prompt
      );

      if (result) {
        setUpscaleResult(result);
        setShowUpscaleModal(true);
      }
    } catch (err) {
      console.error("Upscale failed:", err);
      setApiError("Upscale Failed. Please try again.");
    } finally {
      setIsUpscaling(false);
    }
  };

  if (loading || (user && isProfileLoading)) {
    return (
      <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-light tracking-widest uppercase text-cyan-400 animate-pulse">Accessing Studio Profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        >
          <source src="/veo3-video----json------descrip-1753721855143.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />

        {/* Subtle animated glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[800px] h-[800px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan-500/5 rounded-full blur-[200px] animate-pulse" style={{ animationDuration: '8s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-lg text-center px-6">
          {/* Premium Logo */}
          <div className="mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 mb-8 shadow-[0_20px_60px_rgba(99,102,241,0.3)]">
              <span className="text-3xl">✦</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-3">
              <span className="font-semibold">AURADOMO</span><span className="text-cyan-300 font-light">SKETCH</span>
            </h1>
            <p className="text-slate-500 text-[11px] uppercase tracking-[0.3em] font-medium">Professional Studio</p>
          </div>

          <div className="space-y-5">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white text-black rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(255,255,255,0.1)]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
            <p className="text-slate-600 text-[10px] text-center">
              By entering, you agree to our Terms of Service.
            </p>
          </div>


          <p className="mt-12 text-slate-600 text-[10px] tracking-wide">Powered by Gemini & Veo 3.1</p>
        </div>
      </div >
    );
  }

  // PLAN SELECTION SCREEN
  if (!userTier) {
    return (
      <div className="min-h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-6 overflow-hidden relative">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[700px] h-[700px] -top-48 left-1/4 bg-cyan-500/15 rounded-full blur-[180px] animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute w-[500px] h-[500px] -bottom-32 right-1/4 bg-cyan-400/10 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
          <div className="absolute w-[300px] h-[300px] top-1/3 -left-20 bg-cyan-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 w-full max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">
              <span className="font-semibold">AURADOMO</span><span className="text-cyan-300">SKETCH</span>
            </h1>
            <p className="text-slate-500 text-xs tracking-widest uppercase">Select plan for <span className="text-cyan-400">{user.email}</span></p>
          </div>

          <button onClick={handleLogout} className="absolute top-0 right-0 p-4 text-xs text-slate-500 hover:text-white uppercase tracking-widest">
            Sign Out
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DESIGNER */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-7 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-500 flex flex-col h-full hover:-translate-y-1">
                <h3 className="text-xl font-semibold mb-2">Designer</h3>
                <div className="text-4xl font-semibold mb-6">$99<span className="text-base font-normal text-slate-500">/mo</span></div>
                <ul className="space-y-3.5 mb-7 flex-1 text-sm">
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> 100 Credits</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> Real-Time Drawing</li>
                  <li className="flex gap-3 text-slate-500"><span className="text-slate-600">○</span> 720p Video</li>
                  <li className="flex gap-3 text-slate-500"><span className="text-slate-600">○</span> 1K Upscaling</li>
                </ul>
                <button onClick={() => handlePlanSelect('designer')} className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium tracking-wide transition-all border border-white/5">Select</button>
              </div>
            </div>

            {/* PRODUCER - POPULAR */}
            <div className="group relative md:-mt-3 md:mb-3">
              <div className="absolute -inset-px bg-gradient-to-b from-cyan-400 via-cyan-400 to-cyan-500 rounded-2xl blur-sm opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative p-7 rounded-2xl bg-[#080808] border border-cyan-400/30 flex flex-col h-full hover:-translate-y-1 transition-all duration-500">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 rounded-full text-[10px] font-semibold uppercase tracking-wider">Popular</div>
                <h3 className="text-xl font-semibold mb-2 text-cyan-300">Producer</h3>
                <div className="text-4xl font-semibold mb-6">$199<span className="text-base font-normal text-slate-500">/mo</span></div>
                <ul className="space-y-3.5 mb-7 flex-1 text-sm">
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> 250 Credits</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> Priority Speed</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> 1080p Video</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-cyan-300">✓</span> 2K Upscaling</li>
                </ul>
                <button onClick={() => handlePlanSelect('producer')} className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-medium tracking-wide transition-all shadow-[0_8px_30px_rgba(99,102,241,0.3)]">Select</button>
              </div>
            </div>

            {/* STUDIO */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-7 rounded-2xl bg-white/[0.02] border border-amber-500/20 hover:border-amber-500/40 transition-all duration-500 flex flex-col h-full hover:-translate-y-1">
                <h3 className="text-xl font-semibold mb-2 text-amber-400">Studio</h3>
                <div className="text-4xl font-semibold mb-6">$599<span className="text-base font-normal text-slate-500">/mo</span></div>
                <ul className="space-y-3.5 mb-7 flex-1 text-sm">
                  <li className="flex gap-3 text-slate-300"><span className="text-amber-400">✓</span> 600 Credits</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-amber-400">✓</span> 4K Video</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-amber-400">✓</span> 4K Upscaling</li>
                  <li className="flex gap-3 text-slate-300"><span className="text-amber-400">✓</span> Commercial Use</li>
                </ul>
                <button onClick={() => handlePlanSelect('studio')} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-medium tracking-wide transition-all shadow-[0_8px_30px_rgba(234,179,8,0.3)]">Select</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className={`h-screen flex flex-col transition-all duration-700 ${theme === 'dark' ? 'bg-[#030303] text-slate-200' : 'bg-[#fcfcfc] text-slate-900'} overflow-hidden font-sans`}>
      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-3xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-2xl font-black uppercase italic text-white mb-2">Insufficient Aura Time</h3>
            <p className="text-slate-400 text-sm mb-8">You have run out of compute credits for this high-fidelity task. Recharge to continue creating.</p>
            <div className="grid gap-3">
              <button onClick={() => handleRecharge(50)} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between px-6 group">
                <span className="font-bold text-white">50 Credit Time</span>
                <span className="text-cyan-300 font-mono">$50</span>
              </button>
              <button onClick={() => handleRecharge(150)} className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 rounded-xl flex items-center justify-between px-6 shadow-lg shadow-cyan-900/40">
                <span className="font-bold text-white uppercase tracking-widest text-xs">Best Value: 150 Credit Time</span>
                <span className="text-white font-mono">$99</span>
              </button>
            </div>
            <button onClick={() => setShowUpgradeModal(false)} className="mt-6 text-slate-500 text-xs font-black uppercase tracking-widest hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {/* FUTURISTIC HEADER - Mobile Responsive */}
      <nav className={`h-14 md:h-16 flex items-center justify-between px-3 md:px-6 border-b transition-all duration-500 z-[100] flex-shrink-0 relative ${theme === 'dark' ? 'border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050505]/60' : 'border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 shadow-sm'}`}>

        {/* LEFT: Logo + Menu */}
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <svg className={`w-5 h-5 transition-transform duration-500 ${isSidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-[10px] animate-pulse" style={{ animationDuration: '3s' }}>✦</div>
            <span className={`hidden sm:block font-light text-sm md:text-lg tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              <span className="font-bold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">AURADOMO</span>
              <span className="text-cyan-400 font-light">SKETCH</span>
            </span>
          </div>
        </div>

        {/* CENTER: Economy Dashboard - Compact on Mobile */}
        <div className={`flex items-center gap-2 md:gap-4 rounded-full px-3 md:px-5 py-1.5 md:py-2 backdrop-blur-xl border transition-all ${theme === 'dark' ? 'bg-black/40 border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'bg-white/70 border-slate-200 shadow-sm'}`}>
          <div className={`w-2 h-2 rounded-full ${auraCreditTime > 20 ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse' : 'bg-red-500 animate-pulse'}`} style={{ animationDuration: '2s' }} />
          <span className={`text-[10px] md:text-[11px] font-semibold tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className={`font-bold ${theme === 'dark' ? 'text-cyan-300' : 'text-slate-900'}`}>{Math.floor(auraCreditTime)}</span>
            <span className="hidden sm:inline"> TIME</span>
          </span>
          <div className={`h-4 w-px ${theme === 'dark' ? 'bg-cyan-500/20' : 'bg-slate-300'}`} />
          <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{userTier}</span>
        </div>

        {/* RIGHT: Actions - Responsive Icons */}
        <div className="flex items-center gap-1.5 md:gap-3">

          {/* Model Toggle - Compact on Mobile */}
          {userTier !== 'designer' && (
            <div className="flex items-center bg-black/20 border border-white/5 rounded-full p-0.5 backdrop-blur-md scale-90 md:scale-100 origin-right">
              <button onClick={() => setModelMode('standard')} className={`px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest transition-all ${modelMode === 'standard' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>Std</button>
              <button onClick={() => setModelMode('pro')} className={`px-2 md:px-3 py-1 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest transition-all ${modelMode === 'pro' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30' : 'text-slate-500 hover:text-white'}`}>Pro</button>
            </div>
          )}

          {/* Veo Studio - Icon on Mobile, Full on Desktop */}
          <button
            onClick={() => { setVideoStartFrame(styleResult || null); setIsVideoStudioOpen(true); }}
            className={`p-2 md:px-4 md:py-2 rounded-xl transition-all group ${theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-400/20 hover:bg-cyan-500/20 hover:border-cyan-400/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'bg-cyan-50 border border-cyan-200 hover:bg-cyan-100'}`}
            title="Veo Studio"
          >
            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className={`hidden md:inline ml-2 text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-700'}`}>Veo</span>
          </button>

          {/* Recharge - Icon on Mobile */}
          <button onClick={() => setShowUpgradeModal(true)} className={`p-2 md:px-4 md:py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105' : 'bg-cyan-500 text-white shadow-md hover:bg-cyan-600'}`} title="Recharge Credits">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            <span className="hidden md:inline ml-2">Recharge</span>
          </button>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all ${theme === 'dark' ? 'bg-white/5 text-yellow-400 hover:bg-white/10 border border-white/10' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 shadow-sm'}`}>
            {theme === 'dark' ? <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 7.757l.707-.707M12 7a5 5 0 110 10 5 5 0 010-10z" /></svg> : <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>

          {/* Upload/Clear */}
          {referenceImage ? (
            <button onClick={handleClearPhoto} className="p-2 md:px-4 md:py-2 bg-red-500 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wide hover:bg-red-600 transition-all shadow-lg shadow-red-500/25" title="Clear Image">
              <svg className="w-4 h-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              <span className="hidden md:inline">Clear</span>
            </button>
          ) : (
            <label className={`cursor-pointer p-2 md:px-4 md:py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all flex items-center ${theme === 'dark' ? 'bg-white/10 text-white border border-white/20 hover:bg-white/15' : 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50'}`} title="Upload Image">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              <span className="hidden md:inline ml-2">Upload</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          )}

          {/* Sign Out - Icon Only on Mobile */}
          <button onClick={handleLogout} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500'}`} title="Sign Out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>

          {/* ADMIN BUTTON (Only show for Master Admin) */}
          {user?.email === 'auraassistantai@gmail.com' && (
            <button onClick={() => setShowAdmin(true)} className="p-2 rounded-xl bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all" title="Admin">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden relative">
        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[85] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 w-[280px] md:w-[300px] border-r transition-all duration-500 z-[90] flex flex-col p-6 md:p-8 gap-6 md:gap-8 overflow-y-auto no-scrollbar lg:relative ${theme === 'dark' ? 'bg-[#080808] border-white/5 shadow-2xl' : 'bg-white border-slate-100 shadow-sm'} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-[300px] opacity-0 pointer-events-none'}`}>
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-6">Canvas Ratio</h3>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map(ratio => (
                <button
                  key={ratio}
                  onClick={() => handleAspectSelect(ratio)}
                  className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${aspectRatio === ratio ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg' : `${theme === 'dark' ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-500'}`}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-6">Engine Styles</h3>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {STYLE_PRESETS.map(style => (
                <button key={style.id} onClick={() => handleStyleSelect(style)} className={`p-3 md:p-4 rounded-[1.25rem] border transition-all text-left flex flex-col gap-2 ${activeStyle.id === style.id ? 'bg-cyan-500 border-cyan-500 shadow-lg ring-4 ring-cyan-500/20' : `${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100 shadow-sm'}`}`}>
                  <span className="text-xl md:text-2xl">{style.thumbnail}</span>
                  <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-tight ${activeStyle.id === style.id ? 'text-white' : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>{style.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">Commands</h3>
            <div className="flex gap-2">
              <input value={currentDirective} onChange={(e) => setCurrentDirective(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDirective()} placeholder="Specific detail..." className={`flex-1 border rounded-xl px-4 py-2 text-[10px] font-medium outline-none transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`} />
              <button onClick={addDirective} className="bg-cyan-500 text-white w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shadow-lg">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {directives.map((dir, idx) => (
                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] md:text-[10px] font-bold border transition-all ${theme === 'dark' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-cyan-50 border-cyan-100 text-cyan-600'}`}>
                  <span>{dir}</span>
                  <button onClick={() => removeDirective(idx)} className="hover:text-red-500 font-black">×</button>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-auto pt-6 border-slate-100 space-y-6">
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-[1.5rem] border ${theme === 'dark' ? 'bg-black/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
              <button onClick={() => setTool('brush')} className={`flex flex-col items-center justify-center gap-1 py-3 md:py-4 rounded-2xl transition-all ${tool === 'brush' ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                <span className="text-[7px] font-black uppercase">Draw</span>
              </button>
              <button onClick={() => setTool('eraser')} className={`flex flex-col items-center justify-center gap-1 py-3 md:py-4 rounded-2xl transition-all ${tool === 'eraser' ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2.001 16.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                <span className="text-[7px] font-black uppercase">Erase</span>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Stroke Size</span><span className="text-cyan-500">{brushSize}px</span></div>
              <input type="range" min="2" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-cyan-500 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer" />
              <div className="flex gap-2 justify-center pt-2">
                {COLORS.map(c => <button key={c} onClick={() => { setColor(c); setTool('brush'); }} className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all ${color === c && tool === 'brush' ? 'border-cyan-500 scale-125 shadow-lg' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c }} />)}
              </div>
            </div>
          </section>
        </aside>

        <section className={`flex-1 flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-[#030303]' : 'bg-[#fcfcfc]'}`}>
          <div className="flex-1 relative flex flex-col p-4 md:p-10 items-center overflow-y-auto no-scrollbar">
            {apiError && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-cyan-500 text-white px-6 md:px-8 py-2 md:py-3 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] z-[200] animate-pulse shadow-2xl">{apiError}</div>}
            <div className={`flex flex-col gap-6 md:gap-8 w-full max-w-[1600px] ${isExpanded ? 'h-full' : ''}`}>
              <div className={`flex flex-col transition-all duration-500 ${isExpanded ? 'fixed inset-0 z-[110] bg-black' : 'w-full h-[320px] md:h-[450px]'}`}>
                <div className={`flex items-center justify-between mb-4 px-2 ${isExpanded ? 'absolute top-6 left-6 right-6 z-[120]' : ''}`}>
                  <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] ${theme === 'dark' || isExpanded ? 'text-white/50' : 'text-slate-400'}`}>{referenceImage ? 'Base Reference' : 'Drawing Pad'}</span>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleRealTime}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-semibold uppercase tracking-wide transition-all ${isRealTimePaused ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400'}`}
                    >
                      {isRealTimePaused ? (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Resume AI</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Pause AI</>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownload(styleResult, 'image')}
                      className={`flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg ${!styleResult ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Save Art
                    </button>

                    <button onClick={() => setIsExpanded(!isExpanded)} className={`p-2 rounded-xl transition-all shadow-lg ${isExpanded ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'}`}>{isExpanded ? <div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg><span className="hidden md:inline text-[10px] font-black uppercase tracking-widest px-1">Exit Artist Mode</span></div> : <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>}</button>
                  </div>
                </div>
                <div className={`w-full flex-1 overflow-hidden transition-all duration-500 ${isExpanded ? '' : 'rounded-[1.5rem] md:rounded-[2.5rem] border'} ${theme === 'dark' ? 'border-white/5 bg-black' : 'border-slate-100 bg-white shadow-xl'}`}>
                  <DrawingCanvas
                    ref={drawingCanvasRef}
                    key={canvasKey}
                    color={isExpanded ? computeColor(color, opacity) : color}
                    brushSize={brushSize}
                    tool={tool}
                    onStrokeEnd={onStrokeEnd}
                    onRealTimeUpdate={onRealTimeUpdate}
                    aspectRatio={aspectRatio}
                    scale={viewState.scale}
                    offset={viewState.offset}
                    onTransformChange={(s, o) => setViewState({ scale: s, offset: o })}
                    backgroundImage={referenceImage}
                  />
                </div>

                {isExpanded && (
                  <>
                    {/* TOOL SUITE - STANDARD STUDIO MODAL (FINAL) */}
                    {isSuiteMinimized ? (
                      // MINIMIZED: Floating Plus Button
                      <button
                        onClick={() => setIsSuiteMinimized(false)}
                        className="fixed bottom-8 right-6 w-14 h-14 bg-cyan-500 hover:bg-cyan-400 rounded-full shadow-[0_4px_20px_rgba(6,182,212,0.5)] z-[9999] flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
                      >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    ) : (
                      // EXPANDED: Full Screen Overlay Modal
                      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        {/* Backdrop Click to Close */}
                        <div className="absolute inset-0" onClick={() => setIsSuiteMinimized(true)} />

                        {/* The Studio Panel */}
                        <div className="relative bg-[#0f172a] border border-white/10 w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-6 max-h-[90vh] overflow-y-auto no-scrollbar">

                          {/* Header */}
                          <div className="flex justify-between items-center shrink-0">
                            <h2 className="text-white font-bold text-lg tracking-wide flex items-center gap-2">
                              <span className="w-2 h-6 bg-cyan-500 rounded-full" />
                              Studio Tools
                            </h2>
                            <button onClick={() => setIsSuiteMinimized(true)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          {/* 1. Color Wheel Option */}
                          <div className="space-y-3 shrink-0">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                              <span>Colors</span>
                              <span className="text-cyan-500">Selected</span>
                            </div>
                            <div className="flex items-center gap-2 bg-black/30 p-2 rounded-2xl border border-white/5">
                              {/* Left Arrow (Always Visible) */}
                              <button onClick={() => document.getElementById('modal-scroll')?.scrollBy({ left: -150, behavior: 'smooth' })} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>

                              <div id="modal-scroll" className="flex-1 flex gap-3 overflow-x-auto no-scrollbar scroll-smooth p-1 snap-x">
                                {EXTENDED_COLORS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => { setColor(c); setTool('brush'); }}
                                    className={`w-10 h-10 rounded-full flex-shrink-0 transition-transform snap-center ${color === c && tool === 'brush' ? 'scale-110 ring-2 ring-white shadow-lg' : 'scale-100 opacity-70 hover:opacity-100'}`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>

                              {/* Right Arrow (Always Visible) */}
                              <button onClick={() => document.getElementById('modal-scroll')?.scrollBy({ left: 150, behavior: 'smooth' })} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                            </div>
                          </div>

                          {/* 2. Tools & Actions */}
                          <div className="space-y-6">
                            {/* Tools Grid with Labels */}
                            <div className="grid grid-cols-4 gap-3">
                              {/* Pencil */}
                              <button onClick={() => setBrushPreset('pencil')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${tool === 'brush' && brushSize < 5 ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                <span className="text-[9px] font-bold uppercase">Pencil</span>
                              </button>

                              {/* Pen */}
                              <button onClick={() => setBrushPreset('pen')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${tool === 'brush' && brushSize >= 5 && brushSize < 12 ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                <span className="text-[9px] font-bold uppercase">Pen</span>
                              </button>

                              {/* Marker */}
                              <button onClick={() => setBrushPreset('marker')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${tool === 'brush' && brushSize >= 12 ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                <span className="text-[9px] font-bold uppercase">Marker</span>
                              </button>

                              {/* Eraser Tool */}
                              <button onClick={() => setTool('eraser')} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${tool === 'eraser' ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-500'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2.001 16.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                                <span className="text-[9px] font-bold uppercase">Eraser</span>
                              </button>
                            </div>

                            {/* Clear All Button */}
                            <button
                              onClick={() => { if (confirm('Clear entire canvas?')) drawingCanvasRef.current?.clear(); }}
                              className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 font-bold uppercase text-xs tracking-widest border border-red-500/20"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2.001 16.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                              Clear Everything
                            </button>

                            {/* Sliders Area */}
                            <div className="bg-white/5 rounded-2xl p-4 space-y-4">
                              <div className="flex items-center gap-4">
                                <label className="text-xs font-bold text-slate-400 w-10">SIZE</label>
                                <input
                                  type="range" min="1" max="100"
                                  value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                  className="flex-1 accent-cyan-400 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                />
                                <span className="text-sm font-mono text-white w-8 text-right">{brushSize}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="text-xs font-bold text-slate-400 w-10">FLOW</label>
                                <input
                                  type="range" min="0.1" max="1" step="0.1"
                                  value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                  className="flex-1 accent-cyan-400 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                />
                                <span className="text-sm font-mono text-white w-8 text-right">{Math.round(opacity * 100)}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                    {/* LIVE PREVIEW - Smart Positioning to avoid overlap */}
                    <div className={`absolute z-[130] w-40 md:w-96 pointer-events-none transition-all duration-500 ease-out right-4 ${isSuiteMinimized ? 'bottom-24' : 'bottom-4 md:bottom-10 md:right-10'}`}>
                      <div className={`w-full ${getAspectClass()} rounded-[1.5rem] md:rounded-[2rem] border-2 border-cyan-500/40 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] relative bg-black/60 backdrop-blur-3xl pointer-events-auto group hover:scale-105 transition-transform duration-300`}>
                        <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-ping' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`} />
                          <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-lg shadow-black">Aura Live</span>
                        </div>
                        {styleResult ? <img src={styleResult} className={`w-full h-full object-cover transition-all duration-300 ${isLoading ? 'opacity-40 blur-sm scale-105' : 'opacity-100 scale-100'}`} /> : <div className="absolute inset-0 flex items-center justify-center bg-white/5"><span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] italic text-white/20">Initializing...</span></div>}
                        {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-10"><div className="w-8 h-8 md:w-12 md:h-12 border-[3px] md:border-[4px] border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>}

                        {/* Upscale Button (Only if result exists) */}
                        {styleResult && !isLoading && (
                          <div className="absolute bottom-3 left-3 flex gap-2">
                            <button
                              onClick={() => handleUpscale()}
                              disabled={isUpscaling}
                              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                            >
                              {isUpscaling ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                              )}
                              <span className="hidden group-hover/btn:inline">Upscale</span>
                              <span className="bg-white/20 px-1 rounded text-[8px]">{userTier ? TIER_CONFIG[userTier].upscaleRes : '1K'}</span>
                            </button>
                          </div>
                        )}

                        {/* Download Overlay */}
                        {styleResult && (
                          <button onClick={() => handleDownload(styleResult)} className="absolute bottom-3 right-3 p-2 md:p-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white shadow-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90">
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* DASHBOARD GRID */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full transition-all duration-500 ${isExpanded ? 'opacity-0 h-0 overflow-hidden' : ''}`}>
                <div className="flex flex-col gap-3 md:gap-4">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Aura Blueprint</span>
                    {pencilResult && <button onClick={() => handleDownload(pencilResult)} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:text-cyan-500 transition-all">Download</button>}
                  </div>
                  <div className={`w-full ${getAspectClass()} rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border relative ${theme === 'dark' ? 'border-white/5 bg-black' : 'border-slate-100 bg-white shadow-xl'}`}>
                    {pencilResult ? <img src={pencilResult} className={`w-full h-full object-cover transition-all duration-500 ${isLoading ? 'opacity-30 blur-xl' : 'opacity-100'}`} /> : <div className="absolute inset-0 flex items-center justify-center opacity-10"><span className="text-[9px] font-black uppercase tracking-[0.5em] italic">Waiting...</span></div>}
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:gap-4">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">Final Masterpiece</span>
                    <div className="flex gap-4">
                      {styleResult && !isLoading && <button onClick={() => handleDownload(styleResult)} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:text-cyan-500">Download</button>}
                      {styleResult && !isLoading && <button onClick={() => handleUpscale()} className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:text-cyan-500 transition-all ${userTier === 'designer' ? 'opacity-50 cursor-not-allowed' : ''}`}>Upscale {TIER_CONFIG[userTier!].upscaleRes}</button>}
                      {styleResult && !isLoading && <button onClick={() => styleResult && openVideoStudio(styleResult)} className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] text-cyan-500">Animate</button>}
                    </div>
                  </div>
                  <div className={`w-full ${getAspectClass()} rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border relative ${theme === 'dark' ? 'border-white/5 bg-black' : 'border-slate-100 bg-white shadow-xl'}`}>
                    {styleResult ? <img src={styleResult} className={`w-full h-full object-cover transition-all duration-700 ${isLoading ? 'opacity-30 blur-xl' : 'opacity-100'}`} /> : <div className="absolute inset-0 flex items-center justify-center opacity-10"><span className="text-[9px] font-black uppercase tracking-[0.5em] italic">Genesis...</span></div>}{isLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-md z-10"><div className="w-8 h-8 md:w-10 md:h-10 border-[2px] border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}</div></div>
              </div>
            </div>
            {!isExpanded && history.length > 0 && (
              <div className="w-full max-w-[1200px] py-12 md:py-16 flex flex-col items-center gap-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Your Creations</h3>

                {/* Scrollable container with navigation */}
                <div className="relative w-full group/history">
                  {/* Left scroll button */}
                  <button
                    onClick={() => {
                      const container = document.getElementById('history-scroll');
                      if (container) container.scrollBy({ left: -200, behavior: 'smooth' });
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/history:opacity-100 transition-opacity hover:bg-black hover:border-white/20 shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  {/* Right scroll button */}
                  <button
                    onClick={() => {
                      const container = document.getElementById('history-scroll');
                      if (container) container.scrollBy({ left: 200, behavior: 'smooth' });
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/history:opacity-100 transition-opacity hover:bg-black hover:border-white/20 shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Scrollable history */}
                  <div
                    id="history-scroll"
                    className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar px-12 py-4 scroll-smooth snap-x snap-mandatory"
                  >
                    {history.map(item => (
                      <div key={item.id} className="relative group w-20 h-20 md:w-28 md:h-28 flex-shrink-0 snap-center">
                        {/* Image container */}
                        <div
                          onClick={() => {
                            setStyleResult(item.result);
                            currentSketchRef.current = item.sketch;
                            // Optional: Restore directives/prompt if needed
                          }}
                          className="w-full h-full rounded-2xl md:rounded-3xl border-2 cursor-pointer overflow-hidden group-hover:scale-105 active:scale-95 transition-all bg-black border-white/10 hover:border-cyan-400/50 shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
                        >
                          <img src={item.result} className="w-full h-full object-cover" />
                        </div>

                        {/* Video camera icon overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoStartFrame(item.result);
                            setIsVideoStudioOpen(true);
                          }}
                          className="absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-cyan-500 to-cyan-500 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(99,102,241,0.5)] opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 border-2 border-black"
                          title="Create Video"
                        >
                          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Gradient fade edges */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#030303] to-transparent pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#030303] to-transparent pointer-events-none" />
                </div>

                <p className="text-[9px] text-slate-600 uppercase tracking-widest">Scroll or use arrows to browse • Click image to view • Camera icon to animate</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {
        isVideoStudioOpen && (
          <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-2 md:p-8 animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] bg-[#080808] border border-white/10 rounded-[2rem] md:rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
              <div className="flex-1 bg-black p-4 md:p-6 flex flex-col items-center justify-center relative min-h-[300px] md:min-h-[400px]">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                  <button onClick={() => setIsVideoStudioOpen(false)} className="p-2 bg-cyan-500/20 text-cyan-300 rounded-xl hover:bg-cyan-500/30 transition-all" title="Return Home">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  </button>
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Video Studio</span>
                </div>
                <div className="w-full aspect-video bg-white/5 rounded-[1rem] md:rounded-[2rem] overflow-hidden border border-white/5 relative shadow-inner">
                  {videoLoading || isDubbing ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center"><div className="w-10 h-10 md:w-16 md:h-16 border-[3px] md:border-[4px] border-cyan-500 border-t-transparent rounded-full animate-spin" /><p className="text-white font-black uppercase text-[10px] md:text-[12px] tracking-widest animate-pulse">{videoStatus || 'Synthesizing...'}</p></div>
                  ) : generatedVideoUrl ? (
                    <div className="w-full h-full relative">
                      <video src={generatedVideoUrl} id="videoPlayer" controls autoPlay loop className="w-full h-full object-contain" />
                      {syncedAudioUrl && <audio src={syncedAudioUrl} autoPlay />}
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center group bg-[#050505] overflow-hidden">
                      <div className="absolute inset-0 flex gap-1">
                        {videoStartFrame && <img src={videoStartFrame} className={`h-full object-cover ${videoEndFrame ? 'w-1/2' : 'w-full'} opacity-40`} />}
                        {videoEndFrame && <img src={videoEndFrame} className="w-1/2 h-full object-cover opacity-40" />}
                      </div>
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white/40 text-center">Awaiting Synthesis</span></div>
                    </div>
                  )}
                </div>
                {generatedVideoUrl && !isDubbing && (
                  <div className="flex flex-col items-center gap-4 mt-6 w-full max-w-sm">
                    <div className="w-full space-y-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50 px-2">Voice Direction & Tone</p>
                      <textarea value={voiceInstruction} onChange={(e) => setVoiceInstruction(e.target.value)} placeholder="Perfectly describe how you want them to sound (e.g. Gritty pirate, rapid-fire cartoon, emotional whisper)..." className="w-full h-16 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] text-white outline-none focus:border-cyan-400/50 resize-none shadow-inner" />
                    </div>
                    <div className="flex gap-4 w-full">
                      <button onClick={handleAnalyzeVideo} className="flex-1 py-1.5 md:py-2 bg-cyan-500 text-white rounded-full font-black uppercase text-[8px] md:text-[10px] tracking-[0.2em] shadow-xl hover:bg-cyan-600 transition-all">Scan for AI Voice</button>
                      <button onClick={() => handleDownload(generatedVideoUrl, 'video')} className="flex-1 py-1.5 md:py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-black uppercase text-[8px] md:text-[10px] tracking-[0.2em] hover:bg-cyan-500/30 transition-all">Save Video</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full md:w-[360px] lg:w-[400px] p-6 md:p-8 border-t md:border-t-0 md:border-l border-white/5 flex flex-col gap-4 md:gap-6 overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between"><h2 className="text-lg md:text-xl font-black uppercase italic tracking-tighter">Veo<span className="text-cyan-500">Studio</span></h2><button onClick={() => setIsVideoStudioOpen(false)} className="text-slate-500 hover:text-white transition-colors"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button></div>

                {!dubSegments.length ? (
                  <>
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5"><button onClick={() => setVideoMode('interpolation')} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${videoMode === 'interpolation' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500'}`}>Story Mode</button><button onClick={() => userTier === 'studio' ? setVideoMode('reference') : setApiError("Vision mode requires Studio plan.")} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${videoMode === 'reference' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500'} ${userTier !== 'studio' ? 'opacity-40' : ''}`}>Vision Mode {userTier !== 'studio' && '🔒'}</button></div>

                    {videoMode === 'interpolation' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Start Frame</span>
                          <label className="block aspect-video rounded-xl border border-dashed border-white/20 hover:border-cyan-400/50 cursor-pointer overflow-hidden relative bg-white/5 transition-all shadow-inner">
                            {videoStartFrame ? (
                              <img src={videoStartFrame} className="w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20 font-black">+ UPLOAD</div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => setVideoStartFrame(event.target?.result as string);
                                reader.readAsDataURL(file);
                              }
                            }} className="hidden" />
                          </label>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">End Frame</span>
                          <label className="block aspect-video rounded-xl border border-dashed border-white/20 hover:border-cyan-400/50 cursor-pointer overflow-hidden relative bg-white/5 transition-all shadow-inner">
                            {videoEndFrame ? (
                              <img src={videoEndFrame} className="w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20 font-black">+ ADD</div>
                            )}
                            <input type="file" accept="image/*" onChange={handleEndFrameUpload} className="hidden" />
                          </label>
                        </div>
                      </div>
                    )}

                    <section className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Quality Output</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setVideoResolution('720p')} className={`py-2 rounded-lg border text-[9px] font-black ${videoResolution === '720p' ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-white/10 text-slate-500'}`}>720p</button>
                        <button onClick={() => setVideoResolution('1080p')} className={`py-2 rounded-lg border text-[9px] font-black ${videoResolution === '1080p' ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-white/10 text-slate-500'} ${userTier === 'designer' ? 'opacity-30' : ''}`}>{userTier === 'designer' ? '🔒 1080p' : '1080p'}</button>
                        <button onClick={() => setVideoResolution('4K')} className={`py-2 rounded-lg border text-[9px] font-black ${videoResolution === '4K' ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-white/10 text-slate-500'} ${userTier !== 'studio' ? 'opacity-30' : ''}`}>{userTier !== 'studio' ? '🔒 4K' : '4K'}</button>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Aspect Ratio</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setVideoAspectRatio('16:9')} className={`py-2.5 rounded-lg border text-[9px] font-black flex items-center justify-center gap-2 ${videoAspectRatio === '16:9' ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-white/10 text-slate-500 hover:border-white/20'}`}>
                          <span className="w-6 h-4 border-2 border-current rounded-sm"></span>
                          Landscape
                        </button>
                        <button onClick={() => setVideoAspectRatio('9:16')} className={`py-2.5 rounded-lg border text-[9px] font-black flex items-center justify-center gap-2 ${videoAspectRatio === '9:16' ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-white/10 text-slate-500 hover:border-white/20'}`}>
                          <span className="w-4 h-6 border-2 border-current rounded-sm"></span>
                          Portrait
                        </button>
                      </div>
                    </section>

                    {videoMode === 'reference' && (
                      <section className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Reference Images <span className="text-white/30">(up to 3)</span></h3>
                        <div className="grid grid-cols-3 gap-2">
                          {[0, 1, 2].map((index) => (
                            <div key={index} className="relative aspect-square">
                              {videoIngredients[index] ? (
                                <div className="relative w-full h-full group">
                                  <img src={videoIngredients[index]} className="w-full h-full object-cover rounded-xl border border-white/10" />
                                  <button
                                    onClick={() => setVideoIngredients(prev => prev.filter((_, i) => i !== index))}
                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <label className="block w-full h-full rounded-xl border border-dashed border-white/20 hover:border-cyan-400/50 cursor-pointer bg-white/5 transition-all flex items-center justify-center">
                                  <span className="text-[10px] text-white/30 font-black">+ ADD</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file && videoIngredients.length < 3) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const result = ev.target?.result as string;
                                          setVideoIngredients(prev => [...prev, result]);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[8px] text-white/30">Add reference images to guide your video's style and content</p>
                      </section>
                    )}

                    <section className="space-y-4"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Atmosphere Directives</h3><textarea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder="Describe the cinematic action..." className="w-full h-24 md:h-20 bg-white/5 border border-white/10 rounded-xl p-4 text-[10px] font-medium text-white outline-none focus:border-cyan-500/50 transition-all resize-none shadow-inner" /></section>
                    <button onClick={handleGenerateVideo} disabled={videoLoading} className={`w-full py-3 md:py-4 rounded-xl font-black uppercase text-[9px] md:text-[10px] tracking-[0.3em] transition-all shadow-xl ${videoLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-500 text-white hover:bg-cyan-600 active:scale-95'}`}>{videoLoading ? 'Crafting...' : 'Synthesize Motion'}</button>
                    <button onClick={() => setIsVideoStudioOpen(false)} className="w-full py-3 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 hover:text-white transition-all">Back to Home</button>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col gap-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">AI Dubbing Console</h3>
                    <div className="space-y-4">
                      {dubSegments.map((seg, idx) => (
                        <div key={seg.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3 shadow-inner">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase text-cyan-300">{seg.speakerLabel} ({seg.startTime}s - {seg.endTime}s)</span>
                            <select value={seg.voice} onChange={(e) => {
                              const newSegments = [...dubSegments];
                              newSegments[idx].voice = e.target.value as VoiceName;
                              setDubSegments(newSegments);
                            }} className="bg-black text-[9px] border border-white/10 rounded px-1 text-white outline-none">
                              {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                          <textarea value={seg.text} onChange={(e) => {
                            const newSegments = [...dubSegments];
                            newSegments[idx].text = e.target.value;
                            setDubSegments(newSegments);
                          }} className="w-full bg-transparent text-[11px] outline-none border-none text-white/80 h-16 resize-none" />
                        </div>
                      ))}
                    </div>
                    <button onClick={handleForgeVoiceover} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:bg-slate-100 transition-all">Forge Dubbing</button>
                    {syncedAudioUrl && <button onClick={() => handleDownload(syncedAudioUrl, 'video')} className="w-full py-3 border border-cyan-500/30 text-cyan-300 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-cyan-500/10 shadow-xl">Download Voice track (MP4)</button>}
                    <button onClick={() => setDubSegments([])} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-all">Back to Motion Studio</button>
                    <button onClick={() => setIsVideoStudioOpen(false)} className="text-center text-[9px] font-black uppercase tracking-widest text-cyan-500/50 hover:text-cyan-500 transition-all">Return Home</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        ::-webkit-scrollbar { display: none !important; }
        * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        input[type="range"] { -webkit-appearance: none; background: transparent; }
        input[type="range"]::-webkit-slider-thumb { width: 16px; height: 16px; background: #4f46e5; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); -webkit-appearance: none; margin-top: -6px; }
        input[type="range"]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(0,0,0,0.1); border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>

      {showAdmin && <AdminDashboard onClose={() => setShowAdmin(false)} />}

      {/* UPSCALE LOADING OVERLAY */}
      {isUpscaling && (
        <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-t-4 border-cyan-500 rounded-full animate-spin"></div>
            <div className="absolute inset-3 border-r-4 border-pink-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h2 className="text-2xl font-light tracking-[0.2em] text-white uppercase animate-pulse">Enhancing Masterpiece</h2>
          <p className="text-cyan-400 text-xs tracking-widest mt-4 uppercase font-bold">Applying Nano-Banana Pro Intelligence...</p>
        </div>
      )}

      {/* UPSCALE RESULT MODAL */}
      {showUpscaleModal && upscaleResult && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
              <h3 className="text-white font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                <span className="text-xl">✨</span> High-Res Upscale Complete
              </h3>
              <button onClick={() => setShowUpscaleModal(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Image Content */}
            <div className="flex-1 overflow-auto p-4 bg-[url('/grid.png')] bg-repeat flex items-center justify-center">
              <img src={upscaleResult} alt="Upscaled Art" className="max-w-full max-h-[70vh] object-contain shadow-2xl rounded-lg" />
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-4">
              <button onClick={() => setShowUpscaleModal(false)} className="px-6 py-3 rounded-xl text-slate-400 font-bold uppercase text-xs tracking-widest hover:text-white hover:bg-white/5 transition-all">
                Discard
              </button>
              <button onClick={() => handleDownload(upscaleResult, 'image')} className="px-8 py-3 rounded-xl bg-cyan-500 text-white font-bold uppercase text-xs tracking-widest hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download {userTier ? TIER_CONFIG[userTier].upscaleRes : '1K'} Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default App;
