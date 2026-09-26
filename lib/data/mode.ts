// No credentials in this module: it is safe to import from client components.
export const liveData = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
