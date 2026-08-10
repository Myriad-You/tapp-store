'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../main.js');

test('five horizontal stones win', () => {
  let game = core.newGame(1);
  [[7,3],[0,0],[7,4],[0,1],[7,5],[0,2],[7,6],[0,3],[7,7]].forEach(([r,c]) => { game = core.applyMove(game,r,c,'player').game; });
  assert.equal(game.phase, 'finished'); assert.equal(game.winner, 'black'); assert.equal(game.winLine.length, 5);
});

test('occupied and out-of-bounds moves are rejected', () => {
  let game = core.newGame(1); game = core.applyMove(game,7,7,null).game;
  assert.equal(core.applyMove(game,7,7,null).reason, 'occupied'); assert.equal(core.applyMove(game,-1,0,null).reason, 'bounds');
});

test('corrupted move lists fail closed', () => {
  assert.equal(core.boardFromMoves(null), null);
  assert.equal(core.boardFromMoves([null]), null);
  assert.equal(core.boardFromMoves([{row: -1, col: 0, color: 'black'}]), null);
});

test('actor comparison normalizes hosts and trailing slashes without folding paths', () => {
  assert.equal(core.normalizeActor(' HTTPS://Example.COM/users/Alice/ '), 'https://example.com/users/Alice');
  assert.equal(core.sameActor('https://EXAMPLE.com/users/Alice/', 'https://example.com/users/Alice'), true);
  assert.equal(core.sameActor('https://example.com/users/Alice', 'https://example.com/users/alice'), false);
  assert.equal(core.sameActor('@Alice@EXAMPLE.COM', '@Alice@example.com'), true);
});

test('canonical state validation rejects reordered colors and duplicates', () => {
  const base = {protocol:1,kind:'state',seq:1,round:1,hostActor:'@a@x.test',players:{black:'@a@x.test',white:'@b@y.test'},ready:{},phase:'playing',turn:'white',moves:[{row:7,col:7,color:'black',actor:'@a@x.test'}],winner:null,finishReason:null,lastMove:{row:7,col:7,color:'black',actor:'@a@x.test'}};
  assert.ok(core.validateState(base));
  assert.equal(core.validateState({...base,moves:[{row:7,col:7,color:'white',actor:'@b@y.test'}]}), null);
  assert.equal(core.validateState({...base,turn:'black',moves:[...base.moves,{...base.moves[0],color:'white',actor:'@b@y.test'}]}), null);
});

test('state validation canonicalizes equivalent actor spellings and ready keys', () => {
  const black = 'https://EXAMPLE.com/users/Alice/';
  const white = 'https://peer.test/users/Bob';
  const state = {protocol:1,kind:'state',seq:1,round:1,hostActor:black,players:{black:'https://example.com/users/Alice',white},ready:{[black]:true,[white + '/']:false},phase:'lobby',turn:'black',moves:[],winner:null,finishReason:null,lastMove:null,winLine:[]};
  const clean = core.validateState(state);
  assert.ok(clean);
  assert.equal(clean.hostActor, 'https://example.com/users/Alice');
  assert.deepEqual(clean.ready, {'https://example.com/users/Alice':true,'https://peer.test/users/Bob':false});
  assert.equal(core.validateState({...state,players:{black,white:'https://example.com/users/Alice'}}), null);
});

test('state validation rejects a self-declared host and incomplete active seats', () => {
  const base = {protocol:1,kind:'state',seq:1,round:1,hostActor:'@a@x.test',players:{black:'@a@x.test',white:'@b@y.test'},ready:{'@a@x.test':false,'@b@y.test':false},phase:'playing',turn:'black',moves:[],winner:null,finishReason:null,lastMove:null};
  assert.equal(core.validateState({...base,hostActor:'@mallory@z.test'}), null);
  assert.equal(core.validateState({...base,players:{black:'@a@x.test',white:null}}), null);
  assert.equal(core.validateState({...base,ready:{'@mallory@z.test':true}}), null);
});

test('line-win state is independently recomputed', () => {
  let game = core.newGame(2); const actors = {black:'@a@x.test',white:'@b@y.test'};
  [[5,5],[0,0],[6,6],[0,1],[7,7],[0,2],[8,8],[0,3],[9,9]].forEach(([r,c]) => { game = core.applyMove(game,r,c,actors[game.turn]).game; });
  const state = Object.assign({protocol:1,kind:'state',seq:9,hostActor:actors.black,players:actors,ready:{}},game);
  assert.equal(core.validateState(state).winner,'black');
  state.lastMove = {...state.lastMove,row:10}; assert.equal(core.validateState(state),null);
});

