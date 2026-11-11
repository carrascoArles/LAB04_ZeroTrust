import { toUserMessage } from "../services/errors";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { SignInButton } from "./SignInButton";

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Mensaje claro para cualquier error, con el requestId para reportarlo y nunca el token. */
export function ErrorMessage({
  error,
  onRetry,
  retryLabel = "Reintentar",
}: Readonly<ErrorMessageProps>) {
  const message = toUserMessage(error);
  return (
    <Alert tone="error" title={message.title}>
      {message.detail && <p>{message.detail}</p>}
      {message.requestId && (
        <p className="text-sm">
          Código de referencia: <span className="font-mono break-all">{message.requestId}</span>
        </p>
      )}
      {(onRetry || message.needsSignIn) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {message.needsSignIn && <SignInButton />}
          {onRetry && !message.needsSignIn && (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
}
