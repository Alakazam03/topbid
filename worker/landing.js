// landing.js — the TopBid launch page, served from the Worker root.
// Pulls /market for the live featured list + terminal status line, and /me for
// the points/earnings tracker. New links are added by hand via WhatsApp DM.

export const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TopBid — a link in your Claude Code status bar</title>
<meta name="description" content="TopBid rotates hand-picked links through the bottom line of your Claude Code terminal, on the statusLine hook Anthropic officially supports." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg:#0c0d10; --surface:#15171c; --surface-2:#101216;
    --border:#24272e; --border-soft:#1b1e24;
    --text:#e6e7ea; --muted:#8b8f99; --faint:#5b606b;
    --amber:#f5b53d; --blue:#7aa2f7; --green:#9ece6a;
    --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:'Inter',system-ui,-apple-system,sans-serif;
    --maxw:760px;
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body {
    margin:0; background:var(--bg); color:var(--text);
    font-family:var(--sans); line-height:1.6; -webkit-font-smoothing:antialiased;
    background-image:radial-gradient(circle at 50% -10%, rgba(245,181,61,.05), transparent 55%);
  }
  a { color:inherit; }
  .wrap { max-width:var(--maxw); margin:0 auto; padding:0 24px; }

  /* header */
  header {
    position:sticky; top:0; z-index:10;
    background:rgba(12,13,16,.78); backdrop-filter:blur(10px);
    border-bottom:1px solid var(--border-soft);
  }
  .bar { max-width:var(--maxw); margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }
  .brand { display:flex; align-items:center; gap:9px; font-family:var(--mono); font-weight:800; letter-spacing:-.02em; }
  .tile { display:inline-grid; place-items:center; width:26px; height:26px; background:var(--amber); color:#1a1404; border-radius:6px; font-family:var(--mono); font-weight:800; font-size:14px; }
  .navlinks { display:flex; gap:22px; font-family:var(--mono); font-size:13px; color:var(--muted); }
  .navlinks a { text-decoration:none; }
  .navlinks a:hover { color:var(--text); }
  @media (max-width:560px){ .navlinks a.hideable { display:none; } }

  /* hero */
  .hero { padding:72px 0 28px; }
  .eyebrow { font-family:var(--mono); font-size:12.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--amber); margin-bottom:18px; }
  h1 {
    font-family:var(--mono); font-weight:800; letter-spacing:-.035em;
    font-size:clamp(34px,6.4vw,52px); line-height:1.04; margin:0 0 18px;
  }
  h1 .dollar { color:var(--amber); }
  .lede { font-size:clamp(16px,2.4vw,18.5px); color:var(--muted); max-width:560px; margin:0 0 30px; }

  /* video */
  .video-wrap { padding-top:28px; }
  .video-frame { width:100%; aspect-ratio:16/9; overflow:hidden; border:1px solid var(--border); border-radius:12px; background:var(--surface-2); }
  .video-frame video, .video-frame iframe { display:block; width:100%; height:100%; border:0; }

  /* install */
  .install { display:flex; align-items:stretch; border:1px solid var(--border); border-radius:10px; overflow:hidden; background:var(--surface-2); max-width:620px; }
  .install code { font-family:var(--mono); font-size:13px; padding:14px 16px; color:var(--text); white-space:nowrap; overflow-x:auto; flex:1; }
  .install code .tok { color:var(--faint); }
  .copy { font-family:var(--mono); font-size:12px; padding:0 16px; background:var(--surface); color:var(--muted); border:0; border-left:1px solid var(--border); cursor:pointer; white-space:nowrap; transition:color .15s,background .15s; }
  .copy:hover { color:var(--text); background:#1b1e24; }
  .copy.done { color:var(--green); }
  .reqs { font-family:var(--mono); font-size:12px; color:var(--faint); margin:12px 2px 0; }

  /* credit */
  .credit { margin-top:34px; font-size:13.5px; color:var(--muted); border-left:2px solid var(--border); padding-left:14px; }
  .credit a { color:var(--text); text-decoration:underline; text-underline-offset:2px; text-decoration-color:var(--border); }

  /* terminal */
  .term { margin:40px 0 8px; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--surface); box-shadow:0 24px 60px -30px rgba(0,0,0,.8); }
  .term-top { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid var(--border-soft); background:var(--surface-2); }
  .term-top .sq { width:10px; height:10px; border-radius:3px; background:#2a2e36; }
  .term-top .sq.live { background:var(--amber); }
  .term-top .label { font-family:var(--mono); font-size:12px; color:var(--faint); margin-left:6px; }
  .term-body { padding:18px 16px 0; font-family:var(--mono); font-size:13.5px; line-height:1.75; min-height:138px; }
  .term-body .p { color:var(--green); }
  .term-body .dim { color:var(--faint); }
  .term-body .think { color:var(--muted); }
  .cursor { display:inline-block; width:8px; height:16px; background:var(--text); vertical-align:-3px; margin-left:2px; animation:blink 1.1s step-end infinite; }
  @keyframes blink { 50% { opacity:0; } }
  .statusline {
    display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    margin-top:14px; padding:11px 16px; border-top:1px solid var(--border);
    background:var(--surface-2); font-family:var(--mono); font-size:13px;
  }
  .statusline .mark { color:var(--amber); font-weight:700; }
  .statusline .txt { color:var(--text); transition:opacity .35s; }
  .statusline .name { color:var(--muted); }
  .statusline .lnk { color:var(--blue); transition:opacity .35s; }
  .statusline .sep { color:var(--faint); }

  /* sections */
  section { padding:46px 0; border-top:1px solid var(--border-soft); }
  .kicker { font-family:var(--mono); font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:var(--faint); margin:0 0 18px; }
  h2 { font-family:var(--mono); font-weight:700; letter-spacing:-.02em; font-size:22px; margin:0 0 22px; }

  /* three points */
  .points { display:grid; gap:18px; }
  .point { display:flex; gap:14px; align-items:flex-start; }
  .point .b { color:var(--amber); font-family:var(--mono); font-weight:700; flex:none; }
  .point h3 { margin:0 0 3px; font-size:15.5px; font-weight:600; }
  .point p { margin:0; font-size:14px; color:var(--muted); }

  /* live list */
  .feature-list { display:grid; gap:1px; border:1px solid var(--border); border-radius:10px; overflow:hidden; background:var(--border); }
  .feature-row { display:grid; grid-template-columns:auto 1fr auto auto; gap:14px; align-items:center; padding:14px 16px; background:var(--surface); font-size:14px; }
  .feature-row .fn { font-weight:600; }
  .feature-row .ft { color:var(--muted); font-family:var(--mono); font-size:12.5px; }
  .feature-row .fv { color:var(--amber); font-family:var(--mono); font-size:12.5px; white-space:nowrap; }
  .feature-row a.fl { color:var(--blue); font-family:var(--mono); font-size:12.5px; text-decoration:none; white-space:nowrap; }
  .feature-row a.fl:hover { text-decoration:underline; }
  .feature-row.open { background:var(--surface-2); }
  .feature-row.open .fn { color:var(--amber); }
  @media (max-width:560px){ .feature-row { grid-template-columns:1fr; gap:4px; } .feature-row a.fl{ justify-self:start; } }
  .empty { color:var(--faint); font-family:var(--mono); font-size:13px; padding:16px; }

  /* earnings tracker */
  .track { display:flex; gap:10px; flex-wrap:wrap; max-width:560px; }
  .keyfield { flex:1; min-width:220px; background:var(--surface-2); border:1px solid var(--border); border-radius:9px; padding:11px 14px; color:var(--text); font-family:var(--mono); font-size:13px; outline:none; }
  .keyfield:focus { border-color:var(--amber); }
  .earn-out { margin-top:20px; font-family:var(--mono); font-size:13.5px; color:var(--muted); min-height:22px; }
  .earn-stat { display:flex; gap:34px; flex-wrap:wrap; }
  .earn-stat .lab { color:var(--faint); font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2px; }
  .earn-stat .big { color:var(--amber); font-weight:800; font-size:24px; font-family:var(--mono); }
  .earn-stat .soon { color:var(--muted); font-weight:600; font-size:15px; font-family:var(--mono); }

  /* touches */
  .touch-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:560px){ .touch-grid { grid-template-columns:1fr; } }
  .touch { border:1px solid var(--border); border-radius:10px; padding:18px; background:var(--surface-2); }
  .touch .th { font-family:var(--mono); font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:12px; }
  .touch.never .th { color:var(--faint); }
  .touch.only .th { color:var(--amber); }
  .touch ul { margin:0; padding:0; list-style:none; display:grid; gap:9px; }
  .touch li { font-size:13.5px; color:var(--muted); display:flex; gap:9px; align-items:flex-start; }
  .touch li .g { font-family:var(--mono); flex:none; }
  .touch.never li .g { color:var(--faint); }
  .touch.only li .g { color:var(--green); }

  /* steps */
  .steps { display:grid; gap:0; counter-reset:s; }
  .step { display:grid; grid-template-columns:auto 1fr; gap:16px; padding:18px 0; border-top:1px solid var(--border-soft); }
  .step:first-child { border-top:0; }
  .step .n { font-family:var(--mono); font-weight:800; color:var(--amber); font-size:14px; }
  .step h3 { margin:0 0 3px; font-size:15px; font-weight:600; }
  .step p { margin:0; font-size:14px; color:var(--muted); }
  .step code { font-family:var(--mono); font-size:12.5px; color:var(--text); background:var(--surface); padding:1px 5px; border-radius:4px; }

  /* CTA */
  .cta-box { border:1px solid var(--border); border-radius:14px; padding:30px; background:linear-gradient(180deg,var(--surface),var(--surface-2)); text-align:center; }
  .cta-box h2 { margin-bottom:8px; }
  .cta-box p { color:var(--muted); font-size:14.5px; max-width:440px; margin:0 auto 22px; }
  .btns { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  .btn { font-family:var(--mono); font-size:13.5px; font-weight:500; text-decoration:none; padding:11px 20px; border-radius:9px; transition:transform .12s,filter .12s; display:inline-flex; align-items:center; gap:8px; border:0; cursor:pointer; }
  .btn:active { transform:translateY(1px); }
  .btn.primary { background:var(--amber); color:#1a1404; font-weight:700; }
  .btn.primary:hover { filter:brightness(1.06); }
  .btn.primary:disabled { opacity:.6; cursor:default; }
  .btn.ghost { border:1px solid var(--border); color:var(--text); background:transparent; }
  .btn.ghost:hover { background:var(--surface); }
  .cta-fine { font-family:var(--mono); font-size:11.5px; color:var(--faint); margin-top:18px; }

  /* footer */
  footer { border-top:1px solid var(--border-soft); padding:30px 0 50px; }
  .foot { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; font-family:var(--mono); font-size:12.5px; color:var(--faint); }
  .foot a { color:var(--muted); text-decoration:none; }
  .foot a:hover { color:var(--text); }

  a:focus-visible, button:focus-visible { outline:2px solid var(--amber); outline-offset:2px; border-radius:4px; }
  @media (prefers-reduced-motion:reduce){ .cursor{ animation:none; } html{ scroll-behavior:auto; } }
</style>
</head>
<body>
<header>
  <div class="bar">
    <span class="brand"><span class="tile">T$</span>TopBid</span>
    <nav class="navlinks">
      <a class="hideable" href="#how">How it works</a>
      <a href="#earnings">Earnings</a>
      <a href="#featured">Get featured</a>
      <a href="https://github.com/Alakazam03/topbid" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
</header>

<main class="wrap">

  <section class="hero" style="border:0;">
    <div class="eyebrow">for Claude Code</div>
    <h1>Your terminal has a line that does nothing. Sell it.</h1>
    <p class="lede">Every second Claude thinks, the bottom of your status bar can be earning. TopBid runs it on the statusLine hook Anthropic supports, so an update never breaks it.</p>

    <div class="install">
      <code id="cmd"><span class="tok">$</span> curl -fsSL https://raw.githubusercontent.com/Alakazam03/topbid/main/install.sh | bash</code>
      <button class="copy" id="copyBtn" aria-label="Copy install command">copy</button>
    </div>
    <p class="reqs">One command. Your settings are backed up first. Offline until you connect.</p>

    <!-- live terminal: status line cycles the real featured links from /market -->
    <div class="term" aria-hidden="true">
      <div class="term-top"><span class="sq"></span><span class="sq"></span><span class="sq live"></span><span class="label">claude — zsh</span></div>
      <div class="term-body">
        <div><span class="p">~/api</span> <span class="dim">$</span> claude</div>
        <div class="think">› wiring up the rate limiter…</div>
        <div><span class="dim">&nbsp;</span><span class="cursor"></span></div>
        <div class="statusline">
          <span class="mark">T$</span>
          <span class="txt" id="slTxt">Your ad shows up here</span>
          <span class="sep">·</span>
          <span class="name" id="slName">you</span>
          <span class="sep">·</span>
          <span class="lnk" id="slLink">get featured ↗</span>
        </div>
      </div>
    </div>

    <p class="credit">Inspired by the original status-line ad idea by <a href="https://x.com/andrewmccalip" target="_blank" rel="noopener">@andrewmccalip</a>. I rebuilt it on Claude Code's supported statusLine hook so it survives updates and never patches the binary.</p>
  </section>

  <section class="video-wrap">
    <div class="video-frame">
      <iframe src="https://www.youtube.com/embed/b_fUI2vZpIs" title="TopBid demo video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
  </section>

  <section>
    <p class="kicker">why this build</p>
    <div class="points">
      <div class="point"><span class="b">/</span><div><h3>Runs on a supported hook</h3><p>It uses Claude Code's official statusLine, not the spinner. Anthropic can ship a new render and it keeps working — no reinstall.</p></div></div>
      <div class="point"><span class="b">/</span><div><h3>Never touches the binary</h3><p>It's a small script reading the session data Claude already hands it. It can't break your tool or fight an update.</p></div></div>
      <div class="point"><span class="b">/</span><div><h3>Reads nothing about your work</h3><p>No code, no prompts, no transcript. One anonymous key counts impressions, and only if you point it at an endpoint.</p></div></div>
    </div>
  </section>

  <section id="featured-list">
    <p class="kicker">in rotation now</p>
    <h2>Currently featured</h2>
    <div class="feature-list" id="featureList">
      <div class="empty">loading…</div>
    </div>
  </section>

  <section id="earnings">
    <p class="kicker">your earnings</p>
    <h2>Track your points</h2>
    <p class="lede" style="margin:0 0 22px;">Run <code style="font-family:var(--mono);background:var(--surface);padding:1px 6px;border-radius:4px;color:var(--text);">cat ~/.topbid/key</code> and paste the key to see the impressions you've served. Points count toward live payouts.</p>
    <div class="track">
      <input id="keyInput" class="keyfield" placeholder="paste your TopBid key" autocomplete="off" spellcheck="false" />
      <button class="btn primary" id="checkBtn" type="button">Check points</button>
    </div>
    <div id="earnOut" class="earn-out"></div>
  </section>

  <section>
    <p class="kicker">trust</p>
    <h2>What it touches</h2>
    <div class="touch-grid">
      <div class="touch never">
        <div class="th">never</div>
        <ul>
          <li><span class="g">✗</span> your code, files, or prompts</li>
          <li><span class="g">✗</span> your conversation or transcript</li>
          <li><span class="g">✗</span> environment variables or secrets</li>
          <li><span class="g">✗</span> the session JSON Claude pipes in — drained and dropped</li>
        </ul>
      </div>
      <div class="touch only">
        <div class="th">only</div>
        <ul>
          <li><span class="g">✓</span> writes one script to <span style="font-family:var(--mono)">~/.topbid</span></li>
          <li><span class="g">✓</span> adds a statusLine key, backing up your settings first</li>
          <li><span class="g">✓</span> sends one anonymous key, just to count impressions</li>
          <li><span class="g">✓</span> stays fully offline with no endpoint set</li>
        </ul>
      </div>
    </div>
    <p class="reqs" style="margin-top:16px;">Rather watch it install? Drop <span style="font-family:var(--mono);color:var(--muted)">skills/topbid-setup</span> into <span style="font-family:var(--mono);color:var(--muted)">~/.claude/skills</span> and tell Claude Code "set up TopBid" — it reads the script back to you before touching anything.</p>
  </section>

  <section id="how">
    <p class="kicker">how it works</p>
    <div class="steps">
      <div class="step"><span class="n">01</span><div><h3>Install the renderer</h3><p>One script lands in <code>~/.topbid</code> and adds a statusLine to your settings. Your old settings are backed up first.</p></div></div>
      <div class="step"><span class="n">02</span><div><h3>It reads the live list</h3><p>The status line pulls the current link, caches it, and refreshes in the background without ever blocking Claude Code.</p></div></div>
      <div class="step"><span class="n">03</span><div><h3>Featured links rotate</h3><p>The list is small and hand-picked. Terminals cycle through it as they refresh.</p></div></div>
    </div>
  </section>

  <section id="featured">
    <div class="cta-box">
      <h2>Put your link where developers actually look.</h2>
      <p>A few slots, hand-picked. Send me your name, your link, and the short text to show in the terminal. I add it by hand.</p>
      <div class="btns">
        <a class="btn primary" href="https://wa.me/918168029810?text=Hi%20Vaibhav%2C%20I%27d%20like%20to%20add%20my%20link%20to%20TopBid.%0A%0AName%3A%20%0ALink%3A%20%0ATerminal%20text%20(max%2080%20chars)%3A%20" target="_blank" rel="noopener">DM on WhatsApp →</a>
        <a class="btn ghost" href="https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/" target="_blank" rel="noopener">Connect on LinkedIn</a>
      </div>
      <p class="cta-fine">no forms · hand-picked · no auto-add</p>
    </div>
  </section>

</main>

<footer>
  <div class="wrap foot">
    <span>Open source. Earn points now — payouts are live.</span>
    <a href="https://github.com/Alakazam03/topbid" target="_blank" rel="noopener">github.com/Alakazam03/topbid ↗</a>
  </div>
</footer>

<script>
  // copy install command
  (function(){
    var btn=document.getElementById('copyBtn');
    var cmd='curl -fsSL https://raw.githubusercontent.com/Alakazam03/topbid/main/install.sh | bash';
    btn.addEventListener('click',function(){
      navigator.clipboard.writeText(cmd).then(function(){
        btn.textContent='copied'; btn.classList.add('done');
        setTimeout(function(){ btn.textContent='copy'; btn.classList.remove('done'); },1600);
      });
    });
  })();

  // pull the real featured list, render it, and feed the terminal status line
  (function(){
    var fallback=[
      {name:'trygravity', text:'Ad Infrastructure for the AI Era', link:'https://trygravity.ai', views:0},
      {name:'Vaibhav Aggarwal', text:'system design the way engineers decide', link:'https://www.linkedin.com/in/vaibhav-aggarwal-15070a138/', views:0}
    ];
    var teaser={name:'you', text:'Your ad shows up here', link:'#featured'};
    var listEl=document.getElementById('featureList');
    var slTxt=document.getElementById('slTxt'), slName=document.getElementById('slName'), slLink=document.getElementById('slLink');

    function host(u){ try { return new URL(u).host.replace(/^www\\./,''); } catch(e){ return u; } }
    function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

    function render(items){
      if(!items || !items.length){ listEl.innerHTML='<div class="empty">No links featured right now.</div>'; }
      else {
        var rows=items.map(function(it){
          return '<div class="feature-row"><span class="fn">'+esc(it.name)+'</span>'+
                 '<span class="ft">'+esc(it.text)+'</span>'+
                 '<span class="fv">'+(it.views||0).toLocaleString()+' views</span>'+
                 '<a class="fl" href="'+encodeURI(it.link)+'" target="_blank" rel="noopener">'+esc(host(it.link))+' ↗</a></div>';
        });
        rows.push('<div class="feature-row open"><span class="fn">Your ad shows up here</span>'+
                  '<span class="ft">a few open slots, hand-picked</span>'+
                  '<span class="fv"></span>'+
                  '<a class="fl" href="#featured">Get featured ↗</a></div>');
        listEl.innerHTML=rows.join('');
      }
      cycle([teaser].concat(items||[]));
    }

    var t=0, timer=null;
    function cycle(items){
      if(timer) clearInterval(timer);
      var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      function set(i){ var it=items[i%items.length];
        slTxt.textContent=it.text; slName.textContent=it.name;
        slLink.textContent=(it.link && it.link.charAt(0)==='#') ? 'get featured ↗' : host(it.link)+' ↗'; }
      set(0);
      if(reduce || items.length<2) return;
      timer=setInterval(function(){
        slTxt.style.opacity=0; slLink.style.opacity=0;
        setTimeout(function(){ t++; set(t); slTxt.style.opacity=1; slLink.style.opacity=1; },360);
      },3200);
    }

    fetch('/market').then(function(r){ return r.json(); })
      .then(function(d){ render((d&&d.market&&d.market.length)?d.market:fallback); })
      .catch(function(){ render(fallback); });
  })();

  // points / earnings tracker — reads /me?key=
  (function(){
    var input=document.getElementById('keyInput');
    var btn=document.getElementById('checkBtn');
    var out=document.getElementById('earnOut');
    function check(){
      var k=(input.value||'').trim();
      if(!k){ out.textContent='paste your key first.'; return; }
      btn.disabled=true; out.textContent='checking…';
      fetch('/me?key='+encodeURIComponent(k)).then(function(r){ return r.json(); }).then(function(d){
        btn.disabled=false;
        if(d.error){ out.textContent='✗ '+d.error; return; }
        var pts=d.impressions||0;
        out.innerHTML='<div class="earn-stat">'+
          '<div><div class="lab">points</div><span class="big">'+pts.toLocaleString()+'</span></div>'+
          '<div><div class="lab">payouts</div><span class="soon">live</span></div>'+
          '</div>';
      }).catch(function(){ btn.disabled=false; out.textContent='could not reach the server.'; });
    }
    btn.addEventListener('click',check);
    input.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); check(); } });
  })();
</script>
</body>
</html>`;
