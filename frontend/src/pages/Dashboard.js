import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChartLineUp, Wine, CookingPot, Lightning, Warning,
  TrendUp, TrendDown, CaretRight, Sparkle
} from '@phosphor-icons/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonKPI = () => (
  <div className="card-surface p-4 space-y-3">
    <div className="skeleton h-3 w-20 rounded" />
    <div className="skeleton h-8 w-28 rounded" />
    <div className="skeleton h-2 w-16 rounded" />
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-5">
    <div>
      <div className="skeleton h-5 w-32 rounded mb-2" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
    <div className="skeleton h-8 w-40 rounded-lg" />
    <div className="grid grid-cols-2 gap-3">
      {[0,1,2,3].map(i => <SkeletonKPI key={i} />)}
    </div>
    <div className="card-surface p-4">
      <div className="skeleton h-3 w-28 rounded mb-4" />
      <div className="skeleton h-40 w-full rounded" />
    </div>
  </div>
);

// ── Period Selector ───────────────────────────────────────────────────────────
const PeriodSelector = ({ value, onChange }) => (
  <div className="segmented-control w-40">
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

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ title, value, icon, status, subtitle, delay }) => {
  const statusStyles = {
    gold:  { text: 'text-[#D4A017]', bar: 'bg-[#D4A017]', bg: 'bg-[#D4A017]/8' },
    green: { text: 'text-[#10B981]', bar: 'bg-[#10B981]', bg: 'bg-[#10B981]/8' },
    red:   { text: 'text-[#D62828]', bar: 'bg-[#D62828]', bg: 'bg-[#D62828]/8' },
  };
  const s = statusStyles[status] || statusStyles.gold;

  return (
    <div
      className={`card-surface p-4 fade-in-up-delay-${delay || 1} overflow-hidden`}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xs text-white/35 font-medium tracking-wide uppercase">{title}</span>
        <span className={`${s.text} ${s.bg} p-1.5 rounded-md`}>{icon}</span>
      </div>
      <div className={`text-metric ${s.text}`}>{value}</div>
      {subtitle && (
        <div className="text-[11px] text-white/25 mt-1.5 tracking-wide">{subtitle}</div>
      )}
    </div>
  );
};

