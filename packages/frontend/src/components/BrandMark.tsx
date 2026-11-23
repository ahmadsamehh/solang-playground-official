import Image from "next/image";
import SolangLogo from "@/assets/image/solang-logo.png";
import { cn } from "@/lib/utils";

/** Solang logo + product name, as shown at the left of every top bar. */
function BrandMark({ product, className }: { product: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image src={SolangLogo} alt="Solang Logo" width={22} height={22} />
      <span className="text-sm font-semibold tracking-tight text-ide-text">Solang</span>
      <span className="hidden text-sm text-ide-muted sm:inline">{product}</span>
    </div>
  );
}

export default BrandMark;
