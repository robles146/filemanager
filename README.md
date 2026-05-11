# 📁 FileManager

Un gestor de archivos web completo con backend Node.js/Express y frontend React. Permite explorar, subir, descargar, renombrar, eliminar, buscar y **previsualizar** archivos directamente en el navegador.

![FileManager Screenshot](https://via.placeholder.com/800x400/16213e/ffffff?text=FileManager)

## ✨ Características

### Gestión de archivos
- 📂 Navegación de carpetas con breadcrumb
- ⬆️ Subida de archivos individuales y múltiples
- 📁 Creación de carpetas
- ✏️ Renombrar archivos y carpetas
- 🗑️ Eliminar archivos/carpetas (individual o selección múltiple)
- ⬇️ Descarga de archivos
- 🔍 Búsqueda por nombre en tiempo real
- 📋 Panel de detalles con metadatos completos (tamaño, permisos, fechas, owner)

### Vista previa integrada
| Tipo | Extensiones | Tecnología |
|------|------------|------------|
| 🖼️ Imágenes | jpg, jpeg, png, gif, bmp, webp, svg | `<img>` nativo |
| 📄 PDF | pdf | [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) |
| 📊 Office | doc, docx, xls, xlsx, ppt, pptx | Microsoft Office Online Viewer |
| 📈 CSV | csv | PapaParse + tabla HTML |
| 🎵 Audio | mp3, wav, ogg, flac, aac, m4a, wma, opus | `<audio>` HTML5 |
| 🎬 Video | mp4, webm, ogv, mov, mkv, avi | `<video>` HTML5 |
| ✏️ Texto | txt, md, json, js, html, css, php, py, sql, yaml, etc. | Editor con detección de encoding |

### Editor de texto
- Detección automática de encoding (UTF-8, UTF-16 LE/BE, Latin1)
- Guardado preservando el encoding original
- Indicador de cambios sin guardar

### Seguridad
- 🔒 Autenticación básica (nginx + Express fallback)
- 🛡️ Sandbox de rutas: solo permite operar dentro de `/var/www`
- 🔑 Tokens temporales de un solo uso para preview de Office (5 min, expiran al usar)

## 🏗️ Arquitectura

```
filemanager/
├── api/                    # Backend Node.js/Express
│   ├── server.js           # API endpoints
│   └── package.json
├── frontend/               # React 18 (CRA)
│   ├── src/
│   │   ├── App.js          # Componente principal
│   │   ├── PdfViewer.js    # Visor de PDFs (PDF.js)
│   │   ├── OfficeViewer.js # Visor de Office (Microsoft Online)
│   │   ├── CsvViewer.js    # Visor de CSVs (PapaParse)
│   │   ├── MediaViewer.js  # Reproductor audio/video
│   │   └── index.js
│   ├── public/             # Assets estáticos (worker PDF.js, cmaps, fuentes)
│   └── package.json
├── public/                 # Build de producción (sirve nginx)
├── nginx.conf              # Configuración de referencia para nginx
└── .htpasswd               # Credenciales de auth básica
```

## 🚀 Instalación

### Requisitos
- Node.js 18+
- npm
- nginx (para producción con SSL)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/robles146/filemanager.git
cd filemanager

# Backend
cd api && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configurar nginx

Copiar la configuración de ejemplo y ajustar a tu dominio:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/filemanager
# Editar dominio, rutas SSL, etc.
sudo ln -s /etc/nginx/sites-available/filemanager /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

### 3. Configurar autenticación

```bash
# Generar archivo .htpasswd
htpasswd -cb .htpasswd admin tu_password_segura
```

### 4. Permisos (importante)

El backend necesita permisos de lectura/escritura en `/var/www`:

```bash
# Crear grupo compartido
sudo groupadd filemanager
sudo usermod -aG filemanager $USER
sudo usermod -aG filemanager www-data

# Setear permisos
sudo chown -R root:filemanager /var/www
sudo chmod -R g+w /var/www

# Ejecutar backend con el grupo correcto
sg filemanager -c "node api/server.js"
```

### 5. Construir frontend

```bash
cd frontend
npm run build
cp -r build/* ../public/
```

### 6. Iniciar backend

```bash
cd api
# Desarrollo
node server.js

# Producción (con PM2 recomendado)
pm install -g pm2
pm2 start server.js --name filemanager
```

## 🔌 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/files?path=` | Listar contenido de directorio |
| GET | `/api/details?path=` | Obtener metadatos de archivo/carpeta |
| GET | `/api/read?path=` | Leer contenido de archivo de texto |
| GET | `/api/download?path=` | Descargar archivo |
| GET | `/api/preview-token?path=` | Generar token temporal para preview |
| GET | `/api/preview/:token` | Acceder a archivo con token (sin auth) |
| POST | `/api/upload` | Subir archivo individual |
| POST | `/api/upload-multiple` | Subir múltiples archivos |
| POST | `/api/mkdir` | Crear carpeta |
| POST | `/api/rename` | Renombrar archivo/carpeta |
| POST | `/api/save` | Guardar contenido de archivo de texto |
| DELETE | `/api/delete?path=` | Eliminar archivo/carpeta |

## ⚙️ Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3003` | Puerto del servidor Express |

## 🛠️ Tecnologías

- **Backend**: Node.js, Express, Multer, express-basic-auth
- **Frontend**: React 18, Axios, PapaParse, PDF.js
- **Servidor**: nginx, Let's Encrypt SSL
- **OS**: Ubuntu 24.04 LTS

## 📝 Licencia

MIT

## 👤 Autor

Creado para el servidor Vulpik.
