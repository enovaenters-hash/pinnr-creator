// Layout ported 1:1 from the original fan map (keen-lollipop-93bfb2.netlify.app), recolored for
// POVGo theme 06 (ice blue bar, sunny yellow actions, Fredoka + Nunito). Scoped to #pub.
export const FAN_CSS = `
  #pub{--ink:#13293a;--ink2:#4a6574;--muted:#5f7a89;--line:#d6e9f1;--bg:#f4fbfe;--panel:#fff;--accent:#ffd23f;--accent-ink:#13293a;--bar:#7fd4f2;--frost:#dff4fc;--glacier:#1c7fb0;--brand:#13293a;
    --display:var(--font-fredoka),var(--font-nunito),system-ui,sans-serif;
    font-family:var(--font-nunito),system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink)}
  #pub *{box-sizing:border-box}
  #pub button{font-family:inherit;cursor:pointer}

  #pub{position:fixed;inset:0;z-index:800;background:#fff;display:flex;flex-direction:column}
  .pubbar{display:flex;align-items:center;gap:12px;padding:10px 18px;color:var(--ink);background:var(--bar);flex:0 0 auto}
  .publogo{display:flex;flex:0 0 auto}
  .pubdiv{width:2px;height:28px;border-radius:2px;background:rgba(255,255,255,.6);flex:0 0 auto}
  .pubwho{min-width:0}
  .pubbar .pfp{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;overflow:hidden;flex:0 0 auto;text-decoration:none}
  .pubbar .pfp img{width:100%;height:100%;object-fit:cover}
  .pubbar .nm{font-family:var(--display);font-weight:600;font-size:16px;line-height:1.2}.pubbar .h{font-size:12px;font-weight:700;opacity:.75}
  .pubbar .pubtag{background:rgba(255,255,255,.92);color:#12141a;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px}
  .pubnav{margin-left:auto}
  .pubnav a{text-decoration:none}
  .pubbreak{display:none}
  .pubbar .pubsel{background:#fff;color:var(--ink);border:0;border-radius:999px;font-family:inherit;font-size:13px;font-weight:800;padding:7px 12px;max-width:46vw;outline:none;cursor:pointer}
  .pubmain{flex:1;display:flex;min-height:0;position:relative}
  .pubview{background:var(--accent);color:var(--accent-ink);text-decoration:none;font-size:13px;font-weight:900;padding:7px 14px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 0 #f2c21a}
  .pubview[hidden]{display:none}
  .clink{color:inherit;font-weight:800;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:2px}
  .clink:hover{color:var(--glacier)}
  .rmeta .clink:hover{color:var(--bar)}
  /* Embedded in the creator page: a rounded block in the page flow instead of full screen. */
  #pub.embed{position:relative;inset:auto;z-index:0;height:min(78vh,720px);min-height:520px;border-radius:20px;overflow:hidden;box-shadow:0 6px 20px rgba(19,41,58,.08);border:2px solid #fff}
  #pub.embed .pubbar{display:none}
  #pub.embed .clipnav{position:absolute;top:52px;right:12px}
  .publeft{width:280px;min-width:280px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:#fff;z-index:100}
  .publeft .srch{padding:12px 14px 9px;display:flex;gap:6px;align-items:center}
  .publeft .srch input{flex:1;min-width:0;padding:9px 14px;border:2px solid var(--line);border-radius:999px;font-family:inherit;font-size:13px;outline:none}
  .publeft .srch input:focus{border-color:var(--bar);box-shadow:0 0 0 3px var(--frost)}
  .srch-toggle{background:none;border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--muted);font-size:13px;cursor:pointer;transition:.15s;flex:0 0 auto}
  .srch-toggle:hover{color:var(--ink);border-color:var(--bar)}
  .pubchips-wrapper{display:flex;border-bottom:1px solid var(--line);background:#fff;flex:0 0 auto;gap:0;align-items:center}
  .clear-btn{background:var(--frost);border-color:var(--frost);cursor:pointer;flex:0 0 auto;margin:10px 8px 10px 14px;padding:7px 12px;font-size:12px;font-weight:650;border-radius:999px;border:1px solid var(--line)}
  .clear-btn:hover{background:#cdeefa}
  .pubchips-bar{display:flex;overflow-x:auto;gap:8px;padding:10px 0 10px 0;flex:1;min-width:0;scroll-behavior:smooth;margin-right:14px}
  .pubchips-bar::-webkit-scrollbar{height:4px}
  .pubchips-bar::-webkit-scrollbar-track{background:var(--frost)}
  .pubchips-bar::-webkit-scrollbar-thumb{background:var(--bar);border-radius:2px}
  .pchip{font-family:inherit;font-size:12.5px;font-weight:800;color:var(--ink);padding:7px 13px;border-radius:999px;border:2px solid var(--line);background:#fff;white-space:nowrap;cursor:pointer;display:flex;align-items:center;gap:6px;flex:0 0 auto}
  .pchip .d{width:8px;height:8px;border-radius:50%}
  .pchip.on{color:#fff;border-color:transparent;background:var(--accent)}
  #pubCount{font-size:11px;color:var(--muted);padding:8px 16px 4px}
  #pubList{overflow-y:auto;flex:1}
  .pcard{padding:11px 15px;border-bottom:1px solid var(--line);cursor:pointer;transition:.12s}
  .pcard:hover{background:var(--bg)}
  .pcard.on{background:#fffbe8;box-shadow:inset 4px 0 0 var(--accent)}
  .pcard h4{margin:0;font-family:var(--display);font-size:15px;font-weight:600;letter-spacing:0}
  .pcard .by{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--muted);margin:3px 0 4px}
  .pcard .by .d{width:7px;height:7px;border-radius:50%}
  .pcard .mt{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-top:3px}
  .pcard .cz{font-size:10px;font-weight:800;color:#fff;border-radius:999px;padding:1px 8px}
  .pcard .star{font-size:9.5px;font-weight:900;color:var(--ink);background:var(--accent);border-radius:999px;padding:1px 7px}
  #pubmap{flex:1;min-width:0;position:relative;overflow:hidden}
  /* TEST 1: turn off Leaflet's tile blending (mix-blend-mode: plus-lighter) to see if it's what blanks the TikTok player */
  #pub .leaflet-container img.leaflet-tile{mix-blend-mode:normal}
  .pubright{width:390px;min-width:390px;border-left:1px solid var(--line);display:flex;flex-direction:column;background:#0c1c27;position:relative;gap:0}
  .pubright .rv{flex:1;min-height:0;background:#000;display:flex;align-items:center;justify-content:center;position:relative}
  .pubright .rv iframe{width:100%;height:100%;border:0}
  .pubright .empty{flex:1;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;color:#8fb0c0;font-weight:700;font-size:13px;text-align:center;padding:26px;line-height:1.5}
  .pubright .empty .big{font-size:30px}
  .rstage{position:absolute;inset:0}
  .rstage iframe{width:100%;height:100%;border:0;display:block}
  .rposter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#0c1c27;cursor:pointer;overflow:hidden}
  .rposter .rcover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .rposter::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.45))}
  .rplay{position:relative;z-index:1;width:74px;height:74px;border-radius:50%;border:0;background:var(--accent);color:var(--accent-ink);font-size:28px;padding-left:6px;box-shadow:0 6px 24px rgba(0,0,0,.45);transition:transform .15s}
  .rposter:hover .rplay{transform:scale(1.07)}
  .rhint{position:relative;z-index:1;color:#fff;font-size:12px;font-weight:750;text-shadow:0 1px 3px rgba(0,0,0,.6)}
  .rfailed{cursor:default}
  .rfail{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px;background:rgba(0,0,0,.72);padding:16px 18px;border-radius:12px;color:#fff;text-align:center;max-width:80%}
  .rfail p{margin:0;font-size:13px;font-weight:650}
  .rfail .rbtn{flex:0 0 auto;padding:9px 16px}
  .rtry{background:none;border:0;color:#ddd;font-size:12px;font-weight:700;text-decoration:underline}
  .rslow{position:absolute;left:10px;right:10px;bottom:10px;z-index:5;background:rgba(0,0,0,.82);color:#ddd;font-size:12px;font-weight:650;border-radius:10px;padding:9px 12px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center}
  .rslow a{color:var(--accent-ink);font-weight:800;text-decoration:none;background:var(--accent);padding:5px 10px;border-radius:999px}
  .rslow button{background:none;border:0;color:#fff;font-weight:750;font-size:12px;text-decoration:underline}
  .rmeta{background:rgba(0,0,0,.9);backdrop-filter:blur(4px);padding:13px 15px 15px;position:relative;flex:0 0 auto;max-height:65%;overflow-y:auto;transition:max-height .3s ease,padding .3s ease;border-top:1px solid rgba(255,255,255,.1)}
  .rmeta.collapsed{max-height:36px;padding:10px 15px;overflow:hidden;border-top:none}
  .rmeta h3{margin:0 0 4px;font-family:var(--display);font-size:19px;font-weight:600;letter-spacing:0;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}
  .rmeta .toggle-arrow{font-size:14px;transition:transform .3s ease;display:inline-block;margin-left:8px}
  .rmeta.collapsed .toggle-arrow{transform:rotate(180deg)}
  .rmeta .rby{display:flex;align-items:center;gap:6px;font-size:12px;color:#ddd;margin-bottom:5px}
  .rmeta .rby .d{width:9px;height:9px;border-radius:50%}
  .rmeta .raddr{font-size:12px;color:#bbb;margin-bottom:9px}
  .rmeta .rcode{font-size:12px;color:#7ee2a8;margin:-4px 0 9px;font-weight:700}
  .rmeta .info-row{display:flex;align-items:center;gap:8px;margin-bottom:11px;flex-wrap:wrap}
  .rmeta h3 .tag-in-header{font-family:var(--font-nunito),sans-serif;font-size:10.5px;font-weight:800;color:#fff;border-radius:999px;padding:3px 9px;margin-left:8px;margin-right:auto;display:inline-block}
  .rvids{display:flex;gap:4px;flex-wrap:wrap}
  .rvids-grid{display:flex;flex-wrap:wrap;gap:4px}
  .rvid-thumb{width:80px;height:34px;border:2px solid #d6e9f1;border-radius:10px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;font-size:9px;font-weight:800;color:#4a6574;transition:.2s;padding:2px;flex-direction:column}
  .rvid-thumb:hover{border-color:var(--bar);background:var(--bg)}
  .rvid-thumb.active{border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}
  .rvid-num{font-size:16px;line-height:1.1;text-align:center;word-break:break-word}
  .rbtns{display:flex;gap:8px}
  .rbtn{flex:1;text-align:center;padding:11px;border-radius:999px;font-family:inherit;font-size:13.5px;font-weight:900;text-decoration:none;cursor:pointer;border:0}
  .rbtn.go{background:var(--accent);color:var(--accent-ink);box-shadow:0 2px 0 #f2c21a}
  .rbtn.tt{background:#fff;color:var(--ink)}
  .vcount{font-size:10px;font-weight:800;color:var(--glacier);background:var(--frost);border-radius:999px;padding:1px 5px;white-space:nowrap}
  .marker-pin{width:22px;height:22px;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.3)}
  .marker-badge{position:absolute;top:-7px;right:-9px;background:var(--ink);color:#fff;font-size:10px;font-weight:800;border-radius:999px;min-width:16px;height:16px;line-height:15px;text-align:center;padding:0 3px;border:1.5px solid #fff;z-index:3}
  .sheethandle{display:none;width:40px;height:5px;border-radius:3px;background:var(--line);margin:8px auto 2px;cursor:pointer;flex:0 0 auto}
  .mback{display:none}
  .clipnav{display:flex;position:fixed;right:15px;top:180px;flex-direction:column;align-items:center;gap:5px;z-index:15;pointer-events:none}
  .clipbtn{pointer-events:auto;width:30px;height:30px;border-radius:50%;border:0;background:var(--accent);color:var(--accent-ink);font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.4);transition:.2s}
  .clipbtn:hover{background:#ffdb5c;transform:scale(1.05)}
  .clippos{pointer-events:none;color:#fff;font-size:9px;font-weight:800;background:rgba(12,14,18,.8);border-radius:999px;padding:3px 7px;letter-spacing:.2px;backdrop-filter:blur(3px);min-width:32px;text-align:center;order:-1}
  .pubload{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;font-weight:700;background:var(--bg);z-index:700}

  @media(max-width:760px){
    .pubbar{flex-wrap:wrap;row-gap:8px;padding:10px 14px}
    /* Row 1: logo + Home · Map · Login. Row 2: creator photo, name, View page, creator menu. */
    .pubdiv{display:none}
    .publogo svg{height:26px !important}
    .pubnav{order:1;margin-left:auto}
    .pubbreak{display:block;order:2;flex-basis:100%;height:0}
    .pubbar .pfp{order:3}
    .pubwho{order:4;flex:1 1 0;min-width:0}
    .pubwho .nm,.pubwho .h{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pubbar .pfp{width:32px;height:32px}
    .pubwho .nm{font-size:14px}
    .pubwho .h{font-size:11px}
    .pubview{order:5;font-size:12px;padding:6px 11px}
    .pubbar .pubsel{order:6;max-width:34vw;font-size:12px;padding:6px 8px}
    .pubmain{display:block;position:relative}
    #pubmap{position:absolute;top:0;left:0;right:0;bottom:0}
    .publeft{position:absolute;left:0;right:0;bottom:0;width:auto;min-width:0;height:64%;border-right:0;
      border-radius:18px 18px 0 0;box-shadow:0 -6px 22px rgba(0,0,0,.16);z-index:650;
      transform:translateY(calc(100% - 150px));transition:transform .3s ease}
    .publeft.expanded{transform:translateY(0)}
    .sheethandle{display:block}
    .publeft .srch{padding-top:2px}
    .pubright{position:fixed;inset:0;z-index:1200;width:100%;min-width:0;height:100%;border-left:0;flex-direction:column;
      transform:translateY(100%);transition:transform .3s ease}
    .pubright.show{transform:translateY(0)}
    .mback{display:inline-flex;align-items:center;gap:5px;position:absolute;top:12px;right:60px;z-index:20;
      background:rgba(0,0,0,.7);color:#fff;border:0;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:750;cursor:pointer;backdrop-filter:blur(4px)}
    .clipnav{display:flex}
  }
`;
