const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Unsora API",
    version: "1.4.0",
    description:
      "Public API for Unsora integrations. Authenticate with an Unsora API key (`uns_…`, created under Developers → API keys in the app) as a Bearer token in the Authorization header. Limit: 60 requests per minute per key; over it, 429 with code RATE_LIMIT_EXCEEDED.",
  },
  servers: [
    { url: "https://mvp.tryunsora.com/api/v1", description: "Production" },
    { url: "/api/v1", description: "This server" },
  ],
  tags: [
    { name: "User" },
    {
      name: "Models",
      description:
        "Every video, image and motion-control model, with each model's inputs taken from the provider's own request schema and prices quoted live. One generate endpoint covers all of them.",
    },
    { name: "Video" },
    { name: "Image" },
    { name: "Influencer" },
    { name: "Thumbnail" },
    { name: "Clipping" },
    { name: "Music" },
    { name: "Voiceover" },
    { name: "Upscaler" },
    { name: "Subtitle removal" },
    { name: "Motion control" },
    { name: "Avatar" },
    { name: "Movie materials" },
    { name: "Voice clones" },
    { name: "Voice changer" },
    { name: "Uploads" },
    { name: "Scheduler" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "An Unsora API key (`uns_…`). A Clerk session token also works.",
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
      CreditsResponse: {
        type: "object",
        properties: { credits: { type: "number" } },
        required: ["credits"],
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
      CatalogField: {
        type: "object",
        description:
          "One input of a model endpoint. `key` is the provider's own field name; send it in `inputs` with that name.",
        properties: {
          key: { type: "string", example: "resolution" },
          label: { type: "string", example: "Resolution" },
          type: {
            type: "string",
            enum: [
              "prompt",
              "negative_prompt",
              "media",
              "select",
              "aspect",
              "duration",
              "toggle",
            ],
          },
          required: { type: "boolean" },
          options: {
            type: "array",
            description:
              "Allowed values (select, aspect, duration, toggle). A value of \"auto\" means: leave the field out.",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                label: { type: "string" },
              },
            },
          },
          default: { type: "string" },
          offLabel: {
            type: "string",
            description: "Toggle fields only: what the app shows when the toggle is off (e.g. \"No audio\"), when set.",
          },
          media: {
            type: "object",
            description: "Media fields only: file kind and how many URLs it takes (1 = a single URL string).",
            properties: {
              kind: { type: "string", enum: ["image", "video", "audio"] },
              max: { type: "integer" },
            },
          },
        },
        required: ["key", "label", "type", "required"],
      },
      CatalogModel: {
        type: "object",
        properties: {
          key: { type: "string", example: "seedance-2.5" },
          label: { type: "string", example: "Seedance 2.5" },
          provider: { type: "string", example: "ByteDance" },
          icon: { type: "string", example: "/models/bytedance.svg", description: "Path of the provider logo on app.tryunsora.com." },
          category: { type: "string", enum: ["video", "image", "motion-control"] },
          description: { type: "string" },
          isNew: { type: "boolean" },
          legacyDbModels: {
            type: "array",
            items: { type: "string" },
            description: "Older model names that also resolve to this model.",
          },
          modes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string", example: "omni" },
                label: { type: "string", example: "Omni reference" },
                endpoints: {
                  type: "array",
                  description:
                    "Provider endpoints behind the mode. The first one whose `when` media fields all have files is used; the last is the fallback.",
                  items: {
                    type: "object",
                    properties: {
                      modelId: {
                        type: "string",
                        example: "bytedance/seedance-2.5/text-to-video",
                      },
                      when: { type: "array", items: { type: "string" } },
                      fields: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CatalogField" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      CatalogRequest: {
        type: "object",
        required: ["model"],
        properties: {
          model: {
            type: "string",
            description:
              "Model key from GET /catalog. Older names listed in the model's `legacyDbModels` (e.g. `veo`, `kling-pro`, `seedance_2.0`) also work. Retired names such as `wan`, `wan_2.6`, `gpt-image-1.5` and `seedream-v5-lite` are rejected here; only POST /videos/create and POST /image-generations/create translate them.",
            example: "seedance-2.5",
          },
          category: {
            type: "string",
            enum: ["video", "image", "motion-control"],
            description: "Optional guard: reject the request if the model is from another category.",
          },
          mode: {
            type: "string",
            description: "Mode key from GET /catalog. Omit to pick it from the attached media.",
            example: "omni",
          },
          inputs: {
            type: "object",
            additionalProperties: true,
            description:
              "Inputs in the provider's field names, as listed by GET /catalog. Media fields take URLs; files hosted outside Unsora are imported into your library first. Omitted fields use the model's defaults.",
            example: {
              prompt: "A red fox running through fresh snow at sunrise",
              aspect_ratio: "9:16",
              resolution: "720p",
              duration: 8,
              generate_audio: true,
            },
          },
        },
      },
      CatalogGenerateRequest: {
        allOf: [
          { $ref: "#/components/schemas/CatalogRequest" },
          {
            type: "object",
            properties: {
              expectedCredits: {
                type: "integer",
                description:
                  "The most credits you agree to spend (e.g. the quote's `credits`). If the live price is higher, nothing is charged and the API answers 409 PRICE_CHANGED.",
              },
            },
          },
        ],
      },
      CatalogQuoteResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          credits: {
            type: ["integer", "null"],
            description: "Credits one run costs. Null when the model can't be priced until its required files are attached.",
          },
          mode: { type: "string" },
          modelId: { type: "string", description: "Provider endpoint the request routes to." },
          estimate: {
            type: "boolean",
            description: "True while required files are missing, so the final price may differ.",
          },
        },
        required: ["success", "credits", "estimate"],
      },
      CatalogGenerateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          model: { type: "string" },
          generation: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              model: { type: "string" },
              mode: { type: "string" },
              modelId: { type: "string" },
            },
            required: ["id", "status"],
          },
          creditsDeducted: { type: "integer" },
          creditsRemaining: { type: "integer" },
        },
        required: ["success", "generation"],
      },
      MultiGenerationCreateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          generations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
              },
              required: ["id", "status"],
            },
          },
          creditsDeducted: { type: "integer" },
          creditsRemaining: { type: "integer" },
        },
        required: ["success", "generations"],
      },
      VideoCreateRequest: {
        type: "object",
        description:
          "Fields a model doesn't take are ignored, and anything left out uses the model's own default (see GET /catalog for each model's inputs). snake_case spellings are accepted too: `aspect_ratio`, `negative_prompt`, `generate_audio`, `start_frame`, `last_image`/`end_image`, `reference_images`, `reference_videos`, `reference_audios`.",
        properties: {
          prompt: {
            type: "string",
            description:
              "Required by text-to-video endpoints. Image-to-video and reference endpoints that run from attached media can go without it.",
          },
          model: {
            type: "string",
            default: "seedance-2.0",
            enum: [
              "seedance-2.5",
              "seedance-2.5-turbo",
              "seedance-2.0",
              "seedance-2.0-fast",
              "seedance-2.0-mini",
              "veo-3.1",
              "veo-3.1-fast",
              "veo-3.1-lite",
              "gemini-omni-1.1-flash",
              "kling-o3-pro",
              "kling-3.0-pro",
              "kling-3.0-std",
              "wan-3.0",
              "grok-imagine-video-1.5",
              "sora-2",
              "sora-2-pro",
            ],
            description:
              "Video model key from GET /catalog. Older names also work: `seedance_2.0`, `veo`, `veo-fast`, `veo-lite`, `kling-pro`, `kling-standard`, `gemini-omni-flash`, `sora_2`, `sora_2_pro`; `wan` and `wan_2.6` run as `wan-3.0`.",
          },
          mode: {
            type: "string",
            description:
              "Generation mode, for models that have more than one. `omni_reference` (or `omni`), `first_last_frames` (or `FIRST_AND_LAST_FRAMES_2_VIDEO`) and `REFERENCE_2_VIDEO` (or `reference`). Ignored when the model has no such mode; omitted, the mode is picked from the attached media. `functionMode` is an alias.",
          },
          duration: {
            type: "integer",
            description: "Length in seconds. Valid values depend on the model.",
          },
          aspectRatio: {
            type: "string",
            description:
              "Aspect ratio. Valid values depend on the model; `auto` uses the model's default. Aliases: `aspect`, `ratio`.",
          },
          negativePrompt: {
            type: "string",
            description: "What to avoid, for models that take one.",
          },
          resolution: {
            type: "string",
            description:
              "Output resolution (e.g. 720p, 1080p) for models that offer it; see GET /catalog.",
          },
          sound: {
            type: "boolean",
            description:
              "Generate audio, for models that offer it. Omitted: the model's default.",
          },
          generateAudio: {
            type: "boolean",
            description: "Alias of `sound`, on every model.",
          },
          image: {
            type: "string",
            format: "uri",
            description: "Start frame for image-to-video. Alias: `startFrame`.",
          },
          lastImage: {
            type: "string",
            format: "uri",
            description:
              "End frame, for models that support start/end frames. Aliases: `endImage`, `endFrame`.",
          },
          filePaths: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Start and end frame as a list: the first item is the start frame, the second the end frame.",
          },
          imageUrls: {
            type: "array",
            items: { type: "string", format: "uri" },
            description:
              "Image list. In reference mode these are the reference images; otherwise the first two are the start and end frames.",
          },
          referenceImages: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Reference image URLs. The maximum count depends on the model.",
          },
          referenceVideos: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Reference video URLs, for models that take them.",
          },
          referenceAudios: {
            type: "array",
            items: { type: "string", format: "uri" },
            description: "Reference audio URLs, for models that take them.",
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
              status: { type: "string", example: "QUEUED" },
              model: { type: "string" },
              mode: { type: "string" },
              modelId: { type: "string", description: "Provider endpoint the request routed to." },
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
              model: {
                anyOf: [{ type: "string" }, { type: "null" }],
                description:
                  "The model the job ran on, as stored. Video upscales report `upscale-standard`, `upscale-ultra-1080p` or `upscale-ultra-4k`; subtitle/watermark removal reports `watermark-removal`.",
              },
              status: { type: "string", enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] },
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
          trackNumber: {
            type: "integer",
            description: "Your track number: generations are numbered in creation order, the oldest is 1.",
          },
          songTitle: {
            type: "string",
            description: "Song title: the stored title, or one derived from the lyrics or prompt.",
          },
        },
        required: ["id", "status", "createdAt"],
      },
      CreateMusicGenerationRequest: {
        type: "object",
        description: "Send `lyrics` for every model except `mureka-7.5`, which makes background music from `prompt` (or lyrics). Credits per run: `auto`, `mureka-9` and `mureka-8` 3; `mureka-7.6` and `mureka-7.5` 4; `mureka-o2` 6.",
        properties: {
          lyrics: {
            type: "string",
            maxLength: 3000,
            description: "Song lyrics, up to 3,000 characters. Required by every model except `mureka-7.5`.",
          },
          prompt: {
            type: "string",
            maxLength: 1024,
            description: "Style: genre, mood, vocal style (up to 1,024 characters).",
          },
          model: {
            type: "string",
            default: "auto",
            enum: [
              "auto",
              "mureka-9",
              "mureka-8",
              "mureka-o2",
              "mureka-7.6",
              "mureka-7.5",
            ],
            description: "`auto` runs Mureka V9. `mureka-7.5` makes background music without vocals.",
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
        description: "Credits: Eleven v3 voices 6 per started 1,000 characters; MiniMax preset voices 1 per started 1,000 characters; your cloned voices 3 per started 500 characters (minimum 3).",
        properties: {
          text: {
            type: "string",
            maxLength: 10000,
            description: "Script to convert to speech (max 10,000 chars). Supports <#x#> tags between words to pause for x seconds (0.01–99.99).",
          },
          voice_id: {
            type: "string",
            description: "A voice from GET /voiceovers/voices (20 Eleven v3 voices such as `Aria` or `Roger`), a MiniMax preset (`Friendly_Person`, `Wise_Woman`, `Deep_Voice_Man`, `Calm_Woman`, `Casual_Guy`, `Lively_Girl`, `Inspirational_girl`, `Determined_Man`, `Lovely_Girl`, `Elegant_Man`, `English_CaptivatingStoryteller`, `English_ConfidentWoman`), or the id of one of your cloned voices from GET /voice-clones. The voice decides which model runs.",
          },
          emotion: {
            type: "string",
            enum: [
              "happy",
              "sad",
              "angry",
              "fearful",
              "disgusted",
              "surprised",
              "neutral",
            ],
            default: "neutral",
            description: "Delivery, for MiniMax preset voices. Ignored by Eleven v3 voices.",
          },
          speed: {
            type: "number",
            minimum: 0.5,
            maximum: 2,
            default: 1,
            description: "Speaking speed.",
          },
          output_format: {
            type: "string",
            enum: ["mp3", "wav", "flac"],
            default: "mp3",
            description: "Audio format. Eleven v3 voices always return mp3.",
          },
          stability: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Eleven v3 voices only (ignored otherwise). Higher = more consistent delivery, lower = more expressive. Omitted: the provider's default.",
          },
          similarity: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Eleven v3 voices only (ignored otherwise). How closely the output sticks to the base voice. Omitted: the provider's default.",
          },
          model: {
            type: "string",
            enum: ["eleven-v3", "minimax-speech-2.6-hd", "elevenlabs-multilingual-v2"],
            description: "Validated but not needed: the model follows from `voice_id`.",
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
              status: { type: "string", enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"] },
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
          success: {
            type: "boolean",
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ThumbnailRecord",
            },
          },
          pagination: {
            type: "object",
            properties: {
              total: {
                type: "integer",
              },
              page: {
                type: "integer",
              },
              limit: {
                type: "integer",
              },
              totalPages: {
                type: "integer",
              },
            },
          },
        },
        required: ["success", "data", "pagination"],
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
              "Connected account id from GET /accounts. Alias: accountId. Each account may appear once per post; a repeated id returns 400.",
          },
          customCaption: {
            type: "string",
            description: "Caption for this account only. Replaces caption.",
          },
          title: {
            type: "string",
            description:
              "Video title, used by YouTube only. Defaults to the first 100 characters of the caption. For a Pinterest pin title use settings.pinterest.title.",
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
              "Board to pin to. Alias: board_id. Defaults to the account's first board. " +
              "List boards with GET /accounts/{accountId}/pinterest/boards.",
          },
          title: {
            type: "string",
            maxLength: 100,
            description: "Pin title. Defaults to the start of the caption.",
          },
          link: {
            type: "string",
            format: "uri",
            description: "Destination link (http or https) opened when the pin is clicked.",
          },
        },
      },
      GoogleBusinessPostSettings: {
        type: "object",
        description:
          "Options applied to Google Business Profile locations: an optional call-to-action button on the post.",
        properties: {
          cta_type: {
            type: "string",
            enum: ["LEARN_MORE", "BOOK", "ORDER", "SHOP", "SIGN_UP", "CALL"],
            description:
              "Button shown on the post. Alias: ctaType. CALL dials the location's phone number.",
          },
          cta_url: {
            type: "string",
            format: "uri",
            description:
              "Link (http or https) the button opens. Alias: ctaUrl. Required for every cta_type except CALL; must be omitted for CALL.",
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
          google_business: {
            $ref: "#/components/schemas/GoogleBusinessPostSettings",
          },
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
              "Overrides the post type inferred from media. Inferred type: no media is TEXT; a video object is VIDEO; a slideshow object is CAROUSEL; an array is VIDEO when any item is a VIDEO, otherwise CAROUSEL when it has more than one IMAGE and IMAGE when it has one. THUMBNAIL items are covers and don't count.",
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
          google_business: {
            $ref: "#/components/schemas/GoogleBusinessPostSettings",
            description:
              "Same as settings.google_business. Ignored when settings.google_business is present.",
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
          folderId: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Library folder the file is in, if any.",
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
                  "google (YouTube), tiktok, instagram, facebook, threads, bluesky, pinterest, linkedin, x or google_business (one account per Business Profile location).",
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
          "Cumulative counters. Metrics a platform does not expose are 0 (e.g. Bluesky views, TikTok saves, YouTube shares and saves). Facebook and LinkedIn likes count every reaction type. Pinterest views are impressions and shares are outbound clicks. X shares are reposts plus quotes and saves are bookmarks. Google Business Profile reports search views only.",
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
                    postId: {
                      type: "string",
                      description: "The post, for GET /posts/{id}.",
                    },
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
      PostRuleErrorResponse: {
        type: "object",
        description: "A post that can't be published as sent.",
        properties: {
          success: {
            type: "boolean",
          },
          error: {
            type: "string",
            description: "What to fix, in plain words.",
          },
          code: {
            type: "string",
            description:
              "Why the post was rejected, e.g. MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED, UNSUPPORTED_FORMAT, PLATFORM_RULES, PLATFORM_UNAVAILABLE, ACCOUNT_REQUIRED, POST_PUBLISHED, NOT_RETRYABLE, INVALID_DATE or SCHEDULE_IN_PAST.",
          },
          issues: {
            type: "array",
            description: "PLATFORM_RULES only: one entry per problem.",
            items: {
              type: "object",
              properties: {
                provider: {
                  type: "string",
                  description: "Platform the problem is on, e.g. instagram.",
                },
                level: {
                  type: "string",
                  enum: ["error"],
                },
                code: {
                  type: "string",
                },
                message: {
                  type: "string",
                },
              },
            },
          },
        },
        required: ["success", "error", "code"],
      },
      UpscaleJobCreateResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          job: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              status: {
                type: "string",
                example: "QUEUED",
              },
              model: {
                type: "string",
                description: "Video upscales only.",
              },
            },
            required: ["id", "status"],
          },
          creditsDeducted: {
            type: "integer",
          },
          creditsRemaining: {
            type: "integer",
          },
        },
        required: ["success", "job"],
      },
      GenerationCreateResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          generation: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              status: {
                type: "string",
                example: "QUEUED",
              },
            },
            required: ["id", "status"],
          },
          creditsDeducted: {
            type: "integer",
          },
          creditsRemaining: {
            type: "integer",
          },
        },
        required: ["success", "generation"],
      },
      VoiceConversionCreateResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          conversion: {
            type: "object",
            properties: {
              id: {
                type: "string",
              },
              status: {
                type: "string",
                example: "QUEUED",
              },
            },
            required: ["id", "status"],
          },
          creditsDeducted: {
            type: "integer",
          },
          creditsRemaining: {
            type: "integer",
          },
        },
        required: ["success", "conversion"],
      },
      ImageUpscaleListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          jobs: {
            type: "array",
            description: "Image upscale jobs, newest first, each with `inputAsset` and `outputAsset`.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "jobs", "pagination"],
      },
      VideoUpscaleListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          jobs: {
            type: "array",
            description: "Video upscale jobs, newest first: `originalAsset`, `processedAsset`, `upscaleModel`, `status`, `creditsUsed`.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "jobs", "pagination"],
      },
      WatermarkRemovalListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          videos: {
            type: "array",
            description: "Subtitle/watermark removal jobs, newest first: `originalAsset`, `processedAsset`, `durationSeconds`, `status`, `creditsUsed`.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "videos", "pagination"],
      },
      MotionControlListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          generations: {
            type: "array",
            description: "Motion-control generations, newest first, with `imageAsset`, `inputAssets` and `outputAsset`.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "generations", "pagination"],
      },
      AvatarListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          generations: {
            type: "array",
            description: "Talking-avatar generations, newest first.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "generations", "pagination"],
      },
      MovieMaterialsListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          generations: {
            type: "array",
            description: "Movie-material images, newest first: `mode`, `params`, `ratio`, `resolution`, `outputAsset`.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "generations", "pagination"],
      },
      VoiceConversionListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          conversions: {
            type: "array",
            description: "Voice-changer jobs, newest first.",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          pagination: {
            $ref: "#/components/schemas/PaginationMeta",
          },
        },
        required: ["success", "conversions", "pagination"],
      },
      VoiceClone: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Pass as `voice_id` to POST /voiceovers/create, POST /voice-conversions/create or POST /avatar-generations/create.",
          },
          name: {
            type: "string",
          },
          description: {
            anyOf: [
              {
                type: "string",
              },
              {
                type: "null",
              },
            ],
          },
          sampleAsset: {
            type: "object",
            additionalProperties: true,
            description: "The audio sample the clone was made from.",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      VoiceCloneListResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          presets: {
            type: "array",
            description: "The 12 MiniMax preset voices.",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                },
                label: {
                  type: "string",
                },
              },
            },
          },
          elevenV3Voices: {
            type: "array",
            description: "The Eleven v3 voices (also listed by GET /voiceovers/voices).",
            items: {
              type: "object",
              additionalProperties: true,
            },
          },
          clones: {
            type: "array",
            items: {
              $ref: "#/components/schemas/VoiceClone",
            },
          },
          elevenLabsConfigured: {
            type: "boolean",
            description: "False when cloning is unavailable on this server.",
          },
          maxClones: {
            type: "integer",
            example: 10,
          },
          cloneCreditCost: {
            type: "integer",
            example: 15,
          },
        },
        required: ["success", "presets", "clones"],
      },
      VoiceCloneCreateResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
          },
          clone: {
            $ref: "#/components/schemas/VoiceClone",
          },
          creditsDeducted: {
            type: "integer",
            example: 15,
          },
          creditsRemaining: {
            type: "integer",
          },
        },
        required: ["success", "clone"],
      },
    },
  },
  paths: {
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
    "/user/subscription": {
      get: {
        tags: ["User"],
        summary: "Get the current plan and Stripe subscription state",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Subscription",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        plan: { type: "string", nullable: true },
                        status: { type: "string", nullable: true },
                        isActive: { type: "boolean" },
                        isCancelled: { type: "boolean" },
                        stripeSubscriptionId: { type: "string", nullable: true },
                        stripeCustomerId: { type: "string", nullable: true },
                        stripePriceId: { type: "string", nullable: true },
                        stripeCurrentPeriodEnd: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                    },
                  },
                  required: ["success", "data"],
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/catalog": {
      get: {
        tags: ["Models"],
        summary: "List generation models with their inputs",
        description:
          "Every video, image and motion-control model, its modes, and each endpoint's input fields (names, allowed values, ranges, defaults). Prices aren't listed because they depend on the inputs; use POST /catalog/quote.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "category",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["video", "image", "motion-control"] },
          },
        ],
        responses: {
          "200": {
            description: "Models",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    models: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CatalogModel" },
                    },
                  },
                },
              },
            },
          },
          "503": {
            description: "Model list temporarily unavailable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/catalog/quote": {
      post: {
        tags: ["Models"],
        summary: "Price a generation",
        description:
          "Live credit price for one run with these exact inputs (resolution, duration, audio, and the length of attached video or audio). Free; nothing is charged.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CatalogRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Quote",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CatalogQuoteResponse" },
              },
            },
          },
          "400": {
            description: "Invalid model, mode or inputs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/catalog/generate": {
      post: {
        tags: ["Models"],
        summary: "Start a video, image or motion-control generation",
        description: "Validates the inputs against the model, prices the run live, charges the credits and queues it. Poll GET /video/status/{id} (video and motion control) or GET /image/status/{id} (image). Media URLs hosted outside Unsora are imported into your library first (at most 12 per request).",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CatalogGenerateRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generation queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CatalogGenerateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid model, mode or inputs; a media file couldn't be read or imported; or more than 12 media URLs hosted outside Unsora (upload them first)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Idempotency-Key already used on a different endpoint (code IDEMPOTENCY_CONFLICT); or the live price is above `expectedCredits`, nothing charged (code PRICE_CHANGED, `credits` holds the new price)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "The pricing service couldn't be reached; try again",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Generation is temporarily unavailable (code PROVIDER_UNAVAILABLE), or the job couldn't be started; nothing was charged",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/videos/create": {
      post: {
        tags: ["Video"],
        summary: "Create a video generation (simple shape)",
        description: "Kept for existing integrations. Takes the fields below, translates them onto the chosen model, and runs through POST /catalog/generate with the same live pricing. New integrations should use /catalog/generate, which exposes every model input. Poll GET /video/status/{id}. Media URLs hosted outside Unsora are imported into your library first (at most 12 per request).",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/VideoCreateRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generation queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VideoCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid model, mode or inputs; a media file couldn't be read or imported; or more than 12 media URLs hosted outside Unsora (upload them first)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Idempotency-Key already used on a different endpoint (code IDEMPOTENCY_CONFLICT)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "The pricing service couldn't be reached; try again",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Generation is temporarily unavailable (code PROVIDER_UNAVAILABLE), or the job couldn't be started; nothing was charged",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
              "Filter by video model key from GET /catalog (e.g. `seedance-2.5`, `veo-3.1`). An older name such as `veo` or `kling-pro` matches that model's rows under every name. Use `wan-3.0` for Wan: `wan` and `wan_2.6` only match jobs stored under those old names.",
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
          "400": {
            description: "Unknown `model` value; the error lists the valid ones",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
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
        description:
          "Deletes the generation record. The video file stays in your library.",
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
        summary: "Poll a video job",
        description: "One status endpoint for every job that produces a video: video generations (any model), motion control, talking avatars, video upscales and subtitle/watermark removal. Poll every 5 to 10 seconds until `status` is COMPLETED or FAILED.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VideoStatusResponse",
                },
              },
            },
          },
          "404": {
            description: "Job not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/image/status/{id}": {
      get: {
        tags: ["Image"],
        summary: "Poll an image job",
        description: "One status endpoint for every job that produces an image: image generations, AI influencer images, thumbnails, image upscales and movie materials. The response has no job-type field; you know the type from the endpoint that created the job.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ImageStatusResponse",
                },
              },
            },
          },
          "404": {
            description: "Job not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/image-generations/create": {
      post: {
        tags: ["Image"],
        summary: "Create an image generation (simple shape)",
        description: "Kept for existing integrations. Takes the fields below, translates them onto the chosen model, and runs through POST /catalog/generate with the same live pricing. Fields a model doesn't take are ignored. New integrations should use /catalog/generate, which exposes every model input. Poll GET /image/status/{id}.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["prompt"],
                properties: {
                  prompt: {
                    type: "string",
                  },
                  model: {
                    type: "string",
                    default: "nano-banana-2",
                    enum: [
                      "gpt-image-2.5-flare",
                      "gpt-image-2.5-sunburst",
                      "gpt-image-2",
                      "nano-banana-pro",
                      "nano-banana-2",
                      "nano-banana-2-lite",
                      "seedream-5.0-pro",
                    ],
                    description: "Image model key from GET /catalog. Older names also work: `gpt_image_2`; `gpt-image-1.5` runs as `gpt-image-2` and `seedream-v5-lite` as `seedream-5.0-pro`.",
                  },
                  aspectRatio: {
                    type: "string",
                    description: "Aspect ratio. Valid values depend on the model; `auto` uses the model's default. Aliases: `aspect`, `aspect_ratio`, `ratio`.",
                  },
                  resolution: {
                    type: "string",
                    description: "Output size written as a number plus `k` (`1k`, `2k`, `4k`), for models that offer it. Other values (such as `1024x1024`, `basic`, `high`) are ignored and the model's default applies.",
                  },
                  quality: {
                    type: "string",
                    description: "Quality tier, for models that offer it (see GET /catalog).",
                  },
                  referenceImages: {
                    type: "array",
                    items: {
                      type: "string",
                      format: "uri",
                    },
                    description: "Reference image URLs. The maximum count depends on the model. Aliases: `referenceImageUrls`, `referenceImageUrl`, `images`.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generation queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CatalogGenerateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid model or inputs; a reference image couldn't be imported; or more than 12 media URLs hosted outside Unsora",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Idempotency-Key already used on a different endpoint (code IDEMPOTENCY_CONFLICT)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "The pricing service couldn't be reached; try again",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Generation is temporarily unavailable (code PROVIDER_UNAVAILABLE), or the job couldn't be started; nothing was charged",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
        description:
          "Deletes the generation record. The image file stays in your library.",
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
        summary: "Create a script-to-voiceover job",
        description: "Converts a script (max 10,000 chars) into speech with an Eleven v3 voice, a MiniMax preset voice or one of your cloned voices. Cost depends on the voice: 6 credits per started 1,000 characters for Eleven v3, 1 per started 1,000 for MiniMax presets, 3 per started 500 (minimum 3) for cloned voices. Poll GET /voiceovers/status/{id} for the result.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateVoiceoverRequest",
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
                  $ref: "#/components/schemas/CreateVoiceoverResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing text or voice_id, unknown voice_id, or an invalid emotion, speed, stability, similarity or output_format",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Idempotency-Key already used on a different endpoint (code IDEMPOTENCY_CONFLICT)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Voiceover generation is not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voiceovers/status/{id}": {
      get: {
        tags: ["Voiceover"],
        summary: "Poll a voiceover or voice-changer job",
        description:
          "Voiceovers (POST /voiceovers/create) and voice-changer jobs (POST /voice-conversions/create) both poll here; `voiceId` is the voice used.",
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
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
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
          "400": {
            description: "Missing lyrics (song models), missing both prompt and lyrics, text too long, or an unknown model or output_format",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
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
    "/influencer-studio/create": {
      post: {
        tags: ["Influencer"],
        summary: "Create AI influencer image jobs",
        description:
          "Each image in `count` is a separate generation and costs 4 credits. Poll each id with GET /image/status/{id}.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["prompt"],
                properties: {
                  prompt: {
                    type: "string",
                    description:
                      "Describe the influencer scene, outfit, mood, or action.",
                  },
                  aspectRatio: {
                    type: "string",
                    enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
                    default: "1:1",
                  },
                  count: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10,
                    default: 1,
                    description: "Values outside 1–10 are clamped, not rejected.",
                  },
                  cameraAngle: {
                    type: "string",
                    enum: ["pov", "portrait", "full-body", "close-up", "side-profile"],
                  },
                  styleMode: {
                    type: "string",
                    enum: [
                      "ugc",
                      "casual_daylight",
                      "cozy_indoor",
                      "low_light_intimate",
                      "raw_flash",
                      "golden_hour",
                      "moody_night",
                      "car_selfie",
                      "mirror_selfie",
                      "luxury_influencer",
                      "cinematic",
                      "travel_content",
                      "beauty_closeup",
                      "party_night_out",
                    ],
                  },
                  age: { type: "integer", minimum: 18, maximum: 70 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Jobs queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MultiGenerationCreateResponse",
                },
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
        description: "Deletes one AI influencer image generation.",
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
    "/thumbnails/create": {
      post: {
        tags: ["Thumbnail"],
        summary: "Create YouTube thumbnail jobs",
        description:
          "Generates 16:9 thumbnails. Send at least one of `prompt`, `context`, or reference images. Each variation is a separate generation and credit charge (12 credits each).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "Title or idea for the thumbnail.",
                  },
                  context: {
                    type: "array",
                    maxItems: 1,
                    description:
                      "One source for the thumbnail: a YouTube video (`youtube`, reads its title and transcript) or a PDF (`document`, public URL). Send exactly one item: with more than one, or an item that doesn't parse, the context is ignored without an error.",
                    items: {
                      type: "object",
                      required: ["type", "content"],
                      properties: {
                        type: { type: "string", enum: ["youtube", "document"] },
                        content: {
                          type: "string",
                          format: "uri",
                          description: "The YouTube or document URL. `label` is accepted in its place.",
                        },
                      },
                    },
                  },
                  referenceImageUrls: {
                    type: "array",
                    items: { type: "string", format: "uri" },
                    description:
                      "Reference images, such as the creator's face. Up to 16 including the template.",
                  },
                  templateImageUrls: {
                    type: "array",
                    maxItems: 1,
                    items: { type: "string", format: "uri" },
                    description: "One layout template image to follow.",
                  },
                  expression: {
                    type: "string",
                    enum: [
                      "auto",
                      "neutral",
                      "soft-smile",
                      "big-smile",
                      "surprised",
                      "confused",
                      "worried",
                      "angry",
                      "sad",
                      "disgusted",
                      "determined",
                    ],
                    default: "auto",
                    description: "Facial expression for the person in the thumbnail. Any other value falls back to `auto`.",
                  },
                  variations: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    default: 1,
                    description: "Values outside 1–20 are clamped, not rejected.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Jobs queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MultiGenerationCreateResponse",
                },
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
    "/thumbnails": {
      get: {
        tags: ["Thumbnail"],
        summary: "List thumbnail generations (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "List",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ThumbnailListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
    "/clippings/create": {
      post: {
        tags: ["Clipping"],
        summary: "Create an AI clipping job",
        description:
          "Finds the best moments in a long video and cuts them into short clips. Costs 4 credits per started minute of source video (minimum 1 minute). Poll GET /clippings/status/{clippingId} until the job finishes.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["videoUrl"],
                properties: {
                  videoUrl: {
                    type: "string",
                    format: "uri",
                    description: "Public video URL, such as a YouTube link.",
                  },
                  targetDuration: {
                    type: "string",
                    enum: ["auto", "lt30", "30-60", "60-90", "90-3min", "gt3min"],
                    default: "auto",
                    description: "Clip length: `auto` (up to 90s), under 30s, 30–60s, 60–90s, 90s–3min, or 3–5min. The raw values `DURATION_0_30`, `DURATION_0_90`, `DURATION_30_60`, `DURATION_60_90`, `DURATION_90_180` and `DURATION_180_300` also work. Ignored when `query` is set.",
                  },
                  ratio: {
                    type: "string",
                    enum: ["9:16", "1:1", "4:5", "16:9", "original"],
                    default: "original",
                    description: "Clip aspect ratio. `RATIO_9_16`, `RATIO_1_1`, `RATIO_4_5` and `RATIO_16_9` also work.",
                  },
                  limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    description: "Maximum number of clips.",
                  },
                  query: {
                    type: "string",
                    maxLength: 500,
                    description: "Describe the moments to find, e.g. `funny reactions`. When set, clip length follows the moments and `targetDuration` is ignored.",
                  },
                  enableCaption: {
                    type: "boolean",
                    default: false,
                    description: "Burn captions into the clips. Must be the JSON boolean `true`; the string `\"true\"` counts as off.",
                  },
                  captionStyle: {
                    type: "string",
                    enum: [
                      "classic-yellow",
                      "white-card",
                      "black-box",
                      "bold-white",
                      "white-underline",
                      "playful-green",
                      "sketch-blue",
                      "bubble-blue",
                      "bubble-green",
                      "glow-yellow",
                      "duo-green",
                      "duo-purple",
                      "elegant-purple",
                      "neon-cyan",
                      "glow-pink",
                      "bold-yellow",
                      "soft-orange",
                      "glow-green",
                      "glow-orange",
                      "retro-outline",
                      "mint-bubble",
                      "comic-duo",
                      "static-outline",
                      "static-comic",
                      "static-minimal",
                      "static-green",
                      "static-yellow",
                      "static-orange",
                      "gaming-magenta",
                      "gaming-green",
                      "gaming-yellow",
                      "gaming-white",
                      "gaming-purple-box",
                      "gaming-cyan",
                      "gaming-orange-box",
                    ],
                    default: "classic-yellow",
                    description: "Caption preset, used only when `enableCaption` is true. Raw style ids (`temp-0` to `temp-17`, `temp-static-1` to `temp-static-6`, `game-streamer-1` to `game-streamer-7`, `smart-bg-focus`, `box-highlight`, `word-focus`, `underline-focus`) also work.",
                  },
                  sourceLang: {
                    type: "string",
                    description: "Language spoken in the video, e.g. `en`. Passed to the clipping provider as is.",
                  },
                  targetLang: {
                    type: "string",
                    description: "Language for the captions, to translate them. Passed to the clipping provider as is.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Job queued",
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
                        status: { type: "string" },
                        videoUrl: { type: "string" },
                        config: { type: "object" },
                        createdAt: { type: "string", format: "date-time" },
                        clips: { type: "array", items: { type: "object" } },
                        creditsUsed: { type: "integer" },
                      },
                    },
                    creditsDeducted: { type: "integer" },
                    creditsRemaining: { type: "integer" },
                  },
                  required: ["success", "data"],
                },
              },
            },
          },
          "400": {
            description: "Invalid input or unreadable video",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
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
    "/clippings/all": {
      get: {
        tags: ["Clipping"],
        summary: "List clipping jobs",
        description: "Every clipping job you own, newest first, each with its clips. Not paginated.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "List",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ClippingListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
    "/clippings/refresh/{clippingId}": {
      get: {
        tags: ["Clipping"],
        summary: "Poll clipping job status (alias)",
        description: "Same as GET /clippings/status/{clippingId}.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "clippingId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Job with clips",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ClippingGetResponse",
                },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
    "/image-upscaler/create": {
      post: {
        tags: ["Upscaler"],
        summary: "Upscale an image",
        description: "Upscales one image. Credits: 2 for 2k, 3 for 4k, 5 for 8k. Poll GET /image/status/{id} with `job.id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  imageUrl: {
                    type: "string",
                    format: "uri",
                    description: "Public URL of the image, for example from POST /uploads.",
                  },
                  resolution: {
                    type: "string",
                    enum: ["2k", "4k", "8k"],
                    default: "2k",
                  },
                },
                required: ["imageUrl"],
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
                  $ref: "#/components/schemas/UpscaleJobCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing imageUrl or invalid resolution",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/image-upscaler/all": {
      get: {
        tags: ["Upscaler"],
        summary: "List image upscales (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ImageUpscaleListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/image-upscaler/{jobId}": {
      delete: {
        tags: ["Upscaler"],
        summary: "Delete an image upscale",
        description: "Deletes the job record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/video-upscaler/create": {
      post: {
        tags: ["Upscaler"],
        summary: "Upscale a video",
        description: "Upscales a video up to 25 seconds long. Credits depend on the model and the video's measured length: `standard` 10; `ultra-1080p` 6 up to 5s, 11 up to 10s, 16 longer; `ultra-4k` 22 up to 5s, 43 up to 10s, 64 longer. Poll GET /video/status/{id} with `job.id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  videoUrl: {
                    type: "string",
                    format: "uri",
                    description: "Public http(s) URL of the video file (MP4, WebM or MOV).",
                  },
                  model: {
                    type: "string",
                    enum: ["standard", "ultra-1080p", "ultra-4k"],
                    default: "standard",
                  },
                },
                required: ["videoUrl"],
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
                  $ref: "#/components/schemas/UpscaleJobCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "videoUrl isn't an http(s) URL, the video's length can't be read, it's longer than 25 seconds, or the model is unknown",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/video-upscaler/all": {
      get: {
        tags: ["Upscaler"],
        summary: "List video upscales (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VideoUpscaleListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/video-upscaler/{jobId}": {
      delete: {
        tags: ["Upscaler"],
        summary: "Delete a video upscale",
        description: "Deletes the job record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/watermark-removal/create": {
      post: {
        tags: ["Subtitle removal"],
        summary: "Remove burned-in subtitles or a watermark from a video",
        description: "Erases burned-in text from a video up to 2 minutes long. Costs 1 credit per second, rounded up to the next 10 seconds (a 23-second video costs 30). Poll GET /video/status/{id} with an id from `videoIds`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["videoUrl"],
                properties: {
                  videoUrl: {
                    type: "string",
                    format: "uri",
                    description: "Direct http(s) URL of the video file (e.g. .mp4). Upload it with POST /uploads first if needed.",
                  },
                  name: {
                    type: "string",
                    description: "Display name. Defaults to the file name from the URL.",
                  },
                },
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
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                    },
                    videoIds: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                      description: "Job ids to poll with GET /video/status/{id} (one per video).",
                    },
                    jobIds: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                      description: "Internal queue ids.",
                    },
                    message: {
                      type: "string",
                    },
                    estimatedTime: {
                      type: "string",
                    },
                    videosCount: {
                      type: "integer",
                    },
                    operations: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                    },
                    creditsDeducted: {
                      type: "integer",
                    },
                    creditsRemaining: {
                      type: "integer",
                    },
                  },
                  required: ["success", "videoIds"],
                },
              },
            },
          },
          "400": {
            description: "videoUrl isn't an http(s) URL, the video's length can't be read, or it's longer than 2 minutes",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/watermark-removal/all": {
      get: {
        tags: ["Subtitle removal"],
        summary: "List subtitle/watermark removals (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WatermarkRemovalListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/watermark-removal/{videoId}": {
      delete: {
        tags: ["Subtitle removal"],
        summary: "Delete a subtitle/watermark removal",
        description: "Deletes the job record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "videoId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/motion-control/create": {
      post: {
        tags: ["Motion control"],
        summary: "Animate a character with a reference video",
        description: "Makes the character in an image perform the motion from a reference video. Runs through POST /catalog/generate with live pricing; price a run first with POST /catalog/quote, and see each model's inputs with GET /catalog?category=motion-control. Poll GET /video/status/{id}.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: {
              type: "string",
              maxLength: 128,
            },
            description: "API key requests only. Retrying with the same key within 24 hours replays the first response (with the `Idempotent-Replayed: true` header) instead of charging again. The body isn't compared; reusing the key on a different endpoint returns 409 IDEMPOTENCY_CONFLICT. Keys over 128 characters are ignored.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  model: {
                    type: "string",
                    enum: [
                      "kling-mc-3.0-pro",
                      "kling-mc-3.0-std",
                      "kling-mc-2.6-pro",
                      "wan-2.2-animate",
                      "dreamactor-v2",
                    ],
                    default: "kling-mc-3.0-pro",
                  },
                  character_image_url: {
                    type: "string",
                    format: "uri",
                    description: "Image of the character. Aliases: `characterImageUrl`, `image`.",
                  },
                  motion_video_url: {
                    type: "string",
                    format: "uri",
                    description: "Video whose motion the character copies. Aliases: `motionVideoUrl`, `video`.",
                  },
                  prompt: {
                    type: "string",
                    description: "Optional guidance, for models that take one.",
                  },
                  keep_sound: {
                    type: "boolean",
                    description: "Keep the reference video's audio, for models that offer it. Aliases: `keepSound`, `keep_original_sound`.",
                  },
                  character_orientation: {
                    type: "string",
                    description: "Which way the character faces, for models that offer it; values per model in GET /catalog. Alias: `characterOrientation`.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generation queued",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CatalogGenerateResponse",
                },
              },
            },
          },
          "400": {
            description: "Invalid model or inputs, or a media file couldn't be imported",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "409": {
            description: "Idempotency-Key already used on a different endpoint (code IDEMPOTENCY_CONFLICT)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "The pricing service couldn't be reached; try again",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Generation is temporarily unavailable (code PROVIDER_UNAVAILABLE)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/motion-control/all": {
      get: {
        tags: ["Motion control"],
        summary: "List motion-control generations (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MotionControlListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/motion-control/{generationId}": {
      delete: {
        tags: ["Motion control"],
        summary: "Delete a motion-control generation",
        description: "Deletes the generation record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/avatar-generations/create": {
      post: {
        tags: ["Avatar"],
        summary: "Make a talking avatar video",
        description: "Animates a portrait so it speaks a script (read in `voice_id`) or an audio file. Speech can be up to 20 seconds. Costs 10 credits. Poll GET /video/status/{id} with `generation.id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  image_url: {
                    type: "string",
                    format: "uri",
                    description: "Portrait image. Send this or `image_asset_id`.",
                  },
                  image_asset_id: {
                    type: "string",
                    description: "An IMAGE asset of yours (e.g. from POST /uploads) instead of `image_url`.",
                  },
                  transcript: {
                    type: "string",
                    maxLength: 2000,
                    description: "What the avatar says, read in `voice_id`. Send this or `audio_url`; it must fit in 20 seconds of speech.",
                  },
                  audio_url: {
                    type: "string",
                    format: "uri",
                    description: "Speech audio (MP3, WAV or M4A) up to 20 seconds, instead of `transcript`.",
                  },
                  voice_id: {
                    type: "string",
                    default: "Friendly_Person",
                    description: "Voice for `transcript`: a MiniMax preset, an Eleven v3 voice, or one of your cloned voices (see GET /voice-clones).",
                  },
                  emotion: {
                    type: "string",
                    enum: [
                      "happy",
                      "sad",
                      "angry",
                      "fearful",
                      "disgusted",
                      "surprised",
                      "neutral",
                    ],
                    default: "neutral",
                  },
                  prompt: {
                    type: "string",
                    description: "Optional direction for the performance.",
                  },
                  resolution: {
                    type: "string",
                    enum: ["480p", "720p"],
                    default: "720p",
                  },
                  model: {
                    type: "string",
                    enum: ["skyreels-v3"],
                    default: "skyreels-v3",
                  },
                },
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
                  $ref: "#/components/schemas/GenerationCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing portrait, missing both transcript and audio, speech longer than 20 seconds, or an invalid voice, emotion, resolution or model",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Avatar generation (or the chosen voice's provider) is not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/avatar-generations/all": {
      get: {
        tags: ["Avatar"],
        summary: "List talking-avatar videos (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AvatarListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/avatar-generations/{generationId}": {
      delete: {
        tags: ["Avatar"],
        summary: "Delete a talking-avatar video",
        description: "Deletes the generation record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/movie-materials/create": {
      post: {
        tags: ["Movie materials"],
        summary: "Make a pre-production image for a film",
        description: "Generates one reference image for a script: a character's face, full body or turnaround sheet, a location, a first frame, a style collage, or a storyboard. Costs 3 credits at 1k, 4 at 2k, 6 at 4k. Poll GET /image/status/{id} with `generation.id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "Description of the character, place or scene.",
                  },
                  mode: {
                    type: "string",
                    enum: [
                      "face",
                      "wide-body",
                      "sheet",
                      "location",
                      "first-frame",
                      "style-collage",
                      "multishot-2x4",
                      "multishot-1x4",
                    ],
                    description: "`face` close-up portrait; `wide-body` full body; `sheet` character turnaround; `location` set reference; `first-frame` opening shot; `style-collage` look and feel; `multishot-2x4` and `multishot-1x4` storyboard grids.",
                  },
                  params: {
                    type: "object",
                    additionalProperties: {
                      type: "string",
                    },
                    description: "Optional per-mode settings: `cinematography` (every mode, default `cinematic`); `age` (default `adult`) and `gender` (default `female`) for `face`; `camera-angle` (default `eye-level`) for `first-frame`; `color-palette` (default `warm`), `lighting-mood` (default `natural`) and `era-vibe` (default `modern`) for `style-collage`.",
                  },
                  ratio: {
                    type: "string",
                    enum: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
                    default: "16:9",
                  },
                  resolution: {
                    type: "string",
                    enum: ["1k", "2k", "4k"],
                    default: "2k",
                  },
                  referenceImageUrls: {
                    type: "array",
                    maxItems: 14,
                    items: {
                      type: "string",
                      format: "uri",
                    },
                    description: "Up to 14 reference images, e.g. of the actor or the set.",
                  },
                },
                required: ["prompt", "mode"],
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
                  $ref: "#/components/schemas/GenerationCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing prompt, or an invalid mode, ratio or resolution, or more than 14 reference images",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/movie-materials/all": {
      get: {
        tags: ["Movie materials"],
        summary: "List movie-material images (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 20,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MovieMaterialsListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/movie-materials/{generationId}": {
      delete: {
        tags: ["Movie materials"],
        summary: "Delete a movie-material image",
        description: "Deletes the generation record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "generationId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-clones": {
      get: {
        tags: ["Voice clones"],
        summary: "List voices you can use",
        description: "The MiniMax preset voices, the Eleven v3 voices, and your cloned voices. Any of their ids works as `voice_id` in POST /voiceovers/create and POST /avatar-generations/create; POST /voice-conversions/create takes cloned voices only.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          "200": {
            description: "Voices",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VoiceCloneListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-clones/create": {
      post: {
        tags: ["Voice clones"],
        summary: "Clone a voice from a sample",
        description: "Makes an instant voice clone from a recording of one person speaking. Costs 15 credits. You can keep up to 10 clones.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    maxLength: 80,
                  },
                  description: {
                    type: "string",
                    maxLength: 500,
                  },
                  sample_url: {
                    type: "string",
                    format: "uri",
                    description: "Audio or video of the voice. Send this or `sample_asset_id`.",
                  },
                  sample_asset_id: {
                    type: "string",
                    description: "One of your AUDIO or VIDEO assets (e.g. from POST /uploads) instead of `sample_url`.",
                  },
                },
                required: ["name"],
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
                  $ref: "#/components/schemas/VoiceCloneCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing name or sample, name or description too long, an invalid or empty sample, or already 10 clones",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Voice cloning is not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-clones/{cloneId}": {
      delete: {
        tags: ["Voice clones"],
        summary: "Delete a cloned voice",
        description: "Deletes the clone. It can no longer be used as a `voice_id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "cloneId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Voice clone not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-conversions/create": {
      post: {
        tags: ["Voice changer"],
        summary: "Re-voice a recording with a cloned voice",
        description: "Speech-to-speech: keeps the words and timing of a recording and swaps the voice for one of your clones. Audio up to 5 minutes. Costs 10 credits per minute, rounded up (minimum 1). Poll GET /voiceovers/status/{id} with `conversion.id`.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["voice_id"],
                properties: {
                  voice_id: {
                    type: "string",
                    description: "Id of one of your cloned voices (GET /voice-clones). Preset voices are rejected.",
                  },
                  source_url: {
                    type: "string",
                    format: "uri",
                    description: "Recording to re-voice. Send this or `source_asset_id`.",
                  },
                  source_asset_id: {
                    type: "string",
                    description: "One of your AUDIO or VIDEO assets instead of `source_url`.",
                  },
                  output_format: {
                    type: "string",
                    enum: ["mp3", "wav"],
                    default: "mp3",
                  },
                },
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
                  $ref: "#/components/schemas/VoiceConversionCreateResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing voice_id or source, a voice that isn't your clone, an invalid output_format, or audio longer than 5 minutes",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "402": {
            description: "Insufficient credits",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "503": {
            description: "Voice conversion is not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-conversions/all": {
      get: {
        tags: ["Voice changer"],
        summary: "List voice-changer jobs (paginated)",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: {
              type: "integer",
              default: 1,
              minimum: 1,
            },
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              default: 12,
              minimum: 1,
              maximum: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/VoiceConversionListResponse",
                },
              },
            },
          },
          "404": {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/voice-conversions/{conversionId}": {
      delete: {
        tags: ["Voice changer"],
        summary: "Delete a voice-changer job",
        description: "Deletes the job record.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "conversionId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessMessage",
                },
              },
            },
          },
          "404": {
            description: "Not found, or not yours",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
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
        description:
          "Files you uploaded or imported, plus media URLs you passed to POST /posts (those are stored as uploads too). Generated media isn't included.",
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
                        note: {
                          type: "string",
                          description: "A reminder of the next steps.",
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
          "403": {
            description: "`blobName` is outside your own upload folder",
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
        description:
          "Deletes the asset record, then the stored file. An upload that any post still uses (scheduled or published) can't be deleted: the request returns 409 until those posts are deleted.",
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
          "409": {
            description: "A post still uses this upload. Delete the post first.",
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
    "/accounts/{accountId}/pinterest/boards": {
      get: {
        tags: ["Scheduler"],
        summary: "List a Pinterest account's boards",
        description:
          "Boards the connected Pinterest account can pin to: `{ id, name, privacy }`. " +
          "Pass an `id` as `settings.pinterest.board_id` in POST /posts.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "accountId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Boards",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          privacy: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Pinterest account not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/accounts/{accountId}/tiktok/creator-info": {
      get: {
        tags: ["Scheduler"],
        summary: "Get TikTok posting options for an account",
        description:
          "TikTok's creator info for the account: the privacy levels it may post with " +
          "(`privacy_level_options`), whether comments, duets and stitches are disabled, " +
          "the maximum video length and whether it can post right now. Use these values for " +
          "`settings.tiktok` in POST /posts.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "accountId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Creator info",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TikTokCreatorInfoResponse" },
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
          "`youtube`, `pinterest` and `google_business` objects); each account receives only the options for its " +
          "own platform. " +
          "A scheduled post is checked when it is created: media must match the post type, the caption " +
          "must be there when the type needs one, every platform must support the type, and each " +
          "platform's limits (caption length, image count, video length and size) must hold. A failed " +
          "check returns 400 with a `code` and, for platform limits, `issues`. Problems Unsora can fix " +
          "itself, such as an aspect ratio a platform rejects or a non-JPEG image for Instagram, are " +
          "fixed at publish time (padded or converted) instead of rejected. Drafts are checked when you publish them. " +
          "Media URLs you send are stored as uploads (they appear in GET /uploads). " +
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
              "Invalid request body (`error` describes the first problem: a missing caption, more than 10 accounts, the same account twice, scheduled_at less than 2 minutes ahead, an unsupported settings key), or a scheduled post that fails a publishing check (`code` MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED, UNSUPPORTED_FORMAT, PLATFORM_RULES with `issues`, or PLATFORM_UNAVAILABLE).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostRuleErrorResponse" },
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
          "polled less often as a post ages: every 6 hours for its first 48 hours, then daily " +
          "up to 7 days, every 3 days up to 30 days, and weekly up to 90 days. X posts are " +
          "polled every 12 hours, then every 2 days, then weekly, and stop at 30 days. Use " +
          "POST /posts/analytics/refresh for fresh figures.",
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
          "90 days (YouTube, TikTok, Instagram, Facebook, Threads, Pinterest, LinkedIn, Bluesky, " +
          "X, Google Business Profile) " +
          "and stores a snapshot for each. Posts read in the last 15 minutes (3 hours for X) " +
          "are skipped. The response is returned after polling finishes. " +
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
          "Updates the caption, schedule, time zone or accounts of a post that is not PUBLISHED. " +
          "Only `mainCaption`, `scheduledFor`, `timezone` and `accounts` are read, and only the fields " +
          "sent are changed. Media, post type and platform settings can't be changed: delete the post " +
          "and create a new one. The create-time spellings `caption`, `scheduled_at` and `accounts[].id` " +
          "are not accepted here, and the 10-account limit of POST /posts isn't applied. " +
          "`scheduledFor` must be at least 1 minute in the future (400 SCHEDULE_IN_PAST). " +
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
              "Invalid field, `scheduledFor` less than 1 minute ahead (code SCHEDULE_IN_PAST), or the post is PUBLISHED and can't be edited.",
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
          "platform is not removed from that platform. Works without a paid plan, so a lapsed " +
          "account can still clear its queue.",
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
          "and CAROUSEL; Facebook, Threads, Bluesky, LinkedIn and X support all four types; " +
          "Google Business Profile supports IMAGE and TEXT. " +
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
              "The post can't be published. `code` is POST_PUBLISHED (the post, or every account on it, is already published), ACCOUNT_REQUIRED, MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED, UNSUPPORTED_FORMAT, PLATFORM_RULES (a platform limit is broken; see `issues`) or PLATFORM_UNAVAILABLE (a platform on the post is switched off).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostRuleErrorResponse" },
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
              "The post can't be retried. `code` is NOT_RETRYABLE (the post is DRAFT or SCHEDULED), POST_PUBLISHED, ACCOUNT_REQUIRED, MEDIA_REQUIRED, MEDIA_NOT_ALLOWED, MIXED_MEDIA, CAPTION_REQUIRED, UNSUPPORTED_FORMAT, PLATFORM_RULES (a platform limit is broken; see `issues`) or PLATFORM_UNAVAILABLE (a platform on the post is switched off).",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostRuleErrorResponse" },
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
