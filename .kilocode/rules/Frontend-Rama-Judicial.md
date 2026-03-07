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

---

### 2. Signals para Estado Reactivo

**SIN zone.js, Signals OBLIGATORIOS:**

```typescript
@Injectable({ providedIn: 'root' })
export class RadicadoService {
  private radicados = signal<Radicado[]>([]);
  radicados$ = this.radicados.asReadonly();
  
  private isLoading = signal(false);
  isLoading$ = this.isLoading.asReadonly();
  
  private error = signal<string | null>(null);
  error$ = this.error.asReadonly();
  
  activeCount = computed(() => 
    this.radicados().filter(r => r.status === 'active').length
  );
  
  alertCount = computed(() =>
    this.radicados().reduce((sum, r) => sum + r.actuaciones.filter(a => a.is_alert).length, 0)
  );
  
  private http = inject(HttpClient);
  
  loadRadicados(): void {
    this.isLoading.set(true);
    
    this.http.get<Radicado[]>('/api/radicados').subscribe({
      next: (data) => {
        this.radicados.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.isLoading.set(false);
      }
    });
  }
}
```

---

### 3. Input/Output Functions (NO decoradores)

```typescript
// ✅ CORRECTO - Functions (Angular 19+)
@Component({...})
export class RadicadoCardComponent {
  radicado = input.required<Radicado>();
  onSelect = output<Radicado>();
  onAlert = output<Actuacion>();
  
  selectRadicado(): void {
    this.onSelect.emit(this.radicado());
  }
  
  handleAlert(actuacion: Actuacion): void {
    this.onAlert.emit(actuacion);
  }
}
```

---

### 4. Control Flow Native (SIN @else)

**Usa `@if`, `@for`, `@switch`. NUNCA uses `@else`:**

```html
<!-- ✅ CORRECTO - Control flow nativo SIN @else -->
@if (isLoading()) {
  <div class="flex justify-center items-center h-64">
    <div class="loading loading-spinner loading-lg text-primary"></div>
  </div>
}

@if (error()) {
  <div class="alert alert-error shadow-lg">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 h-6 w-6">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m6-8a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{{ error() }}</span>
  </div>
}

@if (!isLoading() && !error()) {
  <div class="space-y-4">
    @for (radicado of radicados(); track radicado.id) {
      <app-radicado-card 
        [radicado]="radicado"
        (onSelect)="selectRadicado($event)"
        (onAlert)="handleAlert($event)">
      </app-radicado-card>
    }
  </div>
}

@switch (radicado().status) {
  @case ('active') {
    <span class="badge badge-success">{{ 'status.active' | transloco }}</span>
  }
  @case ('pending') {
    <span class="badge badge-warning">{{ 'status.pending' | transloco }}</span>
  }
  @case ('closed') {
    <span class="badge badge-neutral">{{ 'status.closed' | transloco }}</span>
  }
  @default {
    <span class="badge">{{ 'status.unknown' | transloco }}</span>
  }
}
```

---

### 5. Transloco: OBLIGATORIO para TODOS los textos

**NUNCA hardcodees textos. SIEMPRE Transloco:**

```typescript
// public/i18n/es.json
{
  "radicado": {
    "title": "Radicados Judiciales",
    "register": "Registrar Radicado",
    "number": "Número de Radicado",
    "status": "Estado",
    "createdAt": "Fecha Creación",
    "lastSync": "Última Sincronización",
    "list": {
      "title": "Mis Radicados",
      "empty": "No hay radicados registrados",
      "filter": "Filtrar radicados"
    },
    "form": {
      "numberPlaceholder": "23 dígitos (ej: 12345678901234567890123)",
      "validation": {
        "required": "El radicado es requerido",
        "length": "El radicado debe tener exactamente 23 dígitos",
        "numeric": "El radicado solo puede contener números"
      }
    }
  },
  "actuacion": {
    "title": "Actuaciones",
    "date": "Fecha de Actuación",
    "description": "Descripción",
    "court": "Juzgado",
    "alerts": "Alertas"
  },
  "alert": {
    "title": "Alertas",
    "keywords": {
      "consulta": "Período de CONSULTA",
      "apelacion": "APELACIÓN"
    },
    "doubleInstance": "Doble instancia detectada",
    "priority": "Alerta prioritaria"
  },
  "notification": {
    "channels": "Canales de Notificación",
    "email": "Correo Electrónico",
    "whatsapp": "WhatsApp",
    "sms": "SMS",
    "configure": "Configurar"
  },
  "status": {
    "active": "Activo",
    "pending": "Pendiente",
    "closed": "Cerrado",
    "syncing": "Sincronizando"
  },
  "common": {
    "save": "Guardar",
    "edit": "Editar",
    "delete": "Eliminar",
    "cancel": "Cancelar",
    "loading": "Cargando...",
    "error": "Error",
    "success": "Éxito",
    "confirm": "Confirmar",
    "back": "Atrás",
    "export": "Exportar",
    "sync": "Sincronizar"
  }
}
```

