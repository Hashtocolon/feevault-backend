import { useState } from 'react';
import { mockExceptions, fmtFull } from '../data/mockData';

function ResolveModal({ exc, onClose }) {
  const [action, setAction] = useState('APPROVE_TRANSFER');
  const [note, setNote] = useState('');
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>⚠️ Resolve Exception · {exc.id}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>{exc.parent} — {exc.type.replace('_', ' ')}</div>
            <div style={{ fontSize: '12px', color: '#85a2ad' }}>{exc.reason}</div>
            <div style={{ marginTop: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#f59e0b', fontWeight: 800 }}>{fmtFull(exc.amount)}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Resolution Action</label>
            <select className="form-input" value={action} onChange={e => setAction(e.target.value)}>
              <option value="APPROVE_TRANSFER">Approve — Transfer to School</option>
              <option value="APPROVE_REFUND">Approve — Full Refund to Parent</option>
              <option value="REJECT">Reject Request</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Resolution Note</label>
            <textarea className="form-input" rows={3} placeholder="Enter reason for resolution..." value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>Cancel</button>
          <button
            className={action === 'REJECT' ? 'btn-danger' : 'btn-primary'}
            onClick={onClose}
          >
            {action === 'REJECT' ? '✗ Reject' : '✓ Approve & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusBadge = s => s === 'PENDING' ? 'badge-warning' : s === 'APPROVED' ? 'badge-emerald' : 'badge-danger';
const typeLabels = { REFUND_REQUEST: 'Refund', EARLY_WITHDRAWAL: 'Early Withdrawal', TRANSFER_TO_SCHOOL: 'Transfer' };

export default function Exceptions() {
  const [resolve, setResolve] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const filtered = mockExceptions.filter(e => filter === 'ALL' || e.status === filter);

  const slaColor = e => {
    const remaining = e.sla_hours - e.hours_elapsed;
    if (remaining < 0) return '#ef4444';
    if (remaining < 12) return '#f59e0b';
    return '#34d399';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Exception Requests</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Parent-initiated refund, withdrawal, and transfer requests · {mockExceptions.filter(e => e.status === 'PENDING').length} pending within SLA</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-primary btn-sm' : 'btn-glass btn-sm'}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* SLA Alert */}
      {mockExceptions.some(e => e.status === 'PENDING' && e.hours_elapsed > 36) && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>🚨</span>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px' }}>SLA Breach Warning — 1 exception is approaching 48-hour deadline</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.map(exc => (
          <div key={exc.id} className="panel">
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad' }}>{exc.id}</span>
                  <span className={`badge ${statusBadge(exc.status)}`}>{exc.status}</span>
                  <span className="badge badge-info">{typeLabels[exc.type] || exc.type}</span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>{exc.parent} — {exc.school}</h3>
                <p style={{ color: '#85a2ad', fontSize: '13px', lineHeight: 1.5 }}>{exc.reason}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 900, color: '#34d399', marginBottom: '4px' }}>
                  {fmtFull(exc.amount)}
                </div>
                <div style={{ fontSize: '11px', color: '#85a2ad', marginBottom: '8px' }}>Requested: {exc.created_at}</div>
                {exc.status === 'PENDING' && (
                  <div style={{ padding: '6px 10px', borderRadius: '6px', background: `${slaColor(exc)}15`, border: `1px solid ${slaColor(exc)}30`, textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: slaColor(exc) }}>
                      ⏱ {exc.hours_elapsed}h / {exc.sla_hours}h SLA
                    </span>
                  </div>
                )}
              </div>
            </div>
            {exc.status === 'PENDING' && (
              <div style={{ borderTop: '1px solid rgba(16,185,129,0.1)', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'rgba(0,0,0,0.15)' }}>
                <button className="btn-danger btn-sm" onClick={() => setResolve(exc)}>✗ Reject</button>
                <button className="btn-primary btn-sm" onClick={() => setResolve(exc)}>✓ Resolve</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {resolve && <ResolveModal exc={resolve} onClose={() => setResolve(null)} />}
    </div>
  );
}

