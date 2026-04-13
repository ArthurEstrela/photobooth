import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadPhoto(sessionId: string, base64Data: string): Promise<string> {
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    return this.uploadFile(`sessions/${sessionId}`, buffer, 'image/png');
  }

  async uploadFile(folder: string, buffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] ?? 'png';
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      let url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      if (process.env.AWS_CLOUDFRONT_DOMAIN) {
        url = `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${key}`;
      }
      this.logger.log(`File uploaded: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('Error uploading file to S3', error);
      throw new Error('Failed to upload file to cloud storage');
    }
  }
}
