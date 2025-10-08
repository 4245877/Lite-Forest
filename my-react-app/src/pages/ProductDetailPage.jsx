// src/pages/ProductDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import './ProductDetailPage.css';
import { assetUrl } from '../utils/assetUrl';

// ——— Error Boundary to avoid blank page on runtime errors ———
class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error){
    return { hasError: true, error };
  }
  componentDidCatch(error, info){
    // eslint-disable-next-line no-console
    console.error('ProductDetailPage error:', error, info);
  }
  render(){
    if (this.state.hasError){
      return (
        <div className="container">
          <p className="error">Щось пішло не так на сторінці товару.</p>
          <pre style={{whiteSpace:'pre-wrap', background:'#fff5f5', padding:12, borderRadius:8}}>{this.state.error?.stack || String(this.state.error)}</pre>
          <button onClick={() => this.setState({hasError:false, error:null})}>Спробувати ще раз</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ——— helpers ———
const uaNumber = (n, opts = {}) => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0, ...opts }).format(n);
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const isRecord = (v) => v && typeof v === 'object' && !Array.isArray(v);

function ProductDetailPageInner() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState(null);

  // media state
  const [mainImage, setMainImage] = useState(null);
  const [activeMediaTab, setActiveMediaTab] = useState('photos'); // photos | video | 3d

  // purchase state
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});

  // simple selectors for ready-to-buy (radio)
  const colorOptionsFromProduct = Array.isArray(product?.colors) && product.colors.length
    ? product.colors
    : ['Чорний', 'Білий', 'Сірий', 'Червоний', 'Синій', 'Зелений'];
  const materialOptions = ['PLA', 'PETG', 'TPU', 'TPE', 'TPC/Нейлон', 'ASA'];

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedFilament, setSelectedFilament] = useState(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setErr(null);

    api.getProduct(id)
      .then((p) => {
        if (!alive) return;

        const normalize = (u) => assetUrl(u);
        const pick = (...vals) => vals.find(v => v != null && String(v).trim() !== '');

        const imageUrlAbs = assetUrl(p.image_url);

        // ——— кандидатные базовые директории
        const baseFromMain = (() => {
          try {
            const u = new URL(imageUrlAbs, window.location.origin);
            return `${u.origin}${u.pathname.replace(/\/[^/]*$/, '/')}`; // папка главного фото
          } catch {
            return '';
          }
        })();
        const sku = p.slug || p.sku || '';
        const baseFromSkuImages  = sku ? assetUrl(`/uploads/products/${sku}/images/`)  : '';
        const baseFromSkuGallery = sku ? assetUrl(`/uploads/products/${sku}/gallery/`) : '';
        const bases = [baseFromMain, baseFromSkuImages, baseFromSkuGallery].filter(Boolean);

        // ——— склейка имени файла с первоуспешной базой (без сетевого пробы — просто первый кандидат)
        const joinBase = (raw) => {
          if (!raw) return '';
          const s = String(raw).trim();
          if (/^([a-z][a-z0-9+.\-]*:|\/\/|\/)/i.test(s)) return assetUrl(s); // уже абсолютный/корневой
          const b = bases[0] || '';
          return assetUrl(`${String(b).replace(/\/+$/,'')}/${s.replace(/^\/+/, '')}`);
        };

        // ---------- REPLACED BLOCK (images / files / videos / main) ----------
        const imgs = Array.isArray(p.images)
          ? p.images.filter(Boolean).map((im) => {
              // Поддержка string и object
              if (typeof im === 'string') {
                const u = assetUrl(im);
                return { url: u, thumb_url: u, role: 'gallery' };
              }
              const rawMain  = im.url ?? im.href ?? im.path ?? im.src ?? im.image_url ?? im.key ?? im.filename ?? im.name;
              const rawThumb = im.thumb_url ?? im.thumb ?? im.preview ?? im.small ?? im.thumbnail ?? rawMain;
              const main = joinBase(rawMain);
              const thumb = joinBase(rawThumb);
              return main ? { ...im, url: main, thumb_url: thumb || main } : null;
            }).filter(Boolean)
          : [];

        // Файлы/відео как было
        const files = Array.isArray(p.files)
          ? p.files.map(f => {
              const raw = pick(f.url, f.path, f.src, f.filename, f.name);
              return { ...f, url: joinBase(raw) };
            })
          : [];

        const videos = Array.isArray(p.videos)
          ? p.videos.map(v => {
              const raw = pick(v.url, v.path, v.src);
              return { ...v, url: joinBase(raw) };
            })
          : (p.video_url ? [{ url: normalize(p.video_url) }] : []);

        const image_url = imageUrlAbs;

        // Фолбек: если нет галереи, но есть главное фото — добавим его как первый элемент
        const imagesNormalized = imgs.length ? imgs
          : (image_url ? [{ url: image_url, thumb_url: image_url, role: 'primary' }] : []);

        setProduct({ ...p, images: imagesNormalized, files, videos, image_url });

        // Выставляем обложку: приоритет primary → первый из галереи → image_url
        const primary = imagesNormalized.find(g => g && g.role === 'primary') ?? imagesNormalized[0] ?? null;
        setMainImage(primary?.url ?? image_url ?? null);
        // ---------- END REPLACED BLOCK ----------

        // seed option selection from variants
        const firstVariant = Array.isArray(p.variants) && p.variants.length ? p.variants[0] : null;
        const init = firstVariant?.options ? { ...firstVariant.options } : {};
        setSelectedOptions(init);

        document.title = `${p.name ?? p.sku ?? 'Товар'} — Lite Forest`;
      })
      .catch((e) => alive && setErr(e.message || 'Не вдалося завантажити товар'))
      .finally(() => alive && setIsLoading(false));

    return () => { alive = false; };
  }, [id]);

  // ——— derived data (NO hooks to avoid hook-order issues) ———
  const gallery = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  // Переименовано, чтобы не перекрывать videos из нормализации
  const videosView = Array.isArray(product?.videos) ? product.videos : (product?.video_url ? [{ url: product.video_url }] : []);
  const models3d = Array.isArray(product?.files) ? product.files.filter(f => ['model3d', '3d', 'gltf', 'glb'].includes(String(f.role).toLowerCase())) : [];
  const has3d = models3d.length > 0 && models3d.some(m => /(gltf|glb)$/i.test(m.url || ''));

  // Load <model-viewer> script once when 3D is present
  useEffect(() => {
    if (!has3d) return;
    if (document.querySelector('script[src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"]')) return;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    s.async = true;
    document.body.appendChild(s);
    return () => { /* keep script */ };
  }, [has3d]);

  // variants
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const optionKeys = (() => {
    const keys = new Set();
    variants.forEach(v => Object.keys(v.options || {}).forEach(k => keys.add(k)));
    return Array.from(keys);
  })();
  const optionValues = (() => {
    const map = {};
    optionKeys.forEach(k => { map[k] = new Set(); });
    variants.forEach(v => {
      optionKeys.forEach(k => {
        const val = v.options?.[k];
        if (val != null) map[k].add(String(val));
      });
    });
    const out = {};
    optionKeys.forEach(k => { out[k] = Array.from(map[k]); });
    return out;
  })();
  const activeVariant = (() => {
    if (!variants.length) return null;
    const exact = variants.find(v => {
      const opts = v.options || {};
      return optionKeys.every(k => selectedOptions[k] ? String(opts[k]) === String(selectedOptions[k]) : true);
    });
    return exact || variants[0];
  })();

  const basePrice = Number(product?.price ?? 0);
  const price = Number(activeVariant?.price ?? basePrice);
  const pricesRange = (() => {
    if (!variants.length) return null;
    const prices = variants.map(v => Number(v.price ?? basePrice)).filter(n => !Number.isNaN(n));
    if (!prices.length) return null;
    const min = Math.min(...prices), max = Math.max(...prices);
    return { min, max };
  })();

  const stock = activeVariant?.stock ?? product?.stock;
  const leadDays = activeVariant?.lead_time_days ?? product?.lead_time_days;
  const availability = (Number(stock) > 0) ? 'in-stock' : (leadDays ? 'made-to-order' : 'out-of-stock');

  // choose cover (always through assetUrl with fallback)
  const cover = assetUrl(
    mainImage
    ?? gallery[0]?.url
    ?? gallery[0]?.thumb_url
    ?? product?.image_url
    ?? '/placeholder-product.png'
  );

  if (isLoading) return <div className="container"><p>Завантаження товару…</p></div>;
  if (err) return (
    <div className="container">
      <p className="error">Помилка: {err}</p>
      <button onClick={() => navigate(-1)}>Назад</button>
    </div>
  );
  if (!product) return <div className="container"><p>Товар не знайдено.</p></div>;

  // ——— cart actions (stubs) ———
  const activeColor = selectedColor ?? (colorOptionsFromProduct[0] ?? '');
  const activeFilament = selectedFilament ?? materialOptions[0];

  function addToCart() {
    const extra =
      [activeColor ? `Колір: ${activeColor}` : null, activeFilament ? `Матеріал: ${activeFilament}` : null]
        .filter(Boolean)
        .join(' • ');
    alert(`Додано до кошика: ${product.name || product.sku} × ${qty}${extra ? `\n${extra}` : ''}`);
  }
  function buyNow() { addToCart(); }
  function updateOption(k, v) { setSelectedOptions((s) => ({ ...s, [k]: v })); }

  function QtyInput() {
    return (
      <div className="qty">
        <button aria-label="-" onClick={() => setQty(q => clamp(q - 1, 1, 999))}>−</button>
        <input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(clamp(Number(e.target.value) || 1, 1, 999))} />
        <button aria-label="+" onClick={() => setQty(q => clamp(q + 1, 1, 9999))}>+</button>
      </div>
    );
  }

  const breadcrumbs = (() => {
    const bc = Array.isArray(product?.breadcrumbs) ? product.breadcrumbs : [];
    if (bc.length) return bc; // [{name, url}]
    if (product?.category_path && Array.isArray(product.category_path)) {
      return product.category_path.map((c, i) => ({ name: c.name || c.slug, url: `/catalog/${product.category_path.slice(0, i+1).map(x=>x.slug || x.id).join('/')}` }));
    }
    if (product?.category) return [{ name: product.category, url: `/catalog/${encodeURIComponent(product.category)}` }];
    return [];
  })();

  // aggregate rating
  const rating = product?.rating?.avg ?? product?.rating ?? null;
  const ratingCount = product?.rating?.count ?? product?.reviews_count ?? null;

  // digital file & license
  const digitalFile = (product?.files || []).find(f => ['digital', 'stl', 'file', 'download'].includes(String(f.role).toLowerCase()));
  const rawLicense = product?.license || (product?.files || []).find(f => String(f.role).toLowerCase() === 'license');
  const licenseInfo = isRecord(rawLicense) ? rawLicense : null;
  const licenseText = !licenseInfo && rawLicense ? String(rawLicense) : null;

  // print settings (materials map)
  const rawPrintSettings = product?.print_settings || product?.printing_params || null;
  const printSettings = isRecord(rawPrintSettings) ? rawPrintSettings : null; // { PLA: {...}, PETG: {...} }
  const printSettingsNote = !printSettings && rawPrintSettings ? String(rawPrintSettings) : null;

  // specs convenience
  const dims = isRecord(product?.dimensions) ? product.dimensions : (isRecord(product?.size) ? product.size : null);
  const weight = product?.weight_g ?? product?.weight;

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name ?? product.sku,
    sku: product.sku,
    image: gallery.map(g => assetUrl(g?.url)).filter(Boolean).slice(0, 10),
    description: product.short_description || product.description,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    aggregateRating: rating ? { '@type': 'AggregateRating', ratingValue: String(rating), reviewCount: String(ratingCount || 1) } : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'UAH',
      price: String(price || basePrice || 0),
      availability: availability === 'in-stock' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      url: (typeof window !== 'undefined' ? window.location.href : '')
    }
  };

  return (
    <div className="product-detail container">
      {/* ——— Breadcrumbs ——— */}
      <nav className="breadcrumbs" aria-label="Хлібні крихти">
        <Link to="/catalog">Каталог</Link>
        {breadcrumbs.map((b, i) => (
          <span key={i}>
            <span aria-hidden>›</span> <Link to={b.url}>{b.name}</Link>
          </span>
        ))}
        <span aria-hidden>›</span> <span>{product.name ?? product.sku}</span>
      </nav>

      <div className="pd-grid">
        {/* ——— MEDIA ——— */}
        <div className="pd-media">
          <div className="pd-media-tabs" role="tablist" aria-label="Медіа">
            <button className={activeMediaTab === 'photos' ? 'active' : ''} onClick={() => setActiveMediaTab('photos')}>Фото</button>
            {!!videosView.length && <button className={activeMediaTab === 'video' ? 'active' : ''} onClick={() => setActiveMediaTab('video')}>Відео</button>}
            {!!has3d && <button className={activeMediaTab === '3d' ? 'active' : ''} onClick={() => setActiveMediaTab('3d')}>3D</button>}
          </div>

          {activeMediaTab === 'photos' && (
            <>
              <div className="pd-cover">
                <img
                  src={cover}
                  alt={gallery.find(g=>g?.url===cover)?.alt || product.name || product.sku}
                  loading="eager"
                  onError={(e) => { e.currentTarget.src = '/placeholder-product.png'; }}
                />
              </div>

              {gallery.length > 1 && (
                <div className="pd-thumbs" role="list">
                  {gallery.map((im) => {
                    const t = assetUrl(im?.thumb_url ?? im?.url);
                    if (!t) return null;
                    const isActive = assetUrl(mainImage ?? cover) === assetUrl(im.url ?? im.thumb_url);
                    return (
                      <button
                        key={im.id ?? t}
                        className={`pd-thumb ${isActive ? 'active' : ''}`}
                        onClick={() => setMainImage(assetUrl(im.url ?? im.thumb_url))}
                        aria-label="Показати фото"
                        title={im.alt || 'Фото'}
                      >
                        <img
                          src={t}
                          alt={im.alt ?? 'Фото'}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = '/placeholder-product.png'; }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pd-media-notes">
                <small>Для масштабу на фото може бути монета/лінійка або рука.</small>
              </div>
            </>
          )}

          {activeMediaTab === 'video' && !!videosView.length && (
            <div className="pd-video">
              {videosView[0].url?.includes('youtube.com') || videosView[0].url?.includes('youtu.be') ? (
                <iframe
                  src={videosView[0].url.replace('watch?v=', 'embed/')}
                  title={videosView[0].title || 'Відео'}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video src={assetUrl(videosView[0].url)} controls playsInline />
              )}
            </div>
          )}

          {activeMediaTab === '3d' && has3d && (
            <div className="pd-3d">
              {(() => {
                const model = models3d.find(m => /(glb|gltf)$/i.test(m.url || ''));
                if (!model) return <p>Модель у форматі GLB/GLTF відсутня.</p>;
                return (
                  // @ts-ignore web component
                  <model-viewer
                    src={assetUrl(model.url)}
                    ar
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                    style={{ width: '100%', height: '520px', background: '#f6f6f6', borderRadius: 12 }}
                  />
                );
              })()}
            </div>
          )}
        </div>

        {/* ——— INFO ——— */}
        <div className="pd-info">
          <h1 className="pd-title">{product.name ?? product.sku}</h1>
          {product.subtitle || product.tagline ? (
            <p className="pd-subtitle">{product.subtitle || product.tagline}</p>
          ) : null}

          <div className="pd-meta-row">
            {typeof (product?.rating?.avg ?? product?.rating) === 'number' && (
              (() => {
                const rating = product?.rating?.avg ?? product?.rating ?? null;
                const ratingCount = product?.rating?.count ?? product?.reviews_count ?? null;
                return (
                  <div className="pd-rating" aria-label={`Рейтинг ${rating} з 5`} title={`Рейтинг ${rating} з 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < Math.round(rating) ? 'star filled' : 'star'}>★</span>
                    ))}
                    {ratingCount ? <span className="pd-rating-count">({ratingCount})</span> : null}
                  </div>
                );
              })()
            )}

            {product.sku && (
              <div className="pd-sku"><span className="label">SKU:</span> <code>{product.sku}</code></div>
            )}

            {product.brand && (
              <div className="pd-brand"><span className="label">Бренд:</span> <span>{product.brand}</span></div>
            )}
          </div>

          {/* ——— price ——— */}
          <div className="pd-price-block">
            {pricesRange && pricesRange.min !== pricesRange.max ? (
              <div className="pd-price-range">
                {uaNumber(pricesRange.min)}–{uaNumber(pricesRange.max)}&nbsp;₴
              </div>
            ) : (
              <div className="pd-price">{uaNumber(price)}&nbsp;₴</div>
            )}
            <div className={`pd-availability ${availability}`}>
              {availability === 'in-stock' && 'Є в наявності'}
              {availability === 'made-to-order' && `Під замовлення${leadDays ? ` • виготовлення ${leadDays} дн.` : ''}`}
              {availability === 'out-of-stock' && 'Тимчасово недоступно'}
            </div>
          </div>

          {/* ——— variants ——— */}
          {!!optionKeys.length && (
            <div className="pd-variants">
              {optionKeys.map((k) => (
                <div key={k} className="pd-variant">
                  <div className="label">{k}:</div>
                  <div className="choices" role="group" aria-label={k}>
                    {optionValues[k].map((v) => {
                      const active = String(selectedOptions[k]) === String(v);
                      return (
                        <button key={v} className={`choice ${active ? 'active' : ''}`} onClick={() => updateOption(k, v)}>{v}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ——— quantity + actions ——— */}
          <div className="pd-actions">
            <QtyInput />
            <button className="btn-primary" onClick={addToCart} disabled={availability === 'out-of-stock'}>
              Додати в кошик
            </button>
            <button className="btn-secondary" onClick={buyNow} disabled={availability === 'out-of-stock'}>
              Купити зараз
            </button>
          </div>

          {/* ——— REPLACED CONTACT WITH RADIO SELECTORS ——— */}
          <div className="pd-aux-actions">
            {/* Колір */}
            <div className="pd-variant">
              <div className="label">Колір:</div>
              <div className="choices" role="radiogroup" aria-label="Колір">
                {colorOptionsFromProduct.map((c) => (
                  <label key={c} className={`choice ${activeColor === c ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="color"
                      value={c}
                      checked={activeColor === c}
                      onChange={() => setSelectedColor(c)}
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Матеріал (філамент) */}
            <div className="pd-variant">
              <div className="label">Матеріал (філамент):</div>
              <div className="choices" role="radiогroup" aria-label="Матеріал (філамент)">
                {materialOptions.map((m) => (
                  <label key={m} className={`choice ${activeFilament === m ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="filament"
                      value={m}
                      checked={activeFilament === m}
                      onChange={() => setSelectedFilament(m)}
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </div>

            {digitalFile && (
              <a className="btn-ghost" href={assetUrl(digitalFile.url)} download>
                Завантажити цифровий файл{digitalFile.license ? ` • ${digitalFile.license}` : ''}
              </a>
            )}
          </div>

          {product.short_description && (
            <div className="pd-shortdesc">
              <p>{product.short_description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ——— STATIC SECTIONS (no collapses) ——— */}
      <section className="pd-sections">
        {/* ОПИС */}
        <div className="pd-section">
          <h2>Опис</h2>
          <div className="content">
            {product.description ? <p>{product.description}</p> : <p>Опис буде додано найближчим часом.</p>}
            {product.designer && (
              <p className="muted">Дизайн: {product.designer.name || product.designer}</p>
            )}
            {product.use_cases && Array.isArray(product.use_cases) && (
              <ul className="bullets">
                {product.use_cases.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            )}
          </div>
        </div>

        {/* ТЕХ. ХАРАКТЕРИСТИКИ */}
        <div className="pd-section">
          <h2>Технічні характеристики</h2>
          <div className="content">
            <div className="table-wrap">
              <table className="specs">
                <tbody>
                  {dims && (dims.l || dims.length) && (
                    <tr><th>Габарити (Д×Ш×В), мм</th><td>{[dims.l ?? dims.length, dims.w ?? dims.width, dims.h ?? dims.height].filter(Boolean).join(' × ')}</td></tr>
                  )}
                  {typeof weight !== 'undefined' && (
                    <tr><th>Маса виробу</th><td>{uaNumber(weight)} г</td></tr>
                  )}
                  {product.materials && (
                    <tr><th>Матеріал(и)</th><td>{Array.isArray(product.materials) ? product.materials.join(', ') : String(product.materials)}</td></tr>
                  )}
                  {product.printer_type && (<tr><th>Тип принтера</th><td>{product.printer_type}</td></tr>)}
                  {product.layer_height_mm && (<tr><th>Товщина шару</th><td>{product.layer_height_mm} мм</td></tr>)}
                  {product.infill_percent && (<tr><th>Заповнення</th><td>{product.infill_percent}% {product.infill_pattern ? `• ${product.infill_pattern}` : ''}</td></tr>)}
                  {product.tolerance_mm && (<tr><th>Точність / допуски</th><td>±{product.tolerance_mm} мм</td></tr>)}
                  {product.supports_required != null && (<tr><th>Підтримки</th><td>{product.supports_required ? 'Потрібні' : 'Не потрібні'}</td></tr>)}
                  {product.post_processing && (<tr><th>Постобробка</th><td>{product.post_processing}</td></tr>)}
                  {product.finish && (<tr><th>Покриття/фініш</th><td>{product.finish}</td></tr>)}
                  {product.colors && Array.isArray(product.colors) && (<tr><th>Кольори</th><td>{product.colors.join(', ')}</td></tr>)}
                  {product.whats_in_box && Array.isArray(product.whats_in_box) && (<tr><th>Комплектність</th><td>{product.whats_in_box.join(', ')}</td></tr>)}
                  {product.assembly && (<tr><th>Складання</th><td>{product.assembly.required ? 'Потрібне складання' : 'Не потребує складання'}{product.assembly.hardware ? ` • Потрібні кріплення: ${product.assembly.hardware.join(', ')}` : ''}</td></tr>)}
                  {product.compatibility && (<tr><th>Сумісність</th><td>{Array.isArray(product.compatibility) ? product.compatibility.join(', ') : String(product.compatibility)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* РЕКОМЕНДОВАНІ НАЛАШТУВАННЯ ДРУКУ */}
        <div className="pd-section">
          <h2>Рекомендовані параметри друку</h2>
          <div className="content">
            {printSettings ? (
              <div className="table-wrap">
                <table className="specs">
                  <thead>
                    <tr>
                      <th>Матеріал</th>
                      <th>Nozzle °C</th>
                      <th>Bed °C</th>
                      <th>Layer мм</th>
                      <th>Infill %</th>
                      <th>Стінки</th>
                      <th>Швидк. мм/с</th>
                      <th>Підтримки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(printSettings).map(([mat, cfg]) => (
                      <tr key={mat}>
                        <td>{mat}</td>
                        <td>{cfg?.nozzle_temp ?? cfg?.nozzle ?? '-'}</td>
                        <td>{cfg?.bed_temp ?? cfg?.bed ?? '-'}</td>
                        <td>{cfg?.layer_height ?? cfg?.layer ?? '-'}</td>
                        <td>{cfg?.infill_percent ?? cfg?.infill ?? '-'}</td>
                        <td>{cfg?.wall_thickness ?? cfg?.walls ?? '-'}</td>
                        <td>{cfg?.print_speed ?? cfg?.speed ?? '-'}</td>
                        <td>{cfg?.supports ? 'так' : 'ні'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : printSettingsNote ? (
              <p>{printSettingsNote}</p>
            ) : (
              <p>Налаштування друку будуть додані за запитом.</p>
            )}
          </div>
        </div>

        {/* ПРАВОВІ/ЛІЦЕНЗІЙНІ МОМЕНТИ */}
        <div className="pd-section">
          <h2>Правові/ліцензійні моменти</h2>
          <div className="content">
            {licenseInfo ? (
              <div className="muted">
                {licenseInfo.license_name ? <p>Ліцензія: <a href={licenseInfo.license_url} target="_blank" rel="noreferrer">{licenseInfo.license_name}</a></p> : null}
                {licenseInfo.model_author ? <p>Автор моделі: {licenseInfo.model_author}</p> : null}
                {licenseInfo.model_url ? <p>Джерело: <a href={licenseInfo.model_url} target="_blank" rel="noreferrer">посилання</a></p> : null}
                {licenseInfo.digital_file_license ? <p>Ліцензія на цифровий файл: {licenseInfo.digital_file_license}</p> : null}
              </div>
            ) : licenseText ? (
              <p className="muted">{licenseText}</p>
            ) : (
              <p>Усі авторські права захищено. Якщо використовується стороння модель — вказано дозвіл на використання.</p>
            )}
          </div>
        </div>

        {Array.isArray(product.faq) && product.faq.length > 0 && (
          <div className="pd-section">
            <h2>Часті питання</h2>
            <div className="content">
              <div className="faq">
                {product.faq.map((qa, i) => (
                  <details key={i}>
                    <summary>{qa.q}</summary>
                    <p>{qa.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ——— Tags / SEO ——— */}
      {(Array.isArray(product.tags) && product.tags.length) || product.seo?.meta_description ? (
        <section className="pd-seo">
          {Array.isArray(product.tags) && product.tags.length > 0 && (
            <div className="tags">
              {product.tags.map((t, i) => <span className="tag" key={i}>#{t}</span>)}
            </div>
          )}
          {product.seo?.meta_description && (
            <p className="muted">SEO: {product.seo.meta_description}</p>
          )}
        </section>
      ) : null}

      {/* ——— Ask a question / chat ——— */}
      <section className="pd-contact">
        <button className="btn-primary" onClick={() => navigate('/contact?topic=question')}>Задати питання майстру</button>
        <span className="muted">Або напишіть нам у чат (іконка внизу праворуч).</span>
      </section>

      {/* ——— JSON-LD structured data ——— */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

export default function ProductDetailPage(){
  return (
    <ErrorBoundary>
      <ProductDetailPageInner />
    </ErrorBoundary>
  );
}