**En template:**

```html
<!-- ✅ CORRECTO - Usar Transloco -->
<h1 class="text-3xl font-bold text-primary">{{ 'radicado.list.title' | transloco }}</h1>

<input 
  class="input input-bordered w-full" 
  [placeholder]="'radicado.form.numberPlaceholder' | transloco"
/>

<button class="btn btn-primary">{{ 'radicado.register' | transloco }}</button>

@if (radicados().length === 0) {
  <p class="text-base-content/50">{{ 'radicado.list.empty' | transloco }}</p>
}
```

---

### 6. DaisyUI Components en Templates (CRÍTICO)

```html
<!-- Botones -->
<button class="btn btn-primary">{{ 'common.save' | transloco }}</button>
<button class="btn btn-error">{{ 'common.delete' | transloco }}</button>
<button class="btn btn-warning">{{ 'common.sync' | transloco }}</button>

<!-- Alertas -->
<div class="alert alert-info">
  <svg class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{{ 'radicado.info' | transloco }}</span>
</div>

<div class="alert alert-error">
  <svg class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m6-8a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{{ error() }}</span>
</div>

<div class="alert alert-warning">
  <svg class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 4v2m0-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>{{ 'status.syncing' | transloco }}</span>
</div>

<!-- Badges -->
<div class="badge badge-success">{{ 'status.active' | transloco }}</div>
<div class="badge badge-warning">{{ 'status.pending' | transloco }}</div>
<div class="badge badge-error">{{ 'alert.priority' | transloco }}</div>

<!-- Cards -->
<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
  <div class="card-body">
    <h2 class="card-title text-primary">{{ radicado().number }}</h2>
    <p class="text-base-content/70">{{ radicado().status }}</p>
    <div class="card-actions justify-end gap-2">
      <button class="btn btn-outline btn-sm">{{ 'common.view' | transloco }}</button>
      <button class="btn btn-primary btn-sm">{{ 'common.edit' | transloco }}</button>
    </div>
  </div>
</div>

<!-- Tabla de Actuaciones -->
<div class="overflow-x-auto">
  <table class="table bg-base-100">
    <thead>
      <tr>
        <th>{{ 'actuacion.date' | transloco }}</th>
        <th>{{ 'actuacion.description' | transloco }}</th>
        <th>{{ 'actuacion.court' | transloco }}</th>
        <th>{{ 'actuacion.alerts' | transloco }}</th>
      </tr>
    </thead>
    <tbody>
      @for (actuacion of actuaciones(); track actuacion.id) {
        <tr class="hover">
          <td>{{ actuacion.date | date: 'short' }}</td>
          <td>{{ actuacion.description }}</td>
          <td>{{ actuacion.court }}</td>
          <td>
            @if (actuacion.is_alert) {
              <span class="badge badge-error">{{ 'alert.priority' | transloco }}</span>
            }
          </td>
        </tr>
      }
    </tbody>
  </table>
</div>
```

---

### 7. SCSS con Variables DaisyUI

```scss
// src/styles/_daisyui.scss

.radicado-card {
  background-color: var(--color-base-100);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-200);
  border-radius: 0.5rem;
  padding: 1rem;
  
  &:hover {
    background-color: var(--color-base-200);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  &.alert {
    border-color: var(--color-error);
    background-color: rgba(var(--color-error), 0.05);
  }
  
  &.syncing {
    border-color: var(--color-warning);
    background-color: rgba(var(--color-warning), 0.05);
  }
}

.alert-banner {
  &.critical {
    @apply bg-error/10 text-error border border-error;
  }
  
  &.warning {
    @apply bg-warning/10 text-warning border border-warning;
  }
  
  &.info {
    @apply bg-info/10 text-info border border-info;
  }
  
  &.success {
    @apply bg-success/10 text-success border border-success;
  }
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  
  &.active {
    @apply bg-success/20 text-success;
  }
  
  &.pending {
    @apply bg-warning/20 text-warning;
  }
  
  &.alert {
    @apply bg-error/20 text-error;
  }
  
  &.closed {
    @apply bg-neutral/20 text-neutral;
  }
}

.actuacion-timeline {
  position: relative;
  padding: 2rem 0;
  
  &::before {
    content: '';
    position: absolute;
    left: 1rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-base-300);
  }
  
  .actuacion-item {
    padding-left: 4rem;
    margin-bottom: 2rem;
    
    &::before {
      content: '';
      position: absolute;
      left: 0.75rem;
      top: 0.5rem;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--color-primary);
    }
    
    &.alert::before {
      background: var(--color-error);
    }
  }
}

// ❌ EVITAR - Hardcodear colores
.wrong {
  background: #007bff;  // NO - usa var(--color-primary)
  color: white;         // NO - usa var(--color-base-content)
}
```

