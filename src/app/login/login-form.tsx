"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  signIn,
  signUp,
  requestPasswordReset,
  type AuthActionState,
  type ResetRequestState,
} from "./actions";

const initialState: AuthActionState = { error: null };
const initialResetState: ResetRequestState = { error: null, sent: false };

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">(
    "sign-in",
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    initialResetState,
  );

  if (mode === "forgot") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Stars Private Investigations — Time Clock
          </CardDescription>
        </CardHeader>
        {resetState.sent ? (
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              If that email has an account, a reset link is on its way. Click
              it to set a new password — check spam if it doesn&apos;t show up
              in a few minutes.
            </p>
          </CardContent>
        ) : (
          <form action={resetAction}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" name="email" type="email" required />
              </div>
              {resetState.error && (
                <p className="text-sm text-destructive">{resetState.error}</p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={resetPending}>
                {resetPending ? "Sending…" : "Send reset link"}
              </Button>
            </CardFooter>
          </form>
        )}
        <CardFooter className="justify-center pt-0">
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to sign in
          </button>
        </CardFooter>
      </Card>
    );
  }

  const isSignIn = mode === "sign-in";
  const state = isSignIn ? signInState : signUpState;
  const action = isSignIn ? signInAction : signUpAction;
  const pending = isSignIn ? signInPending : signUpPending;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignIn ? "Sign in" : "Create account"}</CardTitle>
        <CardDescription>
          Stars Private Investigations — Time Clock
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          {!isSignIn && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
          </Button>
          {isSignIn && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm text-muted-foreground hover:underline"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(isSignIn ? "sign-up" : "sign-in")}
            className="text-sm text-muted-foreground hover:underline"
          >
            {isSignIn
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
