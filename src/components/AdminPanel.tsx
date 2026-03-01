import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { 
  Users, 
  DollarSign, 
  Activity, 
  AlertTriangle, 
  Search, 
  Bell, 
  LayoutGrid, 
  FileCode, 
  Terminal, 
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  LogOut
} from "lucide-react";
import { cn } from "../utils/cn";

export default function AdminPanel({ onBack, user }: { onBack: () => void, user: any }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscriptions' | 'logs'>('overview');
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    dailyRevenue: 0,
    processedToday: 0,
    anomalyRate: 0
  });
  const [userList, setUserList] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newCredits, setNewCredits] = useState<number>(0);

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(data => setUserList(data));
  };

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then(res => res.json())
      .then(data => setMetrics(data));
    
    fetchUsers();
  }, []);

  const handleUpdateCredits = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch("/api/admin/users/update-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, credits: newCredits })
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error("Error updating credits:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] flex flex-col p-6 gap-8 bg-[var(--bg)]">
        <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={onBack}>
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white">
            <Terminal size={20} />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">XMLs PRO Admin</span>
        </div>

        <nav className="flex-1 space-y-1">
          <div onClick={() => setActiveTab('overview')}>
            <AdminSidebarItem icon={<LayoutGrid size={18} />} label={t('overview')} active={activeTab === 'overview'} />
          </div>
          <div onClick={() => setActiveTab('users')}>
            <AdminSidebarItem icon={<Users size={18} />} label={t('userDirectory')} active={activeTab === 'users'} />
          </div>
          <div onClick={() => setActiveTab('subscriptions')}>
            <AdminSidebarItem icon={<DollarSign size={18} />} label="Subscriptions" active={activeTab === 'subscriptions'} />
          </div>
          <div onClick={() => setActiveTab('logs')}>
            <AdminSidebarItem icon={<Terminal size={18} />} label={t('systemLogs')} active={activeTab === 'logs'} />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-[var(--border)] space-y-4">
          <button 
            onClick={onBack}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold opacity-40 hover:opacity-100 hover:bg-[var(--card)] transition-all"
          >
            <LogOut size={18} className="rotate-180" />
            Back to App
          </button>
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--card)]">
            <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center text-brand font-bold text-xs">
              {(user?.name || 'AD').split(' ').map((n: any) => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] opacity-40 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Admin Main */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-1">
              {activeTab === 'overview' ? t('overview') : 
               activeTab === 'users' ? t('userDirectory') : 
               activeTab === 'subscriptions' ? 'Subscriptions' : t('systemLogs')}
            </h1>
            <p className="text-xs opacity-40 font-medium">Afternoon Summary • Calm & Precise</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('systemHealthy')}
            </div>
          </div>
        </header>

        {activeTab === 'overview' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-6 mb-10">
              <AdminStatCard 
                label={t('totalUsers')} 
                value={metrics.totalUsers.toLocaleString()} 
                trend="+12.4%" 
                icon={<Users size={20} className="text-blue-500" />} 
              />
              <AdminStatCard 
                label={t('dailyRevenue')} 
                value={`$${metrics.dailyRevenue.toFixed(2)}`} 
                trend="+2.1%" 
                icon={<DollarSign size={20} className="text-emerald-500" />} 
              />
              <AdminStatCard 
                label="Processed Today" 
                value={metrics.processedToday.toLocaleString()} 
                status="Stable" 
                icon={<Activity size={20} className="text-amber-500" />} 
              />
              <AdminStatCard 
                label={t('anomalyRate')} 
                value={`${metrics.anomalyRate}%`} 
                trend="-0.4%" 
                icon={<AlertTriangle size={20} className="text-rose-500" />} 
              />
            </div>

            {/* Main Admin Content */}
            <div className="grid grid-cols-1 gap-8">
              {/* Chart Placeholder */}
              <div className="p-8 rounded-[2rem] bg-[var(--card)] border border-[var(--border)]">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="font-bold text-lg">Processing Equilibrium</h3>
                    <p className="text-xs opacity-40">Throughput performance measured in 4-hour intervals.</p>
                  </div>
                </div>
                
                <div className="h-64 flex items-end gap-4 px-4">
                  {[40, 70, 100, 60, 45, 30].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        className={cn(
                          "w-full rounded-t-lg transition-colors",
                          i === 2 ? "bg-amber-200" : "bg-[var(--border)] opacity-50"
                        )}
                      />
                      <span className="text-[10px] font-bold opacity-30">{['08:00', '12:00', 'CURRENT', '20:00', '00:00', '04:00'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'users' ? (
          <div className="rounded-[2rem] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
            <div className="p-8 border-b border-[var(--border)] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">User Directory</h3>
                <p className="text-xs opacity-40">Manage and monitor your user base.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg)]/50">
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">User</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">Plan</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">Credits</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">Joined</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg)]/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-[10px] font-bold">
                            {u.name.split(' ').map((n: any) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{u.name}</p>
                            <p className="text-[10px] opacity-40">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          u.plan === 'Pro Unlimited' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {u.plan}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold">{u.credits.toLocaleString()}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs opacity-40">{u.joined}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => {
                            setEditingUser(u);
                            setNewCredits(u.credits);
                          }}
                          className="p-2 rounded-lg hover:bg-[var(--border)] opacity-40 hover:opacity-100 transition-all"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingUser && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[var(--card)] p-8 rounded-[2rem] border border-[var(--border)] max-w-sm w-full shadow-2xl"
                >
                  <h3 className="text-xl font-bold mb-2">Editar Créditos</h3>
                  <p className="text-sm opacity-50 mb-6">Usuario: {editingUser.name}</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Cantidad de Créditos</label>
                      <input 
                        type="number" 
                        value={newCredits}
                        onChange={(e) => setNewCredits(parseInt(e.target.value))}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] font-bold focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setEditingUser(null)}
                        className="flex-1 py-3 rounded-xl border border-[var(--border)] font-bold text-sm hover:bg-[var(--bg)] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleUpdateCredits}
                        className="flex-1 py-3 rounded-xl bg-brand text-white font-bold text-sm shadow-lg shadow-brand/20 hover:scale-[1.02] transition-transform"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        ) : activeTab === 'subscriptions' ? (
          <div className="rounded-[2rem] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
            <div className="p-8 border-b border-[var(--border)] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Subscriptions</h3>
                <p className="text-xs opacity-40">Stripe billing and revenue tracking.</p>
              </div>
            </div>
            <div className="p-12 flex flex-col items-center justify-center opacity-40">
              <DollarSign size={48} className="mb-4" />
              <p className="text-sm font-bold">Revenue metrics are being synchronized</p>
              <p className="text-xs">Check your Stripe Dashboard for real-time data.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[2rem] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
            <div className="p-8 border-b border-[var(--border)] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">System Logs</h3>
                <p className="text-xs opacity-40">Real-time monitoring of application events.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg)]/50">
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">{t('initiator')}</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">{t('eventDetail')}</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">{t('reference')}</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30">{t('priority')}</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest opacity-30 text-right">{t('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <LogTableRow 
                    user="Thomas H. Nielsen" 
                    tier="ENTERPRISE" 
                    event="Schema Mismatch" 
                    detail="Unexpected node <TaxRegistry> in header." 
                    refId="#XML-902-8812" 
                    priority={t('moderate')} 
                    priorityColor="bg-amber-500"
                  />
                  <LogTableRow 
                    user="Sarah Chen" 
                    tier="BUSINESS" 
                    event="Timeout Incident" 
                    detail="Worker reached 30s limit on 45MB stream." 
                    refId="#XML-771-0023" 
                    priority={t('critical')} 
                    priorityColor="bg-rose-500"
                  />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AdminSidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
      active ? "bg-[var(--card)] text-[var(--text)] border border-[var(--border)]" : "opacity-40 hover:opacity-100 hover:bg-[var(--card)]"
    )}>
      {icon}
      {label}
    </div>
  );
}

