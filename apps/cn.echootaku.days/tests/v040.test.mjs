import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const sandbox = { console, Date, Intl, JSON, Math, Number, Object, Array, String, Boolean, RegExp, Promise, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'main.js' });

test('normalizes supported reminder offsets and time', () => {
  const events = sandbox.daysNormalizeEvents([{ id: 'one', title: 'Test', date: '2027-01-02', reminders: { enabled: true, offsets: [7, 1, 7, 99], time: '08:30' } }]);
  assert.equal(events.length, 1);
  assert.deepEqual(Array.from(events[0].reminders.offsets), [7, 1]);
  assert.equal(events[0].reminders.time, '08:30');
  assert.equal(events[0].reminders.enabled, true);
});

test('rejects impossible calendar dates instead of rolling them forward', () => {
  assert.equal(sandbox.daysParseDate('2027-02-29'), null);
  assert.equal(sandbox.daysParseDate('2027-02-31'), null);
  assert.equal(sandbox.daysParseDate('2028-02-29')?.getDate(), 29);
});

test('preserves reminders for legacy events after invalid records are filtered', () => {
  const events = sandbox.daysNormalizeEvents([
    { title: 'Invalid', date: '2027-02-31' },
    { title: 'Legacy', date: '2027-03-02', reminders: { enabled: true, offsets: [1], time: '08:30' } },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'legacy-0');
  assert.equal(events[0].reminders.enabled, true);
  assert.deepEqual(Array.from(events[0].reminders.offsets), [1]);
});

test('backup parser rejects foreign formats and preserves valid reminders', () => {
  assert.throws(() => sandbox.daysParseBackup('{"format":"other"}'));
  const backup = { format: 'cn.echootaku.days.backup', schemaVersion: 1, data: { events: [{ id: 'one', title: 'Test', date: '2027-01-02', reminders: { enabled: true, offsets: [0], time: '09:00' } }], categories: [], theme: {} } };
  const parsed = sandbox.daysParseBackup(JSON.stringify(backup));
  assert.equal(parsed.events[0].reminders.enabled, true);
  assert.deepEqual(Array.from(parsed.events[0].reminders.offsets), [0]);
  backup.data.events.push({ id: 'one', title: 'Duplicate', date: '2027-02-02' });
  assert.throws(() => sandbox.daysParseBackup(JSON.stringify(backup)));
});

test('merge uses imported event ids but keeps the current theme', () => {
  const currentTheme = sandbox.daysNormalizeTheme({ preset: 'ocean' });
  const incomingTheme = sandbox.daysNormalizeTheme({ preset: 'forest' });
  const merged = sandbox.daysMergeBackup({ events: [{ id: 'same', title: 'Old' }], categories: [], theme: currentTheme }, { events: [{ id: 'same', title: 'New' }], categories: [], theme: incomingTheme });
  assert.equal(merged.events.length, 1);
  assert.equal(merged.events[0].title, 'New');
  assert.equal(merged.theme.preset, 'ocean');
});

test('annual occurrence clamps leap day in non-leap years', () => {
  const date = sandbox.daysOccurrenceInYear({ date: '2024-02-29' }, 2025);
  assert.equal(date.getFullYear(), 2025);
  assert.equal(date.getMonth(), 1);
  assert.equal(date.getDate(), 28);
});

test('one-time reminder applies the selected local time and offset', () => {
  const at = sandbox.daysReminderDate({ date: '2099-06-20', annual: false, reminders: { time: '08:15' } }, 7);
  assert.equal(at.getFullYear(), 2099);
  assert.equal(at.getMonth(), 5);
  assert.equal(at.getDate(), 13);
  assert.equal(at.getHours(), 8);
  assert.equal(at.getMinutes(), 15);
});

test('annual reminders use an absolute next occurrence instead of timezone-ambiguous cron', () => {
  const event = { id: 'annual', title: 'Annual', date: '2024-06-20', annual: true, reminders: { enabled: true, offsets: [7], time: '08:15' } };
  const task = sandbox.daysReminderTask(event, 7);
  assert.equal(task.scheduleType, 'once');
  assert.equal(Number.isFinite(task.schedule.at), true);
  assert.equal(Object.hasOwn(task.schedule, 'cron'), false);
  assert.equal(new Date(task.schedule.at).getHours(), 8);
  assert.equal(new Date(task.schedule.at).getMinutes(), 15);
});

test('reconciliation restores missing reminder tasks without replacing matching tasks', async () => {
  const event = { id: 'annual', title: 'Annual', date: '2024-06-20', annual: true, reminders: { enabled: true, offsets: [7], time: '08:15' } };
  const desired = sandbox.daysReminderTask(event, 7);
  const apiTask = {
    task_id: desired.taskId,
    name: desired.name,
    schedule_type: desired.scheduleType,
    schedule: desired.schedule,
    execution_target: desired.executionTarget,
    backend_actions: desired.backendActions,
    missed_policy: desired.missedPolicy,
  };
  const registered = [];
  const removed = [];
  sandbox.Tapp = {
    permissions: { includes(permission) { return permission === 'scheduler:register'; } },
    scheduler: {
      async list() { return [apiTask]; },
      async register(task) { registered.push(task); },
      async unregister(taskId) { removed.push(taskId); },
    },
  };
  await sandbox.daysReconcileReminders([event]);
  assert.deepEqual(registered, []);
  assert.deepEqual(removed, []);

  sandbox.Tapp.scheduler.list = async () => [];
  await sandbox.daysReconcileReminders([event]);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].taskId, desired.taskId);
});

test('failed reconciliation remains immediately retryable', async () => {
  let attempts = 0;
  sandbox.Tapp = {
    permissions: { includes(permission) { return permission === 'scheduler:register'; } },
    scheduler: {
      async list() {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary scheduler failure');
        return [];
      },
      async register() {},
      async unregister() {},
    },
  };
  sandbox.daysReminderReconcilePromise = null;
  sandbox.daysReminderReconciledAt = 0;
  await assert.rejects(sandbox.daysRequestReminderReconcile([], true), /temporary scheduler failure/);
  await sandbox.daysRequestReminderReconcile([], false);
  assert.equal(attempts, 2);
});

test('page mount and resume both request reminder reconciliation', () => {
  const mountStart = source.indexOf('daysMountPage = async function');
  const destroyStart = source.indexOf('var daysDestroyPageBase', mountStart);
  const lifecycleStart = source.lastIndexOf("if (typeof Tapp !== 'undefined' && Tapp.lifecycle)");
  assert.match(source.slice(mountStart, destroyStart), /daysRequestReminderReconcile\(daysPageState\.events, true\)/);
  assert.match(source.slice(lifecycleStart), /onResume[\s\S]*daysRequestReminderReconcile\(daysPageState\.events, false\)/);
});
