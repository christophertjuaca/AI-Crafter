import React from 'react';

interface CVReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onRecreate: () => void;
  cvContent: string;
}

export const CVReviewModal: React.FC<CVReviewModalProps> = ({ isOpen, onClose, onAccept, onRecreate, cvContent }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] max-h-[800px] flex flex-col">
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Generated CV Ready for Review</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
        </header>

        <main className="flex-grow p-6 overflow-y-auto bg-slate-50">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800 leading-relaxed">
            {cvContent}
          </pre>
        </main>
        
        <footer className="p-4 border-t bg-white flex justify-end items-center space-x-4">
            <button
                onClick={onRecreate}
                className="px-6 py-2 bg-slate-200 text-slate-800 font-semibold rounded-md hover:bg-slate-300"
            >
                Recreate
            </button>
            <button
                onClick={onAccept}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
            >
                Use This CV
            </button>
        </footer>
      </div>
    </div>
  );
};