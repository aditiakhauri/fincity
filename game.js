// ===== STATE =====
let state = {
  coins: 0,
  done: [],          // completed chapter ids
  current: null,     // current chapter id
  phase: 'story',    // 'story' | 'interactive' | 'quiz'
  qIdx: 0,
  qAnswered: false
};

function save() { localStorage.setItem('fincity', JSON.stringify(state)); }
function load() {
  const d = localStorage.getItem('fincity');
  if (d) state = { ...state, ...JSON.parse(d) };
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function startGame() { state.done = []; state.coins = 0; save(); showMap(); }
function showMap() { renderMap(); showScreen('map'); }

// ===== HOME =====
load();
if (state.done && state.done.length > 0) {
  document.getElementById('continue-btn').style.display = 'inline-flex';
}

// ===== MAP =====
function renderMap() {
  const g = document.getElementById('chapters-grid');
  document.getElementById('map-coins').textContent = state.coins;
  document.getElementById('map-prog').textContent = state.done.length + '/15';
  g.innerHTML = CHAPTERS.map((ch, i) => {
    const unlocked = i === 0 || state.done.includes(CHAPTERS[i - 1].id);
    const done = state.done.includes(ch.id);
    return `<div class="ch-card ${done ? 'done' : ''} ${unlocked ? '' : 'locked'}"
      onclick="${unlocked ? `openChapter('${ch.id}')` : ''}">
      <div class="ch-num">Chapter ${ch.num}</div>
      <span class="ch-icon">${ch.icon}</span>
      <div class="ch-title">${ch.title}</div>
      <div class="ch-tag">${ch.tag}</div>
      ${unlocked ? '' : '<div class="lock-icon">🔒</div>'}
    </div>`;
  }).join('');
}

// ===== CHAPTER =====
function openChapter(id) {
  state.current = id;
  state.phase = 'story';
  state.qIdx = 0;
  state.qAnswered = false;
  save();
  const ch = CHAPTERS.find(c => c.id === id);
  document.getElementById('ch-icon').textContent = ch.icon;
  document.getElementById('ch-title').textContent = ch.title;
  document.getElementById('ch-sub').textContent = `Chapter ${ch.num} · ${ch.tag}`;
  document.getElementById('ch-coins').textContent = state.coins;
  renderPhase();
  showScreen('chapter');
}

function renderPhase() {
  const ch = CHAPTERS.find(c => c.id === state.current);
  // Phase nav
  const phases = [
    { key: 'story', label: '📖 Story' },
    { key: 'interactive', label: '🎮 Play' },
    { key: 'quiz', label: '🧠 Quiz' }
  ];
  document.getElementById('phase-nav').innerHTML = phases.map((p, i) => {
    const idx = phases.findIndex(x => x.key === state.phase);
    const cls = p.key === state.phase ? 'active' : (i < idx ? 'done' : '');
    return `<span class="phase-step ${cls}">${p.label}</span>${i < 2 ? '<span class="phase-arrow">›</span>' : ''}`;
  }).join('');

  const content = document.getElementById('ch-content');
  if (state.phase === 'story') renderStory(ch, content);
  else if (state.phase === 'interactive') renderInteractive(ch, content);
  else if (state.phase === 'quiz') renderQuiz(ch, content);
}

// ===== STORY =====
function renderStory(ch, el) {
  el.innerHTML = `
    <div class="view-toggle-row">
      <div class="view-toggle">
        <button class="vt-btn active">📖 Story</button>
        <button class="vt-btn" onclick="goInteractive()">🎮 Game</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goQuiz()">🧠 Quiz →</button>
    </div>
    <div class="ch-body">
      <div class="panel">
        <div class="panel-label">Story</div>
        <div class="scene-box">${ch.scene}</div>
        ${ch.dialogues.map(d => `
          <div class="dialogue">
            <div class="dlg-who ${d.who}">${d.who === 'finn' ? '🦊 Finn' : d.who === 'alex' ? '🧑 Alex' : '📝 Narrator'}</div>
            <div class="dlg-text ${d.who}">${d.text}</div>
          </div>
        `).join('')}
      </div>
      <div class="panel">
        <div class="panel-label">Key Concept</div>
        <div class="concept-box">
          <h4>💡 What You'll Learn</h4>
          <p>${ch.concept}</p>
        </div>
      </div>
    </div>`;
}

function goInteractive() {
  state.phase = 'interactive';
  save();
  renderPhase();
}

function goStory() {
  state.phase = 'story';
  save();
  renderPhase();
}

// ===== INTERACTIVE =====
function renderInteractive(ch, el) {
  el.innerHTML = `
    <div class="view-toggle-row">
      <div class="view-toggle">
        <button class="vt-btn" onclick="goStory()">📖 Story</button>
        <button class="vt-btn active">🎮 Game</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goQuiz()">🧠 Quiz →</button>
    </div>
    <div id="interactive-main" class="panel" style="min-height:420px">
      <div class="panel-label">Interactive Demo</div>
      <div id="game-area"></div>
    </div>`;

  const area = document.getElementById('game-area');
  const games = {
    'stock-market': initStockGame,
    'bid-ask': initBidAskGame,
    'trading': initTradingGame,
    'dividends': initDividendsGame,
    'portfolio': initPortfolioGame,
    'volatility': initVolatilityGame,
    'interest-rates': initInterestGame,
    'fx-market': initFXGame,
    'commodities': initCommodityGame,
    'derivatives': initDerivativesGame,
    'options': initOptionsGame,
    'payoffs': initPayoffsGame,
    'hedging': initHedgingGame,
    'otc': initOTCGame,
    'crypto': initCryptoGame
  };
  if (games[ch.id]) games[ch.id](area);
}

function goQuiz() {
  state.phase = 'quiz';
  state.qIdx = 0;
  state.qAnswered = false;
  save();
  renderPhase();
}

// ===== INTERACTIVE GAMES =====

function initStockGame(el) {
  let budget = 500, shares = 0, price = 50, totalShares = 1000;
  function render() {
    const owned = ((shares / totalShares) * 100).toFixed(1);
    const value = (shares * price).toFixed(0);
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">🍌 BananaCo</div>
        <div class="big-number gold">$${price} / share</div>
        <div style="font-size:12px;color:var(--muted)">Total company: 1,000 shares · Worth $${(price*totalShares).toLocaleString()}</div>
      </div>
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 Your Budget</div><div class="wallet-value" style="color:var(--green)">$${budget}</div></div>
        <div class="wallet-item"><div class="wallet-label">📦 Shares Owned</div><div class="wallet-value" style="color:var(--gold)">${shares}</div></div>
        <div class="wallet-item"><div class="wallet-label">💰 Portfolio Value</div><div class="wallet-value" style="color:var(--accent2)">$${value}</div></div>
      </div>
      <div class="bar-row">
        <div class="bar-labels"><span>Your Ownership</span><span style="color:var(--gold)">${owned}%</span></div>
        <div class="bar-track"><div class="bar-fill gold" style="width:${Math.min(owned,100)}%"></div></div>
      </div>
      <div class="flex gap8 mt16">
        <button class="btn btn-green" style="flex:1" onclick="stockBuy()" ${budget < price ? 'disabled' : ''}>Buy 1 Share (+$${price})</button>
        <button class="btn btn-red" style="flex:1" onclick="stockSell()" ${shares === 0 ? 'disabled' : ''}>Sell 1 Share (-$${price})</button>
      </div>
      <div class="flex gap8 mt8">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockBuy5()" ${budget < price*5 ? 'disabled' : ''}>Buy 5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockPriceUp()">📈 Price +$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockPriceDown()">📉 Price −$5</button>
      </div>
      ${shares > 0 ? `<div class="info-box green mt12">✅ You own ${owned}% of BananaCo! Your investment is worth $${value}. ${shares >= 100 ? '🎉 Major shareholder!' : 'Keep buying to increase ownership.'}</div>` : `<div class="info-box mt12">👆 Buy shares to become a BananaCo owner. Each share = $${price} and gives you a tiny piece of the company.</div>`}`;
    window.stockBuy = () => { if(budget>=price){budget-=price;shares++;render();} };
    window.stockSell = () => { if(shares>0){budget+=price;shares--;render();} };
    window.stockBuy5 = () => { let n=Math.min(5,Math.floor(budget/price));budget-=n*price;shares+=n;render(); };
    window.stockPriceUp = () => { price+=5; render(); };
    window.stockPriceDown = () => { if(price>10){price-=5;} render(); };
  }
  render();
}

function initBidAskGame(el) {
  let userAction = null;
  function render() {
    el.innerHTML = `
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px">📋 Live Order Book — BananaCo</div>
      <div class="orderbook">
        <div class="ob-side">
          <div class="ob-label ask">ASKS (Sellers)</div>
          <div class="ob-row"><span class="price ask">$54.00</span><span style="color:var(--muted)">200 shares</span></div>
          <div class="ob-row"><span class="price ask">$53.00</span><span style="color:var(--muted)">350 shares</span></div>
          <div class="ob-row"><span class="price ask">$52.00</span><span style="color:var(--muted)">150 shares</span></div>
        </div>
        <div class="ob-side">
          <div class="ob-label bid">BIDS (Buyers)</div>
          <div class="ob-row"><span class="price bid">$48.00</span><span style="color:var(--muted)">300 shares</span></div>
          <div class="ob-row"><span class="price bid">$47.00</span><span style="color:var(--muted)">220 shares</span></div>
          <div class="ob-row"><span class="price bid">$46.00</span><span style="color:var(--muted)">180 shares</span></div>
        </div>
      </div>
      <div style="text-align:center;background:var(--card2);border-radius:8px;padding:10px;margin:10px 0;font-size:13px">
        Spread: <span style="color:var(--red);font-weight:700">$52</span> (ask) − <span style="color:var(--green);font-weight:700">$48</span> (bid) = <span style="color:var(--gold);font-weight:700">$4</span> &nbsp;|&nbsp; Mid: $50
      </div>
      <div class="flex gap8">
        <button class="btn btn-green" style="flex:1" onclick="doBuy()">🛒 Buy Now (pay $52 ask)</button>
        <button class="btn btn-red" style="flex:1" onclick="doSell()">💸 Sell Now (get $48 bid)</button>
      </div>
      ${userAction === 'buy' ? `<div class="info-box green mt12">✅ Order FILLED at $52 (the Ask). Sellers were asking $52 minimum, so that's what you paid. The $4 spread went to the market maker!</div>` : ''}
      ${userAction === 'sell' ? `<div class="info-box red mt12">✅ Order FILLED at $48 (the Bid). Buyers were only willing to pay $48, so that's what you received. You "lost" $4 to the spread.</div>` : ''}
      <div class="info-box mt12">💡 <b>Spread = $4.</b> A market maker buys at $48 (bid) and sells at $52 (ask), pocketing $4 per share. Tighter spreads = fairer prices for traders.</div>`;
    window.doBuy = () => { userAction='buy'; render(); };
    window.doSell = () => { userAction='sell'; render(); };
  }
  render();
}

function initTradingGame(el) {
  let marketPrice = 50, orders = [], limitPrice = 45, orderType = 'market';
  function render() {
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted)">BananaCo Current Price</div>
        <div class="big-number gold">$${marketPrice}</div>
      </div>
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${orderType==='market'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOT('market')">Market Order</button>
        <button class="btn ${orderType==='limit'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOT('limit')">Limit Order</button>
      </div>
      ${orderType==='market' ? `
        <div class="info-box">⚡ Market Order: Fills IMMEDIATELY at current price ($${marketPrice}). Fast, but no price control.</div>
        <div class="flex gap8 mt12">
          <button class="btn btn-green" style="flex:1" onclick="placeMarket('buy')">Buy Now at $${marketPrice}</button>
          <button class="btn btn-red" style="flex:1" onclick="placeMarket('sell')">Sell Now at $${marketPrice}</button>
        </div>` : `
        <div class="info-box">⏳ Limit Order: Only fills if price reaches your target. You're in control, but may wait forever.</div>
        <div style="margin:12px 0">
          <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px"><span>Limit Buy Price: <b style="color:var(--gold)">$${limitPrice}</b></span><span style="color:var(--muted)">Current: $${marketPrice}</span></div>
          <input type="range" min="30" max="70" value="${limitPrice}" oninput="setLP(this.value)">
        </div>
        <button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="placeLimitBuy()">Place Limit Buy at $${limitPrice}</button>
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="movePrice()">📉 Drop market price by $3</button>`}
      <div style="margin-top:14px">
        ${orders.map(o=>`<div class="info-box ${o.filled?'green':'gold'}">${o.filled?'✅':'⏳'} ${o.type.toUpperCase()} ${o.action} · ${o.filled?'Filled at $'+o.price:'Waiting for $'+o.target+' (market: $'+marketPrice+')'}</div>`).join('')}
      </div>`;
    window.setOT = t => { orderType=t; render(); };
    window.setLP = v => { limitPrice=parseInt(v); render(); };
    window.placeMarket = a => {
      orders.unshift({type:'market',action:a,price:marketPrice,filled:true});
      notify('✅ Market '+a+' filled at $'+marketPrice,'ok');
      render();
    };
    window.placeLimitBuy = () => {
      if(limitPrice>=marketPrice){notify('Limit price must be below market price!','bad');return;}
      orders.unshift({type:'limit',action:'buy',target:limitPrice,price:null,filled:false});
      render();
    };
    window.movePrice = () => {
      marketPrice = Math.max(30,marketPrice-3);
      orders = orders.map(o=>{ if(!o.filled&&o.type==='limit'&&marketPrice<=o.target){o.filled=true;o.price=o.target;notify('✅ Limit order filled at $'+o.target,'ok');} return o; });
      render();
    };
  }
  render();
}

function initDividendsGame(el) {
  let shares = 50, price = 40, div = 0;
  function render() {
    const annual = (shares * div).toFixed(2);
    const yld = price > 0 ? ((div / price) * 100).toFixed(2) : '0.00';
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">📦 Shares</div><div class="wallet-value" style="color:var(--accent2)">${shares}</div></div>
        <div class="wallet-item"><div class="wallet-label">💵 Share Price</div><div class="wallet-value" style="color:var(--gold)">$${price}</div></div>
        <div class="wallet-item"><div class="wallet-label">📬 Div/Share</div><div class="wallet-value" style="color:var(--green)">$${div.toFixed(2)}</div></div>
      </div>
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:12px;color:var(--muted)">Annual Dividend Income</div>
        <div class="big-number ${div>0?'green':'muted'}" style="${div===0?'color:var(--muted)':''}">$${annual}</div>
        <div style="font-size:13px;color:var(--muted)">Dividend Yield: <b style="color:var(--gold)">${yld}%</b></div>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Set dividend per share:</div>
      <input type="range" min="0" max="5" step="0.25" value="${div}" oninput="setDiv(this.value)">
      <div class="flex gap8 mt12">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjShares(-10)">−10 shares</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjShares(10)">+10 shares</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjPrice(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjPrice(5)">Price +$5</button>
      </div>
      <div class="info-box mt12">${div===0?'👆 Drag the slider to set a dividend. Watch how your income changes!':'💰 With '+shares+' shares paying $'+div.toFixed(2)+' each, you earn $'+annual+' per year ('+yld+'% yield). That\'s passive income just for owning shares!'}</div>`;
    window.setDiv = v => { div=parseFloat(v); render(); };
    window.adjShares = n => { shares=Math.max(0,shares+n); render(); };
    window.adjPrice = n => { price=Math.max(5,price+n); render(); };
  }
  render();
}

function initPortfolioGame(el) {
  const assets = [
    { name:'🍌 BananaCo Stock', pct:40, color:'#7c6dfa' },
    { name:'🥇 GoldCorp', pct:20, color:'#f5c518' },
    { name:'⛽ OilPlus Energy', pct:15, color:'#ff6080' },
    { name:'🏛️ FinCity Bonds', pct:15, color:'#00c896' },
    { name:'💵 Cash', pct:10, color:'#4fc3f7' }
  ];
  function render() {
    const total = assets.reduce((s,a)=>s+a.pct,0);
    const svgSize = 130, r = 52, cx = 65, cy = 65;
    let startAngle = -Math.PI/2, paths = '';
    assets.forEach(a=>{
      const slice = (a.pct/100)*Math.PI*2;
      const endAngle = startAngle+slice;
      const x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
      const x2=cx+r*Math.cos(endAngle), y2=cy+r*Math.sin(endAngle);
      const lg = slice>Math.PI?1:0;
      paths+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} Z" fill="${a.color}" opacity=".85"/>`;
      startAngle=endAngle;
    });
    el.innerHTML = `
      <div class="flex gap12" style="align-items:flex-start;flex-wrap:wrap">
        <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="flex-shrink:0">${paths}<circle cx="${cx}" cy="${cy}" r="28" fill="var(--card)"/><text x="${cx}" y="${cy+5}" text-anchor="middle" fill="var(--text)" font-size="11">Portfolio</text></svg>
        <div style="flex:1;min-width:180px">
          ${assets.map((a,i)=>`
            <div style="margin-bottom:8px">
              <div class="flex items-center justify-between" style="font-size:12px;margin-bottom:2px">
                <span>${a.name}</span><span style="color:${a.color};font-weight:700">${a.pct}%</span>
              </div>
              <input type="range" min="0" max="100" value="${a.pct}" oninput="setAlloc(${i},this.value)" style="accent-color:${a.color};margin:0">
            </div>`).join('')}
          <div style="font-size:12px;margin-top:8px;color:${total===100?'var(--green)':'var(--red)'}">
            Total: ${total}% ${total===100?'✅ Perfectly allocated':'⚠️ Must equal 100%'}
          </div>
        </div>
      </div>
      <div class="info-box mt12">
        ${total===100 ? '✅ Great allocation! You\'re diversified across stocks, gold, energy, bonds, and cash. No single asset can wipe you out.' : '⚖️ Adjust sliders to allocate your $10,000. Goal: reach exactly 100% total across all assets.'}
      </div>`;
    window.setAlloc = (i,v) => { assets[i].pct=parseInt(v); render(); };
  }
  render();
}

