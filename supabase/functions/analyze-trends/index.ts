import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ArticleInput {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string;
  meshTerms: string[];
  keywords: string[];
  publicationTypes?: string[];
}

interface ClusterResult {
  label: string;
  summary: string;
  articleCount: number;
  pmids: string[];
  representativeTerms: string[];
  coherenceScore: number;
}

// Subspecialty classification using MeSH terms and keywords
const SUBSPECIALTY_TERMS: Record<string, string[]> = {
  dermatopathology: ["skin", "cutaneous", "melanoma", "dermat", "epiderm", "keratinocyte", "squamous cell", "basal cell", "psoriasis", "eczema", "dermis", "melanocytic"],
  gastrointestinal: ["gastrointestinal", "colorectal", "colon", "gastric", "esophag", "hepat", "liver", "pancrea", "intestin", "stomach", "rectal", "biliary", "gallbladder", "celiac", "crohn"],
  hematopathology: ["lymphoma", "leukemia", "hematop", "bone marrow", "myeloid", "lymphoid", "myeloma", "hodgkin", "lymphocyt", "platelet", "anemia", "myelodysplastic", "lymphoproliferative"],
  breast: ["breast", "mammary", "ductal", "lobular", "mastectomy", "her2", "triple negative", "brca"],
  gynecologic: ["gynecol", "ovarian", "endometri", "cervic", "uterine", "vulvar", "fallopian", "gestational"],
  genitourinary: ["renal", "kidney", "bladder", "prostat", "urotheli", "testicular", "penile", "nephro", "glomerul"],
  thoracic: ["lung", "pulmonary", "thorac", "pleural", "bronch", "mesothelioma", "adenocarcinoma lung", "small cell lung"],
  neuropathology: ["brain", "neuro", "glioma", "glioblastoma", "meningioma", "cerebral", "spinal", "astrocyt", "oligodendro", "medulloblastoma", "cns"],
  cytopathology: ["cytolog", "cytopathol", "fine needle", "aspiration", "pap smear", "liquid-based", "fnac", "fna"],
  molecular: ["molecular", "genomic", "mutation", "sequencing", "biomarker", "pcr", "ngs", "next-generation", "gene expression", "epigenetic", "methylation", "microsatellite"],
};

function classifySubspecialty(article: ArticleInput): string[] {
  const text = [
    ...article.meshTerms,
    ...article.keywords,
    article.title,
  ].join(" ").toLowerCase();

  const matches: string[] = [];
  for (const [specialty, terms] of Object.entries(SUBSPECIALTY_TERMS)) {
    for (const term of terms) {
      if (text.includes(term)) {
        matches.push(specialty);
        break;
      }
    }
  }
  return matches.length > 0 ? matches : ["general"];
}

// Filter low-signal papers
function filterArticles(articles: ArticleInput[]): ArticleInput[] {
  const excludedPubTypes = new Set([
    "case reports", "editorial", "letter", "comment",
    "case report", "editorials", "letters", "comments",
  ]);

  return articles.filter((a) => {
    if (a.publicationTypes?.some((pt) => excludedPubTypes.has(pt.toLowerCase()))) {
      return false;
    }
    const wordCount = (a.abstract || "").split(/\s+/).filter(Boolean).length;
    if (wordCount < 150) return false;
    return true;
  });
}

function scoreArticle(a: ArticleInput): number {
  let score = 0;
  if (a.meshTerms.length > 0) score += 2;
  if (a.keywords.length > 0) score += 2;
  const wordCount = (a.abstract || "").split(/\s+/).filter(Boolean).length;
  if (wordCount > 300) score += 2;
  else if (wordCount > 200) score += 1;
  return score;
}

