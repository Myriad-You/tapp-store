// ========================================
// Skland API 模块（森空岛接口封装，core 层加载）
// 分两层：原始请求（对应 manifest.apis）+ 二次包装（自动换取凭证）
// ========================================

var crypto = require('./api-crypto.js');

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0';

// ========================================
// 原始请求层：一一对应 manifest.apis，只构造请求头并调用 Tapp.api
// ========================================

function sign(path, params, timestamp, token) {
  var headers = {
    platform: '3',
    timestamp: timestamp,
    dId: UA,
    vName: '1.2.0'
  };
  var text = path + (params || '') + timestamp + JSON.stringify(headers);
  var hmacHex = crypto.hmacSha256(token, text);
  return crypto.md5(hmacHex);
}

function buildHeaders(path, params, cred, token) {
  var timestamp = String(Math.floor((new Date().getTime() - 300) / 1000));
  var s = sign(path, params, timestamp, token);
  return {
    platform: '3',
    timestamp: timestamp,
    dId: UA,
    vName: '1.2.0',
    cred: cred,
    sign: s
  };
}

// 鹰角：账号密码登录 → 账号 hgToken
async function loginByPasswordRaw(phone, password) {
  /*
  respond:
    {
      "status": 0,
      "type": "A",
      "msg": "OK",
      "data": {
          "token": "xxx"
      }
    }
  */
  return await Tapp.api('hypergryphLogin', { phone: phone, password: password });
}

// 鹰角：账号 hgToken → 一次性 OauthCode
async function grantCodeRaw(hgToken) {
  /*
    {
      "status": 0,
      "type": "A",
      "msg": "OK",
      "data": {
          "code": "mmKkGqm******************************************************************UjnSamjI9ow==",
          "uid": "12**********1"
      }
    }
  */
  return await Tapp.api('hypergryphOauth2', { token: hgToken });
}

// 森空岛：一次性 OauthCode → 会话cred + 会话token
async function getCredAndTokenRaw(code) {
  /*
    {
        "code": 0,
        "message": "OK",
        "timestamp": "1713614395",
        "data": {
            "cred": "********************************",
            "userId": "8****3",
            "token": "********************************"
        }
    }
  */
  return await Tapp.api('sklandGetCredByCode', {
    code: code,
    platform: '3',
    timestamp: String(Math.floor(Date.now() / 1000)),
    dId: UA,
    vName: '1.2.0'
  });
}

// 森空岛：获取玩家账户绑定
async function getPlayerBindingRaw(cred, token) {
  var h = buildHeaders('/api/v1/game/player/binding', '', cred, token);
  return await Tapp.api('sklandPlayerBinding', {
    platform: h.platform,
    timestamp: h.timestamp,
    dId: h.dId,
    vName: h.vName,
    cred: h.cred,
    sign: h.sign
  });
}

