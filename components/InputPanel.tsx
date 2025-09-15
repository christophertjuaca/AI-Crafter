import React, { useState } from 'react';
import type { CoverLetterRequest, CVInput } from '../types';
import { TONE_OPTIONS, COMPANY_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '../constants';

interface InputPanelProps {
  formData: CoverLetterRequest;
  onFormChange: <K extends keyof CoverLetterRequest>(field: K, value: CoverLetterRequest[K]) => void;
  onCVChange: (cvInput: CVInput) => void;
  onGenerate: () => void;
  isLoading: boolean;
  onStartInterview: () => void;
}

type CVInputMode = 'paste' | 'upload' | 'create';

const GenerateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 0010 16.57l5.169.862a1 1 0 001.169-1.409l-7-14z" />
    </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MagicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v1a1 1 0 002 0V4a1 1 0 00-1-1zM5.293 6.707a1 1 0 00-1.414 1.414L5 9.293V10a1 1 0 102 0V9.293l1.121-1.121a1 1 0 00-1.414-1.414L6 7.586l-.707-.707zM15 10a1 1 0 011-1h.293l-1.121-1.121a1 1 0 011.414-1.414L17.414 7l.707-.707a1 1 0 011.414 1.414L18.414 9H19a1 1 0 110 2h-.586l1.121 1.121a1 1 0 01-1.414 1.414L17 12.414l-.707.707a1 1 0 01-1.414-1.414L16.293 11H15a1 1 0 01-1-1zM10 15a1 1 0 01-1 1v.293l-1.121 1.121a1 1 0 01-1.414-1.414L7.586 15l-.707-.707a1 1 0 011.414-1.414L9 13.586V13a1 1 0 112 0v.586l.707.707a1 1 0 01-1.414 1.414L10.707 16H10v-1z" clipRule="evenodd" />
  </svg>
);


