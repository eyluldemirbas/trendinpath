import * as XLSX from "xlsx";
import type { TrendingTopic } from "./trends";
import type { PubMedArticle } from "./pubmed";
import { getPubMedUrl } from "./pubmed";

export interface TopicWithArticles {
  topic: TrendingTopic;
  articles: PubMedArticle[];
}

function buildRows(data: TopicWithArticles[]) {
  const rows: Record<string, string>[] = [];
  for (const { topic, articles } of data) {
    for (const a of articles) {
      rows.push({
        Topic: topic.phrase,
        Title: a.title,
        Journal: a.journal,
        Year: a.pubDate,
        PMID: a.pmid,
        "PubMed URL": getPubMedUrl(a.pmid),
      });
    }
  }
  return rows;
}

export function exportExcel(data: TopicWithArticles[], filename = "pathscan-report.xlsx") {
  const rows = buildRows(data);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PathScan Report");

  ws["!cols"] = [
    { wch: 30 },
    { wch: 60 },
    { wch: 35 },
    { wch: 10 },
    { wch: 12 },
    { wch: 45 },
  ];

  XLSX.writeFile(wb, filename);
}

export function exportCSV(data: TopicWithArticles[], filename = "pathscan-report.csv") {
  const rows = buildRows(data);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadText(csv, filename, "text/csv");
}

export function exportMarkdown(
  data: TopicWithArticles[],
  scanDate: Date,
  filename = "pathscan-report.md"
) {
  let md = `# PathScan Monthly Pathology Trend Report\n\n`;
  md += `**Generated:** ${scanDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}\n\n`;
  md += `---\n\n`;
  md += `## Top Trending Pathology Topics\n\n`;

  data.forEach((d, i) => {
    md += `${i + 1}. **${d.topic.phrase}** (${d.topic.articleCount} articles)\n`;
  });

  md += `\n---\n\n`;
  md += `## Detailed Topic Reports\n\n`;

  for (const { topic, articles } of data) {
    md += `### ${topic.phrase}\n\n`;
    if (topic.summary) md += `*${topic.summary}*\n\n`;
    md += `*Articles: ${topic.articleCount}*\n\n`;
    md += `| # | Title | Journal | Year | PMID |\n`;
    md += `|---|-------|---------|------|------|\n`;
    articles.forEach((a, i) => {
      md += `| ${i + 1} | ${a.title} | ${a.journal} | ${a.pubDate} | [${a.pmid}](https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/) |\n`;
    });
    md += `\n`;
  }

  downloadText(md, filename, "text/markdown");
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
