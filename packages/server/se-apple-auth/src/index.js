import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import { generateRandomAlphanumericString } from "@buydy/iso-auth-utils";

class AppleAuthService {
  constructor(clientId, teamId, keyId, privateKey, dbClient) {
    this.provider = "apple";
    this.clientId = clientId;
    this.teamId = teamId;
    this.keyId = keyId;
    this.privateKey = privateKey;
    this.db = dbClient;
    this.applePublicKeys = null;
    this.publicKeysLastFetched = null;
    this.publicKeysCacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Fetch Apple's public keys for JWT verification
   * @returns {Promise<Object>} Apple's public keys
   */
  async fetchApplePublicKeys() {
    try {
      const now = Date.now();

      // Check if we have cached keys and they're still valid
      if (
        this.applePublicKeys &&
        this.publicKeysLastFetched &&
        now - this.publicKeysLastFetched < this.publicKeysCacheExpiry
      ) {
        return this.applePublicKeys;
      }

      const response = await fetch("https://appleid.apple.com/auth/keys");

      if (!response.ok) {
        throw new Error("Failed to fetch Apple public keys");
      }

      const keysData = await response.json();

      // Convert JWKs to PEM format
      const publicKeys = {};
      keysData.keys.forEach((key) => {
        const pem = jwkToPem(key);
        publicKeys[key.kid] = pem;
      });

      this.applePublicKeys = publicKeys;
      this.publicKeysLastFetched = now;

      return publicKeys;
    } catch (error) {
      throw new Error(`Failed to fetch Apple public keys: ${error.message}`);
    }
  }

  /**
   * Verify Apple ID token
   * @param {string} idToken - Apple ID token from client
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyIdToken(idToken) {
    try {
      // Decode the token header to get the key ID
      const decodedHeader = jwt.decode(idToken, { complete: true });

      if (!decodedHeader) {
        throw new Error("Invalid Apple ID token format");
      }

      const { kid } = decodedHeader.header;

      // Fetch Apple's public keys
      const publicKeys = await this.fetchApplePublicKeys();

      if (!publicKeys[kid]) {
        throw new Error("Apple public key not found for the given key ID");
      }

      // Verify the token
      const payload = jwt.verify(idToken, publicKeys[kid], {
        algorithms: ["RS256"],
        audience: this.clientId,
        issuer: "https://appleid.apple.com",
      });

      return payload;
    } catch (error) {
      throw new Error(`Apple token verification failed: ${error.message}`);
    }
  }

  /**
   * Generate client secret for Apple OAuth
   * @returns {string} JWT client secret
   */
  generateClientSecret() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + 15777000, // 6 months
      aud: "https://appleid.apple.com",
      sub: this.clientId,
    };

    const options = {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: this.keyId,
      },
    };

    return jwt.sign(payload, this.privateKey, options);
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from Apple OAuth flow
   * @param {string} redirectUri - Redirect URI used in OAuth flow
   * @returns {Promise<Object>} Token response from Apple
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const clientSecret = this.generateClientSecret();

      const response = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Apple token exchange failed: ${errorData}`);
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
      };
    } catch (error) {
      throw new Error(`Apple code exchange failed: ${error.message}`);
    }
  }

  /**
   * Extract user information from Apple ID token
   * @param {Object} payload - Decoded Apple ID token payload
   * @returns {Object} User information
   */
  extractUserInfo(payload) {
    return {
      id: payload.sub, // Apple's unique user identifier
      email: payload.email,
      emailVerified: payload.email_verified === "true",
      name: payload.name
        ? {
            firstName: payload.name.firstName,
            lastName: payload.name.lastName,
          }
        : null,
      isPrivateEmail: payload.is_private_email === "true",
    };
  }

  /**
   * Create or update user in database
   * @param {Object} userInfo - User information from Apple
   * @returns {Promise<Object>} User record with JWT token
   */
  async createOrUpdateUser(userInfo) {
    if (!this.db) {
      throw new Error("Database client not provided");
    }

    // Transform Apple user info to standard format
    const standardUserInfo = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      emailVerified: userInfo.emailVerified,
      isPrivateEmail: userInfo.isPrivateEmail,
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
   * Complete Apple authentication flow
   * @param {string} idToken - Apple ID token from client
   * @returns {Promise<Object>} Authentication result with user and token
   */
  async authenticate(idToken) {
    try {
      // Verify the ID token
      const payload = await this.verifyIdToken(idToken);

      // Extract user information
      const userInfo = this.extractUserInfo(payload);

      // Create or update user in database
      const authResult = await this.createOrUpdateUser(userInfo);

      return authResult;
    } catch (error) {
      throw new Error(`Apple authentication failed: ${error.message}`);
    }
  }

  /**
   * Refresh Apple access token
   * @param {string} refreshToken - Apple refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshToken(refreshToken) {
    try {
      const clientSecret = this.generateClientSecret();

      const response = await fetch("https://appleid.apple.com/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Apple token refresh failed: ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Apple token refresh failed: ${error.message}`);
    }
  }
}

export default AppleAuthService;
