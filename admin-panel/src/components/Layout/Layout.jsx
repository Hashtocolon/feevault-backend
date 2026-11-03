import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ user, onLogout, title, subtitle, children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <Sidebar user={user} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar title={title} subtitle={subtitle} user={user} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px 60px', position: 'relative' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

