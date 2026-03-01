# Guía de Migración PostgreSQL - XML Cleaner Web

Sigue estos pasos en tu servidor Debian para preparar la base de datos.

## 1. Crear Base de Datos y Usuario

Accede a postgres:
```bash
sudo -u postgres psql
```

Ejecuta los siguientes comandos SQL:

```sql
-- Crear la base de datos
CREATE DATABASE xml_cleaner_db;

-- Crear el usuario con una contraseña segura
CREATE USER xml_cleaner_user WITH ENCRYPTED PASSWORD 'R3n4t42017#';

-- Asignar privilegios
GRANT ALL PRIVILEGES ON DATABASE xml_cleaner_db TO xml_cleaner_user;

-- Conectarse a la nueva base de datos
\c xml_cleaner_db;
```

## 2. Crear Tablas Iniciales

```sql
-- Tabla de Usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rfc VARCHAR(13),
    curp VARCHAR(18),
    security_answer_rfc VARCHAR(100),
    security_answer_curp VARCHAR(100),
    credits INT DEFAULT 5,
    plan VARCHAR(50) DEFAULT 'Free Starter',
    is_admin BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Suscripciones
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    status VARCHAR(50),
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Procesos
CREATE TABLE processes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    filename VARCHAR(255),
    status VARCHAR(50),
    warnings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permisos sobre las tablas para el usuario
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO xml_cleaner_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO xml_cleaner_user;

-- 3. Actualizar Base de Datos Existente (Si ya habías corrido la migración antes)
-- Si recibes el error "no existe la columna is_admin", corre esto:
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);

-- 4. Crear Administrador Inicial
-- Una vez que te hayas registrado en la web, corre este comando:
-- UPDATE users SET is_admin = TRUE WHERE email = 'dev.daniel.alcazar@gmail.com';
```

## 3. Configuración en el Servicio

Actualiza tu archivo `.env` con las credenciales:

```env
DATABASE_URL="postgresql://xml_cleaner_user:R3n4t42017#@localhost:5432/xml_cleaner_db"
```