---

### 8. Autenticación con Sanctum de Laravel (NO JWT)

**NUNCA uses JWT. Usa Sanctum:**

```typescript
@Injectable({ providedIn: 'root' })
export class SanctumService {
  private http = inject(HttpClient);
  private sanctumToken = signal<string | null>(null);
  sanctumToken$ = this.sanctumToken.asReadonly();
  
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { 
      email, 
      password 
    }).pipe(
      tap(response => {
        this.sanctumToken.set(response.token);
        localStorage.setItem('sanctum_token', response.token);
      })
    );
  }
  
  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(
      tap(() => {
        this.sanctumToken.set(null);
        localStorage.removeItem('sanctum_token');
      })
    );
  }
  
  getToken(): string | null {
    return this.sanctumToken() ?? localStorage.getItem('sanctum_token');
  }
}

// Interceptor Sanctum
@Injectable()
export class SanctumInterceptor implements HttpInterceptor {
  private sanctumService = inject(SanctumService);
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.sanctumService.getToken();
    
    if (token) {
      // ✅ Header Authorization con Bearer token Sanctum
      req = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
    }
    
    return next.handle(req);
  }
}
```

---

### 9. Guards con Zoneless + Transloco

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const translocoService = inject(TranslocoService);
  
  if (authService.isAuthenticated$()) {
    return true;
  }
  
  const errorMsg = translocoService.translate('auth.notAuthenticated');
  console.error(errorMsg);
  
  router.navigate(['/auth/sign-in']);
  return false;
};

export const rolesGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const translocoService = inject(TranslocoService);
  const requiredRoles = route.data['roles'] as string[];
  
  const user = authService.currentUser$();
  
  if (user && requiredRoles.includes(user.role)) {
    return true;
  }
  
  const errorMsg = translocoService.translate('auth.insufficientPermissions');
  console.error(errorMsg);
  
  return false;
};

// Guard para 2FA en operaciones críticas (eliminar radicado)
export const twoFactorGuard: CanActivateFn = (route, state) => {
  const twoFactorService = inject(TwoFactorService);
  const router = inject(Router);
  
  if (twoFactorService.isTwoFactorVerified$()) {
    return true;
  }
  
  router.navigate(['/auth/two-factor']);
  return false;
};
```

---

## 🎨 EJEMPLOS DE LAYOUT CON DAISYUI

### Layout Principal (Navbar + Sidebar)

```html
<!-- app.component.html -->
<div class="drawer lg:drawer-open">
  <input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
  
  <!-- Contenido principal -->
  <div class="drawer-content flex flex-col">
    <!-- Navbar -->
    <div class="navbar bg-base-100 shadow-md sticky top-0 z-50">
      <div class="flex-1">
        <label for="my-drawer-2" class="btn btn-ghost drawer-button lg:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </label>
        <a class="btn btn-ghost text-xl text-primary font-bold">
          {{ 'radicado.title' | transloco }}
        </a>
      </div>
      
      <!-- Notificaciones -->
      <div class="flex-none gap-2">
        <div class="badge badge-error" *ngIf="alertCount() > 0">
          {{ alertCount() }} {{ 'alert.alerts' | transloco }}
        </div>
        
        <!-- User Menu -->
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-circle avatar">
            <div class="w-10 rounded-full bg-primary/10">
              <span class="text-primary font-bold">{{ getUserInitials() }}</span>
            </div>
          </button>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
            <li><a>{{ 'user.profile' | transloco }}</a></li>
            <li><a>{{ 'user.settings' | transloco }}</a></li>
            <li><a (click)="logout()">{{ 'user.logout' | transloco }}</a></li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- Contenido de página -->
    <main class="flex-1 p-4 lg:p-6">
      <router-outlet></router-outlet>
    </main>
  </div>
  
  <!-- Sidebar -->
  <div class="drawer-side">
    <label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
    <ul class="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
      <li class="mb-4">
        <h2 class="text-lg font-bold text-primary">{{ 'menu.title' | transloco }}</h2>
      </li>
      <li><a routerLink="/dashboard" routerLinkActive="active">{{ 'menu.dashboard' | transloco }}</a></li>
      <li><a routerLink="/radicados" routerLinkActive="active">{{ 'menu.radicados' | transloco }}</a></li>
      <li><a routerLink="/actuaciones" routerLinkActive="active">{{ 'menu.actuaciones' | transloco }}</a></li>
      <li><a routerLink="/alertas" routerLinkActive="active">{{ 'menu.alerts' | transloco }}</a></li>
      <li><a routerLink="/notificaciones" routerLinkActive="active">{{ 'menu.notifications' | transloco }}</a></li>
    </ul>
  </div>
