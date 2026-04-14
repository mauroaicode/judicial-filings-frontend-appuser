# Sidebar Menu Selection - Guia Definitiva

## Estado actual (funcionando)

El menu lateral ahora funciona con un enfoque deterministico:

1. Al hacer click en un item, se marca inmediatamente (`selectedMenuId`).
2. Cuando termina la navegacion (`NavigationEnd`), el menu se sincroniza con la URL real.
3. El estilo activo se pinta por `item.id` (`isItemSelected(item.id)`), no por estados ambiguos de render.

Archivo principal:

- `src/app/layout/common/sidebar/sidebar.component.ts`
- `src/app/layout/common/sidebar/sidebar.component.html`

## Que se cambio exactamente

### En `sidebar.component.ts`

- Se agrego:
  - `selectedMenuId = signal<string | null>(null)`
  - `currentUrl = signal<string>(this._router.url)`
- En el constructor:
  - sync inicial con URL actual (`_syncSelectedMenuFromUrl(this._router.url)`).
  - suscripcion a `NavigationEnd` para mantener `currentUrl` y `selectedMenuId` sincronizados.
- Se agrego:
  - `onMenuItemClick(item: NavigationItem)` para marcar activo inmediato por click.
  - `_syncSelectedMenuFromUrl(url: string)` para resolver el item activo real segun ruta.
  - `isItemSelected(itemId: string)` para pintar la clase activa.

### En `sidebar.component.html`

- Links principales e hijos ahora usan:
  - `[class.sidebar-item-active]="isItemSelected(item.id)"`
  - `(click)="onMenuItemClick(item)"`

## Regla para agregar una nueva pagina/menu

Para que SIEMPRE funcione al agregar un nuevo item:

1. Definir la ruta en `admin.routes.ts`.
2. Definir `link` e `id` del item en `navigation.data.ts`.
3. El `link` del item debe coincidir con el path base de la ruta.

Ejemplo:

- Ruta: `path: 'reportes'`
- Navigation item:
  - `id: 'reportes'`
  - `link: '/reportes'`

Con eso, la seleccion funcionara automaticamente.

## Checklist rapido (obligatorio)

Antes de dar por terminado un nuevo menu:

1. Navegar desde 2 o mas menus distintos hacia el nuevo item.
2. Confirmar que el resaltado cambia en el primer click.
3. Recargar pagina y repetir.
4. Probar ida y vuelta con otro menu existente (ej. `tareas`).

## Importante sobre "100% seguro"

No existe garantia matematica del 100% para cualquier cambio futuro sin pruebas.
Pero con esta implementacion + checklist, el comportamiento queda robusto y consistente para nuevos items.

Si un nuevo menu no marca bien, normalmente es por:

- `link` en `navigation.data.ts` no coincide con la ruta real.
- ruta mal registrada o con prefijo distinto.
- typo en `id`/`link`.

## Recomendacion adicional (opcional)

Agregar un test de integracion del sidebar para validar:

- click en menu A -> clase activa en A
- click en menu B -> clase activa en B
- navegacion a subruta (`/gestion-procesos/:id`) mantiene activo en `gestion-procesos`

