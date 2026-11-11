// Styles ported 1:1 from the original fan map (keen-lollipop-93bfb2.netlify.app),
// scoped to #pub so they don't leak into the rest of the app.
export const FAN_CSS = `
  #pub{--ink:#12141a;--ink2:#555b66;--muted:#8b909b;--line:#e7e9ee;--bg:#f6f7f9;--panel:#fff;--accent:#ff2d55;--brand:#111;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink)}
  #pub *{box-sizing:border-box}
  #pub button{font-family:inherit;cursor:pointer}

  #pub{position:fixed;inset:0;z-index:800;background:#fff;display:flex;flex-direction:column}
  .pubbar{display:flex;align-items:center;gap:12px;padding:11px 18px;color:#fff;background:var(--accent);flex:0 0 auto}
  .pubbar .pfp{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;overflow:hidden;flex:0 0 auto;text-decoration:none}
  .pubbar .pfp img{width:100%;height:100%;object-fit:cover}
  .pubbar .nm{font-weight:750;line-height:1.25}.pubbar .h{font-size:12px;opacity:.9}
  .pubbar .pubtag{background:rgba(255,255,255,.92);color:#12141a;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px}
  .pubbar .pubsel{margin-left:auto;background:rgba(255,255,255,.92);color:#12141a;border:0;border-radius:999px;font-size:12px;font-weight:750;padding:6px 10px;max-width:46vw;outline:none;cursor:pointer}
  .pubmain{flex:1;display:flex;min-height:0;position:relative}
  .publeft{width:280px;min-width:280px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:#fff;z-index:100}
  .publeft .srch{padding:12px 14px 9px;display:flex;gap:6px;align-items:center}
  .publeft .srch input{flex:1;min-width:0;padding:9px 12px;border:1px solid var(--line);border-radius:9px;font-size:13px;outline:none}
  .publeft .srch input:focus{border-color:var(--accent)}
  .srch-toggle{background:none;border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--muted);font-size:13px;cursor:pointer;transition:.15s;flex:0 0 auto}
  .srch-toggle:hover{color:var(--ink);border-color:var(--accent)}
  .pubchips-wrapper{display:flex;border-bottom:1px solid var(--line);background:#fff;flex:0 0 auto;gap:0;align-items:center}
  .clear-btn{background:#f0f0f0;border-color:#ddd;cursor:pointer;flex:0 0 auto;margin:10px 8px 10px 14px;padding:7px 12px;font-size:12px;font-weight:650;border-radius:999px;border:1px solid var(--line)}
  .clear-btn:hover{background:#e8e8e8}
  .pubchips-bar{display:flex;overflow-x:auto;gap:8px;padding:10px 0 10px 0;flex:1;min-width:0;scroll-behavior:smooth;margin-right:14px}
  .pubchips-bar::-webkit-scrollbar{height:4px}
  .pubchips-bar::-webkit-scrollbar-track{background:#f0f0f0}
  .pubchips-bar::-webkit-scrollbar-thumb{background:var(--accent);border-radius:2px}
  .pchip{font-size:12px;font-weight:650;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;white-space:nowrap;cursor:pointer;display:flex;align-items:center;gap:6px;flex:0 0 auto}
  .pchip .d{width:8px;height:8px;border-radius:50%}
  .pchip.on{color:#fff;border-color:transparent;background:var(--accent)}
  #pubCount{font-size:11px;color:var(--muted);padding:8px 16px 4px}
  #pubList{overflow-y:auto;flex:1}
  .pcard{padding:11px 15px;border-bottom:1px solid var(--line);cursor:pointer;transition:.12s}
  .pcard:hover{background:#f5f6f9}
  .pcard.on{background:#eef4fd;box-shadow:inset 3px 0 0 var(--accent)}
  .pcard h4{margin:0;font-size:13.5px;font-weight:700;letter-spacing:-.1px}
  .pcard .by{display:flex;align-items:center;gap:5px;font-size:11px;color:#6b7280;margin:3px 0 4px}
  .pcard .by .d{width:7px;height:7px;border-radius:50%}
  .pcard .mt{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-top:3px}
  .pcard .cz{font-size:10px;font-weight:700;color:#fff;border-radius:5px;padding:1px 6px}
  .pcard .star{font-size:9.5px;font-weight:800;color:#9a7413;background:#fdf3dd;border-radius:5px;padding:1px 5px}
  #pubmap{flex:1;min-width:0;position:relative;overflow:hidden}
  .pubright{width:390px;min-width:390px;border-left:1px solid var(--line);display:flex;flex-direction:column;background:#0e0f12;position:relative;gap:0}
  .pubright .rv{flex:1;min-height:0;background:#000;display:flex;align-items:center;justify-content:center;position:relative}
  .pubright .rv iframe{width:100%;height:100%;border:0}
  .pubright .empty{flex:1;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;color:#8b909b;font-size:13px;text-align:center;padding:26px;line-height:1.5}
  .pubright .empty .big{font-size:30px}
  .rmeta{background:rgba(0,0,0,.9);backdrop-filter:blur(4px);padding:13px 15px 15px;position:relative;flex:0 0 auto;max-height:65%;overflow-y:auto;transition:max-height .3s ease,padding .3s ease;border-top:1px solid rgba(255,255,255,.1)}
  .rmeta.collapsed{max-height:36px;padding:10px 15px;overflow:hidden;border-top:none}
  .rmeta h3{margin:0 0 4px;font-size:17px;font-weight:700;letter-spacing:-.2px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none}
  .rmeta .toggle-arrow{font-size:14px;transition:transform .3s ease;display:inline-block;margin-left:8px}
  .rmeta.collapsed .toggle-arrow{transform:rotate(180deg)}
  .rmeta .rby{display:flex;align-items:center;gap:6px;font-size:12px;color:#ddd;margin-bottom:5px}
  .rmeta .rby .d{width:9px;height:9px;border-radius:50%}
  .rmeta .raddr{font-size:12px;color:#bbb;margin-bottom:9px}
  .rmeta .rcode{font-size:12px;color:#7ee2a8;margin:-4px 0 9px;font-weight:700}
  .rmeta .info-row{display:flex;align-items:center;gap:8px;margin-bottom:11px;flex-wrap:wrap}
  .rmeta h3 .tag-in-header{font-size:10.5px;font-weight:700;color:#fff;border-radius:6px;padding:3px 9px;margin-left:8px;margin-right:auto;display:inline-block}
  .rvids{display:flex;gap:4px;flex-wrap:wrap}
  .rvids-grid{display:flex;flex-wrap:wrap;gap:4px}
  .rvid-thumb{width:80px;height:34px;border:2px solid #ddd;border-radius:5px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:650;color:#666;transition:.2s;padding:2px;flex-direction:column}
  .rvid-thumb:hover{border-color:#999;background:#f9f9f9}
  .rvid-thumb.active{border-color:var(--accent);background:var(--accent);color:#fff}
  .rvid-num{font-size:16px;line-height:1.1;text-align:center;word-break:break-word}
  .rbtns{display:flex;gap:8px}
  .rbtn{flex:1;text-align:center;padding:10px;border-radius:10px;font-size:13px;font-weight:750;text-decoration:none;cursor:pointer;border:0}
  .rbtn.go{background:var(--ink);color:#fff}
  .rbtn.tt{background:var(--accent);color:#fff}
  .vcount{font-size:10px;font-weight:700;color:#c81e46;background:#ffe6ec;border-radius:5px;padding:1px 5px;white-space:nowrap}
  .marker-pin{width:22px;height:22px;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.3)}
  .marker-badge{position:absolute;top:-8px;right:-8px;background:#12141a;color:#fff;font-size:10px;font-weight:800;border-radius:999px;min-width:16px;height:16px;line-height:15px;text-align:center;padding:0 3px;border:1.5px solid #fff;z-index:3}
  .sheethandle{display:none;width:40px;height:5px;border-radius:3px;background:#d7dbe3;margin:8px auto 2px;cursor:pointer;flex:0 0 auto}
  .mback{display:none}
  .clipnav{display:flex;position:fixed;right:15px;top:180px;flex-direction:column;align-items:center;gap:5px;z-index:15;pointer-events:none}
  .clipbtn{pointer-events:auto;width:28px;height:28px;border-radius:50%;border:0;background:rgba(12,14,18,.8);color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.4);transition:.2s}
  .clipbtn:hover{background:rgba(12,14,18,.95);transform:scale(1.05)}
  .clippos{pointer-events:none;color:#fff;font-size:9px;font-weight:800;background:rgba(12,14,18,.8);border-radius:999px;padding:3px 7px;letter-spacing:.2px;backdrop-filter:blur(3px);min-width:32px;text-align:center;order:-1}
  .pubload{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;background:#fff;z-index:700}

  @media(max-width:760px){
    .pubbar .pubtag{display:none}
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
