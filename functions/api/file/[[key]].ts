import { AwsClient } from "aws4fetch";

interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ENDPOINT: string;
}

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

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const keyParts = params.key as string[];
  const key = keyParts.join("/");

  const isTimeflowDocument = key.startsWith("timeflow/documents/");
  const isLegacyDocument = key.startsWith("documents/");

  if (!isTimeflowDocument && !isLegacyDocument) {
    return new Response("Not found.", { status: 404 });
  }

  const aws = getAws(env);
  const objectUrl = buildObjectUrl(env, key);

  const r2Response = await aws.fetch(objectUrl, { method: "GET" });

  if (r2Response.status === 404) {
    return new Response("File not found.", { status: 404 });
  }

  if (!r2Response.ok) {
    return new Response("Storage error.", { status: 502 });
  }

  const contentType = r2Response.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = r2Response.headers.get("content-length");

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(r2Response.body, { status: 200, headers });
};
