(function (root) {
  'use strict';
  const DDZ = root.DDZ = root.DDZ || {};
  function groupsOf(cards) {
    const groups = new Map();
    cards.forEach(function (card) {
      const group = groups.get(card.value) || [];
      group.push(card);
      groups.set(card.value, group);
    });
    return groups;
  }

  function isRun(values) {
    return values.every(function (value, index) { return index === 0 || value === values[index - 1] + 1; });
  }

  function pattern(type, mainValue, length, chainLength) {
    return { type: type, mainValue: mainValue, length: length, chainLength: chainLength || 1 };
  }

  function consecutiveRuns(values, minimum) {
    const sorted = Array.from(new Set(values)).filter(function (value) { return value <= 14; }).sort(function (a, b) { return a - b; });
    const result = [];
    for (let start = 0; start < sorted.length; start += 1) {
      for (let end = start + minimum; end <= sorted.length; end += 1) {
        const run = sorted.slice(start, end);
        if (!isRun(run)) break;
        result.push(run);
      }
    }
    return result;
  }

  function findAirplane(cards, wingMode) {
    const groups = groupsOf(cards);
    const unit = wingMode === 'none' ? 3 : wingMode === 'single' ? 4 : 5;
    if (cards.length % unit !== 0) return null;
    const chainLength = cards.length / unit;
    if (chainLength < 2) return null;
    const tripleValues = Array.from(groups.entries()).filter(function (entry) {
      return entry[0] <= 14 && entry[1].length >= 3;
    }).map(function (entry) { return entry[0]; });
    const runs = consecutiveRuns(tripleValues, chainLength).filter(function (run) { return run.length === chainLength; });

    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const run = runs[index];
      const bodyIds = new Set();
      run.forEach(function (value) { groups.get(value).slice(0, 3).forEach(function (card) { bodyIds.add(card.id); }); });
      const wings = cards.filter(function (card) { return !bodyIds.has(card.id); });
      if (wingMode === 'none' && wings.length === 0) return run;
      // Single wings are the exact cards left after the three-card bodies are
      // removed. A fourth card of a body rank is a legal single wing.
      if (wingMode === 'single' && wings.length === chainLength) return run;
      if (wingMode === 'pair' && wings.length === chainLength * 2) {
        const wingGroups = groupsOf(wings);
        if (wingGroups.size === chainLength && Array.from(wingGroups.entries()).every(function (entry) {
          return !run.includes(entry[0]) && entry[1].length === 2;
        })) return run;
      }
    }
    return null;
  }

  function detect(cards) {
    if (!Array.isArray(cards) || cards.length === 0) return null;
    const groups = groupsOf(cards);
    const entries = Array.from(groups.entries()).sort(function (a, b) { return a[0] - b[0]; });
    const values = entries.map(function (entry) { return entry[0]; });
    const counts = entries.map(function (entry) { return entry[1].length; }).sort(function (a, b) { return b - a; });
    const length = cards.length;

    if (length === 2 && values.includes(16) && values.includes(17)) return pattern('rocket', 17, 2);
    if (length === 4 && counts[0] === 4) return pattern('bomb', entries.find(function (entry) { return entry[1].length === 4; })[0], 4);
    if (length === 1) return pattern('single', values[0], 1);
    if (length === 2 && counts[0] === 2) return pattern('pair', values[0], 2);
    if (length === 3 && counts[0] === 3) return pattern('triple', values[0], 3);
    if (length === 4 && counts[0] === 3) return pattern('tripleSingle', entries.find(function (entry) { return entry[1].length === 3; })[0], 4);
    if (length === 5 && counts[0] === 3 && counts[1] === 2) return pattern('triplePair', entries.find(function (entry) { return entry[1].length === 3; })[0], 5);
    if (length >= 5 && entries.length === length && values[values.length - 1] <= 14 && isRun(values)) return pattern('straight', values[values.length - 1], length, length);
    if (length >= 6 && length % 2 === 0 && entries.length === length / 2 && values[values.length - 1] <= 14
      && entries.every(function (entry) { return entry[1].length === 2; }) && isRun(values)) return pattern('pairStraight', values[values.length - 1], length, length / 2);

    const modes = [['none', 'airplane'], ['single', 'airplaneSingles'], ['pair', 'airplanePairs']];
    for (let i = 0; i < modes.length; i += 1) {
      const run = findAirplane(cards, modes[i][0]);
      if (run) return pattern(modes[i][1], run[run.length - 1], length, run.length);
    }

    // Four-with-two-singles accepts any two kickers, including a pair.
    if (length === 6 && counts[0] === 4) return pattern('fourSingles', entries.find(function (entry) { return entry[1].length === 4; })[0], 6);
    if (length === 8 && counts[0] === 4) {
      const four = entries.find(function (entry) { return entry[1].length === 4; });
      const wings = entries.filter(function (entry) { return entry[0] !== four[0]; });
      if (wings.length === 2 && wings.every(function (entry) { return entry[1].length === 2; })) return pattern('fourPairs', four[0], 8);
    }
    return null;
  }

  function compare(current, previous) {
    if (!current || !previous) return 0;
    if (current.type === 'rocket') return previous.type === 'rocket' ? 0 : 1;
    if (previous.type === 'rocket') return -1;
    if (current.type === 'bomb' && previous.type !== 'bomb') return 1;
    if (previous.type === 'bomb' && current.type !== 'bomb') return -1;
    if (current.type !== previous.type || current.length !== previous.length || current.chainLength !== previous.chainLength) return 0;
    return Math.sign(current.mainValue - previous.mainValue);
  }

  function canBeat(previous, current) {
    if (!current) return false;
    if (!previous) return true;
    return compare(current, previous) > 0;
  }

  function combinations(items, size, limit) {
    const output = [];
    const maximum = limit || 3000;
    function visit(start, chosen) {
      if (output.length >= maximum) return;
      if (chosen.length === size) { output.push(chosen.slice()); return; }
      for (let index = start; index <= items.length - (size - chosen.length); index += 1) {
        chosen.push(items[index]); visit(index + 1, chosen); chosen.pop();
      }
    }
    visit(0, []);
    return output;
  }

  function allValidPlays(hand, previous) {
    const groups = groupsOf(hand);
    const entries = Array.from(groups.entries()).sort(function (a, b) { return a[0] - b[0]; });
    const candidates = new Map();
    function add(cards) {
      const signature = cards.map(function (card) { return card.id; }).sort().join('|');
      if (!candidates.has(signature)) candidates.set(signature, cards);
    }

    entries.forEach(function (entry) {
      const cards = entry[1];
      add(cards.slice(0, 1));
      if (cards.length >= 2) add(cards.slice(0, 2));
      if (cards.length >= 3) add(cards.slice(0, 3));
      if (cards.length === 4) add(cards.slice());
    });
    if (groups.has(16) && groups.has(17)) add([groups.get(16)[0], groups.get(17)[0]]);

    consecutiveRuns(entries.map(function (entry) { return entry[0]; }), 5).forEach(function (run) {
      add(run.map(function (value) { return groups.get(value)[0]; }));
    });
    consecutiveRuns(entries.filter(function (entry) { return entry[1].length >= 2; }).map(function (entry) { return entry[0]; }), 3).forEach(function (run) {
      add(run.flatMap(function (value) { return groups.get(value).slice(0, 2); }));
    });

    const triples = entries.filter(function (entry) { return entry[0] <= 14 && entry[1].length >= 3; });
    triples.forEach(function (entry) {
      const body = entry[1].slice(0, 3);
      const rest = hand.filter(function (card) { return card.value !== entry[0]; });
      rest.forEach(function (card) { add(body.concat(card)); });
      entries.filter(function (candidate) { return candidate[0] !== entry[0] && candidate[1].length >= 2; }).forEach(function (candidate) {
        add(body.concat(candidate[1].slice(0, 2)));
      });
    });

    consecutiveRuns(triples.map(function (entry) { return entry[0]; }), 2).forEach(function (run) {
      const body = run.flatMap(function (value) { return groups.get(value).slice(0, 3); });
      const bodyIds = new Set(body.map(function (card) { return card.id; }));
      add(body);
      const rest = hand.filter(function (card) { return !bodyIds.has(card.id); });
      combinations(rest, run.length, 2000).forEach(function (wings) { add(body.concat(wings)); });
      const pairs = entries.filter(function (entry) { return !run.includes(entry[0]) && entry[1].length >= 2; });
      combinations(pairs, run.length, 800).forEach(function (chosen) {
        add(body.concat(chosen.flatMap(function (entry) { return entry[1].slice(0, 2); })));
      });
    });

    entries.filter(function (entry) { return entry[1].length === 4; }).forEach(function (entry) {
      const rest = hand.filter(function (card) { return card.value !== entry[0]; });
      combinations(rest, 2, 600).forEach(function (wings) { add(entry[1].concat(wings)); });
      const pairs = entries.filter(function (candidate) { return candidate[0] !== entry[0] && candidate[1].length >= 2; });
      combinations(pairs, 2, 200).forEach(function (chosen) {
        add(entry[1].concat(chosen.flatMap(function (candidate) { return candidate[1].slice(0, 2); })));
      });
    });

    return Array.from(candidates.values()).map(function (cards) { return { cards: cards, pattern: detect(cards) }; })
      .filter(function (item) { return item.pattern && canBeat(previous || null, item.pattern); })
      .sort(function (left, right) {
        const leftBomb = left.pattern.type === 'bomb' || left.pattern.type === 'rocket' ? 1 : 0;
        const rightBomb = right.pattern.type === 'bomb' || right.pattern.type === 'rocket' ? 1 : 0;
        return leftBomb - rightBomb || left.pattern.mainValue - right.pattern.mainValue || right.cards.length - left.cards.length;
      }).map(function (item) { return item.cards; });
  }

  DDZ.rules = { groupsOf: groupsOf, detect: detect, compare: compare, canBeat: canBeat, allValidPlays: allValidPlays };
})(globalThis);
