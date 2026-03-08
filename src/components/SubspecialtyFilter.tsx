import { SUBSPECIALTIES, type SubspecialtyId } from "@/lib/trends";
import { cn } from "@/lib/utils";

interface SubspecialtyFilterProps {
  selected: SubspecialtyId;
  onSelect: (id: SubspecialtyId) => void;
  counts: Record<string, number>;
  disabled?: boolean;
}

export function SubspecialtyFilter({ selected, onSelect, counts, disabled }: SubspecialtyFilterProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        Filter by Subspecialty
      </p>
      <div className="flex flex-wrap gap-2">
        {SUBSPECIALTIES.map((spec) => {
          const count = spec.id === "all"
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[spec.id] || 0;

          return (
            <button
              key={spec.id}
              onClick={() => onSelect(spec.id)}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                "border disabled:opacity-50 disabled:cursor-not-allowed",
                selected === spec.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-secondary"
              )}
            >
              {spec.label}
              {count > 0 && (
                <span className={cn(
                  "text-xs font-mono rounded-full px-1.5 py-0.5",
                  selected === spec.id
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
