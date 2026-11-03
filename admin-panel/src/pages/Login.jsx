import { useState } from 'react';

const ADMIN_EMAIL = 'admin@feevault.in';
const ADMIN_PASS = 'Admin@123';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
      onLogin({ email, name: 'Vikram Anand', role: 'SUPER_ADMIN' });
    } else {
      setError('Invalid credentials. Use admin@feevault.in / Admin@123');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060e12', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '500px',
        background: 'radial-gradient(circle at 50% -20%, rgba(16,185,129,0.22) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', right: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: '420px', padding: '20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'grid', placeItems: 'center', fontSize: '28px',
            boxShadow: '0 0 32px rgba(16,185,129,0.45)',
          }}>✦</div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', color: '#f0fdf4' }}>
            FeeVault
          </h1>
          <p style={{ color: '#34d399', fontSize: '11px', fontWeight: 800, letterSpacing: '2px', marginTop: '4px' }}>
            ADMIN CONTROL CENTRE
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(14,28,36,0.9)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '20px', padding: '36px', backdropFilter: 'blur(24px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 40px rgba(16,185,129,0.08)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          }} />

          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Sign In
          </h2>
          <p style={{ color: '#85a2ad', fontSize: '13px', marginBottom: '28px' }}>
            Access the FeeVault operations dashboard
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="admin@feevault.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#435b64', fontSize: '14px',
                  }}
                >{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? 'rgba(16,185,129,0.4)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontWeight: 800, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite', display: 'inline-block',
                  }} />
                  Authenticating...
                </>
              ) : '→ Access Dashboard'}
            </button>
          </form>

          <div style={{
            marginTop: '24px', padding: '14px', borderRadius: '8px',
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)',
          }}>
            <p style={{ fontSize: '11px', color: '#85a2ad', fontWeight: 600 }}>
              🔐 Demo credentials: <span style={{ color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>admin@feevault.in</span> / <span style={{ color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>Admin@123</span>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#435b64', fontSize: '12px' }}>
          FeeVault Admin v1.0 · Phase 1 · Emerald Fintech Neo
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

