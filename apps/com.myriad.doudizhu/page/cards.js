(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  const suits = ['spade', 'heart', 'club', 'diamond'];
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const values = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14, '2': 15, 'small-joker': 16, 'big-joker': 17 };
  const symbols = { spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '★' };

  function createDeck() {
    const deck = [];
    suits.forEach(function (suit) {
      ranks.forEach(function (rank) {
        deck.push({ id: suit + '-' + rank, suit: suit, rank: rank, value: values[rank] });
      });
    });
    deck.push({ id: 'joker-small', suit: 'joker', rank: 'small-joker', value: 16 });
    deck.push({ id: 'joker-big', suit: 'joker', rank: 'big-joker', value: 17 });
    return deck;
  }

  function shuffle(source, random) {
    const result = source.slice();
    const rng = random || Math.random;
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      const value = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = value;
    }
    return result;
  }

  function deal(random) {
    const deck = shuffle(createDeck(), random);
    return { hands: [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)], bottom: deck.slice(51) };
  }

  const suitOrder = { diamond: 0, club: 1, heart: 2, spade: 3, joker: 4 };
  function sortCards(cards, mode) {
    const sortMode = mode || 'rank';
    return cards.slice().sort(function (left, right) {
      if (sortMode === 'suit' && left.suit !== right.suit) return suitOrder[right.suit] - suitOrder[left.suit];
      return right.value - left.value || suitOrder[right.suit] - suitOrder[left.suit];
    });
  }

  function rankLabel(rank) {
    if (rank === 'small-joker') return DDZ.t('card.smallJoker');
    if (rank === 'big-joker') return DDZ.t('card.bigJoker');
    return rank;
  }

  DDZ.cards = { suits: suits, ranks: ranks, values: values, symbols: symbols, createDeck: createDeck, shuffle: shuffle, deal: deal, sortCards: sortCards, rankLabel: rankLabel };
})(globalThis);
