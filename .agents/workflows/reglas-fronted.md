---
description: 
---

# 🚀 Prompt Cursor Frontend - PROCESOS JUDICIALES COLOMBIA (ANGULAR 19 - ZONELESS + DAISYUI)

## 🎯 CONTEXTO DEL PROYECTO

Eres un desarrollador senior experto en Angular 19+ con especialización en aplicaciones empresariales complejas. Desarrollarás el frontend para un sistema de **monitoreo automático de radicados judiciales** en Colombia.

**Flujo usuario:**
1. **AppUser (Abogado)** inicia sesión
2. **Registra radicados** de 23 dígitos con límites permitidos
3. **Ve actuaciones** en tiempo real desde Rama Judicial
4. **Recibe alertas** por "CONSULTA"/"APELACIÓN" y **doble instancia**
5. **Gestiona canales** de notificación (Email/WhatsApp/SMS)

Este es un sistema crítico que maneja información judicial sensible. **Auditoría completa, autenticación robusta, control de acceso basado en roles.**

---

## 📦 STACK TECNOLÓGICO (IDÉNTICO TRIBUNAL)

- **Framework:** Angular 19+ (Zoneless)
- **TypeScript:** 5.6+ (strict mode)
- **Estilos:** Tailwind CSS + SCSS
- **UI Theme:** DaisyUI (tema componentes pre-construidos)
- **Componentes:** Standalone (Sin NgModules)
- **Estado Reactivo:** Signals + Computed + Effects
- **Detección Cambios:** OnPush + Zoneless (sin zone.js)
- **Internacionalización:** Transloco (es/en) - **OBLIGATORIO**
- **HTTP Client:** HttpClient + Interceptores
- **UI Framework:** Fuse (personalizado con DaisyUI)
- **Formularios:** Reactive Forms
- **Validación:** Angular Validators + Custom
- **Autenticación:** Sanctum de Laravel (Bearer token)
- **2FA:** Step-Up para operaciones críticas (eliminar radicado)
- **Testing:** Karma + Jasmine
- **Gestor Paquetes:** pnpm
- **Bundler:** Vite (Angular CLI v19+)

---

## 🎨 SISTEMA DE COLORES DAISYUI

### Colores Primarios Marca

```
primary              - Color principal (azul tribunal)
primary-content      - Texto sobre primary

secondary            - Color secundario (opcional)
secondary-content    - Texto sobre secondary

accent               - Color énfasis (rojo para alertas)
accent-content       - Texto sobre accent
```

### Colores de Base (Fondo)

```
base-100             - Fondo principal página
base-200             - Fondo elevaciones (cards)
base-300             - Fondo más oscuro
base-content         - Texto sobre fondos base
```

### Colores Semánticos (CRÍTICOS JUDICIALES)

```
success              - Proceso completado/sincronizado
success-content      - Texto sobre success

warning              - Proceso pendiente/sin sincronizar
warning-content      - Texto sobre warning

error                - Alerta prioritaria (CONSULTA/APELACIÓN)
error-content        - Texto sobre error

info                 - Información general
info-content         - Texto sobre info

neutral              - Neutral
neutral-content      - Texto sobre neutral
```

### Clases CSS DaisyUI Disponibles

```html
<!-- Componentes -->
<button class="btn btn-primary">Botón Primario</button>
<button class="btn btn-error">Botón Alerta</button>
<button class="btn btn-warning">Botón Advertencia</button>

<!-- Colores Fondo -->
<div class="bg-primary">Fondo primario</div>
<div class="bg-error">Fondo alerta</div>
<div class="bg-base-100">Fondo base</div>

<!-- Colores Texto -->
<p class="text-primary">Texto primario</p>
<p class="text-error">Texto alerta</p>
<p class="text-warning">Texto advertencia</p>

<!-- Colores Borde -->
<div class="border border-primary">Borde primario</div>
<div class="border border-error">Borde alerta</div>

<!-- Badges Semánticos -->
<div class="badge badge-success">Sincronizado</div>
<div class="badge badge-warning">Pendiente</div>
<div class="badge badge-error">Alerta</div>
```

### Uso en Templates Angular

