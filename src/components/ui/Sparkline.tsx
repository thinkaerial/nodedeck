export function Sparkline({
  data,
  width = 64,
  height = 20,
  className,
  strokeClassName = "stroke-accent",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.5}
        className={strokeClassName}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
