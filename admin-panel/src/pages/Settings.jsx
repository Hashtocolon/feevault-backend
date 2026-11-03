import { useState } from 'react';
import { mockSettings } from '../data/mockData';

export default function Settings() {
  const [settings, setSettings] = useState(mockSettings);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>System Settings</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Platform-wide configuration · Commission, GST, SLA, and security controls</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {saved && (
            <span style={{ color: '#34d399', fontWeight: 800, fontSize: '13px' }}>✓ Saved successfully</span>
          )}
          <button className="btn-primary" onClick={save}>💾 Save Changes</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Financial Settings */}
        <div className="panel">
          <div className="panel-head"><h2>💰 Financial Parameters</h2></div>
          <div style={{ padding: '24px' }}>
            <div className="form-group">
              <label className="form-label">Platform Commission %</label>
              <input className="form-input" type="number" step="0.1" min="0" max="5"
                value={settings.commission_pct}
                onChange={e => setSettings(s => ({ ...s, commission_pct: parseFloat(e.target.value) }))}
              />
              <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>Current: {settings.commission_pct}% of disbursed amount</div>
            </div>
            <div className="form-group">
              <label className="form-label">GST Rate %</label>
              <input className="form-input" type="number" step="0.5" min="0" max="28"
                value={settings.gst_pct}
                onChange={e => setSettings(s => ({ ...s, gst_pct: parseFloat(e.target.value) }))}
              />
              <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>Applied on platform commission</div>
            </div>
            <div className="form-group">
              <label className="form-label">Escrow Interest Rate % p.a.</label>
              <input className="form-input" type="number" step="0.01" min="0"
                value={settings.interest_rate}
                onChange={e => setSettings(s => ({ ...s, interest_rate: parseFloat(e.target.value) }))}
              />
              <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>Compounded daily, distributed to parent vaults</div>
            </div>
            <div className="form-group">
              <label className="form-label">Min Deposit (₹ in paise)</label>
              <input className="form-input" type="number"
                value={settings.min_deposit}
                onChange={e => setSettings(s => ({ ...s, min_deposit: parseInt(e.target.value) }))}
              />
              <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>₹{(settings.min_deposit / 100).toLocaleString('en-IN')} minimum per transaction</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max Deposit (₹ in paise)</label>
              <input className="form-input" type="number"
                value={settings.max_deposit}
                onChange={e => setSettings(s => ({ ...s, max_deposit: parseInt(e.target.value) }))}
              />
              <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>₹{(settings.max_deposit / 100).toLocaleString('en-IN')} maximum per transaction</div>
            </div>
          </div>
        </div>

        {/* Operations Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel">
            <div className="panel-head"><h2>⏱️ SLA & Operations</h2></div>
            <div style={{ padding: '24px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Exception Resolution SLA (hours)</label>
                <input className="form-input" type="number" min="12" max="168"
                  value={settings.sla_hours}
                  onChange={e => setSettings(s => ({ ...s, sla_hours: parseInt(e.target.value) }))}
                />
                <div style={{ fontSize: '11px', color: '#85a2ad', marginTop: '5px' }}>Current: {settings.sla_hours}h from exception creation time</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>🔐 Security Controls</h2></div>
            <div style={{ padding: '20px' }}>
              {[
                { key: 'auto_recon', label: 'Auto Daily Reconciliation', sub: 'Runs at 2:00 AM IST every day' },
                { key: 'two_fa', label: '2FA for Admin Logins', sub: 'TOTP authentication (Google Authenticator)' },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(16,185,129,0.07)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#85a2ad' }}>{item.sub}</div>
                  </div>
                  <div
                    onClick={() => toggle(item.key)}
                    style={{
                      width: '46px', height: '26px', borderRadius: '13px', cursor: 'pointer',
                      background: settings[item.key] ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(67,91,100,0.4)',
                      position: 'relative', transition: 'background 0.3s',
                      boxShadow: settings[item.key] ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '3px',
                      left: settings[item.key] ? '23px' : '3px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'white', transition: 'left 0.3s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              ))}

              {/* IP Whitelist */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#85a2ad', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>IP Whitelist</div>
                {settings.ip_whitelist.map((ip, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#34d399', flex: 1 }}>{ip}</span>
                    <button className="btn-danger btn-sm" onClick={() => setSettings(s => ({ ...s, ip_whitelist: s.ip_whitelist.filter((_, j) => j !== i) }))}>✕</button>
                  </div>
                ))}
                <button className="btn-glass btn-sm" style={{ marginTop: '4px' }}>＋ Add IP</button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div style={{ padding: '20px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444', marginBottom: '10px' }}>⚠️ Danger Zone</div>
            <p style={{ fontSize: '12px', color: '#85a2ad', marginBottom: '14px' }}>These actions are irreversible. Proceed with extreme caution.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn-danger">🔒 Freeze All Disbursals</button>
              <button className="btn-danger">⛔ Emergency System Halt</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

