import { useEffect, useRef } from 'react';

interface Node {
  label: string;
  tooltip: string;
  y: number;
}

const nodes: Node[] = [
  { label: 'Query', tooltip: 'Technician asks a question', y: 40 },
  { label: 'Vector Retrieval', tooltip: 'Retrieves relevant context from vector memory', y: 160 },
  { label: 'Reasoning Engine', tooltip: 'Fuses context with reasoning models', y: 260 },
  { label: 'Step-by-Step Answer', tooltip: 'Machine-specific answer delivered', y: 320 },
  { label: 'Feedback Network', tooltip: 'Every verified fix strengthens the network', y: 460 },
];

export const AIFlowDiagram = () => {
  const pathRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGPathElement>(null);
  const nodeRefs = useRef<(SVGCircleElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    const pulse = pulseRef.current;
    if (!path || !pulse) return;

    // Compute total length and configure stroke-dash animation
    const L = path.getTotalLength();
    const segment = Math.max(60, L * 0.08);
    pulse.style.strokeDasharray = `${segment} ${L}`;
    pulse.style.strokeDashoffset = '0';

    const dur = 9000; // 9 seconds
    let start = performance.now();
    let animationId: number;

    function loop(now: number) {
      const t = ((now - start) % dur) / dur; // 0..1
      const offset = -t * (L + segment);
      pulse.style.strokeDashoffset = `${offset}`;

      // Get current point along path
      const dist = t * L;
      const pt = path.getPointAtLength(dist);

      // Light up nearest node(s)
      const threshold = 22;
      nodeRefs.current.forEach((n, i) => {
        if (!n) return;
        const ny = parseFloat(n.getAttribute('cy') || '0');
        const near = Math.abs(ny - pt.y) < threshold;
        
        if (near) {
          n.classList.add('active');
          labelRefs.current[i]?.classList.add('active');
        } else {
          n.classList.remove('active');
          labelRefs.current[i]?.classList.remove('active');
        }
      });

      animationId = requestAnimationFrame(loop);
    }
    
    animationId = requestAnimationFrame(loop);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative max-w-[560px] mx-auto mt-6">
      {/* Labels */}
      <div className="absolute left-0 top-0 w-[180px] text-sm font-medium">
        {nodes.map((node, i) => (
          <div
            key={i}
            ref={el => labelRefs.current[i] = el}
            className="absolute left-0 -translate-y-1/2 px-3 py-2 border border-cyan rounded-full bg-black/35 whitespace-nowrap transition-all duration-300 shadow-[0_0_0_1px_#000_inset] label-item"
            style={{ top: `${node.y}px` }}
            title={node.tooltip}
          >
            {node.label}
          </div>
        ))}
      </div>

      {/* SVG Flow */}
      <svg 
        viewBox="0 0 240 520" 
        preserveAspectRatio="xMidYMid meet"
        className="block ml-[200px] w-[340px] h-[520px] overflow-visible"
      >
        <defs>
          <filter id="glowCyan">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glowOrange">
            <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="nodeGlowCyan">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="nodeGlowOrange">
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
          className="stroke-cyan/10"
          strokeWidth="2"
          fill="none"
          d="M120 20 C 120 120, 120 220, 120 320 S 120 420, 120 500"
        />

        {/* Orange result span near Answer node */}
        <path
          className="stroke-orange opacity-0 animate-result-blink"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          filter="url(#glowOrange)"
          d="M120 300 L 120 340"
        />

        {/* Animated cyan pulse */}
        <path
          ref={pulseRef}
          className="stroke-cyan"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          filter="url(#glowCyan)"
          d="M120 20 C 120 120, 120 220, 120 320 S 120 420, 120 500"
          pathLength="1000"
        />

        {/* Node circles */}
        {nodes.map((node, i) => (
          <circle
            key={i}
            ref={el => nodeRefs.current[i] = el}
            className="fill-black/60 stroke-cyan transition-all duration-300 node-circle"
            strokeWidth="2"
            filter="url(#nodeGlowCyan)"
            r="18"
            cx="120"
            cy={node.y}
          />
        ))}
      </svg>

      <style>{`
        .label-item.active {
          border-color: hsl(24 100% 54%);
          box-shadow: 
            0 0 28px 6px hsl(24 100% 54% / 0.24),
            0 0 0 1px #000 inset;
        }

        .node-circle.active {
          stroke: hsl(24 100% 54%);
          filter: url(#nodeGlowOrange);
        }

        @keyframes result-blink {
          0%, 35%   { opacity: 0; }
          40%, 56%  { opacity: 1; }
          60%, 100% { opacity: 0; }
        }

        .animate-result-blink {
          animation: result-blink 9s linear infinite;
        }
      `}</style>
    </div>
  );
};