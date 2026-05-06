import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { ensureUserFromDiscord } from "@/lib/game/user";
import { prisma } from "@/lib/db/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: { params: { scope: "identify email" } }
    })
  ],
  callbacks: {
    async signIn({ profile }) {
      const discordProfile = profile as
        | { id?: string; username?: string; global_name?: string; image_url?: string; avatar?: string }
        | undefined;

      if (!discordProfile?.id) {
        return false;
      }

      await ensureUserFromDiscord({
        discordId: discordProfile.id,
        username:
          discordProfile.global_name ||
          discordProfile.username ||
          `farmer-${discordProfile.id.slice(-4)}`,
        avatarUrl: discordProfile.image_url || null
      });

      return true;
    },
    async jwt({ token, profile }) {
      const discordProfile = profile as
        | { id?: string; username?: string; global_name?: string; image_url?: string }
        | undefined;

      if (discordProfile?.id) {
        const user = await ensureUserFromDiscord({
          discordId: discordProfile.id,
          username:
            discordProfile.global_name ||
            discordProfile.username ||
            `farmer-${discordProfile.id.slice(-4)}`,
          avatarUrl: discordProfile.image_url || null
        });
        token.userId = user.id;
        token.discordId = user.discordId;
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
      } else if (!token.userId && token.discordId) {
        const user = await prisma.user.findUnique({
          where: { discordId: String(token.discordId) }
        });
        if (user) {
          token.userId = user.id;
          token.username = user.username;
          token.avatarUrl = user.avatarUrl;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId || "");
        session.user.discordId = String(token.discordId || "");
        session.user.name = String(token.username || session.user.name || "");
        session.user.image = token.avatarUrl ? String(token.avatarUrl) : session.user.image;
      }

      return session;
    }
  },
  pages: {
    signIn: "/"
  }
};
