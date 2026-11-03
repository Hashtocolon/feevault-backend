export default function Topbar({ title, subtitle, user }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <header style={{
      height: '64px', minHeight: '64px',
      background: 'rgba(10,23,29,0.85)',
      borderBottom: '1px solid rgba(16,185,129,0.18)',
      padding: '0 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      backdropFilter: 'blur(14px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div>
        <div style={{ fontSize: '12px', color: '#85a2ad', marginBottom: '1px' }}>
          FeeVault Admin &nbsp;/&nbsp; <b style={{ color: '#f0fdf4' }}>{title}</b>
        </div>
        {subtitle && <div style={{ fontSize: '11px', color: '#435b64', fontWeight: 600 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Live badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 14px',
          borderRadius: '30px', background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)', color: '#34d399',
          fontSize: '11px', fontWeight: 800,
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#34d399', display: 'inline-block',
            boxShadow: '0 0 8px #34d399',
            animation: 'pulse2 2s infinite',
          }} />
          LEDGER SYNCED
        </div>
        {/* Time */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#f0fdf4' }}>
            {timeStr}
          </div>
          <div style={{ fontSize: '10px', color: '#435b64', fontWeight: 600 }}>{dateStr}</div>
        </div>
        {/* Notification */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(14,28,36,0.8)', border: '1px solid rgba(16,185,129,0.18)',
            display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: '16px',
          }}>🔔</div>
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#ef4444', border: '2px solid #04080b',
            fontSize: '9px', fontWeight: 800, color: 'white',
            display: 'grid', placeItems: 'center',
          }}>3</span>
        </div>
      </div>
      <style>{`@keyframes pulse2 { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.4);opacity:0.7;} }`}</style>
    </header>
  );
}

