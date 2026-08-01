import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname } from 'path';

export interface StorageProvider {
    upload(file: File): Promise<string>;
}

class LocalStorage implements StorageProvider {
    private baseUrl: string;
    private uploadDir: string;

    constructor() {
        this.baseUrl =
            process.env.APP_URL ??
            process.env.BETTER_AUTH_URL ??
            'http://localhost:3001';
        this.uploadDir = process.env.LOCAL_UPLOAD_DIR ?? './uploads';
    }

    async upload(file: File) {
        await mkdir(this.uploadDir, { recursive: true });
        const filename = `${randomUUID()}${extname(file.name)}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(`${this.uploadDir}/${filename}`, buffer);
        return `${this.baseUrl}/uploads/${filename}`;
    }
}

class S3Storage implements StorageProvider {
    private client: S3Client;
    private bucket: string;
    private publicUrl: string | undefined;

    constructor() {
        const region = process.env.S3_REGION;
        const endpoint = process.env.S3_ENDPOINT;
        const accessKeyId = process.env.S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
        const bucket = process.env.S3_BUCKET;

        if (!region || !accessKeyId || !secretAccessKey || !bucket) {
            throw new Error('S3 storage missing required configuration');
        }

        this.client = new S3Client({
            region,
            endpoint,
            credentials: { accessKeyId, secretAccessKey }
        });
        this.bucket = bucket;
        this.publicUrl = process.env.S3_PUBLIC_URL;
    }

    async upload(file: File) {
        const filename = `${randomUUID()}${extname(file.name)}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: filename,
                Body: buffer,
                ContentType: file.type
            })
        );

        if (this.publicUrl) return `${this.publicUrl}/${filename}`;

        const endpoint = process.env.S3_ENDPOINT;
        if (endpoint) return `${endpoint}/${this.bucket}/${filename}`;

        return `https://${this.bucket}.s3.amazonaws.com/${filename}`;
    }
}

export function createStorageProvider(): StorageProvider {
    const provider = process.env.STORAGE_PROVIDER ?? 'local';
    if (provider === 's3') return new S3Storage();
    return new LocalStorage();
}
