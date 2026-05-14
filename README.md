# Gimnasio Aluna

Plataforma de gestión educativa para el Gimnasio Aluna. Combina un sitio web público con portales autenticados por rol para administradores, profesores y estudiantes.

## Tecnologías

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **UI:** React 19
- **Estilos:** SCSS Modules
- **Base de datos y autenticación:** Supabase (PostgreSQL)

## Instalación

```bash
npm install
```

Crea un archivo `.env.local` con las siguientes variables:

```
NEXT_PUBLIC_SUPABASE_URL=<url-del-proyecto-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<llave-publica-anon>
SUPABASE_SERVICE_ROLE_KEY=<llave-service-role>
```

## Comandos

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Compilar para producción
npm run start     # Iniciar en producción
npm run lint      # Ejecutar ESLint con corrección automática
```

## Estructura del proyecto

```
src/
├── app/                        # Rutas (App Router de Next.js)
│   ├── login/                  # Inicio de sesión
│   ├── asi-lo-vivimos/         # Páginas informativas del colegio
│   ├── impresion/              # Vistas de boletines para impresión
│   │   ├── preescolar/
│   │   ├── primaria/
│   │   └── bachillerato/
│   └── plataformas/            # Portales autenticados
│       ├── admin/              # Gestión de estudiantes, profesores, cursos, materias, circulares y boletines
│       ├── estudiantes/        # Portal del estudiante (boletines y circulares)
│       └── profesores/         # Portal del profesor (calificaciones y planillas)
├── components/                 # Componentes reutilizables
├── utils/supabase/             # Clientes de Supabase (browser y server)
└── styles/                     # Hojas de estilo SCSS por componente/página
```

## Roles y autenticación

La plataforma maneja tres roles: **administrador**, **profesor** y **estudiante**. La autenticación se realiza mediante Supabase Auth con sesiones basadas en cookies (SSR). El middleware protege las rutas `/plataformas/*` y `/impresion/*`, redirigiendo según el rol del usuario.

## Funcionalidades principales

- **Gestión de estudiantes y profesores:** Creación individual e importación masiva desde Excel.
- **Boletines:** Generación e impresión de informes de desempeño por periodo para preescolar, primaria y bachillerato.
- **Circulares:** Carga y distribución de documentos PDF por nivel.
- **Calificaciones:** Planillas de ingreso de notas y competencias por asignatura.
- **Cursos y materias:** Administración de la estructura académica.
