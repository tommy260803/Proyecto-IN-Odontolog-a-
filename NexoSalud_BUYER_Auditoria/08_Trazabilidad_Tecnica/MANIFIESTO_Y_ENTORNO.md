# MANIFIESTO DE ENTREGA Y GUÍA DE REPRODUCCIÓN TÉCNICA

**Paquete:** `NexoSalud_BUYER_Auditoria_Integral.zip`  
**Fase Auditada:** BUYER (NexoSalud - Metodología IMPULSE)  
**Fecha:** 26 de Octubre de 2026  

---

## 1. CONTROL DE VERSIONES Y TRAZABILIDAD GIT

- **Repositorio:** `https://github.com/tommy260803/Proyecto-IN-Odontolog-a-.git`
- **Rama Base:** `main`
- **Commit de Origen en main:** `44f07012f1e8f475444f5fec5c91fee3d94728f2` (*feat(mart): declarar PRIMARY KEY compuesta del grano en las 5 tablas de hechos*)
- **Rama Creada y Auditada:** `refactor/buyer-impulse-integral`
- **Estado de Tracking Remoto:** Publicada exitosamente en `origin/refactor/buyer-impulse-integral`.
- **Integridad del Árbol Local:** Todos los cambios preexistentes en el árbol de trabajo se conservaron intactos sin descarte ni sobrescritura.

---

## 2. INVENTARIO DE TECNOLOGÍAS Y VERSIONES VERIFICADAS

| Componente | Tecnología | Versión Verificada en Entorno | Finalidad |
|---|---|---|---|
| **Runtime Backend** | Node.js | `v22.11.0` | Ejecución del servidor API y scripts |
| **Framework Web** | Express | `^5.2.1` | Ruteo y controladores HTTP |
| **ORM / Data Access** | Prisma Client | `^5.22.0` | Acceso tipado a `NexoSaludDB` |
| **Driver BD Relacional** | mssql / msnodesqlv8 | `^12.7.2` / `^5.6.0` | Conexión directa a SQL Server y Data Mart |
| **Frontend Framework** | React + TypeScript | `^18.x` / `TypeScript ^5.x` | Consola SPA y vistas operativas |
| **Bundler / DevServer** | Vite | `^5.x` | Compilación y servidor frontend |
| **Estilos / UI** | Tailwind CSS + Lucide | `^3.4` / `^0.4` | Diseño visual y componentes de interfaz |
| **Motor de Base de Datos** | Microsoft SQL Server | `127.0.0.1:1433` (Verificado) | Instancia transaccional (`NexoSaludDB`) y analítica (`NexoSalud_Mart`) |
| **Proveedor IA** | Groq Cloud API | REST API / OpenAI Compatible | Inferencia LLM para Agente de Marketing |

---

## 3. VARIABLES DE ENTORNO DOCUMENTADAS (MOCK / SIN SECRETOS)

### Backend (`backend/.env.example`)
```env
PORT=3001
# Conexión OLTP (SQL Server)
SQLSERVER_URL="sqlserver://127.0.0.1:1433;database=NexoSaludDB;user=nexouser;password=PasswordFicticioSeguro123!;trustServerCertificate=true;"

DB_USER=nexouser
DB_PASSWORD=PasswordFicticioSeguro123!
DB_SERVER=127.0.0.1
DB_PORT=1433
OLTP_DATABASE=NexoSaludDB
MART_DATABASE=NexoSalud_Mart

# Proveedor de Inteligencia Artificial (Backend Server-Side)
GROQ_API_KEY=gsk_mock_api_key_ficticia_para_auditoria_segura
GROQ_PRIMARY_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=llama-3.1-8b-instant
```

### Frontend (`.env.example`)
```env
VITE_USE_API=true
VITE_API_URL=http://localhost:3001/api
# NOTA DE SEGURIDAD: VITE_GROQ_API_KEY se elimina del cliente en el rediseño objetivo
```

---

## 4. COMANDOS PARA REPRODUCIR EL ENTORNO DE EVALUACIÓN

### Inspección de Bases de Datos Transaccional y Mart
```powershell
# Desde el directorio backend:
cd backend
npm install
npx tsx src/scripts/inspect-dbs.ts
npx tsx src/scripts/check-after-etl.ts
```

### Ejecución del Servidor Backend
```powershell
cd backend
npm run dev
# El servidor levantará en http://localhost:3001
```

### Ejecución de la Consola Frontend
```powershell
# Desde la raíz del repositorio:
npm install
npm run dev
# La aplicación abrirá en http://localhost:5173
```

---

## 5. MANIFIESTO DE ARCHIVOS INCLUIDOS Y EXCLUIDOS EN EL ZIP

### Estructura de Carpetas Incluida en el Paquete:
```
NexoSalud_BUYER_Auditoria_Integral.zip
├── 01_Estado_Actual/
│   ├── buyer.routes.ts
│   ├── report.routes.ts
│   ├── db.ts
│   ├── mart.ts
│   ├── groqService.ts
│   ├── indicators_index.ts
│   ├── backend_package.json
│   ├── frontend_package.json
│   └── frontend_buyer/ (Componentes, Hooks, Páginas, Schemas)
├── 02_Bases_de_Datos/
│   ├── init_oltp.sql
│   ├── init_mart.sql
│   ├── etl_populate_mart.sql
│   ├── schema.prisma
│   └── diagnostico_calidad_datos.json
├── 03_Informe_Oficial/
│   ├── INforme_nexosalud_original.docx
│   ├── INFORME_NEXOSALUD_EXTRACTO.txt
│   ├── MATRIZ_DISCREPANCIAS_DOCUMENTALES.md
│   └── MATRIZ_CAMBIOS_DOCUMENTALES_PROPUESTOS.md
├── 04_Auditoria/
│   ├── INFORME_TECNICO_INTEGRAL_BUYER.md
│   ├── MATRIZ_HALLAZGOS_BUYER.md
│   └── MATRIZ_TRAZABILIDAD.md
├── 05_Agente_IA/
│   └── AUDITORIA_Y_REDISENO_AGENTE_MARKETING.md
├── 06_Rediseno_Propuesto/
│   ├── ARQUITECTURA_OBJETIVO_BUYER.md
│   ├── ddl_propuesto_oltp_buyer.sql
│   ├── ddl_propuesto_mart_buyer.sql
│   └── etl_propuesto_captacion_buyer.sql
├── 07_Plan_Implementacion/
│   └── PLAN_IMPLEMENTACION_SECUENCIAL.md
└── 08_Trazabilidad_Tecnica/
    └── MANIFIESTO_Y_ENTORNO.md
```

### Elementos Estrictamente Excluidos del ZIP:
1. Directorios `node_modules` de frontend y backend.
2. Archivos ejecutables compilados o regenerables (`dist/`, `.vite/`, `build/`).
3. Directorio `.git` completo (se preserva la trazabilidad mediante hash y metadatos de commit).
4. Archivos `.env` con credenciales reales o secretos de API.
5. Datos personales reales identificables (DNI, nombres de pacientes reales no autorizados).
6. Archivos de caché (`__pycache__`, temporales del sistema operativo).
