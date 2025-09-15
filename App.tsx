import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';
import { CVInterviewModal } from './components/CVInterviewModal';
import { CVReviewModal } from './components/CVReviewModal';
import { HistoryModal } from './components/HistoryModal';
import { InterviewLanguageModal } from './components/InterviewLanguageModal';
import { generateHiringDocuments } from './services/geminiService';
import type { CoverLetterRequest, CVInput, GeneratedContent, HistoryItem } from './types';
import { Tone, CompanyType, Language } from './types';

const INITIAL_FORM_DATA: CoverLetterRequest = {
  cv: { text: '' },
  jobDescription: '',
  tone: Tone.Professional,
  companyType: CompanyType.Corporate,
  companyName: '',
  jobTitle: '',
  language: Language.English,
  fullName: '',
  email: '',
  phone: '',
  address: '',
};

function App() {
  const [formData, setFormData] = useState<CoverLetterRequest>(INITIAL_FORM_DATA);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [interviewLanguage, setInterviewLanguage] = useState<Language>(Language.English);
  const [isCvReviewModalOpen, setIsCvReviewModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [generatedCvForReview, setGeneratedCvForReview] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Load from localStorage on initial render
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('aiCrafterProfile');
      const savedHistory = localStorage.getItem('aiCrafterHistory');
      
      if (savedProfile) {
        const profileData = JSON.parse(savedProfile);
        setFormData(prev => ({...prev, ...profileData}));
      }
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }
  }, []);
  
  // Save profile to localStorage whenever it changes
  useEffect(() => {
    const profileData = {
      cv: formData.cv,
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
    };
    try {
      localStorage.setItem('aiCrafterProfile', JSON.stringify(profileData));
    } catch(e) {
      console.error("Failed to save profile to localStorage", e);
    }
  }, [formData.cv, formData.fullName, formData.email, formData.phone, formData.address]);
  
  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('aiCrafterHistory', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);


  const handleFormChange = useCallback(<K extends keyof CoverLetterRequest>(field: K, value: CoverLetterRequest[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const handleCVChange = useCallback((cvInput: CVInput) => {
    setFormData(prev => ({ ...prev, cv: cvInput }));
  }, []);

  const handleLanguageSelect = (lang: Language) => {
    setInterviewLanguage(lang);
    setIsLanguageModalOpen(false);
    setIsInterviewModalOpen(true);
  };

  const handleInterviewComplete = (generatedCv: string) => {
    setGeneratedCvForReview(generatedCv);
    setIsInterviewModalOpen(false);
    setIsCvReviewModalOpen(true);
  };
  
  const handleAcceptCv = () => {
    handleCVChange({ text: generatedCvForReview });
    setIsCvReviewModalOpen(false);
  };

  const handleRecreateCv = () => {
    setIsCvReviewModalOpen(false);
    setIsLanguageModalOpen(true);
  };

  const handleGenerate = async () => {
    if ((!formData.cv.text && !formData.cv.file) || !formData.jobDescription || !formData.companyName || !formData.fullName || !formData.jobTitle) {
      setError("Please provide your Full Name, CV, Job Title, Job Description, and Company Name.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);
    setSources([]);

    try {
      const result = await generateHiringDocuments(formData);
      setGeneratedContent(result.content);
      setSources(result.sources);
      
      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Date.now(),
        formData: formData,
        generatedContent: result.content,
        sources: result.sources,
      };
      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (err) {
      if (err instanceof Error) {
        setError(`Failed to generate content: ${err.message}`);
      } else {
        setError("An unknown error occurred.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLoadFromHistory = (item: HistoryItem) => {
    setFormData(item.formData);
    setGeneratedContent(item.generatedContent);
    setSources(item.sources);
    setError(null);
    setIsHistoryModalOpen(false);
  };
  
  const handleDeleteFromHistory = (id: number) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Header onOpenHistory={() => setIsHistoryModalOpen(true)} />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <InputPanel
            formData={formData}
            onFormChange={handleFormChange}
            onCVChange={handleCVChange}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            onStartInterview={() => setIsLanguageModalOpen(true)}
          />
          <OutputPanel
            content={generatedContent}
            isLoading={isLoading}
            error={error}
            sources={sources}
            formData={formData}
          />
        </div>
      </main>
      <InterviewLanguageModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        onSelect={handleLanguageSelect}
      />
      <CVInterviewModal
        isOpen={isInterviewModalOpen}
        onClose={() => setIsInterviewModalOpen(false)}
        onComplete={handleInterviewComplete}
        language={interviewLanguage}
      />
      <CVReviewModal
        isOpen={isCvReviewModalOpen}
        cvContent={generatedCvForReview}
        onAccept={handleAcceptCv}
        onRecreate={handleRecreateCv}
        onClose={() => setIsCvReviewModalOpen(false)}
      />
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onLoad={handleLoadFromHistory}
        onDelete={handleDeleteFromHistory}
      />
    </div>
  );
}

export default App;