import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { extname } from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'hse-uploads';
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'hse_minio',
      secretKey: process.env.MINIO_SECRET_KEY || 'hse_minio_password',
    });
  }

  // Uygulama acilirken bucket'in var oldugundan emin ol
  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        // eslint-disable-next-line no-console
        console.log(`MinIO bucket olusturuldu: ${this.bucket}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        'MinIO baglantisi kurulamadi (docker calisyor mu?):',
        (e as Error).message,
      );
    }
  }

  // Dosyayi MinIO'ya yukler, erisim anahtarini (key) dondurur
  async put(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<string> {
    const key = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(
      originalName,
    )}`;
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimetype,
    });
    return key;
  }

  async getStat(key: string) {
    return this.client.statObject(this.bucket, key);
  }

  async getStream(key: string) {
    return this.client.getObject(this.bucket, key);
  }

  // Video Range istekleri icin kismi okuma
  async getPartialStream(key: string, offset: number, length: number) {
    return this.client.getPartialObject(this.bucket, key, offset, length);
  }

  // Kisa sureli imzali GET URL'i. Bucket private kalir; erisim yalnizca
  // imza gecerli oldugu surece mumkundur. URL hicbir yerde saklanmaz.
  async getPresignedUrl(key: string, expirySeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }
}
