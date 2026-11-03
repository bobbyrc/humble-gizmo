import { ServiceChangedError } from '../shared/errors';
import type { ChoiceGame, ChoiceMonth } from '../shared/types';

export type ChoiceOrder = {
  gamekey: string;
  name: string;
  choiceUrl: string;
  created: string;
  choicesRemaining: number;
  isV3: boolean;
  chosenMachineNames: Set<string>;
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Every string `machine_name` found anywhere inside `v`. */
function collectMachineNames(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) {
    for (const item of v) collectMachineNames(item, out);
  } else if (isObj(v)) {
    for (const [k, val] of Object.entries(v)) {
      if (k === 'machine_name' && typeof val === 'string') out.add(val);
      else collectMachineNames(val, out);
    }
  }
  return out;
}

export function findChoiceOrders(orders: unknown[]): ChoiceOrder[] {
  const found: ChoiceOrder[] = [];
  for (const o of orders) {
    if (!isObj(o) || !isObj(o.product)) continue;
    const product = o.product;
    const choiceUrl = str(product.choice_url);
    const gamekey = str(o.gamekey);
    if (product.category !== 'subscriptioncontent' || choiceUrl === null || gamekey === null) continue;
    const remaining = typeof o.choices_remaining === 'number' ? o.choices_remaining : 0;
    const isV3 = product.is_subs_v3_product === true;
    if (!(remaining > 0) && !isV3) continue;
    found.push({
      gamekey,
      name: str(product.human_name) ?? '',
      choiceUrl,
      created: str(o.created) ?? '',
      choicesRemaining: remaining,
      isV3,
      chosenMachineNames: collectMachineNames(o.tpkd_dict),
    });
  }
  return found.sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
}

const SCRIPT_RE = /<script\b[^>]*\bid=["']webpack-monthly-product-data["'][^>]*>([\s\S]*?)<\/script>/i;

export function parseMonthPage(html: string): unknown {
  const m = SCRIPT_RE.exec(html);
  if (!m) throw new ServiceChangedError('humble', 'choice page');
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    throw new ServiceChangedError('humble', 'choice page');
  }
  if (!isObj(data) || !('contentChoiceOptions' in data)) throw new ServiceChangedError('humble', 'choice page');
  return data.contentChoiceOptions;
}

function findChoices(
  options: Obj,
  isV3: boolean,
): { parentIdentifier: string; choices: Obj } {
  const data = options.contentChoiceData;
  if (!isObj(data)) throw new ServiceChangedError('humble', 'choice data');
  if (isV3) {
    if (!isObj(data.game_data)) throw new ServiceChangedError('humble', 'choice data');
    return { parentIdentifier: 'initial', choices: data.game_data };
  }
  const candidates = ['initial', 'initial-classic', ...Object.keys(data)];
  for (const id of candidates) {
    const entry = data[id];
    if (isObj(entry) && isObj(entry.content_choices)) {
      return { parentIdentifier: id, choices: entry.content_choices };
    }
  }
  throw new ServiceChangedError('humble', 'choice data');
}

function toGame(choice: Obj): ChoiceGame | null {
  const identifier = str(choice.display_item_machine_name);
  if (identifier === null) return null;
  const tpkd = Array.isArray(choice.tpkds) && isObj(choice.tpkds[0]) ? choice.tpkds[0] : null;
  const gamekey = tpkd ? str(tpkd.gamekey) : null;
  let rating: ChoiceGame['rating'] = null;
  if (isObj(choice.user_rating)) {
    const text = str(choice.user_rating.review_text);
    if (text !== null) {
      const pct = choice.user_rating['steam_percent|decimal'];
      rating = {
        text: text.replace(/_/g, ' '),
        percent: typeof pct === 'number' && Number.isFinite(pct) ? pct : null,
      };
    }
  }
  return { identifier, title: str(choice.title) ?? identifier, rating, claimable: gamekey !== null, gamekey };
}

export function buildChoiceMonth(order: ChoiceOrder, options: unknown): ChoiceMonth | null {
  if (!isObj(options)) throw new ServiceChangedError('humble', 'choice data');
  if (options.canRedeemGames === false) return null;
  const usesChoices = options.usesChoices !== false;
  const { parentIdentifier, choices } = findChoices(options, !usesChoices);

  const games: ChoiceGame[] = [];
  for (const raw of Object.values(choices)) {
    if (!isObj(raw)) continue;
    const names = collectMachineNames(raw);
    if ([...names].some((n) => order.chosenMachineNames.has(n))) continue;
    const game = toGame(raw);
    if (game) games.push(game);
  }
  if (games.length === 0) return null;

  return {
    gamekey: order.gamekey,
    name: order.name,
    choiceUrl: order.choiceUrl,
    created: order.created,
    usesChoices,
    choicesRemaining: usesChoices ? order.choicesRemaining : games.length,
    parentIdentifier,
    games,
  };
}
