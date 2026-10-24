import type { RequestEvent } from "../requests/requestEvents.ts";
import type { UiEvent } from "../requests/uiEvents.ts";
import type { ResponseEvent } from "../responses/responseEvents.ts";

export type AppEvent = RequestEvent | ResponseEvent | UiEvent;
