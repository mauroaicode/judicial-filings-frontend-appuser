import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '@app/core/config/environment.config';
import {
  CourtDirectoryEntry,
  CourtDirectoryPage,
  CourtDirectoryQuery,
} from '@app/core/models/court-directory/court-directory.model';

@Injectable({
  providedIn: 'root',
})
export class CourtDirectoryService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = `${environment.apiBaseUrl}/court-directory`;

  /**
   * Active desks only. The API pages 20 at a time.
   */
  search(query: CourtDirectoryQuery = {}): Observable<CourtDirectoryPage> {
    let params = new HttpParams();

    const q = query.q?.trim();
    const department = query.department?.trim();
    const city = query.city?.trim();
    const specialty = query.specialty?.trim();

    if (q) {
      params = params.set('q', q);
    }
    if (department) {
      params = params.set('department', department);
    }
    if (city) {
      params = params.set('city', city);
    }
    if (specialty) {
      params = params.set('specialty', specialty);
    }
    if (query.page) {
      params = params.set('page', String(query.page));
    }

    return this._http.get<unknown>(this._baseUrl, { params }).pipe(
      map((body) => normalizePage(body))
    );
  }

  /**
   * Every email for a 12-digit desk code, active and inactive.
   * An empty list means the desk is not in the directory.
   */
  byDeskCode(deskCode: string): Observable<CourtDirectoryEntry[]> {
    const code = deskCode.replace(/\D/g, '');
    return this._http.get<unknown>(`${this._baseUrl}/by-desk-code/${code}`).pipe(
      map((body) => {
        const entries = readEntryList(body);
        if (!entries) {
          throw new Error('court-directory response has no entry list');
        }
        return entries.sort(compareDeskEmails);
      })
    );
  }
}

/** Active emails first. Same desk code can have several addresses. */
function compareDeskEmails(a: CourtDirectoryEntry, b: CourtDirectoryEntry): number {
  if (a.is_active !== b.is_active) {
    return a.is_active ? -1 : 1;
  }
  return a.email.localeCompare(b.email, 'es', { sensitivity: 'base' });
}

function normalizePage(body: unknown): CourtDirectoryPage {
  const entries = readEntryList(body);
  if (!entries || !body || typeof body !== 'object') {
    throw new Error('court-directory response has no entry list');
  }

  const page = body as Record<string, unknown>;
  const current = toNumber(page['current_page'], 1);
  const perPage = toNumber(page['per_page'], 20);
  const total = toNumber(page['total'], entries.length);
  const last = toNumber(page['last_page'], Math.max(1, Math.ceil(total / Math.max(perPage, 1))));

  return {
    data: entries
      .filter((entry) => entry.is_active)
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    current_page: current,
    last_page: last,
    per_page: perPage,
    total,
    from: page['from'] == null ? null : toNumber(page['from'], 0),
    to: page['to'] == null ? null : toNumber(page['to'], 0),
  };
}

function readEntryList(body: unknown): CourtDirectoryEntry[] | null {
  const raw = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : null;

  if (!raw) {
    return null;
  }

  return raw.map(normalizeEntry).filter((entry): entry is CourtDirectoryEntry => entry !== null);
}

function normalizeEntry(value: unknown): CourtDirectoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const email = asText(row['email']);
  const name = asText(row['name']);
  if (!email || !name) {
    return null;
  }

  const deskCode = asText(row['desk_code'])?.replace(/\D/g, '') || null;

  return {
    id: asText(row['id']) || `${deskCode ?? 'desk'}:${email}`,
    email,
    name,
    corporation: asText(row['corporation']),
    specialty: asText(row['specialty']),
    department: asText(row['department']),
    city: asText(row['city']),
    account_type: asText(row['account_type']),
    desk_code: deskCode,
    is_active: row['is_active'] !== false && row['is_active'] !== 0 && row['is_active'] !== '0',
  };
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
