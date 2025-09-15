import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat, Type } from "@google/genai";
import { jsPDF } from 'jspdf';

// --- START OF types.ts ---
enum Tone {
  Professional = 'Professional',
  Enthusiastic = 'Enthusiastic',
  Creative = 'Creative',
  Formal = 'Formal',
  DataDriven = 'Data-Driven',
}

enum CompanyType {
  Startup = 'Fast-paced Startup',
  Corporate = 'Established Corporation',
  NonProfit = 'Non-Profit Organization',
  Tech = 'Innovative Tech Company',
  Government = 'Government Agency',
}

enum Language {
  English = 'English',
  BahasaIndonesia = 'Bahasa Indonesia',
}

interface CVInput {
  text?: string;
  file?: {
    base64: string;
    mimeType: string;
  };
}

interface CoverLetterRequest {
  cv: CVInput;
  jobDescription: string;
  tone: Tone;
  companyType: CompanyType;
  companyName: string;
  jobTitle: string;
  language: Language;
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

interface Score {
  score: number;
  summary: string;
}

interface GeneratedScores {
  jobFit: Score;
  company: Score;
  ats: Score;
}

interface GeneratedContent {
  coverLetter: string;
  revampedCV: string;
  linkedinMessage: string;
  scores: GeneratedScores;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface HistoryItem {
  id: number;
  formData: CoverLetterRequest;
  generatedContent: GeneratedContent;
  sources: any[];
}
// --- END OF types.ts ---

// --- START OF constants.ts ---
const TONE_OPTIONS: Tone[] = Object.values(Tone);
const COMPANY_TYPE_OPTIONS: CompanyType[] = Object.values(CompanyType);
const LANGUAGE_OPTIONS: Language[] = Object.values(Language);
// --- END OF constants.ts ---

// --- START OF services/pdfGenerator.ts ---
const generateCVPdf = (cvText: string, personalDetails: CoverLetterRequest) => {
    const doc = new jsPDF('p', 'pt', 'letter');
    const page = {
        width: doc.internal.pageSize.getWidth(),
        height: doc.internal.pageSize.getHeight(),
        margin: 72, // 1 inch
    };
    const contentWidth = page.width - (page.margin * 2);

    let y = page.margin;

    // --- HEADER ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(personalDetails.fullName.toUpperCase(), page.width / 2, y, { align: 'center' });
    y += 28;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const contactInfo = [
        personalDetails.address,
        personalDetails.phone,
        personalDetails.email
    ].filter(Boolean).join(' | ');
    doc.text(contactInfo, page.width / 2, y, { align: 'center' });
    y += 30;

    // --- BODY PARSING ---
    const sections = cvText.split(/\n(?=[A-Z][A-Z\s]+$)/m);
    
    sections.forEach(section => {
        if (!section.trim()) return;

        const lines = section.trim().split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n');

        const contentHeight = doc.getTextDimensions(content, { maxWidth: contentWidth, fontSize: 11 }).h;
        if (y + 20 + contentHeight > page.height - page.margin) {
            doc.addPage();
            y = page.margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), page.margin, y);
        y += 5;
        doc.setLineWidth(1.5);
        doc.line(page.margin, y, page.width - page.margin, y);
        y += 18;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        const contentLines = content.trim().split('\n');
        
        contentLines.forEach(line => {
            if (!line.trim()) return;

            const checkPageBreak = (neededHeight: number) => {
                 if (y + neededHeight > page.height - page.margin) {
                    doc.addPage();
                    y = page.margin;
                }
            }

            const isBullet = line.match(/^[\s•*-\u2022]/);
            const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Full-time|\d{4})\b/i;

            if (isBullet) {
                const bulletText = line.replace(/^[\s•*-\u2022]\s*/, '');
                checkPageBreak(20);
                const wrappedBullet = doc.splitTextToSize(bulletText, contentWidth - 15);
                doc.text('•', page.margin + 8, y);
                doc.text(wrappedBullet, page.margin + 20, y);
                y += wrappedBullet.length * 12;

            } else if (dateRegex.test(line)) {
                checkPageBreak(20);
                let titlePart = line;
                let datePart = '';
                
                const match = line.match(new RegExp(`(.*)(${dateRegex.source}.*)`, 'i'));
                if (match && match[2] && match[2].length > 4) {
                    titlePart = match[1].trim();
                    datePart = match[2].trim();
                }

                doc.setFont('helvetica', 'bold');
                doc.text(titlePart, page.margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(datePart, page.width - page.margin, y, { align: 'right' });
                y += 14;

            } else {
                checkPageBreak(20);
                doc.setFont('helvetica', 'italic');
                const wrappedLine = doc.splitTextToSize(line, contentWidth);
                doc.text(wrappedLine, page.margin, y);
                y += wrappedLine.length * 12 + 2;
            }
        });

        y += 10;
    });

