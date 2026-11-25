export type BranchCode =
  | "OWNER"
  | "Bong@29"
  | "DEV"
  | "GENSAN"
  | "MALUNGON";
export type OperatingBranchCode = "GENSAN" | "MALUNGON";
export type BranchRole = "owner" | "branch";
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type ReviewStatus = "for_review" | "approved" | "flagged";
export type PaymentType = "full" | "partial";

export interface EntryAttachment {
  id: string;
  path: string;
  file_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

export type AuditAction =
  | "CREATE_ENTRY"
  | "EDIT_ENTRY"
  | "DELETE_ENTRY"
  | "APPROVE_ENTRY"
  | "FLAG_ENTRY"
  | "OWNER_LOGIN"
  | "LOGIN_SUCCESS"
  | "LOGIN_BLOCKED_MOBILE"
  | "LOGIN_BLOCKED_MAX_DEVICES"
  | "DEVICE_APPROVED"
  | "DEVICE_REVOKED"
  | "BOOK_CREATED"
  | "BOOK_UPDATED"
  | "BRANCH_UPDATED";

export const BRANCH_LABELS: Record<OperatingBranchCode, string> = {
  GENSAN: "GenSan Branch",
  MALUNGON: "Malungon Branch",
};

export interface Branch {
  id: string;
  branch_code: BranchCode;
  branch_name: string;
  password_hash: string;
  role: BranchRole;
  is_dev: boolean;
  allow_mobile_login: boolean;
  require_device_approval: boolean;
  max_devices: number;
  created_at: string;
}

export interface NotarialBook {
  id: string;
  branch_id: string;
  notary_name: string;
  jurisdiction: string;
  appointment_date: string | null;
  commission_expiry: string | null;
  book_no: number;
  series_year: number;
  current_page_no?: number | null;
  is_active: boolean;
}

export interface NotarialEntry {
  id: string;
  book_id: string;
  branch_id: string;
  page_no: number;
  entry_number: number;
  instrument_title: string;
  parties: string;
  secondary_parties: string | null;
  competent_evidence_id: string;
  notarized_at: string;
  notarial_act_type: string;
  /** Legacy fee column retained only for DB insert default (0) */
  fee_amount?: number;
  /** Transaction amount paid in PHP */
  amount_paid: number;
  payment_type: PaymentType;
  acknowledgement_receipt: string | null;
  place_and_remarks: string | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  review_notes: string | null;
  attachments: EntryAttachment[];
  created_by_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedDevice {
  id: string;
  branch_id: string;
  device_token_hash: string;
  device_label: string | null;
  device_type: DeviceType;
  os_name: string | null;
  browser_name: string | null;
  is_approved: boolean;
  last_ip: string | null;
  created_at: string;
}

export interface DeviceSession {
  id: string;
  branch_id: string;
  device_id: string | null;
  session_token_hash: string;
  device_type: DeviceType;
  os_info: string | null;
  browser_info: string | null;
  ip_address: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  branch_id: string | null;
  session_id: string | null;
  action: AuditAction;
  target_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

type TableRow<T> = { [K in keyof T]: T[K] };
type TableInsert<T, OptionalKeys extends keyof T> = {
  [K in Exclude<keyof T, OptionalKeys>]: T[K];
} & {
  [K in OptionalKeys]?: T[K];
};
type TableUpdate<T> = { [K in keyof T]?: T[K] };

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: TableRow<Branch>;
        Insert: TableInsert<
          Branch,
          | "id"
          | "is_dev"
          | "allow_mobile_login"
          | "require_device_approval"
          | "created_at"
        >;
        Update: TableUpdate<Branch>;
        Relationships: [];
      };
      notarial_books: {
        Row: TableRow<NotarialBook>;
        Insert: TableInsert<
          NotarialBook,
          | "id"
          | "appointment_date"
          | "commission_expiry"
          | "current_page_no"
          | "is_active"
        >;
        Update: TableUpdate<NotarialBook>;
        Relationships: [];
      };
      notarial_entries: {
        Row: TableRow<NotarialEntry>;
        Insert: TableInsert<
          NotarialEntry,
          | "id"
          | "secondary_parties"
          | "fee_amount"
          | "payment_type"
          | "acknowledgement_receipt"
          | "place_and_remarks"
          | "review_status"
          | "reviewed_at"
          | "review_notes"
          | "attachments"
          | "created_by_session_id"
          | "created_at"
          | "updated_at"
        >;
        Update: TableUpdate<NotarialEntry>;
        Relationships: [];
      };
      authorized_devices: {
        Row: TableRow<AuthorizedDevice>;
        Insert: TableInsert<
          AuthorizedDevice,
          | "id"
          | "device_label"
          | "os_name"
          | "browser_name"
          | "is_approved"
          | "last_ip"
          | "created_at"
        >;
        Update: TableUpdate<AuthorizedDevice>;
        Relationships: [];
      };
      device_sessions: {
        Row: TableRow<DeviceSession>;
        Insert: TableInsert<
          DeviceSession,
          | "id"
          | "device_id"
          | "os_info"
          | "browser_info"
          | "ip_address"
          | "is_active"
          | "revoked_at"
          | "revoked_by"
          | "last_seen_at"
          | "created_at"
        >;
        Update: TableUpdate<DeviceSession>;
        Relationships: [];
      };
      audit_logs: {
        Row: TableRow<AuditLog>;
        Insert: TableInsert<
          AuditLog,
          | "id"
          | "branch_id"
          | "session_id"
          | "target_id"
          | "old_data"
          | "new_data"
          | "created_at"
        >;
        Update: TableUpdate<AuditLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
