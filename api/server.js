const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3003;
const BASE_DIR = '/var/www';

// Tokens temporales para preview de Office (sin auth)
const previewTokens = new Map();
const PREVIEW_TOKEN_TTL = 5 * 60 * 1000; // 5 minutos

function generatePreviewToken(filePath) {
  const token = crypto.randomBytes(32).toString('hex');
  previewTokens.set(token, { path: filePath, expires: Date.now() + PREVIEW_TOKEN_TTL });
  return token;
}

function validatePreviewToken(token) {
  const data = previewTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) {
    previewTokens.delete(token);
    return null;
  }
  previewTokens.delete(token); // single-use
  return data.path;
}

// Cleanup de tokens expirados cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of previewTokens) {
    if (now > data.expires) previewTokens.delete(token);
  }
}, PREVIEW_TOKEN_TTL);

// Middleware
app.use(cors());
app.use(express.json());

// Auth básico (nginx manejará esto, pero lo dejamos como fallback)
// Excluir /api/preview/ para permitir tokens de vista previa de Office
app.use((req, res, next) => {
  if (req.path.startsWith('/api/preview/')) {
    return next();
  }
  basicAuth({
    users: { 'admin': 'secure.pass.2025' },
    challenge: true,
    realm: 'FileManager'
  })(req, res, next);
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Helper: validar que la ruta esté dentro de /var/www
function resolveSafePath(relativePath) {
  const target = path.resolve(BASE_DIR, relativePath || '.');
  const base = path.resolve(BASE_DIR);
  if (!target.startsWith(base)) {
    throw new Error('Ruta no permitida');
  }
  return target;
}

// Helper: obtener detalles de un archivo/carpeta
function getItemDetails(fullPath, baseDir) {
  const stat = fs.statSync(fullPath);
  return {
    fullPath: fullPath,
    relativePath: path.relative(baseDir, fullPath),
    size: stat.isFile() ? stat.size : null,
    modified: stat.mtime,
    created: stat.birthtime,
    accessed: stat.atime,
    mode: stat.mode.toString(8),
    uid: stat.uid,
    gid: stat.gid,
    isDirectory: stat.isDirectory(),
    isFile: stat.isFile(),
    isSymbolicLink: stat.isSymbolicLink()
  };
}

// LISTAR archivos y carpetas
app.get('/api/files', (req, res) => {
  try {
    const dirPath = resolveSafePath(req.query.path || '.');
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directorio no encontrado' });
    }
    const items = fs.readdirSync(dirPath, { withFileTypes: true }).map(item => {
      const itemPath = path.join(dirPath, item.name);
      const stat = fs.statSync(itemPath);
      return {
        name: item.name,
        isDirectory: item.isDirectory(),
        size: item.isFile() ? stat.size : null,
        modified: stat.mtime,
        created: stat.birthtime,
        accessed: stat.atime,
        mode: stat.mode.toString(8),
        uid: stat.uid,
        gid: stat.gid
      };
    });
    res.json({ path: req.query.path || '.', items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DETALLES de un archivo o carpeta específico
app.get('/api/details', (req, res) => {
  try {
    const targetPath = resolveSafePath(req.query.path || '.');
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    const details = getItemDetails(targetPath, BASE_DIR);
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dest = resolveSafePath(req.body.path || '.');
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// SUBIR archivo
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo' });
  }
  res.json({ message: 'Archivo subido', file: req.file.originalname, path: req.body.path || '.' });
});

// SUBIR múltiples archivos
app.post('/api/upload-multiple', upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se enviaron archivos' });
  }
  res.json({
    message: `${req.files.length} archivo(s) subido(s)`,
    files: req.files.map(f => f.originalname),
    path: req.body.path || '.'
  });
});

// CREAR carpeta
app.post('/api/mkdir', (req, res) => {
  try {
    const dirPath = resolveSafePath(req.body.path);
    if (fs.existsSync(dirPath)) {
      return res.status(400).json({ error: 'La carpeta ya existe' });
    }
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ message: 'Carpeta creada', path: req.body.path });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ELIMINAR archivo o carpeta
app.delete('/api/delete', (req, res) => {
  try {
    const targetPath = resolveSafePath(req.query.path);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    res.json({ message: 'Eliminado correctamente' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// RENAME
app.post('/api/rename', (req, res) => {
  try {
    const oldPath = resolveSafePath(req.body.oldPath);
    const newPath = resolveSafePath(req.body.newPath);
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'Origen no encontrado' });
    }
    fs.renameSync(oldPath, newPath);
    res.json({ message: 'Renombrado correctamente' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PREVIEW TOKEN para Office (sin auth)
app.get('/api/preview-token', (req, res) => {
  try {
    const filePath = resolveSafePath(req.query.path);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const token = generatePreviewToken(filePath);
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${proto}://${host}/api/preview/${token}`;
    res.json({ token, url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SERVIR archivo con token (sin auth)
app.get('/api/preview/:token', (req, res) => {
  try {
    const filePath = validatePreviewToken(req.params.token);
    if (!filePath) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    res.sendFile(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DESCARGAR archivo
app.get('/api/download', (req, res) => {
  try {
    const filePath = resolveSafePath(req.query.path);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    res.download(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LEER contenido de archivo de texto
app.get('/api/read', (req, res) => {
  try {
    const filePath = resolveSafePath(req.query.path);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const content = fs.readFileSync(filePath);
    // Detectar codificación
    let encoding = 'utf-8';
    let text = content.toString('utf-8');
    // BOM UTF-8
    if (content.length >= 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
      encoding = 'utf-8-bom';
      text = content.toString('utf-8', 3);
    }
    // BOM UTF-16 LE
    else if (content.length >= 2 && content[0] === 0xFF && content[1] === 0xFE) {
      encoding = 'utf-16le';
      text = content.toString('utf-16le', 2);
    }
    // BOM UTF-16 BE
    else if (content.length >= 2 && content[0] === 0xFE && content[1] === 0xFF) {
      encoding = 'utf-16be';
      text = content.toString('utf-16be', 2);
    }
    // Latin1 fallback si UTF-8 falla
    else {
      const isValidUtf8 = Buffer.compare(Buffer.from(text, 'utf-8'), content) === 0;
      if (!isValidUtf8) {
        encoding = 'latin1';
        text = content.toString('latin1');
      }
    }
    res.json({ content: text, encoding });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GUARDAR contenido de archivo de texto
app.post('/api/save', (req, res) => {
  try {
    const filePath = resolveSafePath(req.body.path);
    const content = req.body.content || '';
    const encoding = req.body.encoding || 'utf-8';
    let buffer;
    if (encoding === 'utf-8-bom') {
      buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(content, 'utf-8')]);
    } else if (encoding === 'utf-16le') {
      buffer = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(content, 'utf-16le')]);
    } else if (encoding === 'utf-16be') {
      buffer = Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.from(content, 'utf-16be')]);
    } else {
      buffer = Buffer.from(content, 'utf-8');
    }
    fs.writeFileSync(filePath, buffer);
    res.json({ message: 'Archivo guardado', path: req.body.path });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`FileManager API corriendo en puerto ${PORT}`);
});