// ── Variance Row ──────────────────────────────────────────────────────────────
const VarianceRow = ({ label, variance, target }) => {
  const isOver = variance > 0;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/20">vs {target}%</span>
        <span className={`flex items-center gap-1 text-sm font-medium ${isOver ? 'text-[#D62828]' : 'text-[#10B981]'}`}>
          {isOver ? <TrendUp className="w-3.5 h-3.5" /> : <TrendDown className="w-3.5 h-3.5" />}
          {Math.abs(variance).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// ── Quick Action ──────────────────────────────────────────────────────────────
const QuickAction = ({ icon, label, path, delay }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center justify-between p-4 card-surface active:bg-white/[0.03]
                  transition-colors fade-in-up-delay-${delay}`}
      data-testid={`quick-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[#D4A017] text-lg">{icon}</span>
        <span className="text-sm text-white/75 font-light">{label}</span>
      </div>
      <CaretRight className="w-4 h-4 text-white/15" />
    </button>
  );
};

// ── Custom Chart Tooltip ──────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs">
      <p className="text-white/40 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: ${(entry.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { api } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7);
  const [targets, setTargets] = useState({ pour_cost_target: 20.0, food_cost_target: 30.0 });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    api.get('/settings/targets').then(r => setTargets(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchDashboard(); }, [period]);

  useEffect(() => {
    api.get(`/reports/sales?days=${period}`)
      .then(r => {
        const rows = (r.data.rows || []).slice(-7);
        setChartData(rows.map(row => ({
          name: new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' }),
          Sales: row.total,
        })));
      })
      .catch(() => setChartData([]));
  }, [period]);

  const fetchDashboard = async () => {
    try {
      const response = await api.get(`/dashboard?days=${period}`);
      setDashboard(response.data);
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) return <DashboardSkeleton />;

  const pourOver  = dashboard?.pour_cost_pct > targets.pour_cost_target;
  const foodOver  = dashboard?.food_cost_pct > targets.food_cost_target;
  const cogsOver  = dashboard?.total_cogs_pct > 35;
  const hasAlerts = dashboard?.low_bar_items?.length > 0 || dashboard?.low_kitchen_items?.length > 0;

  return (
    <div className="pb-24 space-y-5 fade-in" data-testid="dashboard">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-page-title">Dashboard</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Last {period} days</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          title="Total Sales"
          value={`$${(dashboard?.total_sales || 0).toLocaleString()}`}
          icon={<ChartLineUp className="w-4 h-4" />}
          status="gold"
          delay={1}
        />
        <KPICard
          title="Total COGS"
          value={`${(dashboard?.total_cogs_pct || 0).toFixed(1)}%`}
          icon={<TrendUp className="w-4 h-4" />}
          status={cogsOver ? 'red' : 'green'}
          subtitle={`$${(dashboard?.total_cogs || 0).toLocaleString()}`}
          delay={2}
        />
        <KPICard
          title="Pour Cost"
          value={`${(dashboard?.pour_cost_pct || 0).toFixed(1)}%`}
          icon={<Wine className="w-4 h-4" />}
          status={pourOver ? 'red' : 'green'}
          subtitle={`Target ${targets.pour_cost_target}%`}
          delay={3}
        />
        <KPICard
          title="Food Cost"
          value={`${(dashboard?.food_cost_pct || 0).toFixed(1)}%`}
          icon={<CookingPot className="w-4 h-4" />}
          status={foodOver ? 'red' : 'green'}
          subtitle={`Target ${targets.food_cost_target}%`}
          delay={4}
        />
      </div>

      {/* Sales Chart */}
      {chartData.length > 0 && (
        <div className="card-surface p-4 fade-in-up">
          <p className="text-section-label mb-4">Sales — 7 Day Trend</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#D4A017" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#D4A017" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.12)"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)', fontFamily: 'Manrope' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.12)"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)', fontFamily: 'Manrope' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
                <Area
                  type="monotone"
                  dataKey="Sales"
                  stroke="#D4A017"
                  strokeWidth={1.5}
                  fill="url(#salesGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#D4A017', stroke: '#0A0A12', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Variance */}
      {dashboard?.variance && (
        <div className="card-surface px-4 fade-in-up">
          <div className="flex items-center gap-2 pt-4 pb-2">
            <Warning className="w-3.5 h-3.5 text-[#D4A017]" weight="fill" />
            <p className="text-section-label">Variance</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            <VarianceRow
              label="Pour Cost"
              variance={dashboard.variance.pour_cost_variance}
              target={targets.pour_cost_target}
            />
            <VarianceRow
              label="Food Cost"
              variance={dashboard.variance.food_cost_variance}
              target={targets.food_cost_target}
            />
          </div>
          <div className="pb-2" />
        </div>
      )}

      {/* Low Stock */}
      {hasAlerts && (
        <div className="rounded-xl border border-[#D62828]/20 bg-[#D62828]/5 px-4 fade-in-up">
          <div className="flex items-center gap-2 pt-4 pb-2">
            <Warning className="w-3.5 h-3.5 text-[#D62828]" weight="fill" />
            <p className="text-section-label" style={{ color: '#D62828' }}>Low Stock</p>
          </div>
          <div className="space-y-2.5 pb-4">
            {dashboard?.low_bar_items?.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-white/70">{item.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                  item.level <= 10 ? 'bg-[#D62828]/20 text-[#D62828]' : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                }`}>
                  {item.level}%
                </span>
              </div>
            ))}
            {dashboard?.low_kitchen_items?.slice(0, 3).map((item, i) => (
              <div key={`k-${i}`} className="flex items-center justify-between">
                <span className="text-sm text-white/70">{item.name}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#D62828]/20 text-[#D62828]">
                  {item.quantity}/{item.par_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <p className="text-section-label mb-3">Quick Actions</p>
        <div className="space-y-1.5">
          <QuickAction icon={<Wine />}       label="Start Bar Count"    path="/bar"      delay={1} />
          <QuickAction icon={<CookingPot />} label="Start Kitchen Count" path="/kitchen"  delay={2} />
          <QuickAction icon={<Sparkle />}    label="Get AI Insights"    path="/insights" delay={3} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
