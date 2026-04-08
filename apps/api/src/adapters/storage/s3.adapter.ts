// apps/api/src/adapters/storage/s3.adapter.ts

import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET_NAME;

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
    const fileName = `sessions/${sessionId}/${Date.now()}.png`;
    
    // Remove base64 prefix if exists (e.g., data:image/png;base64,)
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: 'image/png',
          // ACL: 'public-read', // Depends on bucket policy
        })
      );

      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      this.logger.log(`Photo uploaded to S3: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('Error uploading to S3', error);
      throw new Error('Failed to upload photo to cloud storage');
    }
  }
}