export const InputPanel: React.FC<InputPanelProps> = ({ formData, onFormChange, onCVChange, onGenerate, isLoading, onStartInterview }) => {
  const [fileName, setFileName] = useState('');
  const [cvInputMode, setCvInputMode] = useState<CVInputMode>('paste');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      
      if (file.type === 'application/pdf') {
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const base64 = dataUrl.split(',')[1];
          onCVChange({ file: { base64, mimeType: file.type } });
        };
        reader.readAsDataURL(file);
      } else { // txt, md
        reader.onload = (event) => {
          const text = event.target?.result as string;
          onCVChange({ text });
        };
        reader.onerror = () => {
          console.error("Error reading file");
          setFileName('Error reading file');
        }
        reader.readAsText(file);
      }
    }
  };
  
  const getButtonClass = (mode: CVInputMode) => 
    `px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
      cvInputMode === mode 
        ? 'bg-indigo-600 text-white' 
        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
    }`;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6 h-full flex flex-col">
        <h2 className="text-xl font-semibold text-slate-700 border-b pb-3">Your Profile</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
                <label htmlFor="fullName" className="block mb-2 font-medium text-slate-600">Full Name</label>
                <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => onFormChange('fullName', e.target.value)}
                    placeholder="e.g. Alex Doe"
                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                    />
            </div>
            <div>
                <label htmlFor="email" className="block mb-2 font-medium text-slate-600">Email Address</label>
                <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => onFormChange('email', e.target.value)}
                    placeholder="e.g. alex.doe@email.com"
                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                    />
            </div>
            <div>
                <label htmlFor="phone" className="block mb-2 font-medium text-slate-600">Phone Number</label>
                <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => onFormChange('phone', e.target.value)}
                    placeholder="e.g. +1 (555) 123-4567"
                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                    />
            </div>
            <div className="md:col-span-2">
                <label htmlFor="address" className="block mb-2 font-medium text-slate-600">Address</label>
                <textarea
                    id="address"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => onFormChange('address', e.target.value)}
                    placeholder="123 Innovation Drive, Techville, CA 94043"
                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                    />
            </div>
        </div>

        <div className="flex-grow flex flex-col space-y-6">
            <div className="flex flex-col flex-grow">
                <label className="mb-2 font-medium text-slate-600">CV/Résumé</label>
                <div className="flex space-x-2 mb-3">
                  <button onClick={() => setCvInputMode('paste')} className={getButtonClass('paste')}>Paste Text</button>
                  <button onClick={() => setCvInputMode('upload')} className={getButtonClass('upload')}>Upload File</button>
                  <button onClick={() => { setCvInputMode('create'); onStartInterview(); }} className={getButtonClass('create')}>Create with AI</button>
                </div>
                
                {cvInputMode === 'paste' && (
                  <textarea
                      id="cv"
                      value={formData.cv.text || ''}
                      onChange={(e) => {
                        onCVChange({ text: e.target.value });
                        if (fileName) setFileName('');
                      }}
                      placeholder="Paste your full CV content here. / Masukkan konten CV lengkap Anda di sini."
                      className="w-full h-32 flex-grow p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-sm bg-slate-800 text-white placeholder-slate-400"
                  />
                )}

                {cvInputMode === 'upload' && (
                  <div className="flex flex-col items-center justify-center w-full h-32 p-3 border-2 border-dashed border-slate-300 rounded-md bg-slate-50">
                    <label htmlFor="cv-upload" className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-md cursor-pointer hover:bg-slate-200 transition duration-150 text-sm font-medium">
                      <UploadIcon />
                      Upload .pdf, .txt, or .md
                    </label>
                    <input id="cv-upload" type="file" className="hidden" onChange={handleFileChange} accept=".txt,.md,.text,.pdf" />
                    {fileName && <span className="mt-2 text-sm text-slate-500 truncate">{fileName}</span>}
                  </div>
                )}
                 {cvInputMode === 'create' && (
                  <div className="flex flex-col items-center justify-center w-full h-32 p-3 border-2 border-dashed border-slate-300 rounded-md bg-slate-50">
                    <MagicIcon />
                    <p className="mt-2 text-sm text-slate-600">The AI interview has been launched.</p>
                    <p className="text-xs text-slate-500">Close the pop-up to cancel.</p>
                  </div>
                )}
            </div>

            <div className="flex flex-col flex-grow">
                <label htmlFor="jobDescription" className="mb-2 font-medium text-slate-600">Job Description</label>
                <textarea
                    id="jobDescription"
                    value={formData.jobDescription}
                    onChange={(e) => onFormChange('jobDescription', e.target.value)}
                    placeholder="Paste the target job description here... / Masukkan deskripsi pekerjaan di sini..."
                    className="w-full h-32 flex-grow p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-sm bg-slate-800 text-white placeholder-slate-400"
                />
            </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-700 border-b pb-3 mb-4">Application Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label htmlFor="jobTitle" className="block mb-2 font-medium text-slate-600">Job Title</label>
                  <input
                      id="jobTitle"
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => onFormChange('jobTitle', e.target.value)}
                      placeholder="e.g. Senior Software Engineer"
                      className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                  />
              </div>
               <div>
                  <label htmlFor="companyName" className="block mb-2 font-medium text-slate-600">Company Name</label>
                  <input
                      id="companyName"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => onFormChange('companyName', e.target.value)}
                      placeholder="e.g. Innovatech Solutions"
                      className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-slate-800 text-white placeholder-slate-400"
                  />
              </div>
              <div>
                  <label htmlFor="language" className="block mb-2 font-medium text-slate-600">Language</label>
                  <select
                      id="language"
                      value={formData.language}
                      onChange={(e) => onFormChange('language', e.target.value as any)}
                      className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-white"
                  >
                      {LANGUAGE_OPTIONS.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="tone" className="block mb-2 font-medium text-slate-600">Tone of Voice</label>
                  <select
                      id="tone"
                      value={formData.tone}
                      onChange={(e) => onFormChange('tone', e.target.value as any)}
                      className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-white"
                  >
                      {TONE_OPTIONS.map(tone => <option key={tone} value={tone}>{tone}</option>)}
                  </select>
              </div>
               <div className="md:col-span-2">
                  <label htmlFor="companyType" className="block mb-2 font-medium text-slate-600">Company Type</label>
                  <select
                      id="companyType"
                      value={formData.companyType}
                      onChange={(e) => onFormChange('companyType', e.target.value as any)}
                      className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out bg-white"
                  >
                      {COMPANY_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
              </div>
          </div>
        </div>

        <button
            onClick={onGenerate}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition duration-300 ease-in-out"
        >
            <GenerateIcon/>
            {isLoading ? 'Generating...' : 'Craft My Application Kit'}
        </button>
    </div>
  );
};