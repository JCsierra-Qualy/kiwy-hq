// Vercel serverless entry point.
// server.ts keeps its named exports intact (used by tests);
// Vercel picks up this file's module.exports as the handler.
import { createApp } from '../src/server';

module.exports = createApp();