// Build TF-IDF using ONLY title, MeSH terms, and keywords (no abstract)
function buildTfIdfEmbeddings(articles: ArticleInput[]): { embeddings: number[][]; vocabulary: string[] } {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall",
    "this", "that", "these", "those", "it", "its", "we", "our", "they", "their", "not",
    "no", "can", "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "than", "too", "very", "just", "about", "above", "after", "again", "also",
    "as", "because", "before", "between", "during", "into", "through", "using", "used",
    "which", "who", "whom", "what", "when", "where", "how", "here", "there", "then",
    "so", "if", "only", "own", "same", "however", "although", "while", "since",
    "up", "out", "over", "under", "further", "once", "new", "novel",
  ]);

  const tokenize = (text: string): string[] => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  };

  const dfMap = new Map<string, number>();
  const docTokens: string[][] = [];

  for (const article of articles) {
    // Only use title, MeSH terms, and keywords — NO abstract
    // Repeat MeSH and keywords to boost their weight
    const text = [
      article.title,
      article.title, // double-weight title
      ...article.meshTerms,
      ...article.meshTerms,
      ...article.meshTerms, // triple-weight MeSH
      ...article.keywords,
      ...article.keywords, // double-weight keywords
    ].join(" ");

    const tokens = tokenize(text);
    docTokens.push(tokens);
    const unique = new Set(tokens);
    for (const t of unique) {
      dfMap.set(t, (dfMap.get(t) || 0) + 1);
    }
  }

  const n = articles.length;
  const maxDf = Math.max(2, Math.floor(n * 0.8));
  const vocabulary = [...dfMap.entries()]
    .filter(([, df]) => df >= 2 && df <= maxDf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 500)
    .map(([term]) => term);

  const vocabIndex = new Map(vocabulary.map((v, i) => [v, i]));
  const dim = vocabulary.length;

  const embeddings: number[][] = [];
  for (const tokens of docTokens) {
    const vec = new Array(dim).fill(0);
    const tfMap = new Map<string, number>();
    for (const t of tokens) {
      tfMap.set(t, (tfMap.get(t) || 0) + 1);
    }
    for (const [term, tf] of tfMap) {
      const idx = vocabIndex.get(term);
      if (idx !== undefined) {
        const idf = Math.log(n / (dfMap.get(term)! + 1));
        vec[idx] = (1 + Math.log(tf)) * idf;
      }
    }
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) + 1e-10;
    for (let i = 0; i < dim; i++) vec[i] /= norm;
    embeddings.push(vec);
  }

  return { embeddings, vocabulary };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function kMeansClustering(embeddings: number[][], k: number, maxIter = 30): number[] {
  const n = embeddings.length;
  const dim = embeddings[0].length;

  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  let idx = Math.floor(Math.random() * n);
  centroids.push([...embeddings[idx]]);
  usedIndices.add(idx);

  for (let c = 1; c < k; c++) {
    let bestIdx = 0, bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (usedIndices.has(i)) continue;
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = 1 - cosineSimilarity(embeddings[i], centroid);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestDist) { bestDist = minDist; bestIdx = i; }
    }
    centroids.push([...embeddings[bestIdx]]);
    usedIndices.add(bestIdx);
  }

  const assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestCluster = 0, bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const sim = cosineSimilarity(embeddings[i], centroids[c]);
        if (sim > bestSim) { bestSim = sim; bestCluster = c; }
      }
      if (assignments[i] !== bestCluster) { assignments[i] = bestCluster; changed = true; }
    }
    if (!changed) break;
    for (let c = 0; c < k; c++) {
      const members = [];
      for (let i = 0; i < n; i++) if (assignments[i] === c) members.push(i);
      if (members.length === 0) continue;
      const newCentroid = new Array(dim).fill(0);
      for (const mi of members) for (let d = 0; d < dim; d++) newCentroid[d] += embeddings[mi][d];
      for (let d = 0; d < dim; d++) newCentroid[d] /= members.length;
      centroids[c] = newCentroid;
    }
  }
  return assignments;
}

// Calculate average pairwise cosine similarity within a cluster
function clusterCoherence(memberEmbeddings: number[][]): number {
  if (memberEmbeddings.length < 2) return 1.0;
  let totalSim = 0;
  let count = 0;
  for (let i = 0; i < memberEmbeddings.length; i++) {
    for (let j = i + 1; j < memberEmbeddings.length; j++) {
      totalSim += cosineSimilarity(memberEmbeddings[i], memberEmbeddings[j]);
      count++;
    }
  }
  return count > 0 ? totalSim / count : 0;
}

function extractClusterKeywords(articles: ArticleInput[]): string[] {
  const freqMap = new Map<string, number>();

  for (const a of articles) {
    for (const term of a.meshTerms) {
      const key = term.toLowerCase();
      freqMap.set(key, (freqMap.get(key) || 0) + 3);
    }
    for (const kw of a.keywords) {
      const key = kw.toLowerCase();
      freqMap.set(key, (freqMap.get(key) || 0) + 2);
    }
    const titleWords = a.title.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length > 3);
    for (const w of titleWords) {
      freqMap.set(w, (freqMap.get(w) || 0) + 1);
    }
  }

  const genericTerms = new Set([
    "humans", "male", "female", "adult", "middle aged", "aged",
    "retrospective studies", "prognosis", "diagnosis", "pathology",
    "immunohistochemistry", "neoplasms", "treatment outcome",
  ]);

  return [...freqMap.entries()]
    .filter(([term]) => !genericTerms.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);
}

