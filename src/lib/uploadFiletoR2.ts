import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./r2";

export async function uploadFileToR2(file: Buffer, key: string, type: string) {
  const command = new PutObjectCommand({
    Bucket: "invoice-attachments",
    Key: key,
    Body: file,
    ContentType: type,
  });

  await r2.send(command);
}
