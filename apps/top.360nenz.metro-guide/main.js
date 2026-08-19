/* 地铁通：离线数据、在线缓存和 APK CSV 生成物共享同一数据契约。 */
var METRO_DATA = {
  beijing: { name:'北京', source:'内置精简数据', version:'20260819', lines:[
    { id:'1号线', color:'#C23A30', stations:['苹果园','古城','八角游乐园','八宝山','玉泉路','五棵松','万寿路','公主坟','军事博物馆','木樨地','南礼士路','复兴门','西单','天安门西','天安门东','王府井','东单','建国门','永安里','国贸','大望路','四惠'] },
    { id:'2号线', color:'#005A9C', loop:true, stations:['西直门','车公庄','阜成门','复兴门','长椿街','宣武门','和平门','前门','崇文门','北京站','建国门','朝阳门','东四十条','东直门','雍和宫','安定门','鼓楼大街','积水潭'] },
    { id:'4号线', color:'#008C95', stations:['安河桥北','北宫门','西苑','圆明园','北京大学东门','中关村','海淀黄庄','人民大学','魏公村','国家图书馆','动物园','西直门','新街口','平安里','西四','灵境胡同','西单','宣武门','菜市口','陶然亭','北京南站','马家堡','角门西','公益西桥'] },
    { id:'5号线', color:'#A43D91', stations:['天通苑北','天通苑','立水桥','北苑路北','大屯路东','惠新西街北口','惠新西街南口','和平西桥','和平里北街','雍和宫','北新桥','张自忠路','东四','灯市口','东单','崇文门','天坛东门','蒲黄榆','刘家窑','宋家庄'] },
    { id:'10号线', color:'#009B77', loop:true, stations:['巴沟','苏州街','海淀黄庄','知春里','知春路','西土城','牡丹园','健德门','北土城','安贞门','惠新西街南口','芍药居','太阳宫','三元桥','亮马桥','农业展览馆','团结湖','呼家楼','金台夕照','国贸','双井','劲松','潘家园','十里河','分钟寺','成寿寺','宋家庄'] },
    { id:'14号线', color:'#D6A32A', stations:['张郭庄','大瓦窑','郭庄子','大井','七里庄','西局','丽泽商务区','北京南站','永定门外','景泰','蒲黄榆','方庄','十里河','九龙山','平乐园','北京朝阳站'] },
    { id:'16号线', color:'#6CA6CE', stations:['北安河','温阳路','稻香湖路','屯佃','永丰','西北旺','马连洼','农大南路','西苑','万泉河桥','苏州街','国家图书馆','二里沟','甘家口','玉渊潭东门','木樨地','达官营','红莲南路','丰台站','丰台南路','富丰桥','看丹','榆树庄'] }
  ]}
};
var METRO_CITIES = [
  ['beijing','北京'],['shanghai','上海'],['guangzhou','广州'],['shenzhen','深圳'],['hongkong','香港'],['taipei','台北'],['chengdu','成都'],['chongqing','重庆'],['hangzhou','杭州'],['wuhan','武汉'],['nanjing','南京'],['zhengzhou','郑州'],['xian','西安'],['suzhou','苏州'],['qingdao','青岛'],['tianjin','天津'],['dalian','大连'],['changsha','长沙'],['hefei','合肥'],['ningbo','宁波'],['shenyang','沈阳'],['kunming','昆明'],['guiyang','贵阳'],['wuxi','无锡'],['fuzhou','福州'],['changchun','长春'],['nanchang','南昌'],['nanning','南宁'],['wenzhou','温州'],['jinhua','金华'],['xiamen','厦门'],['jinan','济南'],['harbin','哈尔滨'],['shijiazhuang','石家庄'],['xuzhou','徐州'],['nantong','南通'],['changzhou','常州'],['taiyuan','太原'],['taizhou','台州'],['hohhot','呼和浩特'],['wuhu','芜湖'],['luoyang','洛阳'],['kaohsiung','高雄'],['dongguan','东莞'],['lanzhou','兰州'],['urumqi','乌鲁木齐'],['taichung','台中'],['macau','澳门'],['foshan','佛山'],['shaoxing','绍兴'],['chuzhou','滁州'],['haining','海宁'],['taoyuan','桃园'],['xuchang','许昌'],['maanshan','马鞍山']
].map(function(city, order) { return { id:city[0], name:city[1], order:order }; });
var metroState = { city:'beijing', favorites:[], zoom:100, panX:0, panY:0, dragging:false, dragStart:null, assetUrls:{}, mapUrls:{}, versions:{}, cityCache:{}, loadingCity:'', mapVersion:'', cityRequest:0, stationTarget:'from', stationLineFilter:'', mode:'depart', fare:'ic', preference:'time' };
var METRO_CACHE_KEY = 'metro-guide.city-cache.v1';
var METRO_RECENT_KEY = 'metro-guide.recent-selection.v1';
var METRO_MAP_CACHE_KEY = 'metro-guide.map-meta.v1';
var METRO_MAP_PAGE = 'https://www.metroman.cn/maps/';
var METRO_V2_CITIES = ['beijing','shanghai','hongkong','taipei'];

