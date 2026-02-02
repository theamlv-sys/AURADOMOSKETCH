
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config';

interface UserData {
    id: string;
    email: string;
    tier: string;
    credits: number;
    created_at: string;
    last_reset_date?: string; // Optional (might be null initially)
}

interface AdminDashboardProps {
    onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
        // Poll every 2 seconds for guaranteed "Live" updates regardless of RLS/Realtime config
        const interval = setInterval(fetchUsers, 2000);

        // Realtime Subscription
        const channel = supabase.channel('realtime:users')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
                setUsers(prev => prev.map(u =>
                    u.id === payload.new.id ? { ...u, ...payload.new } : u
                ));
            })
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchUsers = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!res.ok) throw new Error("Failed to fetch admin data");

            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const totalRevenue = users.reduce((acc, u) => {
        // Estimating revenue based on verified tier
        if (u.tier === 'studio') return acc + 599;
        if (u.tier === 'producer') return acc + 199;
        if (u.tier === 'designer') return acc + 99;
        return acc;
    }, 0);

    return (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl overflow-auto text-slate-200 p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-12 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-white mb-2">
                        <span className="font-semibold text-cyan-400">MASTER</span> ADMIN
                    </h1>
                    <p className="text-slate-500 text-xs tracking-widest uppercase">Traffic & User Control</p>
                </div>
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    Close Dashboard
                </button>
            </div>

            {loading ? (
                <div className="text-center text-cyan-400 animate-pulse">Accessing Secure Database...</div>
            ) : error ? (
                <div className="text-center text-red-500">ACCESS DENIED: {error}</div>
            ) : (
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Total Users</div>
                            <div className="text-3xl font-bold text-white">{users.length}</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Total Revenue (Est)</div>
                            <div className="text-3xl font-bold text-cyan-400">${totalRevenue.toLocaleString()}</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Studio Users</div>
                            <div className="text-3xl font-bold text-amber-400">{users.filter(u => u.tier === 'studio').length}</div>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Total Credits Active</div>
                            <div className="text-3xl font-bold text-purple-400">{users.reduce((acc, u) => acc + (u.credits || 0), 0).toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.01]">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-slate-500 text-[10px] uppercase tracking-widest">
                                    <th className="p-4 font-medium">Email</th>
                                    <th className="p-4 font-medium">Plan</th>
                                    <th className="p-4 font-medium">Credits</th>
                                    <th className="p-4 font-medium">Reset Date</th>
                                    <th className="p-4 font-medium">Next Reset</th>
                                    <th className="p-4 font-medium">Joined</th>
                                    <th className="p-4 font-medium">Admin Actions</th>
                                    <th className="p-4 font-medium">ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-mono text-cyan-200">{user.email}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                        ${user.tier === 'studio' ? 'bg-amber-500/20 text-amber-300' :
                                                    user.tier === 'producer' ? 'bg-cyan-500/20 text-cyan-300' :
                                                        user.tier === 'designer' ? 'bg-slate-500/20 text-slate-300' : 'bg-red-500/20 text-red-300'}
                      `}>
                                                {user.tier || 'NONE'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono">{user.credits}</td>
                                        <td className="p-4 text-slate-400 text-xs">
                                            {user.last_reset_date ? new Date(user.last_reset_date).toLocaleDateString() : new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-cyan-500 text-xs font-mono">
                                            {(() => {
                                                const start = user.last_reset_date ? new Date(user.last_reset_date) : new Date(user.created_at);
                                                // Approximate next month (30 days)
                                                const next = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
                                                // If next date is in past, add months until future (simple projected billing)
                                                // For MVP admin view: just showing Start + 30 Days is enough context
                                                return next.toLocaleDateString();
                                            })()}
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Reset credits for ${user.email} to 1000?`)) return;
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        await fetch(`${API_BASE_URL}/api/admin/update-credits`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                                            body: JSON.stringify({ userId: user.id, action: 'reset', value: 1000 })
                                                        });
                                                        fetchUsers();
                                                    } catch (e) { alert("Failed"); }
                                                }}
                                                className="px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded text-[9px] uppercase font-bold transition-all"
                                            >
                                                Reset
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const amount = prompt("Enter credits to add:", "500");
                                                    if (!amount) return;
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        await fetch(`${API_BASE_URL}/api/admin/update-credits`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                                                            body: JSON.stringify({ userId: user.id, action: 'add', value: parseInt(amount) })
                                                        });
                                                        fetchUsers();
                                                    } catch (e) { alert("Failed"); }
                                                }}
                                                className="px-2 py-1 bg-green-500/20 text-green-300 hover:bg-green-500 hover:text-white rounded text-[9px] uppercase font-bold transition-all"
                                            >
                                                Add
                                            </button>
                                        </td>
                                        <td className="p-4 text-xs text-slate-600 font-mono">{user.id.slice(0, 8)}...</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
