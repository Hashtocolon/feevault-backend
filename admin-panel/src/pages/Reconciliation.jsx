import { useState } from 'react';
import { mockReconciliation, fmtFull } from '../data/mockData';

export default function Reconciliation() {
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const r = mockReconciliation;

  const runRecon = async () => {
    setRunning(true);
    await new Promise(x => setTimeout(x, 2000));
    setRunning(false);
    setRan(true);
  };

  const statusColor = s => s === 'ZERO_MISMATCH' ? '#34d399' : s === 'RESOLVED' ? '#f59e0b' : '#ef4444';
  const statusBadge = s => s === 'ZERO_MISMATCH' ? 'badge-emerald' : s === 'RESOLVED' ? 'badge-warning' : 'badge-danger';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>3-Way Reconciliation</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Internal Ledger ⇄ Bank Statement ⇄ Escrow Vault — daily automated verification</p>
        </div>
        <button className="btn-primary" onClick={runRecon} disabled={running} style={{ opacity: running ? 0.7 : 1 }}>
          {running ? '⏳ Running...' : '▶ Run Reconciliation'}
        </button>
      </div>

      {ran && (
        <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '10px', marginBottom: '20px', color: '#34d399', fontWeight: 700, fontSize: '14px' }}>
          ✓ Reconciliation completed — ZERO MISMATCH detected across all 3 sources.
        </div>
      )}

      {/* Last Run Info */}
      <div style={{ padding: '16px 20px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#85a2ad', fontWeight: 700 }}>Last run: </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#f0fdf4' }}>
            {new Date(r.last_run).toLocaleString('en-IN')}
          </span>
        </div>
        <span className={`badge ${statusBadge(r.status)}`} style={{ fontSize: '12px', padding: '4px 12px' }}>
          ● {r.status.replace('_', ' ')}
        </span>
      </div>

      {/* 3-Way Comparison */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <h2>⚖️ 3-Source Comparison</h2>
          <span className="badge badge-emerald">Today · {new Date().toLocaleDateString('en-IN')}</span>
        </div>
        <div style={{ padding: '32px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Internal Ledger', icon: '📋', amount: r.internal_ledger, sub: 'FeeVault Core DB' },
              { label: 'Bank Statement', icon: '🏦', amount: r.bank_statement, sub: 'ICICI API Feed' },
              { label: 'Escrow Vault', icon: '🔐', amount: r.escrow_pool, sub: 'Pooled Account' },
            ].map((box, i) => (
              <>
                <div key={box.label} style={{ textAlign: 'center', padding: '28px 36px', borderRadius: '16px', background: 'rgba(14,28,36,0.9)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>{box.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{box.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 900, color: '#34d399', marginBottom: '6px' }}>{fmtFull(box.amount)}</div>
                  <div style={{ fontSize: '11px', color: '#435b64' }}>{box.sub}</div>
                </div>
                {i < 2 && (
                  <div key={`arrow-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ color: '#34d399', fontWeight: 900, fontSize: '24px' }}>⇄</div>
                    <span className="badge badge-emerald" style={{ fontSize: '9px' }}>MATCH</span>
                  </div>
                )}
              </>
            ))}
          </div>

          {/* Delta */}
          <div style={{ marginTop: '24px', textAlign: 'center', padding: '14px', background: 'rgba(16,185,129,0.06)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>
              ✅ Total Delta: ₹0.00 — Perfect 3-way match confirmed
            </span>
          </div>
        </div>
      </div>

      {/* Mismatch Table */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <h2>🔍 Mismatch Registry</h2>
          <span className="badge badge-emerald">0 open mismatches</span>
        </div>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: '#34d399', marginBottom: '6px' }}>Zero Mismatches</div>
          <div style={{ color: '#85a2ad', fontSize: '13px' }}>All ledger entries are perfectly balanced across 3 sources.</div>
        </div>
      </div>

      {/* History */}
      <div className="panel">
        <div className="panel-head">
          <h2>📅 Reconciliation History</h2>
          <button className="btn-glass btn-sm">Export CSV</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Delta</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {r.history.map((h, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{h.date}</td>
                  <td><span className={`badge ${statusBadge(h.status)}`}>{h.status.replace('_', ' ')}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: h.delta === 0 ? '#34d399' : '#ef4444', fontWeight: 700 }}>
                    {h.delta === 0 ? '₹0.00' : `₹${(h.delta / 100).toLocaleString('en-IN')}`}
                  </td>
                  <td style={{ color: '#85a2ad', fontSize: '12px' }}>
                    {h.status === 'ZERO_MISMATCH' ? 'Auto-confirmed' : h.status === 'RESOLVED' ? 'Manual review & resolved' : 'Open — investigation in progress'}
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

