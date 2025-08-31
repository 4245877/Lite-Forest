export const flags = {
jobsEnabled: Boolean(process.env.REDIS_URL),
s3Enabled: Boolean(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
};