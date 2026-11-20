'use strict';

// Shared card layout for the app preview and standalone export.
const datacardStyles = `
  .dc-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(12px, 2vw, 24px); align-items: start; container-type: inline-size; }
  .dc-cards:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
  @media screen and (max-width: 720px) {
    .dc-cards { grid-template-columns: minmax(0, 1fr); }
  }
  .dc-cards :is(h2, h3, p, dl, dd) { margin: 0; overflow-wrap: anywhere; }
  .dc-cards .datacard {
    --card-accent: #355e53;
    --card-tint: #e4e9db;
    --card-rule: #b8aa8c;
    --card-padding: clamp(13px, 2.4cqi, 23px);
    min-width: 0;
    padding: var(--card-padding);
    color: #252d25;
    color-scheme: light;
    background: radial-gradient(ellipse at 100% 100%, #eadbb8 0%, transparent 75%), #fcf7e7;
    border: 1px solid var(--card-rule);
    border-radius: 10px;
    box-shadow: 0 6px 16px #201d1626;
  }
  .dc-cards [data-lore="spell"] { --card-accent: #524472; --card-tint: #ede6f4; }
  .dc-cards [data-lore="prayer"] { --card-accent: #795025; --card-tint: #f4e8ce; }
  .dc-cards [data-lore="manifestation"] { --card-accent: #285c68; --card-tint: #dfedef; }
  .dc-title {
    display: flex; justify-content: space-between; flex-wrap: wrap; align-items: start; gap: 7px;
    margin: calc(-1 * var(--card-padding)) calc(-1 * var(--card-padding)) 12px;
    padding: calc(var(--card-padding) - 2px) var(--card-padding);
    border-radius: 9px 9px 0 0;
    border-bottom: 3px double #d4bc83;
    background: linear-gradient(115deg, #0004, transparent 85%), var(--card-accent);
    color: #fff8e6;
  }
  .dc-title > div { min-width: 0; }
  .dc-identity { display: flex; align-items: center; gap: 10px; }
  .dc-identity > div { min-width: 0; }
  .dc-identity .icon { width: 1.8rem; height: 1.8rem; flex: none; color: #f0ce90; }
  .masthead button .icon { width: 1rem; height: 1rem; vertical-align: -.15em; margin-inline-end: .45rem; }
  .dc-title h2 { margin-top: 4px; font: 700 clamp(1.45rem, 2.9cqi, 1.9rem)/1.16 Georgia, serif; }
  .dc-status { border: 1px solid currentColor; border-radius: 4px; padding: 4px 8px; font-size: .78rem; font-weight: 700; max-width: 100%; overflow-wrap: anywhere; }
  .dc-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .dc-warlord { background: #f0ce90; color: #322411; border-color: #f0ce90; }
  .dc-label, .dc-cards dt, .dc-detail h3, .dc-weapons caption { font: 750 .76rem/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .055em; color: var(--card-accent, #355e53); }
  .dc-title .dc-label { color: #fff1cb; }
  .dc-cards :is(.dc-stats, .dc-metrics) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 70px), 1fr)); gap: 6px; margin-top: 12px; }
  :is(.dc-stats, .dc-metrics) > div { border: 1px solid var(--card-rule); background: var(--card-tint); border-radius: 5px; padding: 6px 8px; }
  .dc-stats dd, .dc-metrics dd { font: 700 1.23rem/1.15 Georgia, serif; margin-top: 3px; }
  .dc-weapons { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 11px; text-align: left; font: .83rem/1.24 system-ui, sans-serif; }
  .dc-weapons caption { text-align: left; padding-bottom: 5px; }
  .dc-weapons th, .dc-weapons td { border: 1px solid #c6d0c5; padding: 4px; font-size: inherit; color: inherit; white-space: nowrap; }
  .dc-weapons thead th { background: var(--card-tint); }
  .dc-weapons th:first-child { width: 40%; white-space: normal; word-break: normal; overflow-wrap: normal; hyphens: none; }
  .dc-weapons th:not(:first-child) { text-align: center; }
  .dc-weapons td { text-align: center; }
  .dc-weapons small { font-size: .72rem; font-weight: 500; }
  @media screen {
    @container (max-width: 500px) {
      .dc-title { gap: 8px; }
      .dc-title h2 { font-size: clamp(1.2rem, 5cqi, 1.55rem); }
      .dc-identity .icon { width: 1.5rem; height: 1.5rem; }
      .dc-cards .dc-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .dc-weapons { font-size: .75rem; }
      .dc-weapons th, .dc-weapons td { padding-inline: 2px; }
    }
  }
  .dc-details { display: flex; flex-wrap: wrap; gap: 8px 15px; padding-top: 10px; font-size: .9rem; }
  .dc-detail { border-top: 1px solid var(--card-rule); padding-top: 9px; margin-top: 11px; }
  .dc-detail p { white-space: pre-wrap; margin-top: 4px; line-height: 1.52; font-size: .92rem; }
  .dc-anvil ul { padding: 0; margin: 8px 0 0; list-style: none; }
  .dc-anvil li { padding: 6px 0; border-top: 1px solid #c6d0c5; overflow-wrap: anywhere; }
  .dc-anvil li > span { margin-inline-start: 6px; color: #3d5a50; font-size: .8rem; }
  .dc-ability { --phase-ink: #39574a; border: 1px solid var(--card-rule); border-inline-start: 3px solid var(--phase-ink); border-radius: 5px; padding: 9px 11px; margin-top: 10px; background: #fffdf45c; }
  .dc-ability[data-phase="shooting"], .dc-ability[data-phase="movement"] { --phase-ink: #285a76; }
  .dc-ability[data-phase="charge"], .dc-ability[data-phase="combat"] { --phase-ink: #813d31; }
  .dc-ability[data-phase="hero"], .dc-ability[data-phase="end"] { --phase-ink: #645081; }
  .dc-ability .dc-timing { color: var(--phase-ink); font-size: .76rem; font-weight: 750; margin-bottom: 3px; }
  .dc-ability h3 { font: 700 1rem/1.2 Georgia, serif; }
  .dc-ability .dc-upgrade { display: inline-block; border: 1px solid #a39777; color: #574824; border-radius: 3px; padding: 1px 4px; font-size: .74rem; margin-top: 5px; }
  .dc-ability .dc-effect { white-space: pre-wrap; margin-top: 5px; line-height: 1.46; font-size: .92rem; }
  .dc-cards .dc-source { font-size: .75rem; color: #3d5a50; margin-top: 8px; }
  .dc-source a { color: #244e40; text-decoration: underline; }
`;

