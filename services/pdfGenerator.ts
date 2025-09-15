import { jsPDF } from 'jspdf';
import type { CoverLetterRequest } from '../types';

export const generateCVPdf = (cvText: string, personalDetails: CoverLetterRequest) => {
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
    // Split by lines that are all-caps, which we've designated as section headers
    const sections = cvText.split(/\n(?=[A-Z][A-Z\s]+$)/m);
    
    sections.forEach(section => {
        if (!section.trim()) return;

        const lines = section.trim().split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n');

        // Estimate content height to check for page break
        const contentHeight = doc.getTextDimensions(content, { maxWidth: contentWidth, fontSize: 11 }).h;
        if (y + 20 + contentHeight > page.height - page.margin) {
            doc.addPage();
            y = page.margin;
        }

        // Section Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(title.toUpperCase(), page.margin, y);
        y += 5;
        doc.setLineWidth(1.5);
        doc.line(page.margin, y, page.width - page.margin, y);
        y += 18;

        // Reset font for section content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        const contentLines = content.trim().split('\n');
        
        contentLines.forEach(line => {
            if (!line.trim()) return;

            // Check if Y position is near the bottom margin
            const checkPageBreak = (neededHeight: number) => {
                 if (y + neededHeight > page.height - page.margin) {
                    doc.addPage();
                    y = page.margin;
                }
            }

            const isBullet = line.match(/^[\s•*-\u2022]/);
            // Regex to find a date, common in resume job entries
            const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Full-time|\d{4})\b/i;

            if (isBullet) {
                const bulletText = line.replace(/^[\s•*-\u2022]\s*/, ''); // Clean bullet point
                checkPageBreak(20);
                const wrappedBullet = doc.splitTextToSize(bulletText, contentWidth - 15);
                doc.text('•', page.margin + 8, y);
                doc.text(wrappedBullet, page.margin + 20, y);
                y += wrappedBullet.length * 12;

            } else if (dateRegex.test(line)) { // Heuristic: Line with a date is likely a job/degree header
                checkPageBreak(20);
                let titlePart = line;
                let datePart = '';
                
                const match = line.match(new RegExp(`(.*)(${dateRegex.source}.*)`, 'i'));
                if (match && match[2] && match[2].length > 4) { // Check if date part seems plausible
                    titlePart = match[1].trim();
                    datePart = match[2].trim();
                }

                doc.setFont('helvetica', 'bold');
                doc.text(titlePart, page.margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(datePart, page.width - page.margin, y, { align: 'right' });
                y += 14;

            } else { // Handle other lines (like sub-headings or simple text)
                checkPageBreak(20);
                doc.setFont('helvetica', 'italic');
                const wrappedLine = doc.splitTextToSize(line, contentWidth);
                doc.text(wrappedLine, page.margin, y);
                y += wrappedLine.length * 12 + 2;
            }
        });

        y += 10; // Space between sections
    });

    doc.save(`${personalDetails.fullName.replace(/\s/g, '_')}_CV.pdf`);
};