function initVolatilityGame(el) {
  let mode = 'stable', animFrame = null;
  const stablePrices = generatePrices(100, 0.5);
  const volPrices = generatePrices(100, 8);
  function generatePrices(start, vol) {
    let p=[start], v=start;
    for(let i=0;i<59;i++){v=Math.max(10,v+(Math.random()-0.5)*vol*2);p.push(+v.toFixed(2));}
    return p;
  }
  function render() {
    const prices = mode==='stable'?stablePrices:volPrices;
    const min=Math.min(...prices), max=Math.max(...prices);
    const swing = ((max-min)/prices[0]*100).toFixed(1);
    const last = prices[prices.length-1];
    const chg = ((last-prices[0])/prices[0]*100).toFixed(1);
    const w=300,h=120,pad=10;
    const points = prices.map((p,i)=>`${pad+i*(w-2*pad)/59},${pad+(max-p)/(max-min||1)*(h-2*pad)}`).join(' ');
    const color = mode==='stable'?'var(--green)':'var(--accent2)';
    el.innerHTML = `
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${mode==='stable'?'btn-green':'btn-ghost'} btn-sm" style="flex:1" onclick="setMode('stable')">📊 Stable Asset</button>
        <button class="btn ${mode==='volatile'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setMode('volatile')">🎢 Volatile Asset</button>
      </div>
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;background:var(--card2);border-radius:8px;margin-bottom:12px">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="${pad+(59)*(w-2*pad)/59}" cy="${pad+(max-last)/(max-min||1)*(h-2*pad)}" r="4" fill="${color}"/>
      </svg>
      <div class="flex gap8">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Price Swing</div>
          <div style="font-size:20px;font-weight:700;color:${color}">${swing}%</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Total Change</div>
          <div style="font-size:20px;font-weight:700;color:${parseFloat(chg)>=0?'var(--green)':'var(--red)'}">${chg}%</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Risk Level</div>
          <div style="font-size:20px;font-weight:700;color:${color}">${mode==='stable'?'Low':'High'}</div>
        </div>
      </div>
      <div class="info-box mt12">${mode==='stable'?'📊 Stable assets (bonds, blue-chip stocks) have small price swings. Lower risk, lower potential return.':'🎢 Volatile assets swing wildly! The same movement that creates big gains can cause massive losses. Higher risk = higher potential reward.'}</div>`;
    window.setMode = m => { mode=m; render(); };
  }
  render();
}