test('finished state keeps the authoritative turn and complete last move', () => {
  let game = core.newGame(3); const actors = {black:'@a@x.test',white:'@b@y.test'};
  [[5,5],[0,0],[6,6],[0,1],[7,7],[0,2],[8,8],[0,3],[9,9]].forEach(([r,c]) => { game = core.applyMove(game,r,c,actors[game.turn]).game; });
  const state = Object.assign({protocol:1,kind:'state',seq:12,hostActor:actors.black,players:actors,ready:{}},game);
  assert.equal(core.validateState({...state,turn:'white'}), null);
  assert.equal(core.validateState({...state,lastMove:{...state.lastMove,actor:actors.white}}), null);
  const resigned = {protocol:1,kind:'state',seq:2,round:3,hostActor:actors.black,players:actors,ready:{},phase:'finished',turn:'white',moves:[{row:7,col:7,color:'black',actor:actors.black}],lastMove:{row:7,col:7,color:'black',actor:actors.black},winner:'black',finishReason:'resign',winLine:[]};
  assert.ok(core.validateState(resigned));
  assert.equal(core.validateState({...resigned,winner:'white'}), null);
});

test('either player can resign on either turn without producing an invalid snapshot', () => {
  const actors = {black:'https://host.test/users/alice',white:'https://peer.test/users/bob'};
  for (const currentTurn of ['black', 'white']) {
    let game = core.newGame(4);
    if (currentTurn === 'white') game = core.applyMove(game, 7, 7, actors.black).game;
    const state = Object.assign({protocol:1,kind:'state',seq:8,hostActor:actors.black,players:actors,ready:{}}, game);
    for (const resigningColor of ['black', 'white']) {
      const resigned = core.resignGame(state, resigningColor);
      assert.equal(resigned.turn, resigningColor);
      assert.equal(resigned.winner, core.opposite(resigningColor));
      assert.ok(core.validateState(resigned), `${resigningColor} resignation on ${currentTurn} turn must validate`);
    }
  }
});

test('member departure clears lobbies and awards active games to the remaining player', () => {
  const host = 'https://host.test/users/alice';
  const peer = 'https://peer.test/users/bob';
  const lobby = {protocol:1,kind:'state',seq:2,round:1,hostActor:host,players:{black:peer,white:host},ready:{[peer]:true,[host]:false},phase:'lobby',turn:'black',moves:[],winner:null,finishReason:null,lastMove:null,winLine:[]};
  const vacatedLobby = core.memberDeparture(lobby, peer + '/');
  assert.equal(vacatedLobby.players.black, null);
  assert.equal(Object.keys(vacatedLobby.ready).some((actor) => core.sameActor(actor, peer)), false);
  assert.ok(core.validateState(vacatedLobby));

  const playing = {...lobby,seq:3,players:{black:host,white:peer},ready:{},phase:'playing'};
  const forfeited = core.memberDeparture(playing, peer);
  assert.equal(forfeited.phase, 'finished');
  assert.equal(forfeited.turn, 'white');
  assert.equal(forfeited.winner, 'black');
  assert.ok(core.validateState(forfeited));

  const reopened = core.memberDeparture(forfeited, peer);
  assert.equal(reopened.phase, 'lobby');
  assert.equal(reopened.players.white, null);
  assert.equal(reopened.round, 2);
  assert.ok(core.validateState(reopened));
});

test('room references accept local and cross-instance forms only', () => {
  assert.equal(core.validRoomReference('rm_local123'), true);
  assert.equal(core.validRoomReference('rm_remote123@example.com:8443'), true);
  assert.equal(core.validRoomReference('room-123'), false);
  assert.equal(core.validRoomReference('rm_bad@'), false);
});

test('realtime room message wrappers decode the authenticated sender', () => {
  const payload = {protocol:1,kind:'intent',nonce:'n1',action:'hello'};
  const event = {scope:'room',roomId:'rm_test',data:{type:'message',message:{sender_actor:'https://peer.test/users/bob',message_type:'gomoku.v1',payload}}};
  assert.deepEqual(core.decodeFederationEnvelope(event,'gomoku.v1'),{payload,sender:'https://peer.test/users/bob',room:'rm_test'});
});

test('history messages still decode directly', () => {
  const payload = {protocol:1,kind:'state',seq:1};
  const message = {sender_actor:'https://host.test/users/alice',message_type:'gomoku.v1',payload};
  assert.deepEqual(core.decodeFederationEnvelope(message,'gomoku.v1'),{payload,sender:'https://host.test/users/alice',room:''});
});

test('actor addresses degrade to readable nicknames', () => {
  assert.equal(core.nicknameFromActor('https://echootaku.cn/users/EchoOtaku'), 'EchoOtaku');
  assert.equal(core.nicknameFromActor('@alice@example.com'), 'alice');
  assert.equal(core.nicknameFromActor('https://example.com/users/%E6%98%9F%E9%87%8E/'), '星野');
});
