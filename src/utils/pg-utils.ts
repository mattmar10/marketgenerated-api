import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export const getPGConfig = async () => {
  const client = new SecretsManagerClient({ region: "us-east-1" });

  const data = await client.send(
    new GetSecretValueCommand({
      SecretId: "dev-docn-postgres",
    })
  );

  const secret = JSON.parse(data.SecretString!);

  const host = secret.host;
  const db = secret.db;
  const user = secret.username;
  const pass = secret.password;
  const port = secret.port;
  const cert = secret.cacert;

  const dbConfig = {
    user: user,
    password: pass,
    database: db,
    host: host,
    port: port,
    max: 5,
    ssl: {
      ca: cert,
      rejectUnauthorized: false,
    },
    idleTimeoutMillis: 30000,
  };

  return dbConfig;
};