function initInterestGame(el) {
  let principal=1000, rate=5, years=10;
  function render() {
    const compound = principal*Math.pow(1+rate/100,years);
    const simple = principal*(1+rate*years/100);
    const extra = (compound-simple).toFixed(2);
    el.innerHTML = `
      <div>
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px"><span>Principal: <b style="color:var(--gold)">$${principal.toLocaleString()}</b></span></div>
        <input type="range" min="100" max="10000" step="100" value="${principal}" oninput="setP(this.value)">
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px;margin-top:10px"><span>Annual Rate: <b style="color:var(--accent2)">${rate}%</b></span></div>
        <input type="range" min="1" max="20" step="0.5" value="${rate}" oninput="setR(this.value)">
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px;margin-top:10px"><span>Years: <b style="color:var(--green)">${years}</b></span></div>
        <input type="range" min="1" max="30" value="${years}" oninput="setY(this.value)">
      </div>
      <div class="flex gap8 mt16">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Compound Interest</div>
          <div style="font-size:20px;font-weight:700;color:var(--green)">$${compound.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Simple Interest</div>
          <div style="font-size:20px;font-weight:700;color:var(--gold)">$${simple.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</div>
        </div>
      </div>
      <div class="info-box green mt12">🔮 Compound earns <b>$${extra} MORE</b> than simple interest! That's the power of earning interest ON your interest — this gap grows dramatically over time.</div>`;
    window.setP=v=>{principal=parseInt(v);render();};
    window.setR=v=>{rate=parseFloat(v);render();};
    window.setY=v=>{years=parseInt(v);render();};
  }
  render();
}

