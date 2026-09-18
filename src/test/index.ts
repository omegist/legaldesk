export type UserRole = 'lawyer' | 'partner' | 'admin';
export type SubscriptionTier = 'free' | 'pro' | 'firm';
export type CaseStatus = 'active' | 'disposed' | 'appealed' | 'adjourned';
export type DocumentCategory =
  | 'client_evidence'
  | 'filed_plaints'
  | 'research_notes'
  | 'case_law_citations';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  firm_id: string | null;
  practice_area: string | null;
  court_name: string | null;
  city: string | null;
  experience_years: number | null;
  description: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Diary {
  id: string;
  lawyer_id: string;
  firm_id: string | null;
  matter_date: string;
  hearing_time: string | null;
  court_name: string;
  court_number: string | null;
  case_type: string;
  case_number: string;
  party_names: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  opponent_advocate: string | null;
  judge_name: string | null;
  stage_of_case: string | null;
  purpose_of_hearing: string | null;
  status: CaseStatus;
  notes: string | null;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  id: string;
  diary_id: string;
  entry_date: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface CaseDocument {
  id: string;
  diary_id: string | null;
  owner_id: string;
  category: DocumentCategory;
  file_name: string;
  storage_key: string;
  mime_type: string | null;
  file_size: number | null;
  ocr_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  user_id: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  reminder_hours: number[];
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'client_evidence', label: 'Client Evidence' },
  { value: 'filed_plaints', label: 'Filed Plaints' },
  { value: 'research_notes', label: 'Research Notes' },
  { value: 'case_law_citations', label: 'Case Law Citations' },
];

export const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'appealed', label: 'Appealed' },
  { value: 'adjourned', label: 'Adjourned' },
];
