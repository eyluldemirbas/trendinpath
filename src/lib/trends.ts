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
  coherenceScore?: number;
  recentCount?: number;
  baselineCount?: number;
  trendDirection?: "rising" | "stable" | "declining";
}

interface ClusterResult {
  label: string;
  summary: string;
  articleCount: number;
  pmids: string[];
  representativeTerms: string[];
  coherenceScore: number;
  recentCount?: number;
  baselineCount?: number;
  trendDirection?: "rising" | "stable" | "declining";
}

export const SUBSPECIALTIES = [
  { id: "all", label: "All Pathology" },
  { id: "dermatopathology", label: "Dermatopathology" },
  { id: "gastrointestinal", label: "Gastrointestinal Pathology" },
  { id: "hematopathology", label: "Hematopathology" },
  { id: "breast", label: "Breast Pathology" },
  { id: "gynecologic", label: "Gynecologic Pathology" },
  { id: "genitourinary", label: "Genitourinary Pathology" },
  { id: "thoracic", label: "Thoracic Pathology" },
  { id: "neuropathology", label: "Neuropathology" },
  { id: "cytopathology", label: "Cytopathology" },
  { id: "molecular", label: "Molecular Pathology" },
] as const;

export type SubspecialtyId = typeof SUBSPECIALTIES[number]["id"];

/**
 * Send articles to the edge function for TF-IDF clustering and AI labeling.
 */
export async function detectTrends(
  articles: PubMedArticle[],
  topN = 10,
  onProgress?: (msg: string) => void,
  subspecialty: SubspecialtyId = "all"
): Promise<{ topics: TrendingTopic[]; subspecialtyCounts: Record<string, number> }> {
  onProgress?.("Sending articles for AI analysis…");

  const limited = articles.slice(0, 200);

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
        publicationTypes: a.publicationTypes,
      })),
      subspecialty,
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
  const subspecialtyCounts: Record<string, number> = data?.subspecialtyCounts || {};

  onProgress?.("Processing results…");

  const topics: TrendingTopic[] = clusters.slice(0, topN).map((cluster, i) => ({
    phrase: cluster.label,
    frequency: cluster.articleCount,
    articleCount: cluster.articleCount,
    relatedPmids: cluster.pmids.slice(0, 10),
    trendScore: clusters.length - i,
    source: "cluster" as const,
    summary: cluster.summary,
    representativeTerms: cluster.representativeTerms,
    coherenceScore: cluster.coherenceScore,
    recentCount: cluster.recentCount,
    baselineCount: cluster.baselineCount,
    trendDirection: cluster.trendDirection,
  }));

  return { topics, subspecialtyCounts };
}
