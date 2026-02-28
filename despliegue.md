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
APP_URL=http://10.18.170.44:3001
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

## 4. Notas Importantes
- **Puerto**: La app corre en el puerto 3001 por defecto (para evitar conflictos con el puerto 3000).
- **Acceso Externo**: Si quieres acceder desde fuera de tu red local, deberás configurar un proxy inverso (Nginx) o usar Cloudflare Tunnel.
- **Base de Datos**: La app se conectará a `localhost:5432` dentro del servidor.
