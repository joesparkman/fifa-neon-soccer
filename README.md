# FIFA Neon Soccer

A small browser-based neon soccer game with a serverless AWS leaderboard backend.

## Project structure

- `index.html` - game UI and canvas layout
- `style.css` - neon visual styling, responsive scaling, and canvas layout
- `app.js` - game logic, input handling, rendering, and leaderboard API calls
- `audio/` - optional WAV sound assets for local play and CloudFront-hosted delivery
- `backend/` - AWS SAM backend for the leaderboard
  - `backend/lambda/leaderboard.js` - Lambda function handler
  - `backend/template.yaml` - AWS SAM template defining the API and DynamoDB table
  - `backend/package.json` - Node dependency manifest for the backend
- `.gitignore` - excludes local dependencies and build artifacts

## How the app works

### Frontend

- Uses a canvas element for the game field and player/ball rendering
- Supports mouse and touch input for dragging the player
- Includes game state, physics, collisions, scoring, and visual effects
- Sends leaderboard data to the backend via `POST /leaderboard`
- Loads the top leaderboard via `GET /leaderboard`
- Persists a guest profile locally so leaderboard submissions keep a stable display name
- Supports Cognito Hosted UI sign-in with a local guest fallback
- Sends match telemetry to `POST /telemetry` for replay-style analysis
- Can load optional audio assets from an S3/CloudFront asset base when deployed with hosted sound packs
- Looks for WAV files in `audio/` for hit, wall, goal, and victory sounds

### Backend

- AWS Lambda function written in Node.js
- Uses `@aws-sdk/client-dynamodb` to read and write leaderboard entries
- Stores match telemetry summaries so you can inspect replays and tuning data later
- Emits structured logs and CloudWatch-compatible metrics for leaderboard and telemetry traffic
- Writes each score entry with a partition key of `LEADERBOARD` and a sort key containing padded score + timestamp
- Returns the latest top 10 leaderboard entries
- Handles CORS and request validation

## Cloud deployment

### Pre-requisites

- AWS CLI configured with credentials
- AWS SAM CLI installed
- Node.js installed for backend dependencies

### Run locally

From the project root, open the game in a browser. For best results, serve it from a simple local web server instead of loading `index.html` directly.

Example using Python:
```powershell
cd c:\Users\jojob\Downloads\fifa-neon-soccer
python -m http.server 5500
```
Then open `http://localhost:5500` in your browser.

### Deploy backend

1. Open a terminal inside `backend/`
2. Install dependencies:
   ```powershell
   cd backend
   npm install
   ```
3. Build the SAM application:
   ```powershell
   sam build
   ```
4. Deploy to AWS:
   ```powershell
   sam deploy --guided
   ```
5. Note the generated `ApiUrl` output and set it as `API_BASE` in `app.js`.
6. Use the `AssetBaseUrl` output if you want to host sound packs or other static assets from CloudFront.
7. Copy or sync your WAV files into `audio/` locally and into the S3 asset bucket before pointing the frontend at `AssetBaseUrl`.
8. Use the Cognito outputs to configure `window.APP_COGNITO` with the Hosted UI domain and client id.

### Environment variables

The Lambda function now uses environment variables for configuration:

- `LEADERBOARD_TABLE` - the DynamoDB table name
- `TELEMETRY_TABLE` - the DynamoDB table used for match telemetry and replay summaries
- `ALLOWED_ORIGINS` - comma-separated list of allowed CORS origins
- If you host sounds in S3, set `window.APP_ASSET_BASE` to the CloudFront `AssetBaseUrl`
- If you use Cognito Hosted UI, set `window.APP_COGNITO` with `domain`, `clientId`, `redirectUri`, and `logoutRedirectUri`

Example frontend config:

```html
<script>
   window.APP_ASSET_BASE = "https://your-cloudfront-domain";
   window.APP_COGNITO = {
      domain: "https://fifa-neon-123456789012-us-east-1.auth.us-east-1.amazoncognito.com",
      clientId: "your-cognito-client-id",
      redirectUri: "http://localhost:5500",
      logoutRedirectUri: "http://localhost:5500"
   };
</script>
```

These are configured in `backend/template.yaml`.

## Git setup

- A local Git repository was initialized in the project root
- `.gitignore` excludes:
  - `**/node_modules/`
  - `backend/.aws-sam/`
  - `.DS_Store`
  - `Thumbs.db`

## Notes and best practices

- Do not commit `node_modules/` or generated SAM build artifacts
- Keep AWS credentials out of the repo
- Limit `ALLOWED_ORIGINS` to the actual frontend origins you use
- Validate all incoming backend fields to prevent malformed or spoofed data

## Optional improvements

- Add a real leaderboard display in the frontend
- Use stricter IAM policies instead of `DynamoDBCrudPolicy`
- Replace hard-coded `API_BASE` with a build-time or deployment-time configuration
- Add tests for game logic and backend validation
- Upload MP3 sound packs to the CloudFront asset bucket and point the frontend at `AssetBaseUrl`
- Add real WAV assets in `audio/` and sync them to the CloudFront asset bucket for production delivery
- Wire `window.APP_COGNITO` from the SAM outputs so the Hosted UI login button is active
