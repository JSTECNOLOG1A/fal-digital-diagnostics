import React from 'react';

/**
 * @param {Object} props
 * @param {any} props.title
 * @param {any=} props.subtitle
 */
export default function QuestionnaireHeader({ title, subtitle = null }) {
  return (
    <div className="mb-1">
      <h1 className="font-black text-slate-900 tracking-tight text-3xl">{title}</h1>
      {subtitle &&
      <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      }
    </div>);

}