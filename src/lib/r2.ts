import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto", 
  endpoint: "https://b8fe56398654bc84a5a40f15cb57cbfc.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
