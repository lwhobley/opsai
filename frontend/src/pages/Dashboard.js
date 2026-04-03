import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ChartLineUp, Wine, CookingPot, Lightning, Warning, 
  TrendUp, TrendDown, CaretRight, Sparkle
} from '@phosphor-icons/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { api } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7);
  const [targets, setTargets] = useState({ pour_cost_target: 20.0, food_cost_target: 30.0 });
  const [chartData, setChartData] = React.useState([]);

  React.useEffect(() => {
    api.get('/settings/targets').then(r => setTargets(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  React.useEffect(() => {
    api.get(`/reports/sales?days=${period}`)
      .then(r => {
        const rows = (r.data.rows || []).slice(-7);
        setChartData(rows.map(row => ({
          name: new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' }),
          sales: row.total,
          bar: row.bar,
          food: row.food,
        })));
      })
      .catch(() => setChartData([]));
  }, [period]);

  const fetchDashboard = async () => {
    try {
      const response = await api.get(`/dashboard?days=${period}`);
      setDashboard(response.data);
    } catch (error) {
      // (error logged server-side)
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pb-24 fade-in" data-testid="dashboard">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight text-[#F5F5F0]">Dashboard</h1>
        <p className="text-sm text-[#8E8E9F]">Last {period} days overview</p>
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
            {d}D
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <KPICard
          title="Total Sales"
          value={`$${(dashboard?.total_sales || 0).toLocaleString()}`}
          icon={<ChartLineUp className="w-5 h-5" />}
          color="gold"
        />
        <KPICard
          title="Total COGS"
          value={`${dashboard?.total_cogs_pct || 0}%`}
          icon={<TrendUp className="w-5 h-5" />}
          color={dashboard?.total_cogs_pct > 35 ? 'red' : 'green'}
          subtitle={`$${(dashboard?.total_cogs || 0).toLocaleString()}`}
        />
        <KPICard
          title="Pour Cost"
          value={`${dashboard?.pour_cost_pct || 0}%`}
          icon={<Wine className="w-5 h-5" />}
          color={dashboard?.pour_cost_pct > targets.pour_cost_target ? 'red' : 'green'}
          subtitle={`Target: ${targets.pour_cost_target}%`}
        />
        <KPICard
          title="Food Cost"
          value={`${dashboard?.food_cost_pct || 0}%`}
          icon={<CookingPot className="w-5 h-5" />}
          color={dashboard?.food_cost_pct > targets.food_cost_target ? 'red' : 'green'}
          subtitle={`Target: ${targets.food_cost_target}%`}
        />
      </div>

      {/* Chart */}
      <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-medium text-[#8E8E9F] mb-4">Sales vs COGS</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A017" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#D4A017" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#5A5A70" fontSize={12} />
              <YAxis stroke="#5A5A70" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1A2E', 
                  border: '1px solid #2B2B4A',
                  borderRadius: '8px'
                }}
              />
              <Area type="monotone" dataKey="sales" stroke="#D4A017" fill="url(#salesGradient)" />
              <Area type="monotone" dataKey="cogs" stroke="#D62828" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Variance Alerts */}
      {dashboard?.variance && (
        <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-[#8E8E9F] mb-3 flex items-center gap-2">
            <Warning className="w-4 h-4 text-[#D4A017]" />
            Variance Alerts
          </h3>
          <div className="space-y-2">
            <VarianceRow 
              label="Pour Cost" 
              variance={dashboard.variance.pour_cost_variance}
              target={20}
            />
            <VarianceRow 
              label="Food Cost" 
              variance={dashboard.variance.food_cost_variance}
              target={30}
            />
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {(dashboard?.low_bar_items?.length > 0 || dashboard?.low_kitchen_items?.length > 0) && (
        <div className="bg-[#D62828]/10 border border-[#D62828]/30 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-[#D62828] mb-3 flex items-center gap-2">
            <Warning className="w-4 h-4" weight="fill" />
            Low Stock Alerts
          </h3>
          <div className="space-y-2">
            {dashboard?.low_bar_items?.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-[#F5F5F0]">{item.name}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  item.level <= 10 ? 'bg-[#D62828] text-white' : 'bg-[#F59E0B] text-black'
                }`}>
                  {item.level}%
                </span>
              </div>
            ))}
            {dashboard?.low_kitchen_items?.slice(0, 3).map((item, i) => (
              <div key={`k-${i}`} className="flex justify-between items-center text-sm">
                <span className="text-[#F5F5F0]">{item.name}</span>
                <span className="px-2 py-1 rounded text-xs bg-[#D62828] text-white">
                  {item.quantity} / {item.par_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-[#5A5A70] font-semibold mb-3">Quick Actions</h3>
        <QuickAction icon={<Wine />} label="Start Bar Count" href="/bar" />
        <QuickAction icon={<CookingPot />} label="Start Kitchen Count" href="/kitchen" />
        <QuickAction icon={<Sparkle />} label="Get AI Insights" href="/insights" />
      </div>
    </div>
  );
};

const KPICard = ({ title, value, icon, color, subtitle }) => {
  const colors = {
    gold: 'text-[#D4A017]',
    green: 'text-[#10B981]',
    red: 'text-[#D62828]',
  };

  return (
    <div className="bg-[#1A1A2E] border border-white/5 rounded-xl p-4" data-testid={`kpi-${title.toLowerCase().replace(' ', '-')}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={colors[color]}>{icon}</span>
        <span className="text-xs text-[#8E8E9F]">{title}</span>
      </div>
      <div className={`text-2xl font-light ${colors[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-[#5A5A70] mt-1">{subtitle}</div>}
    </div>
  );
};

const VarianceRow = ({ label, variance, target }) => {
  const isOver = variance > 0;
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#F5F5F0]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#5A5A70]">vs {target}%</span>
        <span className={`flex items-center gap-1 text-sm ${isOver ? 'text-[#D62828]' : 'text-[#10B981]'}`}>
          {isOver ? <TrendUp className="w-4 h-4" /> : <TrendDown className="w-4 h-4" />}
          {Math.abs(variance)}%
        </span>
      </div>
    </div>
  );
};

const QuickAction = ({ icon, label, href }) => (
  <a 
    href={href}
    className="flex items-center justify-between p-4 bg-[#1A1A2E] border border-white/5 rounded-xl
               active:bg-[#252540] transition-all"
    data-testid={`quick-action-${label.toLowerCase().replace(' ', '-')}`}
  >
    <div className="flex items-center gap-3">
      <span className="text-[#D4A017]">{icon}</span>
      <span className="text-sm text-[#F5F5F0]">{label}</span>
    </div>
    <CaretRight className="w-5 h-5 text-[#5A5A70]" />
  </a>
);

export default Dashboard;
