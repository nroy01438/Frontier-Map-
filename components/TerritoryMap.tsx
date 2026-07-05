"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { TerritoryDTO } from "@/types";

const COLOR_SCALE = d3.scaleOrdinal(d3.schemeTableau10);

function colorFor(territory: TerritoryDTO): string {
  const base = COLOR_SCALE(territory.id);
  if (territory.status === "claimed") return base;
  if (territory.status === "frontier") return "#71717a";
  return "#3f3f46";
}

interface Props {
  territories: TerritoryDTO[];
  selectedTerritoryId: string | null;
  onSelectTerritory: (id: string) => void;
}

export function TerritoryMap({ territories, selectedTerritoryId, onSelectTerritory }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container) return;

    const width = container.clientWidth;
    const height = 560;

    const points = territories.flatMap((t) =>
      t.tracks
        .filter((tr) => tr.mapX !== null && tr.mapY !== null)
        .map((tr) => ({ x: tr.mapX as number, y: tr.mapY as number, territory: t, track: tr })),
    );

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    if (points.length === 0) return;

    const xExtent = d3.extent(points, (p) => p.x) as [number, number];
    const yExtent = d3.extent(points, (p) => p.y) as [number, number];
    const pad = 0.15;
    const xPad = (xExtent[1] - xExtent[0] || 1) * pad;
    const yPad = (yExtent[1] - yExtent[0] || 1) * pad;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([48, width - 48]);
    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([height - 48, 48]);

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 6])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    zoomLayer
      .selectAll("circle.track-dot")
      .data(points)
      .join("circle")
      .attr("class", "track-dot")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", (d) => (d.territory.id === selectedTerritoryId ? 5.5 : 4))
      .attr("fill", (d) => colorFor(d.territory))
      .attr("fill-opacity", (d) =>
        selectedTerritoryId && d.territory.id !== selectedTerritoryId ? 0.25 : 0.85,
      )
      .attr("stroke", "#0a0a0c")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("click", (_event, d) => onSelectTerritory(d.territory.id))
      .append("title")
      .text((d) => `${d.track.trackName} — ${d.track.artistName}`);

    const centroids = territories
      .map((t) => {
        const pts = points.filter((p) => p.territory.id === t.id);
        if (pts.length === 0) return null;
        return {
          territory: t,
          x: d3.mean(pts, (p) => p.x) as number,
          y: d3.mean(pts, (p) => p.y) as number,
        };
      })
      .filter((c): c is { territory: TerritoryDTO; x: number; y: number } => c !== null);

    zoomLayer
      .selectAll("text.territory-label")
      .data(centroids)
      .join("text")
      .attr("class", "territory-label")
      .attr("x", (d) => xScale(d.x))
      .attr("y", (d) => yScale(d.y) - 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", (d) => (d.territory.id === selectedTerritoryId ? "#f5f5f5" : "#d4d4d8"))
      .style("cursor", "pointer")
      .style("pointer-events", "all")
      .text((d) => d.territory.label)
      .on("click", (_event, d) => onSelectTerritory(d.territory.id));
  }, [territories, selectedTerritoryId, onSelectTerritory]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <svg ref={svgRef} />
    </div>
  );
}
