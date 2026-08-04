// Function Graph Calculator Tapp v1.0.0
// GeoGebra-like interactive function grapher for Myriad

(function () {
  'use strict';

  // ========================================
  // i18n
  // ========================================

  var i18n = {
    'zh-CN': {
      title: '函数图形计算器',
      help: '帮助',
      resetView: '重置视图',
      functions: '函数',
      add: '添加',
      presets: '常用函数',
      evaluate: '求值',
      hint: '输入函数表达式，例如 sin(x)、x^2、exp(-x^2)。滚轮缩放，拖拽平移。',
      helpTitle: '使用说明',
      emptyFn: '暂无函数，点击「添加」或选择常用函数',
      errEmpty: '表达式为空',
      errParse: '无法解析表达式',
      errDomain: '定义域外或结果非实数',
      visible: '显示',
      hide: '隐藏',
      remove: '删除',
      statusReady: '就绪',
      statusError: '有函数表达式错误，请检查红色输入框',
      helpBody:
        '<h3>输入函数</h3><p>在左侧输入以 <code>x</code> 为自变量的表达式，例如 <code>sin(x)</code>、<code>x^2</code>、<code>exp(-x^2/2)</code>。</p>' +
        '<h3>支持的运算与函数</h3><ul>' +
        '<li>四则运算 <code>+ - * /</code>、幂 <code>^</code> 或 <code>**</code>、括号</li>' +
        '<li>常量 <code>pi</code>、<code>e</code></li>' +
        '<li>三角函数 <code>sin cos tan asin acos atan</code>（弧度）</li>' +
        '<li><code>sinh cosh tanh</code>、<code>sqrt abs ln log log10 exp floor ceil round</code></li>' +
        '<li>比较与条件可用 <code>abs</code> 等组合；隐式乘法如 <code>2x</code>、<code>3(x+1)</code> 已支持</li>' +
        '</ul>' +
        '<h3>交互</h3><ul>' +
        '<li>鼠标滚轮：以指针为中心缩放</li>' +
        '<li>拖拽画布：平移坐标系（或开启平移模式）</li>' +
        '<li>悬停：显示最近点坐标与函数值</li>' +
        '<li>工具栏：放大/缩小、网格、坐标轴、重置视图</li>' +
        '</ul>' +
        '<h3>求值</h3><p>在「求值」框输入<strong>不含自变量绑定</strong>的表达式，例如 <code>sin(pi/2)</code>、<code>2^10</code>、<code>sqrt(2)</code>，查看数值结果。若表达式含 <code>x</code>，会按 <code>x = 0</code> 计算。</p>'
    },
    'en-US': {
      title: 'Function Graph Calculator',
      help: 'Help',
      resetView: 'Reset view',
      functions: 'Functions',
      add: 'Add',
      presets: 'Presets',
      evaluate: 'Evaluate',
      hint: 'Enter expressions in x, e.g. sin(x), x^2, exp(-x^2). Scroll to zoom, drag to pan.',
      helpTitle: 'Help',
      emptyFn: 'No functions yet. Click Add or pick a preset.',
      errEmpty: 'Empty expression',
      errParse: 'Cannot parse expression',
      errDomain: 'Out of domain or non-real result',
      visible: 'Show',
      hide: 'Hide',
      remove: 'Remove',
      statusReady: 'Ready',
      statusError: 'Some expressions have errors (red inputs)',
      helpBody:
        '<h3>Enter functions</h3><p>Type expressions in <code>x</code>, e.g. <code>sin(x)</code>, <code>x^2</code>, <code>exp(-x^2/2)</code>.</p>' +
        '<h3>Operators & functions</h3><ul>' +
        '<li><code>+ - * /</code>, power <code>^</code> or <code>**</code>, parentheses</li>' +
        '<li>Constants <code>pi</code>, <code>e</code></li>' +
        '<li>Trig <code>sin cos tan asin acos atan</code> (radians)</li>' +
        '<li><code>sinh cosh tanh</code>, <code>sqrt abs ln log log10 exp floor ceil round</code></li>' +
        '<li>Implicit multiplication: <code>2x</code>, <code>3(x+1)</code></li>' +
        '</ul>' +
        '<h3>Interaction</h3><ul>' +
        '<li>Mouse wheel: zoom toward pointer</li>' +
        '<li>Drag canvas: pan (or enable pan mode)</li>' +
        '<li>Hover: coordinates and value near cursor</li>' +
        '<li>Toolbar: zoom, grid, axes, reset view</li>' +
        '</ul>' +
        '<h3>Evaluate</h3><p>Enter a numeric expression such as <code>sin(pi/2)</code>, <code>2^10</code>, or <code>sqrt(2)</code>. If the expression contains <code>x</code>, it is evaluated at <code>x = 0</code>. Named function calls like <code>f(2)</code> are not supported.</p>'
    },
    'ja-JP': {
      title: '関数グラフ計算機',
      help: 'ヘルプ',
      resetView: '表示をリセット',
      functions: '関数',
      add: '追加',
      presets: 'よく使う関数',
      evaluate: '計算',
      hint: 'x の式を入力（例: sin(x)、x^2）。ホイールでズーム、ドラッグでパン。',
      helpTitle: '使い方',
      emptyFn: '関数がありません。「追加」またはプリセットを選んでください。',
      errEmpty: '式が空です',
      errParse: '式を解析できません',
      errDomain: '定義域外または実数でない結果',
      visible: '表示',
      hide: '非表示',
      remove: '削除',
      statusReady: '準備完了',
      statusError: '式にエラーがあります（赤い入力）',
      helpBody:
        '<h3>関数の入力</h3><p><code>x</code> の式を入力します。例: <code>sin(x)</code>、<code>x^2</code>。</p>' +
        '<h3>演算と関数</h3><ul>' +
        '<li><code>+ - * /</code>、べき乗 <code>^</code>、<code>pi</code> <code>e</code></li>' +
        '<li>三角・双曲線・sqrt abs ln exp など</li>' +
        '</ul>' +
        '<h3>操作</h3><ul><li>ホイールでズーム、ドラッグで移動</li></ul>'
    }
  };

  var currentLocale = 'zh-CN';

  function normalizeLocale(locale) {
    if (!locale) return 'zh-CN';
    var l = String(locale).toLowerCase();
    if (l.indexOf('zh') === 0) return 'zh-CN';
    if (l.indexOf('ja') === 0) return 'ja-JP';
    return 'en-US';
  }

  function t(key) {
    return (i18n[currentLocale] || i18n['zh-CN'])[key] || key;
  }

  // ========================================
  // Expression parser (safe, no eval)
  // ========================================

  var FN_NAMES = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh || function (x) { return (Math.exp(x) - Math.exp(-x)) / 2; },
    cosh: Math.cosh || function (x) { return (Math.exp(x) + Math.exp(-x)) / 2; },
    tanh: Math.tanh || function (x) {
      if (x > 20) return 1;
      if (x < -20) return -1;
      var e = Math.exp(2 * x);
      return (e - 1) / (e + 1);
    },
    sqrt: Math.sqrt,
    abs: Math.abs,
    ln: Math.log,
    log: Math.log,
    log10: Math.log10 || function (x) { return Math.log(x) / Math.LN10; },
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign || function (x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
  };

  var CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2
  };

  function preprocessExpr(src) {
    var s = String(src || '').trim();
    if (!s) return '';
    s = s.replace(/\s+/g, '');
    s = s.replace(/π/g, 'pi');
    s = s.replace(/\*\*/g, '^');
    // Implicit multiplication (order matters):
    // 1) digit then letter or '(': 2x -> 2*x, 2( -> 2*(
    s = s.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
    // 2) ')' then digit / letter / '(': )2 -> )*2, )x -> )*x, )( -> )*(
    s = s.replace(/(\))(\d)/g, '$1*$2');
    s = s.replace(/(\))([a-zA-Z(])/g, '$1*$2');
    // 3) identifier then '(': only insert * when NOT a known function name
    //    e.g. x( -> x*(, pi( -> pi*(; but sin( / sqrt( stay as calls
    s = s.replace(/([a-zA-Z_][a-zA-Z0-9_]*)(\()/g, function (m, name, paren) {
      var lower = name.toLowerCase();
      if (FN_NAMES[lower]) return m;
      return name + '*' + paren;
    });
    return s;
  }

  function tokenize(s) {
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var c = s[i];
      if ('+-*/^(),'.indexOf(c) >= 0) {
        tokens.push({ type: c === ',' ? 'comma' : 'op', value: c });
        i++;
        continue;
      }
      if (c >= '0' && c <= '9' || c === '.') {
        var j = i;
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
        var num = parseFloat(s.slice(i, j));
        if (isNaN(num)) throw new Error('bad number');
        tokens.push({ type: 'num', value: num });
        i = j;
        continue;
      }
      if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
        var k = i;
        while (k < s.length && /[a-zA-Z0-9_]/.test(s[k])) k++;
        var name = s.slice(i, k).toLowerCase();
        tokens.push({ type: 'id', value: name });
        i = k;
        continue;
      }
      throw new Error('unexpected: ' + c);
    }
    return tokens;
  }

  // Recursive descent: expr = term ((+|-) term)*
  // term = power ((*|/) power)*
  // power = unary (^ unary)*  (right-assoc)
  // unary = (+|-) unary | primary
  // primary = num | id | id(args) | (expr)

  function parseTokens(tokens) {
    var pos = 0;

    function peek() {
      return tokens[pos];
    }

    function consume() {
      return tokens[pos++];
    }

    function expect(type, value) {
      var t = peek();
      if (!t || t.type !== type || (value != null && t.value !== value)) {
        throw new Error('expected ' + type);
      }
      return consume();
    }

    function parseExpr() {
      var node = parseTerm();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        var op = consume().value;
        node = { type: 'bin', op: op, left: node, right: parseTerm() };
      }
      return node;
    }

    function parseTerm() {
      var node = parsePower();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        var op = consume().value;
        node = { type: 'bin', op: op, left: node, right: parsePower() };
      }
      return node;
    }

    function parsePower() {
      var node = parseUnary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        consume();
        node = { type: 'bin', op: '^', left: node, right: parsePower() };
      }
      return node;
    }

    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        var op = consume().value;
        return { type: 'unary', op: op, arg: parseUnary() };
      }
      return parsePrimary();
    }

    function parsePrimary() {
      var t = peek();
      if (!t) throw new Error('unexpected end');
      if (t.type === 'num') {
        consume();
        return { type: 'num', value: t.value };
      }
      if (t.type === 'id') {
        consume();
        var name = t.value;
        if (peek() && peek().type === 'op' && peek().value === '(') {
          consume();
          var args = [];
          if (!(peek() && peek().type === 'op' && peek().value === ')')) {
            args.push(parseExpr());
            while (peek() && peek().type === 'comma') {
              consume();
              args.push(parseExpr());
            }
          }
          expect('op', ')');
          return { type: 'call', name: name, args: args };
        }
        return { type: 'id', name: name };
      }
      if (t.type === 'op' && t.value === '(') {
        consume();
        var inner = parseExpr();
        expect('op', ')');
        return inner;
      }
      throw new Error('unexpected token');
    }

    var ast = parseExpr();
    if (pos < tokens.length) throw new Error('trailing tokens');
    return ast;
  }

  function compileAst(ast) {
    function compile(node) {
      if (!node) throw new Error('empty');
      switch (node.type) {
        case 'num':
          return function () { return node.value; };
        case 'id':
          if (CONSTANTS[node.name] != null) {
            var c = CONSTANTS[node.name];
            return function () { return c; };
          }
          if (node.name === 'x') {
            return function (env) { return env.x; };
          }
          throw new Error('unknown id: ' + node.name);
        case 'unary':
          var argFn = compile(node.arg);
          if (node.op === '-') return function (env) { return -argFn(env); };
          return argFn;
        case 'bin':
          var L = compile(node.left);
          var R = compile(node.right);
          if (node.op === '+') return function (env) { return L(env) + R(env); };
          if (node.op === '-') return function (env) { return L(env) - R(env); };
          if (node.op === '*') return function (env) { return L(env) * R(env); };
          if (node.op === '/') return function (env) {
            var d = R(env);
            if (d === 0) return NaN;
            return L(env) / d;
          };
          if (node.op === '^') return function (env) { return Math.pow(L(env), R(env)); };
          throw new Error('op');
        case 'call':
          var fn = FN_NAMES[node.name];
          if (!fn) throw new Error('unknown fn: ' + node.name);
          var argFns = node.args.map(compile);
          return function (env) {
            var vals = argFns.map(function (f) { return f(env); });
            return fn.apply(null, vals);
          };
        default:
          throw new Error('ast');
      }
    }
    return compile(ast);
  }

  function compileExpression(src) {
    var prepared = preprocessExpr(src);
    if (!prepared) return { error: 'empty', fn: null };
    try {
      var tokens = tokenize(prepared);
      var ast = parseTokens(tokens);
      var fn = compileAst(ast);
      return { error: null, fn: fn, prepared: prepared };
    } catch (e) {
      return { error: e.message || 'parse', fn: null };
    }
  }

  function safeEval(fn, x) {
    try {
      var y = fn({ x: x });
      if (typeof y !== 'number' || !isFinite(y)) return NaN;
      return y;
    } catch (e) {
      return NaN;
    }
  }

  // ========================================
  // Colors for functions
  // ========================================

  var PALETTE = [
    '#0EA5E9', // sky
    '#EF4444', // red
    '#22C55E', // green
    '#A855F7', // purple
    '#F59E0B', // amber
    '#EC4899', // pink
    '#14B8A6', // teal
    '#6366F1'  // indigo
  ];

  var PRESETS = [
    'sin(x)',
    'cos(x)',
    'tan(x)',
    'x^2',
    'x^3',
    'sqrt(x)',
    'abs(x)',
    'exp(-x^2)',
    '1/x',
    'ln(x)',
    'sin(x)/x',
    'x*sin(x)'
  ];

  // ========================================
  // Graph state
  // ========================================

  var state = {
    functions: [], // { id, expr, color, visible, compiled, error }
    view: { xMin: -10, xMax: 10, yMin: -6, yMax: 6 },
    grid: true,
    axes: true,
    panMode: false,
    showTrace: true,
    nextId: 1,
    nextColor: 0
  };

  var STORAGE_KEY = 'fg.state.v1';

  // ========================================
  // Canvas rendering
  // ========================================

  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var wrapEl = null;
  var traceEl = null;
  var traceTextEl = null;
  var statusEl = null;
  var listEl = null;
  var dragging = false;
  var lastPointer = null;
  var rafId = 0;
  var needsDraw = true;

  function worldToScreen(x, y, w, h, v) {
    var sx = ((x - v.xMin) / (v.xMax - v.xMin)) * w;
    var sy = ((v.yMax - y) / (v.yMax - v.yMin)) * h;
    return { x: sx, y: sy };
  }

  function screenToWorld(sx, sy, w, h, v) {
    var x = v.xMin + (sx / w) * (v.xMax - v.xMin);
    var y = v.yMax - (sy / h) * (v.yMax - v.yMin);
    return { x: x, y: y };
  }

  function niceStep(range, targetTicks) {
    targetTicks = targetTicks || 10;
    var rough = range / targetTicks;
    var pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough) || 1e-12)));
    var n = rough / pow;
    var nice;
    if (n < 1.5) nice = 1;
    else if (n < 3.5) nice = 2;
    else if (n < 7.5) nice = 5;
    else nice = 10;
    return nice * pow;
  }

  function isDarkTheme() {
    try {
      return document.documentElement.classList.contains('dark') ||
        (document.body && document.body.classList.contains('dark'));
    } catch (e) {
      return false;
    }
  }

  function draw() {
    if (!canvas || !ctx) return;
    needsDraw = false;

    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var v = state.view;
    var dark = isDarkTheme();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = dark ? '#111111' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    var xStep = niceStep(v.xMax - v.xMin, 12);
    var yStep = niceStep(v.yMax - v.yMin, 10);

    // Grid
    if (state.grid) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var x0 = Math.ceil(v.xMin / xStep) * xStep;
      for (var x = x0; x <= v.xMax + 1e-12; x += xStep) {
        var p = worldToScreen(x, 0, w, h, v);
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, h);
      }
      var y0 = Math.ceil(v.yMin / yStep) * yStep;
      for (var y = y0; y <= v.yMax + 1e-12; y += yStep) {
        var q = worldToScreen(0, y, w, h, v);
        ctx.moveTo(0, q.y);
        ctx.lineTo(w, q.y);
      }
      ctx.stroke();
    }

    // Axes
    if (state.axes) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var ox = worldToScreen(0, 0, w, h, v);
      if (ox.x >= 0 && ox.x <= w) {
        ctx.moveTo(ox.x, 0);
        ctx.lineTo(ox.x, h);
      }
      if (ox.y >= 0 && ox.y <= h) {
        ctx.moveTo(0, ox.y);
        ctx.lineTo(w, ox.y);
      }
      ctx.stroke();

      // Tick labels
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)';
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (var xt = Math.ceil(v.xMin / xStep) * xStep; xt <= v.xMax + 1e-12; xt += xStep) {
        if (Math.abs(xt) < xStep * 0.01) continue;
        var pt = worldToScreen(xt, 0, w, h, v);
        var ly = Math.min(Math.max(ox.y + 4, 2), h - 14);
        ctx.fillText(formatTick(xt), pt.x, ly);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (var yt = Math.ceil(v.yMin / yStep) * yStep; yt <= v.yMax + 1e-12; yt += yStep) {
        if (Math.abs(yt) < yStep * 0.01) continue;
        var py = worldToScreen(0, yt, w, h, v);
        var lx = Math.min(Math.max(ox.x - 4, 28), w - 4);
        ctx.fillText(formatTick(yt), lx, py.y);
      }
    }

    // Sample step in world x (aim ~2px)
    var samples = Math.max(200, Math.min(2000, Math.floor(w * 2)));
    var dx = (v.xMax - v.xMin) / samples;

    for (var fi = 0; fi < state.functions.length; fi++) {
      var f = state.functions[fi];
      if (!f.visible || !f.compiled || f.error) continue;

      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      var moved = false;
      var prevY = NaN;

      for (var i = 0; i <= samples; i++) {
        var wx = v.xMin + i * dx;
        var wy = safeEval(f.compiled, wx);
        if (!isFinite(wy)) {
          moved = false;
          prevY = NaN;
          continue;
        }
        // discontinuity heuristic
        if (isFinite(prevY) && Math.abs(wy - prevY) > (v.yMax - v.yMin) * 0.5) {
          moved = false;
        }
        var sp = worldToScreen(wx, wy, w, h, v);
        if (!moved) {
          ctx.moveTo(sp.x, sp.y);
          moved = true;
        } else {
          ctx.lineTo(sp.x, sp.y);
        }
        prevY = wy;
      }
      ctx.stroke();
    }
  }

  function formatTick(n) {
    if (Math.abs(n) < 1e-10) return '0';
    var a = Math.abs(n);
    if (a >= 1000 || (a > 0 && a < 0.01)) return n.toExponential(1);
    var s = n.toFixed(4).replace(/\.?0+$/, '');
    return s;
  }

  function scheduleDraw() {
    needsDraw = true;
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      if (needsDraw) draw();
    });
  }

  function resizeCanvas() {
    if (!canvas || !wrapEl) return;
    var rect = wrapEl.getBoundingClientRect();
    var w = Math.max(100, Math.floor(rect.width));
    var h = Math.max(100, Math.floor(rect.height));
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    scheduleDraw();
  }

  // ========================================
  // View controls
  // ========================================

  function zoomAt(screenX, screenY, factor) {
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var v = state.view;
    var world = screenToWorld(screenX, screenY, w, h, v);
    var nxMin = world.x - (world.x - v.xMin) * factor;
    var nxMax = world.x + (v.xMax - world.x) * factor;
    var nyMin = world.y - (world.y - v.yMin) * factor;
    var nyMax = world.y + (v.yMax - world.y) * factor;
    // clamp range
    if (nxMax - nxMin < 1e-8 || nyMax - nyMin < 1e-8) return;
    if (nxMax - nxMin > 1e8 || nyMax - nyMin > 1e8) return;
    state.view = { xMin: nxMin, xMax: nxMax, yMin: nyMin, yMax: nyMax };
    scheduleDraw();
    persist();
  }

  function panBy(dxScreen, dyScreen) {
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var v = state.view;
    var dx = (-dxScreen / w) * (v.xMax - v.xMin);
    var dy = (dyScreen / h) * (v.yMax - v.yMin);
    state.view = {
      xMin: v.xMin + dx,
      xMax: v.xMax + dx,
      yMin: v.yMin + dy,
      yMax: v.yMax + dy
    };
    scheduleDraw();
  }

  function resetView() {
    var aspect = 1;
    if (canvas) {
      aspect = (canvas.width / dpr) / Math.max(1, canvas.height / dpr);
    }
    var xSpan = 20;
    var ySpan = xSpan / aspect;
    state.view = {
      xMin: -xSpan / 2,
      xMax: xSpan / 2,
      yMin: -ySpan / 2,
      yMax: ySpan / 2
    };
    scheduleDraw();
    persist();
  }

  // ========================================
  // Function list UI
  // ========================================

  function makeId() {
    return 'f' + (state.nextId++);
  }

  function addFunction(expr, color) {
    expr = expr == null ? '' : String(expr);
    color = color || PALETTE[state.nextColor % PALETTE.length];
    state.nextColor++;
    var item = {
      id: makeId(),
      expr: expr,
      color: color,
      visible: true,
      compiled: null,
      error: null
    };
    recompile(item);
    state.functions.push(item);
    renderFunctionList();
    scheduleDraw();
    persist();
    return item;
  }

  function recompile(item) {
    if (!item.expr || !String(item.expr).trim()) {
      item.compiled = null;
      item.error = 'empty';
      return;
    }
    var res = compileExpression(item.expr);
    if (res.error) {
      item.compiled = null;
      item.error = res.error;
    } else {
      item.compiled = res.fn;
      item.error = null;
    }
  }

  function removeFunction(id) {
    state.functions = state.functions.filter(function (f) { return f.id !== id; });
    renderFunctionList();
    scheduleDraw();
    persist();
  }

  function renderFunctionList() {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.functions.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:0.8rem;color:#94a3b8;padding:8px 4px;';
      empty.textContent = t('emptyFn');
      listEl.appendChild(empty);
      updateStatus();
      return;
    }

    state.functions.forEach(function (f, idx) {
      var item = document.createElement('div');
      item.className = 'fg-fn-item';
      item.dataset.id = f.id;

      var row = document.createElement('div');
      row.className = 'fg-fn-row';

      var colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'fg-fn-color';
      colorBtn.style.background = f.color;
      colorBtn.title = 'Color';
      colorBtn.addEventListener('click', function () {
        var i = PALETTE.indexOf(f.color);
        f.color = PALETTE[(i + 1) % PALETTE.length];
        colorBtn.style.background = f.color;
        scheduleDraw();
        persist();
      });

      var label = document.createElement('span');
      label.className = 'fg-fn-label';
      label.textContent = 'f' + (idx + 1);

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'fg-fn-input' + (f.error ? ' fg-error' : '');
      input.value = f.expr;
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.placeholder = 'sin(x)';
      input.addEventListener('input', function () {
        f.expr = input.value;
        recompile(f);
        if (f.error) input.classList.add('fg-error');
        else input.classList.remove('fg-error');
        var errEl = item.querySelector('.fg-fn-error-msg');
        if (f.error && f.error !== 'empty') {
          if (!errEl) {
            errEl = document.createElement('div');
            errEl.className = 'fg-fn-error-msg';
            item.appendChild(errEl);
          }
          errEl.textContent = f.error === 'empty' ? t('errEmpty') : t('errParse');
        } else if (errEl) {
          errEl.remove();
        }
        scheduleDraw();
        updateStatus();
        persistDebounced();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });

      var actions = document.createElement('div');
      actions.className = 'fg-fn-actions';

      var visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = 'fg-fn-visible' + (f.visible ? '' : ' off');
      visBtn.textContent = f.visible ? '👁' : '👁‍🗨';
      visBtn.title = f.visible ? t('hide') : t('visible');
      visBtn.addEventListener('click', function () {
        f.visible = !f.visible;
        visBtn.className = 'fg-fn-visible' + (f.visible ? '' : ' off');
        visBtn.textContent = f.visible ? '👁' : '👁‍🗨';
        scheduleDraw();
        persist();
      });

      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'fg-fn-remove';
      rmBtn.textContent = '×';
      rmBtn.title = t('remove');
      rmBtn.addEventListener('click', function () {
        removeFunction(f.id);
      });

      actions.appendChild(visBtn);
      actions.appendChild(rmBtn);
      row.appendChild(colorBtn);
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(actions);
      item.appendChild(row);

      if (f.error && f.error !== 'empty') {
        var err = document.createElement('div');
        err.className = 'fg-fn-error-msg';
        err.textContent = t('errParse');
        item.appendChild(err);
      }

      listEl.appendChild(item);
    });

    updateStatus();
  }

  function updateStatus() {
    if (!statusEl) return;
    var hasErr = state.functions.some(function (f) {
      return f.expr && f.expr.trim() && f.error;
    });
    statusEl.textContent = hasErr ? t('statusError') : t('hint');
  }

  function renderPresets() {
    var el = document.querySelector('[data-content="presets"]');
    if (!el) return;
    el.innerHTML = '';
    PRESETS.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fg-preset';
      btn.textContent = p;
      btn.addEventListener('click', function () {
        addFunction(p);
      });
      el.appendChild(btn);
    });
  }

  // ========================================
  // Trace
  // ========================================

  function updateTrace(clientX, clientY) {
    if (!state.showTrace || !canvas || !traceEl || !traceTextEl) {
      if (traceEl) traceEl.hidden = true;
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var sx = clientX - rect.left;
    var sy = clientY - rect.top;
    var w = rect.width;
    var h = rect.height;
    if (sx < 0 || sy < 0 || sx > w || sy > h) {
      traceEl.hidden = true;
      return;
    }
    var world = screenToWorld(sx, sy, w, h, state.view);
    var parts = ['x=' + world.x.toFixed(4)];
    var best = null;
    var bestDist = Infinity;

    state.functions.forEach(function (f, idx) {
      if (!f.visible || !f.compiled || f.error) return;
      var y = safeEval(f.compiled, world.x);
      if (!isFinite(y)) return;
      parts.push('f' + (idx + 1) + '=' + y.toFixed(4));
      var sp = worldToScreen(world.x, y, w, h, state.view);
      var dist = Math.abs(sp.y - sy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: world.x, y: y, sx: sp.x, sy: sp.y, color: f.color };
      }
    });

    traceTextEl.textContent = parts.join('  ');
    traceEl.hidden = false;
    var left = sx;
    var top = sy;
    if (best && bestDist < 40) {
      left = best.sx;
      top = best.sy;
    }
    // keep on screen
    var tw = traceEl.offsetWidth || 120;
    if (left + 12 + tw > w) left = Math.max(0, left - tw - 12);
    traceEl.style.left = left + 'px';
    traceEl.style.top = top + 'px';
  }

  // ========================================
  // Evaluate box
  // ========================================

  function runEvaluate() {
    var input = document.querySelector('[data-input="eval-expr"]');
    var out = document.querySelector('[data-content="eval-result"]');
    if (!input || !out) return;
    var src = input.value.trim();
    if (!src) {
      out.textContent = '';
      return;
    }
    // Allow pure expressions without x
    var res = compileExpression(src);
    if (res.error) {
      out.textContent = t('errParse');
      return;
    }
    var y = safeEval(res.fn, 0);
    if (!isFinite(y)) {
      out.textContent = t('errDomain');
      return;
    }
    out.textContent = '= ' + y;
  }

  // ========================================
  // Persistence
  // ========================================

  var persistTimer = 0;

  function persistDebounced() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 400);
  }

  async function persist() {
    try {
      if (typeof Tapp === 'undefined' || !Tapp.storage) return;
      var data = {
        functions: state.functions.map(function (f) {
          return { expr: f.expr, color: f.color, visible: f.visible };
        }),
        view: state.view,
        grid: state.grid,
        axes: state.axes,
        nextColor: state.nextColor
      };
      await Tapp.storage.set(STORAGE_KEY, data);
    } catch (e) {
      // ignore
    }
  }

  async function loadPersisted() {
    try {
      if (typeof Tapp === 'undefined' || !Tapp.storage) return false;
      var data = await Tapp.storage.get(STORAGE_KEY);
      if (!data || !data.functions) return false;
      state.functions = [];
      state.nextId = 1;
      data.functions.forEach(function (f) {
        var item = {
          id: makeId(),
          expr: f.expr || '',
          color: f.color || PALETTE[0],
          visible: f.visible !== false,
          compiled: null,
          error: null
        };
        recompile(item);
        state.functions.push(item);
      });
      if (data.view) state.view = data.view;
      if (typeof data.grid === 'boolean') state.grid = data.grid;
      if (typeof data.axes === 'boolean') state.axes = data.axes;
      if (typeof data.nextColor === 'number') state.nextColor = data.nextColor;
      return true;
    } catch (e) {
      return false;
    }
  }

  // ========================================
  // Events
  // ========================================

  function bindEvents(root) {
    root.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');
      if (action === 'add-function') {
        addFunction('');
        var inputs = listEl && listEl.querySelectorAll('.fg-fn-input');
        if (inputs && inputs.length) inputs[inputs.length - 1].focus();
      } else if (action === 'reset-view') {
        resetView();
      } else if (action === 'zoom-in') {
        var w = canvas.width / dpr;
        var h = canvas.height / dpr;
        zoomAt(w / 2, h / 2, 0.8);
      } else if (action === 'zoom-out') {
        var w2 = canvas.width / dpr;
        var h2 = canvas.height / dpr;
        zoomAt(w2 / 2, h2 / 2, 1.25);
      } else if (action === 'pan-mode') {
        state.panMode = !state.panMode;
        actionEl.classList.toggle('active', state.panMode);
        if (wrapEl) wrapEl.classList.toggle('panning', state.panMode);
      } else if (action === 'toggle-grid') {
        state.grid = !state.grid;
        actionEl.classList.toggle('active', state.grid);
        scheduleDraw();
        persist();
      } else if (action === 'toggle-axes') {
        state.axes = !state.axes;
        actionEl.classList.toggle('active', state.axes);
        scheduleDraw();
        persist();
      } else if (action === 'evaluate') {
        runEvaluate();
      } else if (action === 'toggle-help') {
        openHelp(true);
      } else if (action === 'close-help') {
        openHelp(false);
      }
    });

    var evalInput = root.querySelector('[data-input="eval-expr"]');
    if (evalInput) {
      evalInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          runEvaluate();
        }
      });
    }

    if (canvas) {
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var sx = e.clientX - rect.left;
        var sy = e.clientY - rect.top;
        var factor = e.deltaY > 0 ? 1.12 : 0.89;
        zoomAt(sx, sy, factor);
      }, { passive: false });

      canvas.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        dragging = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        if (wrapEl) wrapEl.classList.add('dragging');
      });

      canvas.addEventListener('pointermove', function (e) {
        if (dragging && lastPointer) {
          var dx = e.clientX - lastPointer.x;
          var dy = e.clientY - lastPointer.y;
          lastPointer = { x: e.clientX, y: e.clientY };
          panBy(dx, dy);
        } else {
          updateTrace(e.clientX, e.clientY);
        }
      });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        lastPointer = null;
        if (wrapEl) wrapEl.classList.remove('dragging');
        persist();
      }

      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      canvas.addEventListener('pointerleave', function () {
        if (traceEl) traceEl.hidden = true;
      });
    }

    window.addEventListener('resize', function () {
      resizeCanvas();
    });
  }

  function openHelp(show) {
    var modal = document.querySelector('[data-modal="help"]');
    if (!modal) return;
    modal.hidden = !show;
    if (show) {
      var body = document.querySelector('[data-content="help-body"]');
      if (body) body.innerHTML = t('helpBody');
      var title = modal.querySelector('h2');
      if (title) title.textContent = t('helpTitle');
    }
  }

  function applyI18n(root) {
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
  }

  // ========================================
  // Lifecycle
  // ========================================

  async function initPage() {
    var root = document.getElementById('tapp-root') || document.querySelector('[data-page-root]');
    if (!root) return;

    try {
      if (typeof Tapp !== 'undefined' && Tapp.platform && Tapp.platform.getLocale) {
        currentLocale = normalizeLocale(await Tapp.platform.getLocale());
      } else if (typeof navigator !== 'undefined') {
        currentLocale = normalizeLocale(navigator.language);
      }
    } catch (e) {
      currentLocale = 'zh-CN';
    }

    applyI18n(root);

    wrapEl = root.querySelector('[data-content="canvas-wrap"]');
    canvas = root.querySelector('[data-canvas="graph"]');
    listEl = root.querySelector('[data-content="function-list"]');
    statusEl = root.querySelector('[data-content="status"]');
    traceEl = root.querySelector('[data-content="trace"]');
    traceTextEl = root.querySelector('[data-content="trace-text"]');

    if (canvas) {
      ctx = canvas.getContext('2d');
    }

    // Settings defaults
    try {
      if (typeof Tapp !== 'undefined' && Tapp.settings) {
        var gmin = await Tapp.settings.get('defaultXMin');
        var gmax = await Tapp.settings.get('defaultXMax');
        var grid = await Tapp.settings.get('gridEnabled');
        var trace = await Tapp.settings.get('showTrace');
        if (typeof gmin === 'number' && typeof gmax === 'number' && gmax > gmin) {
          state.view.xMin = gmin;
          state.view.xMax = gmax;
          var aspect = 1.6;
          var ySpan = (gmax - gmin) / aspect;
          state.view.yMin = -ySpan / 2;
          state.view.yMax = ySpan / 2;
        }
        if (typeof grid === 'boolean') state.grid = grid;
        if (typeof trace === 'boolean') state.showTrace = trace;
      }
    } catch (e) { /* ignore */ }

    var loaded = await loadPersisted();
    if (!loaded && state.functions.length === 0) {
      addFunction('sin(x)');
      addFunction('x^2 / 10');
    }

    renderPresets();
    renderFunctionList();
    bindEvents(root);
    resizeCanvas();
    scheduleDraw();

    // Toolbar active states
    var gridBtn = root.querySelector('[data-action="toggle-grid"]');
    var axesBtn = root.querySelector('[data-action="toggle-axes"]');
    if (gridBtn) gridBtn.classList.toggle('active', state.grid);
    if (axesBtn) axesBtn.classList.toggle('active', state.axes);

    // Observe theme / size
    if (typeof ResizeObserver !== 'undefined' && wrapEl) {
      var ro = new ResizeObserver(function () { resizeCanvas(); });
      ro.observe(wrapEl);
    }
  }

  if (typeof Tapp !== 'undefined' && Tapp.lifecycle) {
    Tapp.lifecycle.onReady(function () {
      initPage();
    });
    Tapp.lifecycle.onDestroy(function () {
      if (rafId) cancelAnimationFrame(rafId);
      persist();
    });
    Tapp.lifecycle.onPause(function () {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    });
    Tapp.lifecycle.onResume(function () {
      scheduleDraw();
    });
  } else {
    // Standalone / preview fallback
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
  }
})();
