import { GoogleGenAI, Chat, Type } from "@google/genai";
import type { CoverLetterRequest, ChatMessage, GeneratedContent } from '../types';
import { Language } from '../types';

// Helper function to get the AI client on demand
// This prevents a crash on load if the API key isn't set.
const getAiClient = () => {
  // In a browser environment, 'process' is not defined. We must check for its existence.
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;

  if (!apiKey) {
    throw new Error("API_KEY is not configured for this environment. The application cannot contact the AI service.");
  }
  return new GoogleGenAI({ apiKey });
};


export async function generateHiringDocuments(request: CoverLetterRequest): Promise<{ content: GeneratedContent; sources: any[] }> {
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
    const ai = getAiClient(); // Get client here
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        tools: [{googleSearch: {}}],
      },
    });
    
    let jsonStr = response.text.trim();
    // The model might still wrap the output in markdown, so we need to clean it.
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

export function createCVInterviewChat(language: Language): Chat {
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
  
  const ai = getAiClient(); // Get client here
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction },
  });
}

export async function generateCVFromHistory(messages: ChatMessage[]): Promise<string> {
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
    const ai = getAiClient(); // Get client here
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