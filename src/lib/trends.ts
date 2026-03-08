import type { PubMedArticle } from "./pubmed";

const STOPWORDS = new Set([
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
  "new", "used", "using", "use", "based", "associated", "case", "cases", "study",
  "studies", "report", "results", "patients", "patient", "analysis", "conclusion",
  "conclusions", "background", "methods", "method", "objective", "objectives",
  "purpose", "findings", "data", "group", "groups", "however", "among", "well",
  "showed", "including", "included", "compared", "significant", "significantly",
  "total", "overall", "respectively", "per", "et", "al", "vs", "ci", "p",
  "number", "performed", "underwent", "revealed", "identified", "present",
  "showed", "demonstrated", "observed", "evaluated", "assessed", "examined",
  "reviewed", "three", "four", "five", "high", "low", "different", "common",
  "features", "role", "effect", "effects", "related", "review", "recent",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function getNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n);
    // Skip if any token is a stopword
    if (gram.some((t) => STOPWORDS.has(t))) continue;
    ngrams.push(gram.join(" "));
  }
  return ngrams;
}

export interface TrendingTopic {
  phrase: string;
  frequency: number;
  articleCount: number;
  relatedPmids: string[];
}

export function detectTrends(
  articles: PubMedArticle[],
  topN = 10
): TrendingTopic[] {
  const phraseCounts = new Map<string, { count: number; pmids: Set<string> }>();

  for (const article of articles) {
    const text = [
      article.title,
      article.abstract,
      ...article.keywords,
      ...article.meshTerms,
    ].join(" ");

    const tokens = tokenize(text);
    const bigrams = getNgrams(tokens, 2);
    const trigrams = getNgrams(tokens, 3);
    const allPhrases = [...bigrams, ...trigrams];

    const seen = new Set<string>();
    for (const phrase of allPhrases) {
      if (!seen.has(phrase)) {
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
  }

  // Filter and rank
  const topics: TrendingTopic[] = [];
  for (const [phrase, data] of phraseCounts) {
    if (data.count >= 3) {
      topics.push({
        phrase,
        frequency: data.count,
        articleCount: data.pmids.size,
        relatedPmids: Array.from(data.pmids).slice(0, 10),
      });
    }
  }

  topics.sort((a, b) => b.frequency - a.frequency);

  // Remove overlapping topics (if a bigram is substring of a higher-ranked trigram)
  const filtered: TrendingTopic[] = [];
  const usedPhrases = new Set<string>();

  for (const topic of topics) {
    const dominated = filtered.some(
      (existing) =>
        existing.phrase.includes(topic.phrase) ||
        topic.phrase.includes(existing.phrase)
    );
    if (!dominated && !usedPhrases.has(topic.phrase)) {
      filtered.push(topic);
      usedPhrases.add(topic.phrase);
    }
    if (filtered.length >= topN) break;
  }

  return filtered;
}