```html
<!-- ✅ CORRECTO - Usar DaisyUI -->
<button class="btn btn-primary">{{ 'radicado.register' | transloco }}</button>
<div class="alert alert-error">{{ 'radicado.alert' | transloco }}</div>
<div class="badge badge-error">CONSULTA</div>

<!-- ✅ CORRECTO - Mapeo dinámico -->
<div [class]="'badge ' + getAlertClass(actuacion.description)">
  {{ actuacion.description }}
</div>

<!-- ❌ EVITAR - Hardcodear colores -->
<button style="background: blue">Radicado</button>
```

---

## 📁 ESTRUCTURA DEL PROYECTO (IDÉNTICA TRIBUNAL)

```
procesos-judiciales-frontend/
│
├── 📁 public/
│   ├── i18n/
│   │   ├── en.json          # Inglés (menú, etiquetas)
│   │   └── es.json          # Español (principal)
│   ├── icons/
│   ├── images/
│   └── fonts/
│
├── 📁 src/
│   │
│   ├── 📁 @fuse/            # UI Framework Fuse + DaisyUI
│   │   ├── animations/
│   │   ├── components/
│   │   ├── directives/
│   │   ├── services/
│   │   └── styles/
│   │
│   ├── 📁 app/
│   │
│   │   ├── 📁 core/
│   │   │   ├── auth/
│   │   │   │   ├── auth.provider.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.utils.ts
│   │   │   │   └── sanctum.service.ts
│   │   │   │
│   │   │   ├── constants/
│   │   │   │   ├── api-endpoints.constant.ts
│   │   │   │   ├── roles.constant.ts
│   │   │   │   ├── process-status.constant.ts
│   │   │   │   ├── radicado-status.constant.ts
│   │   │   │   ├── actuacion-types.constant.ts
│   │   │   │   ├── alert-keywords.constant.ts
│   │   │   │   ├── validation.constant.ts
│   │   │   │   └── messages.constant.ts
│   │   │   │
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── two-factor.guard.ts
│   │   │   │
│   │   │   ├── interceptors/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── sanctum.interceptor.ts
│   │   │   │   │   └── two-factor.interceptor.ts
│   │   │   │   └── headers/
│   │   │   │       └── custom-headers.interceptor.ts
│   │   │   │
│   │   │   ├── models/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login-request.model.ts
│   │   │   │   │   ├── login-response.model.ts
│   │   │   │   │   ├── user.model.ts
│   │   │   │   │   └── sanctum-token.model.ts
│   │   │   │   │
│   │   │   │   ├── radicado/
│   │   │   │   │   ├── radicado.model.ts
│   │   │   │   │   ├── radicado-filter.model.ts
│   │   │   │   │   ├── radicado-status.model.ts
│   │   │   │   │   └── radicado-response.model.ts
│   │   │   │   │
│   │   │   │   ├── actuacion/
│   │   │   │   │   ├── actuacion.model.ts
│   │   │   │   │   ├── actuacion-alert.model.ts
│   │   │   │   │   └── actuacion-filter.model.ts
│   │   │   │   │
│   │   │   │   ├── organization/
│   │   │   │   │   ├── organization.model.ts
│   │   │   │   │   └── notification-channel.model.ts
│   │   │   │   │
│   │   │   │   └── common/
│   │   │   │       ├── api-response.model.ts
│   │   │   │       ├── error-response.model.ts
│   │   │   │       └── pagination.model.ts
│   │   │   │
│   │   │   ├── pipes/
│   │   │   │   ├── safe-resource-url.pipe.ts
│   │   │   │   ├── radicado-status.pipe.ts
│   │   │   │   ├── role-display.pipe.ts
│   │   │   │   └── alert-type.pipe.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── sanctum.service.ts
│   │   │   │   │   └── two-factor.service.ts
│   │   │   │   │
│   │   │   │   ├── radicado/
│   │   │   │   │   ├── radicado.service.ts
│   │   │   │   │   ├── radicado-filter.service.ts
│   │   │   │   │   └── radicado-export.service.ts
│   │   │   │   │
│   │   │   │   ├── actuacion/
│   │   │   │   │   ├── actuacion.service.ts
│   │   │   │   │   └── actuacion-alert.service.ts
│   │   │   │   │
│   │   │   │   ├── notification/
│   │   │   │   │   ├── notification.service.ts
│   │   │   │   │   └── notification-channel.service.ts
│   │   │   │   │
│   │   │   │   └── api/
│   │   │   │       ├── api.service.ts
│   │   │   │       └── http-client.wrapper.ts
│   │   │   │
│   │   │   ├── transloco/
│   │   │   │   ├── languages.constants.ts
│   │   │   │   └── transloco.http-loader.ts
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── date.utils.ts
│   │   │       ├── form.utils.ts
│   │   │       ├── permission.utils.ts
│   │   │       ├── file.utils.ts
│   │   │       ├── validator.utils.ts
│   │   │       └── radicado.utils.ts (validar 23 dígitos)
│   │   │
│   │   ├── 📁 layout/
│   │   │   ├── layout.component.*
│   │   │   ├── common/
│   │   │   │   ├── navbar/
│   │   │   │   ├── sidebar/
│   │   │   │   ├── user-menu/
│   │   │   │   └── alerts/
│   │   │   └── layouts/
│   │   │       ├── empty/
│   │   │       ├── authenticated/
│   │   │       └── error/
│   │   │
│   │   ├── 📁 modules/
│   │   │   ├── 📁 auth/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── sign-in/
│   │   │   │   │   ├── forgot-password/
│   │   │   │   │   └── two-factor/
│   │   │   │   └── auth.routes.ts
│   │   │   │
│   │   │   ├── 📁 radicado/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── list/
│   │   │   │   │   ├── detail/
│   │   │   │   │   ├── create/
│   │   │   │   │   └── edit/
│   │   │   │   ├── components/
│   │   │   │   │   ├── radicado-card/
│   │   │   │   │   ├── radicado-filter/
│   │   │   │   │   ├── radicado-form/
│   │   │   │   │   └── radicado-status-badge/
│   │   │   │   └── radicado.routes.ts
│   │   │   │
│   │   │   ├── 📁 actuacion/
│   │   │   │   ├── pages/
│   │   │   │   │   └── list/
│   │   │   │   ├── components/
│   │   │   │   │   ├── actuacion-item/
│   │   │   │   │   ├── actuacion-alert/
│   │   │   │   │   ├── actuacion-timeline/
│   │   │   │   │   └── alert-badge/
│   │   │   │   └── actuacion.routes.ts
│   │   │   │
│   │   │   ├── 📁 notification/
│   │   │   │   ├── pages/
│   │   │   │   │   └── channels/
│   │   │   │   ├── components/
│   │   │   │   │   ├── channel-form/
│   │   │   │   │   └── channel-list/
│   │   │   │   └── notification.routes.ts
│   │   │   │
│   │   │   ├── 📁 dashboard/
│   │   │   │   ├── pages/
│   │   │   │   │   └── overview/
│   │   │   │   ├── components/
│   │   │   │   │   ├── radicado-stats/
│   │   │   │   │   ├── alert-list/
│   │   │   │   │   └── sync-status/
│   │   │   │   └── dashboard.routes.ts
│   │   │   │
│   │   │   └── 📁 shared/
│   │   │       ├── components/
│   │   │       │   ├── loading-spinner/
│   │   │       │   ├── error-message/
│   │   │       │   ├── confirmation-modal/
│   │   │       │   └── success-toast/
│   │   │       └── pipes/
│   │   │
│   │   ├── 📄 app.component.*
│   │   ├── 📄 app.config.ts
│   │   ├── 📄 app.routes.ts
│   │   └── 📄 app.resolvers.ts
│   │
│   ├── 📁 styles/
│   │   ├── _variables.scss
│   │   ├── _daisyui.scss
│   │   ├── _mixins.scss
│   │   ├── _components.scss
│   │   ├── _animations.scss
│   │   ├── styles.scss
│   │   └── tailwind.scss
│   │
│   ├── 📄 main.ts
│   ├── 📄 index.html
│   └── 📄 env.d.ts
│
├── 📄 tailwind.config.js
├── 📄 .cursorrules
├── 📄 package.json
└── 📄 pnpm-lock.yaml
```

---

## ⚙️ CONVENCIONES DE CÓDIGO ANGULAR 19 (ZONELESS + DAISYUI)

### 1. Componentes Standalone + Zoneless

**TODOS los componentes DEBEN ser standalone. Sin zone.js:**

```typescript
import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
  selector: 'app-radicado-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
  templateUrl: './radicado-list.component.html',
  styleUrls: ['./radicado-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ← OBLIGATORIO zoneless
})
export class RadicadoListComponent {
  radicados = signal<Radicado[]>([]);
  selectedRadicado = signal<Radicado | null>(null);
  activeRadicados = computed(() => 
    this.radicados().filter(r => r.status === 'active')
  );
}
```