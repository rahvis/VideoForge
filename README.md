# VideoForge

VideoForge is an AI-powered video creation platform leveraging the power of Sora, GPT-4o, and ElevenLabs.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- MongoDB (Local or Atlas)
- Azure OpenAI Account (Sora & GPT-4o access)
- ElevenLabs API Key

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository_url>
   cd video-forge
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**

   **Backend:**
   Copy the example environment file:
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```
   
   **Frontend:**
   Create a `.env.local` file in `packages/frontend` (see Environment Variables section below).

4. **Run the development server**
   ```bash
   pnpm dev
   ```
   
   This will start both:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend: [http://localhost:3001](http://localhost:3001)

## 📦 Deployment

### Vercel (Frontend)

The frontend is a Next.js application, optimized for deployment on Vercel.

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` from the root or `packages/frontend` directory.
3. Configure the `NEXT_PUBLIC_API_URL` environment variable to point to your deployed backend (e.g., `https://api.your-backend.com/api`).

### Railway (Backend)

The backend is an Express.js application suitable for containerized hosting on Railway.

1. Connect your GitHub repository to Railway.
2. Setup a new service using the `packages/backend` directory as the root.
3. Add a MongoDB service within Railway or use an external connection string.
4. Configure all environment variables from `packages/backend/.env.example` in the Railway dashboard.
5. Set the Start Command: `pnpm start`

### AWS / Azure / Other Platforms

You can deploy the backend to any platform that supports Node.js or Docker.

**Docker Deployment:**
Use the provided `Dockerfile` (if available) or create one for the backend:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml turbo.json ./
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared
# ... (Add other workspace dependencies as needed)
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
CMD ["node", "packages/backend/dist/index.js"]
```

**Azure Bicep/ARM:**
1. Define your infrastructure (App Service, CosmosDB or Mongo, Application Insights).
2. Deploy the infrastructure using CLI: `az deployment group create ...`.
3. Configure App Settings in the App Service with your environment variables.

## 🔑 Environment Variables

### Backend (`packages/backend/.env`)

| Variable | Description | Dummy Value |
|----------|-------------|-------------|
| `MONGODB_URI` | MongoDB Connection String | `mongodb://localhost:27017/video-forge` |
| `AZURE_API_KEY` | Azure OpenAI Key | `your_azure_key_123` |
| `AZURE_API_VERSION` | API Version | `2024-04-01-preview` |
| `AZURE_ENDPOINT` | Azure OpenAI Endpoint | `https://your-resource.openai.azure.com` |
| `AZURE_MODEL_NAME` | Main Model Name | `gpt-4o` |
| `AZURE_DEPLOYMENT` | Deployment Name | `gpt-4o` |
| `AZURE_MODEL_SORA` | Sora Model Name | `sora` |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key | `xi_api_key_12345` |
| `ELEVENLABS_VOICE_ID` | Default Voice ID | `21m00Tcm4TlvDq8ikWAM` |
| `ELEVENLABS_MODEL` | Speech Model | `eleven_flash_v2_5` |
| `PORT` | API Server Port | `3001` |
| `JWT_SECRET` | Secret for auth | `super_secret_jwt_key_123` |
| `JWT_EXPIRES_IN` | Token Expiry | `7d` |

### Frontend (`packages/frontend/.env.local`)

| Variable | Description | Dummy Value |
|----------|-------------|-------------|
| `NEXT_PUBLIC_API_URL` | URL of the backend API | `http://localhost:3001/api` |

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React 19, Tailwind CSS v4, Lucide Icons
- **Backend**: Express.js, MongoDB, Mongoose
- **AI Services**: Azure OpenAI (Sora, GPT-4o), ElevenLabs
- **Monorepo**: Turborepo, pnpm

## License

MIT
