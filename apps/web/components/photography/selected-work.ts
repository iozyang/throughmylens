import "server-only";
import catalog from "./selected-work.json";
import { toPublicPhotograph } from "./public-photograph";

// Import this module only from server routes, never from a client component.
export const selectedWorkPhotographs = catalog.photos.map(toPublicPhotograph).sort((a, b) => a.order - b.order);
