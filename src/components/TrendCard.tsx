import { motion } from "framer-motion";
import { TrendingUp, ExternalLink, BarChart3 } from "lucide-react";
import type { PubMedArticle } from "@/lib/pubmed";
import { getPubMedUrl } from "@/lib/pubmed";
import type { TrendingTopic } from "@/lib/trends";

interface TrendCardProps {
  topic: TrendingTopic;
  articles: PubMedArticle[];
  index: number;
}

export function TrendCard({ topic, articles, index }: TrendCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-primary font-mono font-bold text-sm">
              {index + 1}
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                {topic.phrase}
              </h3>
              {topic.summary && (
                <p className="text-sm text-muted-foreground mt-1">{topic.summary}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  {topic.articleCount} papers
                </span>
                {topic.coherenceScore !== undefined && (
                  <span className="flex items-center gap-1" title="Cluster coherence score">
                    <BarChart3 className="w-3 h-3 text-primary" />
                    {(topic.coherenceScore * 100).toFixed(0)}% coherence
                  </span>
                )}
                {topic.representativeTerms && topic.representativeTerms.length > 0 && (
                  <span className="text-muted-foreground">
                    {topic.representativeTerms.slice(0, 4).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="divide-y divide-border">
        {articles.map((article, i) => (
          <div key={article.pmid} className="px-5 py-3 hover:bg-secondary/50 transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={getPubMedUrl(article.pmid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 inline-flex items-start gap-1"
                >
                  {article.title}
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                </a>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="truncate">{article.journal}</span>
                  {article.pubDate && (
                    <>
                      <span>·</span>
                      <span className="shrink-0">{article.pubDate}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="shrink-0 text-primary">PMID: {article.pmid}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
