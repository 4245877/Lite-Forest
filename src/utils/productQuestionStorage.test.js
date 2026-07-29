// Тесты хранилища тредов мини-чата «Питання майстру» (Vitest).
// Запуск: pnpm test
//
// Суть проверок — изоляция переписок между аккаунтами. В localStorage лежит не
// только текст, но и thread_token: он даёт доступ к треду в обход кук, а
// хранилище общее для всех, кто сидит за этим браузером. Пока ключ зависел
// только от товара, следующий пользователь открывал чужой диалог и продолжал
// его от своего имени.
import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  GUEST_SCOPE,
  PQ_STORAGE_PREFIX,
  loadThread,
  ownerScopeOf,
  ownerScopeOf as scopeOf,
  purgeProductQuestionThreads,
  removeThread,
  saveThread,
  storageKeyFor,
} from './productQuestionStorage.js';

const msg = (id, text) => ({
  id,
  author: 'customer',
  text,
  created_at: '2026-07-15T10:00:00.000Z',
  status: 'sent',
});

test('ownerScopeOf: гость и аккаунт дают разные namespace', () => {
  assert.equal(ownerScopeOf(null), GUEST_SCOPE);
  assert.equal(ownerScopeOf(undefined), GUEST_SCOPE);
  // Пользователь без id неотличим от гостя — считаем гостем, а не «u:undefined».
  assert.equal(ownerScopeOf({}), GUEST_SCOPE);
  assert.equal(scopeOf({ id: 7 }), 'u:7');
  assert.notEqual(scopeOf({ id: 7 }), scopeOf({ id: 8 }));
});

test('storageKeyFor: ключ одного товара различается у разных владельцев', () => {
  const alice = storageKeyFor(ownerScopeOf({ id: 1 }), 'prod-1', 'SKU-1');
  const bob = storageKeyFor(ownerScopeOf({ id: 2 }), 'prod-1', 'SKU-1');
  const guest = storageKeyFor(GUEST_SCOPE, 'prod-1', 'SKU-1');

  assert.notEqual(alice, bob);
  assert.notEqual(alice, guest);
  assert.notEqual(bob, guest);

  // Префикс общий — по нему логаут находит и чистит все треды.
  for (const key of [alice, bob, guest]) {
    assert.ok(key.startsWith(PQ_STORAGE_PREFIX));
  }
});

test('смена аккаунта: тред Алисы не виден Бобу на том же товаре', () => {
  const aliceKey = storageKeyFor(ownerScopeOf({ id: 1 }), 'prod-1', 'SKU-1');
  const bobKey = storageKeyFor(ownerScopeOf({ id: 2 }), 'prod-1', 'SKU-1');

  saveThread(aliceKey, 'thread-alice', 'token-alice', [msg('m1', 'секрет Алисы')]);

  const bob = loadThread(bobKey);
  assert.equal(bob.threadId, null);
  assert.equal(bob.threadToken, null);
  assert.deepEqual(bob.messages, []);

  // У Алисы при этом всё на месте.
  const alice = loadThread(aliceKey);
  assert.equal(alice.threadId, 'thread-alice');
  assert.equal(alice.threadToken, 'token-alice');
  assert.equal(alice.messages.length, 1);
});

test('гостевой тред изолирован от аккаунтного', () => {
  const guestKey = storageKeyFor(GUEST_SCOPE, 'prod-1', 'SKU-1');
  const userKey = storageKeyFor(ownerScopeOf({ id: 1 }), 'prod-1', 'SKU-1');

  saveThread(guestKey, 'thread-guest', 'token-guest', [msg('g1', 'вопрос гостя')]);
  saveThread(userKey, 'thread-user', 'token-user', [msg('u1', 'вопрос аккаунта')]);

  assert.equal(loadThread(guestKey).threadId, 'thread-guest');
  assert.equal(loadThread(userKey).threadId, 'thread-user');
  assert.equal(loadThread(guestKey).threadToken, 'token-guest');
});

test('logout: purge удаляет все треды чата и их токены', () => {
  const aliceKey = storageKeyFor(ownerScopeOf({ id: 1 }), 'prod-1', 'SKU-1');
  const bobKey = storageKeyFor(ownerScopeOf({ id: 2 }), 'prod-2', 'SKU-2');
  const guestKey = storageKeyFor(GUEST_SCOPE, 'prod-3', 'SKU-3');

  saveThread(aliceKey, 't1', 'token-1', [msg('m1', 'a')]);
  saveThread(bobKey, 't2', 'token-2', [msg('m2', 'b')]);
  saveThread(guestKey, 't3', 'token-3', [msg('m3', 'c')]);

  // Чужой ключ в том же хранилище не должен пострадать.
  window.localStorage.setItem('lf:cart', 'не трогать');

  purgeProductQuestionThreads();

  for (const key of [aliceKey, bobKey, guestKey]) {
    assert.equal(window.localStorage.getItem(key), null);
    const thread = loadThread(key);
    assert.equal(thread.threadToken, null, 'токен не должен пережить логаут');
    assert.equal(thread.threadId, null);
  }

  assert.equal(window.localStorage.getItem('lf:cart'), 'не трогать');
});

test('saveThread не сохраняет транзиентные (sending/failed) сообщения', () => {
  const key = storageKeyFor(GUEST_SCOPE, 'prod-1', 'SKU-1');

  saveThread(key, 't1', 'token-1', [
    { ...msg('m1', 'доставлено'), status: 'sent' },
    { ...msg('m2', 'в полёте'), status: 'sending' },
    { ...msg('m3', 'упало'), status: 'failed' },
  ]);

  const loaded = loadThread(key);
  assert.deepEqual(
    loaded.messages.map((m) => m.id),
    ['m1'],
  );
});

test('loadThread переживает мусор в хранилище', () => {
  const key = storageKeyFor(GUEST_SCOPE, 'prod-1', 'SKU-1');

  window.localStorage.setItem(key, 'не json');
  assert.deepEqual(loadThread(key), { threadId: null, threadToken: null, messages: [] });

  // Тип полей тоже не гарантирован: хранилище правится руками и живёт годами.
  window.localStorage.setItem(key, JSON.stringify({ threadId: 42, messages: 'nope' }));
  const loaded = loadThread(key);
  assert.equal(loaded.threadId, null);
  assert.deepEqual(loaded.messages, []);
});

test('removeThread удаляет только свой тред', () => {
  const aliceKey = storageKeyFor(ownerScopeOf({ id: 1 }), 'prod-1', 'SKU-1');
  const bobKey = storageKeyFor(ownerScopeOf({ id: 2 }), 'prod-1', 'SKU-1');

  saveThread(aliceKey, 't1', 'token-1', [msg('m1', 'a')]);
  saveThread(bobKey, 't2', 'token-2', [msg('m2', 'b')]);

  removeThread(aliceKey);

  assert.equal(loadThread(aliceKey).threadId, null);
  assert.equal(loadThread(bobKey).threadId, 't2');
});
