// backend/src/api/products/products.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import * as ProductService from './products.service';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { uploadToS3, deleteFromS3 } from '../../utils/s3'; // см. ниже

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
const USE_S3 = process.env.USE_S3 === 'true';

async function saveFileLocally(stream: NodeJS.ReadableStream, filename: string) {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const filepath = path.join(UPLOAD_DIR, filename);
  await pipeline(stream, fs.createWriteStream(filepath));
  return filepath;
}

export const createProductHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    if (!(request.isMultipart && request.isMultipart())) {
      // JSON body case
      const product = await ProductService.createProduct(request.body as any);
      return reply.status(201).send(product);
    }

    const parts = request.parts();
    const productData: any = { photos: [], categories: [] };
    const uploadedFiles: { localPath?: string; s3Key?: string; thumbLocalPath?: string; thumbS3Key?: string }[] = [];

    for await (const part of parts) {
      if (part.file) {
        // file part
        const mimetype = part.mimetype || '';
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(mimetype)) {
          // cleanup any previously uploaded files
          for (const f of uploadedFiles) {
            if (f.localPath) await fs.promises.unlink(f.localPath).catch(() => {});
            if (f.thumbLocalPath) await fs.promises.unlink(f.thumbLocalPath).catch(() => {});
            if (f.s3Key) await deleteFromS3(f.s3Key).catch(() => {});
            if (f.thumbS3Key) await deleteFromS3(f.thumbS3Key).catch(() => {});
          }
          return reply.status(400).send({ message: 'Неподдерживаемый тип файла' });
        }

        const ext = mimetype === 'image/png' ? '.png' : mimetype === 'image/webp' ? '.webp' : '.jpg';
        const filename = `${uuidv4()}${ext}`;

        if (USE_S3) {
          // временно сохраняем в лок.файл, потом загрузим в S3 (можно stream->S3 напрямую, но проще так)
          const tempPath = path.join('/tmp', filename);
          await pipeline(part.file, fs.createWriteStream(tempPath));
          // Генерация миниатюры
          const thumbName = `${uuidv4()}_thumb${ext}`;
          const thumbTmp = path.join('/tmp', thumbName);
          await sharp(tempPath).resize(800, null, { withoutEnlargement: true }).toFile(thumbTmp);

          // Загружаем в S3
          const s3Key = `products/${filename}`;
          const thumbS3Key = `products/thumbs/${thumbName}`;
          const s3Url = await uploadToS3(tempPath, s3Key);
          const thumbUrl = await uploadToS3(thumbTmp, thumbS3Key);

          // Удаляем временные файлы
          await fs.promises.unlink(tempPath).catch(()=>{});
          await fs.promises.unlink(thumbTmp).catch(()=>{});

          productData.photos.push(s3Url);
          uploadedFiles.push({ s3Key, thumbS3Key });
        } else {
          // Сохраняем локально
          const savedPath = await saveFileLocally(part.file, filename);
          const publicUrl = `/uploads/${filename}`;

          // Миниатюра рядом
          const thumbFilename = `${uuidv4()}_thumb${ext}`;
          const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
          await sharp(savedPath).resize(800, null, { withoutEnlargement: true }).toFile(thumbPath);
          const thumbPublicUrl = `/uploads/${thumbFilename}`;

          productData.photos.push(publicUrl);
          uploadedFiles.push({ localPath: savedPath, thumbLocalPath: thumbPath });
        }
      } else {
        // field part
        const value = part.value;
        // поддержим categories как CSV: "Electronics,Phones"
        if (part.fieldname === 'categories') {
          productData.categories = value.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
          productData[part.fieldname] = value;
        }
      }
    } // end for parts

    // Приведение типов
    if (productData.price) productData.price = Number(productData.price);
    if (productData.stock) productData.stock = Number(productData.stock);

    // Транзакционно: создаём товар и медиа в БД; если упадёт — удаляем загруженные файлы/объекты S3
    try {
      const product = await ProductService.createProduct(productData);
      return reply.status(201).send(product);
    } catch (e) {
      // ошибка при записи БД -> удаляем загруженные файлы/объекты
      for (const f of uploadedFiles) {
        if (f.localPath) await fs.promises.unlink(f.localPath).catch(()=>{});
        if (f.thumbLocalPath) await fs.promises.unlink(f.thumbLocalPath).catch(()=>{});
        if (f.s3Key) await deleteFromS3(f.s3Key).catch(()=>{});
        if (f.thumbS3Key) await deleteFromS3(f.thumbS3Key).catch(()=>{});
      }
      throw e;
    }

  } catch (err) {
    console.error('Ошибка createProductHandler:', err);
    return reply.status(500).send({ message: 'Ошибка при создании товара' });
  }
};