function initFXGame(el) {
  const rates = { EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36 };
  let from='USD', to='EUR', amount=100;
  function render() {
    const rate = to==='USD' ? 1/rates[from] : rates[to];
    const result = (amount * rate).toFixed(2);
    const flags = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', CAD:'🇨🇦' };
    const currencies = ['USD','EUR','GBP','JPY','CAD'];
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px">Amount to convert:</div>
        <input type="number" value="${amount}" oninput="setAmt(this.value)" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;color:var(--text);font-size:20px;font-weight:700;width:160px;text-align:center">
      </div>
      <div class="flex gap8" style="margin-bottom:14px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">FROM</div>
          <div class="flex" style="flex-wrap:wrap;gap:4px">
            ${currencies.map(c=>`<button class="btn btn-sm ${from===c?'btn-primary':'btn-ghost'}" onclick="setFrom('${c}')">${flags[c]} ${c}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="flex gap8" style="margin-bottom:14px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">TO</div>
          <div class="flex" style="flex-wrap:wrap;gap:4px">
            ${currencies.map(c=>`<button class="btn btn-sm ${to===c?'btn-primary':'btn-ghost'}" onclick="setTo('${c}')">${flags[c]} ${c}</button>`).join('')}
          </div>
        </div>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:13px;color:var(--muted)">${flags[from]} ${amount} ${from} =</div>
        <div class="big-number accent">${flags[to]} ${result} ${to}</div>
        <div style="font-size:12px;color:var(--muted)">Rate: 1 ${from} = ${rate.toFixed(4)} ${to}</div>
      </div>`;
    window.setAmt=v=>{amount=parseFloat(v)||0;render();};
    window.setFrom=c=>{from=c;if(to===c)to=c==='USD'?'EUR':'USD';render();};
    window.setTo=c=>{to=c;if(from===c)from=c==='USD'?'EUR':'USD';render();};
  }
  render();
}

function initCommodityGame(el) {
  let prices = { Gold: 1950, Oil: 78, Wheat: 290, Coffee: 185 };
  let holdings = { Gold: 0, Oil: 0, Wheat: 0, Coffee: 0 };
  let cash = 1000;
  const icons = { Gold:'🥇', Oil:'⛽', Wheat:'🌾', Coffee:'☕' };
  const events = [
    { text:'⛈️ Bad harvest in Brazil!', effect: { Wheat:+40, Coffee:+30 } },
    { text:'🛢️ OPEC cuts production!', effect: { Oil:+18 } },
    { text:'💵 Strong USD!', effect: { Gold:-25, Oil:-8 } },
    { text:'🌍 Economic boom!', effect: { Gold:-15, Oil:+22, Wheat:+10 } },
    { text:'😨 Market panic! Investors flee to gold!', effect: { Gold:+80, Oil:-15 } }
  ];
  function pv() { return Object.keys(holdings).reduce((s,k)=>s+holdings[k]*prices[k],0); }
  function render() {
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 Cash</div><div class="wallet-value" style="color:var(--green)">$${cash.toFixed(0)}</div></div>
        <div class="wallet-item"><div class="wallet-label">📦 Holdings Value</div><div class="wallet-value" style="color:var(--gold)">$${pv().toFixed(0)}</div></div>
      </div>
      <table class="tbl" style="margin-bottom:12px">
        <tr><th>Commodity</th><th>Price</th><th>Owned</th><th>Actions</th></tr>
        ${Object.keys(prices).map(k=>`
          <tr>
            <td>${icons[k]} ${k}</td>
            <td style="color:var(--gold);font-weight:600">$${prices[k]}</td>
            <td>${holdings[k]}</td>
            <td>
              <button class="btn btn-sm btn-green" onclick="buyComm('${k}')" ${cash<prices[k]?'disabled':''} style="padding:4px 10px;margin-right:4px">Buy</button>
              <button class="btn btn-sm btn-red" onclick="sellComm('${k}')" ${holdings[k]===0?'disabled':''} style="padding:4px 10px">Sell</button>
            </td>
          </tr>`).join('')}
      </table>
      <button class="btn btn-primary" style="width:100%" onclick="triggerEvent()">🎲 Trigger Market Event</button>
      <div id="event-msg"></div>`;
    window.buyComm=k=>{if(cash>=prices[k]){cash-=prices[k];holdings[k]++;render();}};
    window.sellComm=k=>{if(holdings[k]>0){cash+=prices[k];holdings[k]--;render();}};
    window.triggerEvent=()=>{
      const e=events[Math.floor(Math.random()*events.length)];
      Object.entries(e.effect).forEach(([k,v])=>{prices[k]=Math.max(10,prices[k]+v);});
      document.getElementById('event-msg').innerHTML=`<div class="info-box mt8">📢 <b>Event:</b> ${e.text} — see how commodity prices reacted!</div>`;
      render();
    };
  }
  render();
}

function initDerivativesGame(el) {
  let underlying = 100, leverage = 5;
  function render() {
    const deriv = (underlying - 100) * leverage;
    const col = deriv >= 0 ? 'var(--green)' : 'var(--red)';
    const pct = ((underlying-100)/100*100).toFixed(1);
    const derivPct = (pct*leverage).toFixed(1);
    el.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">🛢️ Oil Price (Underlying Asset): <b style="color:var(--gold)">$${underlying}</b></div>
        <input type="range" min="60" max="140" value="${underlying}" oninput="setUnd(this.value)">
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">⚡ Leverage: <b style="color:var(--accent2)">${leverage}x</b></div>
        <input type="range" min="1" max="10" value="${leverage}" oninput="setLev(this.value)">
      </div>
      <div class="flex gap8">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Oil Change</div>
          <div style="font-size:22px;font-weight:700;color:${pct>=0?'var(--green)':'var(--red)'}">${pct}%</div>
        </div>
        <div style="font-size:24px;display:flex;align-items:center">→</div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Derivative P&L</div>
          <div style="font-size:22px;font-weight:700;color:${col}">${deriv>=0?'+':''}$${deriv.toFixed(0)}</div>
          <div style="font-size:11px;color:var(--muted)">${derivPct}%</div>
        </div>
      </div>
      <div class="info-box mt12">${leverage===1?'At 1x leverage, derivative moves match the underlying 1:1.':'⚡ With '+leverage+'x leverage: oil moves '+pct+'% → derivative moves '+derivPct+'%! That\'s the POWER of derivatives. But losses are amplified equally — '+leverage+'x gains, '+leverage+'x losses.'}</div>`;
    window.setUnd=v=>{underlying=parseInt(v);render();};
    window.setLev=v=>{leverage=parseInt(v);render();};
  }
  render();
}

function initOptionsGame(el) {
  let strike=55, premium=3, spotPrice=50, optionType='call';
  function render() {
    const itm = optionType==='call' ? spotPrice>strike : spotPrice<strike;
    let payoff = 0;
    if(optionType==='call') payoff = Math.max(0, spotPrice-strike) - premium;
    else payoff = Math.max(0, strike-spotPrice) - premium;
    const breakeven = optionType==='call' ? strike+premium : strike-premium;
    const col = payoff>0?'var(--green)':payoff<0?'var(--red)':'var(--muted)';
    el.innerHTML = `
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${optionType==='call'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOType('call')">📈 Call Option</button>
        <button class="btn ${optionType==='put'?'btn-red':'btn-ghost'} btn-sm" style="flex:1" onclick="setOType('put')">📉 Put Option</button>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">
        ${optionType==='call'?'Right to BUY at strike price':'Right to SELL at strike price'}
      </div>
      <div class="flex gap8" style="margin-bottom:12px">
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Strike: <b style="color:var(--gold)">$${strike}</b></div><input type="range" min="40" max="70" value="${strike}" oninput="setStrike(this.value)"></div>
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Premium: <b style="color:var(--red)">$${premium}</b></div><input type="range" min="1" max="10" value="${premium}" oninput="setPrem(this.value)"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Current Stock Price: <b style="color:var(--accent2)">$${spotPrice}</b></div>
      <input type="range" min="30" max="80" value="${spotPrice}" oninput="setSpot(this.value)">
      <div class="flex gap8 mt12">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Status</div>
          <div style="font-size:14px;font-weight:700;color:${itm?'var(--green)':'var(--red)'}">${itm?'In The Money ✅':'Out of Money ❌'}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Break-even</div>
          <div style="font-size:18px;font-weight:700;color:var(--gold)">$${breakeven}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Your P&L</div>
          <div style="font-size:18px;font-weight:700;color:${col}">${payoff>0?'+':''}$${payoff.toFixed(2)}</div>
        </div>
      </div>
      <div class="info-box mt12">${optionType==='call'
        ? (itm?`✅ In the money! Stock ($${spotPrice}) > Strike ($${strike}). You can buy at $${strike}, sell at $${spotPrice}. P&L: $${payoff.toFixed(2)}`:`Stock ($${spotPrice}) < Strike ($${strike}). Option is OTM. Max loss = $${premium} premium. You need price above $${breakeven} to profit.`)
        : (itm?`✅ In the money! Stock ($${spotPrice}) < Strike ($${strike}). You can sell at $${strike}, while market is $${spotPrice}. P&L: $${payoff.toFixed(2)}`:`Stock ($${spotPrice}) > Strike ($${strike}). Option is OTM. Max loss = $${premium} premium. You need price below $${breakeven} to profit.`)
      }</div>`;
    window.setStrike=v=>{strike=parseInt(v);render();};
    window.setPrem=v=>{premium=parseInt(v);render();};
    window.setSpot=v=>{spotPrice=parseInt(v);render();};
    window.setOType=t=>{optionType=t;render();};
  }
  render();
}

function initPayoffsGame(el) {
  let buyPrice=50, spotPrice=50;
  const callStrike=55, callPremium=3;
  const putStrike=45, putPremium=2;
  function render() {
    const longStock = spotPrice - buyPrice;
    const longCall = Math.max(0,spotPrice-callStrike)-callPremium;
    const longPut = Math.max(0,putStrike-spotPrice)-putPremium;
    const maxV = 30;
    function bar(v) {
      const pct = Math.min(100,Math.abs(v)/maxV*100);
      const isPos = v>=0;
      return `<div style="flex:1;height:18px;background:var(--card2);border-radius:4px;overflow:visible;position:relative">
        <div style="position:absolute;${isPos?'left:50%':'right:50%'};width:${pct/2}%;height:100%;background:${isPos?'var(--green)':'var(--red)'};border-radius:4px;top:0"></div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border)"></div>
      </div>`;
    }
    el.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">
        Stock Price at Expiry: <b style="color:var(--accent2)">$${spotPrice}</b>
      </div>
      <input type="range" min="20" max="80" value="${spotPrice}" oninput="setSpot2(this.value)" style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">P&L Comparison (bought at $${buyPrice}):</div>
      ${[
        {label:'📈 Long Stock', v:longStock},
        {label:'☎️ Long Call ($55 strike, $3 prem)', v:longCall},
        {label:'🛡️ Long Put ($45 strike, $2 prem)', v:longPut}
      ].map(r=>`
        <div class="flex items-center gap8" style="margin-bottom:10px">
          <div style="width:200px;font-size:12px">${r.label}</div>
          ${bar(r.v)}
          <div style="width:56px;text-align:right;font-size:13px;font-weight:700;color:${r.v>=0?'var(--green)':'var(--red)'}">${r.v>0?'+':''}$${r.v.toFixed(2)}</div>
        </div>`).join('')}
      <div class="info-box mt8">
        ${spotPrice>callStrike+callPremium?'🚀 Call option is most profitable above $'+(callStrike+callPremium)+'!':
          spotPrice<putStrike-putPremium?'📉 Put option is most profitable below $'+(putStrike-putPremium)+'!':
          'Stock is in the middle zone. Long stock gives the most linear payoff here.'}
        <br>Notice: <b>Max loss on options = premium paid</b>. Stock has no floor — it can fall to $0!
      </div>`;
    window.setSpot2=v=>{spotPrice=parseInt(v);render();};
  }
  render();
}

function initHedgingGame(el) {
  let stockPrice=50, crashed=false;
  const buyPrice=50, putStrike=48, putPremium=2, shares=100;
  function render() {
    const current = crashed ? 30 : stockPrice;
    const unhedged = (current-buyPrice)*shares;
    const putPayoff = Math.max(0,putStrike-current)*shares;
    const hedged = unhedged + putPayoff - putPremium*shares;
    const costOfHedge = putPremium*shares;
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">📦 Shares</div><div class="wallet-value">${shares} @ $${buyPrice}</div></div>
        <div class="wallet-item"><div class="wallet-label">🛡️ Put Option</div><div class="wallet-value" style="color:var(--green)">Strike $${putStrike}</div></div>
        <div class="wallet-item"><div class="wallet-label">💸 Hedge Cost</div><div class="wallet-value" style="color:var(--red)">-$${costOfHedge}</div></div>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:4px">Current Stock Price</div>
      <div class="big-number ${current<buyPrice?'red':'green'}">$${current}</div>
      <div class="hedge-comparison" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">
        <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">❌ Without Hedge</div>
          <div style="font-size:22px;font-weight:700;color:${unhedged>=0?'var(--green)':'var(--red)'}">${unhedged>=0?'+':''}$${unhedged}</div>
        </div>
        <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;border:1px solid var(--green)">
          <div style="font-size:11px;color:var(--green);margin-bottom:6px">✅ With Hedge</div>
          <div style="font-size:22px;font-weight:700;color:${hedged>=0?'var(--green)':'var(--red)'}">${hedged>=0?'+':''}$${hedged}</div>
        </div>
      </div>
      <div class="flex gap8">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjHedgePrice(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjHedgePrice(5)">Price +$5</button>
        <button class="btn ${crashed?'btn-green':'btn-red'} btn-sm" style="flex:1" onclick="toggleCrash()">${crashed?'📈 Recover':'💥 Crash to $30!'}</button>
      </div>
      <div class="info-box ${hedged>unhedged?'green':''} mt12">
        ${crashed
          ? `💥 Stock crashed to $30! Without hedge: <b style="color:var(--red)">-$${Math.abs(unhedged)} loss</b>. With put option hedge: <b style="color:var(--green)">$${hedged>=0?'+':''}${hedged}</b>. The hedge SAVED $${Math.abs(hedged-unhedged)}!`
          : `🛡️ At $${current}: the hedge costs $${costOfHedge} but protects against big drops. Try crashing the stock to see the protection kick in!`
        }
      </div>`;
    window.adjHedgePrice=v=>{stockPrice=Math.max(10,stockPrice+v);crashed=false;render();};
    window.toggleCrash=()=>{crashed=!crashed;render();};
  }
  render();
}

function initOTCGame(el) {
  let step = 0;
  const steps = [
    { title:'1. Find a Counterparty', desc:'Alex needs a custom $1M interest rate swap. No exchange lists this. Finn calls Goldman Sachs directly.', action:'📞 Call Dealer', color:'var(--accent)' },
    { title:'2. Negotiate Terms', desc:'Goldman quotes: pay fixed 4.5%, receive floating (LIBOR + 0.5%). Duration: 5 years, $1M notional. Alex can negotiate every detail.', action:'🤝 Agree Terms', color:'var(--gold)' },
    { title:'3. Sign ISDA Agreement', desc:'Both parties sign a Master Agreement (ISDA). This legal contract defines what happens if either party defaults — the counterparty risk protection.', action:'✍️ Sign Contract', color:'var(--blue)' },
    { title:'4. Deal Is Live!', desc:'The swap is live. Every 6 months, Alex pays fixed and receives floating rate. No exchange, no clearinghouse — just two parties and a contract.', action:null, color:'var(--green)' }
  ];
  function render() {
    const s = steps[step];
    el.innerHTML = `
      <div style="margin-bottom:14px">
        ${steps.map((st,i)=>`
          <div class="flex items-center gap8 mt8">
            <div style="width:24px;height:24px;border-radius:50%;background:${i<=step?st.color:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i<step?'✓':i+1}</div>
            <div style="font-size:13px;color:${i===step?'var(--text)':i<step?'var(--muted)':'var(--border)'};font-weight:${i===step?700:400}">${st.title}</div>
          </div>`).join('')}
      </div>
      <div class="info-box" style="border-color:${s.color}">
        <b style="color:${s.color}">${s.title}</b><br><br>${s.desc}
      </div>
      ${step<3?`<button class="btn btn-primary mt16" style="width:100%" onclick="otcNext()">${s.action} →</button>`:
        `<div class="info-box green mt12">✅ Deal complete! The key difference from exchange trading: <b>no central guarantee</b>. If Goldman Sachs went bankrupt, Alex faces losses — that's counterparty risk.</div>
        <button class="btn btn-ghost mt8" style="width:100%" onclick="otcReset()">🔄 Start Over</button>`}`;
    window.otcNext=()=>{step=Math.min(3,step+1);render();};
    window.otcReset=()=>{step=0;render();};
  }
  render();
}

function initCryptoGame(el) {
  let wallet=0, usd=100, btcPrice=42000, mineCount=0;
  function render() {
    const portfolioUSD = wallet*btcPrice;
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 USD</div><div class="wallet-value" style="color:var(--green)">$${usd.toFixed(2)}</div></div>
        <div class="wallet-item"><div class="wallet-label">₿ BTC</div><div class="wallet-value" style="color:var(--gold)">${wallet.toFixed(6)}</div></div>
        <div class="wallet-item"><div class="wallet-label">💎 BTC Value</div><div class="wallet-value" style="color:var(--accent2)">$${portfolioUSD.toFixed(0)}</div></div>
      </div>
      <div style="text-align:center;margin:12px 0">
        <div style="font-size:11px;color:var(--muted)">Bitcoin Price</div>
        <div class="big-number gold">$${btcPrice.toLocaleString()}</div>
      </div>
      <div style="text-align:center;margin-bottom:14px">
        <button class="mine-btn" onclick="mine()">⛏️</button>
        <div style="font-size:12px;color:var(--muted);margin-top:6px">Tap to Mine! (${mineCount} blocks mined)</div>
      </div>
      <div class="flex gap8">
        <button class="btn btn-green btn-sm" style="flex:1" onclick="buyBtc()" ${usd<100?'disabled':''}>Buy $100 of BTC</button>
        <button class="btn btn-red btn-sm" style="flex:1" onclick="sellBtc()" ${wallet<0.001?'disabled':''}>Sell 0.001 BTC</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="priceSwing()">🎢 Price Swing!</button>
      </div>
      <div class="info-box mt12">⛏️ Mining = computers solving hard math to validate transactions. Each solve earns newly created BTC. Real mining uses massive electricity! <br>The 21 million BTC cap means it's deflationary — can't just print more.</div>`;
    window.mine=()=>{wallet+=0.000001;mineCount++;btcPrice+=Math.floor(Math.random()*10-3);render();};
    window.buyBtc=()=>{if(usd>=100){usd-=100;wallet+=100/btcPrice;notify('₿ Bought $100 of Bitcoin!','ok');render();}};
    window.sellBtc=()=>{if(wallet>=0.001){usd+=0.001*btcPrice;wallet-=0.001;notify('💰 Sold 0.001 BTC for $'+(0.001*btcPrice).toFixed(2),'ok');render();}};
    window.priceSwing=()=>{const swing=(Math.random()-0.4)*8000;btcPrice=Math.max(5000,btcPrice+swing);notify((swing>0?'📈 BTC +$':'📉 BTC $')+Math.abs(swing).toFixed(0),swing>0?'ok':'bad');render();};
  }
  render();
}

// ===== QUIZ =====
function renderQuiz(ch, el) {
  const q = ch.quiz[state.qIdx];
  const total = ch.quiz.length;
  el.innerHTML = `
    <div class="quiz-wrap">
      <div class="panel">
        <div class="panel-label">Quiz — ${ch.title}</div>
        <div style="margin-bottom:16px">
          <div class="bar-track"><div class="bar-fill accent" style="width:${(state.qIdx/total)*100}%"></div></div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Question ${state.qIdx+1} of ${total}</div>
        </div>
        <div class="quiz-q">${q.q}</div>
        <div class="quiz-opts" id="quiz-opts">
          ${q.opts.map((o,i)=>`<button class="quiz-opt" onclick="pickAnswer(${i})">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}
        </div>
        <div class="quiz-explain" id="quiz-explain">💡 ${q.exp}</div>
        <div class="mt16" id="quiz-next-btn" style="display:none">
          ${state.qIdx<total-1
            ? `<button class="btn btn-primary" style="width:100%" onclick="nextQ()">Next Question →</button>`
            : `<button class="btn btn-gold" style="width:100%" onclick="completeChapter()">🏆 Complete Chapter!</button>`}
        </div>
      </div>
    </div>`;
  state.qAnswered = false;
}

function pickAnswer(i) {
  if (state.qAnswered) return;
  state.qAnswered = true;
  const ch = CHAPTERS.find(c => c.id === state.current);
  const q = ch.quiz[state.qIdx];
  const opts = document.querySelectorAll('.quiz-opt');
  opts.forEach(o => o.setAttribute('disabled', true));
  opts[i].classList.add(i === q.ans ? 'correct' : 'wrong');
  if (i !== q.ans) opts[q.ans].classList.add('correct');
  document.getElementById('quiz-explain').classList.add('show');
  document.getElementById('quiz-next-btn').style.display = 'block';
  if (i === q.ans) notify('✅ Correct! +20 coins', 'ok');
  else notify('❌ Not quite — see explanation', 'bad');
}

function nextQ() {
  state.qIdx++;
  state.qAnswered = false;
  save();
  const ch = CHAPTERS.find(c => c.id === state.current);
  renderQuiz(ch, document.getElementById('ch-content'));
}

function completeChapter() {
  const ch = CHAPTERS.find(c => c.id === state.current);
  if (!state.done.includes(ch.id)) {
    state.done.push(ch.id);
    state.coins += 100;
  }
  save();
  const el = document.getElementById('ch-content');
  el.innerHTML = `
    <div class="complete-card">
      <span class="complete-icon">🎉</span>
      <div class="complete-title">${ch.title} Complete!</div>
      <div class="complete-sub">You've mastered the basics of ${ch.title.toLowerCase()}.</div>
      <div class="coins-badge">🪙 +100 FinCoins</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:24px">${state.done.length}/15 chapters done · ${state.coins} coins total</div>
      <div class="flex gap8 justify-center flex-wrap">
        ${state.done.length < 15 ? `<button class="btn btn-primary" onclick="openChapter('${CHAPTERS[CHAPTERS.findIndex(c=>c.id===ch.id)+1]?.id}')">Next Chapter →</button>` : ''}
        <button class="btn btn-ghost" onclick="showMap()">🗺️ Back to Map</button>
      </div>
      ${state.done.length===15 ? '<div class="info-box green mt16">🏆 YOU\'VE MASTERED ALL OF FINCITY! Incredible work!</div>' : ''}
    </div>`;
  document.getElementById('phase-nav').innerHTML = '';
  document.getElementById('ch-coins').textContent = state.coins;
}

// ===== NOTIFICATION =====
function notify(msg, type) {
  const el = document.getElementById('notif');
  document.getElementById('notif-icon').textContent = type === 'ok' ? '✅' : '❌';
  document.getElementById('notif-text').textContent = msg;
  el.className = 'notif show ' + (type === 'ok' ? 'ok' : 'bad');
  setTimeout(() => el.classList.remove('show'), 2800);
}
