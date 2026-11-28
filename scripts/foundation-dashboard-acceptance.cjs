// Exercise the real TSX view and response loader without adding a test framework.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

require.extensions['.tsx'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { PersonalDashboardView, loadPersonalDashboard } = require(path.join(__dirname, '../app/me/PersonalDashboardView.tsx'));
const render = (state) => renderToStaticMarkup(React.createElement(PersonalDashboardView, { state }));
const response = (status, body) => async () => new Response(JSON.stringify(body), { status });

async function main() {
  for (const kind of ['loading', 'unauthorized', 'unavailable']) {
    const markup = render({ kind });
    assert.doesNotMatch(markup, /No personal events yet/);
    assert.doesNotMatch(markup, /<ul>/);
  }
  assert.match(render({ kind: 'loading' }), /Loading your personal schedule/);
  assert.match(render({ kind: 'unauthorized' }), /href="\/login"/);
  assert.match(render({ kind: 'unavailable' }), /role="alert"/);
  assert.match(render({ kind: 'empty' }), /No personal events yet/);

  assert.equal((await loadPersonalDashboard(response(401, {}))).kind, 'unauthorized');
  assert.equal((await loadPersonalDashboard(response(503, { state: 'unavailable' }))).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(async () => { throw new Error('offline'); })).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(async () => new Response('broken JSON'))).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(response(200, {}))).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(response(200, { state: 'ready', events: [] }))).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(response(200, { state: 'empty', events: [] }))).kind, 'empty');

  const event = {
    id: 'event', uid: 'event@oski.app', ownerUserId: 'user', title: 'Article Question', eventKind: 'deadline',
    time: { kind: 'instant', at: '2026-11-14T17:30:00-08:00', timeZone: 'America/Los_Angeles' },
    conflict: 'Deadline changed; cohort adjustment withheld for review.',
    explanations: [{ field: 'due_at', selectedObservationIds: ['observation'], appliedRuleIds: [], reason: 'Canvas deadline retained because its reviewed input changed.' }],
  };
  let requested;
  const ready = await loadPersonalDashboard(async (url, options) => {
    requested = { url, options };
    return new Response(JSON.stringify({ state: 'ready', events: [event] }));
  });
  assert.equal(ready.kind, 'ready');
  assert.equal(requested.url, '/api/me/dashboard');
  assert.equal(requested.options.cache, 'no-store');
  const markup = render(ready);
  assert.match(markup, /Article Question/);
  assert.match(markup, /Nov 14, 2026/);
  assert.match(markup, /5:30 PM PST/);
  assert.match(markup, /Needs review:/);
  assert.match(markup, /cohort adjustment withheld/);
  assert.match(markup, /Canvas deadline retained/);
  assert.doesNotMatch(markup, /No personal events yet/);

  assert.equal((await loadPersonalDashboard(response(200, { state: 'ready', events: [{ title: 'incomplete' }] }))).kind, 'unavailable');
  assert.equal((await loadPersonalDashboard(response(200, { state: 'ready', events: [{ ...event, time: { ...event.time, at: '' } }] }))).kind, 'unavailable');
  const dateMarkup = render({ kind: 'ready', events: [{ ...event, conflict: undefined, time: { kind: 'date', startDate: '2026-11-25', endDateExclusive: '2026-11-28' } }] });
  assert.match(dateMarkup, /2026-11-25 – 2026-11-27 \(all day\)/);

  // Exercise the page effect as well: a delayed outage must never flash an empty schedule.
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/me' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require('react-dom/client');
  const PersonalDashboardPage = require(path.join(__dirname, '../app/me/page.tsx')).default;
  const previousFetch = globalThis.fetch;
  let complete;
  globalThis.fetch = () => new Promise((resolve) => { complete = resolve; });
  const container = document.getElementById('root');
  const root = createRoot(container);
  try {
    await React.act(async () => root.render(React.createElement(PersonalDashboardPage)));
    assert.match(container.textContent, /Loading your personal schedule/);
    assert.doesNotMatch(container.textContent, /No personal events yet/);
    await React.act(async () => complete(new Response(JSON.stringify({ state: 'unavailable' }), { status: 503 })));
    assert.match(container.textContent, /unavailable right now/);
    assert.doesNotMatch(container.textContent, /No personal events yet|Sign in/);
  } finally {
    await React.act(async () => root.unmount());
    globalThis.fetch = previousFetch;
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
  console.log('foundation dashboard acceptance: pass');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
