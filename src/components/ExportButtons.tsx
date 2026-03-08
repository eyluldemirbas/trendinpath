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
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportExcel(data)}
        className="text-xs"
      >
        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportCSV(data)}
        className="text-xs"
      >
        <FileText className="mr-1.5 h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportMarkdown(data, scanDate)}
        className="text-xs"
      >
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
        Markdown
      </Button>
    </div>
  );
}
