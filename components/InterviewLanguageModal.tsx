import React from 'react';
import { Language } from '../types';

interface InterviewLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (language: Language) => void;
}

export const InterviewLanguageModal: React.FC<InterviewLanguageModalProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Choose Interview Language</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
        </header>
        <main className="p-6 text-center">
          <p className="text-slate-600 mb-6">Please select the language you would like to use for the AI interview.</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => onSelect(Language.English)}
              className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors"
            >
              English
            </button>
            <button
              onClick={() => onSelect(Language.BahasaIndonesia)}
              className="px-8 py-3 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 transition-colors"
            >
              Bahasa Indonesia
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
