import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanButtonProps {
  isScanning: boolean;
  onScan: () => void;
}

export function ScanButton({ isScanning, onScan }: ScanButtonProps) {
  return (
    <motion.div whileHover={{ scale: isScanning ? 1 : 1.01 }} whileTap={{ scale: isScanning ? 1 : 0.99 }}>
      <Button
        onClick={onScan}
        disabled={isScanning}
        size="lg"
        className="h-12 px-6 text-base font-semibold"
      >
        {isScanning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Scanning…
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Scan
          </>
        )}
      </Button>
    </motion.div>
  );
}
