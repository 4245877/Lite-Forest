export async function readError(res) {
  try {
    const j = await res.json();
    return j?.message || res.statusText || 'Помилка запиту';
  } catch {
    return res.statusText || 'Помилка запиту';
  }
}