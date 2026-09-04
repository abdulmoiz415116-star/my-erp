import React, { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, description, badge, breadcrumbs, actions }: PageHeaderProps) {
  const displaySubtitle = subtitle || description;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {b.href ? (
                  <a href={b.href} className="hover:text-indigo-600 transition-colors">
                    {b.label}
                  </a>
                ) : (
                  <span className="text-slate-600 font-medium">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {badge}
        </div>
        {displaySubtitle && <p className="text-sm text-slate-500 mt-1">{displaySubtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
