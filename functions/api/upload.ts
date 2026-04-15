import { AwsClient } from "aws4fetch";

interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ENDPOINT: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIMEFLOW_DOCUMENT_PREFIX = "timeflow/documents";

function getAws(env: Env) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function buildObjectUrl(env: Env, key: string) {
  const base = env.R2_ENDPOINT.replace(/\/$/, "");
  return `${base}/${env.R2_BUCKET_NAME}/${encodeURIComponent(key)}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: `File too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB.` }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Sanitise the original filename to a safe key segment
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  const key = `${TIMEFLOW_DOCUMENT_PREFIX}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  const aws = getAws(env);
  const objectUrl = buildObjectUrl(env, key);

  const body = await file.arrayBuffer();

  const uploadResponse = await aws.fetch(objectUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(body.byteLength),
    },
    body,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    console.error("R2 upload error:", uploadResponse.status, text);
    return new Response(JSON.stringify({ error: "Storage upload failed." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ key }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
