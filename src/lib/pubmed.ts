const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export const PATHOLOGY_JOURNALS = [
  "Modern Pathology",
  "Histopathology",
  "American Journal of Surgical Pathology",
  "Human Pathology",
  "Virchows Archiv",
  "Archives of Pathology and Laboratory Medicine",
  "Annals of Diagnostic Pathology",
  "International Journal of Surgical Pathology",
  "Pathology Research and Practice",
  "Diagnostic Pathology",
  "Journal of Pathology",
  "Pathology",
  "APMIS",
  "Pathology International",
  "American Journal of Clinical Pathology",
  "Turkish Journal of Pathology",
];

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string;
  keywords: string[];
  meshTerms: string[];
  publicationTypes: string[];
}

export interface ScanProgress {
  currentJournal: string;
  journalIndex: number;
  totalJournals: number;
  articlesFound: number;
  phase: "searching" | "fetching" | "analyzing" | "expanding" | "done";
}

function buildJournalQuery(journals: string[]): string {
  return journals.map((j) => `"${j}"[Journal]`).join(" OR ");
}

function getDateRange(): { minDate: string; maxDate: string } {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return { minDate: fmt(threeMonthsAgo), maxDate: fmt(now) };
}

export async function searchPubMed(
  query: string,
  retmax = 500
): Promise<string[]> {
  const { minDate, maxDate } = getDateRange();
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    retmode: "json",
    datetype: "pdat",
    mindate: minDate,
    maxdate: maxDate,
    sort: "date",
  });

  const res = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params}`);
  const data = await res.json();
  return data.esearchresult?.idlist || [];
}

export async function searchPubMedNoDate(
  query: string,
  retmax = 10
): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    retmode: "json",
    sort: "relevance",
  });

  const res = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params}`);
  const data = await res.json();
  return data.esearchresult?.idlist || [];
}

function parseXMLText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function parseXMLTexts(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gs");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/<[^>]+>/g, "").trim());
  }
  return results;
}

function parseArticleFromXML(articleXml: string): PubMedArticle {
  const pmid = parseXMLText(articleXml, "PMID");
  const title = parseXMLText(articleXml, "ArticleTitle");
  const abstract = parseXMLText(articleXml, "AbstractText") || parseXMLText(articleXml, "Abstract");
  const journal = parseXMLText(articleXml, "Title");

  const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
  const monthMatch = articleXml.match(/<PubDate>[\s\S]*?<Month>(\w+)<\/Month>/);
  const pubDate = yearMatch
    ? `${yearMatch[1]}${monthMatch ? ` ${monthMatch[1]}` : ""}`
    : "";

  const keywords = parseXMLTexts(articleXml, "Keyword");
  const meshTerms = parseXMLTexts(articleXml, "DescriptorName");
  const publicationTypes = parseXMLTexts(articleXml, "PublicationType");

  return { pmid, title, abstract, journal, pubDate, keywords, meshTerms, publicationTypes };
}

export async function fetchArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const batchSize = 100;
  const articles: PubMedArticle[] = [];

  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);
    const params = new URLSearchParams({
      db: "pubmed",
      id: batch.join(","),
      retmode: "xml",
      rettype: "abstract",
    });

    const res = await fetch(`${EUTILS_BASE}/efetch.fcgi?${params}`);
    const xml = await res.text();

    const articleRegex = /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g;
    let match;
    while ((match = articleRegex.exec(xml)) !== null) {
      articles.push(parseArticleFromXML(match[0]));
    }

    // Rate limit: NCBI allows 3 requests/sec without API key
    if (i + batchSize < pmids.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return articles;
}

export async function scanJournals(
  onProgress?: (p: ScanProgress) => void
): Promise<PubMedArticle[]> {
  const journalQuery = buildJournalQuery(PATHOLOGY_JOURNALS);

  onProgress?.({
    currentJournal: "All journals",
    journalIndex: 0,
    totalJournals: 1,
    articlesFound: 0,
    phase: "searching",
  });

  const pmids = await searchPubMed(journalQuery, 1000);

  onProgress?.({
    currentJournal: "All journals",
    journalIndex: 0,
    totalJournals: 1,
    articlesFound: pmids.length,
    phase: "fetching",
  });

  const articles = await fetchArticles(pmids);

  onProgress?.({
    currentJournal: "Complete",
    journalIndex: 1,
    totalJournals: 1,
    articlesFound: articles.length,
    phase: "done",
  });

  return articles;
}

export function getPubMedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}