// Standalone export page and paper layout.
const datacardExportStyles = `
  * { box-sizing: border-box; }
  :root { font-family: system-ui, sans-serif; color: #252d25; color-scheme: light; background: radial-gradient(ellipse at top, #f8f3df, #e4dcc8 85%); }
  body { max-width: 1220px; min-height: 100vh; margin: auto; padding: clamp(16px, 4vw, 44px); }
  h1, p { margin: 0; overflow-wrap: anywhere; }
  h1 { font-family: Georgia, serif; }
  .masthead { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: clamp(17px, 3.5vw, 36px); margin-bottom: 20px; border-radius: 10px; border-bottom: 4px solid var(--banner); background: #213b33; color: #fff6de; }
  .masthead .dc-label { color: #f0ce90; }
  .masthead h1 { font-size: clamp(2rem, 5vw, 3.7rem); margin: 4px 0 8px; }
  .warband-facts { color: #f0e3c9; line-height: 1.5; }
  button { align-self: start; font: inherit; font-weight: 700; color: #322411; padding: 9px 14px; border: 1px solid #f0ce90; border-radius: 5px; background: #f0ce90; cursor: pointer; }
  button:focus-visible { outline: 2px solid #25493f; outline-offset: 3px; }
  .dc-print-hint { color: #354a42; margin-bottom: 14px; }
  .dc-print-choice { display: flex; align-items: center; gap: 6px; width: fit-content; margin: 6px 0; font-size: .8rem; }
  .dc-print-choice input[type="checkbox"] { accent-color: #25493f; margin: 0; padding: 0; width: 16px; height: 16px; min-width: 16px; min-height: 16px; max-width: 16px; max-height: 16px; flex: 0 0 16px; vertical-align: middle; }
  .dc-ability > .dc-print-choice { float: inline-end; margin: 0 0 4px 8px; }
  @media screen and (max-width: 580px) {
    body { padding: clamp(10px, 3vw, 16px); }
    .masthead { gap: 11px; padding: 14px; margin-bottom: 12px; }
    .masthead h1 { font-size: clamp(1.55rem, 7vw, 2rem); }
    .warband-facts, .dc-print-hint { font-size: .875rem; }
    .masthead button { width: 100%; min-height: 44px; line-height: 1.25; }
    .dc-print-choice { min-height: 36px; }
    .dc-ability > .dc-print-choice { float: none; margin: 0 0 4px; }
  }
  :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { border-style: dashed; }
  @page { margin: 11mm; }
  @media print {
    :root, .dc-cards .datacard { background: white; }
    body { max-width: none; padding: 0; font-size: 10pt; }
    button, .dc-print-choice, .dc-print-hint, :is(.datacard, .dc-ability):has(> .dc-print-choice input:not(:checked)) { display: none; }
    .masthead { break-inside: avoid; margin-bottom: 4mm; padding: 0 0 3mm; border-radius: 0; border-bottom: 1px solid #978669; }
    .masthead, .masthead .dc-label, .warband-facts { background: white; color: #252d25; }
    .masthead h1 { font-size: 22pt; }
    .dc-cards { display: block; column-count: 2; column-gap: 4mm; }
    .dc-cards .datacard { --card-padding: 3mm; break-inside: avoid; margin: 0 0 4mm; box-shadow: none; }
    .dc-title { background: var(--card-tint); color: var(--card-accent); }
    .dc-title .dc-label { color: var(--card-accent); }
    .dc-identity .icon { color: var(--card-accent); }
    .dc-ability { break-inside: avoid; }
    .dc-weapons { font-size: .72rem; }
    .dc-weapons th, .dc-weapons td { padding-inline: 2px; }
    .dc-title h2 { font-size: 15pt; }
  }
`;
