import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import type {
  AuthResponse,
  Analytics,
  BankStatement,
  Dashboard,
  LoanApplication,
  Role,
  SystemSetting,
  TrustScore,
  TrustScoreHistory,
  User,
} from "../types/api";
import { useAuthStore } from "../store/auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  timeout: 30000,
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isAuthEndpoint = originalRequest?.url?.startsWith("/auth/");
    const refreshToken = useAuthStore.getState().refreshToken;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint && refreshToken) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post<{ access: string }>("/auth/refresh/", { refresh: refreshToken });
        useAuthStore.getState().setAccessToken(data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
      }
    } else if (error.response?.status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export async function login(phone: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login/", { phone, password });
  return data;
}

export async function registerMerchant(payload: { phone: string; password: string; name?: string }) {
  const { data } = await api.post<User>("/auth/register/", {
    ...payload,
    role: "merchant",
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get<User>("/auth/me/");
  return data;
}

export async function getDashboard() {
  const { data } = await api.get<Dashboard>("/profiles/dashboard/");
  return data;
}

export async function getTrustScore(merchantId?: number) {
  const { data } = await api.get<TrustScore>("/trust-score/", {
    params: merchantId ? { merchant_id: merchantId } : undefined,
  });
  return data;
}

export async function onboardingAuth(phone: string, password: string) {
  const { data } = await api.post<{ onboarding_token: string }>("/auth/onboarding-auth/", { phone, password });
  return data;
}

export async function onboardingComplete(onboardingToken: string) {
  const { data } = await api.post<{ trust_score: TrustScore }>("/auth/onboarding-complete/", { onboarding_token: onboardingToken });
  return data;
}

export async function getTrustHistory(merchantId?: number) {
  const { data } = await api.get<TrustScoreHistory[]>("/trust-score/history/", {
    params: merchantId ? { merchant_id: merchantId } : undefined,
  });
  return data;
}

export async function simulateScore(
  payload: Partial<Record<"social_component" | "psychometric_component" | "behavioral_component", number>> & { merchant_id?: number },
) {
  const { data } = await api.post<TrustScore>("/trust-score/simulate/", payload);
  return data;
}

export async function uploadBankStatement(file: File, merchantId?: number) {
  const formData = new FormData();
  formData.append("file", file);
  if (merchantId) {
    formData.append("merchant", String(merchantId));
  }
  const { data } = await api.post<{ statement: BankStatement; trust_score: TrustScore }>(
    "/bank-statements/upload/",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function listBankStatements() {
  const { data } = await api.get<{ results?: BankStatement[] } | BankStatement[]>("/bank-statements/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function submitPsychometric(payload: { trait: string; score: number; responses_json: Record<string, unknown> }) {
  const headers = (payload as any).onboarding_token ? { "Onboarding-Token": (payload as any).onboarding_token } : undefined;
  const { data } = await api.post("/psychometric/", payload, { headers });
  return data;
}

export async function submitBehavioral(payload: {
  data_type: string;
  metrics_json: Record<string, unknown>;
  period_start: string;
  period_end: string;
  merchant?: number;
}) {
  const headers = (payload as any).onboarding_token ? { "Onboarding-Token": (payload as any).onboarding_token } : undefined;
  const { data } = await api.post("/behavioral-data/", payload, { headers });
  return data;
}

export async function addGuarantor(payload: {
  guarantor?: number | null;
  guarantor_name?: string;
  guarantor_phone?: string;
  guarantor_address?: string;
  relation?: string;
  vouch_strength: number;
}) {
  const headers = (payload as any).onboarding_token ? { "Onboarding-Token": (payload as any).onboarding_token } : undefined;
  const { data } = await api.post("/guarantors/", payload, { headers });
  return data;
}

export async function listGuarantors() {
  const { data } = await api.get<{ results?: unknown[] } | unknown[]>("/guarantors/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function submitLoan(payload: { amount_requested: string; purpose: string }) {
  const { data } = await api.post<LoanApplication>("/loans/", payload);
  return data;
}

export async function listLoans() {
  const { data } = await api.get<{ results?: LoanApplication[] } | LoanApplication[]>("/loans/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function reviewLoan(id: number, payload: { status: "approved" | "rejected"; notes: string }) {
  const { data } = await api.post<LoanApplication>(`/loans/${id}/review/`, payload);
  return data;
}

export async function listUsers() {
  const { data } = await api.get<{ results?: User[] } | User[]>("/admin/users/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function listMerchants() {
  const { data } = await api.get<{ results?: User[] } | User[]>("/merchants/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createUser(payload: {
  phone: string;
  password: string;
  role: Role;
  is_active: boolean;
  name?: string;
  region?: string;
  trade_type?: string;
  address?: string;
}) {
  const { data } = await api.post<User>("/admin/users/", payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<{
    phone: string;
    password: string;
    role: Role;
    is_active: boolean;
    name: string;
    region: string;
    trade_type: string;
    address: string;
  }>,
) {
  const { data } = await api.patch<User>(`/admin/users/${id}/`, payload);
  return data;
}

export async function getAnalytics() {
  const { data } = await api.get<Analytics>("/admin/analytics/");
  return data;
}

export async function listSettings() {
  const { data } = await api.get<{ results?: SystemSetting[] } | SystemSetting[]>("/admin/settings/");
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createSetting(payload: { key: string; value: string; description?: string }) {
  const { data } = await api.post<SystemSetting>("/admin/settings/", payload);
  return data;
}

export async function updateSetting(id: number, payload: Partial<Pick<SystemSetting, "key" | "value" | "description">>) {
  const { data } = await api.patch<SystemSetting>(`/admin/settings/${id}/`, payload);
  return data;
}
