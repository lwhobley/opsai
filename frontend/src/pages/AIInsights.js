import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkle, Lightning, Warning, TrendUp,
  CircleNotch, ArrowClockwise, CheckCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const InsightsSkeleton = () => (
  <div className="space-y-4 fade-in">
    <div className="card-surface p-5 space-y-3">
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-5/6 rounded" />
    </div>
    {[1,2,3].map(i => (
      <div key={i} className="card-surface p-5 space-y-2.5">
        <div className="flex justify-between">
          <div className="skeleton h-3.5 w-40 rounded" />
          <div className="skeleton h-5 w-12 rounded-md" />
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
    ))}
  </div>
);

// ── Period Selector ───────────────────────────────────────────────────────────
const PeriodSelector = ({ value, onChange }) => (
  <div className="segmented-control w-44">
    {[7, 14, 30].map(d => (
      <button
        key={d}
        onClick={() => onChange(d)}
        className={value === d ? 'active' : ''}
        style={value === d ? { background: '#D4A017' } : {}}
        data-testid={`period-${d}`}
      >
        {d}d
      </button>
    ))}
  </div>
);

// ── Priority Badge ────────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  const styles = {
    high:   'bg-[#D62828]/15 text-[#D62828]',
    medium: 'bg-[#D4A017]/15 text-[#D4A017]',
    low:    'bg-white/5 text-white/30',
  };
  return (
    <span className={`text-2xs px-2 py-1 rounded-md font-semibold uppercase tracking-wider ${styles[priority] || styles.low}`}>
      {priority}
    </span>
  );
};

// ── Bullet List ───────────────────────────────────────────────────────────────
const BulletList = ({ items, color }) => (
  <ul className="space-y-2">
    {items?.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 text-sm text-white/65 leading-relaxed">
        <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: color }} />
        {item}
      </li>
    ))}
  </ul>
);

// ── Context Grid ──────────────────────────────────────────────────────────────
const ContextGrid = ({ context }) => {
  if (!context) return null;
  const items = [
    { label: 'Total Sales', value: `$${(context.sales?.total || 0).toLocaleString()}` },
    { label: 'Pour Cost',   value: `${context.costs?.pour_cost_pct || 0}%` },
    { label: 'Food Cost',   value: `${context.costs?.food_cost_pct || 0}%` },
    { label: 'Total COGS',  value: `${context.costs?.total_cogs_pct || 0}%` },
  ];
  return (
    <div className="card-inset rounded-xl p-4 mt-5">
      <p className="text-section-label mb-3">Analysis Context</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {items.map(({ label, value }) => (
          <div key={label}>
            <p className="text-[11px] text-white/25 mb-0.5">{label}</p>
            <p className="text-sm text-white/75 font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── AI Insights ───────────────────────────────────────────────────────────────
const AIInsights = () => {
  const { api } = useAuth();
  const [insights, setInsights] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(7);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ai/insights', {
        include_bar:     true,
        include_kitchen: true,
        date_range_days: period,
      });
      setInsights(response.data.insights);
      setContext(response.data.context);
    } catch {
      toast.error('Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 fade-in" data-testid="ai-insights">

      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-page-title flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-[#D4A017]" weight="fill" />
            AI Insights
          </h1>
          <p className="text-[12px] text-white/30 mt-0.5">Powered by Gemini</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Generate Button */}
      <button
        onClick={fetchInsights}
        disabled={loading}
        className="w-full h-12 bg-[#D4A017] text-[#0A0A12] rounded-xl font-semibold text-sm
                   mb-5 flex items-center justify-center gap-2 active:opacity-90
                   disabled:opacity-50 transition-opacity tracking-wide"
        data-testid="generate-insights-btn"
      >
        {loading ? (
          <><CircleNotch className="w-4 h-4 animate-spin" />Analyzing…</>
        ) : (
          <><Sparkle className="w-4 h-4" weight="fill" />Generate Insights</>
        )}
      </button>

      {/* Loading skeleton */}
      {loading && <InsightsSkeleton />}

      {/* Results */}
      {insights && !loading && (
        <div className="space-y-4 fade-in">

          {/* Headline summary */}
          <div className="card-surface p-5 border-l-2 border-[#D4A017]">
            <div className="flex items-center gap-2 mb-2">
              <Lightning className="w-4 h-4 text-[#D4A017]" weight="fill" />
              <p className="text-section-label" style={{ color: '#D4A017' }}>Summary</p>
            </div>
            <p className="text-[15px] text-white/80 leading-relaxed font-light">
              {insights.summary}
            </p>
          </div>

          {/* Key Issues */}
          {insights.key_issues?.length > 0 && (
            <div className="card-surface p-5 border-l-2 border-[#D62828]">
              <div className="flex items-center gap-2 mb-3">
                <Warning className="w-4 h-4 text-[#D62828]" weight="fill" />
                <p className="text-section-label" style={{ color: '#D62828' }}>Key Issues</p>
              </div>
              <BulletList items={insights.key_issues} color="#D62828" />
            </div>
          )}

          {/* Likely Causes */}
          {insights.likely_causes?.length > 0 && (
            <div className="card-surface p-5 border-l-2 border-[#F59E0B]">
              <div className="flex items-center gap-2 mb-3">
                <Lightning className="w-4 h-4 text-[#F59E0B]" weight="fill" />
                <p className="text-section-label" style={{ color: '#F59E0B' }}>Likely Causes</p>
              </div>
              <BulletList items={insights.likely_causes} color="#F59E0B" />
            </div>
          )}

          {/* Recommendations */}
          {insights.recommendations?.length > 0 && (
            <div className="space-y-3">
              <p className="text-section-label flex items-center gap-2">
                <TrendUp className="w-3.5 h-3.5 text-[#10B981]" />
                <span style={{ color: '#10B981' }}>Recommendations</span>
              </p>
              {insights.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="card-surface p-5 fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                  data-testid={`recommendation-${i}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-[14px] text-white/85 font-medium leading-snug">{rec.title}</h4>
                    <PriorityBadge priority={rec.priority} />
                  </div>
                  <p className="text-[13px] text-white/45 leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Context data */}
          <ContextGrid context={context} />

          {/* Refresh */}
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="w-full h-11 card-surface text-white/40 text-sm rounded-xl
                       flex items-center justify-center gap-2 active:bg-white/[0.03] transition-colors"
          >
            <ArrowClockwise className="w-4 h-4" />
            Refresh Analysis
          </button>
        </div>
      )}

      {/* Empty State */}
      {!insights && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
            <Sparkle className="w-8 h-8 text-white/10" />
          </div>
          <p className="text-sm text-white/25 leading-relaxed max-w-[220px]">
            Generate AI-powered insights from your inventory and sales data
          </p>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
