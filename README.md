# AutoMTA para Mac

<div align="center">
  <img src="docs/images/banner.png" alt="AutoMTA Mac" width="600" />
  
  <h3>Tus agentes de IA, nativos en tu Mac</h3>
  
  <p>
    Trae los agentes que configuraste en <a href="https://automta.au">AutoMTA</a> a tu Mac.
    Con Computer Use, Skills locales y activación por voz — todo desde la barra de menú.
  </p>

  <p>
    <a href="https://github.com/Snowballmx/automta-mac/releases/latest">
      <img src="https://img.shields.io/github/v/release/Snowballmx/automta-mac?style=for-the-badge&logo=apple&color=7c3aed" alt="Latest Release" />
    </a>
    <a href="https://github.com/Snowballmx/automta-mac/releases/latest">
      <img src="https://img.shields.io/badge/macOS-13%2B-black?style=for-the-badge&logo=apple" alt="macOS 13+" />
    </a>
    <a href="https://automta.au">
      <img src="https://img.shields.io/badge/AutoMTA-Platform-7c3aed?style=for-the-badge" alt="AutoMTA Platform" />
    </a>
  </p>

  <p>
    <a href="#-descarga">⬇️ Descargar DMG</a> ·
    <a href="#-funcionalidades">✨ Funcionalidades</a> ·
    <a href="#%EF%B8%8F-instalación">🛠️ Instalación</a> ·
    <a href="https://automta.au/docs">📖 Documentación</a>
  </p>
</div>

---

## ⬇️ Descarga

