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
    { name: "Scheduler" },
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
      PostAccountInput: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description:
              "Connected account id from GET /accounts. Alias: accountId. Each account may appear once per post.",
          },
          customCaption: {
            type: "string",
            description: "Caption for this account only. Replaces caption.",
          },
          title: {
            type: "string",
            description:
              "Video title, used by YouTube. Defaults to the first 100 characters of the caption.",
          },
        },
        required: ["id"],
      },
      PostVideoMediaInput: {
        type: "object",
        description: "One video. Creates a VIDEO post.",
        properties: {
          type: {
            type: "string",
            enum: ["video"],
            description: "Matched case-insensitively.",
          },
          url: {
            type: "string",
            format: "uri",
            description:
              "Public URL of the video file, for example the `url` returned by POST /uploads.",
          },
          cover_url: {
            type: "string",
            format: "uri",
            description:
              "Cover image URL. Added to the post as its THUMBNAIL media item and used as the Instagram Reel cover. Alias: coverUrl. Takes precedence over settings.instagram.cover_url.",
          },
          width: { type: "integer" },
          height: { type: "integer" },
          duration_sec: {
            type: "number",
            description:
              "Duration in seconds. Aliases: duration_seconds, duration, durationSec, video_duration_sec.",
          },
          bytes: {
            type: "integer",
            description: "File size in bytes. Alias: size.",
          },
          mime_type: {
            type: "string",
            description: "MIME type, e.g. video/mp4. Aliases: mime, mimeType.",
          },
          metadata: {
            type: "object",
            additionalProperties: true,
            description:
              "Optional. May carry the duration, size and MIME type fields instead of the top level.",
          },
        },
        required: ["type", "url"],
      },
      PostSlideshowMediaInput: {
        type: "object",
        description: "Images for a carousel or photo post. Creates a CAROUSEL post.",
        properties: {
          type: {
            type: "string",
            enum: ["slideshow"],
            description: "Matched case-insensitively.",
          },
          urls: {
            type: "array",
            items: { type: "string", format: "uri" },
            minItems: 1,
            maxItems: 35,
            description: "Image URLs in display order.",
          },
        },
        required: ["type", "urls"],
      },
      PostMediaItemInput: {
        type: "object",
        description: "One media item in the array form of `media`.",
        properties: {
          type: {
            type: "string",
            enum: ["VIDEO", "IMAGE", "THUMBNAIL"],
            description:
              "THUMBNAIL is a video cover image (used as the Instagram Reel cover).",
          },
          url: { type: "string", format: "uri" },
          order: {
            type: "integer",
            description: "Display order. Defaults to the array index.",
          },
          width: { type: "integer" },
          height: { type: "integer" },
          duration: { type: "number", description: "Duration in seconds." },
          fileSize: { type: "integer", description: "File size in bytes." },
          mimeType: { type: "string" },
        },
        required: ["type", "url"],
      },
      InstagramPostSettings: {
        type: "object",
        description: "Options applied to Instagram accounts.",
        properties: {
          cover_url: {
            type: "string",
            format: "uri",
            description:
              "Reel cover image URL for VIDEO posts. Alias: coverUrl. The image is added to the post as its THUMBNAIL media item. Ignored when the video already has a cover (media.cover_url or a THUMBNAIL item). Without a cover, Instagram uses the frame at 5 seconds.",
          },
        },
      },
      TikTokPostSettings: {
        type: "object",
        description:
          "Options applied to TikTok accounts. The camelCase spelling of each key is also accepted (e.g. privacyLevel). Values of the wrong type are rejected with 400.",
        properties: {
          privacy_level: {
            type: "string",
            default: "PUBLIC_TO_EVERYONE",
            description:
              "Who can view the post: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR or SELF_ONLY. Must be an option TikTok allows for the creator account.",
          },
          disable_comment: { type: "boolean", default: false },
          disable_duet: {
            type: "boolean",
            default: false,
            description: "Video posts only.",
          },
          disable_stitch: {
            type: "boolean",
            default: false,
            description: "Video posts only.",
          },
          brand_content_toggle: {
            type: "boolean",
            description:
              "Discloses a paid partnership promoting a third-party brand. Sent only when set.",
          },
          brand_organic_toggle: {
            type: "boolean",
            description:
              "Discloses that the post promotes the creator's own business. Sent only when set.",
          },
          is_aigc: {
            type: "boolean",
            description: "Labels the post as AI-generated content. Sent only when set.",
          },
          auto_add_music: {
            type: "boolean",
            description:
              "Photo posts only. Lets TikTok add background music. Sent only when set.",
          },
          post_mode: {
            type: "string",
            enum: ["DIRECT_POST", "MEDIA_UPLOAD"],
            default: "DIRECT_POST",
            description:
              "Photo posts only. DIRECT_POST publishes the post. MEDIA_UPLOAD sends it to the creator's TikTok inbox to finish in the TikTok app.",
          },
          photo_cover_index: {
            type: "integer",
            minimum: 0,
            default: 0,
            description:
              "Photo posts only. Zero-based index of the cover image, limited to the last image.",
          },
          video_cover_timestamp_ms: {
            type: "integer",
            default: 1000,
            description:
              "Video posts only. Frame used as the cover, in milliseconds from the start.",
          },
          music_usage_confirmation: {
            type: "boolean",
            description: "Stored with the account settings. Not sent to TikTok.",
          },
        },
      },
      YouTubePostSettings: {
        type: "object",
        description:
          "Options applied to YouTube accounts (provider google). snake_case spellings are also accepted: privacy_status, category_id, made_for_kids.",
        properties: {
          privacyStatus: {
            type: "string",
            enum: ["public", "private", "unlisted"],
            default: "public",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Video tags. Each tag must be a non-empty string.",
          },
          categoryId: {
            type: "string",
            default: "22",
            description: "YouTube video category id. 22 is People & Blogs.",
          },
          madeForKids: { type: "boolean", default: false },
        },
      },
      PinterestPostSettings: {
        type: "object",
        description: "Options applied to Pinterest accounts.",
        properties: {
          boardId: {
            type: "string",
            description:
              "Board to pin to. Alias: board_id. Defaults to the account's first board.",
          },
        },
      },
      PostPlatformSettings: {
        type: "object",
        additionalProperties: false,
        description:
          "Per-platform options. Each account receives only the options for its own platform; accounts on other platforms ignore them. Any other key is rejected with 400.",
        properties: {
          instagram: { $ref: "#/components/schemas/InstagramPostSettings" },
          tiktok: { $ref: "#/components/schemas/TikTokPostSettings" },
          youtube: { $ref: "#/components/schemas/YouTubePostSettings" },
          pinterest: { $ref: "#/components/schemas/PinterestPostSettings" },
        },
      },
      CreatePostRequest: {
        type: "object",
        properties: {
          caption: {
            type: "string",
            description:
              "Post text, used for every account that has no customCaption. Must not be empty. Alias: mainCaption.",
          },
          accounts: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            items: { $ref: "#/components/schemas/PostAccountInput" },
            description:
              "Accounts to publish to. Platforms can be mixed. Every account must belong to the caller.",
          },
          media: {
            description:
              "Omit or send null for a text post. Send a video object, a slideshow object, or an array of media items.",
            oneOf: [
              { $ref: "#/components/schemas/PostVideoMediaInput" },
              { $ref: "#/components/schemas/PostSlideshowMediaInput" },
              {
                type: "array",
                items: { $ref: "#/components/schemas/PostMediaItemInput" },
              },
              { type: "null" },
            ],
          },
          type: {
            type: "string",
            enum: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
            description:
              "Overrides the post type inferred from media. Inferred type: no media is TEXT; a video object is VIDEO; a slideshow object is CAROUSEL; an array is CAROUSEL when it has more than one item, VIDEO when its single item is a VIDEO, otherwise IMAGE.",
          },
          scheduled_at: {
            anyOf: [
              { type: "string", format: "date-time" },
              { type: "integer" },
              { type: "null" },
            ],
            description:
              "When to publish, as an ISO 8601 date-time with a UTC offset (Unix time in milliseconds is also accepted). Must be at least 2 minutes in the future. Omit, or send null or an empty string, to save a draft. Alias: scheduledFor.",
          },
          timezone: {
            type: "string",
            description:
              "IANA time zone name, e.g. Europe/Berlin. Stored with the schedule for display; it does not change how scheduled_at is read.",
          },
          settings: { $ref: "#/components/schemas/PostPlatformSettings" },
          instagram: {
            $ref: "#/components/schemas/InstagramPostSettings",
            description:
              "Same as settings.instagram. Ignored when settings.instagram is present.",
          },
          tiktok: {
            $ref: "#/components/schemas/TikTokPostSettings",
            description:
              "Same as settings.tiktok. Ignored when settings.tiktok is present.",
          },
          youtube: {
            $ref: "#/components/schemas/YouTubePostSettings",
            description:
              "Same as settings.youtube. Ignored when settings.youtube is present.",
          },
          pinterest: {
            $ref: "#/components/schemas/PinterestPostSettings",
            description:
              "Same as settings.pinterest. Ignored when settings.pinterest is present.",
          },
          external_id: {
            type: "string",
            description:
              "Your own identifier for this request. With an API key and no Idempotency-Key header, its first 128 characters are used as the idempotency key. Not stored on the post.",
          },
        },
        required: ["caption", "accounts"],
      },
      PostSummary: {
        type: "object",
        description:
          "Short form of a post returned by POST /posts. Uses lowercase values; GET /posts/{id} returns the full record.",
        properties: {
          id: { type: "string" },
          status: {
            type: "string",
            enum: [
              "draft",
              "scheduled",
              "publishing",
              "published",
              "partially_published",
              "failed",
            ],
          },
          type: {
            type: "string",
            enum: ["video", "image", "slideshow", "text"],
            description: "CAROUSEL posts are reported as slideshow.",
          },
          caption: { type: "string" },
          scheduled_at: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          accounts: {
            type: "array",
            items: { type: "string" },
            description: "Account ids.",
          },
        },
        required: ["id", "status", "type", "caption", "scheduled_at", "accounts"],
      },
      CreatePostResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: {
            type: "string",
            description: '"Post scheduled" or "Post saved as draft".',
          },
          data: { $ref: "#/components/schemas/PostSummary" },
        },
        required: ["success", "message", "data"],
      },
      PostMediaAsset: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          name: { type: "string" },
          url: { type: "string", format: "uri" },
          mimeType: { type: "string" },
          type: {
            type: "string",
            enum: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
          },
          source: {
            type: "string",
            enum: ["UPLOAD", "GENERATION", "PROCESSING", "EXPORT", "SYSTEM"],
          },
          fileSize: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Size in bytes, serialized as a string.",
          },
          width: { anyOf: [{ type: "integer" }, { type: "null" }] },
          height: { anyOf: [{ type: "integer" }, { type: "null" }] },
          duration: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "Duration in seconds.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "url", "mimeType", "type"],
      },
      PostMedia: {
        type: "object",
        properties: {
          id: { type: "string" },
          postId: { type: "string" },
          type: { type: "string", enum: ["VIDEO", "IMAGE", "THUMBNAIL"] },
          order: { type: "integer" },
          assetId: { type: "string" },
          asset: { $ref: "#/components/schemas/PostMediaAsset" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "postId", "type", "order", "assetId", "asset"],
      },
      PostAccount: {
        type: "object",
        description: "One account a post targets, with its publish result.",
        properties: {
          id: { type: "string" },
          postId: { type: "string" },
          accountId: { type: "string" },
          customCaption: { anyOf: [{ type: "string" }, { type: "null" }] },
          title: { anyOf: [{ type: "string" }, { type: "null" }] },
          settings: {
            anyOf: [
              { type: "object", additionalProperties: true },
              { type: "null" },
            ],
            description:
              "Platform options stored for this account (the matching entry of PostPlatformSettings).",
          },
          published: { type: "boolean" },
          publishedAt: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          publishedPostId: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Post id on the platform.",
          },
          publishedUrl: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Public URL of the post on the platform.",
          },
          error: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Error from the last publish attempt for this account.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          account: {
            type: "object",
            properties: {
              id: { type: "string" },
              provider: {
                type: "string",
                description:
                  "google (YouTube), tiktok, instagram, facebook, threads, bluesky, pinterest or linkedin.",
              },
              accountName: { anyOf: [{ type: "string" }, { type: "null" }] },
              accountUsername: { anyOf: [{ type: "string" }, { type: "null" }] },
              profilePicture: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
            required: ["id", "provider"],
          },
        },
        required: ["id", "postId", "accountId", "published", "account"],
      },
      Post: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          type: { type: "string", enum: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"] },
          mainCaption: { type: "string" },
          status: {
            type: "string",
            enum: [
              "DRAFT",
              "SCHEDULED",
              "PUBLISHING",
              "PUBLISHED",
              "PARTIALLY_PUBLISHED",
              "FAILED",
            ],
            description:
              "PUBLISHED: every account published. PARTIALLY_PUBLISHED: at least one account published and at least one failed. FAILED: no account published.",
          },
          error: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Summary of the last publishing failure.",
          },
          scheduledFor: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          scheduledTimezone: { anyOf: [{ type: "string" }, { type: "null" }] },
          publishedAt: {
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
          },
          source: {
            type: "string",
            enum: ["WEB", "API", "MCP"],
            description:
              "Where the post was created: the web app, the REST API, or the Unsora MCP server (requests with header X-Unsora-Client: mcp).",
          },
          apiKeyId: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description:
              "API key used to create the post. Null when it was created with a Clerk session or OAuth token.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          media: {
            type: "array",
            items: { $ref: "#/components/schemas/PostMedia" },
            description: "Sorted by order.",
          },
          postAccounts: {
            type: "array",
            items: { $ref: "#/components/schemas/PostAccount" },
          },
        },
        required: [
          "id",
          "type",
          "mainCaption",
          "status",
          "scheduledFor",
          "source",
          "createdAt",
          "media",
          "postAccounts",
        ],
      },
      PostResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: { $ref: "#/components/schemas/Post" },
        },
        required: ["success", "data"],
      },
      PostListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              posts: {
                type: "array",
                items: { $ref: "#/components/schemas/Post" },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  limit: { type: "integer" },
                  total: { type: "integer" },
                  totalPages: { type: "integer" },
                },
                required: ["page", "limit", "total", "totalPages"],
              },
            },
            required: ["posts", "pagination"],
          },
        },
        required: ["success", "data"],
      },
      UpdatePostRequest: {
        type: "object",
        properties: {
          mainCaption: {
            type: "string",
            minLength: 1,
            description: "New caption. Must not be empty.",
          },
          scheduledFor: {
            anyOf: [
              { type: "string", format: "date-time" },
              { type: "integer" },
              { type: "null" },
            ],
            description:
              "A date (ISO 8601 or Unix time in milliseconds) moves the post to SCHEDULED. null or an empty string clears the schedule; a SCHEDULED post returns to DRAFT.",
          },
          timezone: {
            type: "string",
            description:
              "IANA time zone name stored with the schedule. Read only when scheduledFor is a date. Clearing the schedule also clears the time zone.",
          },
          accounts: {
            type: "array",
            minItems: 1,
            description:
              "Replaces the account list. Accounts that already published are kept unchanged. Listed accounts are updated or added, and unpublished accounts that are not listed are removed. Existing accounts keep their platform settings; added accounts have none.",
            items: {
              type: "object",
              properties: {
                accountId: {
                  type: "string",
                  description: "Connected account id from GET /accounts.",
                },
                customCaption: { anyOf: [{ type: "string" }, { type: "null" }] },
                title: { anyOf: [{ type: "string" }, { type: "null" }] },
              },
              required: ["accountId"],
            },
          },
        },
      },
      PublishPostResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: {
            type: "string",
            description: '"Publishing started" or "Retry started".',
          },
          data: {
            type: "object",
            properties: {
              postId: { type: "string" },
              status: { type: "string", enum: ["PUBLISHING"] },
              results: {
                type: "array",
                items: { type: "object", additionalProperties: true },
                description:
                  "Always empty. Per-account results are on the post (GET /posts/{id}).",
              },
            },
            required: ["postId", "status", "results"],
          },
        },
        required: ["success", "message", "data"],
      },
      PostMetrics: {
        type: "object",
        description:
          "Cumulative counters. Metrics a platform does not expose are 0 (e.g. Bluesky views, TikTok saves, YouTube shares and saves). Facebook and LinkedIn likes count every reaction type. Pinterest views are impressions and shares are outbound clicks.",
        properties: {
          views: { type: "integer" },
          likes: { type: "integer" },
          comments: { type: "integer" },
          shares: { type: "integer" },
          saves: { type: "integer" },
        },
        required: ["views", "likes", "comments", "shares", "saves"],
      },
      AnalyticsSummaryResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              days: {
                type: "integer",
                description: "Window used, after clamping.",
              },
              totals: { $ref: "#/components/schemas/PostMetrics" },
              postCount: {
                type: "integer",
                description:
                  "Number of per-account posts published in the window.",
              },
              byPlatform: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    platform: { type: "string" },
                    posts: { type: "integer" },
                    views: { type: "integer" },
                    likes: { type: "integer" },
                    comments: { type: "integer" },
                    shares: { type: "integer" },
                    saves: { type: "integer" },
                  },
                  required: [
                    "platform",
                    "posts",
                    "views",
                    "likes",
                    "comments",
                    "shares",
                    "saves",
                  ],
                },
              },
              timeseries: {
                type: "array",
                description:
                  "One point per day from the start of the window to today. Each point sums every post's latest snapshot taken before the end of that day, so values are totals to date, not daily increments.",
                items: {
                  type: "object",
                  properties: {
                    date: {
                      type: "string",
                      format: "date",
                      description: "YYYY-MM-DD.",
                    },
                    views: { type: "integer" },
                    likes: { type: "integer" },
                    comments: { type: "integer" },
                    shares: { type: "integer" },
                  },
                  required: ["date", "views", "likes", "comments", "shares"],
                },
              },
              posts: {
                type: "array",
                description:
                  "One entry per account a post was published to, newest first.",
                items: {
                  type: "object",
                  properties: {
                    postAccountId: { type: "string" },
                    platform: {
                      type: "string",
                      description: "Account provider. YouTube is google.",
                    },
                    accountUsername: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    profilePicture: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    caption: {
                      type: "string",
                      description:
                        "The account's customCaption, or the post caption.",
                    },
                    postType: {
                      type: "string",
                      enum: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
                    },
                    publishedAt: {
                      anyOf: [
                        { type: "string", format: "date-time" },
                        { type: "null" },
                      ],
                    },
                    publishedUrl: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    metrics: { $ref: "#/components/schemas/PostMetrics" },
                    lastFetchedAt: {
                      anyOf: [
                        { type: "string", format: "date-time" },
                        { type: "null" },
                      ],
                      description:
                        "Time of the latest snapshot. Null when metrics have not been fetched yet; metrics are then 0.",
                    },
                  },
                  required: [
                    "postAccountId",
                    "platform",
                    "caption",
                    "postType",
                    "metrics",
                    "lastFetchedAt",
                  ],
                },
              },
            },
            required: [
              "days",
              "totals",
              "postCount",
              "byPlatform",
              "timeseries",
              "posts",
            ],
          },
        },
        required: ["success", "data"],
      },
      AnalyticsRefreshResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              refreshed: {
                type: "integer",
                description:
                  "Number of per-account posts that received a new metrics snapshot.",
              },
            },
            required: ["refreshed"],
          },
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
    "/accounts": {
      get: {
        tags: ["Scheduler"],
        summary: "List connected social accounts",
        description:
          "Returns the social accounts connected to the caller, sorted by account name. " +
          "Use an account `id` in POST /posts. YouTube accounts have provider `google`.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Connected accounts",
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
    "/posts": {
      post: {
        tags: ["Scheduler"],
        summary: "Create a scheduled post or draft",
        description:
          "Creates a post for 1 to 10 connected accounts. With `scheduled_at` the post is " +
          "created as SCHEDULED and published at that time; a scheduler checks for due posts " +
          "every minute. `scheduled_at` must be at least 2 minutes in the future. Without it " +
          "the post is saved as a DRAFT, which can be published with POST /posts/{id}/publish. " +
          "Per-platform options go in `settings` (or in top-level `instagram`, `tiktok`, " +
          "`youtube` and `pinterest` objects); each account receives only the options for its " +
          "own platform. " +
          "Media, post type and account platforms are not cross-checked here. POST " +
          "/posts/{id}/publish and /retry check them before starting; a scheduled post is " +
          "published without that check and failures are recorded per account. " +
          "Idempotency applies only to requests authenticated with an API key: send an " +
          "`Idempotency-Key` header, or `external_id` in the body when the header is absent. " +
          "The first 201 response is stored for 24 hours and returned again for the same key " +
          "with header `Idempotent-Replayed: true`. The request body is not compared. Reusing " +
          "a key with a different method or path returns 409 IDEMPOTENCY_CONFLICT. Requests " +
          "made with a Clerk session or OAuth token are not deduplicated. " +
          "The post records `source` API, or MCP when the request has header " +
          "`X-Unsora-Client: mcp`, and the id of the API key used (`apiKeyId`). " +
          "Requires an active paid plan.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            description:
              "Idempotency key, up to 128 characters. Used only with API keys. Longer keys are ignored.",
            schema: { type: "string", maxLength: 128 },
          },
          {
            name: "X-Unsora-Client",
            in: "header",
            required: false,
            description:
              "The Unsora MCP server sends `mcp`, which records the post source as MCP. Any other value, or no header, records API.",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePostRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Post created",
            headers: {
              "Idempotent-Replayed": {
                description:
                  "Present with value true when the response is a stored replay for a repeated idempotency key.",
                schema: { type: "string", enum: ["true"] },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePostResponse" },
              },
            },
          },
          "400": {
            description:
              "Invalid request body. `error` describes the first problem found (for example a missing caption, more than 10 accounts, scheduled_at less than 2 minutes ahead, or an unsupported settings key).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description:
              "PLAN_REQUIRED: no active paid plan. UNKNOWN_ACCOUNTS: one or more accounts do not belong to the caller.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description:
              "IDEMPOTENCY_CONFLICT: the idempotency key was already used with a different method or path.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        tags: ["Scheduler"],
        summary: "List posts (paginated)",
        description:
          "Returns the caller's posts as full post records, newest first by creation time.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            description: "Filter by one status.",
            schema: {
              type: "string",
              enum: [
                "DRAFT",
                "SCHEDULED",
                "PUBLISHING",
                "PUBLISHED",
                "PARTIALLY_PUBLISHED",
                "FAILED",
              ],
            },
          },
          {
            name: "type",
            in: "query",
            description: "Filter by post type.",
            schema: {
              type: "string",
              enum: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostListResponse" },
              },
            },
          },
          "400": {
            description:
              "Invalid status, type, page or limit. Out-of-range values are rejected, not clamped.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/posts/analytics/summary": {
      get: {
        tags: ["Scheduler"],
        summary: "Get post analytics summary",
        description:
          "Aggregates engagement metrics for posts published in the last `days` days, counted " +
          "per account. Each post contributes its latest stored metrics snapshot. Snapshots are " +
          "polled from the platforms every 6 hours for posts published in the last 90 days, and " +
          "on demand with POST /posts/analytics/refresh.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "days",
            in: "query",
            description: "Window in days. Values outside 7–90 are clamped.",
            schema: { type: "integer", default: 30, minimum: 7, maximum: 90 },
          },
        ],
        responses: {
          "200": {
            description: "Analytics summary",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AnalyticsSummaryResponse",
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
    "/posts/analytics/refresh": {
      post: {
        tags: ["Scheduler"],
        summary: "Refresh post metrics from the platforms",
        description:
          "Polls the platforms for current metrics of the caller's posts published in the last " +
          "90 days (YouTube, TikTok, Instagram, Facebook, Threads, Pinterest, LinkedIn, Bluesky) " +
          "and stores a snapshot for each. The response is returned after polling finishes. " +
          "Accounts whose platform request fails are skipped. Call GET " +
          "/posts/analytics/summary afterwards for the updated figures.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Refresh finished",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AnalyticsRefreshResponse",
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
    "/posts/{id}": {
      get: {
        tags: ["Scheduler"],
        summary: "Get one post",
        description:
          "Returns the full post record. After publish or retry, poll this until `status` is " +
          "PUBLISHED, PARTIALLY_PUBLISHED or FAILED. Per-account results are in `postAccounts` " +
          "(`published`, `publishedUrl`, `error`).",
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
            description: "Post record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Scheduler"],
        summary: "Update a post",
        description:
          "Updates the caption, schedule or accounts of a post that is not PUBLISHED. Only the " +
          "fields sent are changed. Media, post type and platform settings can't be changed " +
          "here. The 2-minute minimum lead time of POST /posts is not enforced; a time in the " +
          "past is picked up by the next scheduler run. Requires an active paid plan.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePostRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: 'Updated. `message` is "Post updated successfully".',
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostResponse" },
              },
            },
          },
          "400": {
            description:
              "Invalid field, or the post is PUBLISHED and can't be edited.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description:
              "PLAN_REQUIRED: no active paid plan. Also returned without a code when an account does not belong to the caller.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "The post is PUBLISHING. Try again after it finishes.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Scheduler"],
        summary: "Delete a post",
        description:
          "Deletes the post and its per-account records. Content already published on a " +
          "platform is not removed from that platform. Requires an active paid plan.",
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
            description: "Deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessMessage" },
              },
            },
          },
          "403": {
            description: "PLAN_REQUIRED: no active paid plan.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "The post is PUBLISHING. Try again after it finishes.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/posts/{id}/publish": {
      post: {
        tags: ["Scheduler"],
        summary: "Publish a post now",
        description:
          "Starts publishing to every account on the post that has not published yet and " +
          "returns 202 right away with status PUBLISHING. Publishing runs in the background; " +
          "poll GET /posts/{id} until `status` is PUBLISHED, PARTIALLY_PUBLISHED or FAILED. " +
          "Accepts DRAFT, SCHEDULED, FAILED and PARTIALLY_PUBLISHED posts. " +
          "Before starting, the post is checked. It needs at least one account. VIDEO needs " +
          "exactly one video, IMAGE exactly one image, CAROUSEL at least one image, and TEXT " +
          "no media and a non-empty caption; video and images can't be mixed (THUMBNAIL items " +
          "are not counted). The platform of every unpublished account must support the post " +
          "type: YouTube supports VIDEO; TikTok, Instagram and Pinterest support VIDEO, IMAGE " +
          "and CAROUSEL; Facebook, Threads, Bluesky and LinkedIn support all four types. " +
          "Requires an active paid plan.",
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
          "202": {
            description: "Publishing started",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublishPostResponse" },
              },
            },
          },
          "400": {
            description:
              "The post can't be published. `code` is POST_PUBLISHED (the post, or every account on it, is already published), ACCOUNT_REQUIRED, MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED or UNSUPPORTED_FORMAT.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "PLAN_REQUIRED: no active paid plan.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "POST_PUBLISHING: the post is already publishing.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/posts/{id}/retry": {
      post: {
        tags: ["Scheduler"],
        summary: "Retry the failed accounts of a post",
        description:
          "Publishes again to the accounts that have not published on a FAILED or " +
          "PARTIALLY_PUBLISHED post. Accounts that already published are not posted again. " +
          "Runs the same checks as POST /posts/{id}/publish and returns 202 with status " +
          "PUBLISHING; poll GET /posts/{id} for the outcome. Requires an active paid plan.",
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
          "202": {
            description: "Retry started",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublishPostResponse" },
              },
            },
          },
          "400": {
            description:
              "The post can't be retried. `code` is NOT_RETRYABLE (the post is DRAFT or SCHEDULED), POST_PUBLISHED, ACCOUNT_REQUIRED, MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED or UNSUPPORTED_FORMAT.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "PLAN_REQUIRED: no active paid plan.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "POST_PUBLISHING: the post is already publishing.",
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
