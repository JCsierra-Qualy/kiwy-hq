import fs from 'node:fs/promises';
import path from 'node:path';

export type AgentStatus = 'active' | 'idle' | 'error' | 'thinking';

export type AgentAction = {
  time: string;
  action: string;
  type?: 'success' | 'error' | 'info';
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  progress: number;
  lastActivity: string;
  metrics: {
    tokensToday: number;
    tasksCompleted: number;
    tasksOpen: number;
    successRate: number;
  };
  recentActions: AgentAction[];
};

export type AgentsData = {
  agents: Agent[];
  updatedAt: string;
};

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'kiwy-main',
    name: 'Kiwy',
    role: 'Agente principal · Coordinador de operaciones',
    status: 'idle',
    currentTask: 'En espera de instrucciones',
    progress: 0,
    lastActivity: new Date().toISOString(),
    metrics: { tokensToday: 0, tasksCompleted: 0, tasksOpen: 0, successRate: 100 },
    recentActions: [],
  },
  {
    id: 'cron-monitor',
    name: 'Cron Monitor',
    role: 'Monitoreo de automatizaciones · n8n + Cron',
    status: 'idle',
    currentTask: 'Esperando próxima ejecución programada',
    progress: 0,
    lastActivity: new Date().toISOString(),
    metrics: { tokensToday: 0, tasksCompleted: 0, tasksOpen: 0, successRate: 100 },
    recentActions: [],
  },
  {
    id: 'crm-agent',
    name: 'CRM Agent',
    role: 'Gestión de CRM · AppSheet',
    status: 'idle',
    currentTask: 'Sincronización completada',
    progress: 100,
    lastActivity: new Date().toISOString(),
    metrics: { tokensToday: 0, tasksCompleted: 0, tasksOpen: 0, successRate: 100 },
    recentActions: [],
  },
  {
    id: 'meeting-monitor',
    name: 'Meeting Monitor',
    role: 'Procesamiento de reuniones · Google Meet',
    status: 'idle',
    currentTask: 'Sin reuniones recientes para procesar',
    progress: 0,
    lastActivity: new Date().toISOString(),
    metrics: { tokensToday: 0, tasksCompleted: 0, tasksOpen: 0, successRate: 100 },
    recentActions: [],
  },
];

function dataDir() {
  return process.env.VERCEL === '1' ? '/tmp/kiwy-data' : path.join(process.cwd(), 'data');
}

export function getAgentsFilePath(): string {
  return process.env.KIWY_HQ_AGENTS_PATH || path.join(dataDir(), 'agents.json');
}

export async function readAgents(filePath = getAgentsFilePath()): Promise<AgentsData> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as AgentsData;
    if (!Array.isArray(parsed.agents)) {
      return { agents: DEFAULT_AGENTS, updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as any).code : undefined;
    if (code !== 'ENOENT') throw err;
    return { agents: DEFAULT_AGENTS, updatedAt: new Date().toISOString() };
  }
}

export async function writeAgentStatus(
  agentId: string,
  update: Partial<Pick<Agent, 'status' | 'currentTask' | 'progress' | 'metrics' | 'recentActions'>>,
  filePath = getAgentsFilePath(),
): Promise<AgentsData> {
  const data = await readAgents(filePath);
  const now = new Date().toISOString();
  const idx = data.agents.findIndex((a) => a.id === agentId);
  if (idx !== -1) {
    data.agents[idx] = { ...data.agents[idx], ...update, lastActivity: now };
  }
  data.updatedAt = now;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, filePath);
  return data;
}