// 森空岛：一次性 OauthCode → 会话cred + 会话token
async function getPlayerInfoRaw(uid, cred, token) {
  /**
 * 获取玩家信息。
 *
 * 返回 JSON（森空岛统一包装）：
 * {
 *   code: 0,             // 0 = 成功
 *   message: "",         // 错误信息
 *   data: {
 *     currentTs: number, // 当前时间戳（秒）
 *     showConfig: { charSwitch: boolean, skinSwitch: boolean, standingsSwitch: boolean },
 *
 *     status: {                       // 玩家状态
 *       uid: string,
 *       name: string,                 // 昵称
 *       level: number,                // 博士等级
 *       avatar: { type: string, id: string, url: string },  // 头像
 *       registerTs: number,           // 入职时间戳（秒）
 *       mainStageProgress: string,    // 主线进度，例 "main_15-03"
 *       secretary: { charId: string, skinId: string },      // 看板干员
 *       resume: string,               // 签名
 *       subscriptionEnd: number,
 *       ap: { current: number, max: number, lastApAddTime: number, completeRecoveryTime: number },  // 理智
 *       storeTs: number,
 *       lastOnlineTs: number,
 *       charCnt: number,              // 干员数
 *       furnitureCnt: number,         // 家具数
 *       skinCnt: number,              // 时装数
 *       exp: { current: number, max: number },  // 博士经验
 *       serverName: string
 *     },
 *
 *     medal: {                        // 蚀刻章
 *       type: string,                 // 例 "TEMPLATE"
 *       template: string,             // 展示的章组模板 id
 *       templateMedalList: string[],
 *       customMedalLayout: [],
 *       total: number                 // 蚀刻章总数
 *     },
 *
 *     assistChars: [                  // 助战干员（最多 3 个）
 *       {
 *         charId: string,             // 例 "char_002_amiya"
 *         skinId: string,             // 例 "char_002_amiya#2"
 *         level: number,
 *         evolvePhase: number,        // 精英化 0/1/2
 *         potentialRank: number,      // 潜能 0-5
 *         skillId: string,            // 例 "skchr_turdus_1"
 *         mainSkillLvl: number,
 *         specializeLevel: number,
 *         equip: object|null
 *       }
 *     ],
 *
 *     chars: [                        // 全部干员
 *       {
 *         charId: string,
 *         skinId: string,
 *         level: number,
 *         evolvePhase: number,        // 精英化 0/1/2
 *         potentialRank: number,      // 潜能 0-5
 *         mainSkillLvl: number,
 *         skills: [{ id: string, specializeLevel: number }],
 *         equip: [{ id: string, level: number, locked: boolean }],
 *         favorPercent: number,       // 信赖
 *         defaultSkillId: string,     // 默认技能，例 "skchr_amiya_2"
 *         gainTime: number,
 *         defaultEquipId: string,
 *         sortId: number,
 *         exp: number,
 *         gold: number,
 *         rarity: number
 *       }
 *     ],
 *
 *     charInfoMap: {                  // 角色基础信息表（key = charId）
 *       [charId]: {
 *         id: string,
 *         name: string,               // 中文名，例 "阿米娅"
 *         nationId: string,
 *         groupId: string,
 *         displayNumber: string,
 *         rarity: number,             // 星级
 *         profession: string,         // 职业，例 "CASTER"
 *         subProfessionId: string,
 *         subProfessionName: string,
 *         appellation: string,
 *         sortId: number
 *       }
 *     },
 *
 *     skins: [{ id: string, ts: number }],  // 已拥有的皮肤
 *     skinInfoMap: {                  // 皮肤信息表（key = skinId）
 *       [skinId]: { id: string, name: string, brandId: string, sortId: number, displayTagId: string, charId: string }
 *     },
 *
  *     building: {                     // 基建
  *       tiredChars: [{ charId: string, ap: number, lastApAddTime: number, roomSlotId: string, index: number, bubble: object, workTime: number }],
  *       powers: ..., manufactures: ..., tradings: ..., dormitories: ...,
  *       meeting: ..., hire: ..., training: ..., labor: ...,
  *       furniture: { total: number },  // 家具总数（真正来源，status.furnitureCnt 不可靠）
  *       elevators: ..., corridors: ..., control: ...
  *     },
 *     recruit: [{ startTs: number, finishTs: number, state: number }],  // 公开招募
 *
 *     // ---- 游戏模式（records + 对应 InfoMap）----
 *     campaign: {                     // 剿灭
 *       records: [{ campaignId: string, maxKills: number }],
 *       reward: object
 *     },
 *     campaignInfoMap: { [id]: { id: string, name: string, campaignZoneId: string, picUrl: string } },
 *     campaignZoneInfoMap: { [id]: { id: string, name: string } },
 *     stageInfoMap: { [id]: { id: string, code: string, name: string, zoneId: string, diffGroup: string, stageType: string, dangerLevel: string, apCost: number, difficulty: string } },
 *
 *     tower: {                        // 保全派驻
 *       records: [{ towerId: string, best: number }],
 *       reward: object
 *     },
 *     towerInfoMap: { [id]: { id: string, name: string, subName: string, picUrl: string } },
 *
 *     rogue: {                        // 集成战略
 *       records: [{ rogueId: string, relicCnt: number, bank: object, clearTime: number, bpLevel: number, medal: object }]
 *     },
 *     rogueInfoMap: { [id]: { id: string, name: string, sort: number, picUrl: string } },
 *
 *     routine: { daily: { current: number, total: number }, weekly: { current: number, total: number } },  // 日常/周常
 *
 *     activity: [                     // 活动剧情
 *       { actId: string, actReplicaId: string, zones: [{ zoneId: string, zoneReplicaId: string, clearedStage: number, totalStage: number }] }
 *     ],
 *     activityInfoMap: { [id]: { id: string, name: string, startTime: number, endTime: number, rewardEndTime: number, isReplicate: boolean, type: string, dropItemIds: string[], shopGoodItemIds: string[], favorUpList: [], picUrl: string } },
 *
 *     sandbox: [                      // 生息演算
 *       { id: string, name: string, maxDay: number, maxDayChallenge: number, mainQuest: number, subQuest: object[], baseLv: number, unlockNode: number, enemyKill: number, createRift: number, fixRift: number[], picUrl: string }
 *     ],
 *     bossRush: [{ id: string, record: object, picUrl: string }],  // 险地
 *     bannerList: [{ id: string, sortId: number, imgUrl: string, link: string, startAtTs: number, endAtTs: number, status: number }],
 *
 *     equipmentInfoMap: { [id]: { id: string, name: string, typeIcon: string, shiningColor: string } },  // 模组
 *     manufactureFormulaInfoMap: { [id]: { id: string, itemId: string, count: number, weight: number, costs: [], costPoint: number } },
 *
 *     charAssets: [],                 // 空数组
 *     skinAssets: string[],           // 皮肤 id 列表
 *     skinAssetList: { ids: string[] },
 *     activityBannerList: { list: [] }
 *   }
 * }
 */
  var query = 'uid=' + uid;
  var h = buildHeaders('/api/v1/game/player/info', query, cred, token);
  return await Tapp.api('sklandPlayerInfo', {
    uid: uid,
    platform: h.platform,
    timestamp: h.timestamp,
    dId: h.dId,
    vName: h.vName,
    cred: h.cred,
    sign: h.sign
  });
}

