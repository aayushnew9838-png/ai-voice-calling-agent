import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Radio, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle, listening, processing, responding
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [intent, setIntent] = useState('Unknown');
  const [confidence, setConfidence] = useState(0);
  const [resolutionStatus, setResolutionStatus] = useState('Pending');
  const [escalationFlag, setEscalationFlag] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const { toast } = useToast();

  // Intent detection keywords
  const intentKeywords = {
    information: ['what', 'how', 'when', 'where', 'tell me', 'explain', 'information', 'details', 'know'],
    complaint: ['problem', 'issue', 'complaint', 'not working', 'broken', 'disappointed', 'upset', 'angry', 'frustrated'],
    assistance: ['help', 'support', 'assist', 'need', 'can you', 'please', 'unable', 'difficulty', 'stuck']
  };

  // AI response templates
  const responseTemplates = {
    information: [
      "I'd be happy to provide you with that information. Based on what you've asked, ",
      "Let me explain that for you. ",
      "That's a great question. Here's what you need to know: "
    ],
    complaint: [
      "I understand your frustration, and I sincerely apologize for the inconvenience. Let me help resolve this issue for you. ",
      "I'm sorry to hear about this problem. Your concern is important to us, and I'll do everything I can to assist you. ",
      "Thank you for bringing this to our attention. I completely understand why you're upset, and I'm here to help make this right. "
    ],
    assistance: [
      "I'm here to help you with that. Let me guide you through the process. ",
      "I'd be glad to assist you. Here's what we can do: ",
      "Of course, I can help you with that. Let's work through this together. "
    ]
  };

  // Detect intent from transcript
  const detectIntent = (text) => {
    const lowerText = text.toLowerCase();
    let detectedIntent = 'Unknown';
    let maxScore = 0;

    Object.entries(intentKeywords).forEach(([intentType, keywords]) => {
      const score = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intentType.charAt(0).toUpperCase() + intentType.slice(1);
      }
    });

    return { intent: detectedIntent, score: Math.min(maxScore * 25 + 50, 100) };
  };

  // Generate AI response
  const generateAIResponse = (userText, detectedIntent) => {
    const intentType = detectedIntent.toLowerCase();
    const templates = responseTemplates[intentType] || responseTemplates.assistance;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    let response = template;
    
    // Add contextual responses
    if (intentType === 'information') {
      response += "Our services are designed to provide you with the best experience possible. I can provide detailed information about features, pricing, and how to get started.";
    } else if (intentType === 'complaint') {
      response += "I've escalated this to our priority support team. In the meantime, I can offer you immediate solutions or alternatives.";
    } else if (intentType === 'assistance') {
      response += "I'll walk you through each step to ensure everything works perfectly for you.";
    } else {
      response = "Thank you for reaching out. I'm here to help with any questions or concerns you may have. Could you please provide more details?";
    }

    return response;
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        
        if (event.results[current].isFinal) {
          setTranscript(transcriptText);
          setCallState('processing');
          
          // Detect intent
          const { intent: detectedIntent, score } = detectIntent(transcriptText);
          setIntent(detectedIntent);
          setConfidence(score);
          
          // Check for escalation keywords
          const escalationKeywords = ['manager', 'supervisor', 'escalate', 'unacceptable', 'legal'];
          const shouldEscalate = escalationKeywords.some(keyword => 
            transcriptText.toLowerCase().includes(keyword)
          );
          setEscalationFlag(shouldEscalate);
          
          // Generate AI response
          setTimeout(() => {
            const response = generateAIResponse(transcriptText, detectedIntent);
            setAiResponse(response);
            setCallState('responding');
            
            // Add to conversation history
            setConversationHistory(prev => [...prev, {
              user: transcriptText,
              ai: response,
              intent: detectedIntent,
              timestamp: new Date().toLocaleTimeString()
            }]);
            
            // Speak response
            speakResponse(response);
            
            // Update resolution status
            if (detectedIntent === 'Information') {
              setResolutionStatus('In Progress');
            } else if (detectedIntent === 'Complaint' && shouldEscalate) {
              setResolutionStatus('Escalated');
            } else {
              setResolutionStatus('Resolving');
            }
          }, 1500);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice calling.",
            variant: "destructive"
          });
          handleEndCall();
        }
      };

      recognitionRef.current.onend = () => {
        if (isCallActive && callState === 'listening') {
          recognitionRef.current.start();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      synthRef.current.cancel();
    };
  }, [isCallActive, callState]);

  // Speak AI response
  const speakResponse = (text) => {
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      setCallState('listening');
    };
    
    synthRef.current.speak(utterance);
  };

  // Start call
  const handleStartCall = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Browser Not Supported",
        description: "Please use Chrome, Edge, or Safari for voice calling.",
        variant: "destructive"
      });
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsCallActive(true);
      setCallState('listening');
      setTranscript('');
      setAiResponse('');
      setIntent('Unknown');
      setConfidence(0);
      setResolutionStatus('Active');
      setEscalationFlag(false);
      setConversationHistory([]);
      
      recognitionRef.current.start();
      
      toast({
        title: "Call Connected",
        description: "Speak naturally. AI is listening...",
      });
    } catch (error) {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to start the call.",
        variant: "destructive"
      });
    }
  };

  // End call
  const handleEndCall = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    synthRef.current.cancel();
    setIsCallActive(false);
    setCallState('idle');
    setResolutionStatus('Ended');
    
    toast({
      title: "Call Ended",
      description: "Thank you for using AI Voice Assistant.",
    });
  };

  return (
    <>
      <Helmet>
        <title>AI Voice Calling Agent - Live Demo</title>
        <meta name="description" content="Experience real-time AI-powered voice calling with intelligent intent detection, live transcription, and automated responses." />
      </Helmet>
      
      <div className="min-h-screen bg-slate-950 text-white p-8 overflow-hidden">
        <Toaster />
        
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-950/20 via-blue-950/20 to-slate-950"></div>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                AI Voice Calling Agent
              </h1>
            </div>
            <p className="text-slate-400 text-lg">Real-time intelligent voice assistant with live insights</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Panel - Call Interface */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-slate-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 shadow-2xl">
                {/* Call Status Indicator */}
                <div className="flex items-center justify-center gap-3 mb-8">
                  <AnimatePresence mode="wait">
                    {callState === 'listening' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-3 h-3 bg-green-500 rounded-full"
                        />
                        <span className="text-green-400 font-medium">Listening</span>
                      </motion.div>
                    )}
                    {callState === 'processing' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full"
                        />
                        <span className="text-yellow-400 font-medium">Processing</span>
                      </motion.div>
                    )}
                    {callState === 'responding' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-3 h-3 bg-blue-500 rounded-full"
                        />
                        <span className="text-blue-400 font-medium">Responding</span>
                      </motion.div>
                    )}
                    {callState === 'idle' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-3 h-3 bg-slate-500 rounded-full" />
                        <span className="text-slate-400 font-medium">Idle</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Call Button */}
                <div className="flex justify-center mb-8">
                  <AnimatePresence mode="wait">
                    {!isCallActive ? (
                      <motion.div
                        key="start"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      >
                        <Button
                          onClick={handleStartCall}
                          className="w-32 h-32 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-2xl shadow-cyan-500/50 transition-all duration-300 hover:scale-105"
                        >
                          <Phone className="w-12 h-12" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="end"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      >
                        <Button
                          onClick={handleEndCall}
                          className="w-32 h-32 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-2xl shadow-red-500/50 transition-all duration-300 hover:scale-105"
                        >
                          <PhoneOff className="w-12 h-12" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Label */}
                <p className="text-center text-slate-400 mb-8">
                  {isCallActive ? 'Tap to end call' : 'Tap to start call'}
                </p>

                {/* Transcript Display */}
                <div className="space-y-4">
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-2xl p-6 min-h-[120px]">
                    <div className="flex items-center gap-2 mb-3">
                      <Mic className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">Your Speech</h3>
                    </div>
                    <AnimatePresence mode="wait">
                      {transcript ? (
                        <motion.p
                          key={transcript}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-white leading-relaxed"
                        >
                          {transcript}
                        </motion.p>
                      ) : (
                        <p className="text-slate-500 italic">
                          {isCallActive ? 'Speak now...' : 'Start a call to begin'}
                        </p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/10 rounded-2xl p-6 min-h-[120px]">
                    <div className="flex items-center gap-2 mb-3">
                      <Radio className="w-5 h-5 text-blue-400" />
                      <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">AI Response</h3>
                    </div>
                    <AnimatePresence mode="wait">
                      {aiResponse ? (
                        <motion.p
                          key={aiResponse}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-white leading-relaxed"
                        >
                          {aiResponse}
                        </motion.p>
                      ) : (
                        <p className="text-slate-500 italic">AI response will appear here...</p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Panel - Live Insights */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="bg-slate-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 shadow-2xl">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                  Live Call Insights
                </h2>

                <div className="space-y-6">
                  {/* Intent Detection */}
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Detected Intent</h3>
                    <motion.div
                      key={intent}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center justify-between"
                    >
                      <span className="text-2xl font-bold text-white">{intent}</span>
                      <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        intent === 'Information' ? 'bg-blue-500/20 text-blue-400' :
                        intent === 'Complaint' ? 'bg-red-500/20 text-red-400' :
                        intent === 'Assistance' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {intent === 'Information' ? '📊 Info' :
                         intent === 'Complaint' ? '⚠️ Issue' :
                         intent === 'Assistance' ? '🤝 Help' :
                         '❓ Unknown'}
                      </div>
                    </motion.div>
                  </div>

                  {/* Confidence Score */}
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">AI Confidence Score</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-white">{confidence}%</span>
                        <span className={`text-sm font-semibold ${
                          confidence >= 75 ? 'text-green-400' :
                          confidence >= 50 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {confidence >= 75 ? 'High' : confidence >= 50 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${confidence}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            confidence >= 75 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                            confidence >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                            'bg-gradient-to-r from-red-500 to-red-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resolution Status */}
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Call Resolution Status</h3>
                    <motion.div
                      key={resolutionStatus}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-3 h-3 rounded-full ${
                        resolutionStatus === 'Active' ? 'bg-green-500' :
                        resolutionStatus === 'Resolving' ? 'bg-blue-500' :
                        resolutionStatus === 'Escalated' ? 'bg-red-500' :
                        resolutionStatus === 'In Progress' ? 'bg-yellow-500' :
                        'bg-slate-500'
                      }`} />
                      <span className="text-xl font-semibold text-white">{resolutionStatus}</span>
                    </motion.div>
                  </div>

                  {/* Escalation Flag */}
                  <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Escalation Required</h3>
                    <AnimatePresence mode="wait">
                      {escalationFlag ? (
                        <motion.div
                          key="escalated"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="flex items-center gap-3 bg-red-500/20 border border-red-500/50 rounded-lg p-4"
                        >
                          <AlertTriangle className="w-6 h-6 text-red-400" />
                          <span className="text-red-400 font-semibold">Yes - Priority Support</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="normal"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                          </div>
                          <span className="text-green-400 font-semibold">No - Standard Handling</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Conversation History */}
                  {conversationHistory.length > 0 && (
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Recent Exchanges</h3>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {conversationHistory.slice(-3).reverse().map((item, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs space-y-1 pb-3 border-b border-slate-700 last:border-b-0"
                          >
                            <p className="text-slate-400">{item.timestamp}</p>
                            <p className="text-cyan-300"><span className="font-semibold">You:</span> {item.user.substring(0, 60)}...</p>
                            <p className="text-blue-300"><span className="font-semibold">AI:</span> {item.ai.substring(0, 60)}...</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 text-center"
          >
            <p className="text-slate-500 text-sm">
              Powered by Browser Speech APIs • Real-time Intent Detection • Simulated AI Responses
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}

export default App;
