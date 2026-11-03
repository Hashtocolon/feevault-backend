import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  {
    group: 'OPERATIONS',
    items: [
      { path: '/overview', icon: '⌂', label: 'Operations Overview' },
      { path: '/schools', icon: '🏫', label: 'Partner Schools' },
      { path: '/parents', icon: '👨‍👩‍👧', label: 'Parents & Vaults' },
      { path: '/escrow', icon: '🏦', label: 'Escrow Monitor' },
      { path: '/reconciliation', icon: '⚖️', label: '3-Way Reconciliation' },
    ],
  },
  {
    group: 'DISBURSEMENT',
    items: [
      { path: '/payouts', icon: '💸', label: 'Payout Batches' },
      { path: '/documents', icon: '📄', label: 'School Documents' },
      { path: '/exceptions', icon: '⚠️', label: 'Exception Requests' },
    ],
  },
  {
    group: 'COMPLIANCE',
    items: [
      { path: '/finance', icon: '📊', label: 'Finance & GST' },
      { path: '/audit', icon: '🔏', label: 'Audit Logs' },
    ],
  },
  {
    group: 'ADMIN',
    items: [
      { path: '/team', icon: '👥', label: 'Team & Roles' },
      { path: '/settings', icon: '⚙️', label: 'System Settings' },
    ],
  },
];

export default function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside style={{
      width: '260px',
      minWidth: '260px',
      background: '#04080b',
      borderRight: '1px solid rgba(16,185,129,0.18)',
      padding: '24px 14px',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflowY: 'auto',
      position: 'sticky',
      top: 0,
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 8px 22px', borderBottom: '1px solid rgba(16,185,129,0.18)',
        marginBottom: '8px',
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'grid', placeItems: 'center', color: 'white',
          fontWeight: 900, fontSize: '22px',
          boxShadow: '0 0 20px rgba(16,185,129,0.4)',
        }}>✦</div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            FeeVault
          </div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#34d399', letterSpacing: '1.5px' }}>
            ADMIN CENTRE
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {NAV.map(section => (
          <div key={section.group} style={{ marginTop: '20px' }}>
            <div style={{
              fontSize: '10px', fontWeight: 800, color: '#435b64',
              letterSpacing: '1.5px', padding: '4px 10px 8px',
            }}>{section.group}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {section.items.map(item => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '8px', width: '100%',
                      textAlign: 'left', border: 'none', cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '13px', fontWeight: active ? 700 : 600,
                      color: active ? '#34d399' : '#85a2ad',
                      background: active ? 'rgba(14,28,36,0.9)' : 'transparent',
                      borderLeft: active ? '2px solid rgba(52,211,153,0.5)' : '2px solid transparent',
                      boxShadow: active ? '0 4px 16px rgba(0,0,0,0.35)' : 'none',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(14,28,36,0.6)'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#85a2ad'; e.currentTarget.style.background = 'transparent'; }}}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(16,185,129,0.12)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '10px',
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)',
          marginBottom: '10px',
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '14px',
          }}>
            {user?.name?.[0] || 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f0fdf4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 800, letterSpacing: '0.5px' }}>
              SUPER ADMIN
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: '9px', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px', background: 'rgba(239,68,68,0.06)',
            color: '#ef4444', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '12px', fontWeight: 700, transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
        >
          ⎋ Sign Out
        </button>
      </div>
    </aside>
  );
}

