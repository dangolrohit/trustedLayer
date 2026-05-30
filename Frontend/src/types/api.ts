export type Role = "admin" | "loan_department" | "merchant";

export interface Profile {
  id: number;
  phone: string;
  role: Role;
  name: string;
  region: string;
  trade_type: string;
  address: string;
  trust_score: number;
  score_last_updated: string | null;
}

export interface User {
  id: number;
  phone: string;
  role: Role;
  is_active: boolean;
  date_joined: string;
  profile?: Profile;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export interface Analytics {
  users: {
    total: number;
    merchants: number;
    loan_department: number;
    admins: number;
    active: number;
  };
  loans: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  trust: {
    average_score: number;
    strong_merchants: number;
    thin_merchants: number;
  };
  signals: {
    bank_statements: number;
    psychometric_responses: number;
    guarantors: number;
  };
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface TrustScore {
  score: number;
  breakdown: {
    social_component: number;
    psychometric_component: number;
    behavioral_component: number;
    bank_impact: number;
    weights: Record<string, number>;
  };
  behavioral_signals: {
    score: number;
    non_bank_behavior_score: number;
    bank_statement_score: number;
    bank_impact: number;
    has_bank_statement: boolean;
  };
  explanation: string;
}

export interface TrustScoreHistory {
  id: number;
  score: number;
  social_component: number;
  psychometric_component: number;
  behavioral_component: number;
  bank_impact: number;
  explanation: string;
  created_at: string;
}

export interface BankStatement {
  id: number;
  file_path: string;
  file_url: string;
  uploaded_at: string;
  parsed_transactions: Array<{
    date: string;
    description: string;
    credit: number;
    debit: number;
    balance: number;
  }>;
  analysis_summary: Record<string, number | string>;
}

export interface LoanApplication {
  id: number;
  merchant: number;
  merchant_phone: string;
  amount_requested: string;
  purpose: string;
  status: "pending" | "approved" | "rejected";
  trust_score_at_application: number;
  reviewer_phone: string | null;
  decision_date: string | null;
  notes: string;
  created_at: string;
}

export interface Dashboard {
  profile: Profile;
  trust_score: TrustScore;
  recent_loans: LoanApplication[];
  bank_statement_count: number;
  analytics?: {
    merchant_count: number;
    pending_loan_count: number;
    approved_loan_count: number;
    average_trust_score: number;
  };
}
