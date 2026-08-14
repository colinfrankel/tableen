const assert = require('assert');
const { validateAndApplyAction, generateStackId } = require('../gameLogic');

function makeCard(card, suit) { return { card, suit }; }

function cloneState(state) { return JSON.parse(JSON.stringify(state)); }

describe('gameLogic.validateAndApplyAction', () => {
  it('plays normal ace (14) as 1 on board', () => {
    const gs = { tableCards: [], playerHands: { p1: [[makeCard(14,'spades')]] }, nextStackId: 1 };
    const action = { type: 'normal', playedCard: makeCard(14,'spades') };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const stack = res.newState.tableCards[0];
    assert.strictEqual(stack.stackNumber, 1);
    assert.strictEqual(stack.cards[0].card, 1);
  });

  it('prevents grabbing single ace(1) with ace(14)', () => {
    const gs = { tableCards: [{ id: 's1', cards: [makeCard(1,'hearts')], stackNumber: 1 }], playerHands: { p1: [[makeCard(14,'clubs')]] }, collected: {}, nextStackId: 1 };
    const action = { type: 'grab', stackId: 's1', playedCard: makeCard(14,'clubs') };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.error);
  });

  it('allows stacking as sum treating 14 as 1', () => {
    const gs = {
      tableCards: [{ id: 's1', cards: [makeCard(5,'hearts')], stackNumber: 5 }],
      playerHands: { p1: [[makeCard(9,'spades')]] },
      collected: {}, nextStackId: 1
    };
    const action = { type: 'stack', stackId: 's1', playedCard: makeCard(9,'spades'), stackAsSum: true };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const stack = res.newState.tableCards.find(s => s.id === 's1');
    assert.strictEqual(stack.stackNumber, 14);
  });

  it('rejects creating stack sum above 14', () => {
    const gs = {
      tableCards: [{ id: 's1', cards: [makeCard(10,'hearts')], stackNumber: 10 }],
      playerHands: { p1: [[makeCard(5,'spades')]] },
      collected: {}, nextStackId: 1
    };
    const action = { type: 'stack', stackId: 's1', playedCard: makeCard(5,'spades'), stackAsSum: true };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.error);
  });

  it('auto-combines stacks with same sum', () => {
    const gs = {
      tableCards: [
        { id: 's1', cards: [makeCard(3,'hearts')], stackNumber: 3 },
        { id: 's2', cards: [makeCard(3,'clubs')], stackNumber: 3 }
      ],
      playerHands: { p1: [[makeCard(3,'spades')]] },
      collected: {}, nextStackId: 10
    };
    const action = { type: 'stack', stackId: 's1', playedCard: makeCard(3,'spades') };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const table = res.newState.tableCards;
    // expect only one stack remains with id s1 (s2 merged)
    assert.strictEqual(table.length, 1);
    assert.strictEqual(table[0].stackNumber, 3);
    // merged cards count should be 3
    assert.strictEqual(table[0].cards.length, 3);
  });

  it('boardstack sums when appropriate and respects 14 limit', () => {
    const gs = {
      tableCards: [
        { id: 'a', cards: [makeCard(7,'hearts')], stackNumber: 7 },
        { id: 'b', cards: [makeCard(6,'clubs')], stackNumber: 6 }
      ],
      playerHands: { p1: [] }, collected: {}, nextStackId: 1
    };
    const action = { type: 'boardstack', from: 'b', to: 'a', stackAsSum: true };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const table = res.newState.tableCards;
    assert.strictEqual(table.length, 1);
    assert.strictEqual(table[0].stackNumber, 13);
  });

  it('rejects boardstack when sum would exceed 14', () => {
    const gs = {
      tableCards: [
        { id: 'a', cards: [makeCard(10,'hearts')], stackNumber: 10 },
        { id: 'b', cards: [makeCard(5,'clubs')], stackNumber: 5 }
      ],
      playerHands: { p1: [] }, collected: {}, nextStackId: 1
    };
    const action = { type: 'boardstack', from: 'b', to: 'a', stackAsSum: true };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.error);
  });

  it('allows merging stacks with equal stackNumber without summing', () => {
    const gs = {
      tableCards: [
        { id: 'a', cards: [makeCard(6,'hearts')], stackNumber: 6 },
        { id: 'b', cards: [makeCard(6,'clubs')], stackNumber: 6 }
      ],
      playerHands: { p1: [] }, collected: {}, nextStackId: 1
    };
    const action = { type: 'boardstack', from: 'b', to: 'a' };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const table = res.newState.tableCards;
    assert.strictEqual(table.length, 1);
    assert.strictEqual(table[0].stackNumber, 6);
    assert.strictEqual(table[0].cards.length, 2);
  });

  it('stack when played card equals stackNumber without sum flag', () => {
    const gs = {
      tableCards: [{ id: 's1', cards: [makeCard(4,'hearts')], stackNumber: 4 }],
      playerHands: { p1: [[makeCard(4,'spades')]] }, collected: {}, nextStackId: 1
    };
    const action = { type: 'stack', stackId: 's1', playedCard: makeCard(4,'spades') };
    const res = validateAndApplyAction(gs, action, 'p1');
    assert.ok(res.newState);
    const stack = res.newState.tableCards.find(s => s.id === 's1');
    assert.strictEqual(stack.cards.length, 2);
    assert.strictEqual(stack.stackNumber, 4);
  });

  describe('additional edge cases', () => {
    it('removes specific ace instance from hand when playing ace(14)', () => {
      const gs = {
        tableCards: [],
        playerHands: { p1: [[makeCard(14,'spades')],[makeCard(1,'spades')]] },
        collected: {}, nextStackId: 1
      };
      // play ace 14 as normal (should convert to 1 on board)
      const action = { type: 'normal', playedCard: makeCard(14,'spades') };
      const res = validateAndApplyAction(gs, action, 'p1');
      assert.ok(res.newState);
      // hand should have one card left
      assert.strictEqual(res.newState.playerHands.p1.length, 1);
      // remaining card should be the other ace (either 1 or 14), but suit spades
      assert.strictEqual(res.newState.playerHands.p1[0][0].suit, 'spades');
    });

    it('plays ace(1) as normal without conversion', () => {
      const gs = { tableCards: [], playerHands: { p1: [[makeCard(1,'hearts')]] }, nextStackId: 1 };
      const action = { type: 'normal', playedCard: makeCard(1,'hearts') };
      const res = validateAndApplyAction(gs, action, 'p1');
      assert.ok(res.newState);
      const stack = res.newState.tableCards[0];
      assert.strictEqual(stack.stackNumber, 1);
      assert.strictEqual(stack.cards[0].card, 1);
    });

    it('grab without a playedCard collects the stack', () => {
      const gs = {
        tableCards: [{ id: 'g1', cards: [makeCard(7,'hearts')], stackNumber: 7 }],
        playerHands: { p1: [] }, collected: {}, nextStackId: 1
      };
      const action = { type: 'grab', stackId: 'g1' };
      const res = validateAndApplyAction(gs, action, 'p1');
      assert.ok(res.newState);
      assert.strictEqual(res.newState.tableCards.length, 0);
      assert.strictEqual(res.newState.collected.p1.length, 1);
      assert.strictEqual(res.newState.collected.p1[0].card, 7);
    });

    it('boardstack merges when fromSum equals toSum for multi-card stacks', () => {
      const gs = {
        tableCards: [
          { id: 'x', cards: [makeCard(2,'hearts'), makeCard(3,'hearts')], stackNumber: 5 },
          { id: 'y', cards: [makeCard(5,'clubs')], stackNumber: 5 }
        ],
        playerHands: { p1: [] }, collected: {}, nextStackId: 1
      };
      const action = { type: 'boardstack', from: 'y', to: 'x' };
      const res = validateAndApplyAction(gs, action, 'p1');
      assert.ok(res.newState);
      assert.strictEqual(res.newState.tableCards.length, 1);
      const remaining = res.newState.tableCards[0];
      assert.strictEqual(remaining.stackNumber, 5);
      assert.strictEqual(remaining.cards.length, 3);
    });
  });
});
