const SHADOWED_WARNING_CODE = "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED";

type EmitWarning = typeof process.emitWarning;

function readWarningCode(args: unknown[]): unknown {
  const [first, second] = args;
  if (typeof first === "object" && first !== null) return (first as { code?: unknown }).code;
  return typeof first === "string" && typeof second === "string" ? second : undefined;
}

export function muteShadowedWarning(): void {
  const original: EmitWarning = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    if (readWarningCode(args) === SHADOWED_WARNING_CODE) return;
    return (original as (...all: unknown[]) => void)(warning, ...args);
  }) as EmitWarning;
}
