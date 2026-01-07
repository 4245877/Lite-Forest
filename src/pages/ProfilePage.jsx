// src/pages/ProfilePage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './ProfilePage.module.css';
import LoginPage from './LoginPage'; // <--- добавлен импорт

/* utils */
async function readError(res){
  try{ const j = await res.json(); return j?.message || res.statusText || 'Помилка запиту'; }
  catch{ return res.statusText || 'Помилка запиту'; }
}
const TABS = ['overview','profile','orders','payments','shipping','returns','favorites','notifications','support','coupons','security'];
const LABELS = {
  overview:'Огляд', profile:'Профіль', orders:'Замовлення', payments:'Оплата', shipping:'Доставка',
  returns:'Повернення і гарантія', favorites:'Обране', notifications:'Сповіщення', support:'Підтримка',
  coupons:'Купони та бали', security:'Безпека',
};
const getInitialTab = () => (typeof window==='undefined' ? 'overview' : (TABS.includes(window.location.hash?.slice(1)) ? window.location.hash.slice(1) : 'overview'));

/* ---------- Tabs ---------- */

const Overview = ({ user }) => {
  const firstName = (user?.name||'').split(' ')[0] || '—';
  return (
    <section className={styles.section} aria-labelledby="tab-overview-label">
      <h2 id="tab-overview-label" className={styles.sectionTitle}>Огляд</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Профіль</h3>
        <p><strong>Ім’я:</strong> {user?.name || '—'}</p>
        <p><strong>Email:</strong> {user?.email || '—'}</p>
        <Link to="/profile#profile" className={styles.btnPrimary}>Редагувати профіль</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Швидкі дії</h3>
        <div className={styles.actionsRow}>
          <Link to="/profile#orders" className={styles.action}>Мої замовлення</Link>
          <Link to="/profile#favorites" className={styles.action}>Обране</Link>
          <Link to="/profile#payments" className={styles.action}>Оплата</Link>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Вітання</h3>
        <p className={styles.cardText}>Радий бачити, {firstName}. Продовжимо покупки?</p>
        <Link to="/catalog" className={styles.btnPrimary}>До каталогу</Link>
      </div>
    </section>
  );
};

