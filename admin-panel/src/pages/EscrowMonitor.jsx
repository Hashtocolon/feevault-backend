import { mockEscrow, fmt, fmtFull } from '../data/mockData';

export default function EscrowMonitor() {
  const total = mockEscrow.gross_escrow;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Escrow Monitor</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Real-time view of pooled escrow holdings, interest, and revenue</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-glass">🔄 Sync Now</button>
          <button className="btn-primary">📥 Download Statement</button>
        </div>
      </div>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {[
          { label: 'Gross Escrow', val: fmt(mockEscrow.gross_escrow), icon: '🏦', sub: 'ICICI Pooled Account', color: '#10b981' },
          { label: 'Accrued Interest', val: fmt(mockEscrow.accrued_interest), icon: '📈', sub: `${mockEscrow.interest_rate}% p.a.`, color: '#34d399' },
          { label: 'Platform Revenue', val: fmt(mockEscrow.platform_revenue), icon: '💰', sub: '1.0% of disbursements', color: '#2dd4bf' },
          { label: 'GST Liability', val: fmt(mockEscrow.gst_liability), icon: '🏛️', sub: '18% on platform fee', color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{s.label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${s.color}20`, border: `1px solid ${s.color}40`, display: 'grid', placeItems: 'center', fontSize: '16px' }}>{s.icon}</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 900, color: s.color, marginBottom: '6px' }}>{s.val}</div>
            <div style={{ fontSize: '12px', color: '#85a2ad' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Composition */}
        <div className="panel">
          <div className="panel-head">
            <h2>🏦 Escrow Pool Composition</h2>
            <span className="badge badge-emerald">{mockEscrow.bank}</span>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#85a2ad', marginBottom: '8px' }}>Total Pool — <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399' }}>{fmtFull(total)}</span></div>
              {/* Stacked bar */}
              <div style={{ height: '16px', borderRadius: '8px', display: 'flex', overflow: 'hidden', gap: '2px', marginBottom: '16px' }}>
                {mockEscrow.composition.map((c, i) => {
                  const colors = ['#10b981', '#34d399', '#2dd4bf', '#06b6d4', '#3b82f6'];
                  return (
                    <div key={i} style={{ width: `${c.pct}%`, background: colors[i], borderRadius: i === 0 ? '8px 0 0 8px' : i === mockEscrow.composition.length - 1 ? '0 8px 8px 0' : '0' }} />
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            {mockEscrow.composition.map((c, i) => {
              const colors = ['#10b981', '#34d399', '#2dd4bf', '#06b6d4', '#3b82f6'];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[i], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0fdf4' }}>{c.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: colors[i], fontWeight: 700 }}>{fmt(c.amount)}</div>
                    <div style={{ fontSize: '11px', color: '#85a2ad' }}>{c.pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel">
            <div className="panel-head"><h2>🏛️ Escrow Account</h2></div>
            <div style={{ padding: '20px' }}>
              {[
                { l: 'Bank', v: mockEscrow.bank },
                { l: 'Account Ref', v: mockEscrow.account_no },
                { l: 'Interest Rate', v: `${mockEscrow.interest_rate}% p.a. compounded daily` },
                { l: 'Last Sync', v: new Date(mockEscrow.last_sync).toLocaleString('en-IN') },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                  <span style={{ fontSize: '12px', color: '#85a2ad', fontWeight: 700 }}>{item.l}</span>
                  <span style={{ fontSize: '12px', fontFamily: item.l === 'Account Ref' ? 'JetBrains Mono, monospace' : 'inherit', color: '#f0fdf4', fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>💰 Revenue Breakdown</h2></div>
            <div style={{ padding: '20px' }}>
              {[
                { l: 'Platform Commission (1%)', v: fmt(mockEscrow.platform_revenue), color: '#34d399' },
                { l: 'GST @ 18%', v: fmt(mockEscrow.gst_liability), color: '#f59e0b' },
                { l: 'Net Revenue', v: fmt(mockEscrow.platform_revenue - mockEscrow.gst_liability), color: '#2dd4bf' },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                  <span style={{ fontSize: '13px', color: '#85a2ad', fontWeight: 600 }}>{item.l}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: item.color, fontWeight: 800, fontSize: '14px' }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

