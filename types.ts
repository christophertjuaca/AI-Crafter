export enum Tone {
  Professional = 'Professional',
  Enthusiastic = 'Enthusiastic',
  Creative = 'Creative',
  Formal = 'Formal',
  DataDriven = 'Data-Driven',
}

export enum CompanyType {
  Startup = 'Fast-paced Startup',
  Corporate = 'Established Corporation',
  NonProfit = 'Non-Profit Organization',
  Tech = 'Innovative Tech Company',
  Government = 'Government Agency',
}

export enum Language {
  English = 'English',
  BahasaIndonesia = 'Bahasa Indonesia',
}

export interface CVInput {
  text?: string;
  file?: {
    base64: string;
    mimeType: string;
  };
}

export interface CoverLetterRequest {
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

export interface Score {
  score: number;
  summary: string;
}

export interface GeneratedScores {
  jobFit: Score;
  company: Score;
  ats: Score;
}

export interface GeneratedContent {
  coverLetter: string;
  revampedCV: string;
  linkedinMessage: string;
  scores: GeneratedScores;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface HistoryItem {
  id: number;
  formData: CoverLetterRequest;
  generatedContent: GeneratedContent;
  sources: any[];
}