import { useState } from 'react';
import { mockDocuments } from '../data/mockData';

const DOC_TYPES = ['MOU', 'BANK_MANDATE', 'SCHOOL_CONFIRMATION', 'ID_PROOF', 'OTHER'];

function UploadModal({ onClose }) {
  const [form, setForm] = useState({ school: '', type: 'MOU', file: null });
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>📤 Upload School Document</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Partner School</label>
            <select className="form-input" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}>
              <option value="">Select school...</option>
              <option value="DPS-BLR-04">DPS Bangalore East (DPS-BLR-04)</option>
              <option value="GWH-BLR-02">Greenwood High (GWH-BLR-02)</option>
              <option value="RPS-HYD-01">Ryan Public Hyderabad (RPS-HYD-01)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Document Type</label>
            <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">File (PDF / Image)</label>
            <div style={{
              border: '2px dashed rgba(16,185,129,0.25)', borderRadius: '10px',
              padding: '32px', textAlign: 'center', cursor: 'pointer',
              background: 'rgba(16,185,129,0.03)',
            }}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📎</div>
              <div style={{ fontSize: '13px', color: '#85a2ad', fontWeight: 600 }}>
                Click to select file or drag & drop
              </div>
              <div style={{ fontSize: '11px', color: '#435b64', marginTop: '4px' }}>PDF, JPG, PNG — max 10MB</div>
              <input id="fileInput" type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))} />
              {form.file && <div style={{ marginTop: '10px', color: '#34d399', fontSize: '12px', fontWeight: 700 }}>✓ {form.file.name}</div>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-glass" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onClose}>📤 Upload Document</button>
        </div>
      </div>
    </div>
  );
}

const typeColors = { MOU: 'badge-emerald', BANK_MANDATE: 'badge-info', SCHOOL_CONFIRMATION: 'badge-warning', ID_PROOF: 'badge-dim', OTHER: 'badge-dim' };

export default function Documents() {
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = mockDocuments.filter(d =>
    d.school.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase()) ||
    d.school_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '4px' }}>School Documents</h1>
          <p style={{ color: '#85a2ad', fontSize: '14px' }}>Upload and manage MoUs, mandates, and confirmation letters</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="search-bar">
            <span style={{ color: '#435b64' }}>🔍</span>
            <input placeholder="Search school, type..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>📤 Upload Document</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {DOC_TYPES.map(t => (
          <div key={t} style={{ padding: '14px 16px', background: 'rgba(14,28,36,0.75)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 900, color: '#34d399', marginBottom: '4px' }}>
              {mockDocuments.filter(d => d.type === t).length}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#85a2ad', letterSpacing: '0.5px' }}>{t.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>📋 Document Registry</h2>
          <span className="badge badge-emerald">{filtered.length} documents</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>School</th>
                <th>Type</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📄</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{doc.filename}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#85a2ad' }}>{doc.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>{doc.school}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#85a2ad' }}>{doc.school_code}</div>
                  </td>
                  <td><span className={`badge ${typeColors[doc.type] || 'badge-dim'}`}>{doc.type}</span></td>
                  <td style={{ fontSize: '12px', color: '#85a2ad' }}>{doc.uploaded_by}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#85a2ad' }}>{doc.uploaded_at}</td>
                  <td><span className="badge badge-emerald">{doc.status}</span></td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn-glass btn-sm">👁 View</button>
                    <button className="btn-glass btn-sm">⬇ Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}

