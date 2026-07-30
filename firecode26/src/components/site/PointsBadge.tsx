import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PointsBadgeProps {
  points: number;
  className?: string;
}

export function PointsBadge({ points, className }: PointsBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`border-[color:var(--color-ember)]/40 text-[color:var(--color-ember)] gap-1 font-mono ${className || ""}`}
    >
      <Zap className="h-3 w-3 fill-[color:var(--color-ember)]" />
      {points.toLocaleString()} pts
    </Badge>
  );
}
