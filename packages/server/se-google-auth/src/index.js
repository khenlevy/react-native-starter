import { OAuth2Client } from "google-auth-library";
import { generateRandomAlphanumericString } from "@buydy/iso-auth-utils";

class GoogleAuthService {
  constructor(clientId, clientSecret, dbClient) {
    this.provider = "google";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.client = new OAuth2Client(clientId);
    this.db = dbClient;
  }

  /**
   * Verify Google ID token and extract user information
   * @param {string} idToken - Google ID token from client
   * @returns {Promise<Object>} User information
   */
  async verifyIdToken(idToken) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        emailVerified: payload.email_verified,
        locale: payload.locale,
        hd: payload.hd, // Hosted domain (for G Suite users)
      };
    } catch (error) {
      throw new Error(`Google token verification failed: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for tokens and user info
   * @param {string} code - Authorization code from Google OAuth flow
   * @param {string} redirectUri - Redirect URI used in OAuth flow
   * @returns {Promise<Object>} User information and tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const { tokens } = await this.client.getToken({
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      // Get user info using access token
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        user: userInfo,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresAt: tokens.expiry_date,
        },
      };
    } catch (error) {
      throw new Error(`Google code exchange failed: ${error.message}`);
    }
  }

  /**
   * Get user information from Google using access token
   * @param {string} accessToken - Google access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user info from Google");
      }

      const userInfo = await response.json();

      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
        emailVerified: userInfo.verified_email,
        locale: userInfo.locale,
        hd: userInfo.hd,
      };
    } catch (error) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  /**
   * Create or update user in database
   * @param {Object} userInfo - User information from Google
   * @returns {Promise<Object>} User record with JWT token
   */
  async createOrUpdateUser(userInfo) {
    if (!this.db) {
      throw new Error("Database client not provided");
    }

    // Transform Google user info to standard format
    const standardUserInfo = {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
      emailVerified: userInfo.email_verified,
      locale: userInfo.locale,
      hd: userInfo.hd, // Hosted domain (for G Suite users)
    };

    // Check if user exists
    const existingUser = await this.db.findOne("users", {
      provider: this.provider,
      providerId: standardUserInfo.id,
    });

    if (existingUser) {
      // Update existing user
      await this.db.update(
        "users",
        { _id: existingUser._id },
        {
          $set: {
            ...standardUserInfo,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      const updatedUser = await this.db.findOne("users", {
        _id: existingUser._id,
      });

      // Generate JWT token
      const mockToken = `${this.provider}-jwt-${Date.now()}-${generateRandomAlphanumericString(9)}`;

      return {
        token: mockToken,
        user: updatedUser,
      };
    } else {
      // Create new user
      const newUser = {
        ...standardUserInfo,
        provider: this.provider,
        providerId: standardUserInfo.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const createdUser = await this.db.create("users", newUser);

      // Generate JWT token
      const mockToken = `${this.provider}-jwt-${Date.now()}-${generateRandomAlphanumericString(9)}`;

      return {
        token: mockToken,
        user: createdUser,
      };
    }
  }

  /**
   * Complete Google authentication flow
   * @param {string} idToken - Google ID token from client
   * @returns {Promise<Object>} Authentication result with user and token
   */
  async authenticate(idToken) {
    try {
      // Verify the ID token
      const userInfo = await this.verifyIdToken(idToken);

      // Create or update user in database
      const authResult = await this.createOrUpdateUser(userInfo);

      return authResult;
    } catch (error) {
      throw new Error(`Google authentication failed: ${error.message}`);
    }
  }
}

export default GoogleAuthService;
