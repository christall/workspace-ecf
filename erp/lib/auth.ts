import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { queryOne } from './db'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')

export type JWTPayload = {
  sub: string        // utilisateur id
  email: string
  prenom: string
  nom: string
  role: string
  franchise_id: string
  franchise_code: string
  franchise_nom: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  // Revalider la franchise_id depuis la DB (immunise contre les imports/migrations)
  const fresh = await queryOne<{ franchise_id: string; franchise_code: string; franchise_nom: string }>(
    `SELECT u.franchise_id, f.code as franchise_code, f.nom as franchise_nom
     FROM utilisateurs u JOIN franchises f ON f.id=u.franchise_id
     WHERE u.id=? AND u.is_active=1 LIMIT 1`,
    [payload.sub]
  )
  if (!fresh) return null
  return { ...payload, franchise_id: fresh.franchise_id, franchise_code: fresh.franchise_code, franchise_nom: fresh.franchise_nom }
}

export async function getUserWithFranchise(email: string) {
  return queryOne<Record<string, unknown>>(
    `SELECT u.*, f.code as franchise_code, f.nom as franchise_nom
     FROM utilisateurs u JOIN franchises f ON f.id = u.franchise_id
     WHERE u.email = ? AND u.is_active = 1 LIMIT 1`,
    [email]
  )
}
