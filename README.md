# TrendInPath

TrendInPath is a lightweight literature analysis tool that identifies emerging research topics in pathology.

The platform scans recent publications from leading pathology journals, clusters related papers into research themes, and compares topic frequency across time to highlight rising or declining trends.

🔗 Live application  
https://trendinpath.lovable.app/

---

## Features

• Rolling 3-month literature window  
• Topic clustering of PubMed articles  
• Subspecialty filtering (dermatopathology, GI pathology, hematopathology, etc.)  
• Trend comparison (rising / stable / declining topics)  
• Export results to Excel, CSV, or Markdown  

---

## Example Output

TrendInPath organizes recent publications into interpretable research themes.

Examples of detected topics may include:

- Tumor immune microenvironment  
- AI-assisted histopathology  
- Molecular classification of tumors  
- Viral-associated malignancies  

Each topic groups related papers and highlights whether the research activity appears to be increasing or decreasing.

---

## Data Sources

TrendInPath retrieves articles through:

- PubMed
- Selected leading pathology journals

Articles are filtered and analyzed within a rolling 90-day window.

---

## Methodology

The analysis pipeline consists of:

1. Literature retrieval from PubMed
2. Filtering of low-signal publications (case reports, editorials, etc.)
3. Text feature extraction using titles, MeSH terms, and keywords
4. Topic clustering
5. Trend comparison between recent and baseline time windows
6. Topic summarization

More details:  
`docs/methodology.md`

---

## Purpose

TrendInPath was built as an exploratory tool to investigate whether clustering recent literature could help researchers quickly identify emerging directions in pathology.

It is not intended to replace systematic literature searches.

---

## Feedback

Suggestions and improvements are welcome.

If you have ideas or notice issues, feel free to open an issue in this repository.

---

## License

MIT License
