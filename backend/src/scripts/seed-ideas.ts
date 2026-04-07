import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Idea {
  id: string;
  name: string;
  tagline: string;
  problem: string;
  solution: string;
  architecture: string[];
  complexity: string;
  mvpTime: string;
  risk: string;
  riskNote: string;
  mrr: string;
  model: string;
  selfService: boolean;
  potential: string;
  category: string;
  status: string;
  order: number;
}

function getTableName(): string {
  const envArg = process.argv.find((arg) => arg.startsWith("--env="));
  if (envArg) {
    const env = envArg.split("=")[1];
    return `SapInnovation-${env}-ideas`;
  }

  if (process.env.TABLE_NAME) {
    return process.env.TABLE_NAME;
  }

  return "SapInnovation-production-ideas";
}

async function ideaExists(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  id: string
): Promise<boolean> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id },
        ProjectionExpression: "id",
      })
    );
    return !!result.Item;
  } catch {
    return false;
  }
}

async function seedIdeas(): Promise<void> {
  const tableName = getTableName();
  console.log(`Seeding ideas into table: ${tableName}`);

  const dataPath = resolve(__dirname, "../../../data/ideas.json");
  const rawData = readFileSync(dataPath, "utf-8");
  const ideas: Idea[] = JSON.parse(rawData);

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  // Check which ideas already exist (idempotent)
  const newIdeas: Idea[] = [];
  for (const idea of ideas) {
    const exists = await ideaExists(docClient, tableName, idea.id);
    if (exists) {
      console.log(`  Skipping ${idea.id} (${idea.name}) — already exists`);
    } else {
      newIdeas.push(idea);
    }
  }

  if (newIdeas.length === 0) {
    console.log("All ideas already exist. Nothing to seed.");
    return;
  }

  console.log(`Writing ${newIdeas.length} new ideas...`);

  // BatchWrite supports max 25 items per request
  const batchSize = 25;
  for (let i = 0; i < newIdeas.length; i += batchSize) {
    const batch = newIdeas.slice(i, i + batchSize);
    const putRequests = batch.map((idea) => ({
      PutRequest: {
        Item: {
          ...idea,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }));

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: putRequests,
        },
      })
    );

    for (const idea of batch) {
      console.log(`  Wrote ${idea.id} (${idea.name})`);
    }
  }

  console.log(`Done. Seeded ${newIdeas.length} ideas.`);
}

seedIdeas().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
