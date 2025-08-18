export async function healthRoutes(app) {
    app.get('/healthz', async () => ({ status: 'ok' }));
    app.get('/readyz', async () => ({ status: 'ready' }));
}
