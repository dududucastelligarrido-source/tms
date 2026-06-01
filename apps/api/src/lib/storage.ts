import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const {
  S3_ENDPOINT,
  S3_REGION = 'auto',
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_URL,
} = process.env

export function isStorageConfigured() {
  return !!(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)
}

function getClient() {
  return new S3Client({
    endpoint: S3_ENDPOINT!,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID!,
      secretAccessKey: S3_SECRET_ACCESS_KEY!,
    },
  })
}

type UploadContext = 'odometer' | 'receipt' | 'maintenance' | 'checklist'

export async function createPresignedUpload(opts: {
  tenantId: string
  context: UploadContext
  contentType: string
  filename: string
}) {
  // Sanitize the extension: only allow a short alphanumeric suffix so a crafted
  // filename can't inject path separators / traversal into the object key.
  const rawExt = opts.filename.split('.').pop()?.toLowerCase() ?? ''
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg'
  const key = `${opts.tenantId}/${opts.context}/${randomUUID()}.${ext}`
  const client = getClient()

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET!,
    Key: key,
    ContentType: opts.contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  const baseUrl = S3_PUBLIC_URL ?? `${S3_ENDPOINT}/${S3_BUCKET}`
  const fileUrl = `${baseUrl}/${key}`

  return { uploadUrl, fileUrl, key }
}