> **Requiere una cuenta de AutoMTA.** [Crear cuenta gratis →](https://automta.au/register)

| Versión | Chip | Descarga |
|---------|------|----------|
| Latest  | Apple Silicon (M1/M2/M3/M4) | [AutoMTA-arm64.dmg](https://github.com/Snowballmx/automta-mac/releases/latest/download/AutoMTA-arm64.dmg) |
| Latest  | Intel x64 | [AutoMTA-x64.dmg](https://github.com/Snowballmx/automta-mac/releases/latest/download/AutoMTA-x64.dmg) |

**Requisitos del sistema:**
- macOS 13 Ventura o superior
- Cuenta activa en [automta.au](https://automta.au)
- 200MB de espacio libre

---

## ✨ Funcionalidades

### 🤖 Agentes en tu Mac
Cualquier agente que hayas configurado en la plataforma AutoMTA puede ser "traído" a tu Mac. El agente trae consigo todas sus Skills, Bases de Conocimiento y herramientas configuradas.

### 🎙️ Activación por Voz — "Hey [NombreDelAgente]"
Di `"Hey Jarvis"`, `"Oye Jarvis"` o simplemente `"Jarvis"` para activar tu agente desde cualquier app, sin tocar el teclado. Funciona como Siri pero con el poder de tus agentes AutoMTA.

```
"Hey Jarvis, revisa mi base de conocimientos y crea un reporte"
"Oye Jarvis, ¿qué tengo en el calendario esta semana?"
"Hey Jarvis, resume mis correos no leídos"
"Jarvis, abre Safari y busca el precio de NVDA"
```

### 🛠️ Skills Activas del Agente
Todas las Skills configuradas en la plataforma web se activan en tu Mac:

| Skill | Descripción |
|-------|-------------|
| 📚 **Base de Conocimiento** | Documentos y datos del agente en AutoMTA |
| 🖥️ **Computer Use** | El agente controla tu Mac — clicks, typing, scroll |
| 📂 **Archivos Mac** | Lee y crea archivos en ~/Documents, ~/Desktop |
| 📅 **Calendar** | Ve y crea eventos en Calendar de Mac |
| 📧 **Mail** | Lee correos no leídos de Mail de Mac |
| 📋 **Clipboard** | Accede y copia al portapapeles |
| 🔍 **Spotlight Search** | Busca archivos con Spotlight de Mac |
| 🌐 **Web Search** | Busca en internet desde cualquier contexto |

### 🤖 Computer Use
El agente puede controlar tu Mac en tiempo real:
1. Toma un screenshot de tu pantalla
2. Analiza lo que ve (Claude Vision)
3. Propone acciones — tú apruebas o rechazas
4. Ejecuta: clicks, typing, scroll, drag & drop
5. Repite hasta completar la tarea

### ⚡ Quick Input — `⌘⇧Space`
Abre un panel Spotlight-style desde cualquier app. Escribe tu pregunta y el agente responde en segundos.

---

## 🖥️ Capturas de Pantalla

<div align="center">
  <img src="docs/images/screenshot-mini-panel.png" alt="Mini Panel" width="380" />
  <img src="docs/images/screenshot-skills.png" alt="Skills Panel" width="380" />
</div>
<div align="center">
  <img src="docs/images/screenshot-computer-use.png" alt="Computer Use" width="380" />
  <img src="docs/images/screenshot-quick-input.png" alt="Quick Input" width="380" />
</div>

---

## 🛠️ Instalación

### Instalación rápida (recomendada)

1. **Descarga el DMG** según tu chip (ver tabla arriba)
2. **Abre el DMG** y arrastra AutoMTA a `/Applications`
3. **Abre AutoMTA** desde Applications o Spotlight
4. En la primera apertura se te pedirán permisos:
   - **Accesibilidad** — para Computer Use (control de teclado/mouse)
   - **Grabación de Pantalla** — para Computer Use (ver la pantalla)
5. **Inicia sesión** con tu cuenta de AutoMTA
6. **Selecciona tus agentes** — elige cuáles traer a tu Mac

> ⚠️ Si macOS muestra "App no identificada", abre Configuración → Privacidad → abre de todas formas.
> La app está firmada pero aún no tiene certificado Apple notarizado en esta versión beta.

### Permisos requeridos

La app necesita permisos específicos que debes otorgar manualmente:

| Permiso | Para qué | Cómo otorgarlo |
|---------|----------|----------------|
| Accesibilidad | Computer Use — control de mouse/teclado | Configuración → Privacidad → Accesibilidad |
| Grabación de Pantalla | Computer Use — ver la pantalla | Configuración → Privacidad → Grabación de Pantalla |
| Micrófono | Activación por voz "Hey [agente]" | Configuración → Privacidad → Micrófono |

---

## 🏗️ Arquitectura

```
automta-mac/
├── electron/                    # Proceso principal de Electron
│   ├── main.ts                  # Entry point — ventana, tray, menú nativo
│   ├── preload.ts               # Bridge IPC seguro → renderer
│   ├── ipcHandlers.ts           # Handlers de comunicación bidireccional
│   ├── localBridge.ts           # Gateway a recursos locales del Mac
│   ├── computerUseNative.ts     # Control de mouse/teclado/pantalla
│   ├── contextDetector.ts       # App activa, URL del browser, texto sel.
│   ├── menuBarPanel.ts          # Ventana del menu bar (popover)
│   └── systemPermissions.ts    # Solicitud y verificación de permisos
│
├── src/                         # Proceso renderer (React)
│   ├── pages/mac/
│   │   ├── CompanionMiniApp.tsx # Panel principal del menu bar
│   │   ├── SkillsPanel.tsx      # Grid visual de Skills activas
│   │   ├── QuickInputOverlay.tsx # Spotlight-style ⌘⇧Space
│   │   └── FullCompanionWindow.tsx # Ventana expandida con tabs
│   ├── hooks/
│   │   ├── useAgentCompanion.ts # Estado y comunicación con el agente
│   │   ├── useVoiceActivation.ts # Wake word "Hey [agente]"
│   │   ├── useComputerUse.ts   # Sesiones de Computer Use
│   │   └── useElectron.ts      # Detección de contexto Electron
│   └── components/mac/
│       └── VoiceActivationIndicator.tsx # UI del estado de voz
│
├── assets/                      # Assets de la app
│   ├── icon.icns               # Ícono de la app (macOS)
│   ├── trayIcon.png            # Ícono del menu bar (18x18 @2x)
│   └── entitlements.mac.plist  # Permisos de sandboxing de macOS
│
└── .github/workflows/
    └── build-and-release.yml   # CI/CD — build y publish automático
```

### Flujo de datos

```
Usuario habla "Hey Jarvis, revisa mi calendario"
       ↓
useVoiceActivation (Web Speech API en renderer)
       ↓
Detecta wake word → captura comando completo
       ↓
sendMessage() → POST /api/companion/message (AutoMTA backend)
       ↓
Backend carga el agente con sus Skills/KB/Tools
       ↓
Claude analiza → necesita get_calendar_events
       ↓
{ needsLocalTool: true, toolCall: { name: 'get_calendar_events' } }
       ↓
Mac app: electronAPI.localBridge.executeTool('get_calendar_events', {})
       ↓
localBridge.ts ejecuta AppleScript → obtiene eventos del Calendar de Mac
       ↓
Resultado → POST /api/companion/message (con localToolResult)
       ↓
Claude genera respuesta final con los eventos
       ↓
Respuesta aparece en el panel + se lee en voz (opcional)
```

---

## 🔧 Desarrollo Local

### Prerrequisitos
- Node.js 18+
- npm 9+
- macOS 13+ (para probar Computer Use y permisos nativos)
- Cuenta de AutoMTA con acceso a la API

### Setup

```bash
# 1. Clonar el repo
git clone https://github.com/Snowballmx/automta-mac.git
cd automta-mac

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu API URL y API key de AutoMTA

# 4. Correr en modo desarrollo
npm run dev
# Abre Electron + Vite con hot reload
```

### Variables de entorno

Crea un archivo `.env` en la raíz:

```env
# URL de la plataforma AutoMTA
VITE_API_URL=https://api.automta.au/api
# o en desarrollo local:
VITE_API_URL=http://localhost:3001/api

# Tu API key de AutoMTA (Settings → API)
VITE_API_KEY=your-api-key-here
```

### Scripts disponibles

```bash
npm run dev           # Electron + Vite en modo desarrollo (hot reload)
npm run build         # Build de producción (Vite + TypeScript)
npm run dist:dmg      # Genera DMG para distribución
npm run dist          # Genera DMG + ZIP para ambas arquitecturas
```

---

## 📦 Build y Distribución

### Generar DMG manualmente

```bash
# Build completo
npm run dist

# El DMG se genera en:
# release/AutoMTA-1.0.0-arm64.dmg  (Apple Silicon)
# release/AutoMTA-1.0.0-x64.dmg    (Intel)
```

### Release automático con GitHub Actions

Cada push de un tag `v*` dispara el workflow de build:

```bash
# Crear un release
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions automáticamente:
# 1. Build para arm64 y x64
# 2. Firma el código (si tiene certificado configurado)
# 3. Sube los DMGs como GitHub Release assets
# 4. Usuarios con auto-updater reciben la notificación
```

Configura estos secretos en GitHub → Settings → Secrets:
- `APPLE_ID` — Tu Apple ID para notarización
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password de Apple
- `APPLE_TEAM_ID` — Team ID de Apple Developer

---

## 🔐 Seguridad y Privacidad

- **No almacenamos conversaciones** — Todo va directo a tu cuenta de AutoMTA
- **Los archivos locales** solo se acceden cuando el agente los solicita explícitamente y con tu aprobación
- **Computer Use** requiere aprobación manual por cada acción (modo automático es opt-in)
- **Wake word** — el audio se procesa localmente por la Web Speech API; solo el texto se envía al agente
- **API key** — se almacena localmente en el Keychain de macOS via electron-store

---

## 🤝 Contribuir

1. Fork el repo
2. Crea una branch: `git checkout -b feature/mi-feature`
3. Commit: `git commit -m 'feat: mi nueva feature'`
4. Push: `git push origin feature/mi-feature`
5. Abre un Pull Request

### Guía de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Documentación
- `chore:` Mantenimiento

---

## 📄 Licencia

Propietario — © 2025 AutoMTA. Ver [LICENSE](LICENSE) para detalles.

---

<div align="center">
  <p>Hecho con ☕ en México</p>
  <p>
    <a href="https://automta.au">automta.au</a> ·
    <a href="https://twitter.com/automta_au">Twitter</a> ·
    <a href="mailto:hola@automta.au">hola@automta.au</a>
  </p>
</div>
