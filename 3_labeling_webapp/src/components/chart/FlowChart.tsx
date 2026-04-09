import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { REFERENCE_CURVE, LABEL_COLORS } from '../../config/constants';
import type { Label, UrinFlowPoint } from '../../types/measurement';

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

interface Props {
  curve: UrinFlowPoint[];
  label?: Label | null;
}

export function FlowChart({ curve, label }: Props) {
  if (!curve || curve.length === 0) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Keine Kurvendaten vorhanden</div>;
  }

  const sorted = [...curve].sort((a, b) => a.time - b.time);
  const timeOffset = sorted[0]?.time ?? 0;
  const lineColor = label ? LABEL_COLORS[label] : '#4a6cf7';
  const fillColor = label ? LABEL_COLORS[label] + '18' : 'rgba(74,108,247,0.08)';

  const data = {
    datasets: [
      {
        label: 'Flow Rate (ml/s)',
        data: sorted.map((p) => ({ x: p.time - timeOffset, y: p.uro_flow })),
        borderColor: lineColor,
        backgroundColor: fillColor,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2.5,
      },
      {
        label: 'Referenz (normal)',
        data: REFERENCE_CURVE.map((p) => ({ x: p.t, y: p.flow })),
        borderColor: '#b0b8c8',
        borderDash: [6, 4],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y} ml/s`,
          title: (ctx: { parsed: { x: number } }[]) => `${ctx[0].parsed.x}s`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Zeit (s)', font: { size: 12 } },
        grid: { display: false },
        min: 0,
      },
      y: {
        title: { display: true, text: 'Flow Rate (ml/s)', font: { size: 12 } },
        beginAtZero: true,
        grid: { color: '#f0f0f0' },
      },
    },
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 300 }}>
      <Line data={data} options={options} />
    </div>
  );
}
