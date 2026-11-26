import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import type { Utilisateur } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password)
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })

  const user = await queryOne<Utilisateur & { franchise_code: string; franchise_nom: string }>(
    `SELECT u.*, f.code as franchise_code, f.nom as franchise_nom
     FROM utilisateurs u JOIN franchises f ON f.id = u.franchise_id
     WHERE u.email = ? AND u.is_active = 1 LIMIT 1`,
    [email as string]
  )

  if (!user || !(await bcrypt.compare(password as string, user.password_hash)))
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })

  const token = await signToken({
    sub: user.id, email: user.email, prenom: user.prenom, nom: user.nom,
    role: user.role, franchise_id: user.franchise_id,
    franchise_code: user.franchise_code, franchise_nom: user.franchise_nom,
  })

  const response = NextResponse.json({ ok: true, prenom: user.prenom })
  response.cookies.set('erp_token', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 60 * 60 * 8, path: '/',
  })
  return response
}
