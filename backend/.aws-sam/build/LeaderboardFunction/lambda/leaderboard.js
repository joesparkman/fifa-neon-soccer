const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });
const TABLE = "FifaGameLeaderboard";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod === "POST") {
    const { playerName, score, streak, topSpeed } = JSON.parse(event.body);
    if (!playerName || score === undefined) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Missing fields" }) };
    }
    await client.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        pk:         { S: "LEADERBOARD" },
        sk:         { S: `${String(score).padStart(4,"0")}#${Date.now()}` },
        playerName: { S: playerName.slice(0, 20) },
        score:      { N: String(score) },
        streak:     { N: String(streak || 0) },
        topSpeed:   { N: String(topSpeed || 0) },
        playedAt:   { S: new Date().toISOString() }
      }
    }));
    return { statusCode: 201, headers: HEADERS, body: JSON.stringify({ saved: true }) };
  }

  if (event.httpMethod === "GET") {
    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LEADERBOARD" } },
      ScanIndexForward: false,
      Limit: 10
    }));
    const items = result.Items.map((i, idx) => ({
      rank:       idx + 1,
      playerName: i.playerName.S,
      score:      Number(i.score.N),
      streak:     Number(i.streak.N),
      topSpeed:   Number(i.topSpeed.N),
      playedAt:   i.playedAt.S
    }));
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(items) };
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
};