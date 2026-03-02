import fs from 'node:fs/promises';
import path from 'node:path';

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

function dataDir() {
  return process.env.VERCEL === '1' ? '/tmp/kiwy-data' : path.join(process.cwd(), 'data');
}

export function getCompanyFilePath(): string {
  return process.env.KIWY_HQ_COMPANY_PATH || path.join(dataDir(), 'company.json');
}

const EMPTY: CompanyData = {
  meetings: [],
  actions: [],
  suggestions: [],
  updatedAt: new Date(0).toISOString(),
};

export async function readCompany(filePath = getCompanyFilePath()): Promise<CompanyData> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const p = JSON.parse(raw) as CompanyData;
    return {
      meetings: Array.isArray(p.meetings) ? p.meetings : [],
      actions: Array.isArray(p.actions) ? p.actions : [],
      suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
    };
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code !== 'ENOENT') throw err;
    return { ...EMPTY };
  }
}

async function persist(data: CompanyData, filePath: string): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, filePath);
}

export async function addMeeting(
  meeting: Omit<Meeting, 'id'>,
  filePath = getCompanyFilePath(),
): Promise<CompanyData> {
  const data = await readCompany(filePath);
  data.meetings.push({ id: `m_${Date.now()}`, ...meeting });
  await persist(data, filePath);
  return data;
}

export async function deleteMeeting(id: string, filePath = getCompanyFilePath()): Promise<CompanyData> {
  const data = await readCompany(filePath);
  data.meetings = data.meetings.filter((m) => m.id !== id);
  await persist(data, filePath);
  return data;
}

export async function addAction(
  action: Omit<Action, 'id' | 'createdAt'>,
  filePath = getCompanyFilePath(),
): Promise<CompanyData> {
  const data = await readCompany(filePath);
  data.actions.push({ id: `a_${Date.now()}`, ...action, createdAt: new Date().toISOString() });
  await persist(data, filePath);
  return data;
}

export async function updateActionStatus(
  id: string,
  status: ActionStatus,
  filePath = getCompanyFilePath(),
): Promise<CompanyData> {
  const data = await readCompany(filePath);
  const a = data.actions.find((x) => x.id === id);
  if (a) a.status = status;
  await persist(data, filePath);
  return data;
}

export async function deleteAction(id: string, filePath = getCompanyFilePath()): Promise<CompanyData> {
  const data = await readCompany(filePath);
  data.actions = data.actions.filter((a) => a.id !== id);
  await persist(data, filePath);
  return data;
}

export async function addSuggestion(
  suggestion: Omit<Suggestion, 'id'>,
  filePath = getCompanyFilePath(),
): Promise<CompanyData> {
  const data = await readCompany(filePath);
  data.suggestions.push({ id: `s_${Date.now()}`, ...suggestion });
  await persist(data, filePath);
  return data;
}

export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  filePath = getCompanyFilePath(),
): Promise<CompanyData> {
  const data = await readCompany(filePath);
  const s = data.suggestions.find((x) => x.id === id);
  if (s) s.status = status;
  await persist(data, filePath);
  return data;
}
