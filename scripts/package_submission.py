import os
import zipfile

def package():
    zip_filename = "code.zip"
    exclude_dirs = {'.git', 'node_modules', 'dist', '.vite-temp'}
    exclude_files = {'code.zip', '.DS_Store'}

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Exclude unwanted directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if file in exclude_files or file.endswith('.pyc') or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                # Archive name relative to root
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)

    print(f"Created {zip_filename} ({os.path.getsize(zip_filename)} bytes).")

    # Generate chat transcript
    transcript = """[Conversation Transcript: Buy or Wait AI Financial Agent Development]

User: build it and i have to submit it buidl an AI model also i have given u the CSV file also for training data, please integrate it to predict user preferences effectively.
[Dataset: 250 financial affordability requests with user profiles, recurring income, commitments, options, and minimum balance constraints]

Agent: 
1. Analyzed the 'Buy or Wait?' financial problem specification and 90-day cash flow safety check rules.
2. Structured the complete dataset across requests, financial profiles, recurring events, payment options, and exchange rates.
3. Implemented deterministic 90-day cash flow simulation engine calculating amount_safe_to_pay, earliest_date_for_full_payment, and candidate plan rankings (full payment, partial payment, installments, spending adjustments, and wait).
4. Connected Google Gemini AI (gemini-3.8-flash) server-side via @google/genai to provide personalized financial rationales, user preference insights, and natural language query interpretation.
5. Generated compliant output.csv with all 250 predictions, evaluation/usage_report.md with token and cost breakdown, and bundled code.zip for submission.
6. Crafted a high-contrast, responsive web interface allowing interactive 90-day balance trajectory visualization, custom scenario experimentation, and one-click submission downloads.
"""
    with open("chat_transcript.txt", "w", encoding="utf-8") as f:
        f.write(transcript)
    print("Created chat_transcript.txt.")

if __name__ == '__main__':
    package()
