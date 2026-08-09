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

test('canonical state validation rejects reordered colors and duplicates', () => {
  const base = {protocol:1,kind:'state',seq:1,round:1,hostActor:'@a@x.test',players:{black:'@a@x.test',white:'@b@y.test'},ready:{},phase:'playing',turn:'white',moves:[{row:7,col:7,color:'black',actor:'@a@x.test'}],winner:null,finishReason:null,lastMove:{row:7,col:7,color:'black',actor:'@a@x.test'}};
  assert.ok(core.validateState(base));
  assert.equal(core.validateState({...base,moves:[{row:7,col:7,color:'white',actor:'@b@y.test'}]}), null);
  assert.equal(core.validateState({...base,turn:'black',moves:[...base.moves,{...base.moves[0],color:'white',actor:'@b@y.test'}]}), null);
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
