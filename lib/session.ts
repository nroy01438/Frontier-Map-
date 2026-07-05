import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshAccessToken } from "@/lib/spotify";
import { isMockMode } from "@/lib/mock";
import type { User } from "@prisma/client";

export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

const REFRESH_BUFFER_MS = 60_000;

/** Returns a usable Spotify access token for the given user, refreshing it first if it's near expiry. */
export async function getValidAccessToken(userId: string): Promise<string> {
  if (isMockMode()) return "mock-access-token";

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = Date.now();

  if (user.tokenExpiresAt.getTime() - REFRESH_BUFFER_MS > now) {
    return decrypt(user.accessToken);
  }

  const refreshed = await refreshAccessToken(decrypt(user.refreshToken));
  await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: encrypt(refreshed.access_token),
      ...(refreshed.refresh_token ? { refreshToken: encrypt(refreshed.refresh_token) } : {}),
      tokenExpiresAt: new Date(now + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}
