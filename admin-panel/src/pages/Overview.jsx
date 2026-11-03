import { mockDashboard, fmt, fmtFull } from '../data/mockData';

const STATS = [
  {
    label: 'Gross Escrow Holdings', icon: '🏦',
    value: fmt(mockDashboard.gross_escrow),
    sub: '↑ 6.2% vs last month · ICICI Pooled Escrow',
    badge: '↑ 6.2%',
  },
  {
    label: 'Accrued Interest (FY 26-27)', icon: '📈',
    value: fmt(mockDashboard.accrued_interest),
    sub: 'Compounded daily to parents',
    badge: '6.85% p.a.',
  },
  {
    label: 'FeeVault Platform Fee', icon: '💰',
    value: fmt(mockDashboard.platform_fee),
    sub: 'Earned upon disbursement',
    badge: '1.0% Flat',
  },
  {
    label: 'GST Output Liability', icon: '🏛️',
    value: fmt(mockDashboard.gst_liability),
    sub: 'GSTR-1 return filing reserve',
    badge: '18% GST',
  },
];

export default function Overview() {
  return (
    <div>
      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>
            Operations Overview
          </h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>
            Live visibility across multi-bank Escrow pool, 3-way reconciliation, and school payout batches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-glass">📥 Export Report</button>
          <button className="btn-primary">＋ Onboard New School</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {STATS.map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {s.label}
              </span>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(16,185,129,0.14)', color: '#34d399',
                display: 'grid', placeItems: 'center', fontSize: '16px',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>{s.icon}</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '30px', fontWeight: 900, letterSpacing: '-1px', color: '#fff', marginBottom: '8px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '12px', color: '#85a2ad', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge-pill">{s.badge}</span>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 70px', gap: '16px', marginBottom: '28px', alignItems: 'stretch' }}>
        {/* Quick Stats */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { label: 'Partner Schools', val: mockDashboard.total_schools, icon: '🏫', color: '#3b82f6' },
            { label: 'Active Parents', val: mockDashboard.active_parents.toLocaleString(), icon: '👨‍👩‍👧', color: '#8b5cf6' },
            { label: 'Pending Exceptions', val: mockDashboard.pending_exceptions, icon: '⚠️', color: '#f59e0b' },
            { label: 'Recon Status', val: 'ZERO MISMATCH', icon: '⚖️', color: '#10b981' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '18px 20px',
              background: 'rgba(14,28,36,0.75)',
              border: `1px solid ${item.color}30`,
              borderLeft: `3px solid ${item.color}`,
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 900, color: item.color }}>{item.val}</div>
                <div style={{ fontSize: '11px', color: '#85a2ad', fontWeight: 700 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dual Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px', marginBottom: '28px' }}>
        {/* Chart Panel */}
        <div className="panel">
          <div className="panel-head">
            <h2>⚖️ Daily 3-Way Reconciliation & Movement</h2>
            <span className="badge-pill">● ZERO MISMATCH</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {/* Recon Strip */}
            <div style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px', padding: '16px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px',
            }}>
              {[
                { label: 'Internal Ledger', val: fmtFull(mockDashboard.internal_ledger) },
                { label: 'Bank Statement', val: fmtFull(mockDashboard.bank_statement) },
                { label: 'Escrow Pool', val: fmtFull(mockDashboard.escrow_pool) },
              ].map((box, i) => (
                <>
                  <div key={box.label}>
                    <small style={{ display: 'block', fontSize: '10px', color: '#85a2ad', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>{box.label}</small>
                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', color: '#34d399' }}>{box.val}</strong>
                  </div>
                  {i < 2 && <span style={{ color: '#34d399', fontWeight: 800, fontSize: '18px' }}>⇄</span>}
                </>
              ))}
            </div>
            {/* Bar Chart */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: '12px',
              height: '180px', paddingBottom: '28px',
              borderBottom: '1px solid rgba(16,185,129,0.12)',
              position: 'relative',
            }}>
              {mockDashboard.monthly_flow.map((m, i) => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-20px', fontSize: '9px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#34d399', whiteSpace: 'nowrap' }}>
                    ₹{(m.amount / 10000000000).toFixed(1)}Cr
                  </span>
                  <div style={{
                    width: '100%', height: `${m.pct}%`,
                    borderRadius: '4px 4px 0 0',
                    background: i === mockDashboard.monthly_flow.length - 1
                      ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
                      : 'linear-gradient(180deg, rgba(52,211,153,0.6) 0%, rgba(5,150,105,0.6) 100%)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                    transition: 'filter 0.2s',
                  }} />
                  <span style={{ position: 'absolute', bottom: '-20px', fontSize: '11px', fontWeight: 700, color: '#85a2ad' }}>{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Queue */}
        <div className="panel">
          <div className="panel-head">
            <h2>🎯 Maker-Checker Queue</h2>
            <span className="badge badge-warning">{mockDashboard.action_queue.length} Pending</span>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mockDashboard.action_queue.map(item => (
                <div key={item.id} style={{
                  padding: '14px 16px', borderRadius: '10px',
                  background: 'rgba(0,0,0,0.25)',
                  borderLeft: '3px solid #10b981',
                  border: '1px solid rgba(16,185,129,0.15)',
                  borderLeft: '3px solid #10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '13px', color: '#fff', display: 'block', marginBottom: '3px' }}>{item.title}</b>
                    <small style={{ color: '#85a2ad', fontSize: '11px' }}>{item.desc}</small>
                  </div>
                  <button className={`btn-primary btn-sm`} style={{ flexShrink: 0 }}>
                    {item.type === 'DISBURSE' ? 'Disburse' : item.type === 'VERIFY' ? 'Verify' : 'Approve'}
                  </button>
                </div>
              ))}
            </div>

            {/* System Health */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(16,185,129,0.1)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                System Health
              </div>
              {mockDashboard.system_health.map(h => (
                <div key={h.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(16,185,129,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #34d399', display: 'inline-block' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f0fdf4' }}>{h.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#34d399', fontWeight: 700 }}>{h.uptime}</span>
                    <span className="badge badge-emerald" style={{ fontSize: '9px', padding: '2px 6px' }}>LIVE</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Schools Table */}
      <div className="panel">
        <div className="panel-head">
          <h2>🏫 Partner Schools & Fee Schedules (Phase 1)</h2>
          <button className="btn-glass btn-sm">View All (128) →</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Partner School</th>
                <th>City & State</th>
                <th>Students</th>
                <th>Target Annual Fee</th>
                <th>Penny-Drop</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Delhi Public School Bangalore East', code: 'DPS-BLR-04', city: 'Bengaluru, KA', students: 450, fee: 6000000, penny: true, status: 'ACTIVE' },
                { name: 'Greenwood High International', code: 'GWH-BLR-02', city: 'Bengaluru, KA', students: 280, fee: 7500000, penny: true, status: 'ACTIVE' },
                { name: 'Ryan Public School Hyderabad', code: 'RPS-HYD-01', city: 'Hyderabad, TG', students: 620, fee: 5500000, penny: true, status: 'ACTIVE' },
                { name: 'KV Sector-12 Delhi', code: 'KVS-DEL-12', city: 'New Delhi, DL', students: 890, fee: 3200000, penny: true, status: 'ACTIVE' },
              ].map((s, i) => (
                <tr key={i}>
                  <td>
                    <b style={{ display: 'block' }}>{s.name}</b>
                    <small style={{ color: '#85a2ad', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{s.code}</small>
                  </td>
                  <td style={{ color: '#85a2ad' }}>{s.city}</td>
                  <td>
                    <b style={{ color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>{s.students.toLocaleString()}</b>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f0fdf4' }}>
                    {fmt(s.fee)} / yr
                  </td>
                  <td>
                    <span className="badge badge-emerald">₹1 Verified</span>
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-emerald' : 'badge-danger'}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

