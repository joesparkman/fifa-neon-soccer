const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const LEADERBOARD_TABLE = process.env.LEADERBOARD_TABLE || "FifaGameLeaderboard";
const TELEMETRY_TABLE = process.env.TELEMETRY_TABLE || "FifaGameTelemetry";
const METRIC_NAMESPACE = process.env.METRIC_NAMESPACE || "FifaNeonSoccer";
const MAX_NAME_LENGTH = 20;
const MAX_SCORE = 9999;
const MAX_EVENTS_JSON_LENGTH = 12000;
const HEADERS_BASE = {
  "Content-Type": "application/json"
};
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

function getCorsOrigin(origin) {
  if (!origin) {
    return ALLOWED_ORIGINS.length ? "null" : "*";
  }
  if (ALLOWED_ORIGINS.length === 0) {
    return "*";
  }
  return ALLOWED_ORIGINS.includes(origin) ? origin : "null";
}

function buildResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      ...HEADERS_BASE,
      "Access-Control-Allow-Origin": getCorsOrigin(origin),
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function logEvent(level, message, details = {}) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

function emitMetric(metricName, value, service = "LeaderboardApi") {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: METRIC_NAMESPACE,
        Dimensions: [["Service"]],
        Metrics: [{ Name: metricName, Unit: "Count" }]
      }]
    },
    Service: service,
    [metricName]: value
  }));
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function normalizeOrigin(headers) {
  return (headers && (headers.origin || headers.Origin)) || "";
}

function normalizePath(event) {
  return event.rawPath || event.path || "/";
}

function normalizeMethod(event) {
  return event.httpMethod || event.requestContext?.http?.method || "";
}

function clampText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function buildTelemetryItem(payload) {
  const eventsJson = JSON.stringify(Array.isArray(payload.events) ? payload.events : []);
  return {
    pk: { S: "TELEMETRY" },
    sk: { S: `${String(Date.now())}#${payload.matchId || "match"}` },
    profileId: { S: clampText(payload.profileId, 64) || "guest" },
    profileName: { S: clampText(payload.profileName, MAX_NAME_LENGTH) || "Guest" },
    sessionId: { S: clampText(payload.sessionId, 64) || "unknown" },
    matchId: { S: clampText(payload.matchId, 64) || `match-${Date.now()}` },
    playerWon: { BOOL: Boolean(payload.playerWon) },
    scoreP: { N: String(Number(payload?.score?.p || 0)) },
    scoreCPU: { N: String(Number(payload?.score?.cpu || 0)) },
    durationMs: { N: String(Number(payload.durationMs || 0)) },
    ballSpeedMult: { N: String(Number(payload.ballSpeedMult || 0)) },
    streak: { N: String(Number(payload.streak || 0)) },
    topSpeed: { N: String(Number(payload.topSpeed || 0)) },
    cpuModel: { S: JSON.stringify(payload.cpuModel || {}) },
    eventsJson: { S: eventsJson.slice(0, MAX_EVENTS_JSON_LENGTH) },
    createdAt: { S: new Date().toISOString() }
  };
}

