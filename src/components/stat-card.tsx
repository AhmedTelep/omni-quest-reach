import type { LucideIcon } from "lucide-react";

type Variant = "blue" | "green" | "orange" | "purple";

const GRADIENTS: Record<Variant, string> = {
  blue: "var(--gradient-stat-blue)",
  green: "var(--gradient-stat-green)",
  orange: "var(--gradient-stat-orange)",
  purple: "var(--gradient-stat-purple)",
};

const ACCENTS: Record<Variant, string> = {
  blue: "oklch(0.55 0.18 240)",
  green: "oklch(0.58 0.16 155)",
  orange: "oklch(0.62 0.18 45)",
  purple: "oklch(0.55 0.2 295)",
};

type Props = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant: Variant;
  sparkline?: number[];
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const w = 120;
  const h = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / Math.max(data.length - 1, 1);
  const pts = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

const FALLBACK_SPARKS: Record<Variant, number[]> = {
  blue: [4, 6, 5, 8, 7, 10, 9, 12],
  green: [10, 8, 12, 9, 14, 11, 15, 13],
  orange: [3, 5, 4, 7, 6, 8, 5, 9],
  purple: [6, 9, 7, 11, 8, 12, 10, 14],
};

export function StatCard({ title, value, icon: Icon, variant, sparkline }: Props) {
  const data = sparkline?.length ? sparkline : FALLBACK_SPARKS[variant];
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{
        background: GRADIENTS[variant],
        boxShadow: "var(--shadow-stat)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "color-mix(in oklab, white 35%, transparent)",
            color: ACCENTS[variant],
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 text-end">
          <p
            className="text-sm font-medium"
            style={{ color: "color-mix(in oklab, var(--foreground) 75%, transparent)" }}
          >
            {title}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <Sparkline data={data} color={ACCENTS[variant]} />
        <div
          className="text-4xl font-extrabold tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}