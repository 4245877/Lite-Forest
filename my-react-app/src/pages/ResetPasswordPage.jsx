// src/pages/ResetPasswordPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ResetPasswordPage.module.css';

async function readError(res){
  try{ const j = await res.json(); return j?.message || res.statusText || 'Помилка запиту'; }
  catch{ return res.statusText || 'Помилка запиту'; }
}

function strengthScore(p){
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p)) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\s]/.test(p)) s++;
  return Math.min(s, 5);
}

const ResetPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [left, setLeft] = useState(0);

  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [caps1, setCaps1] = useState(false);
  const [caps2, setCaps2] = useState(false);

  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const emailRef = useRef(null);
  const codeRef  = useRef(null);
  const pwdRef   = useRef(null);
  const navigate = useNavigate();

  const emailValid = !!email && /\S+@\S+\.\S+/.test(email);
  const codeValid  = /^\d{6}$/.test(code);
  const pwdScore   = strengthScore(pwd);
  const pwdMatch   = pwd && pwd2 && pwd === pwd2;
  const canSubmit  = codeValid && pwd.length >= 8 && pwdMatch;

  useEffect(()=>{ if(!codeSent) emailRef.current?.focus(); }, [codeSent]);
  useEffect(()=>{ if(codeSent)  codeRef.current?.focus();  }, [codeSent]);

  useEffect(()=>{
    if(!codeSent) return;
    if(left <= 0) return;
    const t = setTimeout(()=>setLeft(v=>v-1), 1000);
    return ()=>clearTimeout(t);
  }, [codeSent, left]);

  const sendCode = async () => {
    if (!emailValid) { setErr('Введи коректний email'); return; }
    setErr(''); setOk(''); setSending(true);
    try{
      const res = await fetch('/api/auth/password/send-code', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ email })
      });
      if(!res.ok) throw new Error(await readError(res));
      setCode(''); setCodeSent(true); setLeft(60);
      setOk('Код надіслано на пошту. Перевір також «Спам».');
    }catch(e){ setErr(e.message || 'Не вдалося надіслати код'); }
    finally{ setSending(false); }
  };

  const resend = async () => {
    if (left > 0 || resending) return;
    setResending(true); setErr(''); setOk('');
    try{
      const res = await fetch('/api/auth/password/send-code', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ email })
      });
      if(!res.ok) throw new Error(await readError(res));
      setLeft(60);
      setOk('Код відправлено повторно.');
      codeRef.current?.focus();
    }catch(e){ setErr(e.message || 'Не вдалося надіслати код повторно'); }
    finally{ setResending(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (!codeValid) { setErr('Введи 6 цифр коду'); return; }
    if (pwd.length < 8) { setErr('Пароль має бути не менше 8 символів'); return; }
    if (!pwdMatch) { setErr('Паролі не співпадають'); return; }
    setErr(''); setOk('');
    try{
      const res = await fetch('/api/auth/password/confirm', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ email, code, newPassword: pwd })
      });
      if(!res.ok) throw new Error(await readError(res));
      setOk('Пароль змінено. Зараз відбудеться вхід.');
      setTimeout(()=>navigate('/login', {replace:true}), 1200);
    }catch(e){ setErr(e.message || 'Помилка скидання пароля'); }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.formPanel}>
        <div className={styles.formContainer} role="form" aria-labelledby="rp-title">
          <h2 id="rp-title" className={styles.formTitle}>Скидання пароля</h2>

          {(err || ok) && (
            <div
              className={err ? styles.serverError : styles.serverOk}
              role={err ? 'alert' : 'status'}
              aria-live={err ? 'assertive' : 'polite'}
            >
              {err || ok}
            </div>
          )}

          {!codeSent ? (
            <form onSubmit={(e)=>{ e.preventDefault(); sendCode(); }} noValidate>
              <div className={styles.inputGroup}>
                <label htmlFor="reset-email" className={styles.inputLabel}>Email</label>
                <input
                  id="reset-email"
                  ref={emailRef}
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e)=>setEmail(e.target.value.trim())}
                  autoComplete="email"
                  required
                  aria-invalid={email ? !emailValid : undefined}
                  aria-describedby="email-hint"
                />
                <div id="email-hint" className={styles.helper}>
                  Ми надішлемо 6-значний код на цей email.
                </div>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={!emailValid || sending}
                aria-busy={sending ? 'true' : undefined}
              >
                {sending ? 'Надсилаємо…' : 'Надіслати код'}
              </button>

              <div className={styles.footerLinks}>
                <Link to="/login" className={styles.inlineLink}>Повернутися до входу</Link>
              </div>
            </form>
          ) : (
            <form onSubmit={reset} noValidate>
              <div className={styles.inputGroup}>
                <label htmlFor="reset-code" className={styles.inputLabel}>Код з email</label>
                <input
                  id="reset-code"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  className={styles.input}
                  value={code}
                  onChange={(e)=>setCode(e.target.value.replace(/\D/g,''))}
                  required
                  aria-invalid={code ? !codeValid : undefined}
                  aria-describedby="code-hint"
                />
                <div id="code-hint" className={styles.helper}>
                  Введи 6 цифр. {left>0 ? `Повторна відправка через ${left}s` : (
                    <button
                      type="button"
                      onClick={resend}
                      className={styles.inlineLinkButton}
                      disabled={resending}
                      aria-busy={resending ? 'true' : undefined}
                    >
                      Відправити код ще раз
                    </button>
                  )}
                </div>
                <div className={styles.helperSmall}>
                  <button type="button" className={styles.inlineLinkButton} onClick={()=>{ setCodeSent(false); setOk('Зміни email і відправ ще раз.'); }}>
                    Змінити email
                  </button>
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="reset-pwd" className={styles.inputLabel}>Новий пароль</label>
                <div className={styles.controlRow}>
                  <input
                    id="reset-pwd"
                    ref={pwdRef}
                    type={showPwd ? 'text' : 'password'}
                    className={styles.input}
                    value={pwd}
                    onChange={(e)=>setPwd(e.target.value)}
                    onKeyUp={(e)=>setCaps1(e.getModifierState && e.getModifierState('CapsLock'))}
                    autoComplete="new-password"
                    required
                    aria-describedby="pwd-hint pwd-meter"
                  />
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    aria-pressed={showPwd}
                    onClick={()=>setShowPwd(v=>!v)}
                  >
                    {showPwd ? 'Сховати' : 'Показати'}
                  </button>
                </div>
                {caps1 && <div className={styles.capsHint}>Увімкнено Caps Lock</div>}

                <div id="pwd-meter" className={styles.passwordMeter} role="progressbar"
                     aria-valuemin={0} aria-valuemax={5} aria-valuenow={pwdScore}>
                  <div className={styles.passwordMeterBar} style={{width: `${(pwdScore/5)*100}%`}} />
                </div>
                <ul id="pwd-hint" className={styles.hintList}>
                  <li>Мінімум 8 символів</li>
                  <li>Рекомендовано: великі/малі літери, цифри, символи</li>
                </ul>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="reset-pwd2" className={styles.inputLabel}>Підтвердження пароля</label>
                <div className={styles.controlRow}>
                  <input
                    id="reset-pwd2"
                    type={showPwd2 ? 'text' : 'password'}
                    className={styles.input}
                    value={pwd2}
                    onChange={(e)=>setPwd2(e.target.value)}
                    onKeyUp={(e)=>setCaps2(e.getModifierState && e.getModifierState('CapsLock'))}
                    autoComplete="new-password"
                    required
                    aria-invalid={pwd2 ? !pwdMatch : undefined}
                  />
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    aria-pressed={showPwd2}
                    onClick={()=>setShowPwd2(v=>!v)}
                  >
                    {showPwd2 ? 'Сховати' : 'Показати'}
                  </button>
                </div>
                {caps2 && <div className={styles.capsHint}>Увімкнено Caps Lock</div>}
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={!canSubmit}
              >
                Змінити пароль
              </button>

              <div className={styles.footerLinks}>
                <Link to="/login" className={styles.inlineLink}>Повернутися до входу</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
