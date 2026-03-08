import type { PubMedArticle } from "./pubmed";
import { searchPubMedNoDate } from "./pubmed";

// Domain-specific stopwords for biomedical/pathology literature
const GENERAL_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "shall", "can", "this", "that", "these", "those", "it", "its",
  "not", "no", "nor", "as", "if", "then", "than", "so", "up", "out", "about",
  "into", "through", "during", "before", "after", "above", "below", "between",
  "same", "each", "every", "both", "all", "any", "few", "more", "most", "other",
  "some", "such", "only", "own", "also", "just", "over", "very", "we", "our",
  "they", "their", "them", "he", "she", "him", "her", "his", "who", "which",
  "what", "when", "where", "how", "why", "here", "there", "two", "one", "first",
  "new", "used", "using", "use", "based", "associated", "per", "et", "al", "vs",
  "ci", "number", "however", "among", "well", "including", "included", "compared",
  "three", "four", "five", "six", "seven", "eight", "nine", "ten", "whether",
  "thus", "although", "still", "yet", "often", "many", "several", "like", "less",
  "greater", "smaller", "larger", "higher", "lower", "increased", "decreased",
]);

const BIOMEDICAL_STOPWORDS = new Set([
  // Generic clinical/study terms
  "patient", "patients", "male", "female", "case", "cases", "study", "studies",
  "result", "results", "analysis", "review", "retrospective", "prospective",
  "clinical", "diagnostic", "diagnosis", "diagnosed", "treatment", "treated",
  "therapy", "prognosis", "prognostic", "outcome", "outcomes", "survival",
  "conclusion", "conclusions", "background", "methods", "method", "objective",
  "objectives", "purpose", "findings", "data", "group", "groups", "report",
  "reports", "total", "overall", "respectively", "significant", "significantly",
  "showed", "demonstrated", "observed", "evaluated", "assessed", "examined",
  "reviewed", "performed", "underwent", "revealed", "identified", "present",
  "presented", "presenting", "suggests", "suggested", "indicating", "indicated",
  // Generic pathology terms
  "tumor", "tumour", "tumors", "tumours", "carcinoma", "carcinomas",
  "tissue", "tissues", "cell", "cells", "specimen", "specimens",
  "histological", "histologic", "histopathological", "histopathologic",
  "pathological", "pathologic", "morphological", "morphologic",
  "biopsy", "biopsies", "resection", "excision", "surgical",
  "staining", "stain", "stained", "expression", "positive", "negative",
  "malignant", "benign", "lesion", "lesions", "neoplasm", "neoplasms",
  "grade", "stage", "staging", "grading", "classification",
  // Generic anatomy
  "organ", "organs", "site", "sites", "region", "regions", "area", "areas",
  // Statistics
  "mean", "median", "range", "ratio", "rate", "rates", "percentage",
  "incidence", "prevalence", "correlation", "statistically", "p-value",
  "confidence", "interval", "hazard", "odds", "risk", "factor", "factors",
  // Common verbs in abstracts
  "aim", "aimed", "aims", "investigate", "investigated", "determine",
  "determined", "examine", "explored", "explore", "describe", "described",
  "report", "reported", "discuss", "discussed", "compared", "comparing",
  "evaluate", "evaluating", "assess", "assessing", "measure", "measured",
]);

// Blacklisted output phrases (generic pathology combinations)
const BLACKLISTED_PHRASES = new Set([
  "cell carcinoma", "tumor tissue", "tumour tissue", "case report",
  "case reports", "histological findings", "study patients", "tissue samples",
  "cell line", "cell lines", "male female", "female male", "gene expression",
  "protein expression", "patient age", "age years", "years age",
  "findings suggest", "results suggest", "results showed", "results show",
  "study aimed", "present study", "current study", "findings indicate",
  "clinical features", "clinical characteristics", "histopathological features",
  "histopathological findings", "pathological features", "pathological findings",
  "surgical resection", "differential diagnosis", "rare case", "rare tumor",
  "treatment options", "poor prognosis", "overall survival", "disease free",
  "follow period", "lymph node", "lymph nodes", "risk factors",
  "retrospective study", "prospective study", "cohort study",
  "systematic review", "meta analysis", "literature review",
  "immunohistochemical staining", "immunohistochemical analysis",
  "hematoxylin eosin", "fine needle", "needle aspiration",
]);

function isStopword(w: string): boolean {
  return GENERAL_STOPWORDS.has(w) || BIOMEDICAL_STOPWORDS.has(w);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function getNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n);
    // ALL tokens in the ngram must be non-stopwords
    if (gram.every((t) => !isStopword(t))) {
      ngrams.push(gram.join(" "));
    }
  }
  return ngrams;
}

export interface TrendingTopic {
  phrase: string;
  frequency: number;
  articleCount: number;
  relatedPmids: string[];
  trendScore: number;
  source: "mesh" | "text";
}

/**
 * Extract MeSH-based candidate topics from articles.
 * MeSH terms are curated by NLM and are high-quality descriptors.
 */
