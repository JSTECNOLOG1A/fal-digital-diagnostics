import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { getDimensionDescription, getSubdimDescription } from '@/components/fal/falDescriptions';

/**
 * @param {Object} props
 * @param {any} props.dimKey
 * @param {any=} props.subdimKey
 * @param {any=} props.customText
 * @param {string=} props.size
 * @param {string=} props.align
 */
export default function DimensionInfoTooltip({ dimKey, subdimKey = null, customText = null, size = 'sm', align = 'left' }) {
  const [open, setOpen] = useState(false);

  const text = customText
    || (subdimKey ? getSubdimDescription(subdimKey) : null)
    || (dimKey ? getDimensionDescription(dimKey) : null);

  if (!text) return null;

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  const alignClass = align === 'right'
    ? 'right-0'
    : align === 'center'
    ? 'left-1/2 -translate-x-1/2'
    : 'left-0';

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Info className={`${iconSize} text-slate-400 hover:text-blue-500 cursor-help transition-colors flex-shrink-0`} />
      {open && (
        <span
          className={`absolute z-50 bottom-full mb-2 ${alignClass} w-64 bg-slate-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl leading-relaxed pointer-events-none`}
          role="tooltip"
        >
          {text}
          {/* Arrow */}
          <span className="absolute top-full left-4 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}