import { type JWTPayload, jwtVerify, SignJWT } from "jose";

const encoder = new TextEncoder();

const ISSUER = "e-track-api";
const AUDIENCE = "e-track-app";

/// Claims guaranteed to exist on an access token issued by E Track.
export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  email: string;
}

export interface AccessTokenInput {
  sub: string;
  email: string;
}

/// Creates the bearer token returned by the login endpoint.
export function signAccessToken(
  claims: AccessTokenInput,
  secret: string,
  expiresIn = "24h",
): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

/// Verifies signature, issuer, audience, algorithm and expiry.
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, encoder.encode(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });

  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Access token is missing required claims.");
  }

  return payload as AccessTokenClaims;
}
