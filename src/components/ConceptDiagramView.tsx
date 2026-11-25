import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { ConceptDiagram } from '../shared/types';

interface ConceptDiagramViewProps {
  diagram: ConceptDiagram;
}

export const ConceptDiagramView: React.FC<ConceptDiagramViewProps> = ({
  diagram,
}) => {
  if (!diagram || !Array.isArray(diagram.nodes) || diagram.nodes.length === 0) {
    return null;
  }
  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];

  return (
    <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50/70 border border-sky-200 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-sky-200/80 pb-2">
        <h4 className="font-display text-sm font-semibold text-[#0f294d]">
          {diagram.title}
        </h4>
        <span className="text-xs text-blue-700 font-medium capitalize">
          {diagram.diagramType} visual
        </span>
      </div>

      <div
        className={
          diagram.diagramType === 'comparison'
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
            : 'flex flex-col gap-2.5'
        }
      >
        {diagram.nodes.map((node, index) => {
          const outgoing = edges.find((e) => e.from === node.id);
          return (
            <React.Fragment key={node.id || index}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.08 }}
                className="p-3 rounded-lg bg-white border border-blue-200 shadow-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-600 tabular-nums">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-sm font-semibold text-[#0f294d]">
                    {node.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {node.detail}
                </p>
              </motion.div>

              {diagram.diagramType !== 'comparison' &&
                index < diagram.nodes.length - 1 && (
                  <div className="flex items-center gap-2 pl-4 text-xs text-blue-700">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 rotate-90 shrink-0" />
                    {outgoing?.label && <span>{outgoing.label}</span>}
                  </div>
                )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