function data() { return METRO_DATA[metroState.city] || { name:cityMeta(metroState.city).name, source:'等待从 MetroMan 下载', version:'', lines:[] }; }
function cityMeta(id) { return METRO_CITIES.find(function(city) { return city.id === id; }) || { id:id, name:id }; }
function apiData(value) { return value && value.success === true && Object.prototype.hasOwnProperty.call(value, 'data') ? value.data : value; }
var METRO_API_TIMEOUT = 12000;
var METRO_STORAGE_TIMEOUT = 4000;
function withTimeout(task, label, timeout) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      reject(new Error(label + ' 请求超时'));
    }, timeout || METRO_API_TIMEOUT);
    Promise.resolve().then(task).then(function(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
function metroApi(name, params) {
  return withTimeout(function() {
    if (typeof Tapp === 'undefined' || typeof Tapp.api !== 'function') throw new Error('当前宿主不支持声明式网络 API');
    var value = params || {};
    switch (name) {
      case 'metroVersionManifest': return Tapp.api('metroVersionManifest', value);
      case 'metroPlannerPage': return Tapp.api('metroPlannerPage', value);
      case 'metroPlannerV2Page': return Tapp.api('metroPlannerV2Page', value);
      case 'metroPlannerV2Result': return Tapp.api('metroPlannerV2Result', value);
      case 'metroPlannerResult': return Tapp.api('metroPlannerResult', value);
      case 'metroMapPage': return Tapp.api('metroMapPage', value);
      default: throw new Error('未声明的 MetroMan API: ' + name);
    }
  }, 'MetroMan ' + name);
}
function storageGet(key, fallback) {
  return withTimeout(function() {
    if (typeof Tapp === 'undefined' || !Tapp.storage || typeof Tapp.storage.get !== 'function') return fallback;
    return Tapp.storage.get(key);
  }, '本地缓存读取', METRO_STORAGE_TIMEOUT).then(function(value) { return value === undefined ? fallback : value; }, function() { return fallback; });
}
function storageSet(key, value) {
  return withTimeout(function() {
    if (typeof Tapp === 'undefined' || !Tapp.storage || typeof Tapp.storage.set !== 'function') return;
    return Tapp.storage.set(key, value);
  }, '本地缓存写入', METRO_STORAGE_TIMEOUT).catch(function() {});
}
function notify(message, type) { try { Tapp.ui.showNotification({ title:type === 'error' ? '操作失败' : '地铁通', message:message, type:type || 'success', duration:2800 }); } catch (_) {} }
function readableError(error) {
  var message = error && error.message ? error.message : String(error || '未知错误');
  if (/network:fetch|permission|grant|forbidden|403/i.test(message)) return '宿主未授予联网权限，请在 Tapp 权限中启用 network:fetch';
  if (/undeclared|not declared|not found|unknown api|definition/i.test(message)) return '宿主未注册地铁通的 MetroMan API，请重新安装新版 Tapp';
  return message.replace(/^Error:\s*/i, '').slice(0, 140);
}
function setNetworkStatus(kind, message, detail) {
  var status = document.querySelector('[data-network-status]');
  if (!status) return;
  status.className = 'network-status' + (kind ? ' is-' + kind : '');
  var label = status.querySelector('span');
  if (label) label.textContent = message;
  status.title = detail || message;
}
async function verifyNetworkApis() {
  if (typeof Tapp === 'undefined' || typeof Tapp.api !== 'function') throw new Error('当前宿主不支持声明式网络 API');
  if (Array.isArray(Tapp.permissions) && Tapp.permissions.indexOf('network:fetch') < 0) throw new Error('network:fetch permission is not granted');
  // Manifest 已声明完整的 MetroMan API。部分 0.3.x 宿主虽暴露 api.list，
  // 但列表桥接不会返回；不能把它作为实际请求的前置条件。
}
function validCity(value) { return value && typeof value.name === 'string' && Array.isArray(value.lines) && value.lines.length > 0 && value.lines.some(function(line) { return Array.isArray(line.stations) && line.stations.length > 1; }) && value.lines.every(function(line) { return typeof line.id === 'string' && /^#[0-9a-f]{6}$/i.test(line.color) && Array.isArray(line.stations) && line.stations.every(function(station) { return typeof station === 'string' && station.length > 0; }); }); }
function allStations() { var seen = {}; return data().lines.flatMap(function(line) { return line.stations; }).filter(function(name) { if (seen[name]) return false; seen[name] = true; return true; }); }
function lineAt(line, station) { return line.stations.indexOf(station); }
function neighbors(station) { var result = []; data().lines.forEach(function(line) { var index = lineAt(line, station); if (index < 0) return; [-1,1].forEach(function(step) { var nextIndex = index + step; if (line.loop) nextIndex = (nextIndex + line.stations.length) % line.stations.length; var next = line.stations[nextIndex]; if (next) result.push({ station:next, line:line }); }); }); return result; }
function findRoute(from, to) {
  if (allStations().indexOf(from) < 0 || allStations().indexOf(to) < 0) return null;
  if (from === to) return { stations:[from], segments:[], transfers:0, hops:0 };
  var queue = [{ station:from, active:null, transfers:0, hops:0, path:[from], usedLines:[] }]; var best = {};
  while (queue.length) {
    queue.sort(function(a,b) { return (a.transfers * 100 + a.hops) - (b.transfers * 100 + b.hops); });
    var current = queue.shift();
    if (current.station === to) {
      var segments = [];
      current.path.forEach(function(station, index) { if (!index) return; var line = current.usedLines[index - 1]; var previous = segments[segments.length - 1]; if (previous && previous.line === line) { previous.to = station; previous.stops += 1; } else segments.push({ line:line, from:current.path[index - 1], to:station, stops:1 }); });
      return { stations:current.path, segments:segments, transfers:current.transfers, hops:current.hops };
    }
    neighbors(current.station).forEach(function(next) { var transfer = current.active && current.active !== next.line ? 1 : 0; var transfers = current.transfers + transfer; var hops = current.hops + 1; var key = next.station + '|' + data().lines.indexOf(next.line); var cost = transfers * 100 + hops; if (best[key] !== undefined && best[key] <= cost) return; best[key] = cost; queue.push({ station:next.station, active:next.line, transfers:transfers, hops:hops, path:current.path.concat(next.station), usedLines:current.usedLines.concat(next.line) }); });
  }
  return null;
}

function cityHasResource(cityId) { return validCity(METRO_DATA[cityId]) || Boolean(metroState.mapUrls[cityId]); }
function cityLabel(city) { var bundled = city.id === 'beijing' || city.id === 'shanghai'; if (bundled && validCity(METRO_DATA[city.id])) return city.name + ' · 离线'; if (validCity(METRO_DATA[city.id]) || metroState.mapUrls[city.id]) return city.name + ' · 已缓存'; return city.name + ' · 需下载'; }
function sortedCities() { return METRO_CITIES.slice().sort(function(a,b) { var aLoaded = cityHasResource(a.id) ? 0 : 1; var bLoaded = cityHasResource(b.id) ? 0 : 1; return aLoaded - bLoaded || a.order - b.order; }); }
function renderCityOptions() { var cities = sortedCities(); document.querySelectorAll('[data-city]').forEach(function(select) { var selected = metroState.city; select.replaceChildren(); cities.forEach(function(city) { var option = document.createElement('option'); option.value = city.id; option.textContent = cityLabel(city); option.selected = city.id === selected; select.appendChild(option); }); select.value = selected; }); }
function stationLines(name) { return data().lines.filter(function(line) { return line.stations.indexOf(name) >= 0; }); }
function renderStationLineIndex() { var target = document.querySelector('[data-station-line-index]'); if (!target) return; target.replaceChildren(); var all = document.createElement('button'); all.type = 'button'; all.dataset.lineFilter = ''; all.className = metroState.stationLineFilter ? '' : 'is-active'; all.textContent = '全部'; all.title = '显示全部站点'; target.appendChild(all); data().lines.forEach(function(line) { var button = document.createElement('button'); button.type = 'button'; button.dataset.lineFilter = line.id; button.className = metroState.stationLineFilter === line.id ? 'is-active' : ''; button.textContent = lineIndexName(line); button.title = '仅显示 ' + line.id + ' 站点'; target.appendChild(button); }); }
function renderStations(filter) { var target = document.querySelector('[data-station-list]'); if (!target) return; renderStationLineIndex(); target.replaceChildren(); var query = String(filter || '').trim().toLocaleLowerCase('zh-CN'); var names = allStations().filter(function(name) { var lineMatch = !metroState.stationLineFilter || stationLines(name).some(function(line) { return line.id === metroState.stationLineFilter; }); return lineMatch && (!query || name.toLocaleLowerCase('zh-CN').indexOf(query) >= 0); }); names.forEach(function(name) { var button = document.createElement('button'); button.type = 'button'; button.dataset.stationValue = name; var nameNode = document.createElement('strong'); nameNode.className = 'station-option-name'; nameNode.textContent = name; var linesNode = document.createElement('span'); linesNode.className = 'station-option-lines'; stationLines(name).forEach(function(line) { var badge = document.createElement('span'); badge.className = 'station-line-badge'; badge.style.setProperty('--line-color', line.color); badge.textContent = lineTagName(line); badge.title = line.id; linesNode.appendChild(badge); }); button.append(nameNode, linesNode); target.appendChild(button); }); if (!names.length) { var empty = document.createElement('p'); empty.className = 'station-list-empty'; empty.textContent = '没有匹配的站点'; target.appendChild(empty); } }
function showRouteSurface() { document.querySelector('[data-empty]').hidden = true; document.querySelector('[data-error]').hidden = true; document.querySelector('[data-route]').hidden = false; }
function clearRouteMeta() { ['[data-duration]','[data-route] [data-fare]','[data-distance]','[data-result-context]'].forEach(function(selector) { document.querySelector(selector).textContent = ''; }); }
function renderRoute(route, from, to) { showRouteSurface(); clearRouteMeta(); document.querySelector('[data-result-source]').textContent = '本地少换乘方案'; document.querySelector('[data-route-title]').textContent = from + ' → ' + to; document.querySelector('[data-time]').textContent = '约 ' + Math.max(3, route.hops * 2 + route.transfers * 5) + ' 分钟'; document.querySelector('[data-stops]').textContent = route.hops + ' 站'; document.querySelector('[data-transfers]').textContent = route.transfers ? '换乘 ' + route.transfers + ' 次' : '无需换乘'; var steps = document.querySelector('[data-steps]'); steps.replaceChildren(); var usedLines = []; route.segments.forEach(function(segment) { for (var i = 0; i < segment.stops; i += 1) usedLines.push(segment.line); }); route.stations.forEach(function(station, index) { var line = usedLines[Math.min(index, usedLines.length - 1)] || route.segments[0] && route.segments[0].line; var previous = index ? usedLines[index - 1] : null; var meta = index === 0 ? '从这里出发' : index === route.stations.length - 1 ? '到达目的地' : previous && line && previous !== line ? '换乘 ' + line.id : '沿线经过'; appendRouteStep(steps, station, meta, line && lineTagName(line), line && line.color); }); }
function appendRouteStep(target, station, meta, lineName, color) { var row = document.createElement('div'); row.className = 'route-step'; row.style.setProperty('--step-color', color || '#0f766e'); var dot = document.createElement('span'); dot.className = 'station-dot'; var copy = document.createElement('div'); var title = document.createElement('div'); title.className = 'station-name'; title.textContent = station; var detail = document.createElement('div'); detail.className = 'station-meta'; detail.textContent = meta; copy.append(title, detail); row.append(dot, copy); if (lineName) { var badge = document.createElement('span'); badge.className = 'line-badge'; badge.textContent = lineName; row.appendChild(badge); } target.appendChild(row); }
function formatPlannerDatetime() { var value = document.querySelector('[data-datetime]').value; var date = value ? new Date(value) : new Date(); var pad = function(number) { return String(number).padStart(2, '0'); }; var result = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()); if (metroState.mode === 'first' || metroState.mode === 'last') return result; return result + pad(date.getHours()) + pad(date.getMinutes()); }
function plannerContext() { var modes = { depart:'出发', arrive:'到达', first:'首班车', last:'末班车' }; return modes[metroState.mode] + ' · ' + (metroState.fare === 'cash' ? '现金' : 'IC 卡') + ' · ' + ({ time:'省时间', transfer:'少换乘', fare:'省票价' }[metroState.preference]); }
function parseOfficialPlan(html) { if (typeof DOMParser === 'undefined') return null; var doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); var card = doc.querySelector('.planner-v2-result-card'); if (!card) return null; var text = function(selector, root) { var node = (root || card).querySelector(selector); return node ? node.textContent.trim().replace(/\s+/g, ' ') : ''; }; var meta = Array.from(card.querySelectorAll('.planner-v2-result-card__summary-meta span')).map(function(node) { return node.textContent.trim(); }).filter(function(value) { return value && value !== '·'; }); var rides = Array.from(card.querySelectorAll('.planner-v2-result-card__ride')).map(function(ride) { var style = ride.getAttribute('style') || ''; var color = (style.match(/#[0-9a-f]{6}/i) || ['#0F766E'])[0]; var stations = Array.from(ride.querySelectorAll('.planner-v2-result-card__station-name')).map(function(node) { return node.textContent.trim(); }); return { from:stations[0] || '', to:stations[stations.length - 1] || '', line:text('.planner-v2-result-card__line-name', ride), stops:text('.planner-v2-result-card__line-stops', ride), direction:text('.planner-v2-result-card__line-direction', ride), detail:text('.planner-v2-result-card__line-meta', ride), start:text('.planner-v2-result-card__station--board .planner-v2-result-card__time', ride), end:text('.planner-v2-result-card__station--alight .planner-v2-result-card__time', ride), color:color }; }).filter(function(ride) { return ride.from && ride.to && ride.line; }); return rides.length ? { time:text('.planner-v2-result-card__summary-time-main'), duration:text('.planner-v2-result-card__summary-duration'), meta:meta, rides:rides } : null; }
function renderOfficialPlan(plan, from, to) { showRouteSurface(); clearRouteMeta(); document.querySelector('[data-result-source]').textContent = 'MetroMan 新版方案'; document.querySelector('[data-route-title]').textContent = from + ' → ' + to; document.querySelector('[data-result-context]').textContent = plannerContext(); document.querySelector('[data-time]').textContent = plan.time; document.querySelector('[data-duration]').textContent = plan.duration; document.querySelector('[data-stops]').textContent = plan.rides.reduce(function(total, ride) { return total + (Number((ride.stops.match(/\d+/) || [0])[0]) || 0); }, 0) + ' 站'; document.querySelector('[data-route] [data-fare]').textContent = plan.meta.find(function(item) { return item.indexOf('票价') === 0; }) || ''; document.querySelector('[data-distance]').textContent = plan.meta.find(function(item) { return /公里/.test(item); }) || ''; var transfer = plan.meta.find(function(item) { return item.indexOf('换乘') === 0; }) || (plan.rides.length > 1 ? '换乘 ' + (plan.rides.length - 1) + ' 次' : '无需换乘'); document.querySelector('[data-transfers]').textContent = transfer; var steps = document.querySelector('[data-steps]'); steps.replaceChildren(); plan.rides.forEach(function(ride, index) { appendRouteStep(steps, ride.from, (ride.start ? ride.start + ' · ' : '') + '乘坐 ' + ride.line + (ride.direction ? ' · ' + ride.direction : ''), lineTagName({ id:ride.line }), ride.color); appendRouteStep(steps, ride.to, (ride.end ? ride.end + ' · ' : '') + (index === plan.rides.length - 1 ? '到达目的地' : '站内换乘') + (ride.detail ? ' · ' + ride.detail : ''), null, ride.color); }); }
function showRouteError(message) { document.querySelector('[data-route]').hidden = true; document.querySelector('[data-empty]').hidden = true; document.querySelector('[data-error]').hidden = false; document.querySelector('[data-error-text]').textContent = message; }
async function search() { var from = document.querySelector('[data-from]').value.trim(); var to = document.querySelector('[data-to]').value.trim(); var route = findRoute(from, to); if (!route) { showRouteError('请从当前城市的站点列表中选择有效站点。'); return; } var button = document.querySelector('[data-action="search"]'); button.disabled = true; button.textContent = '正在查询…'; try { var slugs = data().stationSlugs || {}; if (METRO_V2_CITIES.indexOf(metroState.city) >= 0 && slugs[from] && slugs[to]) { var result = await metroApi('metroPlannerV2Result', { city:metroState.city, route:slugs[from] + '-to-' + slugs[to], mode:metroState.mode, datetime:formatPlannerDatetime(), preference:metroState.preference, fare:metroState.fare }); var value = apiData(result); var html = typeof value === 'string' ? value : value && (value.body || value.text || value.data); var plan = parseOfficialPlan(html); if (plan) { renderOfficialPlan(plan, from, to); return; } } renderRoute(route, from, to); } catch (_) { renderRoute(route, from, to); notify('MetroMan 新版结果暂不可用，已显示本地少换乘方案。', 'warning'); } finally { button.disabled = false; button.innerHTML = '<span aria-hidden="true">⌕</span>查询路线'; } }

function setView(view) { document.querySelectorAll('[data-view-panel]').forEach(function(panel) { panel.hidden = panel.dataset.viewPanel !== view; }); document.querySelectorAll('[data-view]').forEach(function(button) { var active = button.dataset.view === view; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); }); }
function clampPan() { var viewport = document.querySelector('[data-map-viewport]'); var image = document.querySelector('[data-map-image]'); if (!viewport || !image) return; var scale = metroState.zoom / 100; var boundX = Math.max(0, (image.clientWidth * scale - viewport.clientWidth) / 2); var boundY = Math.max(0, (image.clientHeight * scale - viewport.clientHeight) / 2); metroState.panX = Math.min(boundX, Math.max(-boundX, metroState.panX)); metroState.panY = Math.min(boundY, Math.max(-boundY, metroState.panY)); }
function applyMapTransform() { var image = document.querySelector('[data-map-image]'); if (!image) return; clampPan(); image.style.transform = 'translate(-50%, -50%) translate3d(' + metroState.panX + 'px,' + metroState.panY + 'px,0) scale(' + (metroState.zoom / 100) + ')'; document.querySelector('[data-action="zoom-reset"]').textContent = metroState.zoom + '%'; }
function setZoom(next, anchor) { var viewport = document.querySelector('[data-map-viewport]'); var previousScale = metroState.zoom / 100; var zoom = Math.min(500, Math.max(50, Math.round(next / 5) * 5)); if (anchor && viewport && previousScale) { var rect = viewport.getBoundingClientRect(); var cursorX = anchor.clientX - rect.left - rect.width / 2; var cursorY = anchor.clientY - rect.top - rect.height / 2; var nextScale = zoom / 100; metroState.panX = cursorX - (cursorX - metroState.panX) * nextScale / previousScale; metroState.panY = cursorY - (cursorY - metroState.panY) * nextScale / previousScale; } metroState.zoom = zoom; if (zoom <= 100) { metroState.panX = 0; metroState.panY = 0; } applyMapTransform(); }
function resetMap() { metroState.zoom = 100; metroState.panX = 0; metroState.panY = 0; applyMapTransform(); }
async function loadAssetJson(path) { var asset = await Tapp.assets.getArrayBuffer(path); return JSON.parse(new TextDecoder('utf-8').decode(asset.buffer)); }
async function loadCachedCities() {
  var oldCache = await storageGet(METRO_CACHE_KEY, null);
  if (oldCache && validCity(oldCache.shanghai) && String(oldCache.shanghai.version || '') >= String(METRO_DATA.shanghai.version || '')) METRO_DATA.shanghai = oldCache.shanghai;
  await Promise.all(METRO_CITIES.map(async function(city) { var cached = await storageGet('metro-guide.city.' + city.id + '.v1', null); if (validCity(cached)) METRO_DATA[city.id] = cached; }));
  var mapCache = await storageGet(METRO_MAP_CACHE_KEY, null);
  if (mapCache && mapCache.cities) Object.keys(mapCache.cities).forEach(function(cityId) { if (mapCache.cities[cityId] && mapCache.cities[cityId].url) metroState.mapUrls[cityId] = mapCache.cities[cityId].url; });
  else if (mapCache && mapCache.url) metroState.mapUrls[mapCache.cityId || 'shanghai'] = mapCache.url;
  if (document.querySelector('[data-app]')) { renderCityOptions(); if (metroState.city) { renderStations(); renderLines(); } }
}
async function loadOfflineAssets() { var bundled = await loadAssetJson('assets/shanghai.json'); if (!validCity(bundled)) throw new Error('invalid bundled city'); METRO_DATA.shanghai = bundled; var image = await Tapp.assets.getUrl('assets/routemap-shanghai.png'); metroState.assetUrls.image = image.url; metroState.mapUrls.shanghai = image.url; document.querySelector('[data-map-image]').src = image.url; document.querySelector('[data-status]').textContent = data().source + ' ' + (data().version || '') + ' · 本地可用'; loadCachedCities().catch(function(error) { console.warn('[metro-guide] cache hydration failed', error); }); }
function extractOnlineMap(html, cityId) { var match = String(html || '').match(/(?:url:\s*['"]|src=['"])([^'"]*routemap_[a-z0-9_]+\.png[^'"]*)['"]/i); if (!match) match = String(html || '').match(/([^'"\s]*routemap_[a-z0-9_]+\.png)/i); if (!match) return null; return new URL(match[1], METRO_MAP_PAGE + (cityId || metroState.city)).href; }
function extractCityVersion(text, city) { var match = String(text || '').split(/\r?\n/).map(function(line) { return line.trim().split(','); }).find(function(row) { return row[0] === city && /^\d{8}$/.test(row[1] || ''); }); return match ? { version:match[1], zipBytes:Number(match[2]) || 0 } : null; }
function colorForLine(doc, id) { var label = id.replace(/(?:号线|线|铁路|轨道交通)$/g, ''); var badge = Array.from(doc.querySelectorAll('.badge[style*="background"]')).find(function(node) { return node.textContent.trim() === label; }); var match = badge && String(badge.getAttribute('style')).match(/background:\s*(#[0-9a-f]{6})/i); if (match) return match[1].toUpperCase(); var hash = Array.from(id).reduce(function(value, char) { return (value * 31 + char.charCodeAt(0)) >>> 0; }, 7); var palette = ['#0F766E','#C43830','#1077B5','#7C3699','#C47323','#00979E','#B25B1D','#5D5DAF']; return palette[hash % palette.length]; }
function parsePlannerCity(html, version, cityId) {
  if (typeof DOMParser === 'undefined') return null;
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var headings = Array.from(doc.querySelectorAll('[id^="plannerv2-line-"]'));
  var legacy = false;
  if (!headings.length) { headings = Array.from(doc.querySelectorAll('.station-modal__line-title, h6[id^="line-"], h6[id*="-line"]')); legacy = true; }
  var lines = headings.map(function(heading) {
    var list = heading.nextElementSibling;
    while (list && list.tagName !== 'UL') list = list.nextElementSibling;
    if (!list && legacy && heading.parentElement) list = heading.parentElement.querySelector('ul');
    var id = heading.textContent.trim();
    var stations = list ? Array.from(list.querySelectorAll('[data-station-name]')).map(function(node) { return node.getAttribute('data-station-name').trim().replace(/\((?:市域机场线|磁浮线|金山铁路)\)$/, ''); }) : [];
    return { id:id, color:colorForLine(doc, id), loop:/环线/.test(id) || (stations.length > 2 && stations[0] === stations[stations.length - 1]), stations:stations.filter(function(station, index) { return index === 0 || station !== stations[index - 1]; }) };
  }).filter(function(line, index, all) { return line.stations.length > 1 && all.findIndex(function(other) { return other.id === line.id; }) === index; });
  var stationSlugs = {}; Array.from(doc.querySelectorAll('[data-station-name][data-station-slug]')).forEach(function(node) { var name = node.getAttribute('data-station-name').trim(); if (!stationSlugs[name]) stationSlugs[name] = node.getAttribute('data-station-slug'); });
  var city = { name:cityMeta(cityId).name, source:'MetroMan 网页数据', version:String(version || new Date().toISOString().slice(0, 10).replace(/-/g, '')), lines:lines, stationSlugs:stationSlugs };
  return lines.length > 0 && validCity(city) ? city : null;
}
async function updateOnline(silent, requestedCity, requestToken) {
  var cityId = requestedCity || metroState.city;
  var isCurrent = function() { return !requestToken || requestToken === metroState.cityRequest; };
  var button = document.querySelector('[data-action="update"]'); if (button) button.disabled = true;
  var mapChecked = false, versionChecked = false, dataUpdated = false, remoteVersion = '';
  if (isCurrent()) setNetworkStatus('checking', '正在连接 MetroMan', cityMeta(cityId).name + '资源检查中');
  try {
    await verifyNetworkApis();
    var tasks = [metroApi('metroVersionManifest'), metroApi('metroPlannerPage', { city:cityId }), metroApi('metroMapPage', { city:cityId })];
    if (METRO_V2_CITIES.indexOf(cityId) >= 0) tasks.push(metroApi('metroPlannerV2Page', { city:cityId }));
    var responses = await Promise.allSettled(tasks);
    var fulfilled = responses.filter(function(response) { return response.status === 'fulfilled'; }).length;
    if (!fulfilled) throw responses[1] && responses[1].reason || responses[0] && responses[0].reason || new Error('MetroMan 请求全部失败');
    if (responses[0].status === 'fulfilled') {
      var versionResponse = apiData(responses[0].value);
      var versionText = typeof versionResponse === 'string' ? versionResponse : versionResponse && (versionResponse.body || versionResponse.text || versionResponse.data);
      var cityVersion = extractCityVersion(versionText, cityId);
      if (cityVersion) { remoteVersion = cityVersion.version; versionChecked = true; }
    }
    if (responses[1].status === 'fulfilled') {
      var plannerResponse = apiData(responses[1].value);
      var plannerHtml = typeof plannerResponse === 'string' ? plannerResponse : plannerResponse && (plannerResponse.body || plannerResponse.text || plannerResponse.data);
      var preferredHtml = plannerHtml;
      if (responses[3] && responses[3].status === 'fulfilled') { var v2Response = apiData(responses[3].value); var v2Html = typeof v2Response === 'string' ? v2Response : v2Response && (v2Response.body || v2Response.text || v2Response.data); if (v2Html) preferredHtml = v2Html; }
      var onlineCity = parsePlannerCity(preferredHtml, remoteVersion || (METRO_DATA[cityId] && METRO_DATA[cityId].version), cityId) || parsePlannerCity(plannerHtml, remoteVersion || (METRO_DATA[cityId] && METRO_DATA[cityId].version), cityId);
      if (onlineCity) {
        METRO_DATA[cityId] = onlineCity; dataUpdated = true;
        await storageSet('metro-guide.city.' + cityId + '.v1', onlineCity);
        if (metroState.city === cityId && (!requestToken || requestToken === metroState.cityRequest)) { renderCityOptions(); renderStations(); renderLines(); }
      }
    }
    var pageResponse = responses[2].status === 'fulfilled' ? apiData(responses[2].value) : null;
    var pageHtml = typeof pageResponse === 'string' ? pageResponse : pageResponse && (pageResponse.body || pageResponse.text || pageResponse.data);
    var pageImage = extractOnlineMap(pageHtml, cityId);
    if (pageImage) {
      metroState.mapUrls[cityId] = pageImage; metroState.mapVersion = new Date().toISOString(); mapChecked = true;
      if (isCurrent() && metroState.city === cityId) document.querySelector('[data-map-status]').textContent = 'MetroMan 网页线路图已检查 · ' + new Date().toLocaleDateString('zh-CN');
      var mapMeta = await storageGet(METRO_MAP_CACHE_KEY, {});
      mapMeta.cities = mapMeta.cities || {}; mapMeta.cities[cityId] = { url:pageImage, checkedAt:metroState.mapVersion, source:'MetroMan' };
      await storageSet(METRO_MAP_CACHE_KEY, mapMeta);
      if (metroState.city === cityId && (!requestToken || requestToken === metroState.cityRequest)) document.querySelector('[data-map-image]').src = pageImage;
    }
    var plannerAvailable = responses[1].status === 'fulfilled';
    if (isCurrent()) setNetworkStatus(plannerAvailable ? '' : 'error', plannerAvailable ? 'MetroMan 已连接' : 'MetroMan 部分连接', plannerAvailable ? cityMeta(cityId).name + '线路数据已响应' : readableError(responses[1].reason));
    if (dataUpdated && !versionChecked) {
      if (isCurrent() && metroState.city === cityId) document.querySelector('[data-status]').textContent = cityMeta(cityId).name + ' · MetroMan 已下载';
      if (!silent) notify('已从 MetroMan 下载' + cityMeta(cityId).name + '线路与站点数据。', 'success');
    } else if (versionChecked) {
      var currentVersion = String(METRO_DATA[cityId] && METRO_DATA[cityId].version || '');
      var current = remoteVersion <= currentVersion;
      if (isCurrent() && metroState.city === cityId) document.querySelector('[data-status]').textContent = cityMeta(cityId).name + ' ' + currentVersion + (current ? ' · MetroMan 最新' : ' · 发现 ' + remoteVersion);
      if (!silent) notify(dataUpdated ? '已从 MetroMan 下载' + cityMeta(cityId).name + '线路与站点数据（' + remoteVersion + '）。' : current ? cityMeta(cityId).name + '当前数据已是最新。' : 'MetroMan 已发布新版，本次网页数据尚未通过校验，继续使用本地数据。', dataUpdated || current ? 'success' : 'warning');
    } else if (!silent) notify(mapChecked ? '已检查 MetroMan 网页线路图；城市包版本暂时无法读取。' : '无法读取 MetroMan 在线资源，继续使用离线数据。', mapChecked ? 'warning' : 'error');
  } catch (error) {
    var detail = readableError(error);
    if (isCurrent()) setNetworkStatus('error', 'MetroMan 连接失败', detail);
    if (isCurrent()) document.querySelector('[data-status]').textContent = cityMeta(cityId).name + ' · 使用离线或缓存数据';
    if (!silent) notify(detail + '；已继续使用离线数据。', 'error');
    console.error('[metro-guide] MetroMan update failed', error);
  }
  finally { if (button) button.disabled = false; metroState.loadingCity = ''; }
}
async function openPdf() { try { if (!metroState.assetUrls.pdf) metroState.assetUrls.pdf = (await Tapp.assets.getUrl('assets/routemap-shanghai.pdf')).url; var link = document.createElement('a'); link.href = metroState.assetUrls.pdf; link.download = '上海地铁线路图.pdf'; document.body.appendChild(link); link.click(); link.remove(); notify('PDF 原件已交给浏览器打开。', 'success'); } catch (_) { notify('PDF 暂时无法打开，请使用高清 PNG。', 'error'); } }
function recentSelection() { try { return JSON.parse(localStorage.getItem(METRO_RECENT_KEY) || '{}'); } catch (_) { return {}; } }
async function loadRecentSelection() { var value = await storageGet(METRO_RECENT_KEY, null); return value && typeof value === 'object' ? value : recentSelection(); }
async function saveRecentSelection(cityId) { var root = document.querySelector('[data-app]'); var value = { city:cityId || metroState.city, from:root.querySelector('[data-from]').value.trim(), to:root.querySelector('[data-to]').value.trim() }; await storageSet(METRO_RECENT_KEY, value); }
function openStationDialog(target) { metroState.stationTarget = target; metroState.stationLineFilter = ''; var dialog = document.querySelector('[data-station-dialog]'); document.querySelector('[data-station-dialog-title]').textContent = target === 'from' ? '选择出发站' : '选择到达站'; var searchInput = document.querySelector('[data-station-search]'); searchInput.value = ''; renderStations(); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); requestAnimationFrame(function() { searchInput.focus(); }); }
function closeStationDialog() { var dialog = document.querySelector('[data-station-dialog]'); if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
function setSegment(group, attribute, value) { document.querySelectorAll(group + ' [' + attribute + ']').forEach(function(button) { button.classList.toggle('is-active', button.getAttribute(attribute) === value); }); }
function setDefaultDateTime() { var input = document.querySelector('[data-datetime]'); if (!input || input.value) return; var now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); input.value = now.toISOString().slice(0, 16); }
async function selectCity(cityId, silent) { var requestToken = ++metroState.cityRequest; metroState.city = cityId; metroState.loadingCity = cityId; var root = document.querySelector('[data-app]'); root.querySelectorAll('[data-city]').forEach(function(select) { select.value = cityId; }); root.querySelector('[data-from]').value = ''; root.querySelector('[data-to]').value = ''; root.querySelector('[data-route]').hidden = true; root.querySelector('[data-error]').hidden = true; root.querySelector('[data-empty]').hidden = false; root.querySelector('[data-map-city]').textContent = cityMeta(cityId).name + '地铁'; root.querySelector('[data-shanghai-only]').hidden = cityId !== 'shanghai'; root.querySelector('.quick-picks').hidden = cityId !== 'beijing'; root.querySelector('[data-map-status]').textContent = metroState.mapUrls[cityId] ? '已加载线路图' : '正在从 MetroMan 加载线路图…'; var image = root.querySelector('[data-map-image]'); if (metroState.mapUrls[cityId]) image.src = metroState.mapUrls[cityId]; else image.removeAttribute('src'); root.querySelector('[data-status]').textContent = validCity(METRO_DATA[cityId]) ? cityMeta(cityId).name + '本地数据 · 正在检查更新' : cityMeta(cityId).name + ' · 正在从 MetroMan 下载'; renderCityOptions(); renderStations(); renderLines(); await updateOnline(Boolean(silent), cityId, requestToken); var recent = await loadRecentSelection(); if (recent.city === cityId && metroState.city === cityId) { if (recent.from && allStations().indexOf(recent.from) >= 0) root.querySelector('[data-from]').value = recent.from; if (recent.to && allStations().indexOf(recent.to) >= 0) root.querySelector('[data-to]').value = recent.to; } await saveRecentSelection(cityId); if (metroState.city === cityId && requestToken === metroState.cityRequest && !validCity(METRO_DATA[cityId])) { root.querySelector('[data-status]').textContent = cityMeta(cityId).name + ' · 暂无可用资源'; root.querySelector('[data-map-status]').textContent = metroState.mapUrls[cityId] ? 'MetroMan 高清线路图' : 'MetroMan 暂未提供线路图'; if (!silent) notify(cityMeta(cityId).name + '资源暂时无法下载，请稍后重试。', 'error'); } }

function bindMapGestures() { var viewport = document.querySelector('[data-map-viewport]'); viewport.addEventListener('wheel', function(event) { event.preventDefault(); setZoom(metroState.zoom + (event.deltaY < 0 ? 15 : -15), event); }, { passive:false }); viewport.addEventListener('pointerdown', function(event) { if (event.button !== 0 && event.pointerType === 'mouse') return; metroState.dragging = true; metroState.dragStart = { x:event.clientX, y:event.clientY, panX:metroState.panX, panY:metroState.panY }; viewport.classList.add('is-dragging'); viewport.setPointerCapture(event.pointerId); }); viewport.addEventListener('pointermove', function(event) { if (!metroState.dragging || !metroState.dragStart) return; metroState.panX = metroState.dragStart.panX + event.clientX - metroState.dragStart.x; metroState.panY = metroState.dragStart.panY + event.clientY - metroState.dragStart.y; applyMapTransform(); }); function stopDrag(event) { metroState.dragging = false; metroState.dragStart = null; viewport.classList.remove('is-dragging'); if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); } viewport.addEventListener('pointerup', stopDrag); viewport.addEventListener('pointercancel', stopDrag); viewport.addEventListener('dblclick', resetMap); window.addEventListener('resize', applyMapTransform); }
function bind() { var root = document.querySelector('[data-app]'); root.addEventListener('click', async function(event) { var view = event.target.closest('[data-view]'); if (view) { setView(view.dataset.view); if (view.dataset.view === 'map') requestAnimationFrame(applyMapTransform); } var mode = event.target.closest('[data-mode]'); if (mode) { metroState.mode = mode.dataset.mode; setSegment('[data-time-modes]', 'data-mode', metroState.mode); document.querySelector('[data-datetime]').disabled = metroState.mode === 'first' || metroState.mode === 'last'; } var fare = event.target.closest('[data-fare]'); if (fare) { metroState.fare = fare.dataset.fare; setSegment('[data-fare-modes]', 'data-fare', metroState.fare); } var preference = event.target.closest('[data-preference]'); if (preference) { metroState.preference = preference.dataset.preference; setSegment('[data-preferences]', 'data-preference', metroState.preference); } var station = event.target.closest('[data-station-value]'); if (station) { root.querySelector(metroState.stationTarget === 'from' ? '[data-from]' : '[data-to]').value = station.dataset.stationValue; await saveRecentSelection(); closeStationDialog(); } var lineFilter = event.target.closest('[data-line-filter]'); if (lineFilter) { metroState.stationLineFilter = lineFilter.dataset.lineFilter; renderStations(root.querySelector('[data-station-search]').value); return; } var button = event.target.closest('[data-action]'); var action = button && button.dataset.action; if (action === 'pick-from') openStationDialog('from'); if (action === 'pick-to') openStationDialog('to'); if (action === 'close-stations') closeStationDialog(); if (action === 'search') { await saveRecentSelection(); search(); } if (action === 'swap') { var a = root.querySelector('[data-from]'), b = root.querySelector('[data-to]'), value = a.value; a.value = b.value; b.value = value; await saveRecentSelection(); } if (action === 'zoom-in') setZoom(metroState.zoom + 25); if (action === 'zoom-out') setZoom(metroState.zoom - 25); if (action === 'zoom-reset') resetMap(); if (action === 'open-pdf') openPdf(); if (action === 'update') updateOnline(false, metroState.city); if (action === 'about') notify('新版城市优先使用 MetroMan 时刻、票价与付款方式；其他城市保留本地少换乘规划。', 'success'); if (action === 'source') { try { await Tapp.ui.openUrl({ id:'metroman-maps', path:metroState.city }); } catch (_) { notify('暂时无法打开 MetroMan 数据来源。', 'error'); } } if (action === 'favorite') { var from = root.querySelector('[data-from]').value, to = root.querySelector('[data-to]').value, favorite = metroState.city + '|' + from + '|' + to; if (from && to && metroState.favorites.indexOf(favorite) < 0) metroState.favorites.push(favorite); try { await Tapp.storage.set('metro-guide.favorites.v1', metroState.favorites); } catch (_) {} button.textContent = '★'; notify('路线已收藏', 'success'); } var pick = event.target.closest('[data-pick]'); if (pick) { var values = pick.dataset.pick.split('|'); root.querySelector('[data-from]').value = values[0]; root.querySelector('[data-to]').value = values[1]; await saveRecentSelection(); search(); } }); root.querySelectorAll('[data-city]').forEach(function(select) { select.addEventListener('change', async function(event) { await saveRecentSelection(); selectCity(event.target.value, false); }); }); root.querySelector('[data-station-search]').addEventListener('input', function(event) { renderStations(event.target.value); }); root.querySelector('[data-station-dialog]').addEventListener('click', function(event) { if (event.target === event.currentTarget) closeStationDialog(); }); setDefaultDateTime(); bindMapGestures(); }
async function init() { bind(); try { await loadOfflineAssets(); } catch (error) { console.error('[metro-guide] offline data failed', error); notify('离线线路资源损坏，请重新安装 Tapp。', 'error'); return; } renderCityOptions(); document.querySelector('[data-map-image]').addEventListener('load', resetMap); resetMap(); metroState.favorites = await storageGet('metro-guide.favorites.v1', []); var recent = await loadRecentSelection(); var initialCity = recent && METRO_CITIES.some(function(city) { return city.id === recent.city; }) ? recent.city : 'beijing'; await selectCity(initialCity, true); if (Tapp.lifecycle.onDestroy) Tapp.lifecycle.onDestroy(function() { if (Tapp.assets.revokeAll) Tapp.assets.revokeAll(); }); }
function shortLineName(line) {
  var id = String(line.id || '').trim();
  if (/[\/／]/.test(id)) return id.split(/[\/／]/).map(function(part) { return shortLineName({ id:part }); }).filter(Boolean).join(' / ');
  var numbered = id.match(/^(?:Line\s*)?(\d+)(?:\s*Line|号线)?$/i);
  if (numbered) return numbered[1];
  var aliases = {
    '首都机场线':'首都机场', '大兴机场线':'大兴机场', '市域机场线':'市域机场',
    '亦庄T1线':'亦庄T1', '金山铁路':'金山', '浦江线':'浦江', '磁浮线':'磁浮',
    'Capital Airport Express':'Airport Express',
    'Beijing Daxing Airport Express':'Daxing Airport',
    'Taoyuan Airport MRT':'Airport MRT'
  };
  return aliases[id] || id.replace(/\s+(?:Metro|MRT)?\s*Line$/i, '').replace(/线$/, '');
}

function lineTagName(line) { return shortLineName(line); }
function lineIndexName(line) { return shortLineName(line); }

function renderLines() {
  var target = document.querySelector('[data-lines]');
  target.replaceChildren();
  document.querySelector('[data-line-count]').textContent = data().lines.length + ' 条线路路径';
  document.querySelector('.line-section h2').textContent = data().name + '地铁';
  data().lines.forEach(function(line) {
    var card = document.createElement('article');
    card.className = 'line-card';
    var marker = document.createElement('span');
    marker.className = 'line-color';
    marker.style.setProperty('--line-color', line.color);
    var copy = document.createElement('div');
    var name = document.createElement('strong');
    name.textContent = line.id + (line.loop ? ' · 环线' : '');
    var detail = document.createElement('small');
    detail.textContent = line.stations.length > 1
      ? line.stations.length + ' 个站点 · ' + line.stations[0] + '—' + line.stations[line.stations.length - 1]
      : '站点数据待从 MetroMan 更新';
    copy.append(name, detail);
    card.append(marker, copy);
    target.appendChild(card);
  });
}

function clearRouteMeta() {
  ['[data-duration]','[data-result-fare]','[data-distance]','[data-result-context]'].forEach(function(selector) {
    document.querySelector(selector).textContent = '';
  });
}

function routeContext(isV2) {
  var modes = { depart:'出发', arrive:'到达', first:'首班车', last:'末班车' };
  var payment = isV2 ? ' · ' + (metroState.fare === 'cash' ? '现金' : 'IC 卡') : '';
  return modes[metroState.mode] + payment + ' · ' + ({ time:'省时间', transfer:'少换乘', fare:'省票价' }[metroState.preference]);
}

function renderOfficialPlan(plan, from, to) {
  showRouteSurface();
  clearRouteMeta();
  document.querySelector('[data-result-source]').textContent = plan.isV2 ? 'MetroMan 新版方案' : 'MetroMan 官方方案';
  document.querySelector('[data-route-title]').textContent = from + ' → ' + to;
  document.querySelector('[data-result-context]').textContent = routeContext(plan.isV2);
  document.querySelector('[data-time]').textContent = plan.time;
  document.querySelector('[data-duration]').textContent = plan.duration;
  document.querySelector('[data-stops]').textContent = plan.rides.reduce(function(total, ride) {
    return total + (Number((ride.stops.match(/\d+/) || [0])[0]) || 0);
  }, 0) + ' 站';
  document.querySelector('[data-result-fare]').textContent = plan.meta.find(function(item) { return item.indexOf('票价') === 0; }) || '票价暂不可用';
  document.querySelector('[data-distance]').textContent = plan.meta.find(function(item) { return /公里|\bkm\b/i.test(item); }) || '';
  var transfer = plan.meta.find(function(item) { return item.indexOf('换乘') === 0 || item === '直达'; }) || (plan.rides.length > 1 ? '换乘 ' + (plan.rides.length - 1) + ' 次' : '无需换乘');
  document.querySelector('[data-transfers]').textContent = transfer === '直达' ? '无需换乘' : transfer;
  var steps = document.querySelector('[data-steps]');
  steps.replaceChildren();
  plan.rides.forEach(function(ride, index) {
    appendRouteStep(steps, ride.from, (ride.start ? ride.start + ' · ' : '') + '乘坐 ' + ride.line + (ride.direction ? ' · ' + ride.direction : ''), lineTagName({ id:ride.line }), ride.color);
    appendRouteStep(steps, ride.to, (ride.end ? ride.end + ' · ' : '') + (index === plan.rides.length - 1 ? '到达目的地' : '站内换乘') + (ride.detail ? ' · ' + ride.detail : ''), null, ride.color);
  });
}

function parseLegacyPlan(html) {
  if (typeof DOMParser === 'undefined') return null;
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var selector = metroState.preference === 'time' ? '[data-rank-time="1"]' : metroState.preference === 'transfer' ? '[data-rank-transfers="1"]' : '[data-rank-recommended="1"]';
  var card = doc.querySelector('.result-card' + selector) || doc.querySelector('.result-card');
  if (!card) return null;
  var text = function(selector, root) {
    var node = (root || card).querySelector(selector);
    return node ? node.textContent.trim().replace(/\s+/g, ' ') : '';
  };
  var adjacent = function(line, direction) {
    var node = line[direction];
    while (node && !node.matches('.result-card__station,.result-card__transfer')) node = node[direction];
    return node;
  };
  var meta = Array.from(card.querySelectorAll('.result-card__summary-meta span')).map(function(node) { return node.textContent.trim(); }).filter(function(value) { return value && value !== '·'; });
  var rides = Array.from(card.querySelectorAll('.result-card__line')).map(function(line) {
    var fromNode = adjacent(line, 'previousElementSibling');
    var toNode = adjacent(line, 'nextElementSibling');
    var style = line.getAttribute('style') || '';
    return {
      from:text('.result-card__station-info span,.result-card__transfer-info span', fromNode),
      to:text('.result-card__station-info span,.result-card__transfer-info span', toNode),
      line:text('.result-card__line-name', line),
      stops:text('.result-card__line-stops', line),
      direction:text('.result-card__line-direction', line),
      detail:text('.result-card__line-meta', line),
      start:text('.result-card__station-time span,.result-card__transfer-time span', fromNode),
      end:text('.result-card__station-time span,.result-card__transfer-time span', toNode),
      color:(style.match(/#[0-9a-f]{6}/i) || ['#0F766E'])[0]
    };
  }).filter(function(ride) { return ride.from && ride.to && ride.line; });
  return rides.length ? {
    isV2:false,
    time:text('.result-card__summary-time-main'),
    duration:text('.result-card__summary-time-duration'),
    meta:meta,
    rides:rides
  } : null;
}

function extractOfficialFare(html) {
  var match = String(html || '').match(/票价\s*(?:&#165;|&#xA5;|&yen;|¥|￥)\s*([0-9]+(?:\.[0-9]+)?)/i);
  return match ? '票价 ¥' + match[1] : '';
}

function renderFallbackRoute(route, from, to, officialFare) {
  renderRoute(route, from, to);
  var fare = officialFare || ('票价约 ¥' + Math.max(2, Math.min(8, Math.ceil(Math.max(1, route.hops) / 4) + 1)));
  document.querySelector('[data-result-fare]').textContent = fare;
}

function responseHtml(result) {
  var value = apiData(result);
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (typeof value.body === 'string') return value.body;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.data === 'string') return value.data;
  if (value.data && typeof value.data.body === 'string') return value.data.body;
  return '';
}
var COMMON_STATION_SLUGS = { '环城南路':'south-ring-road', '斗南':'dounan', '龙头街':'longtou-street', '东风广场':'dongfeng-square', '昆明火车站':'kunming-railway-station' };
function plannerStationSlug(name) { return (data().stationSlugs && data().stationSlugs[name]) || COMMON_STATION_SLUGS[name] || ''; }

async function search() {
  var from = document.querySelector('[data-from]').value.trim();
  var to = document.querySelector('[data-to]').value.trim();
  var route = findRoute(from, to);
  if (!route) { showRouteError('请从当前城市的站点列表中选择有效站点。'); return; }
  var button = document.querySelector('[data-action="search"]');
  button.disabled = true;
  button.textContent = '正在查询…';
  try {
    var fromSlug = plannerStationSlug(from);
    var toSlug = plannerStationSlug(to);
    if (fromSlug && toSlug) {
      var isV2 = METRO_V2_CITIES.indexOf(metroState.city) >= 0;
      var params = { city:metroState.city, route:fromSlug + '-to-' + toSlug, mode:metroState.mode, datetime:formatPlannerDatetime(), preference:metroState.preference, fare:metroState.fare };
      var result = isV2 ? await metroApi('metroPlannerV2Result', params) : await metroApi('metroPlannerResult', params);
      var html = responseHtml(result);
      var plan = isV2 ? parseOfficialPlan(html) : parseLegacyPlan(html);
      if (plan) { plan.isV2 = isV2; renderOfficialPlan(plan, from, to); return; }
      renderFallbackRoute(route, from, to, extractOfficialFare(html));
      return;
    }
    renderFallbackRoute(route, from, to);
  } catch (_) {
    renderFallbackRoute(route, from, to);
    notify('MetroMan 官方结果暂不可用，已显示本地少换乘方案。', 'warning');
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">⌕</span>查询路线';
  }
}

var renderCityOptionsBase = renderCityOptions;
renderCityOptions = function() {
  renderCityOptionsBase();
  var isV2 = METRO_V2_CITIES.indexOf(metroState.city) >= 0;
  var fareOptions = document.querySelector('[data-fare-options]');
  if (fareOptions) fareOptions.hidden = !isV2;
  var options = document.querySelector('.journey-options');
  if (options) options.classList.toggle('is-legacy', !isV2);
};

// 线路索引用于快速定位，保留 MetroMan 的完整线路名称；站点卡片仍使用 lineTagName 简称。
lineIndexName = function(line) { return String(line.id || '').trim(); };

function formatRequestedTime(value, mode) {
  if (!value) return '';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  var pad = function(number) { return String(number).padStart(2, '0'); };
  var weekdays = ['日','一','二','三','四','五','六'];
  var label = mode === 'arrive' ? '到达' : mode === 'first' ? '首班' : mode === 'last' ? '末班' : '出发';
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日 周' + weekdays[date.getDay()] + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ' ' + label;
}

function requestedTimeContext() {
  var input = document.querySelector('[data-datetime]');
  var value = input && input.value;
  var mode = metroState.mode;
  return formatRequestedTime(value, mode);
}

var renderRouteBase = renderRoute;
clearRouteMeta = function() {
  ['[data-duration]','[data-result-fare]','[data-distance]','[data-result-context]'].forEach(function(selector) {
    var node = document.querySelector(selector);
    if (node) node.textContent = '';
  });
};
renderRoute = function(route, from, to) {
  renderRouteBase(route, from, to);
  var context = requestedTimeContext();
  if (context) document.querySelector('[data-result-context]').textContent = context + ' · 车辆时间为预计值';
};

var renderOfficialPlanBase = renderOfficialPlan;
renderOfficialPlan = function(plan, from, to) {
  renderOfficialPlanBase(plan, from, to);
  var requested = requestedTimeContext();
  var modeContext = routeContext(plan.isV2);
  document.querySelector('[data-result-context]').textContent = requested ? requested + ' · ' + modeContext : modeContext;
  var directions = plan.rides.map(function(ride) { return ride.direction; }).filter(Boolean).filter(function(value, index, all) { return all.indexOf(value) === index; });
  document.querySelector('[data-direction]').textContent = directions.length ? directions.join(' / ') : '';
  var distance = plan.meta.find(function(item) { return /公里|\bkm\b/i.test(item); });
  if (!distance) {
    var total = plan.rides.reduce(function(sum, ride) { var match = String(ride.detail || '').match(/([0-9]+(?:\.[0-9]+)?)\s*(?:公里|km)/i); return sum + (match ? Number(match[1]) : 0); }, 0);
    distance = total ? total.toFixed(1).replace(/\.0$/, '') + ' km' : '';
  }
  document.querySelector('[data-distance]').textContent = distance || '';
  syncFavoriteButton(from, to);
};

function estimatedVehicleWindow(route) {
  var minutes = Math.max(3, route.hops * 2 + route.transfers * 5);
  var input = document.querySelector('[data-datetime]');
  var base = input && input.value ? new Date(input.value) : new Date();
  if (Number.isNaN(base.getTime())) base = new Date();
  var start = new Date(base);
  var end = new Date(base);
  if (metroState.mode === 'arrive') start.setMinutes(start.getMinutes() - minutes);
  else end.setMinutes(end.getMinutes() + minutes);
  var format = function(date) { return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0'); };
  return { time:format(start) + ' → ' + format(end), duration:'约 ' + minutes + ' 分钟' };
}

var renderRouteWithContext = renderRoute;
renderRoute = function(route, from, to) {
  renderRouteWithContext(route, from, to);
  var vehicle = estimatedVehicleWindow(route);
  document.querySelector('[data-time]').textContent = vehicle.time;
  document.querySelector('[data-duration]').textContent = vehicle.duration;
  var finalSegment = route.segments[route.segments.length - 1];
  document.querySelector('[data-direction]').textContent = finalSegment ? finalSegment.to + ' 方向（预计）' : '';
  document.querySelector('[data-distance]').textContent = (route.hops * 1.2).toFixed(1).replace(/\.0$/, '') + ' km（预计）';
  syncFavoriteButton(from, to);
};

function favoriteKey(from, to) { return metroState.city + '|' + from + '|' + to; }
function syncFavoriteButton(from, to) {
  var button = document.querySelector('[data-action="favorite"]');
  if (!button) return;
  var active = metroState.favorites.indexOf(favoriteKey(from, to)) >= 0;
  button.textContent = active ? '★' : '☆';
  button.setAttribute('aria-pressed', String(active));
  button.title = active ? '取消收藏' : '收藏路线';
}
async function toggleFavorite() {
  var root = document.querySelector('[data-app]');
  var from = root.querySelector('[data-from]').value.trim();
  var to = root.querySelector('[data-to]').value.trim();
  if (!from || !to) { notify('请先选择出发站和到达站。', 'warning'); return; }
  var key = favoriteKey(from, to);
  var index = metroState.favorites.indexOf(key);
  if (index >= 0) metroState.favorites.splice(index, 1); else metroState.favorites.push(key);
  await storageSet('metro-guide.favorites.v1', metroState.favorites);
  syncFavoriteButton(from, to);
  renderFavorites();
  notify(index >= 0 ? '已取消收藏' : '路线已收藏', 'success');
}
function favoriteValue(key) {
  var parts = String(key || '').split('|');
  return parts.length === 3 ? { key:key, city:parts[0], from:parts[1], to:parts[2] } : null;
}
function favoriteCityOptions() {
  var select = document.querySelector('[data-favorite-city]');
  if (!select) return;
  var selected = select.value;
  var cities = {};
  metroState.favorites.map(favoriteValue).filter(Boolean).forEach(function(item) { cities[item.city] = true; });
  select.replaceChildren();
  var all = document.createElement('option'); all.value = ''; all.textContent = '全部城市'; select.appendChild(all);
  sortedCities().filter(function(city) { return cities[city.id]; }).forEach(function(city) { var option = document.createElement('option'); option.value = city.id; option.textContent = city.name; select.appendChild(option); });
  select.value = cities[selected] ? selected : '';
}
function renderFavorites() {
  var list = document.querySelector('[data-favorite-list]');
  if (!list) return;
  favoriteCityOptions();
  var filter = document.querySelector('[data-favorite-city]').value;
  var items = metroState.favorites.map(favoriteValue).filter(function(item) { return item && (!filter || item.city === filter); });
  list.replaceChildren();
  items.forEach(function(item) {
    var city = cityMeta(item.city);
    var card = document.createElement('article'); card.className = 'favorite-card'; card.dataset.favoriteKey = item.key;
    var main = document.createElement('div'); main.className = 'favorite-main';
    var mark = document.createElement('span'); mark.className = 'favorite-city-mark'; mark.textContent = city.name.slice(0, 1);
    var route = document.createElement('div'); route.className = 'favorite-route';
    var title = document.createElement('strong'); title.textContent = item.from + ' → ' + item.to;
    var meta = document.createElement('span'); meta.textContent = city.name + ' · ' + (cityHasResource(item.city) ? '已有数据' : '选择时自动下载');
    route.append(title, meta); main.append(mark, route);
    var actions = document.createElement('div'); actions.className = 'favorite-actions';
    var use = document.createElement('button'); use.type = 'button'; use.dataset.action = 'use-favorite'; use.textContent = '查询';
    var reverse = document.createElement('button'); reverse.type = 'button'; reverse.dataset.action = 'reverse-favorite'; reverse.textContent = '反向';
    var remove = document.createElement('button'); remove.type = 'button'; remove.dataset.action = 'remove-favorite'; remove.textContent = '×'; remove.title = '删除收藏'; remove.setAttribute('aria-label', '删除 ' + item.from + ' 到 ' + item.to);
    actions.append(use, reverse, remove); card.append(main, actions); list.appendChild(card);
  });
  var total = metroState.favorites.map(favoriteValue).filter(Boolean).length;
  document.querySelector('[data-favorite-tab-count]').textContent = total;
  document.querySelector('[data-favorite-count]').textContent = filter ? items.length + ' 条当前城市收藏' : total + ' 条收藏';
  document.querySelector('[data-favorite-empty]').hidden = total > 0 || Boolean(filter);
  list.hidden = items.length === 0;
  if (!items.length && total > 0 && filter) {
    var empty = document.createElement('p'); empty.className = 'station-list-empty'; empty.textContent = '这个城市暂无收藏路线'; list.appendChild(empty); list.hidden = false;
  }
}
async function openFavorite(key, reverse) {
  var item = favoriteValue(key);
  if (!item) return;
  await selectCity(item.city, true);
  var root = document.querySelector('[data-app]');
  root.querySelector('[data-from]').value = reverse ? item.to : item.from;
  root.querySelector('[data-to]').value = reverse ? item.from : item.to;
  await saveRecentSelection();
  setView('planner');
  await search();
}
async function removeFavorite(key) {
  var index = metroState.favorites.indexOf(key);
  if (index < 0) return;
  metroState.favorites.splice(index, 1);
  await storageSet('metro-guide.favorites.v1', metroState.favorites);
  renderFavorites();
  var root = document.querySelector('[data-app]');
  syncFavoriteButton(root.querySelector('[data-from]').value.trim(), root.querySelector('[data-to]').value.trim());
  notify('已删除收藏路线', 'success');
}

var bindWithFavorite = bind;
bind = function() {
  bindWithFavorite();
  document.querySelector('[data-app]').addEventListener('click', function(event) {
    var button = event.target.closest('[data-action="favorite"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleFavorite().catch(function() { notify('收藏状态保存失败。', 'error'); });
  }, true);
};

var FULL_STOPS_KEY = 'metro-guide.full-stops.v1';
metroState.showFullStops = false;
metroState.lastRouteView = null;

function stopCountLabel(value, fallback) {
  var match = String(value || '').match(/\d+/);
  return (match ? Number(match[0]) : Number(fallback) || 0) + '站';
}

var parseOfficialPlanBaseWithStops = parseOfficialPlan;
parseOfficialPlan = function(html) {
  var plan = parseOfficialPlanBaseWithStops(html);
  if (!plan || typeof DOMParser === 'undefined') return plan;
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var card = doc.querySelector('.planner-v2-result-card');
  var rides = card ? Array.from(card.querySelectorAll('.planner-v2-result-card__ride')) : [];
  plan.rides.forEach(function(ride, index) {
    var node = rides[index];
    if (!node) return;
    ride.intermediateStops = Array.from(node.querySelectorAll('.planner-v2-result-card__stop-list li')).map(function(stop) {
      var name = stop.querySelector('.planner-v2-result-card__stop-name');
      var time = stop.querySelector('.planner-v2-result-card__stop-time');
      return { name:name ? name.textContent.trim() : '', time:time ? time.textContent.trim() : '' };
    }).filter(function(stop) { return stop.name; });
  });
  return plan;
};

var parseLegacyPlanBaseWithStops = parseLegacyPlan;
parseLegacyPlan = function(html) {
  var plan = parseLegacyPlanBaseWithStops(html);
  if (!plan || typeof DOMParser === 'undefined') return plan;
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var selector = metroState.preference === 'time' ? '[data-rank-time="1"]' : metroState.preference === 'transfer' ? '[data-rank-transfers="1"]' : '[data-rank-recommended="1"]';
  var card = doc.querySelector('.result-card' + selector) || doc.querySelector('.result-card');
  var lines = card ? Array.from(card.querySelectorAll('.result-card__line')) : [];
  plan.rides.forEach(function(ride, index) {
    var line = lines[index];
    var container = line && line.nextElementSibling && line.nextElementSibling.matches('.result-card__stops-container') ? line.nextElementSibling : null;
    ride.intermediateStops = container ? Array.from(container.querySelectorAll('.result-card__stop')).map(function(stop) {
      var name = stop.querySelector('.result-card__stop-info span');
      var time = stop.querySelector('.result-card__stop-time span');
      return { name:name ? name.textContent.trim() : '', time:time ? time.textContent.trim() : '' };
    }).filter(function(stop) { return stop.name; }) : [];
  });
  return plan;
};

function appendStopCount(target, count, color) {
  var row = document.createElement('div');
  row.className = 'route-stop-count';
  row.style.setProperty('--step-color', color || '#0f766e');
  var label = document.createElement('strong');
  label.textContent = count;
  row.appendChild(label);
  target.appendChild(row);
}

function appendIntermediateStop(target, stop, line, color) {
  appendRouteStep(target, stop.name, stop.time ? stop.time + ' · 沿线经过' : '沿线经过', line, color);
  if (target.lastElementChild) target.lastElementChild.classList.add('is-intermediate');
}

function renderPlanStopDetails(plan) {
  var target = document.querySelector('[data-steps]');
  target.replaceChildren();
  plan.rides.forEach(function(ride, index) {
    var lineName = lineTagName({ id:ride.line });
    appendRouteStep(target, ride.from, (ride.start ? ride.start + ' · ' : '') + '乘坐 ' + ride.line + (ride.direction ? ' · ' + ride.direction : ''), lineName, ride.color);
    if (metroState.showFullStops) {
      (ride.intermediateStops || []).forEach(function(stop) { appendIntermediateStop(target, stop, null, ride.color); });
    } else {
      appendStopCount(target, stopCountLabel(ride.stops, (ride.intermediateStops || []).length + 1), ride.color);
    }
    appendRouteStep(target, ride.to, (ride.end ? ride.end + ' · ' : '') + (index === plan.rides.length - 1 ? '到达目的地' : '站内换乘') + (ride.detail ? ' · ' + ride.detail : ''), null, ride.color);
  });
}

function renderLocalStopDetails(route) {
  var target = document.querySelector('[data-steps]');
  target.replaceChildren();
  var offset = 0;
  route.segments.forEach(function(segment, index) {
    var color = segment.line && segment.line.color;
    appendRouteStep(target, segment.from, index ? '站内换乘 ' + segment.line.id : '从这里出发 · 乘坐 ' + segment.line.id, lineTagName(segment.line), color);
    var intermediate = route.stations.slice(offset + 1, offset + segment.stops).map(function(name) { return { name:name, time:'' }; });
    if (metroState.showFullStops) intermediate.forEach(function(stop) { appendIntermediateStop(target, stop, null, color); });
    else appendStopCount(target, stopCountLabel(segment.stops), color);
    appendRouteStep(target, segment.to, index === route.segments.length - 1 ? '到达目的地' : '准备换乘', null, color);
    offset += segment.stops;
  });
}

var renderOfficialPlanWithStopModeBase = renderOfficialPlan;
renderOfficialPlan = function(plan, from, to) {
  renderOfficialPlanWithStopModeBase(plan, from, to);
  renderPlanStopDetails(plan);
  metroState.lastRouteView = { type:'plan', value:plan, from:from, to:to };
};

var renderRouteWithStopModeBase = renderRoute;
renderRoute = function(route, from, to) {
  renderRouteWithStopModeBase(route, from, to);
  renderLocalStopDetails(route);
  metroState.lastRouteView = { type:'local', value:route, from:from, to:to };
};

function rerenderStopDetails() {
  var view = metroState.lastRouteView;
  if (!view) return;
  if (view.type === 'plan') renderPlanStopDetails(view.value);
  else renderLocalStopDetails(view.value);
}

var bindWithStopModeBase = bind;
bind = function() {
  bindWithStopModeBase();
  var toggle = document.querySelector('[data-full-stops]');
  toggle.checked = metroState.showFullStops;
  toggle.addEventListener('change', async function() {
    metroState.showFullStops = toggle.checked;
    await storageSet(FULL_STOPS_KEY, metroState.showFullStops);
    rerenderStopDetails();
  });
};

var initWithStopModeBase = init;
init = async function() {
  metroState.showFullStops = await storageGet(FULL_STOPS_KEY, false) === true;
  await initWithStopModeBase();
  var toggle = document.querySelector('[data-full-stops]');
  if (toggle) toggle.checked = metroState.showFullStops;
};

var setViewWithFavoritesBase = setView;
setView = function(view) {
  setViewWithFavoritesBase(view);
  if (view === 'favorites') renderFavorites();
};

var bindWithFavoritesPageBase = bind;
bind = function() {
  bindWithFavoritesPageBase();
  var root = document.querySelector('[data-app]');
  document.querySelector('[data-favorite-city]').addEventListener('change', renderFavorites);
  root.addEventListener('click', function(event) {
    var action = event.target.closest('[data-action]');
    if (!action) return;
    var card = action.closest('[data-favorite-key]');
    if (!card) return;
    if (action.dataset.action === 'use-favorite') openFavorite(card.dataset.favoriteKey, false).catch(function(error) { notify(readableError(error), 'error'); });
    if (action.dataset.action === 'reverse-favorite') openFavorite(card.dataset.favoriteKey, true).catch(function(error) { notify(readableError(error), 'error'); });
    if (action.dataset.action === 'remove-favorite') removeFavorite(card.dataset.favoriteKey).catch(function() { notify('收藏路线删除失败。', 'error'); });
  });
};

var initWithFavoritesPageBase = init;
init = async function() {
  await initWithFavoritesPageBase();
  renderFavorites();
};

if (typeof Tapp !== 'undefined' && Tapp.lifecycle) Tapp.lifecycle.onReady(init); else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
