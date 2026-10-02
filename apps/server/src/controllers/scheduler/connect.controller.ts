import { SchedulerAccountsController } from "./accounts/connect.controller";
import { BlueskySchedulerController } from "./bluesky/connect.controller";
import { FacebookSchedulerController } from "./facebook/connect.controller";
import { GoogleSchedulerController } from "./google/connect.controller";
import { InstagramSchedulerController } from "./instagram/connect.controller";
import { LinkedInSchedulerController } from "./linkedin/connect.controller";
import { PinterestSchedulerController } from "./pinterest/connect.controller";
import { ThreadsSchedulerController } from "./threads/connect.controller";
import { TikTokSchedulerController } from "./tiktok/connect.controller";

export class ConnectController {
  private readonly googleController = new GoogleSchedulerController();
  private readonly tikTokController = new TikTokSchedulerController();
  private readonly facebookController = new FacebookSchedulerController();
  private readonly instagramController = new InstagramSchedulerController();
  private readonly blueskyController = new BlueskySchedulerController();
  private readonly threadsController = new ThreadsSchedulerController();
  private readonly pinterestController = new PinterestSchedulerController();
  private readonly linkedInController = new LinkedInSchedulerController();
  private readonly accountsController = new SchedulerAccountsController();

  getGoogleAuthUrl = this.googleController.getGoogleAuthUrl;
  handleGoogleCallback = this.googleController.handleGoogleCallback;

  getTikTokAuthUrl = this.tikTokController.getTikTokAuthUrl;
  handleTikTokCallback = this.tikTokController.handleTikTokCallback;
  getTikTokCreatorInfo = this.tikTokController.getTikTokCreatorInfo;

  getFacebookAuthUrl = this.facebookController.getFacebookAuthUrl;
  handleFacebookCallback = this.facebookController.handleFacebookCallback;

  getInstagramAuthUrl = this.instagramController.getInstagramAuthUrl;
  handleInstagramCallback = this.instagramController.handleInstagramCallback;

  getBlueskyAuthUrl = this.blueskyController.getBlueskyAuthUrl;
  handleBlueskyCallback = this.blueskyController.handleBlueskyCallback;
  serveBlueskyClientMetadata = this.blueskyController.serveClientMetadata;
  serveBlueskyJwks = this.blueskyController.serveJwks;

  getThreadsAuthUrl = this.threadsController.getThreadsAuthUrl;
  handleThreadsCallback = this.threadsController.handleThreadsCallback;

  getPinterestAuthUrl = this.pinterestController.getPinterestAuthUrl;
  handlePinterestCallback = this.pinterestController.handlePinterestCallback;
  getPinterestBoards = this.pinterestController.getPinterestBoards;

  getLinkedInAuthUrl = this.linkedInController.getLinkedInAuthUrl;
  handleLinkedInCallback = this.linkedInController.handleLinkedInCallback;

  getConnectedAccounts = this.accountsController.getConnectedAccounts;
  refreshAccount = this.accountsController.refreshAccount;
  disconnectAccount = this.accountsController.disconnectAccount;
}
