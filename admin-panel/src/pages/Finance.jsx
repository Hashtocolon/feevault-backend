import { mockFinance } from '../data/mockData';

export default function Finance() {
  const f = mockFinance;
  const totalComm = f.revenue.reduce((a, r) => a + r.commission, 0);
  const totalGst = f.revenue.reduce((a, r) => a + r.gst, 0);
  const totalTds = f.revenue.reduce((a, r) => a + r.tds, 0);

  const fmt = (p) => `₹${(p / 100).toLocaleString('en-IN')}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Finance & GST Reporting</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>{f.current_quarter} · Commission, GST, TDS and Form 16A reporting</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-glass">📥 Download GSTR-1</button>
          <button className="btn-primary">📊 Generate Form 16A</button>
        </div>
      </div>

      {/* Config Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Commission Rate', val: `${f.commission_pct}%`, sub: 'Flat fee on disbursement', color: '#10b981' },
          { label: 'GST Rate', val: `${f.gst_pct}%`, sub: 'On platform commission', color: '#f59e0b' },
          { label: 'TDS Rate', val: f.tds_applicable ? `${f.tds_pct}%` : 'N/A', sub: f.tds_applicable ? 'Form 16A applicable' : 'Not applicable', color: '#3b82f6' },
          { label: 'GSTR-1 Status', val: f.gstr1_status, sub: 'File before due date', color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '20px', background: 'rgba(14,28,36,0.75)', border: `1px solid ${s.color}25`, borderTop: `3px solid ${s.color}`, borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 900, color: s.color, marginBottom: '4px' }}>{s.val}</div>
            <div style={{ fontSize: '11px', color: '#435b64' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue Table */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <h2>📊 Monthly Revenue Breakdown</h2>
          <span className="badge badge-emerald">{f.current_quarter}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Gross Commission (1%)</th>
                <th>GST (18%)</th>
                <th>TDS Deducted (10%)</th>
                <th>Net Revenue</th>
              </tr>
            </thead>
            <tbody>
              {f.revenue.map(row => (
                <tr key={row.month}>
                  <td style={{ fontWeight: 700 }}>{row.month}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399', fontWeight: 700 }}>{fmt(row.commission)}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b' }}>{fmt(row.gst)}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#3b82f6' }}>{fmt(row.tds)}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f0fdf4', fontWeight: 700 }}>{fmt(row.commission - row.gst - row.tds)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(16,185,129,0.08)' }}>
                <td style={{ fontWeight: 800, fontSize: '13px' }}>Q3 TOTAL</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color: '#34d399' }}>{fmt(totalComm)}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color: '#f59e0b' }}>{fmt(totalGst)}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color: '#3b82f6' }}>{fmt(totalTds)}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color: '#f0fdf4' }}>{fmt(totalComm - totalGst - totalTds)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Compliance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <div className="panel-head"><h2>🏛️ GST Filings</h2></div>
          <div style={{ padding: '20px' }}>
            {[
              { label: 'GSTR-1 (Sales)', status: 'PENDING', due: '11 Nov 2026' },
              { label: 'GSTR-3B (Summary)', status: 'FILED', due: '20 Oct 2026' },
              { label: 'Annual Return GSTR-9', status: 'NOT DUE', due: 'Dec 2027' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: '#85a2ad' }}>Due: {item.due}</div>
                </div>
                <span className={`badge ${item.status === 'FILED' ? 'badge-emerald' : item.status === 'PENDING' ? 'badge-warning' : 'badge-dim'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>📋 TDS / Form 16A</h2></div>
          <div style={{ padding: '20px' }}>
            {[
              { label: 'Q1 FY 26-27 (Apr–Jun)', status: 'FILED', date: '15 Jul 2026' },
              { label: 'Q2 FY 26-27 (Jul–Sep)', status: 'FILED', date: '15 Oct 2026' },
              { label: 'Q3 FY 26-27 (Oct–Dec)', status: 'PENDING', date: '15 Jan 2027' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: '#85a2ad' }}>Due/Filed: {item.date}</div>
                </div>
                <span className={`badge ${item.status === 'FILED' ? 'badge-emerald' : 'badge-warning'}`}>{item.status}</span>
              </div>
            ))}
            <button className="btn-primary" style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}>📥 Generate Q3 Form 16A</button>
          </div>
        </div>
      </div>
    </div>
  );
}