const ProfileTab = ({ user }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  // password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(!!user?.twoFAEnabled);
  const [twoFAStage, setTwoFAStage] = useState('idle'); // idle | verify
  const [otpUri, setOtpUri] = useState('');
  const [otpSecret, setOtpSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoMsg, setTwoMsg] = useState(''); const [twoErr, setTwoErr] = useState('');
  const codeRef = useRef(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setErr(''); setMsg(''); setSaving(true);
    try{
      const res = await fetch('/api/account/profile', { // [Непідтверджено]: перевір ендпоінт
        method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ name, email }),
      });
      if(!res.ok) throw new Error(await readError(res));
      setMsg('Профіль оновлено');
    }catch(e){ setErr(e.message || 'Не вдалося оновити профіль'); }
    finally{ setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (newPwd.length < 8) { setErr('Пароль має бути не менше 8 символів'); return; }
    if (newPwd !== newPwd2) { setErr('Паролі не співпадають'); return; }
    try{
      const res = await fetch('/api/account/password/change', { // [Непідтверджено]
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      if(!res.ok) throw new Error(await readError(res));
      setMsg('Пароль змінено'); setOldPwd(''); setNewPwd(''); setNewPwd2('');
    }catch(e){ setErr(e.message || 'Помилка зміни пароля'); }
  };

  const start2FA = async () => {
    setTwoErr(''); setTwoMsg('');
    try{
      const res = await fetch('/api/auth/2fa/setup', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setOtpUri(data?.otpauthUrl || ''); setOtpSecret(data?.secret || '');
      setTwoFAStage('verify'); setTimeout(()=>codeRef.current?.focus(), 0);
    }catch(e){ setTwoErr(e.message || 'Не вдалося ініціювати 2FA'); }
  };
  const confirm2FA = async () => {
    setTwoErr(''); setTwoMsg('');
    try{
      const res = await fetch('/api/auth/2fa/confirm', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ code: otpCode }) }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setTwoMsg('2FA увімкнено'); setTwoFAEnabled(true); setTwoFAStage('idle'); setOtpUri(''); setOtpSecret(''); setOtpCode('');
    }catch(e){ setTwoErr(e.message || 'Код невірний'); }
  };
  const disable2FA = async () => {
    setTwoErr(''); setTwoMsg('');
    try{
      const res = await fetch('/api/auth/2fa/disable', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setTwoMsg('2FA вимкнено'); setTwoFAEnabled(false); setTwoFAStage('idle');
    }catch(e){ setTwoErr(e.message || 'Не вдалося вимкнути 2FA'); }
  };

  return (
    <section className={styles.section} aria-labelledby="tab-profile-label">
      <h2 id="tab-profile-label" className={styles.sectionTitle}>Профіль</h2>

      {(msg || err) && (
        <div className={err ? styles.serverError : styles.serverOk} role={err ? 'alert' : 'status'} aria-live="polite">
          {err || msg}
        </div>
      )}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Дані профілю</h3>
        <form onSubmit={saveProfile} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="p-name">Ім’я</label>
            <input id="p-name" className={styles.input} value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="p-email">Email</label>
            <input id="p-email" type="email" className={styles.input} value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" />
          </div>
          <button type="submit" className={styles.btnPrimary} disabled={saving} aria-busy={saving? 'true': undefined}>Зберегти</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Зміна пароля</h3>
        <form onSubmit={changePassword} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="pwd-old">Поточний пароль</label>
            <div className={styles.controlRow}>
              <input id="pwd-old" type={show1? 'text':'password'} className={styles.input} value={oldPwd} onChange={(e)=>setOldPwd(e.target.value)} autoComplete="current-password" />
              <button type="button" className={styles.toggleBtn} aria-pressed={show1} onClick={()=>setShow1(v=>!v)}>{show1? 'Сховати':'Показати'}</button>
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="pwd-new">Новий пароль</label>
            <div className={styles.controlRow}>
              <input id="pwd-new" type={show2? 'text':'password'} className={styles.input} value={newPwd} onChange={(e)=>setNewPwd(e.target.value)} autoComplete="new-password" />
              <button type="button" className={styles.toggleBtn} aria-pressed={show2} onClick={()=>setShow2(v=>!v)}>{show2? 'Сховати':'Показати'}</button>
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="pwd-new2">Підтвердження</label>
            <div className={styles.controlRow}>
              <input id="pwd-new2" type={show3? 'text':'password'} className={styles.input} value={newPwd2} onChange={(e)=>setNewPwd2(e.target.value)} autoComplete="new-password" />
              <button type="button" className={styles.toggleBtn} aria-pressed={show3} onClick={()=>setShow3(v=>!v)}>{show3? 'Сховати':'Показати'}</button>
            </div>
          </div>
          <button className={styles.btnPrimary} type="submit">Змінити пароль</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Двоетапна перевірка (2FA)</h3>

        {(twoMsg || twoErr) && (
          <div className={twoErr ? styles.serverError : styles.serverOk} role={twoErr ? 'alert' : 'status'} aria-live="polite">
            {twoErr || twoMsg}
          </div>
        )}

        {twoFAEnabled ? (
          <>
            <p className={styles.cardText}>2FA увімкнено для вашого облікового запису.</p>
            <button type="button" className={styles.btnPrimary} onClick={disable2FA}>Вимкнути 2FA</button>
          </>
        ) : (
          <>
            {twoFAStage === 'idle' && (
              <button type="button" className={styles.btnPrimary} onClick={start2FA}>Увімкнути 2FA</button>
            )}
            {twoFAStage === 'verify' && (
              <div className={styles.twofaBox}>
                {otpUri && (
                  <p className={styles.cardText}>
                    Додайте акаунт у застосунок-аутентифікатор, відсканувавши QR або введіть секрет:
                    <br /><code>{otpSecret || '—'}</code>
                  </p>
                )}
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="otp">Код з додатку</label>
                  <input
                    id="otp" ref={codeRef} inputMode="numeric" pattern="\d{6}" maxLength={6}
                    className={styles.input} value={otpCode}
                    onChange={(e)=>setOtpCode(e.target.value.replace(/\D/g,''))}
                  />
                </div>
                <button type="button" className={styles.btnPrimary} onClick={confirm2FA}>Підтвердити 2FA</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

const OrdersTab = () => {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (next = null) => {
    setLoading(true); setErr('');
    try{
      // ВИПРАВЛЕННЯ ТУТ:
      const url = new URL('/api/me/orders', window.location.origin); // ✅ Це маршрут користувача
      
      url.searchParams.set('limit','10'); 
      if(next) url.searchParams.set('cursor', next);
      
      const res = await fetch(url.toString(), { credentials:'include' });
      if(!res.ok) throw new Error(await readError(res));
      
      const data = await res.json();
      setItems(prev => next ? [...prev, ...(data?.items||[])] : (data?.items||[]));
      setCursor(data?.nextCursor || null);
    }catch(e){ setErr(e.message || 'Не вдалося завантажити замовлення'); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);

  const repeatOrder = async (id) => {
    try{
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}/repeat`, { method:'POST', credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
    }catch{/* тихо */}
  };

  return (
    <section className={styles.section} aria-labelledby="tab-orders-label">
      <h2 id="tab-orders-label" className={styles.sectionTitle}>Замовлення</h2>
      {err && <div className={styles.serverError} role="alert" aria-live="assertive">{err}</div>}

      {loading && items.length===0 ? (
        <div className={styles.skeletonMain} aria-hidden />
      ) : items.length===0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Замовлень ще немає</div>
          <div className={styles.emptyText}>Переглянь каталог та додай перше замовлення.</div>
          <Link to="/catalog" className={styles.btnPrimary}>До каталогу</Link>
        </div>
      ) : (
        <>
          <ul className={styles.ordersList}>
            {items.map(o=>(
              <li key={o.id} className={styles.orderItem}>
                <div className={styles.orderHead}>
                  <strong>{o.id}</strong>
                  <span className={styles.orderDate}>{o.date || o.createdAt || ''}</span>
                </div>
                <div className={styles.orderFoot}>
                  <span className={styles.orderSum}>{typeof o.total==='number' ? `₴${o.total}` : (o.total || '')}</span>
                  {o.status && <span className={`${styles.status} ${o.status==='delivered'? styles.statusOk : styles.statusNeutral}`}>{o.statusTitle || o.status}</span>}
                  <Link to={`/orders/${o.id}`} className={styles.btnSmall}>Деталі</Link>
                  <button type="button" className={styles.btnSmall} onClick={()=>repeatOrder(o.id)}>Повторити</button>
                </div>
              </li>
            ))}
          </ul>
          {cursor && (
            <div style={{marginTop:12}}>
              <button type="button" className={styles.btnPrimary} onClick={()=>load(cursor)} disabled={loading} aria-busy={loading? 'true':undefined}>
                Показати ще
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const PaymentsTab = () => {
  const [cards, setCards] = useState([]); const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const [r1, r2] = await Promise.all([
          fetch('/api/billing/cards', { credentials:'include' }),      // [Непідтверджено]
          fetch('/api/billing/invoices?limit=20', { credentials:'include' }), // [Непідтверджено]
        ]);
        if(!r1.ok) throw new Error(await readError(r1));
        if(!r2.ok) throw new Error(await readError(r2));
        const j1 = await r1.json(); const j2 = await r2.json();
        setCards(j1?.items || []); setInvoices(j2?.items || []);
      }catch(e){ setErr(e.message || 'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  }, []);

  const removeCard = async(id)=>{
    try{
      const res = await fetch(`/api/billing/cards/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setCards(x=>x.filter(c=>c.id!==id));
    }catch{/* тихо */}
  };

  return (
    <section className={styles.section} aria-labelledby="tab-payments-label">
      <h2 id="tab-payments-label" className={styles.sectionTitle}>Оплата</h2>
      {err && <div className={styles.serverError} role="alert">{err}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Збережені картки</h3>
            {cards.length===0 ? <p className={styles.cardText}>Немає збережених карт.</p> : (
              <ul className={styles.list}>
                {cards.map(c=>(
                  <li key={c.id} className={styles.listItem}>
                    {c.brand || 'Card'} •••• {c.last4} <span className={styles.smallNote}>{c.exp ? `до ${c.exp}` : ''}</span>
                    <button type="button" className={styles.btnSmall} style={{marginLeft:8}} onClick={()=>removeCard(c.id)}>Видалити</button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/checkout/payment-methods" className={styles.btnPrimary}>Додати картку</Link>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Рахунки та чеки</h3>
            {invoices.length===0 ? <p className={styles.cardText}>Поки що немає документів.</p> : (
              <ul className={styles.list}>
                {invoices.map(i=>(
                  <li key={i.id} className={styles.listItem}>
                    {i.id} {i.date ? `від ${i.date}`:''} {typeof i.sum==='number'? `— ₴${i.sum}`:''}
                    {i.url && <a className={styles.btnSmall} href={i.url} download style={{marginLeft:8}}>Завантажити PDF</a>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};

const ShippingTab = () => {
  const [addresses,setAddresses]=useState([]); const [branches,setBranches]=useState([]); const [recipients,setRecipients]=useState([]);
  const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const [r1,r2,r3]=await Promise.all([
          fetch('/api/shipping/addresses',{credentials:'include'}),       // [Непідтверджено]
          fetch('/api/shipping/branches',{credentials:'include'}),        // [Непідтверджено]
          fetch('/api/shipping/recipients',{credentials:'include'}),      // [Непідтверджено]
        ]);
        if(!r1.ok) throw new Error(await readError(r1));
        if(!r2.ok) throw new Error(await readError(r2));
        if(!r3.ok) throw new Error(await readError(r3));
        setAddresses((await r1.json())?.items||[]);
        setBranches((await r2.json())?.items||[]);
        setRecipients((await r3.json())?.items||[]);
      }catch(e){ setErr(e.message||'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  },[]);
  return (
    <section className={styles.section} aria-labelledby="tab-shipping-label">
      <h2 id="tab-shipping-label" className={styles.sectionTitle}>Доставка</h2>
      {err && <div className={styles.serverError} role="alert">{err}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Адреси</h3>
            {addresses.length===0 ? <p className={styles.cardText}>Адреси не додані.</p> : (
              <ul className={styles.list}>
                {addresses.map(a=>(
                  <li key={a.id} className={styles.listItem}><strong>{a.label||'Адреса'}:</strong> {a.line}</li>
                ))}
              </ul>
            )}
            <Link to="/profile/addresses" className={styles.btnPrimary}>Керувати адресами</Link>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Обрані відділення</h3>
            {branches.length===0 ? <p className={styles.cardText}>Відділення не додані.</p> : (
              <ul className={styles.list}>{branches.map(b=>(
                <li key={b.id} className={styles.listItem}>{b.city}, {b.branch}</li>
              ))}</ul>
            )}
            <Link to="/profile/branches" className={styles.btnPrimary}>Додати відділення</Link>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Отримувачі</h3>
            {recipients.length===0 ? <p className={styles.cardText}>Немає отримувачів.</p> : (
              <ul className={styles.list}>{recipients.map(r=>(
                <li key={r.id} className={styles.listItem}>{r.name} — {r.phone}</li>
              ))}</ul>
            )}
            <Link to="/profile/recipients" className={styles.btnPrimary}>Додати отримувача</Link>
          </div>
        </>
      )}
    </section>
  );
};

const ReturnsTab = () => {
  const [orderId, setOrderId] = useState(''); const [reason, setReason] = useState('');
  const [files, setFiles] = useState([]); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [list,setList]=useState([]); const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const res = await fetch('/api/returns', { credentials:'include' }); // [Непідтверджено]
        if(!res.ok) throw new Error(await readError(res));
        const j = await res.json(); setList(j?.items||[]);
      }catch(e){ setErr(e.message||'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  },[]);

  const submitReturn = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try{
      const fd = new FormData();
      fd.append('orderId', orderId); fd.append('reason', reason);
      [...files].forEach(f=>fd.append('photos', f));
      const res = await fetch('/api/returns', { method:'POST', credentials:'include', body: fd }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setMsg('Заявку подано'); setOrderId(''); setReason(''); setFiles([]);
    }catch(e){ setErr(e.message || 'Не вдалося подати заявку'); }
  };

  return (
    <section className={styles.section} aria-labelledby="tab-returns-label">
      <h2 id="tab-returns-label" className={styles.sectionTitle}>Повернення і гарантія</h2>

      {(msg || err) && (
        <div className={err ? styles.serverError : styles.serverOk} role={err ? 'alert' : 'status'} aria-live="polite">
          {err || msg}
        </div>
      )}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Подати заявку</h3>
        <form onSubmit={submitReturn} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="ret-order">Номер замовлення</label>
            <input id="ret-order" className={styles.input} value={orderId} onChange={(e)=>setOrderId(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="ret-reason">Причина</label>
            <textarea id="ret-reason" className={styles.input} rows={3} value={reason} onChange={(e)=>setReason(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="ret-files">Фото</label>
            <input id="ret-files" type="file" multiple onChange={(e)=>setFiles(e.target.files)} />
          </div>
          <button type="submit" className={styles.btnPrimary}>Надіслати</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Статуси заяв</h3>
        {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
          list.length===0 ? <p className={styles.cardText}>Немає заяв.</p> : (
            <ul className={styles.list}>
              {list.map(r=>(
                <li key={r.id} className={styles.listItem}>{r.id}: {r.order} — {r.status}</li>
              ))}
            </ul>
          )
        )}
      </div>
    </section>
  );
};

const FavoritesTab = () => {
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const res = await fetch('/api/favorites', { credentials:'include' }); // [Непідтверджено]
        if(!res.ok) throw new Error(await readError(res));
        const j = await res.json(); setItems(j?.items||[]);
      }catch(e){ setErr(e.message||'Не вдалося завантажити обране'); }
      finally{ setLoading(false); }
    })();
  },[]);
  const remove = async(id)=>{
    try{
      const res = await fetch(`/api/favorites/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setItems(x=>x.filter(i=>i.id!==id));
    }catch{/* тихо */}
  };
  const setPref = async(id, body)=>{
    try{
      await fetch(`/api/favorites/${encodeURIComponent(id)}/prefs`, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); // [Непідтверджено]
    }catch{/* тихо */}
  };

  return (
    <section className={styles.section} aria-labelledby="tab-favorites-label">
      <h2 id="tab-favorites-label" className={styles.sectionTitle}>Обране</h2>
      {err && <div className={styles.serverError} role="alert">{err}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : items.length===0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Список порожній</div>
          <Link to="/catalog" className={styles.btnPrimary}>До каталогу</Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map(i=>(
            <li key={i.id} className={styles.listItem}>
              <Link to={`/product/${i.id}`} className={styles.inlineLink}>{i.name}</Link>
              {typeof i.price==='number' && <> — ₴{i.price}</>}
              <label style={{marginLeft:12}}>
                <input type="checkbox" checked={!!i.notifyStock} onChange={(e)=>setPref(i.id,{notifyStock:e.target.checked})} /> Сповіщати про наявність
              </label>
              <label style={{marginLeft:12}}>
                <input type="checkbox" checked={!!i.notifyPrice} onChange={(e)=>setPref(i.id,{notifyPrice:e.target.checked})} /> Про зміну ціни
              </label>
              <button className={styles.btnSmall} style={{marginLeft:12}} onClick={()=>remove(i.id)}>Видалити</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const NotificationsTab = () => {
  const [channels,setChannels]=useState(null);
  const [events,setEvents]=useState(null);
  const [loading,setLoading]=useState(true); const [msg,setMsg]=useState(''); const [err,setErr]=useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const res = await fetch('/api/notifications/prefs', { credentials:'include' }); // [Непідтверджено]
        if(!res.ok) throw new Error(await readError(res));
        const j = await res.json();
        setChannels(j?.channels||{email:true}); setEvents(j?.events||{});
      }catch(e){ setErr(e.message||'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  },[]);
  const save = async () => {
    setMsg(''); setErr('');
    try{
      const res = await fetch('/api/notifications/prefs', {
        method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ channels, events }),
      }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setMsg('Налаштування збережено');
    }catch(e){ setErr(e.message||'Не вдалося зберегти'); }
  };

  return (
    <section className={styles.section} aria-labelledby="tab-notifications-label">
      <h2 id="tab-notifications-label" className={styles.sectionTitle}>Сповіщення</h2>
      {(msg || err) && <div className={err?styles.serverError:styles.serverOk} role={err?'alert':'status'} aria-live="polite">{err||msg}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Канали</h3>
            <label><input type="checkbox" checked={!!channels?.email} onChange={(e)=>setChannels(v=>({...v,email:e.target.checked}))} /> Email</label><br/>
            <label><input type="checkbox" checked={!!channels?.telegram} onChange={(e)=>setChannels(v=>({...v,telegram:e.target.checked}))} /> Telegram</label><br/>
            <label><input type="checkbox" checked={!!channels?.viber} onChange={(e)=>setChannels(v=>({...v,viber:e.target.checked}))} /> Viber</label>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Події</h3>
            {Object.keys(events||{}).length===0 ? <p className={styles.cardText}>Події не налаштовані.</p> : (
              Object.entries(events).map(([k,v])=>(
                <label key={k} style={{display:'block'}}>
                  <input type="checkbox" checked={v} onChange={(e)=>setEvents(s=>({...s,[k]:e.target.checked}))} /> {k}
                </label>
              ))
            )}
            <button className={styles.btnPrimary} type="button" onClick={save} style={{marginTop:8}}>Зберегти</button>
          </div>
        </>
      )}
    </section>
  );
};

const SupportTab = () => {
  const [orderId, setOrderId] = useState(''); const [text, setText] = useState(''); const [files, setFiles] = useState([]);
  const [tickets,setTickets]=useState([]); const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const res = await fetch('/api/support/tickets?limit=10', { credentials:'include' }); // [Непідтверджено]
        if(res.ok){ const j = await res.json(); setTickets(j?.items||[]); }
      }finally{ setLoading(false); }
    })();
  },[]);

  const openTicket = async (e) => {
    e.preventDefault();
    const fd = new FormData(); fd.append('orderId', orderId); fd.append('message', text); [...files].forEach(f=>fd.append('attachments', f));
    try{
      const res = await fetch('/api/support/tickets', { method:'POST', credentials:'include', body: fd }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setOrderId(''); setText(''); setFiles([]); // оптимістично
    }catch{/* тихо */}
  };

  return (
    <section className={styles.section} aria-labelledby="tab-support-label">
      <h2 id="tab-support-label" className={styles.sectionTitle}>Підтримка</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Створити тикет</h3>
        <form onSubmit={openTicket} noValidate>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="sup-order">Номер замовлення</label>
            <input id="sup-order" className={styles.input} value={orderId} onChange={(e)=>setOrderId(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="sup-msg">Повідомлення</label>
            <textarea id="sup-msg" className={styles.input} rows={3} value={text} onChange={(e)=>setText(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="sup-files">Вкладення</label>
            <input id="sup-files" type="file" multiple onChange={(e)=>setFiles(e.target.files)} />
          </div>
          <button type="submit" className={styles.btnPrimary}>Надіслати</button>
        </form>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Останні звернення</h3>
        {loading ? <div className={styles.skeletonMain} aria-hidden /> : tickets.length===0 ? (
          <p className={styles.cardText}>Поки що звернень немає.</p>
        ) : (
          <ul className={styles.list}>
            {tickets.map(t=>(
              <li key={t.id} className={styles.listItem}>
                #{t.id} — {t.subject || 'без теми'} <span className={styles.smallNote}>{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const CouponsTab = () => {
  const [code, setCode] = useState(''); const [balance,setBalance]=useState(null); const [history,setHistory]=useState([]);
  const [loading,setLoading]=useState(true); const [msg,setMsg]=useState(''); const [err,setErr]=useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const [rb, rh] = await Promise.all([
          fetch('/api/coupons/balance',{credentials:'include'}),   // [Непідтверджено]
          fetch('/api/coupons/history?limit=50',{credentials:'include'}), // [Непідтверджено]
        ]);
        if(!rb.ok) throw new Error(await readError(rb));
        if(!rh.ok) throw new Error(await readError(rh));
        setBalance(await rb.json()); const jh = await rh.json(); setHistory(jh?.items||[]);
      }catch(e){ setErr(e.message||'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  },[]);
  const applyCode = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try{
      const res = await fetch('/api/coupons/apply', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
      setMsg('Промокод застосовано'); setCode('');
    }catch(e){ setErr(e.message||'Не вдалося застосувати код'); }
  };

  return (
    <section className={styles.section} aria-labelledby="tab-coupons-label">
      <h2 id="tab-coupons-label" className={styles.sectionTitle}>Купони та бали</h2>
      {(msg || err) && <div className={err?styles.serverError:styles.serverOk} role={err?'alert':'status'} aria-live="polite">{err||msg}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Баланс</h3>
            <p className={styles.cardText}>
              Бали: <strong>{balance?.points ?? 0}</strong>, Купони: <strong>{balance?.coupons ?? 0}</strong>
            </p>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Ввести промокод</h3>
            <form onSubmit={applyCode}>
              <div className={styles.controlRow}>
                <input className={styles.input} value={code} onChange={(e)=>setCode(e.target.value)} placeholder="PROMO2025" />
                <button className={styles.btnPrimary} type="submit">Застосувати</button>
              </div>
            </form>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Історія</h3>
            {history.length===0 ? <p className={styles.cardText}>Операцій ще не було.</p> : (
              <ul className={styles.list}>
                {history.map(h=>(
                  <li key={h.id} className={styles.listItem}>
                    {h.date}: {h.delta>0? `+${h.delta}`: h.delta} — {h.comment}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};

const SecurityTab = () => {
  const [sessions,setSessions]=useState([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  useEffect(()=>{
    (async()=>{
      setLoading(true); setErr('');
      try{
        const res = await fetch('/api/auth/sessions', { credentials:'include' }); // [Непідтверджено]
        if(!res.ok) throw new Error(await readError(res));
        const j = await res.json(); setSessions(j?.items||[]);
      }catch(e){ setErr(e.message||'Помилка завантаження'); }
      finally{ setLoading(false); }
    })();
  },[]);
  const logoutAll = async () => {
    try{
      const res = await fetch('/api/auth/logout-all', { method:'POST', credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
    }catch{/* тихо */}
  };
  const exportData = () => { window.location.href = '/api/account/export'; /* [Непідтверджено] */ };
  const deleteData = async () => {
    if(!window.confirm('Видалити дані облікового запису без можливості відновлення?')) return;
    try{
      const res = await fetch('/api/account/delete', { method:'POST', credentials:'include' }); // [Непідтверджено]
      if(!res.ok) throw new Error(await readError(res));
    }catch{/* тихо */}
  };

  return (
    <section className={styles.section} aria-labelledby="tab-security-label">
      <h2 id="tab-security-label" className={styles.sectionTitle}>Безпека</h2>
      {err && <div className={styles.serverError} role="alert">{err}</div>}
      {loading ? <div className={styles.skeletonMain} aria-hidden /> : (
        <>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Активні сесії</h3>
            {sessions.length===0 ? <p className={styles.cardText}>Сесій не знайдено.</p> : (
              <ul className={styles.list}>
                {sessions.map(s=>(
                  <li key={s.id} className={styles.listItem}>
                    {s.device || s.ua || 'Пристрій'} — {s.ip || '—'} <span className={styles.smallNote}>ост. активність: {s.last || s.lastSeen}</span> {s.current && <em>(поточна)</em>}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className={styles.btnPrimary} onClick={logoutAll}>Вийти на всіх пристроях</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Експорт та видалення</h3>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.btnPrimary} onClick={exportData}>Експортувати дані</button>
              <button type="button" className={styles.btnSmall} onClick={deleteData}>Видалити дані</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

/* ---------- Page ---------- */

const ProfilePage = () => {
  const [tab, setTab] = useState(getInitialTab);
  const { user, loading, signout } = useAuth();
  const navigate = useNavigate();
  const headingRef = useRef(null);

  useEffect(()=>{ if (typeof window!=='undefined') window.history.replaceState(null,'',`#${tab}`); },[tab]);
  useEffect(()=>{ headingRef.current?.focus?.(); },[tab]);

  const displayName = user?.name || 'Користувач';
  const firstLetter = useMemo(()=>displayName?.trim()?.[0]?.toUpperCase() || '🙂',[displayName]);

  const handleLogout = async () => { await signout(); navigate('/', { replace: true }); };

  const onTabsKey = (e)=>{
    const idx = TABS.indexOf(tab);
    if(e.key==='ArrowDown' || e.key==='ArrowRight'){ e.preventDefault(); setTab(TABS[(idx+1)%TABS.length]); }
    if(e.key==='ArrowUp' || e.key==='ArrowLeft'){ e.preventDefault(); setTab(TABS[(idx-1+TABS.length)%TABS.length]); }
    if(e.key==='Home'){ e.preventDefault(); setTab(TABS[0]); }
    if(e.key==='End'){ e.preventDefault(); setTab(TABS[TABS.length-1]); }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Особистий кабінет</h1>
          <div className={styles.smallNote}>Завантаження…</div>
        </div>
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonMain} />
        </div>
      </div>
    );
  }

  if (!user) {
    // Если пользователь не вошел, показываем полноценную страницу входа
    return <LoginPage />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title} tabIndex={-1} ref={headingRef}>Особистий кабінет</h1>
        <div className={styles.smallNote}>Ласкаво просимо, <strong>{displayName.split(' ')[0]}</strong></div>
      </div>

      <div className={styles.grid}>
        <aside className={styles.sidebar} aria-labelledby="account-nav-label">
          <div className={styles.userCard}>
            <div className={styles.avatar} aria-hidden>{firstLetter}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <nav className={styles.menu} aria-label="Панель навігації" role="tablist" onKeyDown={onTabsKey}>
            {TABS.map(key=>(
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`tab-${key}`}
                onClick={() => setTab(key)}
                className={`${styles.menuItem} ${tab === key ? styles.active : ''}`}
              >
                {LABELS[key]}
              </button>
            ))}

            <Link to="/" className={styles.menuItemLink}>Повернутись до магазину</Link>
            <button type="button" onClick={handleLogout} className={`${styles.menuItem} ${styles.logout}`}>Вийти</button>
          </nav>
        </aside>

        <main className={styles.main}>
          <div id="tab-overview" role="tabpanel" hidden={tab !== 'overview'} aria-labelledby="tab-overview-label"><Overview user={user} /></div>
          <div id="tab-profile" role="tabpanel" hidden={tab !== 'profile'} aria-labelledby="tab-profile-label"><ProfileTab user={user} /></div>
          <div id="tab-orders" role="tabpanel" hidden={tab !== 'orders'} aria-labelledby="tab-orders-label"><OrdersTab /></div>
          <div id="tab-payments" role="tabpanel" hidden={tab !== 'payments'} aria-labelledby="tab-payments-label"><PaymentsTab /></div>
          <div id="tab-shipping" role="tabpanel" hidden={tab !== 'shipping'} aria-labelledby="tab-shipping-label"><ShippingTab /></div>
          <div id="tab-returns" role="tabpanel" hidden={tab !== 'returns'} aria-labelledby="tab-returns-label"><ReturnsTab /></div>
          <div id="tab-favorites" role="tabpanel" hidden={tab !== 'favorites'} aria-labelledby="tab-favorites-label"><FavoritesTab /></div>
          <div id="tab-notifications" role="tabpanel" hidden={tab !== 'notifications'} aria-labelledby="tab-notifications-label"><NotificationsTab /></div>
          <div id="tab-support" role="tabpanel" hidden={tab !== 'support'} aria-labelledby="tab-support-label"><SupportTab /></div>
          <div id="tab-coupons" role="tabpanel" hidden={tab !== 'coupons'} aria-labelledby="tab-coupons-label"><CouponsTab /></div>
          <div id="tab-security" role="tabpanel" hidden={tab !== 'security'} aria-labelledby="tab-security-label"><SecurityTab /></div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
