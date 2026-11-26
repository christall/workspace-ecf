import { createClient, type InValue } from '@libsql/client'

const DB_PATH = process.env.LIBSQL_URL || 'file:./db/erp.db'

const globalForDb = globalThis as unknown as { db: ReturnType<typeof createClient> }
export const db = globalForDb.db ?? createClient({ url: DB_PATH })
if (process.env.NODE_ENV !== 'production') globalForDb.db = db

export async function query<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args })
  // Convertir les Row libsql en plain objects (requis pour les Server→Client Components)
  return result.rows.map(row => Object.fromEntries(Object.entries(row))) as unknown as T[]
}

export async function queryOne<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | null> {
  const rows = await query<T>(sql, args)
  return rows[0] ?? null
}

export type Franchise = { id: string; code: string; nom: string; ville: string }
export type Utilisateur = {
  id: string; franchise_id: string; email: string; password_hash: string
  prenom: string; nom: string; role: string; is_active: number
}
export type Ressource = {
  id: string; franchise_id: string; code: string
  nom: string; type: string; couleur_hex: string; is_active: number
}
export type Produit = {
  id: string; code: string; nom: string; duree_minutes: number; couleur_hex: string
}
export type Personne = {
  id: string; franchise_id: string; nom: string; prenom: string
  email: string | null; tel_mobile: string | null; date_naissance: string | null
  ville: string | null; date_inscription: string | null; filiere: string | null
  permis_code: string; nb_heures: number; solde_credit: number
  code_obtenu: number; date_code: string | null; created_at: string
}
export type Creneau = {
  id: string; date: string; heure_debut: string; heure_fin: string
  produit_id: string; produit_code: string; produit_nom: string; produit_couleur: string
  ressource_id: string; ressource_code: string; ressource_nom: string; ressource_couleur: string
  verrou_planning: number; commentaire: string | null
  eleves?: { id: string; prenom: string; nom: string; abspres: number | null }[]
}
