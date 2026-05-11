# AGENTS.md — FileManager

## Contexto

Este es un gestor de archivos web para el entorno de testing. Permite operar sobre cualquier directorio dentro de `/var/www/`.

## Credenciales de acceso

- Usuario: `admin`
- Contraseña: `secure.pass.2025`
- Mecanismo: Autenticación básica HTTP gestionada por nginx (`auth_basic`)
- Archivo de contraseñas: `.htpasswd` en la raíz del proyecto

## Stack

- **Backend:** Node.js 20 + Express + Multer (subida de archivos)
- **Frontend:** React 18 (CRA) + Axios
- **Proxy/Servidor:** Nginx

## Puerto y dominio

- API interno: `http://localhost:3001`
- Dominio público: `filemanager.testing.vulpik.com`
- Nginx hace proxy de `/api/*` al backend en `:3001`
- El resto de rutas sirven el build estático de React

## Seguridad

- El backend valida que todas las rutas resueltas estén dentro de `/var/www`
- No se permite salir del directorio base mediante `../` u otros trucos
- La autenticación básica cubre todo el sitio

## Scripts útiles

```bash
# Iniciar backend
cd api && npm start

# Reconstruir frontend
cd frontend && npm run build

# Recargar nginx
sudo nginx -t && sudo systemctl reload nginx
```
