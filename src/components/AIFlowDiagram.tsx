import { useEffect, useRef } from 'react';

interface Node {
  label: string;
  tooltip: string;
  y: number;
}

const nodes: Node[] = [
  { label: 'Query', tooltip: 'Technician asks a question', y: 40 },
  { label: 'Vector Retrieval', tooltip: 'Retrieves relevant context from vector memory', y: 140 },
  { label: 'Reasoning Engine', tooltip: 'Fuses context with reasoning models', y: 240 },
  { label: 'Step-by-Step Answer', tooltip: 'Machine-specific answer delivered', y: 320 },
  { label: 'Feedback Network', tooltip: 'Every verified fix strengthens the network', y: 460 },
];

export const AIFlowDiagram = () => {
  const pathRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGPathElement>(null);
  const nodeRefs = useRef<(SVGCircleElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    const pulse = pulseRef.current;
    const tip = tipRef.current;
    if (!path || !pulse || !tip) return;

    // Compute total length and configure stroke-dash animation
    const L = path.getTotalLength();
    const seg = Math.max(60, L * 0.10);
    const tipLen = Math.max(16, seg * 0.22);

    pulse.style.strokeDasharray = `${seg} ${L}`;
    pulse.style.strokeDashoffset = '0';
    tip.style.strokeDasharray = `${tipLen} ${L}`;
    tip.style.strokeDashoffset = '0';

    const dur = 10000; // 10 seconds
    let t0 = performance.now();
    let animationId: number;

    function loop(now: number) {
      const t = ((now - t0) % dur) / dur; // 0..1
      const offset = -t * (L + seg);
      pulse.style.strokeDashoffset = `${offset}`;
      tip.style.strokeDashoffset = `${offset}`;

      // Get current point along path
      const dist = t * L;
      const pt = path.getPointAtLength(dist);

      // Light up nearest node(s), but ONLY Answer node gets orange
      const threshold = 18;
      nodeRefs.current.forEach((n, i) => {
        if (!n) return;
        const ny = parseFloat(n.getAttribute('cy') || '0');
        const near = Math.abs(ny - pt.y) < threshold;
        const isAnswer = i === 3; // Step-by-Step Answer node index
        
        if (near && isAnswer) {
          n.classList.add('active-orange');
          labelRefs.current[i]?.classList.add('active-orange');
        } else {
          n.classList.remove('active-orange');
          labelRefs.current[i]?.classList.remove('active-orange');
        }
      });

      // Show orange tip only when near the Answer node
      const answerY = parseFloat(nodeRefs.current[3]?.getAttribute('cy') || '0');
      const showTip = Math.abs(answerY - pt.y) < 40;
      tip.style.opacity = showTip ? '1' : '0';

      animationId = requestAnimationFrame(loop);
    }
    
    animationId = requestAnimationFrame(loop);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative max-w-[720px] mx-auto mt-6">
      {/* SVG Flow with overlaid labels */}
      <svg 
        viewBox="0 0 400 560" 
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-[560px] overflow-visible"
      >
        <defs>
          <linearGradient id="gradCyan" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF"/>
            <stop offset="100%" stopColor="#00E5FF"/>
          </linearGradient>
          <filter id="glowCyan">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glowOrange">
            <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Backbone path (faint cyan) */}
        <path
          ref={pathRef}
          style={{ stroke: 'rgba(0, 229, 255, 0.13)' }}
          strokeWidth="2"
          fill="none"
          d="M300 40 L300 140 L300 240 L300 320 L300 460"
        />

        {/* Cyan pulse */}
        <path
          ref={pulseRef}
          style={{ stroke: 'url(#gradCyan)' }}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          filter="url(#glowCyan)"
          d="M300 40 L300 140 L300 240 L300 320 L300 460"
          pathLength="1000"
        />

        {/* Orange tip overlay */}
        <path
          ref={tipRef}
          style={{ stroke: '#FF6A00', opacity: 0 }}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          filter="url(#glowOrange)"
          d="M300 40 L300 140 L300 240 L300 320 L300 460"
          pathLength="1000"
        />

        {/* Node circles */}
        {nodes.map((node, i) => (
          <g key={i}>
            <circle
              ref={el => nodeRefs.current[i] = el}
              className="fill-black/55 stroke-cyan transition-all duration-300 node-circle"
              strokeWidth="2"
              filter="url(#glowCyan)"
              r="22"
              cx="300"
              cy={node.y}
              style={{ stroke: '#00E5FF' }}
            />
            {/* Label text positioned to the left of circles */}
            <text
              ref={el => labelRefs.current[i] = el as any}
              x="270"
              y={node.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="transition-all duration-300 label-item pointer-events-none select-none"
              style={{ 
                fill: 'hsl(var(--brand-white))', 
                fontSize: '16px', 
                fontWeight: 600,
                fontFamily: 'inherit'
              }}
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      <style>{`
        .ai-flow, .ai-flow * { font-family: inherit; }
        
        .label-item.active-orange {
          fill: hsl(var(--brand-white));
          filter: drop-shadow(0 0 8px #FF6A00);
        }

        .node-circle.active-orange {
          stroke: #FF6A00 !important;
          filter: url(#glowOrange);
        }
      `}</style>
    </div>
  );
};