exports.handler = async (event) => {
  const origin = normalizeOrigin(event.headers);
  const route = normalizePath(event);
  const method = normalizeMethod(event);
  const corsOrigin = getCorsOrigin(origin);
  const startedAt = Date.now();

  logEvent("info", "request_received", { route, method, origin });

  if (origin && ALLOWED_ORIGINS.length > 0 && corsOrigin === "null") {
    emitMetric("RejectedRequests", 1, "LeaderboardApi");
    logEvent("warn", "cors_origin_denied", { route, method, origin });
    return buildResponse(403, { error: "CORS origin denied" }, origin);
  }

  if (method === "OPTIONS") {
    return buildResponse(200, "", origin);
  }

  if (method === "POST" && route === "/leaderboard") {
    const payload = parseJson(event.body);
    if (!payload) {
      emitMetric("RejectedRequests", 1, "LeaderboardApi");
      return buildResponse(400, { error: "Invalid JSON payload" }, origin);
    }

    const playerName = typeof payload.playerName === "string"
      ? payload.playerName.trim().slice(0, MAX_NAME_LENGTH)
      : "";
    const playerId = clampText(payload.playerId, 64);
    const sessionId = clampText(payload.sessionId, 64);
    const score = Number(payload.score);
    const streak = Number(payload.streak ?? 0);
    const topSpeed = Number(payload.topSpeed ?? 0);

    if (!playerName) {
      return buildResponse(400, { error: "playerName is required" }, origin);
    }
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return buildResponse(400, { error: `score must be an integer between 0 and ${MAX_SCORE}` }, origin);
    }
    if (!Number.isInteger(streak) || streak < 0) {
      return buildResponse(400, { error: "streak must be a non-negative integer" }, origin);
    }
    if (!Number.isInteger(topSpeed) || topSpeed < 0) {
      return buildResponse(400, { error: "topSpeed must be a non-negative integer" }, origin);
    }

    await client.send(new PutItemCommand({
      TableName: LEADERBOARD_TABLE,
      Item: {
        pk:         { S: "LEADERBOARD" },
        sk:         { S: `${String(score).padStart(4, "0")}#${Date.now()}` },
        playerName: { S: playerName },
        playerId:   { S: playerId || "guest" },
        sessionId:  { S: sessionId || "unknown" },
        score:      { N: String(score) },
        streak:     { N: String(streak) },
        topSpeed:   { N: String(topSpeed) },
        playedAt:   { S: new Date().toISOString() }
      }
    }));

    emitMetric("LeaderboardSaved", 1, "LeaderboardApi");
    logEvent("info", "leaderboard_saved", { playerName, score, streak, topSpeed, latencyMs: Date.now() - startedAt });

    return buildResponse(201, { saved: true }, origin);
  }

  if (method === "POST" && route === "/telemetry") {
    const payload = parseJson(event.body);
    if (!payload) {
      emitMetric("RejectedRequests", 1, "TelemetryApi");
      return buildResponse(400, { error: "Invalid JSON payload" }, origin);
    }

    const scoreP = Number(payload?.score?.p ?? 0);
    const scoreCPU = Number(payload?.score?.cpu ?? 0);
    const durationMs = Number(payload.durationMs ?? 0);
    const ballSpeedMult = Number(payload.ballSpeedMult ?? 0);
    const streak = Number(payload.streak ?? 0);
    const topSpeed = Number(payload.topSpeed ?? 0);

    if (!Number.isInteger(scoreP) || scoreP < 0 || !Number.isInteger(scoreCPU) || scoreCPU < 0) {
      return buildResponse(400, { error: "score must contain non-negative integer values" }, origin);
    }
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return buildResponse(400, { error: "durationMs must be a non-negative number" }, origin);
    }

    await client.send(new PutItemCommand({
      TableName: TELEMETRY_TABLE,
      Item: buildTelemetryItem(payload)
    }));

    emitMetric("TelemetrySaved", 1, "TelemetryApi");
    logEvent("info", "telemetry_saved", {
      profileName: clampText(payload.profileName, MAX_NAME_LENGTH) || "Guest",
      scoreP,
      scoreCPU,
      durationMs,
      ballSpeedMult,
      streak,
      topSpeed,
      latencyMs: Date.now() - startedAt
    });

    return buildResponse(201, { saved: true }, origin);
  }

  if (method === "GET" && route === "/leaderboard") {
    const result = await client.send(new QueryCommand({
      TableName: LEADERBOARD_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "LEADERBOARD" } },
      ScanIndexForward: false,
      Limit: 10
    }));

    const items = (result.Items || []).map((i, idx) => ({
      rank:       idx + 1,
      playerName: i.playerName?.S || "",
      playerId: i.playerId?.S || "guest",
      sessionId: i.sessionId?.S || "unknown",
      score:      Number(i.score?.N || 0),
      streak:     Number(i.streak?.N || 0),
      topSpeed:   Number(i.topSpeed?.N || 0),
      playedAt:   i.playedAt?.S || ""
    }));

    emitMetric("LeaderboardFetched", 1, "LeaderboardApi");
    logEvent("info", "leaderboard_fetched", { itemCount: items.length, latencyMs: Date.now() - startedAt });

    return buildResponse(200, items, origin);
  }

  if (method === "GET" && route === "/telemetry") {
    const result = await client.send(new QueryCommand({
      TableName: TELEMETRY_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "TELEMETRY" } },
      ScanIndexForward: false,
      Limit: 10
    }));

    const items = (result.Items || []).map((item, idx) => ({
      rank: idx + 1,
      profileName: item.profileName?.S || "Guest",
      profileId: item.profileId?.S || "guest",
      sessionId: item.sessionId?.S || "unknown",
      matchId: item.matchId?.S || "",
      playerWon: Boolean(item.playerWon?.BOOL),
      score: {
        p: Number(item.scoreP?.N || 0),
        cpu: Number(item.scoreCPU?.N || 0)
      },
      durationMs: Number(item.durationMs?.N || 0),
      ballSpeedMult: Number(item.ballSpeedMult?.N || 0),
      streak: Number(item.streak?.N || 0),
      topSpeed: Number(item.topSpeed?.N || 0),
      createdAt: item.createdAt?.S || ""
    }));

    emitMetric("TelemetryFetched", 1, "TelemetryApi");
    logEvent("info", "telemetry_fetched", { itemCount: items.length, latencyMs: Date.now() - startedAt });

    return buildResponse(200, items, origin);
  }

  return buildResponse(405, { error: "Method not allowed" }, origin);
};