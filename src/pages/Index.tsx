import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, BookOpen, Zap } from "lucide-react";
import { ScanButton } from "@/components/ScanButton";
import { ScanProgressIndicator } from "@/components/ScanProgress";
import { TrendCard } from "@/components/TrendCard";
import { ExportButtons } from "@/components/ExportButtons";
import {
  scanJournals,
  fetchArticles,
  searchPubMedNoDate,
  type PubMedArticle,
  type ScanProgress,
  PATHOLOGY_JOURNALS,
} from "@/lib/pubmed";
import { detectTrends, type TrendingTopic } from "@/lib/trends";
import type { TopicWithArticles } from "@/lib/export";

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<TopicWithArticles[] | null>(null);
  const [scanDate, setScanDate] = useState<Date | null>(null);
  const [totalArticles, setTotalArticles] = useState(0);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setResults(null);
    setProgress(null);

    try {
      // Phase 1: Scan journals
      const articles = await scanJournals((p) => setProgress(p));
      setTotalArticles(articles.length);

      // Phase 2: Detect trends
      setProgress((prev) => prev ? { ...prev, phase: "analyzing" } : null);
      const trends = detectTrends(articles, 10);

      // Phase 3: Expand each topic with relevant articles
      setProgress((prev) => prev ? { ...prev, phase: "expanding" } : null);
      const topicData: TopicWithArticles[] = [];

      for (const topic of trends) {
        // Get articles from the initial scan that match
        const directArticles = articles.filter((a) =>
          topic.relatedPmids.includes(a.pmid)
        );

        // Also search PubMed for more relevant articles
        let expandedArticles: PubMedArticle[] = [];
        try {
          const pmids = await searchPubMedNoDate(
            `${topic.phrase} AND (pathology OR histopathology)`,
            10
          );
          const newPmids = pmids.filter(
            (id) => !directArticles.some((a) => a.pmid === id)
          );
          if (newPmids.length > 0) {
            expandedArticles = await fetchArticles(newPmids);
          }
        } catch {
          // If expansion fails, just use direct articles
        }

        const combined = [...directArticles, ...expandedArticles].slice(0, 10);
        topicData.push({ topic, articles: combined });

        // Small delay for rate limiting
        await new Promise((r) => setTimeout(r, 350));
      }

      setResults(topicData);
      setScanDate(new Date());
      setProgress((prev) => prev ? { ...prev, phase: "done" } : null);
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 glow-primary">
              <Radar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-none">
                PathScan
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Weekly Pathology Trend Scanner
              </p>
            </div>
          </div>

          {results && scanDate && (
            <ExportButtons data={results} scanDate={scanDate} />
          )}
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!results && !isScanning && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 rounded-full border border-primary/30 flex items-center justify-center glow-primary"
              >
                <Radar className="w-12 h-12 text-primary" />
              </motion.div>

              <div className="space-y-3 max-w-lg">
                <h2 className="font-display font-bold text-3xl text-foreground glow-text">
                  Pathology Literature Radar
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Scan {PATHOLOGY_JOURNALS.length} pathology journals for the latest
                  7-day publications. Detect trending topics and generate a
                  structured weekly report.
                </p>
              </div>

              <ScanButton isScanning={false} onScan={handleScan} />

              <div className="flex items-center gap-6 text-xs font-mono text-dim">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {PATHOLOGY_JOURNALS.length} journals
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  PubMed E-utilities
                </span>
              </div>
            </motion.div>
          )}

          {isScanning && progress && (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary flex items-center justify-center"
              >
                <Radar className="w-8 h-8 text-primary" />
              </motion.div>

              <ScanProgressIndicator progress={progress} />
            </motion.div>
          )}

          {results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Summary bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border border-border rounded-lg">
                <div className="space-y-1">
                  <h2 className="font-display font-bold text-xl text-foreground">
                    Weekly Trend Report
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    {scanDate?.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm font-mono">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{totalArticles}</div>
                    <div className="text-xs text-muted-foreground">articles scanned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{results.length}</div>
                    <div className="text-xs text-muted-foreground">trending topics</div>
                  </div>
                </div>
                <ScanButton isScanning={isScanning} onScan={handleScan} />
              </div>

              {/* Topic cards */}
              <div className="space-y-6">
                {results.map((r, i) => (
                  <TrendCard
                    key={r.topic.phrase}
                    topic={r.topic}
                    articles={r.articles}
                    index={i}
                  />
                ))}
              </div>

              {results.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="font-display text-lg">No trending topics detected</p>
                  <p className="text-sm mt-2">Try scanning again or expanding the date range.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
