import React, { useState, useEffect } from 'react';
import axios from 'axios';

const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src=';

export default function OfficeViewer({ filePath, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/preview-token?path=${encodeURIComponent(filePath)}`);
        if (cancelled) return;
        const encodedUrl = encodeURIComponent(res.data.url);
        setViewerUrl(`${OFFICE_VIEWER}${encodedUrl}`);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message);
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => { cancelled = true; };
  }, [filePath]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>📄 Preparando vista previa de Office...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#e74c3c' }}>
        <p>❌ Error al preparar la vista previa</p>
        <p style={{ fontSize: 12, color: '#888' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#1a1a2e',
        borderRadius: '6px 6px 0 0',
        borderBottom: '1px solid #333',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{fileName}</span>
        <span style={{ fontSize: 11, color: '#888' }}>Vía Microsoft Office Online</span>
      </div>
      <div style={{ flex: 1, borderRadius: '0 0 6px 6px', overflow: 'hidden', background: '#fff' }}>
        <iframe
          src={viewerUrl}
          title={fileName}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}