async function generateTopicLabels(
  clusters: Map<number, ArticleInput[]>,
  vocabulary: string[],
  lovableApiKey: string
): Promise<Map<number, { label: string; summary: string }>> {
  const results = new Map<number, { label: string; summary: string }>();

  for (const [clusterId, articles] of clusters) {
    const topKeywords = extractClusterKeywords(articles);
    const titles = articles.slice(0, 8).map((a) => `- ${a.title}`).join("\n");

    const prompt = `You are a pathology research expert. Below is a cluster of ${articles.length} recent pathology research papers with their most frequent keywords.

Top keywords (by frequency): ${topKeywords.join(", ")}

Sample paper titles:
${titles}

Based on the keywords above, generate:
1. A concise topic label (3-5 words) using the most specific and meaningful keywords. Do NOT use broad generic phrases. The label should reflect the actual research focus.
2. A one-sentence summary of the research direction.

Respond in exactly this format:
LABEL: <topic label>
SUMMARY: <one sentence summary>`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`AI labeling error [${res.status}]: ${errText}`);
        results.set(clusterId, {
          label: topKeywords.slice(0, 3).join(" / ") || `Cluster ${clusterId + 1}`,
          summary: `${articles.length} related papers`,
        });
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const labelMatch = content.match(/LABEL:\s*(.+)/i);
      const summaryMatch = content.match(/SUMMARY:\s*(.+)/i);

      results.set(clusterId, {
        label: labelMatch?.[1]?.trim() || topKeywords.slice(0, 3).join(" / ") || `Cluster ${clusterId + 1}`,
        summary: summaryMatch?.[1]?.trim() || `${articles.length} related papers`,
      });
    } catch (e) {
      console.error("Label generation error:", e);
      results.set(clusterId, {
        label: topKeywords.slice(0, 3).join(" / ") || `Cluster ${clusterId + 1}`,
        summary: `${articles.length} related papers`,
      });
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articles, subspecialty }: { articles: ArticleInput[]; subspecialty?: string } = await req.json();

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No articles provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Filter low-signal papers
    let filtered = filterArticles(articles);
    console.log(`Filtered ${articles.length} → ${filtered.length} high-signal articles`);

    // Step 2: Subspecialty filter (if specified)
    if (subspecialty && subspecialty !== "all") {
      filtered = filtered.filter((a) => {
        const specialties = classifySubspecialty(a);
        return specialties.includes(subspecialty);
      });
      console.log(`Subspecialty filter '${subspecialty}': ${filtered.length} articles`);
    }

    // Classify all articles for metadata
    const subspecialtyCounts: Record<string, number> = {};
    for (const a of filtered) {
      const specs = classifySubspecialty(a);
      for (const s of specs) {
        subspecialtyCounts[s] = (subspecialtyCounts[s] || 0) + 1;
      }
    }

    // Step 3: Sort by quality score, take top 200
    const scored = filtered
      .map((a) => ({ article: a, score: scoreArticle(a) }))
      .sort((a, b) => b.score - a.score);
    const limitedArticles = scored.slice(0, 200).map((s) => s.article);

    if (limitedArticles.length < 5) {
      return new Response(JSON.stringify({ clusters: [], subspecialtyCounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Building TF-IDF embeddings for ${limitedArticles.length} articles (title+MeSH+keywords only)...`);

    // Step 4: Build TF-IDF embeddings (title + MeSH + keywords only)
    const { embeddings, vocabulary } = buildTfIdfEmbeddings(limitedArticles);

    // Step 5: Determine K
    const k = Math.min(Math.max(Math.round(limitedArticles.length / 12), 5), 15);
    console.log(`Clustering into ${k} groups...`);

    // Step 6: KMeans clustering
    const assignments = kMeansClustering(embeddings, k);

    // Step 7: Group articles by cluster and check coherence
    const clusterMap = new Map<number, { articles: ArticleInput[]; indices: number[] }>();
    for (let i = 0; i < assignments.length; i++) {
      const clusterId = assignments[i];
      if (!clusterMap.has(clusterId)) clusterMap.set(clusterId, { articles: [], indices: [] });
      const entry = clusterMap.get(clusterId)!;
      entry.articles.push(limitedArticles[i]);
      entry.indices.push(i);
    }

    // Coherence threshold — discard incoherent clusters
    const COHERENCE_THRESHOLD = 0.08;
    const validClusters = new Map<number, ArticleInput[]>();
    const coherenceScores = new Map<number, number>();

    for (const [id, { articles: arts, indices }] of clusterMap) {
      if (arts.length < 2) continue;
      const memberEmbeddings = indices.map((i) => embeddings[i]);
      const coherence = clusterCoherence(memberEmbeddings);
      coherenceScores.set(id, coherence);

      if (coherence >= COHERENCE_THRESHOLD) {
        validClusters.set(id, arts);
        console.log(`Cluster ${id}: ${arts.length} articles, coherence=${coherence.toFixed(3)} ✓`);
      } else {
        console.log(`Cluster ${id}: ${arts.length} articles, coherence=${coherence.toFixed(3)} ✗ DISCARDED`);
      }
    }

    console.log(`${validClusters.size} coherent clusters out of ${clusterMap.size} total`);

    // Step 8: Generate keyword-based labels using Lovable AI
    const labels = await generateTopicLabels(validClusters, vocabulary, LOVABLE_API_KEY);

    // Step 9: Build results
    const results: ClusterResult[] = [];
    for (const [clusterId, arts] of validClusters) {
      const labelData = labels.get(clusterId);
      const topKeywords = extractClusterKeywords(arts);
      results.push({
        label: labelData?.label || `Cluster ${clusterId + 1}`,
        summary: labelData?.summary || "",
        articleCount: arts.length,
        pmids: arts.map((a) => a.pmid),
        representativeTerms: topKeywords.slice(0, 10),
        coherenceScore: coherenceScores.get(clusterId) || 0,
      });
    }

    results.sort((a, b) => b.articleCount - a.articleCount);

    return new Response(JSON.stringify({ clusters: results, subspecialtyCounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-trends error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