function extractMeshTopics(articles: PubMedArticle[]): Map<string, { count: number; pmids: Set<string> }> {
  const meshCounts = new Map<string, { count: number; pmids: Set<string> }>();

  for (const article of articles) {
    const seen = new Set<string>();
    for (const term of article.meshTerms) {
      const normalized = term.toLowerCase().trim();
      // Skip single generic words
      if (normalized.split(/\s+/).length < 2) continue;
      if (isBlacklisted(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const existing = meshCounts.get(normalized);
      if (existing) {
        existing.count++;
        existing.pmids.add(article.pmid);
      } else {
        meshCounts.set(normalized, { count: 1, pmids: new Set([article.pmid]) });
      }
    }

    // Also use author keywords (often high quality)
    for (const kw of article.keywords) {
      const normalized = kw.toLowerCase().trim();
      if (normalized.split(/\s+/).length < 2) continue;
      if (isBlacklisted(normalized)) continue;
      // Check if all words are stopwords
      const words = normalized.split(/\s+/);
      if (words.every((w) => isStopword(w))) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      const existing = meshCounts.get(normalized);
      if (existing) {
        existing.count++;
        existing.pmids.add(article.pmid);
      } else {
        meshCounts.set(normalized, { count: 1, pmids: new Set([article.pmid]) });
      }
    }
  }

  return meshCounts;
}

function isBlacklisted(phrase: string): boolean {
  if (BLACKLISTED_PHRASES.has(phrase)) return true;
  // Check if phrase is composed entirely of stopwords
  const words = phrase.split(/\s+/);
  if (words.every((w) => isStopword(w))) return true;
  return false;
}

/**
 * Extract ngram-based candidate topics from titles and abstracts.
 * Prefer trigrams over bigrams.
 */
function extractTextTopics(articles: PubMedArticle[]): Map<string, { count: number; pmids: Set<string> }> {
  const phraseCounts = new Map<string, { count: number; pmids: Set<string> }>();

  for (const article of articles) {
    const text = [article.title, article.abstract].join(" ");
    const tokens = tokenize(text);

    // Prefer trigrams, supplement with bigrams
    const trigrams = getNgrams(tokens, 3);
    const bigrams = getNgrams(tokens, 2);
    const allPhrases = [...trigrams, ...bigrams];

    const seen = new Set<string>();
    for (const phrase of allPhrases) {
      if (isBlacklisted(phrase)) continue;
      if (seen.has(phrase)) continue;
      seen.add(phrase);

      const existing = phraseCounts.get(phrase);
      if (existing) {
        existing.count++;
        existing.pmids.add(article.pmid);
      } else {
        phraseCounts.set(phrase, { count: 1, pmids: new Set([article.pmid]) });
      }
    }
  }

  return phraseCounts;
}

/**
 * Estimate historical frequency of a phrase by searching PubMed (total result count).
 * Returns the total number of results for the phrase.
 */
async function estimateHistoricalFrequency(phrase: string): Promise<number> {
  try {
    const params = new URLSearchParams({
      db: "pubmed",
      term: `"${phrase}"`,
      retmax: "0",
      retmode: "json",
    });
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`
    );
    const data = await res.json();
    return parseInt(data.esearchresult?.count || "0", 10);
  } catch {
    return 1; // fallback to avoid division by zero
  }
}

export async function detectTrends(
  articles: PubMedArticle[],
  topN = 10,
  onProgress?: (msg: string) => void
): Promise<TrendingTopic[]> {
  // Step 1: Extract MeSH-based topics (primary)
  onProgress?.("Extracting MeSH terms and keywords…");
  const meshTopics = extractMeshTopics(articles);

  // Step 2: Extract text-based topics (supplementary)
  onProgress?.("Analyzing title and abstract phrases…");
  const textTopics = extractTextTopics(articles);

  // Step 3: Merge - MeSH topics take priority
  const candidates: Array<{
    phrase: string;
    count: number;
    pmids: Set<string>;
    source: "mesh" | "text";
  }> = [];

  // Add MeSH topics with frequency >= 3
  for (const [phrase, data] of meshTopics) {
    if (data.count >= 3) {
      candidates.push({ phrase, count: data.count, pmids: data.pmids, source: "mesh" });
    }
  }

  // Add text topics with frequency >= 3, only if not already covered by MeSH
  const meshPhrases = new Set(candidates.map((c) => c.phrase));
  for (const [phrase, data] of textTopics) {
    if (data.count >= 3 && !meshPhrases.has(phrase)) {
      // Also check for substring overlap with existing MeSH candidates
      const overlaps = candidates.some(
        (c) => c.phrase.includes(phrase) || phrase.includes(c.phrase)
      );
      if (!overlaps) {
        candidates.push({ phrase, count: data.count, pmids: data.pmids, source: "text" });
      }
    }
  }

  // Sort by frequency first
  candidates.sort((a, b) => b.count - a.count);

  // Take top candidates for trend scoring (limit API calls)
  const topCandidates = candidates.slice(0, Math.min(candidates.length, 25));

  // Step 4: Compute trend scores using historical frequency
  onProgress?.("Computing trend scores…");
  const scoredTopics: TrendingTopic[] = [];

  for (const candidate of topCandidates) {
    const historicalCount = await estimateHistoricalFrequency(candidate.phrase);
    // Trend score: recent frequency normalized by historical prevalence
    // Higher score = more "emerging" (frequent this week relative to all-time)
    // Add 1 to avoid division by zero, use log to dampen huge historical counts
    const trendScore =
      candidate.count / (Math.log10(Math.max(historicalCount, 1) + 1));

    scoredTopics.push({
      phrase: candidate.phrase,
      frequency: candidate.count,
      articleCount: candidate.pmids.size,
      relatedPmids: Array.from(candidate.pmids).slice(0, 10),
      trendScore,
      source: candidate.source,
    });

    // Rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  // Step 5: Rank by trend score
  scoredTopics.sort((a, b) => b.trendScore - a.trendScore);

  // Step 6: Deduplicate overlapping phrases
  const filtered: TrendingTopic[] = [];
  for (const topic of scoredTopics) {
    const dominated = filtered.some(
      (existing) =>
        existing.phrase.includes(topic.phrase) ||
        topic.phrase.includes(existing.phrase)
    );
    if (!dominated) {
      filtered.push(topic);
    }
    if (filtered.length >= topN) break;
  }

  return filtered;
}
