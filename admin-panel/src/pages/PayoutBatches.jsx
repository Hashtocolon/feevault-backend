import { useState } from 'react';
import { mockPayouts, fmt, fmtFull } from '../data/mockData';

function CreateBatchModal({ onClose }) {
  const [form, setForm] = useState({ school: '', term: '', amount: '' });
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>💸 Create Payout Batch</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Partner School</label>
            <select className="form-input" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}>
              <option value="">Select school...</option>
              <option>Delhi Public School Bangalore East (DPS-BLR-04)</option>
              <option>Greenwood High International (GWH-BLR-02)</option>
              <option>Ryan Public School Hyderabad (RPS-HYD-01)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payout Term / Description</label>
            <input className="form-input" placeholder="e.g. Annual Payout FY 2026-27" value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" placeholder="e.g. 10920000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', fontSize: '12px', color: '#f59e0b' }}>
            ⚠️ Batch will enter <b>PENDING_SCHOOL</b> status. School must confirm via signed document before disbursal.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onClose}>✓ Create Batch (Maker)</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_FLOW = ['PENDING_SCHOOL', 'SCHOOL_CONFIRMED', 'DISBURSED'];

const statusColor = s => {
  if (s === 'DISBURSED') return 'badge-emerald';
  if (s === 'SCHOOL_CONFIRMED') return 'badge-warning';
  return 'badge-dim';
};

export default function PayoutBatches() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Payout Batches</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Maker-Checker controlled school disbursement workflow</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>＋ Create Batch (Maker)</button>
      </div>

      {/* Flow Explanation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px', padding: '18px 24px', background: 'rgba(14,28,36,0.75)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px' }}>
        {[
          { step: '1', label: 'Maker Creates Batch', icon: '📝', color: '#10b981' },
          { step: '2', label: 'School Signs & Confirms', icon: '🏫', color: '#f59e0b' },
          { step: '3', label: 'Upload Confirmation Doc', icon: '📄', color: '#3b82f6' },
          { step: '4', label: 'Checker Approves & Disburses', icon: '✅', color: '#34d399' },
        ].map((step, i) => (
          <>
            <div key={step.step} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${step.color}20`, border: `2px solid ${step.color}`, margin: '0 auto 8px', display: 'grid', placeItems: 'center', fontSize: '18px' }}>{step.icon}</div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: step.color, marginBottom: '2px' }}>STEP {step.step}</div>
              <div style={{ fontSize: '12px', color: '#f0fdf4', fontWeight: 600 }}>{step.label}</div>
            </div>
            {i < 3 && <div style={{ width: '40px', textAlign: 'center', color: '#435b64', fontSize: '18px', fontWeight: 900 }}>→</div>}
          </>
        ))}
      </div>

      {/* Batches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mockPayouts.map(batch => (
          <div key={batch.id} className="panel">
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#85a2ad' }}>{batch.id}</span>
                  <span className={`badge ${statusColor(batch.status)}`}>{batch.status.replace('_', ' ')}</span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>{batch.school}</h3>
                <div style={{ fontSize: '13px', color: '#85a2ad' }}>{batch.term} · {batch.students} students</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 900, color: '#34d399' }}>{fmtFull(batch.amount)}</div>
                <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '2px' }}>Created: {batch.created_at}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(16,185,129,0.1)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#85a2ad', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Maker</span>
                  <span style={{ fontSize: '12px', color: '#f0fdf4' }}>{batch.maker}</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#85a2ad', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>School Confirmed</span>
                  <span style={{ fontSize: '12px', color: batch.school_confirmed_at ? '#34d399' : '#f59e0b' }}>
                    {batch.school_confirmed_at || 'Awaiting...'}
                  </span>
                </div>
                {batch.utr && (
                  <div>
                    <span style={{ fontSize: '10px', color: '#85a2ad', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>UTR</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#2dd4bf' }}>{batch.utr}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {batch.status === 'PENDING_SCHOOL' && (
                  <button className="btn-glass btn-sm">📄 Upload Confirmation</button>
                )}
                {batch.status === 'SCHOOL_CONFIRMED' && (
                  <button className="btn-primary btn-sm">✓ Approve & Disburse (Checker)</button>
                )}
                {batch.status === 'DISBURSED' && (
                  <span className="badge badge-emerald" style={{ fontSize: '12px', padding: '6px 12px' }}>✓ Disbursed</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