    doc.save(`${personalDetails.fullName.replace(/\s/g, '_')}_CV.pdf`);
};
// --- END OF services/pdfGenerator.ts ---


// --- START OF services/geminiService.ts ---
const getAiClient = () => {
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;
  if (!apiKey) {
    throw new Error("API_KEY is not configured for this environment. The application cannot contact the AI service.");
  }
  return new GoogleGenAI({ apiKey });
};

async function generateHiringDocuments(request: CoverLetterRequest): Promise<{ content: GeneratedContent; sources: any[] }> {
  const { cv, jobDescription, tone, companyType, companyName, jobTitle, language, fullName, email, phone, address } = request;

  const mainPrompt = `
    Act as an expert career coach and professional resume writer. Your task is to generate three professional documents (cover letter, revamped CV, LinkedIn message) and a detailed analysis with three scores.
    The candidate's original CV is provided as a separate data part (either text or a file).
    Use your search tool to find information about the company to better tailor all outputs.
    
    **Candidate's Personal Details:**
    Full Name: ${fullName}
    Email: ${email}
    Phone: ${phone}
    Address: ${address}

    **Output Language:**
    All documents and analysis summaries MUST be written entirely in **${language}**.
    
    **Job Title:**
    ${jobTitle}

    **Company Name to Research:**
    ${companyName}

    **Job Description:**
    \`\`\`
    ${jobDescription}
    \`\`\`

    **Instructions for Written Documents:**
    1.  **Research:** First, research the company: **${companyName}**. Find its mission, values, recent projects, and overall culture.
    2.  **Analyze:** Thoroughly analyze the provided CV, the job title, and the job description to identify the most relevant skills and experiences.
    3.  **Tone & Style:** The tone must be strictly **${tone}**, and the style tailored to a **${companyType}**.
    4.  **Cover Letter:** Craft a concise, impactful cover letter for the role of '${jobTitle}' using the candidate's details. Subtly weave in company research. Avoid generic filler phrases.
    5.  **Revamped CV:** Rewrite the provided CV to be perfectly tailored for this job. Add the candidate's personal details at the top. **IMPORTANT FOR PDF FORMATTING:** Structure the CV with clear, standard section titles in all-caps (e.g., "PROFESSIONAL SUMMARY", "WORK EXPERIENCE", "EDUCATION", "SKILLS"). Each section title must be on its own line. For each entry under "WORK EXPERIENCE" or "EDUCATION", place the organization/company, title/degree, and dates on a single line. Follow this with bullet points for responsibilities or details on subsequent lines.
    6.  **LinkedIn Message:** Write a concise (under 300 characters) message to a recruiter at '${companyName}' for the '${jobTitle}' position, introducing the candidate (${fullName}).
    
    **Instructions for Scoring (IMPORTANT):**
    You must provide three scores, each with a numerical value out of 100 and a brief summary.
    1.  **Job Fit Score:**
        -   **Score:** Analyze the candidate's CV against the job description for the '${jobTitle}' role. Provide a score from 0-100 on how well their experience aligns with the role's requirements.
        -   **Summary:** Briefly explain the score, highlighting 1-2 key strengths and 1-2 potential gaps or areas to emphasize.
    2.  **Company Score:**
        -   **Score:** Use your search tool to research employee reviews, culture, work-life balance, and recent news for '${companyName}'. Provide a score from 0-100 representing how good of a workplace it appears to be.
        -   **Summary:** Briefly justify the score based on your research findings (e.g., mentions positive reviews, recent awards, or common complaints).
    3.  **ATS Score:**
        -   **Score:** Evaluate the 'Revamped CV' you just generated for Applicant Tracking System (ATS) friendliness. Consider formatting, keywords, and clarity. Provide a score from 0-100.
        -   **Summary:** Explain why the revamped CV is ATS-friendly and provide one key tip for the candidate to remember for future applications.

    **IMPORTANT Final Output Instruction:**
    Your final response MUST be a single, valid JSON object. Do not wrap it in markdown backticks (e.g., \`\`\`json).
    The JSON object must have the following structure:
    {
      "coverLetter": "...",
      "revampedCV": "...",
      "linkedinMessage": "...",
      "scores": {
        "jobFit": { "score": <number>, "summary": "..." },
        "company": { "score": <number>, "summary": "..." },
        "ats": { "score": <number>, "summary": "..." }
      }
    }
  `;
  
  const parts: any[] = [{ text: mainPrompt }];

  if (cv.text) {
    parts.push({ text: "\n\n--- CANDIDATE'S ORIGINAL CV ---\n" + cv.text });
  } else if (cv.file) {
    parts.push({
      inlineData: {
        data: cv.file.base64,
        mimeType: cv.file.mimeType,
      },
    });
  }

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        tools: [{googleSearch: {}}],
      },
    });
    
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7, -3).trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3, -3).trim();
    }
    
    const content: GeneratedContent = JSON.parse(jsonStr);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    return { content, sources };
  } catch (error) {
    console.error("Error generating content from Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to communicate with the AI model: ${error.message}`);
    }
    throw new Error("Failed to communicate with the AI model. Please check your API key and network connection.");
  }
}

