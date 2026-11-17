export interface CourtDirectoryEntry {
  id: string;
  email: string;
  name: string;
  corporation: string | null;
  specialty: string | null;
  department: string | null;
  city: string | null;
  account_type: string | null;
  desk_code: string | null;
  is_active: boolean;
}

export interface CourtDirectoryPage {
  data: CourtDirectoryEntry[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface CourtDirectoryQuery {
  q?: string;
  department?: string;
  city?: string;
  specialty?: string;
  page?: number;
}
