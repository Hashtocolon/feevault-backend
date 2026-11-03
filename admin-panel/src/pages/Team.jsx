import { useState } from 'react';
import { mockTeam, roleLabels } from '../data/mockData';

function InviteModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'OPS' });
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>👥 Invite Team Member</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="e.g. Rajan Mehta" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <input className="form-input" type="email" placeholder="name@feevault.in" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Role / Permission Level</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {/* Role description */}
          <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '8px', fontSize: '12px', color: '#85a2ad' }}>
            💡 An invite email will be sent to the staff member with a temporary password. They must change it on first login.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onClose}>📧 Send Invite</button>
        </div>
      </div>
    </div>
  );
}

const roleColor = {
  SUPER_ADMIN: '#34d399',
  OPS: '#3b82f6',
  FINANCE_MAKER: '#f59e0b',
  FINANCE_CHECKER: '#10b981',
  SUPPORT: '#8b5cf6',
  COMPLIANCE_AUDITOR: '#2dd4bf',
};

const RBAC = [
  { role: 'Super Admin', can: ['All permissions', 'User management', 'Settings', 'Delete data'] },
  { role: 'Ops Manager', can: ['View all', 'Onboard schools', 'Create payout batches', 'Upload docs'] },
  { role: 'Finance Maker', can: ['Create batches', 'View reconciliation', 'Export reports'] },
  { role: 'Finance Checker', can: ['Approve/reject batches', 'View all finance', 'Disburse payments'] },
  { role: 'Support', can: ['View parents & vaults', 'Revoke devices', 'View exceptions'] },
  { role: 'Compliance Auditor', can: ['Read-only audit logs', 'Export compliance reports'] },
];

export default function Team() {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Team & Roles</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>RBAC management · {mockTeam.length} staff members · 6 permission levels</p>
        </div>
        <button className="btn-primary" onClick={() => setShowInvite(true)}>＋ Invite Staff</button>
      </div>

      {/* RBAC Table */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-head">
          <h2>🔐 Role-Based Access Control (RBAC)</h2>
          <span className="badge badge-emerald">6 Roles Defined</span>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {RBAC.map(r => (
            <div key={r.role} style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '10px', color: '#f0fdf4' }}>{r.role}</div>
              {r.can.map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
                  <span style={{ color: '#10b981', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '12px', color: '#85a2ad' }}>{c}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Team Table */}
      <div className="panel">
        <div className="panel-head">
          <h2>👥 Staff Directory</h2>
          <span className="badge badge-emerald">{mockTeam.filter(u => u.status === 'ACTIVE').length} active</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockTeam.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                        background: `${roleColor[u.role] || '#10b981'}20`,
                        border: `1px solid ${roleColor[u.role] || '#10b981'}40`,
                        display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '13px',
                        color: roleColor[u.role] || '#10b981',
                      }}>{u.name[0]}</div>
                      <span style={{ fontWeight: 700 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '12px', color: '#85a2ad' }}>{u.email}</td>
                  <td>
                    <span className="badge" style={{ background: `${roleColor[u.role]}20`, color: roleColor[u.role], border: `1px solid ${roleColor[u.role]}40`, fontSize: '10px', letterSpacing: '0.3px' }}>
                      {roleLabels[u.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-emerald' : 'badge-dim'}`}>{u.status}</span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad', whiteSpace: 'nowrap' }}>
                    {new Date(u.last_login).toLocaleString('en-IN')}
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn-glass btn-sm">Edit</button>
                    {u.role !== 'SUPER_ADMIN' && (
                      <button className="btn-danger btn-sm">
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

