import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations";
import { handle, ok, ApiError } from "@/lib/api";
import { writeAudit, requestMeta } from "@/lib/audit";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const { identifier, password } = loginSchema.parse(body);

    // Connexion par username OU email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "Identifiants invalides");
    }
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      throw new ApiError(401, "Identifiants invalides");
    }

    await createSession({
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const meta = requestMeta(req);
    await writeAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ...meta,
    });

    return ok({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  });
}
