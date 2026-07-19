'use client';

import React from 'react';

interface GrowthChartPoint {
  date: string;
  value: number;
}

interface GrowthChartProps {
  title: string;
  unit: string;
  points: GrowthChartPoint[];
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING_X = 40;
const PADDING_Y = 24;

/**
 * Gráfico de evolução temporal simples (peso/altura/PC ao longo do tempo).
 * Plota só os valores medidos da própria criança — sem curva de referência
 * populacional (percentil/escore-Z), que este MVP não implementa (ver
 * documentacao/sprint-4-crescimento.md).
 */
export function GrowthChart({ title, unit, points }: GrowthChartProps) {
  if (points.length < 2) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {title}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Ainda não há medições suficientes para o gráfico (mínimo 2).
        </p>
      </div>
    );
  }

  const times = points.map((p) => new Date(p.date).getTime());
  const values = points.map((p) => p.value);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const scaleX = (date: string) => {
    if (maxTime === minTime) return WIDTH / 2;
    const t = new Date(date).getTime();
    return PADDING_X + ((t - minTime) / (maxTime - minTime)) * (WIDTH - 2 * PADDING_X);
  };

  const scaleY = (value: number) => {
    if (maxValue === minValue) return HEIGHT / 2;
    return HEIGHT - PADDING_Y - ((value - minValue) / (maxValue - minValue)) * (HEIGHT - 2 * PADDING_Y);
  };

  const path = points.map((p) => `${scaleX(p.date)},${scaleY(p.value)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <div>
      <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {title}
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`Gráfico de evolução de ${title}`}>
        {/* Linhas guia horizontais (mín/máx), recessivas */}
        <line
          x1={PADDING_X} x2={WIDTH - PADDING_X}
          y1={scaleY(minValue)} y2={scaleY(minValue)}
          stroke="var(--color-border)" strokeWidth={1}
        />
        <line
          x1={PADDING_X} x2={WIDTH - PADDING_X}
          y1={scaleY(maxValue)} y2={scaleY(maxValue)}
          stroke="var(--color-border)" strokeWidth={1}
        />
        <text x={4} y={scaleY(minValue) + 4} fontSize={11} fill="var(--color-text-muted)">
          {minValue}
        </text>
        <text x={4} y={scaleY(maxValue) + 4} fontSize={11} fill="var(--color-text-muted)">
          {maxValue}
        </text>

        {/* Linha da série */}
        <polyline points={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Marcadores por medição, com anel na cor da superfície */}
        {points.map((p) => (
          <circle key={p.date + p.value} cx={scaleX(p.date)} cy={scaleY(p.value)} r={4} fill="var(--color-primary)" stroke="var(--color-bg-card)" strokeWidth={2}>
            <title>
              {new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}: {p.value} {unit}
            </title>
          </circle>
        ))}

        {/* Rótulo do último valor (ponta da linha) */}
        <text
          x={Math.min(scaleX(last.date) + 6, WIDTH - PADDING_X - 2)}
          y={scaleY(last.value) - 8}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-text)"
        >
          {last.value} {unit}
        </text>
      </svg>
    </div>
  );
}
