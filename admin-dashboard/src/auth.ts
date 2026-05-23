import NextAuth, { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Extend NextAuth type declarations to support our custom properties
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      phoneNumber?: string;
      currentTrust?: number;
    } & DefaultSession["user"]
  }

  interface User {
    id?: string;
    phoneNumber?: string;
    currentTrust?: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "OTP",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials?.otp) return null;

        try {
          const res = await fetch("http://127.0.0.1:3000/api/auth/verify-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phoneNumber: credentials.phoneNumber,
              otp: credentials.otp,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            console.error("Auth verification failed:", errorData.message);
            return null;
          }

          const result = await res.json();
          if (result.success && result.data) {
            // Returns user: { id, phoneNumber, currentTrust }
            return result.data;
          }
        } catch (err) {
          console.error("Error authorizing credentials:", err);
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phoneNumber = user.phoneNumber;
        token.currentTrust = user.currentTrust;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.phoneNumber = token.phoneNumber as string;
        session.user.currentTrust = token.currentTrust as number;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/", // Redirect to home if unauthenticated
  },
});
