import type { RequestEvent } from "../requests/requestEvents.ts";
import type { ResponseEvent } from "../responses/responseEvents.ts";
import type { UiEvent } from "../requests/uiEvents.ts";

export type AppEvent = RequestEvent | ResponseEvent | UiEvent;
