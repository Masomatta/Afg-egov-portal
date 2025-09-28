// src/utils/storage.js
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();


export async function uploadToStorage(localPath, filename) {
  if (process.env.AWS_S3_BUCKET) {
    const fileContent = fs.readFileSync(localPath);
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: filename,
      Body: fileContent
    };
    const data = await s3.upload(params).promise();
    return data.Location; // S3 URL
  } else {
    // In dev: return local relative path
    return `/uploads/${filename}`;
  }
}
