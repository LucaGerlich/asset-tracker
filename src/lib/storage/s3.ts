import type { StorageProvider } from "./types";

export interface S3Config {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private config: S3Config;
  private client: unknown;

  constructor(config?: S3Config) {
    this.config = config ?? {
      bucket: process.env.STORAGE_BUCKET ?? "",
      region: process.env.STORAGE_REGION,
      endpoint: process.env.STORAGE_ENDPOINT,
      accessKey: process.env.STORAGE_ACCESS_KEY,
      secretKey: process.env.STORAGE_SECRET_KEY,
    };
    this.bucket = this.config.bucket;
    if (!this.bucket)
      throw new Error("STORAGE_BUCKET is required for S3 storage");
  }

  private async getClient() {
    if (!this.client) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this.client = new S3Client({
        region: this.config.region || "us-east-1",
        ...(this.config.endpoint
          ? { endpoint: this.config.endpoint, forcePathStyle: true }
          : {}),
        ...(this.config.accessKey && this.config.secretKey
          ? {
              credentials: {
                accessKeyId: this.config.accessKey,
                secretAccessKey: this.config.secretKey,
              },
            }
          : {}),
      });
    }
    return this.client as Awaited<
      ReturnType<typeof import("@aws-sdk/client-s3")>
    >["S3Client"]["prototype"];
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async download(
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const resp = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: resp.ContentType || "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getUrl(key: string): Promise<string | null> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );
  }
}
