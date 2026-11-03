import { useState } from 'react';
import { mockParents, fmt, fmtFull } from '../data/mockData';

function ParentDetailModal({ parent, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }}>
        <div className="modal-head">
          <h3>👤 {parent.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* KYC Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
            {[
              { l: 'Parent ID', v: parent.id },
              { l: 'Email', v: parent.email },
              { l: 'Phone', v: parent.phone },
              { l: 'KYC Status', v: parent.kyc_status },
              { l: 'Vault Balance', v: fmtFull(parent.vault_balance) },
              { l: 'Registered', v: parent.created_at },
              { l: 'Device Linked', v: parent.device_id ? 'Yes · ' + parent.device_id.slice(0, 16) + '...' : 'None' },
            ].map(item => (
              <div key={item.l}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#435b64', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.l}</div>
                <div style={{
                  fontSize: '13px', fontWeight: 600,
                  color: item.l === 'KYC Status'
                    ? (item.v === 'VERIFIED' ? '#34d399' : item.v === 'PENDING' ? '#f59e0b' : '#ef4444')
                    : '#f0fdf4',
                  fontFamily: item.l === 'Parent ID' ? 'JetBrains Mono, monospace' : 'inherit',
                }}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Children */}
          {parent.children.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', paddingTop: '14px', borderTop: '1px solid rgba(16,185,129,0.1)' }}>Linked Students</div>
              {parent.children.map(c => (
                <div key={c.id} style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: '#85a2ad' }}>{c.class} · {c.school} · Annual fee: {fmtFull(c.fee)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Transactions */}
          {parent.transactions.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', paddingTop: '14px', borderTop: '1px solid rgba(16,185,129,0.1)' }}>Recent Transactions</div>
              {parent.transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(16,185,129,0.05)' }}>
                  <div>
                    <span className={`badge ${t.type === 'DEPOSIT' ? 'badge-emerald' : 'badge-info'}`} style={{ marginRight: '8px' }}>{t.type}</span>
                    <span style={{ fontSize: '12px', color: '#85a2ad' }}>{t.date}</span>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: t.type === 'DEPOSIT' ? '#34d399' : '#f0fdf4' }}>
                    {t.type === 'DEPOSIT' ? '+' : '-'}{fmtFull(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {parent.device_id && (
            <button className="btn-danger" onClick={onClose}>⛔ Revoke Device</button>
          )}
          <button className="btn-glass" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Parents() {
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('ALL');
  const [detail, setDetail] = useState(null);

  const filtered = mockParents.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
    const matchKyc = kycFilter === 'ALL' || p.kyc_status === kycFilter;
    return matchSearch && matchKyc;
  });

  const kycColor = s => s === 'VERIFIED' ? 'badge-emerald' : s === 'PENDING' ? 'badge-warning' : 'badge-danger';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Parents & Student Vaults</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>{mockParents.length} registered parents · Vault management & KYC</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="search-bar">
            <span style={{ color: '#435b64' }}>🔍</span>
            <input placeholder="Search name, email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 'auto', padding: '9px 12px' }} value={kycFilter} onChange={e => setKycFilter(e.target.value)}>
            <option value="ALL">All KYC</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* KYC Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Parents', val: mockParents.length, color: '#10b981' },
          { label: 'KYC Verified', val: mockParents.filter(p => p.kyc_status === 'VERIFIED').length, color: '#34d399' },
          { label: 'KYC Pending', val: mockParents.filter(p => p.kyc_status === 'PENDING').length, color: '#f59e0b' },
          { label: 'KYC Failed', val: mockParents.filter(p => p.kyc_status === 'FAILED').length, color: '#ef4444' },
        ].map(item => (
          <div key={item.label} style={{ padding: '16px 20px', background: 'rgba(14,28,36,0.75)', border: `1px solid ${item.color}25`, borderTop: `3px solid ${item.color}`, borderRadius: '12px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 900, color: item.color, marginBottom: '4px' }}>{item.val}</div>
            <div style={{ fontSize: '11px', color: '#85a2ad', fontWeight: 700 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>👨‍👩‍👧 Parent Registry</h2>
          <span className="badge badge-emerald">{filtered.length} found</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Phone</th>
                <th>KYC</th>
                <th>Vault Balance</th>
                <th>Children</th>
                <th>Device</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <b style={{ display: 'block' }}>{p.name}</b>
                    <small style={{ color: '#85a2ad', fontSize: '11px' }}>{p.email}</small>
                  </td>
                  <td style={{ color: '#85a2ad', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{p.phone}</td>
                  <td><span className={`badge ${kycColor(p.kyc_status)}`}>{p.kyc_status}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#34d399', fontWeight: 700 }}>{fmtFull(p.vault_balance)}</td>
                  <td><span className="badge badge-info">{p.children.length} child{p.children.length !== 1 ? 'ren' : ''}</span></td>
                  <td>
                    {p.device_id
                      ? <span className="badge badge-emerald">Linked</span>
                      : <span className="badge badge-dim">None</span>}
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn-glass btn-sm" onClick={() => setDetail(p)}>Details</button>
                    {p.device_id && <button className="btn-danger btn-sm">Revoke</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <ParentDetailModal parent={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

