"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";

import type { FinanceDashboardMetrics } from "@/lib/finance";

type FinanceChartPoint = FinanceDashboardMetrics["trend"][number] & {
  x: number;
  y: number;
};

function getSmoothLinePath(points: FinanceChartPoint[]) {
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
    const controlStartY = previous.y + (point.y - beforePrevious.y) / 6;
    const controlEndX = point.x - (next.x - previous.x) / 6;
    const controlEndY = point.y - (next.y - previous.y) / 6;

    return `${path} C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${point.x} ${point.y}`;
  }, "");
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

export function RevenueOverTimeChart({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const maxValue = Math.max(...metrics.trend.map((point) => point.totalMovement.cents), 1);
  const chartWidth = 640;
  const chartHeight = 220;
  const paddingX = 28;
  const paddingY = 24;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const points = metrics.trend.map((point, index) => {
    const x =
      metrics.trend.length === 1
        ? chartWidth / 2
        : paddingX + (index / (metrics.trend.length - 1)) * plotWidth;
    const y = chartHeight - paddingY - (point.totalMovement.cents / maxValue) * plotHeight;

    return { ...point, x, y };
  });
  const linePath = getSmoothLinePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";
  const activePoint = points.find((point) => point.key === activePointKey) ?? null;

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
              className="finance-line-chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label="Evolução da movimentação financeira"
            >
              <path className="finance-line-chart__area" d={areaPath} />
              <path className="finance-line-chart__line" d={linePath} />
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
                  <circle
                    className="finance-line-chart__point-dot"
                    cx={point.x}
                    cy={point.y}
                    r={activePointKey === point.key ? "5" : "3.8"}
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
            {points.map((point) => (
              <span key={point.key}>{point.label}</span>
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
