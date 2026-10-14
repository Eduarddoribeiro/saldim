import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readSupabaseConfig } from './supabase-config'

const { url, publishableKey } = readSupabaseConfig(import.meta.env)

/** Cliente único da app. Os tipos vêm de `npm run db:types` (regenerar após cada migration). */
export const supabase = createClient<Database>(url, publishableKey)
