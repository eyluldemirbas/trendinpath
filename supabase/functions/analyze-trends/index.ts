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
}

interface ClusterResult {
  label: string;
  summary: string;
  articleCount: number;
  pmids: string[];
  representativeTerms: string[];
}

// Generate embeddings for articles using OpenAI
async function generateEmbeddings(
  articles: ArticleInput[],
  apiKey: string
): Promise<number[][]> {
  const texts = articles.map(
    (a) => `${a.title}. ${a.abstract}`.slice(0, 8000)
  );

  // Batch in groups of 50 (OpenAI limit is 2048 but keep it safe)
  const allEmbeddings: number[][] = [];
  const batchSize = 50;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: batch,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embeddings error [${res.status}]: ${err}`);
    }

    const data = await res.json();
    const sorted = data.data.sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    );
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// KMeans clustering on embeddings
function kMeansClustering(
  embeddings: number[][],
  k: number,
  maxIter = 30
): number[] {
  const n = embeddings.length;
  const dim = embeddings[0].length;

  // Initialize centroids using KMeans++ style
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();

  // First centroid: random
  let idx = Math.floor(Math.random() * n);
  centroids.push([...embeddings[idx]]);
  usedIndices.add(idx);

  // Subsequent centroids: pick point farthest from existing centroids
  for (let c = 1; c < k; c++) {
    let bestIdx = 0;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (usedIndices.has(i)) continue;
      let minDist = Infinity;
      for (const centroid of centroids) {
        const sim = cosineSimilarity(embeddings[i], centroid);
        const dist = 1 - sim;
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestDist) {
        bestDist = minDist;
        bestIdx = i;
      }
    }
    centroids.push([...embeddings[bestIdx]]);
    usedIndices.add(bestIdx);
  }

  const assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const sim = cosineSimilarity(embeddings[i], centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = [];
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) members.push(i);
      }
      if (members.length === 0) continue;
      const newCentroid = new Array(dim).fill(0);
      for (const mi of members) {
        for (let d = 0; d < dim; d++) {
          newCentroid[d] += embeddings[mi][d];
        }
      }
      for (let d = 0; d < dim; d++) {
        newCentroid[d] /= members.length;
      }
      centroids[c] = newCentroid;
    }
  }

  return assignments;
}

// Use Lovable AI to generate a human-readable topic label
async function generateTopicLabels(
  clusters: Map<number, ArticleInput[]>,
  lovableApiKey: string
): Promise<Map<number, { label: string; summary: string }>> {
  const results = new Map<number, { label: string; summary: string }>();

  for (const [clusterId, articles] of clusters) {
    // Build context from cluster articles
    const titles = articles.map((a) => `- ${a.title}`).join("\n");
    const meshTerms = [
      ...new Set(articles.flatMap((a) => a.meshTerms)),
    ].slice(0, 20);
    const keywords = [
      ...new Set(articles.flatMap((a) => a.keywords)),
    ].slice(0, 20);

    const prompt = `You are a pathology research expert. Below is a cluster of ${articles.length} recent pathology research papers. Generate:
1. A concise topic label (3-7 words) that captures the specific research theme
2. A one-sentence summary of the research direction

Papers:
${titles}

MeSH terms: ${meshTerms.join(", ")}
Keywords: ${keywords.join(", ")}

Respond in exactly this format:
LABEL: <topic label>
SUMMARY: <one sentence summary>`;

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`AI labeling error [${res.status}]: ${errText}`);
        // Fallback: use most common MeSH terms
        results.set(clusterId, {
          label: meshTerms.slice(0, 3).join(", ") || `Cluster ${clusterId + 1}`,
          summary: `${articles.length} related papers`,
        });
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";

      const labelMatch = content.match(/LABEL:\s*(.+)/i);
      const summaryMatch = content.match(/SUMMARY:\s*(.+)/i);

      results.set(clusterId, {
        label: labelMatch?.[1]?.trim() || meshTerms.slice(0, 3).join(", ") || `Cluster ${clusterId + 1}`,
        summary: summaryMatch?.[1]?.trim() || `${articles.length} related papers`,
      });
    } catch (e) {
      console.error("Label generation error:", e);
      results.set(clusterId, {
        label: meshTerms.slice(0, 3).join(", ") || `Cluster ${clusterId + 1}`,
        summary: `${articles.length} related papers`,
      });
    }

    // Rate limit between AI calls
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articles }: { articles: ArticleInput[] } = await req.json();

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No articles provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Limit to 150 articles
    const limitedArticles = articles.slice(0, 150);

    console.log(`Generating embeddings for ${limitedArticles.length} articles...`);

    // Step 1: Generate embeddings
    const embeddings = await generateEmbeddings(limitedArticles, OPENAI_API_KEY);

    // Step 2: Determine K (aim for 5-12 clusters depending on article count)
    const k = Math.min(
      Math.max(Math.round(limitedArticles.length / 10), 5),
      12
    );

    console.log(`Clustering into ${k} groups...`);

    // Step 3: KMeans clustering
    const assignments = kMeansClustering(embeddings, k);

    // Step 4: Group articles by cluster
    const clusterMap = new Map<number, ArticleInput[]>();
    for (let i = 0; i < assignments.length; i++) {
      const clusterId = assignments[i];
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(limitedArticles[i]);
    }

    // Filter out tiny clusters (< 2 articles)
    const validClusters = new Map<number, ArticleInput[]>();
    for (const [id, arts] of clusterMap) {
      if (arts.length >= 2) {
        validClusters.set(id, arts);
      }
    }

    console.log(`Found ${validClusters.size} valid clusters, generating labels...`);

    // Step 5: Generate labels using AI
    const labels = await generateTopicLabels(validClusters, LOVABLE_API_KEY);

    // Step 6: Build results sorted by cluster size
    const results: ClusterResult[] = [];
    for (const [clusterId, arts] of validClusters) {
      const labelData = labels.get(clusterId);
      const allMesh = [...new Set(arts.flatMap((a) => a.meshTerms))];

      results.push({
        label: labelData?.label || `Cluster ${clusterId + 1}`,
        summary: labelData?.summary || "",
        articleCount: arts.length,
        pmids: arts.map((a) => a.pmid),
        representativeTerms: allMesh.slice(0, 10),
      });
    }

    results.sort((a, b) => b.articleCount - a.articleCount);

    return new Response(JSON.stringify({ clusters: results }), {
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
