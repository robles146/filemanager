import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';

export default function CsvViewer({ filePath, fileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCsv() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/read?path=${encodeURIComponent(filePath)}`);
        if (cancelled) return;

        const parsed = Papa.parse(res.data.content, {
          header: true,
          skipEmptyLines: true,
          delimiter: '', // auto-detect
        });

        setHeaders(parsed.meta.fields || []);
        setData(parsed.data || []);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message);
          setLoading(false);
        }
      }
    }

    loadCsv();

    return () => { cancelled = true; };
  }, [filePath]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>📊 Cargando CSV...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#e74c3c' }}>
        <p>❌ Error al cargar el CSV</p>
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
        <span style={{ fontSize: 11, color: '#888' }}>{data.length} filas · {headers.length} columnas</span>
      </div>
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#0d1117',
        borderRadius: '0 0 6px 6px',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ background: '#161b22', position: 'sticky', top: 0 }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '8px 10px',
                  textAlign: 'left',
                  borderBottom: '1px solid #333',
                  whiteSpace: 'nowrap',
                  color: '#58a6ff',
                  fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #21262d' }}>
                {headers.map((h, ci) => (
                  <td key={ci} style={{
                    padding: '6px 10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 300,
                  }} title={String(row[h] ?? '')}>
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <p style={{ textAlign: 'center', padding: 30, color: '#888' }}>Archivo vacío o sin datos válidos</p>
        )}
      </div>
    </div>
  );
}
