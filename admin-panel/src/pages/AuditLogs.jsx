import { mockAuditLogs } from '../data/mockData';

const ACTION_COLOR = {
  ADMIN_LOGIN: 'badge-info',
  SCHOOL_ONBOARD: 'badge-emerald',
  PAYOUT_BATCH_CREATE: 'badge-warning',
  BATCH_APPROVE: 'badge-emerald',
  DEVICE_REVOKE: 'badge-danger',
  EXCEPTION_RESOLVE: 'badge-emerald',
  RECON_RUN: 'badge-info',
  DOCUMENT_UPLOAD: 'badge-dim',
};

export default function AuditLogs() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>Audit & Compliance Logs</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Tamper-evident, read-only log of all admin actions · DPDP & RBI compliant</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-glass">📥 Export Logs (CSV)</button>
        </div>
      </div>

      {/* Compliance Banner */}
      <div style={{
        padding: '14px 20px', marginBottom: '24px',
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '20px' }}>🔏</span>
        <div>
          <div style={{ fontWeight: 800, color: '#34d399', fontSize: '13px', marginBottom: '2px' }}>Tamper-Evident Audit Trail Active</div>
          <div style={{ fontSize: '12px', color: '#85a2ad' }}>
            All entries are cryptographically signed. Compliant with DPDP Act 2023, RBI Escrow Guidelines, and IT Act Section 67C.
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <span className="badge badge-emerald">DPDP 2023</span>
          <span className="badge badge-emerald">RBI Escrow</span>
          <span className="badge badge-emerald">IT Act 67C</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>📋 Admin Activity Log</h2>
          <span className="badge badge-dim">{mockAuditLogs.length} entries · Read-only</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity / Target</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {mockAuditLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad' }}>{log.id}</td>
                  <td style={{ fontSize: '12px', color: '#f0fdf4', fontWeight: 600 }}>{log.actor}</td>
                  <td><span className={`badge ${ACTION_COLOR[log.action] || 'badge-dim'}`} style={{ fontSize: '10px', letterSpacing: '0.3px' }}>{log.action}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#85a2ad' }}>{log.entity}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#435b64' }}>{log.ip}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad', whiteSpace: 'nowrap' }}>
                    {new Date(log.ts).toLocaleString('en-IN')}
                  </td>
                  <td><span className={`badge ${log.result === 'SUCCESS' ? 'badge-emerald' : 'badge-danger'}`}>{log.result}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

