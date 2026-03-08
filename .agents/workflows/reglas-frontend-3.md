---
description: 
---

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
