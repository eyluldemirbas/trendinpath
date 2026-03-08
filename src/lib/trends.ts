import type { PubMedArticle } from "./pubmed";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingTopic {
  phrase: string;
  frequency: number;
  articleCount: number;
  relatedPmids: string[];
  trendScore: number;
  source: "mesh" | "text" | "cluster";
  summary?: string;
  representativeTerms?: string[];
}

interface ClusterResult {
  label: string;
  summary: string;
  articleCount: number;
  pmids: string[];
  representativeTerms: string[];
}

/**
 * Send articles to the edge function for embedding-based clustering and AI labeling.
 */
export async function detectTrends(
  articles: PubMedArticle[],
  topN = 10,
  onProgress?: (msg: string) => void
): Promise<TrendingTopic[]> {
  onProgress?.("Sending articles for AI analysis…");

  // Limit to 150 most recent articles
  const limited = articles.slice(0, 150);

  const { data, error } = await supabase.functions.invoke("analyze-trends", {
    body: {
      articles: limited.map((a) => ({
        pmid: a.pmid,
        title: a.title,
        abstract: a.abstract,
        journal: a.journal,
        pubDate: a.pubDate,
        meshTerms: a.meshTerms,
        keywords: a.keywords,
      })),
    },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(`Trend analysis failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Trend analysis failed: ${data.error}`);
  }

  const clusters: ClusterResult[] = data?.clusters || [];

  onProgress?.("Processing results…");

  // Convert clusters to TrendingTopic format
  const topics: TrendingTopic[] = clusters.slice(0, topN).map((cluster, i) => ({
    phrase: cluster.label,
    frequency: cluster.articleCount,
    articleCount: cluster.articleCount,
    relatedPmids: cluster.pmids.slice(0, 10),
    trendScore: clusters.length - i, // rank-based score
    source: "cluster" as const,
    summary: cluster.summary,
    representativeTerms: cluster.representativeTerms,
  }));

  return topics;
}
