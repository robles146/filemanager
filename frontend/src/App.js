import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import PdfViewer from './PdfViewer';
import OfficeViewer from './OfficeViewer';
import CsvViewer from './CsvViewer';
import MediaViewer from './MediaViewer';
import TextViewer from './TextViewer';

const API = '';

function formatSize(bytes) {
  if (bytes == null) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('es-ES');
}

function formatMode(mode) {
  if (!mode) return '-';
  const m = parseInt(mode, 10);
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const o = perms[m & 7];
  const g = perms[(m >> 3) & 7];
  const u = perms[(m >> 6) & 7];
  return `${u}${g}${o}`;
}

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const pdfExts = ['pdf'];
  const textExts = ['txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'yaml', 'yml', 'php', 'py', 'rb', 'sh', 'bash', 'zsh', 'sql', 'env', 'ini', 'conf', 'config', 'log', 'htaccess', 'gitignore'];
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  const csvExts = ['csv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'];
  const videoExts = ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi'];
  if (imageExts.includes(ext)) return 'image';
  if (pdfExts.includes(ext)) return 'pdf';
  if (textExts.includes(ext)) return 'text';
  if (officeExts.includes(ext)) return 'office';
  if (csvExts.includes(ext)) return 'csv';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  return 'other';
}

export default function App() {
  const [path, setPath] = useState('.');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [showMkdir, setShowMkdir] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFileTarget, setPendingFileTarget] = useState(null);

  const rowRefs = useRef({});

  // ZIP modal
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipName, setZipName] = useState('');
  const [zipLoading, setZipLoading] = useState(false);

  // Dropdown menu state (mobile actions)
  const [openDropdown, setOpenDropdown] = useState(null);

  // Preview modal (view-only)
  const [previewItem, setPreviewItem] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Editor modal (text edit)
  const [editorItem, setEditorItem] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorEncoding, setEditorEncoding] = useState('utf-8');
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorModified, setEditorModified] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);

  const openPreviewRef = useRef(() => {});
  const openEditorRef = useRef(() => {});
  const openDetailsRef = useRef(() => {});

  // Ref para leer el path actual de forma síncrona (útil para apertura por URL)
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  // Helper: convertir ruta absoluta /var/www/... a relativa usada por el frontend
  const normalizeFrontendPath = useCallback((rawPath) => {
    if (!rawPath) return '.';
    const base = '/var/www';
    if (rawPath === base || rawPath === base + '/') return '.';
    if (rawPath.startsWith(base + '/')) return rawPath.slice(base.length + 1);
    return rawPath.replace(/^\/+/, '');
  }, []);

  // Leer parámetro ?path= de la URL al cargar y abrir directorio/archivo automáticamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetPath = params.get('path');
    if (!targetPath) return;

    const resolveAndOpen = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API}/api/details?path=${encodeURIComponent(targetPath)}`);
        const details = res.data;
        if (details.isDirectory) {
          setPath(normalizeFrontendPath(targetPath));
        } else if (details.isFile) {
          const normalized = normalizeFrontendPath(targetPath);
          const lastSlash = normalized.lastIndexOf('/');
          const dirPath = lastSlash === -1 ? '.' : normalized.substring(0, lastSlash);
          const fileName = lastSlash === -1 ? normalized : normalized.substring(lastSlash + 1);
          setPath(dirPath);

          // Esperar a que el estado path se actualice antes de abrir el archivo
          let attempts = 0;
          const maxAttempts = 40; // 2 segundos máximo
          const interval = setInterval(() => {
            attempts++;
            if (pathRef.current === dirPath) {
              clearInterval(interval);
              const actions = getFileActions(fileName);
              if (actions.canPreview) {
                openPreviewRef.current(fileName);
              } else if (actions.canEdit) {
                openEditorRef.current(fileName);
              } else {
                openDetailsRef.current(fileName);
              }
            } else if (attempts >= maxAttempts) {
              clearInterval(interval);
              setError(`No se pudo abrir el archivo: ${targetPath}`);
            }
          }, 50);
        } else {
          setError(`La ruta no es un archivo ni directorio: ${targetPath}`);
        }
      } catch (err) {
        setError(err.response?.data?.error || `No se pudo abrir: ${targetPath}`);
      } finally {
        setLoading(false);
      }
    };

    resolveAndOpen();
  }, []);

  useEffect(() => {
    openPreviewRef.current = openPreview;
    openEditorRef.current = openEditor;
    openDetailsRef.current = openDetails;
  });

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/api/files?path=${encodeURIComponent(path)}`);
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (!pendingFileTarget || loading) return;
    // Esperar a estar en el directorio correcto antes de buscar el archivo
    if (pendingFileTarget.dirPath && path !== pendingFileTarget.dirPath) return;
    const foundItem = items.find(i => i.name === pendingFileTarget.name);
    if (!foundItem) {
      setError(`Archivo no encontrado en el directorio: ${pendingFileTarget.name}`);
      setPendingFileTarget(null);
      return;
    }
    const rowEl = rowRefs.current[pendingFileTarget.name];
    if (rowEl) {
      rowEl.focus();
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const actions = !foundItem.isDirectory ? getFileActions(foundItem.name) : {};
    if (actions.canPreview) {
      openPreviewRef.current(foundItem.name);
    } else if (actions.canEdit) {
      openEditorRef.current(foundItem.name);
    } else {
      openDetailsRef.current(foundItem.name);
    }
    setPendingFileTarget(null);
  }, [items, loading, pendingFileTarget]);

  const navigate = (name, isDir) => {
    if (isDir) {
      setPath(path === '.' ? name : `${path}/${name}`);
      setSearchQuery('');
      setSelected(new Set());
    }
  };

  const goUp = () => {
    if (path === '.' || path === '') return;
    const idx = path.lastIndexOf('/');
    setPath(idx <= 0 ? '.' : path.substring(0, idx));
    setSearchQuery('');
    setSelected(new Set());
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('path', path);
    for (const f of files) form.append('files', f);
    try {
      await axios.post(`${API}/api/upload-multiple`, form);
      fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleMkdir = async () => {
    if (!newFolder.trim()) return;
    setError('');
    try {
      await axios.post(`${API}/api/mkdir`, {
        path: path === '.' ? newFolder.trim() : `${path}/${newFolder.trim()}`
      });
      setNewFolder('');
      setShowMkdir(false);
      fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    setError('');
    try {
      await axios.delete(`${API}/api/delete?path=${encodeURIComponent(path === '.' ? name : `${path}/${name}`)}`);
      fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) {
      setRenameTarget(null);
      return;
    }
    setError('');
    try {
      await axios.post(`${API}/api/rename`, {
        oldPath: path === '.' ? renameTarget : `${path}/${renameTarget}`,
        newPath: path === '.' ? renameValue.trim() : `${path}/${renameValue.trim()}`
      });
      setRenameTarget(null);
      setRenameValue('');
      fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDownload = (name) => {
    const p = path === '.' ? name : `${path}/${name}`;
    window.open(`${API}/api/download?path=${encodeURIComponent(p)}`, '_blank');
  };

  const toggleSelect = (name) => {
    const s = new Set(selected);
    if (s.has(name)) s.delete(name); else s.add(name);
    setSelected(s);
  };

  const deleteSelected = async () => {
    if (!window.confirm(`¿Eliminar ${selected.size} elemento(s)?`)) return;
    setError('');
    for (const name of selected) {
      try {
        await axios.delete(`${API}/api/delete?path=${encodeURIComponent(path === '.' ? name : `${path}/${name}`)}`);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      }
    }
    setSelected(new Set());
    fetchFiles();
  };

  const openDetails = async (name) => {
    const itemPath = path === '.' ? name : `${path}/${name}`;
    setDetailItem(name);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await axios.get(`${API}/api/details?path=${encodeURIComponent(itemPath)}`);
      setDetailData(res.data);
    } catch (err) {
      setDetailData({ error: err.response?.data?.error || err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  // --- PREVIEW (view-only modal) ---
  const openPreview = async (name) => {
    const ftype = getFileType(name);
    const itemPath = path === '.' ? name : `${path}/${name}`;

    if (ftype === 'other') {
      // No preview support, just download
      handleDownload(name);
      return;
    }

    setPreviewItem(name);
    setPreviewType(ftype);
    setPreviewLoading(true);

    if (['image', 'pdf', 'office', 'csv', 'audio', 'video', 'text'].includes(ftype)) {
      // These render via their own components, no content to preload
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(false);
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewType(null);
  };

  // --- EDITOR (text edit modal) ---
  const openEditor = async (name) => {
    const itemPath = path === '.' ? name : `${path}/${name}`;
    setEditorItem(name);
    setEditorContent('');
    setEditorEncoding('utf-8');
    setEditorModified(false);
    setEditorLoading(true);
    try {
      const res = await axios.get(`${API}/api/read?path=${encodeURIComponent(itemPath)}`);
      setEditorContent(res.data.content);
      setEditorEncoding(res.data.encoding);
    } catch (err) {
      setEditorContent('Error al leer el archivo: ' + (err.response?.data?.error || err.message));
    } finally {
      setEditorLoading(false);
    }
  };

  const saveFile = async () => {
    if (!editorItem) return;
    const itemPath = path === '.' ? editorItem : `${path}/${editorItem}`;
    setEditorSaving(true);
    setError('');
    try {
      await axios.post(`${API}/api/save`, {
        path: itemPath,
        content: editorContent,
        encoding: editorEncoding
      });
      setEditorModified(false);
      fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setEditorSaving(false);
    }
  };

  const closeEditor = () => {
    if (editorModified && !window.confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')) return;
    setEditorItem(null);
    setEditorContent('');
    setEditorModified(false);
  };

  const handleCreateZip = async () => {
    if (selected.size === 0) return;
    setZipLoading(true);
    setError('');
    try {
      const paths = Array.from(selected).map(name => path === '.' ? name : `${path}/${name}`);
      const response = await axios.post(`${API}/api/zip`, {
        paths,
        zipName: zipName.trim() || undefined
      }, { responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers['content-disposition'];
      const match = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setShowZipModal(false);
      setZipName('');
      setSelected(new Set());
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.error || 'Error al crear el ZIP');
        } catch {
          setError('Error al crear el ZIP');
        }
      } else {
        setError(err.response?.data?.error || err.message);
      }
    } finally {
      setZipLoading(false);
    }
  };

  const getDownloadUrl = (name) => {
    const p = path === '.' ? name : `${path}/${name}`;
    return `${API}/api/download?path=${encodeURIComponent(p)}`;
  };

  const handleOpenFilePath = async (relativePath) => {
    setError('');
    setLoading(true);
    try {
      const detailsRes = await axios.get(`${API}/api/details?path=${encodeURIComponent(relativePath)}`);
      const data = detailsRes.data;
      const fullPath = data.relativePath != null ? data.relativePath : relativePath;
      if (data.isDirectory) {
        setPath(fullPath === '' ? '.' : fullPath);
        return;
      }
      const lastSlash = fullPath.lastIndexOf('/');
      const dirPart = lastSlash >= 0 ? fullPath.substring(0, lastSlash) : '';
      const filePart = lastSlash >= 0 ? fullPath.substring(lastSlash + 1) : fullPath;
      const dirPath = dirPart === '' ? '.' : dirPart;

      const filesRes = await axios.get(`${API}/api/files?path=${encodeURIComponent(dirPath)}`);
      const dirItems = filesRes.data.items || [];
      const foundItem = dirItems.find(i => i.name === filePart);
      if (!foundItem) {
        setError(`Archivo no encontrado en el directorio: ${filePart}`);
        setPath(dirPath);
        return;
      }

      setPath(dirPath);
      setItems(dirItems);
      setSearchQuery('');
      setSelected(new Set());
      setPendingFileTarget({ name: filePart });
    } catch (err) {
      setError(err.response?.data?.error || `No se encontró: ${relativePath}`);
    } finally {
      setLoading(false);
    }
  };

  // Determine what actions a file supports
  const getFileActions = (name) => {
    const ftype = getFileType(name);
    return {
      canPreview: ['image', 'pdf', 'office', 'csv', 'audio', 'video', 'text'].includes(ftype),
      canEdit: ftype === 'text',
      canDownload: true
    };
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>📁 FileManager</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={btnStyle}>
            {uploading ? '⏳ Subiendo...' : '⬆️ Subir archivos'}
            <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
          <button style={btnStyle} onClick={() => setShowMkdir(!showMkdir)}>📂 Nueva carpeta</button>
          {selected.size > 0 && (
            <>
              <button style={{ ...btnStyle, background: '#8e44ad' }} onClick={() => setShowZipModal(true)}>📦 Crear ZIP ({selected.size})</button>
              <button style={{ ...btnStyle, background: '#c0392b' }} onClick={deleteSelected}>🗑️ Eliminar ({selected.size})</button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div style={{ background: '#c0392b', padding: 12, borderRadius: 6, marginBottom: 16 }}>{error}</div>
      )}

      <PathNavigator path={path} setPath={setPath} setSearchQuery={setSearchQuery} setSelected={setSelected} onRefresh={fetchFiles} onOpenFilePath={handleOpenFilePath} />

      {showMkdir && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Nombre de carpeta"
            value={newFolder}
            onChange={e => setNewFolder(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleMkdir()}
          />
          <button style={btnStyle} onClick={handleMkdir}>Crear</button>
          <button style={btnStyle2} onClick={() => setShowMkdir(false)}>Cancelar</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 14 }}>🔍</span>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Buscar por nombre..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button style={btnStyle2} onClick={() => setSearchQuery('')}>Limpiar</button>
        )}
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ background: '#16213e', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#0f3460', textAlign: 'left' }}>
                <th style={thStyle}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(items.map(i => i.name)) : new Set())} checked={selected.size === items.length && items.length > 0} /></th>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Tamaño</th>
                <th style={thStyle}>Modificado</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(item => {
                  const actions = !item.isDirectory ? getFileActions(item.name) : {};
                  return (
                    <tr
                      key={item.name}
                      ref={el => rowRefs.current[item.name] = el}
                      tabIndex={-1}
                      style={{ borderBottom: '1px solid #1a1a2e', outline: 'none' }}
                    >
                      <td style={tdStyle}><input type="checkbox" checked={selected.has(item.name)} onChange={() => toggleSelect(item.name)} /></td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        {item.isDirectory ? (
                          <span style={{ cursor: 'pointer', color: '#4cc9f0', fontWeight: 600, wordBreak: 'break-all', display: 'inline-block' }} onClick={() => navigate(item.name, true)}>
                            📁 {item.name}
                          </span>
                        ) : (
                          <span style={{ wordBreak: 'break-all', display: 'inline-block' }}>📄 {item.name}</span>
                        )}
                      </td>
                      <td style={tdStyle}>{formatSize(item.size)}</td>
                      <td style={tdStyle}>{new Date(item.modified).toLocaleString()}</td>
                      <td style={tdStyle}>
                        {renameTarget === item.name ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input style={{ ...inputStyle, width: 120 }} value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
                            <button style={btnStyle2} onClick={handleRename}>✓</button>
                            <button style={btnStyle2} onClick={() => setRenameTarget(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            {/* Desktop: botones inline */}
                            <div style={{ display: 'flex', gap: 6 }} className="desktop-actions">
                              {!item.isDirectory && actions.canPreview && (
                                <button style={btnStyle2} onClick={() => openPreview(item.name)} title="Vista previa">👁️</button>
                              )}
                              {!item.isDirectory && actions.canEdit && (
                                <button style={btnStyle2} onClick={() => openEditor(item.name)} title="Editar">✏️</button>
                              )}
                              <button style={btnStyle2} onClick={() => openDetails(item.name)} title="Ver detalles">ℹ️</button>
                              {!item.isDirectory && (
                                <button style={btnStyle2} onClick={() => handleDownload(item.name)} title="Descargar">⬇️</button>
                              )}
                              <button style={btnStyle2} onClick={() => { setRenameTarget(item.name); setRenameValue(item.name); }} title="Renombrar">📝</button>
                              <button style={{ ...btnStyle2, background: '#c0392b' }} onClick={() => handleDelete(item.name)} title="Eliminar">🗑️</button>
                            </div>
                            {/* Mobile: dropdown */}
                            <div style={{ display: 'none' }} className="mobile-actions">
                              <button
                                style={{ ...btnStyle2, padding: '6px 12px' }}
                                onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                              >
                                ⚙️ Acciones
                              </button>
                              {openDropdown === item.name && (
                                <div style={dropdownStyle}>
                                  {!item.isDirectory && actions.canPreview && (
                                    <div style={dropdownItemStyle} onClick={() => { openPreview(item.name); setOpenDropdown(null); }}>👁️ Vista previa</div>
                                  )}
                                  {!item.isDirectory && actions.canEdit && (
                                    <div style={dropdownItemStyle} onClick={() => { openEditor(item.name); setOpenDropdown(null); }}>✏️ Editar</div>
                                  )}
                                  <div style={dropdownItemStyle} onClick={() => { openDetails(item.name); setOpenDropdown(null); }}>ℹ️ Detalles</div>
                                  {!item.isDirectory && (
                                    <div style={dropdownItemStyle} onClick={() => { handleDownload(item.name); setOpenDropdown(null); }}>⬇️ Descargar</div>
                                  )}
                                  <div style={dropdownItemStyle} onClick={() => { setRenameTarget(item.name); setRenameValue(item.name); setOpenDropdown(null); }}>📝 Renombrar</div>
                                  <div style={{ ...dropdownItemStyle, color: '#e74c3c' }} onClick={() => { handleDelete(item.name); setOpenDropdown(null); }}>🗑️ Eliminar</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#888' }}>
                  {searchQuery ? 'Ningún resultado coincide con la búsqueda' : 'Directorio vacío'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalles */}
      {detailItem && (
        <div style={modalOverlayStyle} onClick={() => setDetailItem(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18 }}>📋 Detalles</h2>
              <button style={btnStyle2} onClick={() => setDetailItem(null)}>✕</button>
            </div>
            {detailLoading ? (
              <p>Cargando detalles...</p>
            ) : detailData?.error ? (
              <p style={{ color: '#e74c3c' }}>{detailData.error}</p>
            ) : detailData ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <DetailRow label="Nombre" value={detailItem} />
                <DetailRow label="Ruta completa" value={detailData.fullPath} />
                <DetailRow label="Ruta relativa" value={detailData.relativePath} />
                <DetailRow label="Tipo" value={detailData.isDirectory ? '📁 Carpeta' : detailData.isSymbolicLink ? '🔗 Enlace simbólico' : '📄 Archivo'} />
                <DetailRow label="Tamaño" value={detailData.size != null ? formatSize(detailData.size) : '-'} />
                <DetailRow label="Permisos" value={`${formatMode(detailData.mode)} (${detailData.mode})`} />
                <DetailRow label="UID (Usuario)" value={detailData.uid} />
                <DetailRow label="GID (Grupo)" value={detailData.gid} />
                <DetailRow label="Creado" value={formatDate(detailData.created)} />
                <DetailRow label="Modificado" value={formatDate(detailData.modified)} />
                <DetailRow label="Último acceso" value={formatDate(detailData.accessed)} />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal de VISTA PREVIA (solo lectura) */}
      {previewItem && (
        <div style={modalOverlayStyle} onClick={closePreview}>
          <div style={{ ...modalContentStyle, maxWidth: ['image', 'office', 'csv', 'audio', 'video'].includes(previewType) ? 950 : 900, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18 }}>
                {previewType === 'image' ? '🖼️ Vista previa' : previewType === 'pdf' ? '📄 Vista previa PDF' : previewType === 'office' ? '📊 Vista previa Office' : previewType === 'csv' ? '📈 Vista previa CSV' : previewType === 'audio' ? '🎵 Vista previa Audio' : previewType === 'video' ? '🎬 Vista previa Video' : previewType === 'text' ? '📝 Vista previa' : '👁️ Vista previa'} — {previewItem}
              </h2>
              <button style={btnStyle2} onClick={closePreview}>✕</button>
            </div>

            {previewLoading ? (
              <p>Cargando...</p>
            ) : previewType === 'image' ? (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={getDownloadUrl(previewItem)}
                  alt={previewItem}
                  style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 6 }}
                />
              </div>
            ) : previewType === 'pdf' ? (
              <div style={{ width: '100%', height: '75vh', borderRadius: 6, overflow: 'hidden' }}>
                <PdfViewer url={getDownloadUrl(previewItem)} />
              </div>
            ) : previewType === 'office' ? (
              <div style={{ width: '100%', height: '75vh', borderRadius: 6, overflow: 'hidden' }}>
                <OfficeViewer
                  filePath={path === '.' ? previewItem : `${path}/${previewItem}`}
                  fileName={previewItem}
                />
              </div>
            ) : previewType === 'csv' ? (
              <div style={{ width: '100%', height: '75vh', borderRadius: 6, overflow: 'hidden' }}>
                <CsvViewer
                  filePath={path === '.' ? previewItem : `${path}/${previewItem}`}
                  fileName={previewItem}
                />
              </div>
            ) : previewType === 'audio' || previewType === 'video' ? (
              <div style={{ width: '100%', height: '75vh', borderRadius: 6, overflow: 'hidden' }}>
                <MediaViewer
                  url={getDownloadUrl(previewItem)}
                  fileName={previewItem}
                />
              </div>
            ) : previewType === 'text' ? (
              <div style={{ width: '100%', height: '75vh', borderRadius: 6, overflow: 'hidden' }}>
                <TextViewer
                  filePath={path === '.' ? previewItem : `${path}/${previewItem}`}
                  fileName={previewItem}
                />
              </div>
            ) : (
              <p>Tipo de archivo no soportado para vista previa.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal de ZIP */}
      {showZipModal && (
        <div style={modalOverlayStyle} onClick={() => { if (!zipLoading) setShowZipModal(false); }}>
          <div style={{ ...modalContentStyle, maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18 }}>📦 Crear ZIP</h2>
              <button style={btnStyle2} onClick={() => setShowZipModal(false)} disabled={zipLoading}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              Se comprimirán {selected.size} elemento(s) seleccionado(s).
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 6 }}>Nombre del archivo ZIP</label>
              <input
                style={{ ...inputStyle, width: '100%' }}
                value={zipName}
                onChange={e => setZipName(e.target.value)}
                placeholder="export_2025-01-01-12-00-00.zip"
                onKeyDown={e => e.key === 'Enter' && handleCreateZip()}
                disabled={zipLoading}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnStyle2} onClick={() => setShowZipModal(false)} disabled={zipLoading}>Cancelar</button>
              <button style={{ ...btnStyle, background: '#8e44ad' }} onClick={handleCreateZip} disabled={zipLoading}>
                {zipLoading ? '⏳ Generando...' : '📦 Crear y descargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de EDITOR (texto editable) */}
      {editorItem && (
        <div style={modalOverlayStyle} onClick={closeEditor}>
          <div style={{ ...modalContentStyle, maxWidth: 900, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18 }}>✏️ Editor — {editorItem}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {editorEncoding} {editorModified && <span style={{ color: '#e74c3c', marginLeft: 8 }}>● Modificado</span>}
                </span>
                <button style={{ ...btnStyle, background: editorModified ? '#27ae60' : '#0f3460', fontSize: 13, padding: '8px 14px' }} onClick={saveFile} disabled={editorSaving || !editorModified}>
                  {editorSaving ? '💾 Guardando...' : '💾 Guardar'}
                </button>
                <button style={btnStyle2} onClick={closeEditor}>✕</button>
              </div>
            </div>

            {editorLoading ? (
              <p>Cargando...</p>
            ) : (
              <textarea
                style={{
                  width: '100%',
                  minHeight: '60vh',
                  background: '#1a1a2e',
                  color: '#eee',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: 12,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  outline: 'none'
                }}
                value={editorContent}
                onChange={e => { setEditorContent(e.target.value); setEditorModified(true); }}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}

      <footer style={{ marginTop: 24, textAlign: 'center', color: '#888', fontSize: 12 }}>
        FileManager · /var/www
      </footer>
    </div>
  );
}

function PathNavigator({ path, setPath, setSearchQuery, setSelected, onRefresh, onOpenFilePath }) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const displayPath = path === '.' ? '' : path;
  const fullDisplay = `/var/www/${displayPath}`;

  const enterEditMode = () => {
    setEditMode(true);
    setEditValue(displayPath);
  };

  const commitPath = () => {
    const trimmed = editValue.trim();
    if (trimmed === '') {
      setPath('.');
      setSearchQuery('');
      setSelected(new Set());
      setEditMode(false);
      return;
    }

    const base = '/var/www/';
    let relative;
    if (trimmed.startsWith(base) || trimmed === '/var/www') {
      relative = trimmed === '/var/www' ? '' : trimmed.slice(base.length).replace(/^\/+|\/+$/g, '');
    } else {
      relative = trimmed.replace(/^\/+|\/+$/g, '');
    }

    if (relative === '') {
      setPath('.');
    } else {
      onOpenFilePath(relative);
    }
    setSearchQuery('');
    setSelected(new Set());
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditValue('');
  };

  useEffect(() => {
    if (editMode && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editMode]);

  const goUp = () => {
    if (path === '.' || path === '') return;
    const idx = path.lastIndexOf('/');
    setPath(idx <= 0 ? '.' : path.substring(0, idx));
    setSearchQuery('');
    setSelected(new Set());
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <button style={btnStyle2} onClick={goUp} disabled={path === '.'}>⬅️ Subir</button>
      {editMode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <span style={{ fontFamily: 'monospace', color: '#888', fontSize: 14, whiteSpace: 'nowrap' }}>/var/www/</span>
          <input
            ref={inputRef}
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 14 }}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitPath();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={commitPath}
          />
        </div>
      ) : (
        <div
          style={{ fontFamily: 'monospace', background: '#16213e', padding: '8px 14px', borderRadius: 6, flex: 1, minWidth: 200, cursor: 'pointer', fontSize: 14 }}
          onClick={enterEditMode}
          title="Click para editar la ruta"
        >
          {fullDisplay}
        </div>
      )}
      <button style={btnStyle2} onClick={onRefresh} title="Recargar directorio">🔄</button>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #333', padding: '8px 0' }}>
      <span style={{ width: 140, color: '#888', fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{value || '-'}</span>
    </div>
  );
}

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14
};

const btnStyle2 = {
  background: '#1a1a2e',
  color: '#fff',
  border: '1px solid #333',
  padding: '6px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13
};

const thStyle = { padding: '12px 14px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 };
const tdStyle = { padding: '10px 14px', fontSize: 14 };
const inputStyle = { background: '#1a1a2e', color: '#fff', border: '1px solid #333', padding: '8px 10px', borderRadius: 4, outline: 'none' };

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20
};

const modalContentStyle = {
  background: '#16213e',
  borderRadius: 10,
  padding: 24,
  maxWidth: 600,
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
};

const dropdownStyle = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 4px)',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 6,
  minWidth: 160,
  zIndex: 100,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  overflow: 'hidden'
};

const dropdownItemStyle = {
  padding: '10px 14px',
  fontSize: 13,
  cursor: 'pointer',
  borderBottom: '1px solid #222',
  whiteSpace: 'nowrap'
};

// Inyectar CSS responsive para mostrar/ocultar acciones según pantalla
const responsiveCSS = `
  @media (max-width: 768px) {
    .desktop-actions { display: none !important; }
    .mobile-actions { display: block !important; }
    th:nth-child(3), td:nth-child(3),
    th:nth-child(4), td:nth-child(4) { display: none; }
  }
  @media (min-width: 769px) {
    .desktop-actions { display: flex !important; }
    .mobile-actions { display: none !important; }
  }
  /* Scroll horizontal en la tabla cuando el contenido es muy ancho */
  .fm-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .fm-table-wrapper table {
    min-width: 700px;
  }
`;

// Inyectar el CSS en el head si no existe
if (typeof document !== 'undefined' && !document.getElementById('fm-responsive-styles')) {
  const style = document.createElement('style');
  style.id = 'fm-responsive-styles';
  style.textContent = responsiveCSS;
  document.head.appendChild(style);
}
