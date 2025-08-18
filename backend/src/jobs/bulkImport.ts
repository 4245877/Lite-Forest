import { getObjectStream, putObject } from '../config/s3';
import { getKnex } from '../db/knex';
import { parse } from 'fast-csv';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

export async function processBulkImport(job: any) {
  const { s3_key, filename } = job.data as { s3_key: string; filename: string };
  const bucket = process.env.S3_BUCKET as string;

  const knex = getKnex();
  const rows: any[] = [];

  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    const stream = await getObjectStream(bucket, s3_key);
    const buf = await streamToBuffer(stream);
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });
    rows.push(...json);
  } else {
    const stream = await getObjectStream(bucket, s3_key);
    await new Promise<void>((resolve, reject) => {
      stream.pipe(parse({ headers: true }))
        .on('error', reject)
        .on('data', (r) => rows.push(r))
        .on('end', () => resolve());
    });
  }

  const errors: any[] = [];
  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await knex.transaction(async (trx) => {
      for (const r of batch) {
        try {
          const sku = String(r.sku).trim();
          if (!sku) throw new Error('Missing sku');
          const price_cents = Number(r.price_cents);
          if (!Number.isFinite(price_cents)) throw new Error('Invalid price_cents');
          const normalized = {
            sku,
            title: String(r.title || '').trim(),
            short_description: r.short_description || null,
            description: r.description || null,
            price_cents,
            currency: r.currency || 'UAH',
            brand: r.brand || null,
            attributes: r.attributes_json ? JSON.parse(r.attributes_json) : null,
          };
          const row_hash = sha256(JSON.stringify(normalized));

          // upsert по sku
          const q = trx('products').insert({ ...normalized })
            .onConflict('sku')
            .merge({ ...normalized, updated_at: trx.fn.now() })
            .returning(['id']);
          const [res] = await q;

          // категории (упрощенно: если есть category_id)
          if (r.category_id) await trx('products').update({ category_id: r.category_id }).where({ id: res.id || res });
        } catch (e: any) {
          errors.push({ row: r, error: e.message || String(e) });
        }
      }
    });
    await job.updateProgress(Math.round(((i + batch.length) / rows.length) * 100));
  }

  // выгрузим отчёт об ошибках
  if (errors.length) {
    const csv = 'sku,error\n' + errors.map(e => `${escapeCsv(e.row.sku)},${escapeCsv(e.error)}`).join('\n');
    const errKey = s3_key.replace(/^imports\//, 'import-reports/').replace(/\.[^.]+$/, '') + '-errors.csv';
    await putObject(bucket, errKey, Buffer.from(csv), 'text/csv');
    return { total: rows.length, errors: errors.length, report: `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '')}/${errKey}` };
  }
  return { total: rows.length, errors: 0 };
}

function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }
function escapeCsv(s: string = '') { return '"' + String(s).replace(/"/g, '""') + '"'; }
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}