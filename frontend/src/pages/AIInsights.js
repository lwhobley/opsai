import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkle, Lightning, Warning, TrendUp, CircleNotch, ArrowClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';

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
        include_bar: true,
        include_kitchen: true,
        date_range_days: period,
      });
      setInsights(response.data.insights);
      setContext(response.data.context);
    } catch (error) {
      console.error('AI insights error:', error);
      toast.error('Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 fade-in" data-testid="ai-insights">
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0] flex items-center gap-2">
          <Sparkle className="w-6 h-6 text-[#D4A017]" weight="fill" />
          AI Insights
        </h1>
        <p className="text-sm text-[#8E8E9F]">Powered by Gemini AI</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setPeriod(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === d 
                ? 'bg-[#D4A017] text-[#0A0A12]' 
                : 'bg-[#1A1A2E] text-[#8E8E9F] border border-[#2B2B4A]'
            }`}
            data-testid={`period-${d}`}
          >
            {d} Days
          </button>
        ))}
      </div>

      {/* Generate Button */}
      <button
        onClick={fetchInsights}
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-[#D4A017] to-[#E5B83A] text-[#0A0A12] 
                   rounded-xl font-medium mb-6 flex items-center justify-center gap-2
                   active:opacity-90 disabled:opacity-50"
        data-testid="generate-insights-btn"
      >
        {loading ? (
          <>
            <CircleNotch className="w-5 h-5 animate-spin" />
            Analyzing Data...
          </>
        ) : (
          <>
            <Sparkle className="w-5 h-5" weight="fill" />
            Generate AI Insights
          </>
        )}
      </button>

      {/* Insights Display */}
      {insights && (
        <div className="space-y-4 fade-in">
          {/* Summary */}
          <div className="glass rounded-xl p-5">
            <p className="text-[#F5F5F0] text-lg leading-relaxed">{insights.summary}</p>
          </div>

          {/* Key Issues */}
          <div className="bg-[#D62828]/10 border border-[#D62828]/30 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#D62828] mb-3 flex items-center gap-2">
              <Warning className="w-4 h-4" weight="fill" />
              Key Issues
            </h3>
            <ul className="space-y-2">
              {insights.key_issues?.map((issue, i) => (
                <li key={i} className="text-sm text-[#F5F5F0] flex items-start gap-2">
                  <span className="text-[#D62828] mt-1">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </div>

          {/* Likely Causes */}
          <div className="bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#D4A017] mb-3 flex items-center gap-2">
              <Lightning className="w-4 h-4" weight="fill" />
              Likely Causes
            </h3>
            <ul className="space-y-2">
              {insights.likely_causes?.map((cause, i) => (
                <li key={i} className="text-sm text-[#F5F5F0] flex items-start gap-2">
                  <span className="text-[#D4A017] mt-1">•</span>
                  {cause}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#10B981] flex items-center gap-2">
              <TrendUp className="w-4 h-4" />
              Recommendations
            </h3>
            {insights.recommendations?.map((rec, i) => (
              <div 
                key={i} 
                className="glass rounded-xl p-5"
                data-testid={`recommendation-${i}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-[#F5F5F0] font-medium">{rec.title}</h4>
                  <span className={`px-2 py-0.5 rounded text-xs uppercase ${
                    rec.priority === 'high' ? 'bg-[#D62828] text-white' :
                    rec.priority === 'medium' ? 'bg-[#D4A017] text-black' :
                    'bg-[#2B2B4A] text-[#8E8E9F]'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-sm text-[#8E8E9F]">{rec.description}</p>
              </div>
            ))}
          </div>

          {/* Context Data */}
          {context && (
            <div className="mt-6 p-4 bg-[#1A1A2E] border border-white/5 rounded-xl">
              <h4 className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold mb-3">
                Analysis Context
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[#5A5A70]">Total Sales:</span>
                  <span className="text-[#F5F5F0] ml-2">${context.sales?.total?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#5A5A70]">Pour Cost:</span>
                  <span className="text-[#F5F5F0] ml-2">{context.costs?.pour_cost_pct}%</span>
                </div>
                <div>
                  <span className="text-[#5A5A70]">Food Cost:</span>
                  <span className="text-[#F5F5F0] ml-2">{context.costs?.food_cost_pct}%</span>
                </div>
                <div>
                  <span className="text-[#5A5A70]">Total COGS:</span>
                  <span className="text-[#F5F5F0] ml-2">{context.costs?.total_cogs_pct}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="w-full py-3 bg-[#1A1A2E] border border-white/5 text-[#8E8E9F] 
                       rounded-xl flex items-center justify-center gap-2 active:bg-[#252540]"
          >
            <ArrowClockwise className="w-4 h-4" />
            Refresh Analysis
          </button>
        </div>
      )}

      {/* Empty State */}
      {!insights && !loading && (
        <div className="text-center py-12">
          <Sparkle className="w-16 h-16 text-[#2B2B4A] mx-auto mb-4" />
          <p className="text-[#5A5A70]">
            Click the button above to generate AI-powered insights
            <br />
            based on your inventory and sales data
          </p>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