function AdminStatCard({ label, value, trend, status, icon }: { label: string, value: string, trend?: string, status?: string, icon: React.ReactNode }) {
  return (
    <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)]">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          {icon}
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend}
          </span>
        )}
        {status && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {status}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-1">{label}</p>
      <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
    </div>
  );
}

function LogTableRow({ user, tier, event, detail, refId, priority, priorityColor }: any) {
  return (
    <tr className="hover:bg-[var(--bg)]/30 transition-colors group">
      <td className="px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-[10px] font-bold opacity-40">
            {user.split(' ').map((n: any) => n[0]).join('')}
          </div>
          <div>
            <p className="text-xs font-bold">{user}</p>
            <p className="text-[9px] opacity-30 font-bold tracking-widest uppercase">{tier} ACCOUNT</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-xs font-bold mb-0.5">{event}</p>
        <p className="text-[10px] opacity-40 max-w-xs truncate">{detail}</p>
      </td>
      <td className="px-8 py-6">
        <p className="text-[10px] font-mono opacity-40">{refId}</p>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", priorityColor)} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{priority}</span>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <button className="p-2 rounded-lg hover:bg-[var(--border)] opacity-0 group-hover:opacity-100 transition-all">
          <Search size={14} className="opacity-40" />
        </button>
      </td>
    </tr>
  );
}
