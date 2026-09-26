import type { KollabRepo } from "./repo";
import { mockRepo } from "./mock-repo";
import { httpRepo } from "./http-repo";
import { liveData } from "./mode";
export const repo: KollabRepo = liveData ? httpRepo : mockRepo;
