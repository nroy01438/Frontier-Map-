import { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { ensureMockUser, isMockMode } from "@/lib/mock";

const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-recently-played",
  "user-top-read",
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

const providers: NextAuthOptions["providers"] = isMockMode()
  ? [
      CredentialsProvider({
        id: "mock",
        name: "Demo Mode",
        credentials: {},
        async authorize() {
          const user = await ensureMockUser();
          return { id: user.id, name: user.displayName, email: user.email ?? undefined };
        },
      }),
    ]
  : [
      SpotifyProvider({
        clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
        authorization: { params: { scope: SPOTIFY_SCOPES } },
      }),
    ];

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (isMockMode()) {
        if (user) token.userId = user.id;
        return token;
      }

      if (account && profile) {
        const spotifyProfile = profile as unknown as {
          id: string;
          display_name?: string;
          email?: string;
        };
        const expiresAtSeconds =
          (account.expires_at as number | undefined) ?? Math.floor(Date.now() / 1000) + 3600;

        const existing = await prisma.user.findUnique({ where: { spotifyId: spotifyProfile.id } });
        const refreshToken = (account.refresh_token as string | undefined) ?? undefined;

        const dbUser = await prisma.user.upsert({
          where: { spotifyId: spotifyProfile.id },
          update: {
            displayName: spotifyProfile.display_name,
            email: spotifyProfile.email,
            accessToken: encrypt(account.access_token as string),
            ...(refreshToken ? { refreshToken: encrypt(refreshToken) } : {}),
            tokenExpiresAt: new Date(expiresAtSeconds * 1000),
          },
          create: {
            spotifyId: spotifyProfile.id,
            displayName: spotifyProfile.display_name,
            email: spotifyProfile.email,
            accessToken: encrypt(account.access_token as string),
            refreshToken: encrypt(refreshToken ?? ""),
            tokenExpiresAt: new Date(expiresAtSeconds * 1000),
          },
        });

        if (!existing && !refreshToken) {
          // Spotify did not return a refresh token on first sign-in (unexpected) — surface loudly rather
          // than silently persisting an unusable empty token that will fail every future refresh.
          console.error(`No refresh token returned for new user ${dbUser.id} on initial Spotify sign-in`);
        }
        token.userId = dbUser.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as typeof session.user & { id: string }).id = token.userId as string;
      }
      return session;
    },
  },
};
