import { pgDb } from '../lib/db';
import { isSquareConfigured, realSquareGateway } from '../lib/squareClient';
import { handleReferences } from '../lib/referencesRoutes';
import { handleAchats } from '../lib/achatsRoutes';
import { handleSales } from '../lib/salesRoutes';
import { handleTshirts } from '../lib/tshirtsRoutes';
import { handleAdherents } from '../lib/adherentsRoutes';
import { handleTraining } from '../lib/trainingRoutes';
import { handleSquare } from '../lib/squareRoutes';
import { handleChat } from '../lib/chatRoutes';
import { json } from '../lib/http';
import Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_PROMPT } from '../lib/chatSystemPrompt';

// Single entry point for every /api/* route (see netlify.toml) — one Netlify Function instead
// of one per domain, same spirit as the old server.js (one file, many routes), but each
// domain's logic lives in its own testable module under netlify/lib/ (see any *.ts there:
// every handler takes its dependencies as arguments, never reaches for a global).

let anthropic: Anthropic | undefined;
function askClaude(message: string, today: string): Promise<string> {
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic.messages
    .create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      temperature: 0.2,
      system: `${CHAT_SYSTEM_PROMPT}\n\n(Contexte — aujourd'hui : ${today})`,
      messages: [{ role: 'user', content: message }],
    })
    .then((r) => (r.content[0] as { type: 'text'; text: string }).text.trim());
}

export default async (req: Request): Promise<Response> => {
  const path = new URL(req.url).pathname.replace(/^\/api\//, '');
  const [head, ...rest] = path.split('/');
  const sub = rest.join('/');
  const square = isSquareConfigured() ? realSquareGateway() : null;

  try {
    switch (head) {
      case 'references': return handleReferences(req, pgDb, sub);
      case 'achats': return handleAchats(req, pgDb, sub);
      case 'data': return handleSales(req, pgDb, 'data');
      case 'add': return handleSales(req, pgDb, 'add');
      case 'update': return handleSales(req, pgDb, 'update');
      case 'delete': return handleSales(req, pgDb, 'delete');
      case 'tshirts': return handleTshirts(req, pgDb, sub);
      case 'adherents': return handleAdherents(req, pgDb);
      case 'training': return handleTraining(req, pgDb);
      case 'square': return handleSquare(req, pgDb, square, sub);
      case 'chat': return handleChat(req, pgDb, { askClaude, square });
      default: return json({ success: false, error: 'Route inconnue' }, 404);
    }
  } catch (e) {
    console.error(`[/api/${path}]`, e instanceof Error ? e.message : e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Erreur serveur' }, 500);
  }
};