// 森空岛：一次性 OauthCode → 会话cred + 会话token
async function getCultivateRaw(uid, cred, token) {
  var query = 'uid=' + uid;
  var h = buildHeaders('/api/v1/game/cultivate/player', query, cred, token);
  return await Tapp.api('sklandCultivate', {
    uid: uid,
    platform: h.platform,
    timestamp: h.timestamp,
    dId: h.dId,
    vName: h.vName,
    cred: h.cred,
    sign: h.sign
  });
}

// 森空岛：校验 cred 有效性
async function checkCredRaw(cred) {
  return await Tapp.api('sklandCheckCred', { cred: cred });
}

// ========================================
// 二次包装：自动换取 cred / 签名 token 后调用原始请求
// ========================================

// 账号密码登录 → 账号 HgToken
async function loginByPassword(phone, password) {
  var res = await loginByPasswordRaw(phone, password);
  if (!res || res.status !== 0 || !res.data || !res.data.token) {
    throw new Error('login failed' + (res && res.msg ? ': ' + res.msg : ''));
  }
  return res.data.token;
}

// 会话凭证缓存：hgToken → { cred, token, expireAt }；未过期直接复用，过期后重新换取
var CRED_CACHE_TTL_MS = 30 * 60 * 1000;
var _credCache = new Map();

//账号 HgToken → 会话CredAndToken
async function getCredAndTokenByHgToken(hgToken) {
  var cached = _credCache.get(hgToken);
  if (cached && Date.now() < cached.expireAt) {
    return { cred: cached.cred, token: cached.token };
  }

  // 换取新的会话 cred + 签名 token
  var oauth = await grantCodeRaw(hgToken);
  if (!oauth || oauth.status !== 0 || !oauth.data || !oauth.data.code) {
    var oauthErr = new Error('oauth2 grant failed' + (oauth && oauth.msg ? ': ' + oauth.msg : ''));
    oauthErr.authError = true;
    throw oauthErr;
  }

  var res = await getCredAndTokenRaw(oauth.data.code);
  if (!res || res.code !== 0 || !res.data || !res.data.cred || !res.data.token) {
    throw new Error('generate cred failed' + (res && res.message ? ': ' + res.message : ''));
  }

  _credCache.set(hgToken, {
    cred: res.data.cred,
    token: res.data.token,
    expireAt: Date.now() + CRED_CACHE_TTL_MS
  });
  return { cred: res.data.cred, token: res.data.token };
}

// 业务调用：凭证失效（返回码或异常）时，强制刷新凭证并重试一次
async function withCredRetry(hgToken, run) {
  var c = await getCredAndTokenByHgToken(hgToken);
  try {
    var first = await run(c.cred, c.token);
    var isFirstAuthFail = !!first && (
      first.code === 10000 ||
      first.code === 10002 ||
      /登录|过期|expired|unauthor/i.test(String(first.message || first.msg || ''))
    );
    if (!isFirstAuthFail) return first;
  } catch (e) {
    var em = String(e);
    if (!/HTTP 401|10000|10002|登录|过期|expired|unauthor/i.test(em)) throw e;
  }

  _credCache.delete(hgToken);
  c = await getCredAndTokenByHgToken(hgToken);
  var second = await run(c.cred, c.token);
  var isSecondAuthFail = !!second && (
    second.code === 10000 ||
    second.code === 10002 ||
    /登录|过期|expired|unauthor/i.test(String(second.message || second.msg || ''))
  );
  if (isSecondAuthFail) {
    var authErr = new Error((second && (second.message || second.msg)) || 'cred invalid after refresh');
    authErr.authError = true;
    throw authErr;
  }
  return second;
}

async function getPlayerBinding(hgToken) {
  return await withCredRetry(hgToken, function (cred, token) {
    return getPlayerBindingRaw(cred, token);
  });
}

async function getPlayerInfo(uid, hgToken) {
  return await withCredRetry(hgToken, function (cred, token) {
    return getPlayerInfoRaw(uid, cred, token);
  });
}

async function getCultivate(uid, hgToken) {
  return await withCredRetry(hgToken, function (cred, token) {
    return getCultivateRaw(uid, cred, token);
  });
}

async function checkCred(hgToken) {
  var c = await getCredAndTokenByHgToken(hgToken);
  return await checkCredRaw(c.cred);
}

module.exports = {
  // 原始请求
  loginByPasswordRaw: loginByPasswordRaw,
  grantCodeRaw: grantCodeRaw,
  getCredAndTokenRaw: getCredAndTokenRaw,
  getPlayerBindingRaw: getPlayerBindingRaw,
  getPlayerInfoRaw: getPlayerInfoRaw,
  getCultivateRaw: getCultivateRaw,
  checkCredRaw: checkCredRaw,

  // 二次包装
  loginByPassword: loginByPassword,
  getCredAndTokenByHgToken: getCredAndTokenByHgToken,
  getPlayerBinding: getPlayerBinding,
  getPlayerInfo: getPlayerInfo,
  getCultivate: getCultivate,
  checkCred: checkCred
};
