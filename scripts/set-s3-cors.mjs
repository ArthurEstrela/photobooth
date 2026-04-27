// Run: AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node scripts/set-s3-cors.mjs
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const bucket = process.env.AWS_S3_BUCKET ?? 'photobooth-storage-arthur-959993795918-sa-east-1-an';
const region = process.env.AWS_REGION ?? 'sa-east-1';

const client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

await client.send(new PutBucketCorsCommand({
  Bucket: bucket,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET'],
        AllowedOrigins: ['*'],
        ExposeHeaders: [],
      },
    ],
  },
}));

console.log(`CORS configurado com sucesso no bucket: ${bucket}`);
