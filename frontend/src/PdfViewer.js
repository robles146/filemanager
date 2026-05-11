import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js usando el bundle minificado
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

export default function PdfViewer({ url }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const renderTaskRef = useRef(null);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setNumPages(0);
      setCurrentPage(1);

      try {
        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: `${process.env.PUBLIC_URL}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${process.env.PUBLIC_URL}/standard_fonts/`,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar el PDF');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;

    let cancelled = false;

    async function renderPage() {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';

      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        container.appendChild(canvas);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
      } catch (err) {
        if (!cancelled && err.name !== 'RenderingCancelledException') {
          setError(err.message || 'Error al renderizar la página');
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, scale, numPages]);

  const goPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goNext = () => setCurrentPage(p => Math.min(numPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(3, s + 0.2));
  const zoomOut = () => setScale(s => Math.max(0.4, s - 0.2));

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p>📄 Cargando PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#e74c3c' }}>
        <p>❌ Error al cargar el PDF</p>
        <p style={{ fontSize: 12, color: '#888' }}>{error}</p>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#4cc9f0', marginTop: 10, display: 'inline-block' }}>
          Descargar PDF
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#1a1a2e',
        borderRadius: '6px 6px 0 0',
        borderBottom: '1px solid #333',
        flexWrap: 'wrap'
      }}>
        <button style={toolbarBtn} onClick={goPrev} disabled={currentPage <= 1}>◀</button>
        <span style={{ fontSize: 13, fontFamily: 'monospace' }}>
          Página {currentPage} / {numPages}
        </span>
        <button style={toolbarBtn} onClick={goNext} disabled={currentPage >= numPages}>▶</button>
        <span style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
        <button style={toolbarBtn} onClick={zoomOut}>−</button>
        <span style={{ fontSize: 13, fontFamily: 'monospace', minWidth: 50, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button style={toolbarBtn} onClick={zoomIn}>+</button>
        <span style={{ width: 1, height: 20, background: '#333', margin: '0 4px' }} />
        <a href={url} target="_blank" rel="noreferrer" style={{ ...toolbarBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          ⬇️ Descargar
        </a>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          background: '#0d1117',
          borderRadius: '0 0 6px 6px',
          minHeight: 400,
        }}
      />
    </div>
  );
}

const toolbarBtn = {
  background: '#16213e',
  color: '#fff',
  border: '1px solid #333',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};
