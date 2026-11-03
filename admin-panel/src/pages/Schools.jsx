import { useState } from 'react';
import { mockSchools, fmt, fmtFull } from '../data/mockData';

function SchoolModal({ onClose }) {
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '', contact: '', phone: '', bank: '', ifsc: '', account: '' });
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }}>
        <div className="modal-head">
          <h3>🏫 Onboard New Partner School</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">School Full Name</label>
              <input className="form-input" placeholder="e.g. Delhi Public School Bangalore East" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">School Code</label>
              <input className="form-input" placeholder="e.g. DPS-BLR-05" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" placeholder="Bengaluru" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input className="form-input" placeholder="Karnataka" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input className="form-input" type="email" placeholder="principal@school.edu.in" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Bank Name</label>
              <input className="form-input" placeholder="HDFC Bank" value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input className="form-input" placeholder="HDFC0001234" value={form.ifsc} onChange={e => setForm(f => ({ ...f, ifsc: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} />
            </div>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '8px', fontSize: '12px', color: '#85a2ad' }}>
            💡 A ₹1 penny-drop verification will be initiated after school onboarding to validate bank details.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onClose}>✓ Onboard School</button>
        </div>
      </div>
    </div>
  );
}

function SchoolDetailModal({ school, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }}>
        <div className="modal-head">
          <h3>{school.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            {[
              { l: 'School Code', v: school.code },
              { l: 'Status', v: school.status },
              { l: 'City', v: school.city },
              { l: 'State', v: school.state },
              { l: 'Contact', v: school.contact },
              { l: 'Total Students', v: school.students },
              { l: 'Bank', v: school.bank },
              { l: 'IFSC', v: school.ifsc },
              { l: 'Onboarded', v: school.onboarded },
              { l: 'MoU Signed', v: school.mou_signed ? 'Yes ✓' : 'No ✗' },
            ].map(item => (
              <div key={item.l}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#435b64', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.l}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: item.l === 'Status' ? (item.v === 'ACTIVE' ? '#34d399' : '#ef4444') : '#f0fdf4', fontFamily: item.l === 'School Code' || item.l === 'IFSC' ? 'JetBrains Mono, monospace' : 'inherit' }}>{item.v}</div>
              </div>
            ))}
          </div>
          {school.classes.length > 0 && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', paddingTop: '14px', borderTop: '1px solid rgba(16,185,129,0.1)' }}>Fee Structure by Class</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.25)', fontSize: '10px', fontWeight: 800, color: '#85a2ad', textAlign: 'left', textTransform: 'uppercase' }}>Class</th>
                    <th style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.25)', fontSize: '10px', fontWeight: 800, color: '#85a2ad', textAlign: 'left', textTransform: 'uppercase' }}>Students</th>
                    <th style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.25)', fontSize: '10px', fontWeight: 800, color: '#85a2ad', textAlign: 'left', textTransform: 'uppercase' }}>Annual Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {school.classes.map(cls => (
                    <tr key={cls.name}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(16,185,129,0.07)', fontSize: '13px' }}>{cls.name}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(16,185,129,0.07)', fontFamily: 'JetBrains Mono, monospace', color: '#34d399' }}>{cls.students}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(16,185,129,0.07)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtFull(cls.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-danger" onClick={onClose}>
            {school.status === 'ACTIVE' ? '⛔ Suspend School' : '✓ Activate School'}
          </button>
          <button className="btn-glass" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Schools() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState(null);

  const filtered = mockSchools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Partner Schools</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>{mockSchools.length} schools onboarded · Phase 1 Operations</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="search-bar">
            <span style={{ color: '#435b64' }}>🔍</span>
            <input placeholder="Search school, code, city..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>＋ Onboard School</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>🏫 All Partner Schools</h2>
          <span className="badge badge-emerald">{filtered.length} results</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>School</th>
                <th>City & State</th>
                <th>Students</th>
                <th>Annual Fee</th>
                <th>Bank Verified</th>
                <th>MoU</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <b style={{ display: 'block', fontSize: '13px' }}>{s.name}</b>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad' }}>{s.code}</span>
                  </td>
                  <td style={{ color: '#85a2ad' }}>{s.city}, {s.state}</td>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399', fontWeight: 700 }}>{s.students}</span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(s.target_fee)}</td>
                  <td>
                    <span className={`badge ${s.penny_drop === 'VERIFIED' ? 'badge-emerald' : 'badge-warning'}`}>
                      {s.penny_drop === 'VERIFIED' ? '₹1 ✓' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.mou_signed ? 'badge-emerald' : 'badge-danger'}`}>
                      {s.mou_signed ? 'Signed' : 'Missing'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-emerald' : 'badge-danger'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-glass btn-sm" onClick={() => setDetail(s)}>View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <SchoolModal onClose={() => setShowModal(false)} />}
      {detail && <SchoolDetailModal school={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

