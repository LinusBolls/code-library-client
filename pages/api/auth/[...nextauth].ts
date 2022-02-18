import jwt from "jsonwebtoken";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import jsonwebtoken from "jsonwebtoken";
import { gql } from "@apollo/client";

import client from "../../../apollo-client";

// https://next-auth.js.org/configuration/options

const validTimeInSeconds = parseInt(process.env.MAX_SESSION_DURATION_SECONDS);

/*
graphQl queries require keys to not be surrounded by quotes, but JSON.stringify() produces quoted keys
*/
const graphqlStringify = (obj: { [key: string]: any }) => {
  const sache = Object.entries(obj).map(([key, value]) => `${key}: "${value}"`);
  return "{" + sache.join(", ") + "}";
};
const mintJwt = (userData: { [key: string]: any }) => ({
  query: gql`
    query GetUserData {
    mintJwt(userData: ${graphqlStringify(userData)}, secret: "${
    process.env.JWT_SECRET
  }")
    }
  `,
});
export default NextAuth({
  secret: process.env.JWT_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    signOut: "/logout",
    // we are not using these but lets keep them in anyway
    error: "/auth-error", // error code passed in query string as ?error=
    verifyRequest: "/auth-verify-request", // used to check email magic link message
    newUser: "/auth-new-user",
  },
  session: {
    strategy: "jwt",
    maxAge: validTimeInSeconds,
  },
  jwt: {
    /*
      next-auth is using non-standart jwts, which libraries like jsonwebtoken are to my knowledge unable to decode.
      since we are not using next-auth on the graphql backend, but still need to decode the jwts there,
      we are going with a 💫 custom 💫 implementation using jsonwebtoken.
      this is thankfully supported by next-auth.
      */
    encode: async ({ token }) => {
      if (token == null) return "";
      if (token.state) return jwt.sign(token, process.env.JWT_SECRET);

      const { name, email, picture } = token;
      const userData = { name, email, picture };

      const { data, error } = await client.query(mintJwt(userData));

      return error ? "" : data.mintJwt;
    },
    decode: ({ token }) => {
      const result = jsonwebtoken.verify(token || "", process.env.JWT_SECRET);

      return result as any;
    },
  },
  callbacks: {
    session: async ({ session, token }) => {
      (session.user as any).permsInt = token.permsInt;
      return session;
    },
  },
});