function createCVInterviewChat(language: Language): Chat {
  const isEnglish = language === Language.English;
  
  const systemInstruction = `You are a friendly and professional career coach. Your goal is to conduct an interview to build a comprehensive and professional CV for the user.
  **IMPORTANT: You MUST conduct the entire interview in ${language}. All your questions must be in ${language}.**
  Ask questions one by one, covering the following sections in order:
  1.  **Personal Details:** ${isEnglish ? "Full Name, Phone Number, Email, LinkedIn Profile URL (optional)." : "Nama Lengkap, Nomor Telepon, Email, URL Profil LinkedIn (opsional)."}
  2.  **Professional Summary:** ${isEnglish ? "A brief, 2-3 sentence summary of their career." : "Ringkasan singkat 2-3 kalimat tentang karir mereka."}
  3.  **Work Experience:** ${isEnglish ? "For each role (starting with the most recent), ask for Job Title, Company, Location, and Start/End Dates. Then, ask for 3-5 key responsibilities or achievements as bullet points. Ask if they have more roles to add." : "Untuk setiap peran (dimulai dari yang terbaru), tanyakan Jabatan, Perusahaan, Lokasi, dan Tanggal Mulai/Selesai. Kemudian, tanyakan 3-5 tanggung jawab atau pencapaian utama sebagai poin-poin. Tanyakan apakah mereka ingin menambahkan peran lain."}
  4.  **Education:** ${isEnglish ? "For each degree, ask for Degree Name, University, Location, and Graduation Date." : "Untuk setiap gelar, tanyakan Nama Gelar, Universitas, Lokasi, dan Tanggal Lulus."}
  5.  **Skills:** ${isEnglish ? "Ask for a list of their key technical and soft skills." : "Minta daftar keahlian teknis dan soft skill utama mereka."}
  6.  **Projects (Optional):** ${isEnglish ? "Ask if they have any personal or academic projects they'd like to include. If so, get the project name, a brief description, and the technologies used." : "Tanyakan apakah mereka memiliki proyek pribadi atau akademis yang ingin disertakan. Jika ya, dapatkan nama proyek, deskripsi singkat, dan teknologi yang digunakan."}

  Keep your questions clear, concise, and encouraging. Once you have gathered all the information, end the conversation by saying '${isEnglish ? "Thank you! I have all the information needed to create your CV." : "Terima kasih! Saya memiliki semua informasi yang dibutuhkan untuk membuat CV Anda."}'`;
  
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction },
  });
}

async function generateCVFromHistory(messages: ChatMessage[]): Promise<string> {
  const transcript = messages.map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`).join('\n');

  const prompt = `
    Based on the following interview transcript, create a professional, well-formatted CV in plain text.
    The CV should be clean, easy to read, and follow a standard professional format.
    Do not include any introductory text like "Here is the CV". Output only the CV content itself.

    **Interview Transcript:**
    \`\`\`
    ${transcript}
    \`\`\`
  `;
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating CV from history:", error);
    throw new Error("Failed to generate the CV from the interview conversation.");
  }
}
// --- END OF services/geminiService.ts ---

