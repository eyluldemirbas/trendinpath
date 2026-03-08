import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Calendar } from "lucide-react";
import { ScanButton } from "@/components/ScanButton";
import { ScanProgressIndicator } from "@/components/ScanProgress";
import { TrendCard } from "@/components/TrendCard";
import { ExportButtons } from "@/components/ExportButtons";
import {
  scanJournals,
  type PubMedArticle,
  type ScanProgress,
  PATHOLOGY_JOURNALS,
} from "@/lib/pubmed";
import { detectTrends } from "@/lib/trends";
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
      const articles = await scanJournals((p) => setProgress(p));
      setTotalArticles(articles.length);

      setProgress((prev) => prev ? { ...prev, phase: "analyzing" } : null);
      const trends = await detectTrends(articles, 10, (msg) =>
        setProgress((prev) => prev ? { ...prev, currentJournal: msg } : null)
      );

      setProgress((prev) => prev ? { ...prev, phase: "expanding" } : null);
      const topicData: TopicWithArticles[] = [];

      for (const topic of trends) {
        const clusterArticles = articles.filter((a) =>
          topic.relatedPmids.includes(a.pmid)
        );
        topicData.push({ topic, articles: clusterArticles.slice(0, 10) });
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

  const monthYear = scanDate
    ? scanDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-primary" />
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-none">
                PathScan
              </h1>
              <p className="text-xs text-muted-foreground">
                Monthly Pathology Trend Scanner
              </p>
            </div>
          </div>

          {results && scanDate && (
            <ExportButtons data={results} scanDate={scanDate} />
          )}
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-10">
        <AnimatePresence mode="wait">
          {!results && !isScanning && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center min-h-[55vh] text-center space-y-8"
            >
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                <Search className="w-7 h-7 text-primary" />
              </div>

              <div className="space-y-3 max-w-lg">
                <h2 className="font-display font-bold text-2xl text-foreground">
                  Pathology Literature Scanner
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Scan {PATHOLOGY_JOURNALS.length} pathology journals for publications
                  from the last 30 days. Detect trending research topics and generate
                  a structured monthly report.
                </p>
              </div>

              <ScanButton isScanning={false} onScan={handleScan} />

              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {PATHOLOGY_JOURNALS.length} journals
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  30-day window
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
              className="flex flex-col items-center justify-center min-h-[55vh] space-y-8"
            >
              <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <ScanProgressIndicator progress={progress} />
            </motion.div>
          )}

          {results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Summary bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-card border border-border rounded-lg">
                <div className="space-y-1">
                  <h2 className="font-display font-bold text-xl text-foreground">
                    Monthly Pathology Trend Report
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {monthYear}
                  </p>
                </div>
                <div className="flex items-center gap-8 text-sm">
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
              <div className="space-y-5">
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
