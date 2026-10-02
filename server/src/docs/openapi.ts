const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Unsora API",
    version: "1.2.0",
    description:
      "Public API for Unsora integrations. Use Bearer token from Clerk in Authorization header.",
  },
  servers: [{ url: "/api/v1", description: "Versioned API" }],
  tags: [
    { name: "User" },
    { name: "Connect" },
    { name: "Stripe" },
    { name: "Video" },
    { name: "Image" },
    { name: "Influencer" },
    { name: "Thumbnail" },
    { name: "Clipping" },
    { name: "Music" },
    { name: "Voiceover" },
    { name: "Uploads" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" },
          code: { type: "string" },
          message: { type: "string" },
        },
        required: ["error"],
      },
      UploadAsset: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: {
            type: "string",
            description: "Public URL of the stored file.",
          },
          mimeType: { type: "string" },
          type: {
            type: "string",
            enum: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
          },
          fileSize: { type: "integer", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      UploadAssetResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/UploadAsset" },
        },
      },
      SuccessMessage: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
        },
      },
      AuthUrlResponse: {
        type: "object",
        properties: {
          authUrl: { type: "string", format: "uri" },
        },
        required: ["authUrl"],
      },
      UserProfileData: {
        type: "object",
        properties: {
          id: { type: "string" },
          clerkId: { type: "string" },
          email: { type: "string", format: "email" },
          plan: { type: "string" },
          isActive: { type: "boolean" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          credits: { type: "number" },
        },
        required: [
          "id",
          "clerkId",
          "email",
          "plan",
          "isActive",
          "status",
          "credits",
        ],
      },
      UserUsageResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  clerkId: { type: "string" },
                  email: { type: "string", format: "email" },
                  plan: { type: "string" },
                  isActive: { type: "boolean" },
                  status: { type: "string" },
                  isCancelled: { type: "boolean" },
                  stripeCurrentPeriodEnd: {
                    anyOf: [
                      { type: "string", format: "date-time" },
                      { type: "null" },
                    ],
                  },
                },
                required: [
                  "id",
                  "clerkId",
                  "email",
                  "plan",
                  "isActive",
                  "status",
                  "isCancelled",
                  "stripeCurrentPeriodEnd",
                ],
              },
              credits: { type: "number" },
            },
            required: ["user", "credits"],
          },
        },
        required: ["success", "data"],
      },
      CreditsResponse: {
        type: "object",
        properties: { credits: { type: "number" } },
        required: ["credits"],
      },
      CreditGrant: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          amount: { type: "number" },
          used: { type: "number" },
          remaining: { type: "number" },
          expiresAt: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          createdAt: { type: "string", format: "date-time" },
          reason: { type: "string" },
        },
        required: [
          "id",
          "source",
          "amount",
          "used",
          "remaining",
          "createdAt",
          "reason",
        ],
      },
      SocialAccount: {
        type: "object",
        properties: {
          id: { type: "string" },
          provider: { type: "string" },
          providerAccountId: { type: "string" },
          accountName: { anyOf: [{ type: "string" }, { type: "null" }] },
          accountUsername: { anyOf: [{ type: "string" }, { type: "null" }] },
          profilePicture: {
            anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
          },
          expiresAt: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
        },
        required: [
          "id",
          "provider",
          "providerAccountId",
          "accountName",
          "accountUsername",
          "profilePicture",
          "expiresAt",
        ],
      },
      ConnectedAccountsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/SocialAccount" },
          },
        },
        required: ["success", "data"],
      },
      RefreshAccountResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: { $ref: "#/components/schemas/SocialAccount" },
        },
        required: ["success", "message", "data"],
      },
      SubscriptionResponse: {
        type: "object",
        properties: {
          stripeSubscriptionId: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          stripeCustomerId: { anyOf: [{ type: "string" }, { type: "null" }] },
          stripePriceId: { anyOf: [{ type: "string" }, { type: "null" }] },
          stripeCurrentPeriodEnd: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          isActive: { type: "boolean" },
          plan: { type: "string" },
          status: { type: "string" },
          isCancelled: { type: "boolean" },
        },
        required: [
          "stripeSubscriptionId",
          "stripeCustomerId",
          "stripePriceId",
          "stripeCurrentPeriodEnd",
          "isActive",
          "plan",
          "status",
          "isCancelled",
        ],
      },
      CheckoutSessionRequest: {
        type: "object",
        properties: {
          priceId: { type: "string" },
        },
        required: ["priceId"],
      },
      CheckoutSessionResponse: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          success: { type: "boolean" },
        },
      },
      TopupSessionRequest: {
        type: "object",
        properties: {
          packKey: { type: "string" },
        },
        required: ["packKey"],
      },
      CreditPack: {
        type: "object",
        properties: {
          key: { type: "string" },
          name: { type: "string" },
          credits: { type: "number" },
          priceUsd: { type: "number" },
          description: { type: "string" },
          popular: { type: "boolean" },
        },
        required: ["key", "name", "credits", "priceUsd", "popular"],
      },
      CreditPacksResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/CreditPack" },
          },
        },
        required: ["success", "data"],
      },
      TrialUpgradeResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          subscription: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              plan: { type: "string" },
              priceId: { type: "string" },
              credits: { type: "number" },
            },
            required: ["id", "status", "plan", "priceId", "credits"],
          },
        },
        required: ["success", "message", "subscription"],
      },
      TikTokCreatorInfoResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
        },
        required: ["success", "data"],
      },
      VideoGenerationSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          model: { type: "string" },
          prompt: { type: "string" },
          status: { type: "string" },
          ratio: { type: "string" },
          duration: { type: "integer" },
          creditsUsed: { type: "integer" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          outputAsset: { type: "object", additionalProperties: true },
          thumbnailAsset: { type: "object", additionalProperties: true },
        },
        required: ["id", "model", "status", "createdAt"],
      },
      VideoCreateRequest: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: { type: "string" },
          model: {
            type: "string",
            enum: [
              "kling-standard",
              "kling-pro",
              "veo",
              "veo-fast",
              "veo-lite",
              "sora-2",
              "sora-2-pro",
              "wan",
              "seedance-2.0",
              "seedance-2.0-fast",
              "seedance-2.0-mini",
              "gemini-omni-flash",
            ],
            default: "seedance-2.0",
            description: "Video model to generate with.",
          },
          duration: { type: "integer", default: 5 },
          aspectRatio: {
            type: "string",
            default: "16:9",
            description: "Aspect ratio. Valid values depend on the model.",
          },
          negativePrompt: {
            type: "string",
            description: "Not supported by Sora models or Seedance.",
          },
          resolution: {
            type: "string",
            description:
              "Output resolution (e.g. 720p, 1080p) for models that support it (Wan 2.6).",
          },
          sound: {
            type: "boolean",
            default: false,
            description:
              "Generate audio. Supported by Kling v3 and Veo 3.1 models.",
          },
          image: {
            type: "string",
            format: "uri",
            description:
              "Start image for image-to-video. For Seedance this triggers first/last-frame mode.",
          },
          lastImage: {
            type: "string",
            format: "uri",
            description:
              "End/last image, for models that support start/end frames.",
          },
          referenceImages: {
            type: "array",
            items: { type: "string", format: "uri" },
            description:
              "Reference image URLs (Veo 3.1 reference mode; Seedance omni reference, up to 9; Gemini Omni Flash reference-to-video, up to 4).",
          },
          referenceVideos: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Seedance omni reference only — up to 3 video URLs.",
          },
          referenceAudios: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Seedance omni reference only — up to 3 audio URLs.",
          },
          generateAudio: {
            type: "boolean",
            default: false,
            description:
              "Seedance only — generate a soundtrack/audio for the video.",
          },
        },
      },
      VideoCreateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generation: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
            required: ["id", "status"],
          },
          model: { type: "string" },
          creditsDeducted: { type: "integer" },
          creditsRemaining: { type: "integer" },
        },
        required: ["success", "generation"],
      },
      VideoListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generations: {
            type: "array",
            items: { $ref: "#/components/schemas/VideoGenerationSummary" },
          },
          pagination: {
            type: "object",
            properties: {
              currentPage: { type: "integer" },
              totalPages: { type: "integer" },
              totalCount: { type: "integer" },
              limit: { type: "integer" },
              hasNextPage: { type: "boolean" },
              hasPreviousPage: { type: "boolean" },
            },
          },
        },
        required: ["success", "generations", "pagination"],
      },
      VideoStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string" },
              model: { type: "string" },
              status: { type: "string" },
              outputUrl: {
                anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
              },
              thumbnailUrl: {
                anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
              },
              error: { anyOf: [{ type: "string" }, { type: "null" }] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              completedAt: {
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
            },
            required: ["id", "status"],
          },
        },
        required: ["success", "data"],
      },
      PaginationMeta: {
        type: "object",
        properties: {
          currentPage: { type: "integer" },
          totalPages: { type: "integer" },
          totalCount: { type: "integer" },
          limit: { type: "integer" },
          hasNextPage: { type: "boolean" },
          hasPreviousPage: { type: "boolean" },
        },
      },
      ImageGenerationRecord: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          prompt: { type: "string" },
          model: { type: "string" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          outputAsset: { type: "object", additionalProperties: true },
          thumbnailAsset: { type: "object", additionalProperties: true },
        },
        required: ["id", "status", "createdAt"],
      },
      ImageGenerationListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generations: {
            type: "array",
            items: { $ref: "#/components/schemas/ImageGenerationRecord" },
          },
          pagination: { $ref: "#/components/schemas/PaginationMeta" },
        },
        required: ["success", "generations", "pagination"],
      },
      ImageGenerationGetResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generation: { $ref: "#/components/schemas/ImageGenerationRecord" },
        },
        required: ["success", "generation"],
      },
      MusicGenerationRecord: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          lyrics: { type: "string" },
          prompt: { type: "string" },
          model: { type: "string" },
          outputFormat: { type: "string" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          outputAsset: { type: "object", additionalProperties: true },
        },
        required: ["id", "status", "createdAt"],
      },
      CreateMusicGenerationRequest: {
        type: "object",
        properties: {
          lyrics: {
            type: "string",
            description:
              "Song lyrics (required for song models, up to 3000 chars)",
          },
          prompt: {
            type: "string",
            description:
              "Style prompt — genre, mood, vocal style (up to 1024 chars)",
          },
          model: {
            type: "string",
            default: "auto",
            description:
              "Model key: auto, mureka-9, mureka-8, mureka-o2, mureka-7.6, mureka-7.5",
          },
          output_format: {
            type: "string",
            enum: ["mp3", "wav", "flac"],
            default: "mp3",
          },
        },
      },
      CreateMusicGenerationResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generation: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
            required: ["id", "status"],
          },
          creditsDeducted: { type: "number" },
          creditsRemaining: { type: "number" },
        },
        required: [
          "success",
          "generation",
          "creditsDeducted",
          "creditsRemaining",
        ],
      },
      MusicGenerationListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generations: {
            type: "array",
            items: { $ref: "#/components/schemas/MusicGenerationRecord" },
          },
          pagination: { $ref: "#/components/schemas/PaginationMeta" },
        },
        required: ["success", "generations", "pagination"],
      },
      MusicGenerationGetResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generation: { $ref: "#/components/schemas/MusicGenerationRecord" },
        },
        required: ["success", "generation"],
      },
      MusicStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              outputUrl: {
                anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
              },
              error: { anyOf: [{ type: "string" }, { type: "null" }] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              completedAt: {
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
            },
            required: ["id", "status"],
          },
        },
        required: ["success", "data"],
      },
      VoiceoverVoice: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "voice_id to pass to /voiceovers/create",
          },
          label: { type: "string" },
          description: { type: "string" },
          gender: { type: "string", enum: ["male", "female", "neutral"] },
          accent: { type: "string" },
          previewUrl: {
            anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
            description: "Short sample clip of the voice",
          },
        },
        required: ["id", "label", "description", "gender", "accent"],
      },
      VoiceoverVoicesResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          voices: {
            type: "array",
            items: { $ref: "#/components/schemas/VoiceoverVoice" },
          },
        },
        required: ["success", "voices"],
      },
      VoiceoverRecord: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          text: { type: "string" },
          voiceId: { type: "string" },
          model: { type: "string" },
          outputFormat: { type: "string" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          outputAsset: { type: "object", additionalProperties: true },
        },
        required: ["id", "status", "createdAt"],
      },
      CreateVoiceoverRequest: {
        type: "object",
        properties: {
          text: {
            type: "string",
            maxLength: 10000,
            description:
              "Script to convert to speech (max 10,000 chars). Supports <#x#> tags between words to pause for x seconds (0.01–99.99).",
          },
          voice_id: {
            type: "string",
            enum: [
              "Aria",
              "Roger",
              "Sarah",
              "Laura",
              "Charlie",
              "George",
              "Callum",
              "River",
              "Liam",
              "Charlotte",
              "Alice",
              "Matilda",
              "Will",
              "Jessica",
              "Eric",
              "Chris",
              "Brian",
              "Daniel",
              "Lily",
              "Bill",
            ],
            description:
              "Eleven v3 voice id — see GET /voiceovers/voices for descriptions and preview clips",
          },
          stability: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.5,
            description:
              "Higher = more consistent delivery, lower = more expressive",
          },
          similarity: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 1,
            description: "How closely the output sticks to the base voice",
          },
        },
        required: ["text", "voice_id"],
      },
      CreateVoiceoverResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generation: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
            required: ["id", "status"],
          },
          creditsDeducted: { type: "number" },
          creditsRemaining: { type: "number" },
        },
        required: [
          "success",
          "generation",
          "creditsDeducted",
          "creditsRemaining",
        ],
      },
      VoiceoverListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generations: {
            type: "array",
            items: { $ref: "#/components/schemas/VoiceoverRecord" },
          },
          pagination: { $ref: "#/components/schemas/PaginationMeta" },
        },
        required: ["success", "generations", "pagination"],
      },
      VoiceoverStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              voiceId: { type: "string" },
              outputUrl: {
                anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
              },
              error: { anyOf: [{ type: "string" }, { type: "null" }] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              completedAt: {
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
            },
            required: ["id", "status"],
          },
        },
        required: ["success", "data"],
      },
      ImageStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              outputUrl: {
                anyOf: [{ type: "string", format: "uri" }, { type: "null" }],
              },
              error: { anyOf: [{ type: "string" }, { type: "null" }] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              completedAt: {
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
            },
            required: ["id", "status"],
          },
        },
        required: ["success", "data"],
      },
      ThumbnailRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          title: { anyOf: [{ type: "string" }, { type: "null" }] },
          description: { anyOf: [{ type: "string" }, { type: "null" }] },
          image: { type: "string" },
          link: { anyOf: [{ type: "string" }, { type: "null" }] },
          jobId: { anyOf: [{ type: "string" }, { type: "null" }] },
          status: { type: "string" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          completedAt: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "status", "createdAt"],
      },
      ThumbnailListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ThumbnailRecord" },
          },
        },
        required: ["success", "data"],
      },
      ThumbnailGetResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/ThumbnailRecord" },
        },
        required: ["success", "data"],
      },
      ClippingJob: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          videoUrl: { type: "string" },
          error: { anyOf: [{ type: "string" }, { type: "null" }] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          clips: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
        required: ["id", "status"],
      },
      ClippingListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ClippingJob" },
          },
        },
        required: ["success", "data"],
      },
      ClippingGetResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { $ref: "#/components/schemas/ClippingJob" },
        },
        required: ["success", "data"],
      },
    },
  },
  paths: {
    "/user/sync": {
      post: {
        tags: ["User"],
        summary: "Ensure authenticated user exists in DB",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User synced",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string", format: "email" },
                      },
                      required: ["id", "email"],
                    },
                  },
                  required: ["success", "data"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/user/profile": {
      get: {
        tags: ["User"],
        summary: "Get authenticated user profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/UserProfileData" },
                  },
                  required: ["success", "data"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/user/usage": {
      get: {
        tags: ["User"],
        summary: "Get plan and credits usage details",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Usage details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserUsageResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/user/credits": {
      get: {
        tags: ["User"],
        summary: "Get current credits balance",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Credits balance",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreditsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/user/credit-grants": {
      get: {
        tags: ["User"],
        summary: "List active credit grants in FIFO order",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Active grants",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CreditGrant" },
                    },
                  },
                  required: ["success", "data"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/google": {
      get: {
        tags: ["Connect"],
        summary: "Get Google OAuth URL",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OAuth URL",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUrlResponse" },
              },
            },
          },
          "403": {
            description: "Paid plan required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/tiktok": {
      get: {
        tags: ["Connect"],
        summary: "Get TikTok OAuth URL",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OAuth URL",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUrlResponse" },
              },
            },
          },
          "403": {
            description: "Paid plan required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/facebook": {
      get: {
        tags: ["Connect"],
        summary: "Get Facebook OAuth URL",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OAuth URL",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUrlResponse" },
              },
            },
          },
          "403": {
            description: "Paid plan required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/instagram": {
      get: {
        tags: ["Connect"],
        summary: "Get Instagram OAuth URL",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OAuth URL",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUrlResponse" },
              },
            },
          },
          "403": {
            description: "Paid plan required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/google/callback": {
      get: {
        tags: ["Connect"],
        summary: "Google OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": { description: "Redirect to scheduler UI with status" },
        },
      },
    },
    "/connect/tt/callback": {
      get: {
        tags: ["Connect"],
        summary: "TikTok OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "error",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "error_description",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": { description: "Redirect to scheduler UI with status" },
        },
      },
    },
    "/connect/facebook/callback": {
      get: {
        tags: ["Connect"],
        summary: "Facebook OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": { description: "Redirect to scheduler UI with status" },
        },
      },
    },
    "/connect/instagram/callback": {
      get: {
        tags: ["Connect"],
        summary: "Instagram OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": { description: "Redirect to scheduler UI with status" },
        },
      },
    },
    "/connect/accounts": {
      get: {
        tags: ["Connect"],
        summary: "List connected social accounts",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Connected accounts list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConnectedAccountsResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/accounts/{accountId}/refresh": {
      post: {
        tags: ["Connect"],
        summary: "Refresh one connected account token",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "accountId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshAccountResponse" },
              },
            },
          },
          "400": {
            description: "Missing token or unsupported provider",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/accounts/{accountId}": {
      delete: {
        tags: ["Connect"],
        summary: "Disconnect one social account",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "accountId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Disconnected",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Account not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/connect/tiktok/{accountId}/creator-info": {
      get: {
        tags: ["Connect"],
        summary: "Get TikTok creator info for connected account",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "accountId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Creator info",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TikTokCreatorInfoResponse",
                },
              },
            },
          },
          "404": {
            description: "TikTok account not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/create-checkout-session": {
      post: {
        tags: ["Stripe"],
        summary: "Create subscription checkout session",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CheckoutSessionRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Checkout URL",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CheckoutSessionResponse",
                },
              },
            },
          },
          "500": {
            description: "Creation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/cancel-trial": {
      post: {
        tags: ["Stripe"],
        summary: "Cancel active trial immediately",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Trial cancelled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "400": {
            description: "No trial found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/get-paid-subscription": {
      post: {
        tags: ["Stripe"],
        summary: "Upgrade trial to paid now",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Upgrade successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TrialUpgradeResponse" },
              },
            },
          },
          "400": {
            description: "Invalid subscription state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/user-subscription": {
      get: {
        tags: ["Stripe"],
        summary: "Get authenticated user subscription snapshot",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Subscription object",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SubscriptionResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/get-billing-portal-url": {
      get: {
        tags: ["Stripe"],
        summary: "Get Stripe billing portal URL",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Billing portal URL",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                  },
                  required: ["url"],
                },
              },
            },
          },
          "400": {
            description: "No stripe customer on user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/credit-packs": {
      get: {
        tags: ["Stripe"],
        summary: "List purchasable top-up packs",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Pack catalog",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreditPacksResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/create-topup-session": {
      post: {
        tags: ["Stripe"],
        summary: "Create checkout session for one-time top-up pack",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TopupSessionRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Top-up checkout URL",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    url: { type: "string", format: "uri" },
                  },
                  required: ["success", "url"],
                },
              },
            },
          },
          "403": {
            description: "Subscription required for topups",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/stripe/webhook": {
      post: {
        tags: ["Stripe"],
        summary: "Stripe webhook receiver",
        parameters: [
          {
            name: "stripe-signature",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook accepted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    received: { type: "boolean" },
                  },
                  required: ["received"],
                },
              },
            },
          },
          "400": {
            description: "Invalid signature",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/videos/create": {
      post: {
        tags: ["Video"],
        summary:
          "Create a video generation (Kling v3, Veo 3.1, Sora 2, Wan 2.6, Seedance 2.0, Gemini Omni Flash)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VideoCreateRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Generation queued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoCreateResponse" },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/videos/all": {
      get: {
        tags: ["Video"],
        summary: "List video generations (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 12, maximum: 100 },
          },
          {
            name: "model",
            in: "query",
            description:
              "Filter by video model key (e.g. seedance-2.0, veo, kling-pro).",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoListResponse" },
              },
            },
          },
        },
      },
    },
    "/videos/{generationId}": {
      delete: {
        tags: ["Video"],
        summary: "Delete a video generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/video/status/{id}": {
      get: {
        tags: ["Video"],
        summary: "Get video generation status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VideoStatusResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/image/status/{id}": {
      get: {
        tags: ["Image"],
        summary: "Poll image / influencer / thumbnail generation status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImageStatusResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/image-generations/all": {
      get: {
        tags: ["Image"],
        summary: "List image generations (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 12, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ImageGenerationListResponse",
                },
              },
            },
          },
        },
      },
    },
    "/image-generations/{generationId}": {
      get: {
        tags: ["Image"],
        summary: "Get one image generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Generation record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ImageGenerationGetResponse",
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Image"],
        summary: "Delete an image generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/voiceovers/voices": {
      get: {
        tags: ["Voiceover"],
        summary: "List Eleven v3 voices with preview clips",
        description:
          "Returns the 20 ElevenLabs Eleven v3 voices available for voiceover generation. " +
          "Each voice includes a short previewUrl clip so users can pick a voice by ear.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Voice catalog",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VoiceoverVoicesResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voiceovers/create": {
      post: {
        tags: ["Voiceover"],
        summary: "Create a script-to-voiceover job (ElevenLabs Eleven v3)",
        description:
          "Converts a script (max 10,000 chars) into natural speech using ElevenLabs Eleven v3. " +
          "Costs 6 credits per started 1,000 characters. Output is always mp3. Poll /voiceovers/status/{id} for the result.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateVoiceoverRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Job queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateVoiceoverResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/voiceovers/status/{id}": {
      get: {
        tags: ["Voiceover"],
        summary: "Poll voiceover status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VoiceoverStatusResponse",
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/voiceovers/all": {
      get: {
        tags: ["Voiceover"],
        summary: "List voiceovers (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 12, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VoiceoverListResponse" },
              },
            },
          },
        },
      },
    },
    "/voiceovers/{generationId}": {
      delete: {
        tags: ["Voiceover"],
        summary: "Delete a voiceover",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/music/status/{id}": {
      get: {
        tags: ["Music"],
        summary: "Poll music generation status",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MusicStatusResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/music-generations/create": {
      post: {
        tags: ["Music"],
        summary: "Create a Mureka AI music generation job",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateMusicGenerationRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Job queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateMusicGenerationResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/music-generations/all": {
      get: {
        tags: ["Music"],
        summary: "List music generations (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 12, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MusicGenerationListResponse",
                },
              },
            },
          },
        },
      },
    },
    "/music-generations/{generationId}": {
      get: {
        tags: ["Music"],
        summary: "Get one music generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Generation record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MusicGenerationGetResponse",
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Music"],
        summary: "Delete a music generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/influencer-studio/all": {
      get: {
        tags: ["Influencer"],
        summary: "List influencer studio generations (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ImageGenerationListResponse",
                },
              },
            },
          },
        },
      },
    },
    "/influencer-studio/{generationId}": {
      delete: {
        tags: ["Influencer"],
        summary: "Delete an influencer generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/thumbnails": {
      get: {
        tags: ["Thumbnail"],
        summary: "List thumbnail generations",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ThumbnailListResponse" },
              },
            },
          },
        },
      },
    },
    "/thumbnails/{generationId}": {
      get: {
        tags: ["Thumbnail"],
        summary: "Get one thumbnail generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Thumbnail record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ThumbnailGetResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Thumbnail"],
        summary: "Delete a thumbnail generation",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/clippings/all": {
      get: {
        tags: ["Clipping"],
        summary: "List clipping jobs",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ClippingListResponse" },
              },
            },
          },
        },
      },
    },
    "/clippings/status/{clippingId}": {
      get: {
        tags: ["Clipping"],
        summary:
          "Poll clipping job status (syncs with provider when in progress)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "clippingId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Job with clips",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ClippingGetResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/clippings/{clippingId}": {
      get: {
        tags: ["Clipping"],
        summary: "Get one clipping job (read-only, no provider sync)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "clippingId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Job with clips",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ClippingGetResponse" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Clipping"],
        summary: "Delete a clipping job",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "clippingId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/clippings/{clippingId}/clips/{clipId}": {
      delete: {
        tags: ["Clipping"],
        summary: "Delete one clip from a clipping job",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "clippingId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "clipId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Upload media from a URL or base64 payload",
        description:
          "Imports a file into your media library. Pass either `url` (public http(s) URL, " +
          "max 200MB — the server fetches the bytes) or `base64` (raw base64 or a data: URL, " +
          "for small files; the request body is capped at 10MB). The file is stored and " +
          "recorded as an upload asset; the returned `url` can be used anywhere a media URL " +
          "is accepted (post media, reference images, clipping input). " +
          "For large local files use the signed-URL flow: POST /uploads/signed-url, then " +
          "PUT the bytes, then POST /uploads/complete.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "Public http(s) URL to import (max 200MB).",
                  },
                  base64: {
                    type: "string",
                    description:
                      "Base64 file contents (raw or data: URL). Requires fileName.",
                  },
                  fileName: {
                    type: "string",
                    description:
                      "Stored file name (required with base64, optional with url).",
                  },
                  contentType: {
                    type: "string",
                    description: "MIME type override, e.g. image/png.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Uploaded asset",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadAssetResponse" },
              },
            },
          },
          "400": {
            description: "Invalid input",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        tags: ["Uploads"],
        summary: "List your uploaded media",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 12, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated uploads",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        uploads: {
                          type: "array",
                          items: { $ref: "#/components/schemas/UploadAsset" },
                        },
                        pagination: {
                          type: "object",
                          properties: {
                            page: { type: "integer" },
                            limit: { type: "integer" },
                            total: { type: "integer" },
                            totalPages: { type: "integer" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/uploads/signed-url": {
      post: {
        tags: ["Uploads"],
        summary: "Mint a signed direct-upload URL (large files)",
        description:
          "Mints a short-lived signed URL so the file bytes go directly to storage without " +
          "passing through the API (use for files too large for POST /uploads). " +
          "Flow: 1) call this with fileName; 2) PUT the file bytes to `uploadUrl` with the " +
          "correct Content-Type header; 3) POST /uploads/complete with the returned " +
          "`blobName` to register the file in your media library.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fileName"],
                properties: {
                  fileName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Signed upload URL",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        uploadUrl: {
                          type: "string",
                          description: "PUT the file bytes here.",
                        },
                        token: { type: "string" },
                        publicUrl: {
                          type: "string",
                          description:
                            "Public URL the file will have after upload.",
                        },
                        blobName: {
                          type: "string",
                          description: "Pass to POST /uploads/complete.",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/uploads/complete": {
      post: {
        tags: ["Uploads"],
        summary: "Register a direct-uploaded file as an asset",
        description:
          "Call after PUTting the file bytes to a signed upload URL. Verifies the object " +
          "exists in storage and records it in your media library. blobName must come from " +
          "your own /uploads/signed-url response.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["blobName"],
                properties: {
                  blobName: { type: "string" },
                  fileName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Registered asset",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadAssetResponse" },
              },
            },
          },
          "400": {
            description: "Upload not found in storage",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/uploads/{assetId}": {
      delete: {
        tags: ["Uploads"],
        summary: "Delete an uploaded asset",
        description: "Deletes the asset record and removes the stored file.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "assetId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export default openApiDocument;
