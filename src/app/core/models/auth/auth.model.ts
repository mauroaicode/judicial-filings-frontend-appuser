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
  identification: string;
  slug: string;
  profile_image: string | null;
  roles: Role[];
  must_change_password: boolean;
  organization_id: string;
  session_lock_timeout?: number | null;
}

export interface Role {
  value: string;
  label: string;
}

export interface LoginRequest {
  identification: string;
  password: string;
}

export interface ProfileUpdateRequest {
  name: string;
  last_name: string;
  email: string;
  identification: string;
  password?: string;
  password_confirmation?: string;
}

export interface ForgotPasswordRequest {
  identification: string;
}

export interface ResetPasswordRequest {
  identification: string;
  token: string;
  password: string;
  password_confirmation: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

export interface VerifyPasswordResponse {
  message: string;
}

