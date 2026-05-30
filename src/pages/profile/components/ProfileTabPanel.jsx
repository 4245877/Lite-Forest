import React, { Component, Suspense, useMemo } from 'react';
import styles from './ProfileTabPanel.module.css';

const FALLBACK_TAB_KEY = 'profile';

const cx = (...classes) => classes.filter(Boolean).join(' ');

const normalizeIdPart = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || FALLBACK_TAB_KEY;
};

const getVariantClassName = (variant) => {
  const variants = {
    favorites: styles.sectionFavorites,
  };

  return variants[variant] || '';
};

const getErrorMessage = (error) => {
  if (!error) return '';

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Не вдалося завантажити вміст вкладки.';
};

class ProfileTabErrorBoundary extends Component {
  state = {
    error: null,
  };

  componentDidCatch(error) {
    this.setState({ error });

    if (import.meta?.env?.DEV) {
      console.error('[ProfileTabPanel]', error);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      return fallback(error);
    }

    return children;
  }
}

const PanelFallback = ({
  type = 'empty',
  title,
  text,
  action,
  onRetry,
}) => {
  const isError = type === 'error';
  const isLoading = type === 'loading';

  return (
    <div
      className={cx(
        styles.panelFallback,
        isError && styles.panelFallbackError,
        isLoading && styles.panelFallbackLoading,
      )}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-busy={isLoading ? 'true' : undefined}
    >
      {isLoading ? (
        <div className={styles.skeletonMain} aria-hidden="true" />
      ) : (
        <>
          <div className={styles.panelFallbackIcon} aria-hidden="true">
            {isError ? '!' : '—'}
          </div>

          <div className={styles.panelFallbackContent}>
            <h3 className={styles.panelFallbackTitle}>{title}</h3>
            {text ? <p className={styles.panelFallbackText}>{text}</p> : null}

            {(onRetry || action) && (
              <div className={styles.panelFallbackActions}>
                {onRetry ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={onRetry}
                  >
                    Спробувати ще раз
                  </button>
                ) : null}

                {action}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ProfileTabPanel = ({
  tabKey,
  activeTab,
  title,
  eyebrow,
  description,
  variant,
  children,

  className,
  bodyClassName,

  keepMounted = false,
  loading = false,
  error = null,
  empty = false,

  loadingLabel = 'Завантаження вкладки…',
  emptyTitle = 'Тут поки немає даних',
  emptyText = 'Інформація з’явиться після першої дії.',
  errorTitle = 'Не вдалося показати вкладку',
  fallbackAction = null,
  onRetry,
}) => {
  const panelId = useMemo(() => normalizeIdPart(tabKey), [tabKey]);
  const activePanelId = useMemo(() => normalizeIdPart(activeTab), [activeTab]);
  const isActive = panelId === activePanelId;

  if (!keepMounted && !isActive) {
    return null;
  }

  const errorMessage = getErrorMessage(error);
  const hasHeader = Boolean(eyebrow || title || description);
  const shouldShowFallback = loading || errorMessage || empty;

  return (
    <section
      id={`tab-${panelId}`}
      className={cx(
        styles.main,
        isActive && styles.mainActive,
        getVariantClassName(variant),
        className,
      )}
      role="tabpanel"
      tabIndex={isActive ? 0 : -1}
      hidden={!isActive}
      aria-hidden={!isActive}
      aria-labelledby={`tab-trigger-${panelId}`}
      aria-busy={loading ? 'true' : undefined}
      data-tab-panel={panelId}
      data-active={isActive ? 'true' : 'false'}
    >
      {hasHeader ? (
        <header className={styles.panelHeader}>
          {eyebrow ? <p className={styles.panelEyebrow}>{eyebrow}</p> : null}

          {title ? (
            <h2 id={`tab-heading-${panelId}`} className={styles.sectionTitle}>
              {title}
            </h2>
          ) : null}

          {description ? (
            <p className={styles.panelDescription}>{description}</p>
          ) : null}
        </header>
      ) : null}

      <div className={cx(styles.panelBody, bodyClassName)}>
        {shouldShowFallback ? (
          <PanelFallback
            type={loading ? 'loading' : errorMessage ? 'error' : 'empty'}
            title={
              loading
                ? loadingLabel
                : errorMessage
                  ? errorTitle
                  : emptyTitle
            }
            text={errorMessage || emptyText}
            action={fallbackAction}
            onRetry={errorMessage ? onRetry : undefined}
          />
        ) : (
          <ProfileTabErrorBoundary
            resetKey={panelId}
            fallback={(renderError) => (
              <PanelFallback
                type="error"
                title={errorTitle}
                text={getErrorMessage(renderError)}
                onRetry={onRetry}
              />
            )}
          >
            <Suspense
              fallback={
                <PanelFallback type="loading" title={loadingLabel} />
              }
            >
              {children}
            </Suspense>
          </ProfileTabErrorBoundary>
        )}
      </div>
    </section>
  );
};

export default ProfileTabPanel;