import * as z from "zod";

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
