export interface AuthResponse {
  token: string;
  user: User;
  requires_2fa: boolean;
  is_first_login: boolean;
}

export interface User {
  id: string;
  name: string;
  last_name: string;
  email: string;
  slug: string;
  profile_image: string | null;
  roles: Role[];
}

export interface Role {
  value: string;
  label: string;
}

export interface LoginRequest {
  identification: string;
  password: string;
}

