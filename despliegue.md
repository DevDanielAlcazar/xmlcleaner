# Guía de Despliegue - XML Cleaner Web

Esta guía detalla cómo desplegar la aplicación en tu servidor Debian y cómo gestionar actualizaciones futuras mediante GitHub.

## 1. Preparación del Servidor

Asegúrate de tener instalado Node.js (v18+) y Git:

```bash
# Instalar Node.js (si no lo tienes)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

## 2. Despliegue Inicial (vía GitHub)

### En tu equipo de desarrollo:
1. Crea un repositorio en GitHub.
2. Sube el código:
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/TU_USUARIO/xml-cleaner-web.git
git push -u origin main
```

### En tu servidor Debian:
1. Clona el repositorio:
```bash
git clone https://github.com/TU_USUARIO/xml-cleaner-web.git
cd xml-cleaner-web
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea el archivo `.env` real:
```bash
nano .env
```
Pega el siguiente contenido (ajusta con tus valores):
```env
PORT=3001
NODE_ENV=production
APP_URL=https://xmlclean.consafedev.qzz.io
DATABASE_URL="postgresql://xml_cleaner_user:R3n4t42017#@localhost:5432/xml_cleaner_db"
STRIPE_SECRET_KEY="sk_live_..."
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

4. Construye la aplicación:
```bash
npm run build
```

5. Inicia el servidor (se recomienda usar PM2 para que corra en segundo plano):
```bash
sudo npm install -g pm2
pm2 start server.ts --name "xml-cleaner" --interpreter tsx
pm2 save
pm2 startup
```

## 3. Cómo hacer un Re-despliegue (Actualizaciones)

Cada vez que hagas cambios en el código y quieras verlos en el servidor:

1. **En tu equipo de desarrollo**:
```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

2. **En tu servidor Debian**:
```bash
cd xml-cleaner-web
git pull origin main
npm install          # Solo si agregaste nuevas librerías
npm run build        # Reconstruye el frontend
pm2 restart xml-cleaner
```

## 4. Configuración de Cloudflare Tunnel

Para exponer tu aplicación de forma segura bajo el dominio `xmlclean.consafedev.qzz.io`:

1. **Instalar cloudflared** (si no lo tienes):
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

2. **Autenticar cloudflared**:
```bash
cloudflared tunnel login
```

3. **Crear el túnel**:
```bash
cloudflared tunnel create xml-cleaner-tunnel
```

4. **Configurar el DNS**:
```bash
cloudflared tunnel route dns xml-cleaner-tunnel xmlclean.consafedev.qzz.io
```

5. **Configurar el túnel localmente**:
Crea un archivo de configuración (ej. `~/.cloudflared/config.yml`):
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/daniel/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: xmlclean.consafedev.qzz.io
    service: http://localhost:3001
  - service: http_status:404
```

6. **Ejecutar el túnel como servicio**:
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## 5. Notas Importantes
- **Puerto**: La app corre en el puerto 3001 por defecto (para evitar conflictos con el puerto 3000).
- **Acceso Externo**: Configurado vía Cloudflare Tunnel en `https://xmlclean.consafedev.qzz.io`.
- **Base de Datos**: La app se conectará a `localhost:5432` dentro del servidor.