</div>
```

---

### Card Radicado con Estado y Alertas

```html
<!-- radicado-card.component.html -->
<div class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow" 
     [class.ring-2]="hasAlerts()"
     [class.ring-error]="hasAlerts()">
  
  <div class="card-body">
    <!-- Header con número y estado -->
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h2 class="card-title text-primary text-2xl">{{ radicado().number }}</h2>
        <p class="text-base-content/70">{{ radicado().judicial_id }}</p>
      </div>
      <div class="flex flex-col gap-2 items-end">
        <span [class]="'badge ' + getStatusClass(radicado().status)">
          {{ ('status.' + radicado().status) | transloco }}
        </span>
        @if (hasAlerts()) {
          <span class="badge badge-error">{{ alertCount() }}</span>
        }
      </div>
    </div>
    
    <div class="divider my-2"></div>
    
    <!-- Información -->
    <div class="grid grid-cols-2 gap-4 text-sm mb-4">
      <div>
        <span class="font-semibold text-base-content/70">{{ 'radicado.createdAt' | transloco }}:</span>
        <p class="text-base-content">{{ radicado().created_at | date: 'shortDate' }}</p>
      </div>
      <div>
        <span class="font-semibold text-base-content/70">{{ 'radicado.lastSync' | transloco }}:</span>
        <p class="text-base-content">{{ radicado().last_sync_at | date: 'short' }}</p>
      </div>
    </div>
    
    <!-- Alertas si existen -->
    @if (hasAlerts()) {
      <div class="alert alert-error shadow-sm">
        <svg class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0 4v2m0-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ 'alert.priority' | transloco }}: {{ getAlertKeywords() }}</span>
      </div>
    }
    
    <!-- Acciones -->
    <div class="card-actions justify-end gap-2 mt-4">
      <button class="btn btn-outline btn-sm" (click)="viewDetails()">
        {{ 'common.view' | transloco }}
      </button>
      <button class="btn btn-warning btn-sm" (click)="syncRadicado()">
        {{ 'common.sync' | transloco }}
      </button>
      @if (canDelete()) {
        <button class="btn btn-error btn-sm" (click)="deleteRadicado()">
          {{ 'common.delete' | transloco }}
        </button>
      }
    </div>
  </div>
</div>
```

**TypeScript:**

```typescript
@Component({
  selector: 'app-radicado-card',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './radicado-card.component.html',
  styleUrls: ['./radicado-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RadicadoCardComponent {
  radicado = input.required<Radicado>();
  onSelect = output<Radicado>();
  onSync = output<Radicado>();
  onDelete = output<Radicado>();
  
  hasAlerts = computed(() => 
    this.radicado().actuaciones?.some(a => a.is_alert) ?? false
  );
  
  alertCount = computed(() =>
    this.radicado().actuaciones?.filter(a => a.is_alert).length ?? 0
  );
  
  getStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      'active': 'badge-success',
      'pending': 'badge-warning',
      'closed': 'badge-neutral',
      'syncing': 'badge-info'
    };
    return classMap[status] || 'badge';
  }
  
  getAlertKeywords(): string {
    const alerts = this.radicado().actuaciones?.filter(a => a.is_alert) ?? [];
    return alerts.map(a => {
      if (a.description.includes('CONSULTA')) return 'CONSULTA';
      if (a.description.includes('APELACIÓN')) return 'APELACIÓN';
      return 'Alerta';
    }).join(', ');
  }
  
  canDelete(): boolean {
    return this.radicado().status !== 'syncing';
  }
  
  viewDetails(): void {
    this.onSelect.emit(this.radicado());
  }
  
  syncRadicado(): void {
    this.onSync.emit(this.radicado());
  }
  
  deleteRadicado(): void {
    this.onDelete.emit(this.radicado());
  }
}
```

---

### Timeline de Actuaciones con Alertas

```html
<!-- actuacion-timeline.component.html -->
<div class="actuacion-timeline">
  @for (actuacion of actuaciones(); track actuacion.id) {
    <div class="actuacion-item" [class.alert]="actuacion.is_alert">
      <div class="flex gap-3">
        <div class="flex-1">
          <h3 class="font-semibold text-base-content">{{ actuacion.court }}</h3>
          <p class="text-base-content/70">{{ actuacion.description }}</p>
          <p class="text-xs text-base-content/50">{{ actuacion.date | date: 'medium' }}</p>
        </div>
        @if (actuacion.is_alert) {
          <div class="badge badge-error">{{ 'alert.priority' | transloco }}</div>
        }
      </div>
    </div>
  }
