import { kvRead, kvWrite } from './kv';

export type MeetingStatus = 'upcoming' | 'completed' | 'cancelled';
export type ActionPriority = 'high' | 'medium' | 'low';
export type ActionStatus = 'pending' | 'in-progress' | 'done';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type Meeting = {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  status: MeetingStatus;
  notes?: string;
  project?: string;
};

export type Action = {
  id: string;
  title: string;
  priority: ActionPriority;
  dueDate?: string;
  status: ActionStatus;
  project?: string;
  createdAt: string;
};

export type Suggestion = {
  id: string;
  text: string;
  source: string;
  date: string;
  status: SuggestionStatus;
  impact?: string;
};

export type CompanyData = {
  meetings: Meeting[];
  actions: Action[];
  suggestions: Suggestion[];
  updatedAt: string;
};

const KEY = 'kiwy:company';

const EMPTY: CompanyData = {
  meetings: [],
  actions: [],
  suggestions: [],
  updatedAt: new Date(0).toISOString(),
};

export async function readCompany(): Promise<CompanyData> {
  const data = await kvRead<CompanyData>(KEY);
  if (!data) return { ...EMPTY };
  return {
    meetings: Array.isArray(data.meetings) ? data.meetings : [],
    actions: Array.isArray(data.actions) ? data.actions : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };
}

async function persist(data: CompanyData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await kvWrite(KEY, data);
}

export async function addMeeting(meeting: Omit<Meeting, 'id'>): Promise<CompanyData> {
  const data = await readCompany();
  data.meetings.push({ id: `m_${Date.now()}`, ...meeting });
  await persist(data);
  return data;
}

export async function deleteMeeting(id: string): Promise<CompanyData> {
  const data = await readCompany();
  data.meetings = data.meetings.filter((m) => m.id !== id);
  await persist(data);
  return data;
}

export async function addAction(action: Omit<Action, 'id' | 'createdAt'>): Promise<CompanyData> {
  const data = await readCompany();
  data.actions.push({ id: `a_${Date.now()}`, ...action, createdAt: new Date().toISOString() });
  await persist(data);
  return data;
}

export async function updateActionStatus(id: string, status: ActionStatus): Promise<CompanyData> {
  const data = await readCompany();
  const a = data.actions.find((x) => x.id === id);
  if (a) a.status = status;
  await persist(data);
  return data;
}

export async function deleteAction(id: string): Promise<CompanyData> {
  const data = await readCompany();
  data.actions = data.actions.filter((a) => a.id !== id);
  await persist(data);
  return data;
}

export async function addSuggestion(suggestion: Omit<Suggestion, 'id'>): Promise<CompanyData> {
  const data = await readCompany();
  data.suggestions.push({ id: `s_${Date.now()}`, ...suggestion });
  await persist(data);
  return data;
}

export async function updateSuggestionStatus(id: string, status: SuggestionStatus): Promise<CompanyData> {
  const data = await readCompany();
  const s = data.suggestions.find((x) => x.id === id);
  if (s) s.status = status;
  await persist(data);
  return data;
}
