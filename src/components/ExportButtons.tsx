import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TopicWithArticles } from "@/lib/export";
import { exportExcel, exportCSV, exportMarkdown } from "@/lib/export";

interface ExportButtonsProps {
  data: TopicWithArticles[];
  scanDate: Date;
}

export function ExportButtons({ data, scanDate }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportExcel(data)}
        className="font-mono text-xs border-border text-muted-foreground hover:text-primary hover:border-primary/50"
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportCSV(data)}
        className="font-mono text-xs border-border text-muted-foreground hover:text-primary hover:border-primary/50"
      >
        <FileText className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportMarkdown(data, scanDate)}
        className="font-mono text-xs border-border text-muted-foreground hover:text-primary hover:border-primary/50"
      >
        <FileDown className="mr-2 h-4 w-4" />
        Export Markdown
      </Button>
    </div>
  );
}
