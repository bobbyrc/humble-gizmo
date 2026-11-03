import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildChoiceMonth, findChoiceOrders, parseMonthPage } from '../../src/core/choice';
import { ServiceChangedError } from '../../src/shared/errors';

const dir = join(__dirname, '../fixtures/hand');
const orders = JSON.parse(readFileSync(join(dir, 'choice-orders.json'), 'utf8')) as unknown[];
const v2Html = readFileSync(join(dir, 'choice-v2.html'), 'utf8');
const v3Html = readFileSync(join(dir, 'choice-v3.html'), 'utf8');

describe('findChoiceOrders', () => {
  const found = findChoiceOrders(orders);
  it('keeps pending months sorted by created', () => {
    expect(found.map((o) => o.gamekey)).toEqual(['v2month0000000002', 'v3month0000000001']);
  });
  it('maps fields and chosen machine names', () => {
    expect(found[0]).toMatchObject({
      name: 'March 2026 Humble Choice', choiceUrl: 'march-2026', choicesRemaining: 2, isV3: false,
    });
    expect([...found[0].chosenMachineNames]).toEqual(['chosen_game_steam']);
    expect(found[1].isV3).toBe(true);
  });
  it('ignores garbage entries', () => {
    expect(findChoiceOrders([null, 3, 'x', {}, { product: 5 }])).toEqual([]);
  });
});

describe('parseMonthPage', () => {
  it('throws ServiceChangedError without the script', () => {
    expect(() => parseMonthPage('<html></html>')).toThrow(ServiceChangedError);
  });
  it('throws ServiceChangedError on invalid JSON', () => {
    const html = '<script id="webpack-monthly-product-data" type="application/json">{nope</script>';
    expect(() => parseMonthPage(html)).toThrow(ServiceChangedError);
  });
  it('returns contentChoiceOptions', () => {
    expect(parseMonthPage(v2Html)).toHaveProperty('canRedeemGames', true);
  });
});

describe('buildChoiceMonth', () => {
  const [v2Order, v3Order] = findChoiceOrders(orders);

  it('builds a v2 month without already chosen games', () => {
    const m = buildChoiceMonth(v2Order, parseMonthPage(v2Html))!;
    expect(m).toMatchObject({
      gamekey: 'v2month0000000002', name: 'March 2026 Humble Choice', choiceUrl: 'march-2026',
      created: '2026-03-01T10:00:00.000000', usesChoices: true, choicesRemaining: 2,
      parentIdentifier: 'initial',
    });
    expect(m.games).toHaveLength(2);
    const open = m.games.find((g) => g.identifier === 'open_game')!;
    expect(open).toEqual({
      identifier: 'open_game', title: 'Open Game', claimable: true, gamekey: 'v2month0000000002',
      rating: { text: 'Very Positive', percent: 0.93 },
    });
    const ext = m.games.find((g) => g.identifier === 'external_game')!;
    expect(ext.claimable).toBe(false);
    expect(ext.gamekey).toBeNull();
    expect(ext.rating).toBeNull();
  });

  it('builds a v3 month with choicesRemaining = game count', () => {
    const m = buildChoiceMonth(v3Order, parseMonthPage(v3Html))!;
    expect(m.usesChoices).toBe(false);
    expect(m.parentIdentifier).toBe('initial');
    expect(m.games).toHaveLength(2);
    expect(m.choicesRemaining).toBe(2);
    expect(m.games[1].rating).toBeNull();
  });

  it('returns null when canRedeemGames is false', () => {
    const opts = { ...(parseMonthPage(v2Html) as object), canRedeemGames: false };
    expect(buildChoiceMonth(v2Order, opts)).toBeNull();
  });

  it('returns null when every game is already chosen', () => {
    const opts = {
      canRedeemGames: true, usesChoices: true,
      contentChoiceData: {
        initial: {
          content_choices: {
            a: { title: 'A', display_item_machine_name: 'a', tpkds: [{ gamekey: 'k', machine_name: 'a_steam' }] },
          },
        },
      },
    };
    const order = { ...v2Order, chosenMachineNames: new Set(['a_steam']) };
    expect(buildChoiceMonth(order, opts)).toBeNull();
  });

  it('finds content_choices under a non-initial key', () => {
    const opts = {
      canRedeemGames: true, usesChoices: true,
      contentChoiceData: {
        'initial-classic': { content_choices: { g: { title: 'G', display_item_machine_name: 'g' } } },
      },
    };
    const m = buildChoiceMonth(v2Order, opts)!;
    expect(m.parentIdentifier).toBe('initial-classic');
    expect(m.games[0].claimable).toBe(false);
  });

  it('throws ServiceChangedError when containers are missing', () => {
    expect(() => buildChoiceMonth(v2Order, null)).toThrow(ServiceChangedError);
    const empty2 = { canRedeemGames: true, usesChoices: true, contentChoiceData: {} };
    expect(() => buildChoiceMonth(v2Order, empty2)).toThrow(ServiceChangedError);
    const empty3 = { canRedeemGames: true, usesChoices: false, contentChoiceData: {} };
    expect(() => buildChoiceMonth(v3Order, empty3)).toThrow(ServiceChangedError);
  });
});
