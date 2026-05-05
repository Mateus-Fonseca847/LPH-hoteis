"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import type { FinanceDashboardMetrics } from "@/lib/finance";

type FinanceChartPoint = FinanceDashboardMetrics["trend"][number] & {
  x: number;
  y: number;
};

function getSmoothLinePath(points: FinanceChartPoint[], minY: number, maxY: number) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const beforePrevious = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const controlStartX = previous.x + (point.x - beforePrevious.x) / 6;
    const controlStartY = clampChartY(previous.y + (point.y - beforePrevious.y) / 6, minY, maxY);
    const controlEndX = point.x - (next.x - previous.x) / 6;
    const controlEndY = clampChartY(point.y - (next.y - previous.y) / 6, minY, maxY);

    return `${path} C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${point.x} ${point.y}`;
  }, "");
}

function clampChartY(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTooltipPositionClass(
  point: FinanceChartPoint,
  chartWidth: number,
  chartHeight: number
) {
  const xRatio = point.x / chartWidth;
  const horizontal = xRatio < 0.18 ? "start" : xRatio > 0.82 ? "end" : "center";
  const vertical = point.y < chartHeight * 0.34 ? "below" : "above";

  return `finance-line-chart-tooltip--${horizontal} finance-line-chart-tooltip--${vertical}`;
}

function getVisibleLabels(points: FinanceChartPoint[]) {
  if (points.length <= 6) {
    return points;
  }

  const lastIndex = points.length - 1;
  const step = Math.ceil(lastIndex / 5);
  const labels = points.filter(
    (_, index) => index === 0 || index === lastIndex || index % step === 0
  );

  return labels[labels.length - 1]?.key === points[lastIndex].key
    ? labels
    : [...labels, points[lastIndex]];
}

export function RevenueOverTimeChart({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const maxValue = Math.max(...metrics.trend.map((point) => point.totalMovement.cents), 1);
  const chartWidth = 640;
  const chartHeight = 220;
  const paddingX = 28;
  const paddingY = 24;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const sortedTrend = [...metrics.trend].sort((left, right) => left.key.localeCompare(right.key));
  const points = sortedTrend.map((point, index) => {
    const x =
      sortedTrend.length === 1
        ? chartWidth / 2
        : paddingX + (index / (sortedTrend.length - 1)) * plotWidth;
    const y = chartHeight - paddingY - (point.totalMovement.cents / maxValue) * plotHeight;

    return { ...point, x, y };
  });
  const linePath = getSmoothLinePath(points, paddingY, chartHeight - paddingY);
  const activePoint = points.find((point) => point.key === activePointKey) ?? null;
  const visibleLabels = getVisibleLabels(points);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const svg = chartRef.current;

    if (!svg || !points.length) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const closestPoint = points.reduce((closest, point) =>
      Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
    );

    setActivePointKey(closestPoint.key);
  }

  function handlePointKeyDown(event: KeyboardEvent<SVGGElement>, pointKey: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setActivePointKey(pointKey);
  }

  return (
    <article className="hotel-content-card finance-chart-card finance-chart-card--wide">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Movimentação ao longo do tempo</h3>
        </div>
        <p>Receita paga agrupada conforme o período selecionado.</p>
      </div>

      {points.length ? (
        <>
          <div className="finance-line-chart-stage" onMouseLeave={() => setActivePointKey(null)}>
            <svg
              ref={chartRef}
              className="finance-line-chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              onPointerMove={handlePointerMove}
              aria-label="Evolução da movimentação financeira"
            >
              <defs>
                <clipPath id="finance-line-chart-clip">
                  <rect x={paddingX} y={paddingY} width={plotWidth} height={plotHeight} />
                </clipPath>
              </defs>
              <g clipPath="url(#finance-line-chart-clip)">
                <path
                  className="finance-line-chart__line"
                  d={linePath}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              {points.map((point) => (
                <g
                  key={point.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${point.label}: ${point.totalMovement.formatted}`}
                  className="finance-line-chart__point"
                  onBlur={() => setActivePointKey(null)}
                  onClick={() => setActivePointKey(point.key)}
                  onFocus={() => setActivePointKey(point.key)}
                  onKeyDown={(event) => handlePointKeyDown(event, point.key)}
                  onMouseEnter={() => setActivePointKey(point.key)}
                >
                  <circle
                    className="finance-line-chart__point-hit"
                    cx={point.x}
                    cy={point.y}
                    r="11"
                  />
                </g>
              ))}
            </svg>

            {activePoint ? (
              <div
                className={`finance-line-chart-tooltip ${getTooltipPositionClass(
                  activePoint,
                  chartWidth,
                  chartHeight
                )}`}
                role="status"
                style={
                  {
                    "--tooltip-x": `${(activePoint.x / chartWidth) * 100}%`,
                    "--tooltip-y": `${(activePoint.y / chartHeight) * 100}%`,
                  } as CSSProperties
                }
              >
                <span>{activePoint.label}</span>
                <strong>{activePoint.totalMovement.formatted}</strong>
              </div>
            ) : null}
          </div>

          <div className="finance-line-chart-labels">
            {visibleLabels.map((point) => (
              <span
                key={point.key}
                style={{ "--label-x": `${(point.x / chartWidth) * 100}%` } as CSSProperties}
              >
                {point.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="admin-finance-empty">
          Ainda não há movimentações financeiras no período selecionado.
        </p>
      )}
    </article>
  );
}
