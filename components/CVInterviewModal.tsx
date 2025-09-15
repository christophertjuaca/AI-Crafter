import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { createCVInterviewChat, generateCVFromHistory } from '../services/geminiService';
import type { ChatMessage, Language } from '../types';

interface CVInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (generatedCv: string) => void;
  language: Language;
}

const AILoadingIndicator = () => (
    <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

const MicrophoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-12 0H3a7.001 7.001 0 006 6.93V17H7a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
    </svg>
);

const ListeningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1z" />
      <path d="M7 6a1 1 0 011 1v6a1 1 0 11-2 0V7a1 1 0 011-1z" />
      <path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1z" />
      <path d="M13 6a1 1 0 011 1v6a1 1 0 11-2 0V7a1 1 0 011-1z" />
      <path d="M16 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1z" />
    </svg>
);

const SpeakerOnIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 12.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
);

const SpeakerOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);


// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

export const CVInterviewModal: React.FC<CVInterviewModalProps> = ({ isOpen, onClose, onComplete, language }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel(); // Cancel any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    // Set language for speech synthesis
    utterance.lang = language === 'English' ? 'en-US' : 'id-ID';
    speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      const startChat = async () => {
        setIsAiThinking(true);
        setError(null);
        try {
          const newChat = createCVInterviewChat(language);
          setChat(newChat);
          const initialResponse = await newChat.sendMessage({ message: `Hello, let's start in ${language}.` });
          setMessages([{ role: 'model', text: initialResponse.text }]);
          if (isSpeechEnabled) {
            speak(initialResponse.text);
          }
        } catch (err) {
            setError('Failed to start the interview. Please check your connection and API key.');
            console.error(err);
        } finally {
            setIsAiThinking(false);
        }
      };
      startChat();
    } else {
      // Reset state and cleanup when closed
      setMessages([]);
      setUserInput('');
      setChat(null);
      setIsAiThinking(false);
      setIsGenerating(false);
      setError(null);
      if (recognition) recognition.stop();
      setIsListening(false);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  }, [isOpen, language, isSpeechEnabled, speak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);
  
  // Setup speech recognition
  useEffect(() => {
    if (!recognition) return;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'English' ? 'en-US' : 'id-ID';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setUserInput(userInput + finalTranscript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };
  }, [language, userInput]);

  const toggleListening = () => {
    if (!recognition) {
        setError("Voice recognition is not supported by your browser.");
        return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
    setIsListening(!isListening);
  };


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || !chat || isAiThinking) return;
    if(isListening) {
      recognition.stop();
      setIsListening(false);
    }

    const userMessage: ChatMessage = { role: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsAiThinking(true);
    setError(null);

    try {
      const response = await chat.sendMessage({ message: userInput });
      const aiMessage: ChatMessage = { role: 'model', text: response.text };
      setMessages(prev => [...prev, aiMessage]);
      if (isSpeechEnabled) {
          speak(response.text);
      }
    } catch (err) {
        setError('There was an issue communicating with the AI. Please try again.');
        console.error(err);
    } finally {
        setIsAiThinking(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formRef.current?.requestSubmit();
    }
  };
  
  const handleFinish = async () => {
    setIsGenerating(true);
    setError(null);
    try {
        const generatedCv = await generateCVFromHistory(messages);
        onComplete(generatedCv);
    } catch(err) {
        setError('Failed to generate the final CV. You can copy the conversation from here and try again later.');
        console.error(err);
    } finally {
        setIsGenerating(false);
    }
  };
  
  const toggleSpeech = () => {
      if (isSpeechEnabled && 'speechSynthesis' in window) {
          speechSynthesis.cancel();
      }
      setIsSpeechEnabled(!isSpeechEnabled);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[90vh] max-h-[700px] flex flex-col">
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">AI CV Builder Interview</h2>
          <div className="flex items-center space-x-4">
            <button onClick={toggleSpeech} title={isSpeechEnabled ? "Disable AI voice" : "Enable AI voice"} className={`p-2 rounded-full ${isSpeechEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {isSpeechEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
          </div>
        </header>

        <main className="flex-grow p-4 overflow-y-auto bg-slate-50">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-prose px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-800'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex justify-start">
                  <div className="px-4 py-2 rounded-lg bg-slate-200">
                      <AILoadingIndicator />
                  </div>
              </div>
            )}
             {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
          </div>
          <div ref={messagesEndRef} />
        </main>
        
        <footer className="p-4 border-t">
            {messages.length > 1 && !isAiThinking && !messages[messages.length-1].text.includes("Thank you") && !messages[messages.length-1].text.includes("Terima kasih") && (
                <div className="flex justify-end mb-3">
                    <button
                        onClick={handleFinish}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-green-400"
                    >
                        {isGenerating ? 'Generating CV...' : 'Finish & Create CV'}
                    </button>
                </div>
            )}
          <form ref={formRef} onSubmit={handleSendMessage} className="flex items-start space-x-2">
            <div className="relative flex-grow">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type or use the mic to answer... (Shift+Enter for new line)"
                className="w-full p-2 pr-10 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-white placeholder-slate-400 resize-none"
                disabled={isAiThinking || isGenerating}
                rows={2}
              />
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? "Stop listening" : "Start listening"}
                disabled={!recognition}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-700'}`}
              >
                {isListening ? <ListeningIcon /> : <MicrophoneIcon />}
              </button>
            </div>
            <button
              type="submit"
              disabled={isAiThinking || isGenerating || !userInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 self-stretch"
            >
              Send
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};