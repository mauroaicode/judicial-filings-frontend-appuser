---
description: 
---

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
  
  intercept(req: HttpRequest<any>, next: HttpHandler):Observable<HttpEvent<any>> {
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
