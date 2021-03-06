const test = require('ava');
const { EOL } = require('os');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const stream = require('stream');
const fs = require('fs');
const { factory, runTasks } = require('release-it/test/util');

const conventionalRecommendedBump = sinon.stub().callsFake((options, cb) => {
  if (options.preset === 'angular') return cb(null, { releaseType: 'minor' });
  cb(new Error('Something went wrong'));
});

const conventionalChangelog = sinon.stub().callsFake(options => {
  const s = new stream.Readable();
  s._read = () => {};
  process.nextTick(() => {
    s.emit('data', 'The changelog');
    if (options.releaseCount < 0) s.emit('error', new Error('Something went wrong'));
    s.emit('end');
  });
  return s;
});

const Plugin = proxyquire('.', {
  'conventional-recommended-bump': conventionalRecommendedBump,
  'conventional-changelog': conventionalChangelog
});

const namespace = 'conventional-changelog';
const preset = 'angular';
const infile = 'CHANGES.md';

test.after(() => {
  try {
    fs.unlinkSync(infile);
  } catch (err) {}
});

test('should not throw', async t => {
  const options = { [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await t.notThrowsAsync(runTasks(plugin));
});

test('should set changelog', async t => {
  const options = { [namespace]: { preset } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const { changelog } = plugin.config.getContext();
  t.is(changelog, 'The changelog');
});

test(`should write and update infile (${infile})`, async t => {
  const options = { [namespace]: { preset, infile } };
  const plugin = factory(Plugin, { namespace, options });
  await runTasks(plugin);
  const changelog = fs.readFileSync(infile);
  t.is(changelog.toString().trim(), 'The changelog');
  {
    await runTasks(plugin);
    const changelog = fs.readFileSync(infile);
    t.is(changelog.toString().trim(), `The changelog${EOL}${EOL}The changelog`);
  }
});

test('should reject if conventional bump passes error', async t => {
  const options = { [namespace]: { preset: 'what?' } };
  const plugin = factory(Plugin, { namespace, options });
  await t.throwsAsync(runTasks(plugin), /Something went wrong/);
});

test('should reject if conventional changelog has error', async t => {
  const options = { [namespace]: { preset, releaseCount: -1 } };
  const plugin = factory(Plugin, { namespace, options });
  await t.throwsAsync(runTasks(plugin), /Something went wrong/);
});
