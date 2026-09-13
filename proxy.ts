import { NextResponse, type NextRequest } from "next/server";

// Optional password protection for public deployments. When APP_PASSWORD is set, the whole
// site (including the Gemini API route, which spends your API quota) asks for it via the
// browser's built-in login prompt. Any username works. Unset = no protection (local dev).
export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const [scheme, encoded] = (req.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      const decoded = atob(encoded);
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {
      // malformed header: fall through to the prompt
    }
  }

  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Captions", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
