import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ sku:'', name:'', price:'', currency:'UAH', stock:'0', image_url:'', description:'' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const data = await api.listProducts('', 100);
      setItems(data.items || data);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api.createProduct({
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        currency: form.currency || 'UAH',
        stock: Number(form.stock || 0),
        image_url: form.image_url || undefined
      });
      setForm({ sku:'', name:'', price:'', currency:'UAH', stock:'0', image_url:'', description:'' });
      await load();
      alert('Товар добавлен');
    } catch (e) { setErr(String(e)); }
  };

  return (
    <div style={{padding:16}}>
      <h1>Админ: товары</h1>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      <form onSubmit={submit} style={{display:'grid', gap:8, maxWidth:480}}>
        <input placeholder="SKU" value={form.sku} onChange={e=>setForm({...form, sku:e.target.value})} required />
        <input placeholder="Название" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
        <input type="number" step="0.01" placeholder="Цена" value={form.price} onChange={e=>setForm({...form, price:e.target.value})} required />
        <input placeholder="Валюта" value={form.currency} onChange={e=>setForm({...form, currency:e.target.value})} />
        <input type="number" placeholder="Остаток" value={form.stock} onChange={e=>setForm({...form, stock:e.target.value})} />
        <input placeholder="Ссылка на изображение" value={form.image_url} onChange={e=>setForm({...form, image_url:e.target.value})} />
        <textarea placeholder="Описание" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
        <button type="submit">Добавить</button>
      </form>

      <h2 style={{marginTop:24}}>Товары ({items.length})</h2>
      {loading ? <p>Загрузка…</p> : (
        <table border="1" cellPadding="6" style={{borderCollapse:'collapse', width:'100%'}}>
          <thead><tr>
            <th>SKU</th><th>Название</th><th>Цена</th><th>Остаток</th><th>Действия</th>
          </tr></thead>
          <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{Number(p.price).toFixed(2)} {p.currency}</td>
              <td>{p.stock}</td>
              <td>
                <button onClick={async () => { if (confirm('Удалить?')) { await api.deleteProduct(p.id); await load(); }}}>Удалить</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
