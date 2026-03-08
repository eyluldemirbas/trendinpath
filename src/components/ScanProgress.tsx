import { motion } from "framer-motion";
import type { ScanProgress as ScanProgressType } from "@/lib/pubmed";

interface ScanProgressProps {
  progress: ScanProgressType;
}

const phaseLabels: Record<string, string> = {
  searching: "Searching PubMed databases…",
  fetching: "Fetching article details…",
  analyzing: "Analyzing trends…",
  expanding: "Expanding topic articles…",
  done: "Scan complete!",
};

export function ScanProgressIndicator({ progress }: ScanProgressProps) {
  const pct =
    progress.phase === "done"
      ? 100
      : progress.phase === "searching"
        ? 15
        : progress.phase === "fetching"
          ? 45
          : progress.phase === "analyzing"
            ? 70
            : 85;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto space-y-3"
    >
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {phaseLabels[progress.phase]}
        </span>
        <span className="font-medium text-primary">
          {progress.articlesFound} articles
        </span>
      </div>

      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Querying {progress.totalJournals > 1 ? `${progress.journalIndex}/${progress.totalJournals} journals` : "all pathology journals"} · 30-day window
      </p>
    </motion.div>
  );
}
