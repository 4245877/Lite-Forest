// Хранение тредов мини-чата «Питання майстру» (ProductQuestionChat) в localStorage.
//
// Вынесено из компонента отдельным модулем, потому что чистить треды должен ещё и
// логаут (auth/index.jsx), а импорт компонента оттуда замкнул бы цикл: компонент
// импортирует useAuth из того же auth/index.jsx.
//
// Ключ включает владельца (аккаунт или 'guest'). Переписка лежит вместе с
// thread_token, который даёт доступ к треду в обход кук, а localStorage общий для
// всех, кто сидит за этим браузером: по ключу «только товар» следующий
// пользователь открывал чужой тред и продолжал переписку от своего имени.

export const PQ_STORAGE_PREFIX = 'lf:pq:';

export const GUEST_SCOPE = 'guest';

// Владелец переписки: аккаунт или гость. Гостевой namespace общий для всех
// незалогиненных на этом браузере — пока аккаунта нет, различить их нечем; логаут
// гостевые треды тоже стирает.
export function ownerScopeOf(user) {
  const id = user?.id ?? null;
  return id == null ? GUEST_SCOPE : `u:${id}`;
}

export function storageKeyFor(ownerScope, productId, productSku) {
  const id = productId ?? productSku ?? 'unknown';
  return `${PQ_STORAGE_PREFIX}${ownerScope}:${id}`;
}

const EMPTY_THREAD = { threadId: null, threadToken: null, messages: [] };

// threadToken — подпись треда, выданная бекендом вместе с thread_id. Без него
// продолжить переписку и прочитать ответы оператора нельзя (чат гостевой, куками
// его не закрыть). Хранится рядом с тредом: потеря токена = новый диалог.
export function loadThread(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...EMPTY_THREAD };
    const parsed = JSON.parse(raw);
    return {
      threadId: typeof parsed?.threadId === 'string' ? parsed.threadId : null,
      threadToken: typeof parsed?.threadToken === 'string' ? parsed.threadToken : null,
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return { ...EMPTY_THREAD };
  }
}

export function saveThread(key, threadId, threadToken, messages) {
  try {
    // Храним только доставленные сообщения: незавершённые (sending) и упавшие
    // (failed) — это транзиентные состояния текущей сессии.
    const persistable = messages.filter((m) => m.status !== 'failed' && m.status !== 'sending');
    window.localStorage.setItem(key, JSON.stringify({ threadId, threadToken, messages: persistable }));
  } catch {
    // приватный режим / переполнение — переписка просто не сохранится, не критично
  }
}

export function removeThread(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // хранилище недоступно — удалять нечего
  }
}

// Удаляет все треды «Питання майстру». Зовётся при логауте: thread_token даёт
// доступ к переписке в обход кук, поэтому пережить сессию он не должен.
export function purgeProductQuestionThreads() {
  try {
    const doomed = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PQ_STORAGE_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // приватный режим / недоступное хранилище — чистить нечего
  }
}
