import React, { useState, useEffect } from 'react';
import { generateCVPdf } from '../services/pdfGenerator';
import type { GeneratedContent, Score, CoverLetterRequest } from '../types';

interface OutputPanelProps {
  content: GeneratedContent | null;
  isLoading: boolean;
  error: string | null;
  sources: any[];
  formData: CoverLetterRequest;
}

type ActiveTab = 'scores' | 'coverLetter' | 'cv' | 'linkedin';

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="mt-4 text-slate-600 font-medium">Generating your documents & analysis...</p>
    <p className="text-sm text-slate-500">The AI is researching and writing now.</p>
  </div>
);

const CopyIcon: React.FC<{ copied: boolean }> = ({ copied }) => {
    if (copied) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
};

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const ScoreDisplay: React.FC<{ title: string; scoreData: Score; color: string; }> = ({ title, scoreData, color }) => {
    const { score, summary } = scoreData;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 text-center mb-3">{title}</h3>
            <div className="flex items-center justify-center space-x-6">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 120 120">
                        <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
                        <circle
                            className={color}
                            strokeWidth="10"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r={radius}
                            cx="60"
                            cy="60"
                            transform="rotate(-90 60 60)"
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-700">{score}</span>
                </div>
                 <p className="flex-1 text-sm text-slate-600 leading-relaxed">{summary}</p>
            </div>
        </div>
    );
};


export const OutputPanel: React.FC<OutputPanelProps> = ({ content, isLoading, error, sources, formData }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('scores');

  useEffect(() => {
    if (content) {
      setCopied(false);
      setActiveTab('scores');
    }
  }, [content]);

  const handleCopy = () => {
    if (!content) return;

    let textToCopy = '';
    if (activeTab === 'coverLetter') textToCopy = content.coverLetter;
    else if (activeTab === 'cv') textToCopy = content.revampedCV;
    else if (activeTab === 'linkedin') textToCopy = content.linkedinMessage;
    else return; // No copy for scores tab

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownloadPdf = () => {
    if (content?.revampedCV && formData) {
      generateCVPdf(content.revampedCV, formData);
    }
  };
  
  const getTabClass = (tabName: ActiveTab) => 
    `px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
      activeTab === tabName 
        ? 'bg-slate-50 text-indigo-600 border-b-2 border-indigo-600' 
        : 'text-slate-500 hover:text-slate-700'
    }`;


  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    if (error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center text-red-600 bg-red-50 p-6 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="font-semibold">An Error Occurred</p>
              <p className="text-sm">{error}</p>
          </div>
      );
    }
    if (!content) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          <h3 className="font-semibold text-lg text-slate-600">Your Application Toolkit Will Appear Here</h3>
          <p className="mt-1">Fill out the form to generate your documents and analysis.</p>
        </div>
      );
    }
    
    if (activeTab === 'scores') {
        return (
            <div className="p-6 space-y-4">
                <ScoreDisplay title="Job Fit Score" scoreData={content.scores.jobFit} color="text-teal-500" />
                <ScoreDisplay title="Company Score" scoreData={content.scores.company} color="text-sky-500" />
                <ScoreDisplay title="ATS Friendliness" scoreData={content.scores.ats} color="text-violet-500" />
                {sources && sources.length > 0 && (
                <div className="px-2 pt-2">
                    <h4 className="font-semibold text-slate-700 mb-3 text-base border-t border-slate-200 pt-4">Company Research Sources</h4>
                    <ul className="list-disc list-inside space-y-2">
                        {sources.map((source, index) => (
                           <li key={index} className="text-sm truncate">
                               <a href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" title={source.web?.title}>
                                   {source.web?.title || source.web?.uri}
                               </a>
                           </li>
                        ))}
                    </ul>
                </div>
            )}
            </div>
        );
    }
    
    let currentText = '';
    if (activeTab === 'coverLetter') currentText = content.coverLetter;
    else if (activeTab === 'cv') currentText = content.revampedCV;
    else if (activeTab === 'linkedin') currentText = content.linkedinMessage;

    return (
        <>
            <div className="absolute top-3 right-4 z-10 flex items-center space-x-2">
                {activeTab === 'cv' && (
                  <button
                      onClick={handleDownloadPdf}
                      className="flex items-center space-x-2 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-300 transition duration-150 text-sm"
                      title="Download as PDF"
                  >
                      <DownloadIcon />
                      <span>PDF</span>
                  </button>
                )}
                {/* FIX: The `activeTab !== 'scores'` check is redundant here. Due to control flow analysis, TypeScript knows this is always true because the 'scores' tab case returns earlier. */}
                <button
                    onClick={handleCopy}
                    className="flex items-center space-x-2 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-300 transition duration-150 text-sm"
                >
                    <CopyIcon copied={copied} />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800 leading-relaxed p-6">
                {currentText}
            </pre>
        </>
    );
  };
  
  return (
    <div className="bg-white p-2 rounded-lg shadow-lg relative h-[80vh] min-h-[600px] flex flex-col">
       <div className="border-b border-slate-200 px-2 pt-1">
          <nav className="flex space-x-2">
              <button className={getTabClass('scores')} onClick={() => setActiveTab('scores')}>Analysis & Scores</button>
              <button className={getTabClass('coverLetter')} onClick={() => setActiveTab('coverLetter')}>Cover Letter</button>
              <button className={getTabClass('cv')} onClick={() => setActiveTab('cv')}>Revamped CV</button>
              <button className={getTabClass('linkedin')} onClick={() => setActiveTab('linkedin')}>LinkedIn Message</button>
          </nav>
       </div>
       <div className="flex-grow overflow-y-auto rounded-b-md bg-slate-50 relative">
        {renderContent()}
       </div>
    </div>
  );
};