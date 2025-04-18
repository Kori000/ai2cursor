import { cn } from "~/lib/utils";

interface RippleAnimationProps {
  className?: string;
  color?: string;
}

export function RippleAnimation({ className, color = "#3b82f6" }: RippleAnimationProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {Array.from({ length: 10 }).map((_, i) => (
        <i
          key={i}
          className="absolute block w-[50px] h-[50px] rounded-[140px] opacity-0 animate-ripple"
          style={{
            backgroundColor: color,
            animationDelay: `${0.3 * (i + 1)}s`,
          }}
        />
      ))}
    </div>
  );
} 
