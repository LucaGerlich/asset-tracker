import type { StorageProvider } from "./types";

export class AzureStorageProvider implements StorageProvider {
  private containerName: string;
  private containerClient: any;

  constructor() {
    this.containerName = process.env.STORAGE_AZURE_CONTAINER!;
    if (!this.containerName)
      throw new Error("STORAGE_AZURE_CONTAINER is required for Azure storage");
    if (!process.env.STORAGE_AZURE_CONNECTION_STRING)
      throw new Error(
        "STORAGE_AZURE_CONNECTION_STRING is required for Azure storage",
      );
  }

  private async getContainer() {
    if (!this.containerClient) {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const blobService = BlobServiceClient.fromConnectionString(
        process.env.STORAGE_AZURE_CONNECTION_STRING!,
      );
      this.containerClient = blobService.getContainerClient(this.containerName);
    }
    return this.containerClient;
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const container = await this.getContainer();
    const blockBlob = container.getBlockBlobClient(key);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  async download(
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const container = await this.getContainer();
    const blockBlob = container.getBlockBlobClient(key);
    const downloadResponse = await blockBlob.download(0);
    const chunks: Uint8Array[] = [];
    for await (const chunk of downloadResponse.readableStreamBody as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: downloadResponse.contentType || "application/octet-stream",
    };
  }

  async delete(key: string): Promise<void> {
    const container = await this.getContainer();
    const blockBlob = container.getBlockBlobClient(key);
    await blockBlob.deleteIfExists();
  }

  async getUrl(key: string): Promise<string | null> {
    const {
      generateBlobSASQueryParameters,
      BlobSASPermissions,
      StorageSharedKeyCredential,
    } = await import("@azure/storage-blob");
    const container = await this.getContainer();
    const blockBlob = container.getBlockBlobClient(key);

    const connStr = process.env.STORAGE_AZURE_CONNECTION_STRING!;
    const accountName = connStr.match(/AccountName=([^;]+)/)?.[1];
    const accountKey = connStr.match(/AccountKey=([^;]+)/)?.[1];

    if (!accountName || !accountKey) {
      return null;
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(
      accountName,
      accountKey,
    );
    const expiresOn = new Date(Date.now() + 3600 * 1000);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      sharedKeyCredential,
    ).toString();

    return `${blockBlob.url}?${sasToken}`;
  }
}