</div>
```

---

## 🎨 PALETA DE COLORES POR FUNCIONALIDAD JUDICIAL

| Elemento | Color DaisyUI | Uso |
|----------|---------------|-----|
| Botón principal | `btn-primary` | Acciones registrar radicado |
| Botón sincronizar | `btn-warning` | Sincronizar con Rama |
| Botón eliminar | `btn-error` | Eliminar (requiere 2FA) |
| Estado activo | `badge-success` | Radicado sincronizado |
| Estado pendiente | `badge-warning` | Sincronizando/Esperando |
| **Alerta prioritaria** | `badge-error` | CONSULTA/APELACIÓN/Doble instancia |
| Información | `badge-info` | Información general |
| Fondo base | `bg-base-100` | Fondos cards/secciones |
| Texto primario | `text-primary` | Títulos, números radicado |
| Texto secundario | `text-base-content/70` | Subtítulos, metadatos |

---

## 🚨 REGLAS ESTRICTAS PARA ESTE PROYECTO

1. **NUNCA uses ngModule** - Componentes standalone SIEMPRE
2. **NUNCA olvides ChangeDetectionStrategy.OnPush** - Obligatorio Zoneless
3. **NUNCA uses zone.js** - Proyecto zoneless
4. **NUNCA uses Signals.mutate()** - Usa `.set()` o `.update()`
5. **NUNCA uses @else** - Usa @if separados negados
6. **NUNCA uses *ngIf, *ngFor, *ngSwitch** - Control flow nativo
7. **NUNCA olvides input() para @Input** - Funciones, no decoradores
8. **NUNCA expongas Signals mutables** - Usa `.asReadonly()`
9. **NUNCA hardcodees textos** - SIEMPRE Transloco
10. **NUNCA uses JWT** - Usa Sanctum Bearer token
11. **NUNCA hardcodees colores** - USA clases DaisyUI
12. **NUNCA olvides 2FA** para eliminar radicados
13. **NUNCA olvides validar 23 dígitos** en formulario radicado
14. **NUNCA olvides mostrar alertas** (CONSULTA/APELACIÓN/doble instancia)
15. **NUNCA olvides timestamp última sincronización** en cards

---

## 📌 RESUMEN DAISYUI EN ESTE PROYECTO

**DaisyUI = componentes pre-construidos sobre Tailwind CSS**

✅ Todos los elementos visuales DEBEN usar clases DaisyUI  
✅ Colores semánticos por funcionalidad judicial  
✅ Badges para estados y alertas  
✅ Cards para radicados  
✅ Alertas para notificaciones críticas  
✅ Modales para confirmaciones (especialmente 2FA)

---

## 🎓 REFERENCIAS

- **Angular 19 Docs**: https://angular.dev
- **Transloco**: https://ngneat.github.io/transloco/
- **Laravel Sanctum**: https://laravel.com/docs/sanctum
- **DaisyUI**: https://daisyui.com
- **Tailwind CSS**: https://tailwindcss.com

---

*Prompt optimizado para Cursor AI - Listo para desarrollo frontend Angular 19 Zoneless*  
*Contexto: Procesos Judiciales Colombia - Radicados, Actuaciones, Alertas, Notificaciones*

**📱 Ubicación Cali, Valle del Cauca - Colombia**  
**💾 Generado: 2026-01-12**
