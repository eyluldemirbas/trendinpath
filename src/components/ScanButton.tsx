import { motion } from "framer-motion";
import { Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanButtonProps {
  isScanning: boolean;
  onScan: () => void;
}

export function ScanButton({ isScanning, onScan }: ScanButtonProps) {
  return (
    <motion.div whileHover={{ scale: isScanning ? 1 : 1.02 }} whileTap={{ scale: isScanning ? 1 : 0.98 }}>
      <Button
        onClick={onScan}
        disabled={isScanning}
        size="lg"
        className="relative h-14 px-8 text-lg font-display font-semibold bg-primary text-primary-foreground hover:bg-primary/90 glow-primary transition-all duration-300 disabled:opacity-70"
      >
        {isScanning ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Scanning PubMed…
          </>
        ) : (
          <>
            <Radar className="mr-2 h-5 w-5" />
            Run PathScan
          </>
        )}
      </Button>
    </motion.div>
  );
}