// --- START OF components/Header.tsx ---
const DocumentIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const HistoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.5-11.5a.5.5 0 00-1 0v5.793l-3.146 3.147a.5.5 0 00.708.708L10.5 12.207V6.5z" clipRule="evenodd" />
    </svg>
);

interface HeaderProps {
    onOpenHistory: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenHistory }) => {
    return (
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <DocumentIcon />
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">AI Cover Letter Crafter</h1>
                      <p className="text-sm text-slate-500">Generate a personalized cover letter in seconds.</p>
                    </div>
                </div>
                <button 
                    onClick={onOpenHistory}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <HistoryIcon />
                    History
                </button>
            </div>
        </header>
    );
};
// --- END OF components/Header.tsx ---

// --- START OF components/InputPanel.tsx ---
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


const InputPanel: React.FC<InputPanelProps> = ({ formData, onFormChange, onCVChange, onGenerate, isLoading, onStartInterview }) => {
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
// --- END OF components/InputPanel.tsx ---

// --- START OF components/OutputPanel.tsx ---
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

const OutputPanel: React.FC<OutputPanelProps> = ({ content, isLoading, error, sources, formData }) => {
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
    else return;

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
// --- END OF components/OutputPanel.tsx ---

// --- START OF components/CVInterviewModal.tsx ---
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
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
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

const CVInterviewModal: React.FC<CVInterviewModalProps> = ({ isOpen, onClose, onComplete, language }) => {
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
    if (!('speechSynthesis' in window) || !isSpeechEnabled) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'English' ? 'en-US' : 'id-ID';
    speechSynthesis.speak(utterance);
  }, [language, isSpeechEnabled]);

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
          speak(initialResponse.text);
        } catch (err) {
            setError('Failed to start the interview. Please check your connection and API key.');
            console.error(err);
        } finally {
            setIsAiThinking(false);
        }
      };
      startChat();
    } else {
      setMessages([]);
      setUserInput('');
      setChat(null);
      setIsAiThinking(false);
      setIsGenerating(false);
      setError(null);
      if (recognition && isListening) recognition.stop();
      setIsListening(false);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  }, [isOpen, language, speak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);
  
  useEffect(() => {
    if (!recognition) return;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'English' ? 'en-US' : 'id-ID';

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setUserInput(prev => prev + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error(`Speech recognition error: ${event.error}`);
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };
  }, [language]);

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
      speak(response.text);
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
        handleSendMessage();
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
            {messages.length > 1 && !isAiThinking && (messages[messages.length-1].text.includes("Thank you") || messages[messages.length-1].text.includes("Terima kasih")) && (
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
// --- END OF components/CVInterviewModal.tsx ---

// --- START OF components/CVReviewModal.tsx ---
interface CVReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onRecreate: () => void;
  cvContent: string;
}

const CVReviewModal: React.FC<CVReviewModalProps> = ({ isOpen, onClose, onAccept, onRecreate, cvContent }) => {
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
// --- END OF components/CVReviewModal.tsx ---

// --- START OF components/HistoryModal.tsx ---
interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: number) => void;
}

const ViewIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
);

const DeleteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onLoad, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[90vh] max-h-[800px] flex flex-col">
        <header className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Application History</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
        </header>

        <main className="flex-grow p-4 overflow-y-auto bg-slate-50">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 4l-4 4 4 4m8 8l4-4-4-4" />
                </svg>
                <h3 className="font-semibold text-lg text-slate-600">No History Yet</h3>
                <p className="mt-1">Your generated application kits will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-indigo-700">{item.formData.jobTitle}</h3>
                    <p className="text-sm text-slate-600">{item.formData.companyName}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Generated on: {new Date(item.id).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => onLoad(item)}
                        className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50"
                    >
                        <ViewIcon/> View
                    </button>
                    <button 
                        onClick={() => onDelete(item.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                    >
                       <DeleteIcon /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
// --- END OF components/HistoryModal.tsx ---

// --- START OF components/InterviewLanguageModal.tsx ---
interface InterviewLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (language: Language) => void;
}

const InterviewLanguageModal: React.FC<InterviewLanguageModalProps> = ({ isOpen, onClose, onSelect }) => {
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
// --- END OF components/InterviewLanguageModal.tsx ---

// --- START OF App.tsx ---
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
// --- END OF App.tsx ---

// --- START OF index.tsx ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// --- END OF index.tsx ---
